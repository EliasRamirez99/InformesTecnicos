/* ============================================================================
   Codigo.gs — Backend del prototipo (Apps Script + Google Sheets + Drive)
   Implementa docs/CONTRATO-API.md. Lecturas abiertas; escrituras con clave.
   ----------------------------------------------------------------------------
   DESPLIEGUE:
     1) Este script se ata a una Google Sheet (Extensiones > Apps Script).
     2) Script Properties (Configuración del proyecto > Propiedades del script):
          OPS_API_KEY   = opskey_...           (para el autofill; NUNCA en el front)
          DRIVE_RAIZ_ID = <id carpeta Drive>   (raíz donde se crean subcarpetas por doc)
     3) Implementar > Nueva implementación > App web > "Cualquiera".
     4) Pegar la URL /exec en js/config.js (y en api/proxy.js si usás relay).
   Al re-desplegar: "Gestionar implementaciones > editar > Nueva versión" mantiene la URL.
   ========================================================================== */

var HOJA_DOCS = "documentos";
var CABECERA  = ["id","tipo","estado","creado","actualizado","autor","meta_json","doc_json","cid"];
var CLAVES = { "Taller":"123", "Campo":"123", "Pañol":"123", "Almacén":"123", "Admin":"123" };

// El script abre la Sheet por ID y se crea/usa la carpeta de imágenes solo.
var SHEET_ID = "1-7vofz1R5DJizMho0foM5P9X9MXKIur0BFsRoRm3hF4";   // Google Sheet base
var DRIVE_RAIZ_NOMBRE = "InformesTecnicos - Imagenes";           // carpeta que el script crea/usa

/* ---- API OPS (read-only) para el autofill; versión por-endpoint ---- */
var OPS_HOST = "https://gestion.opssrlapp.com/api/public";
var OPS_VER  = { "flota": "v3", "orden-reparacion": "v2" };

function doGet(e)  { return _responder(_manejar(e.parameter || {}, null)); }
function doPost(e) {
  var body = {};
  try { body = JSON.parse((e.postData && e.postData.contents) || "{}"); } catch (err) {}
  return _responder(_manejar(body, body));
}

function _manejar(p, postBody) {
  var accion = p.accion || "";
  try {
    switch (accion) {
      case "guardar_doc":  return _guardarDoc(postBody);
      case "subir_imagen": return _subirImagen(postBody);
      case "listar_docs":  return _listarDocs(p);
      case "obtener_doc":  return _obtenerDoc(p);
      case "referencia":   return _referencia(p);
      case "ping":         return { ok:true, pong:true, ts:new Date().toISOString() };
      default:             return { ok:false, error:"acción desconocida: " + accion };
    }
  } catch (err) {
    return { ok:false, error:String(err) };
  }
}

/* ---- helpers de hoja ---- */
function _hoja() {
  var ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(HOJA_DOCS);
  if (!sh) { sh = ss.insertSheet(HOJA_DOCS); sh.appendRow(CABECERA); return sh; }
  if (sh.getLastColumn() < CABECERA.length) sh.getRange(1, 1, 1, CABECERA.length).setValues([CABECERA]);
  return sh;
}
function _filaPorId(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return -1;                       // hoja vacía (sólo encabezado)
  var ids = sh.getRange(2, 1, last-1, 1).getValues();
  for (var i=0; i<ids.length; i++) { if (String(ids[i][0]) === String(id)) return i+2; }
  return -1;
}
function _filaPorCid(sh, cid) {                   // dedup de reintentos: 'cid' = última columna
  if (!cid) return -1;
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var vals = sh.getRange(2, CABECERA.length, last-1, 1).getValues();
  for (var i=0; i<vals.length; i++) { if (String(vals[i][0]) === String(cid)) return i+2; }
  return -1;
}
function _correlativo(pref) {
  var props = PropertiesService.getScriptProperties();
  var anio = new Date().getFullYear();
  var k = "seq_" + pref + "_" + anio;
  var n = parseInt(props.getProperty(k) || "0", 10) + 1;
  props.setProperty(k, String(n));
  return pref + "-" + anio + "-" + ("0000" + n).slice(-4);
}

/* ---- guardar_doc (upsert) ---- */
function _guardarDoc(b) {
  if (!b || !b.doc) return { ok:false, error:"falta doc" };
  if (!_claveOk(b.clave)) return { ok:false, error:"clave inválida" };
  var doc = b.doc, sh = _hoja();
  var cid = doc._cid || "";
  var esTmp = (!doc.id || String(doc.id).indexOf("tmp-") === 0);

  // Localizar fila existente: por cid (idempotencia ante reintentos) o por id (edición).
  var r = -1;
  if (cid) r = _filaPorCid(sh, cid);
  if (r === -1 && !esTmp) r = _filaPorId(sh, doc.id);

  if (r === -1 && esTmp) {                        // documento realmente nuevo
    doc.id = _correlativo(_prefijo(doc.tipo));
    doc.creado = doc.creado || new Date().toISOString();
  } else if (r !== -1) {                          // ya existe: reusar su id -> ACTUALIZA, no duplica
    doc.id = sh.getRange(r, 1).getValue() || doc.id;
  }
  doc.actualizado = new Date().toISOString();
  var fila = [ doc.id, doc.tipo, doc.estado||"borrador", doc.creado || new Date().toISOString(),
               doc.actualizado, (doc.autor && doc.autor.nombre) || "",
               JSON.stringify(doc.meta||{}), JSON.stringify(doc), cid ];
  if (r === -1) sh.appendRow(fila); else sh.getRange(r, 1, 1, CABECERA.length).setValues([fila]);
  return { ok:true, id:doc.id, actualizado:doc.actualizado };
}

/* ---- subir_imagen (a Drive) ---- */
function _subirImagen(b) {
  if (!_claveOk(b.clave)) return { ok:false, error:"clave inválida" };
  if (!b.base64) return { ok:false, error:"falta base64" };
  var carpeta = _subcarpeta(_carpetaRaiz(), b.doc_id || "sin_id");
  var blob = Utilities.newBlob(Utilities.base64Decode(b.base64), b.mime || "image/jpeg", b.nombre || "imagen.jpg");
  var file = carpeta.createFile(blob);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  var id = file.getId();
  return { ok:true, ref:id, url:"https://drive.google.com/uc?export=view&id=" + id };
}
function _subcarpeta(raiz, nombre) {
  var it = raiz.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : raiz.createFolder(nombre);
}
/* Carpeta raíz de imágenes: la crea (o reusa) el propio script y cachea su ID. */
function _carpetaRaiz() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("DRIVE_RAIZ_ID");
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var it = DriveApp.getFoldersByName(DRIVE_RAIZ_NOMBRE);
  var f = it.hasNext() ? it.next() : DriveApp.createFolder(DRIVE_RAIZ_NOMBRE);
  props.setProperty("DRIVE_RAIZ_ID", f.getId());
  return f;
}

/* ---- listar_docs (lectura abierta, con filtros) ---- */
function _listarDocs(p) {
  var sh = _hoja(), last = sh.getLastRow();
  if (last < 2) return { ok:true, docs:[] };
  var vals = sh.getRange(2, 1, last-1, CABECERA.length).getValues(), out = [];
  for (var i=0; i<vals.length; i++) {
    var v = vals[i];
    if (p.tipo && v[1] !== p.tipo) continue;
    var meta = {}; try { meta = JSON.parse(v[6]||"{}"); } catch (e) {}
    if (p.dominio && meta.dominio !== p.dominio) continue;
    out.push({ id:v[0], tipo:v[1], estado:v[2], creado:v[3], actualizado:v[4], meta:meta });
  }
  out.sort(function(a,b){ return String(b.creado).localeCompare(String(a.creado)); });
  return { ok:true, docs:out };
}

/* ---- obtener_doc ---- */
function _obtenerDoc(p) {
  var sh = _hoja(), r = _filaPorId(sh, p.id);
  if (r === -1) return { ok:false, error:"no existe" };
  var doc = {}; try { doc = JSON.parse(sh.getRange(r, 8).getValue()||"{}"); } catch (e) {}
  return { ok:true, doc:doc };
}

/* ---- referencia (autofill desde API OPS; la key va acá, server-side) ----
   TODO: OPS aún no expone lookup por dominio directo. Cuando lo confirmen,
   armar la query exacta. Por ahora devuelve fase-2 sin romper la carga. */
function _referencia(p) {
  var key = PropertiesService.getScriptProperties().getProperty("OPS_API_KEY");
  if (!key) return { ok:false, error:"OPS_API_KEY no configurada" };
  if (!p.dominio) return { ok:false, error:"falta dominio" };
  // Scaffolding listo; el lookup por dominio se cablea cuando OPS lo habilite:
  // var url = OPS_HOST + "/" + OPS_VER["flota"] + "/data/flota?dominio=" + encodeURIComponent(p.dominio);
  // var resp = UrlFetchApp.fetch(url, { headers:{ "X-API-Key":key }, muteHttpExceptions:true });
  // ... parsear resp y devolver { ok:true, equipo:{...} }
  return { ok:false, error:"autofill fase 2 (falta lookup por dominio en la API OPS)" };
}

/* ---- utilidades ---- */
function _prefijo(tipo) { return tipo === "boletin_mantenimiento" ? "BOL" : "INF"; }
function _claveOk(c) { for (var k in CLAVES) { if (CLAVES[k] === String(c)) return true; } return false; }
function _responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* Ejecutá esta función UNA vez con el botón ▶ Ejecutar para autorizar los permisos
   (Sheets + Drive). Si no tira error, ambos IDs resuelven bien. */
function autorizar() {
  var hoja = _hoja();
  var carpeta = _carpetaRaiz();
  return "OK — Sheet: " + hoja.getParent().getName() + " · Carpeta: " + carpeta.getName();
}

/* Limpieza única: borra los documentos de prueba (filas + fotos) y resetea los
   contadores para arrancar en 0001. Correr con ▶ Ejecutar. Editá la lista `ids`
   si querés borrar otros. */
function limpiarPruebas() {
  var res = [];
  var ids = ["INF-2026-0001", "INF-2026-0002", "INF-2026-0003"];
  var sh = _hoja();
  ids.forEach(function (id) {
    var r = _filaPorId(sh, id);
    if (r !== -1) { sh.deleteRow(r); res.push("fila borrada: " + id); }
  });
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty("seq_INF_2026");
  props.deleteProperty("seq_BOL_2026");
  res.push("contadores INF/BOL 2026 reseteados -> proximo = 0001");
  var raiz = _carpetaRaiz();
  ids.forEach(function (id) {
    var it = raiz.getFoldersByName(id);
    while (it.hasNext()) { it.next().setTrashed(true); res.push("fotos borradas: " + id); }
  });
  return res.join(" | ");
}
