/* ============================================================================
   editor.js — MOTOR DE EDICIÓN (mismo para Informe y Boletín)
   ----------------------------------------------------------------------------
   Lee window.TIPO_DOC, toma la plantilla de plantillas.js y construye el
   formulario: la estructura fija no se puede saltear ni reordenar. Adentro de
   cada sección se carga contenido libre (campos, tablas, bloques texto+imagen).
   Requiere: config, common, plantillas, listados, backend, imagenes.
   ========================================================================== */

(function () {
  "use strict";

  var TIPO = window.TIPO_DOC;
  var plantilla = plantillaDe(TIPO);
  var cont, barra;
  var doc = null;
  var guardando = false;
  var autosaveTimer = null;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cont  = document.getElementById("form");
    barra = document.getElementById("barra");
    if (!plantilla) { cont.innerHTML = "<p>Tipo de documento desconocido.</p>"; return; }

    var id = new URLSearchParams(location.search).get("id");
    if (id) {
      var r = await Backend.obtenerDoc(id);
      if (r && r.ok) doc = r.doc;
    }
    var recuperado = false;
    if (!doc) {
      var draft = leerDraftNuevo();
      if (draft) { doc = draft; recuperado = true; }
      else doc = nuevoDoc();
    }
    normalizar();
    render();
    if (recuperado) msg("Borrador recuperado de este navegador.", "ok");
  }

  function nuevoDoc() {
    return {
      id: "tmp-" + uuid(), _cid: uuid(), tipo: TIPO, version_plantilla: plantilla.version,
      estado: "borrador", creado: nowISO(), actualizado: nowISO(),
      autor: { nombre: "", sector: "" }, meta: {}, secciones: [], imagenes: {}
    };
  }

  /* Garantiza que exista el objeto de cada sección de la plantilla. */
  function normalizar() {
    doc.imagenes = doc.imagenes || {};
    doc.meta = doc.meta || {};
    plantilla.secciones.forEach(function (s) { seccionDoc(s); });
  }
  function seccionDoc(s) {
    var sd = doc.secciones.find(function (x) { return x.id === s.id; });
    if (!sd) { sd = vacia(s); doc.secciones.push(sd); }
    return sd;
  }
  function vacia(s) {
    if (s.tipo === "campos") return { id: s.id, tipo: "campos", campos: {} };
    if (s.tipo === "tabla")  return { id: s.id, tipo: "tabla", filas: [] };
    if (s.tipo === "anexos") return { id: s.id, tipo: "anexos", bloques: [] };
    return { id: s.id, tipo: "cuerpo", campos_extra: {}, bloques: [] };
  }

  /* ----------------------------- render ----------------------------- */
  function render() {
    cont.innerHTML = "";

    var head = el("div", { class: "editor-head" },
      el("h2", {}, plantilla.nombre),
      el("span", { class: "id" }, doc.id.indexOf("tmp-") === 0 ? "(sin guardar)" : doc.id),
      el("span", { class: "estado" + (doc.estado === "finalizado" ? " final" : "") }, doc.estado)
    );
    cont.append(head);
    cont.append(el("p", { class: "editor-sub" }, "Completá cada sección en orden. Las marcadas como obligatorias son necesarias para finalizar."));

    plantilla.secciones.forEach(function (s, i) {
      var sec = el("div", { class: "seccion" });
      var h = el("h3", {}, el("span", { class: "num" }, String(i + 1)), s.titulo);
      if (s.obligatoria) h.append(el("span", { class: "oblig" }, "OBLIG"));
      sec.append(h);
      var body = el("div", {});
      sec.append(body);
      if (s.tipo === "campos") renderCampos(s, seccionDoc(s), body);
      else if (s.tipo === "tabla") renderTabla(s, seccionDoc(s), body);
      else if (s.tipo === "anexos") renderCuerpo(s, seccionDoc(s), body, false);
      else renderCuerpo(s, seccionDoc(s), body, true);
      cont.append(sec);
    });

    // datalists compartidos
    var dls = el("div", { id: "datalists" });
    cont.append(dls);

    renderBarra();
  }

  /* ----------------------------- campos ----------------------------- */
  function renderCampos(s, sd, host) {
    var grid = el("div", { class: "campos-grid" });
    s.campos.forEach(function (c) {
      grid.append(campoEl(c, sd.campos, function (v) {
        programarAutosave();
        if (s.autofill && c.id === s.autofill && v) autofill(s, sd, v);
      }));
    });
    host.append(grid);
  }

  /* c = definición del campo; valores = objeto donde se guardan (sd.campos o
     sd.campos_extra); alCambiar(valorPrincipal) dispara autosave/autofill. */
  function campoEl(c, valores, alCambiar) {
    var wrap = el("div", { class: "campo", "data-campo": c.id });
    var lab = el("label", {}, c.etiqueta);
    if (c.requerido) lab.append(el("span", { class: "req" }, " *"));
    wrap.append(lab);

    if (c.tipo === "rango_fecha") {          // Desde–Hasta (Hasta vacío = mismo día)
      var cont = el("div", { class: "rango-fecha" });
      var celda = function (sub, etq) {
        var col = el("div", { class: "rango-celda" }, el("span", { class: "rango-lbl" }, etq));
        var inp = el("input", { type: "date" });
        inp.value = valores[c.id + sub] || "";
        inp.addEventListener("input", function () { valores[c.id + sub] = inp.value; alCambiar(valores[c.id + "_desde"]); });
        col.append(inp);
        return col;
      };
      cont.append(celda("_desde", "Desde"), celda("_hasta", "Hasta (si duró varios días)"));
      wrap.append(cont);
      return wrap;
    }

    var input;
    if (c.tipo === "opcion") {
      input = el("select", {});
      input.append(el("option", { value: "" }, "— elegir —"));
      (c.opciones || []).forEach(function (o) {
        var opt = el("option", { value: o }, o);
        if (valores[c.id] === o) opt.selected = true;
        input.append(opt);
      });
    } else if (c.tipo === "textarea") {
      input = el("textarea", { rows: "3" }); input.value = valores[c.id] || "";
    } else {
      var t = c.tipo === "fecha" ? "date" : c.tipo === "numero" ? "number" : "text";
      input = el("input", { type: t }); input.value = valores[c.id] || "";
      if (c.listado) input.setAttribute("list", datalist(c.listado));
    }
    input.addEventListener("input", function () { valores[c.id] = input.value; alCambiar(input.value); });
    input.addEventListener("change", function () { valores[c.id] = input.value; alCambiar(input.value); });
    wrap.append(input);
    return wrap;
  }

  async function autofill(s, sd, dominio) {
    var r = await Backend.referencia(dominio);
    if (!r || !r.ok || !r.equipo) return;  // silencioso: si no hay lookup, se carga a mano
    var mapa = { tipo_equipo: "tipo_equipo", marca: "marca", modelo: "modelo", medidor: "medidor", ubicacion: "ubicacion" };
    Object.keys(mapa).forEach(function (k) {
      if (r.equipo[k] != null && r.equipo[k] !== "") sd.campos[k] = r.equipo[k];
    });
    render();
    msg("Datos del equipo autocompletados desde la API.", "ok");
  }

  /* ------------------------- cuerpo / anexos ------------------------ */
  function renderCuerpo(s, sd, host, permitirTexto) {
    if (s.campos_extra && s.campos_extra.length) {
      var ex = el("div", { class: "campos-extra" });
      sd.campos_extra = sd.campos_extra || {};
      s.campos_extra.forEach(function (c) {
        ex.append(campoEl(c, sd.campos_extra, function (v) { programarAutosave(); }));
      });
      host.append(ex);
    }
    var bloques = el("div", { class: "bloques" });
    host.append(bloques);
    pintarBloques(sd, bloques, permitirTexto);
  }

  function pintarBloques(sd, host, permitirTexto) {
    sd.bloques = sd.bloques || [];
    host.innerHTML = "";
    host.classList.toggle("bloques-vacio", sd.bloques.length === 0);
    host.append(barraAgregar(sd, host, 0, permitirTexto));
    sd.bloques.forEach(function (b, i) {
      host.append(b.tipo === "imagen" ? bloqueImagen(sd, host, b, i, permitirTexto)
                                      : bloqueTexto(sd, host, b, i, permitirTexto));
      host.append(barraAgregar(sd, host, i + 1, permitirTexto));
    });
  }

  function barraAgregar(sd, host, idx, permitirTexto) {
    var bar = el("div", { class: "add-bar" });
    if (permitirTexto) {
      bar.append(el("button", { type: "button", onclick: function () {
        sd.bloques.splice(idx, 0, { tipo: "texto", texto: "" });
        pintarBloques(sd, host, permitirTexto); programarAutosave();
      } }, "➕ Texto"));
    }
    bar.append(el("button", { type: "button", onclick: function () { insertarImagen(sd, host, idx, permitirTexto, true); } }, "📷 Cámara"));
    bar.append(el("button", { type: "button", onclick: function () { insertarImagen(sd, host, idx, permitirTexto, false); } }, "🖼 Imagen"));
    return bar;
  }

  function ctrls(sd, host, i, permitirTexto) {
    var c = el("div", { class: "ctrls" });
    c.append(el("button", { type: "button", title: "Subir", onclick: function () { mover(sd, i, -1); pintarBloques(sd, host, permitirTexto); programarAutosave(); } }, "↑"));
    c.append(el("button", { type: "button", title: "Bajar", onclick: function () { mover(sd, i, 1); pintarBloques(sd, host, permitirTexto); programarAutosave(); } }, "↓"));
    c.append(el("button", { type: "button", title: "Quitar", onclick: function () { sd.bloques.splice(i, 1); pintarBloques(sd, host, permitirTexto); programarAutosave(); } }, "✕"));
    return c;
  }
  function mover(sd, i, dir) {
    var j = i + dir; if (j < 0 || j >= sd.bloques.length) return;
    var t = sd.bloques[i]; sd.bloques[i] = sd.bloques[j]; sd.bloques[j] = t;
  }

  function bloqueTexto(sd, host, b, i, permitirTexto) {
    var wrap = el("div", { class: "bloque texto" });
    wrap.append(ctrls(sd, host, i, permitirTexto));
    var ta = el("textarea", { placeholder: "Escribí acá… (podés intercalar imágenes con los botones de arriba/abajo)" });
    ta.value = b.texto || "";
    ta.addEventListener("input", function () { b.texto = ta.value; autoGrow(ta); programarAutosave(); });
    wrap.append(ta);
    setTimeout(function () { autoGrow(ta); }, 0);
    return wrap;
  }

  function bloqueImagen(sd, host, b, i, permitirTexto) {
    var ancho = b.ancho || "media";
    var wrap = el("div", { class: "bloque img " + ancho });
    wrap.append(ctrls(sd, host, i, permitirTexto));
    var info = doc.imagenes[b.img] || {};
    wrap.append(el("img", { src: urlImagen(info), alt: b.caption || "imagen" }));
    var cap = el("div", { class: "cap" });
    var inp = el("input", { type: "text", placeholder: "Epígrafe de la foto…", value: b.caption || "" });
    inp.addEventListener("input", function () { b.caption = inp.value; programarAutosave(); });
    var sel = el("select", {});
    [["full", "Grande"], ["media", "Media"], ["chica", "Chica"]].forEach(function (o) {
      var op = el("option", { value: o[0] }, o[1]); if (ancho === o[0]) op.selected = true; sel.append(op);
    });
    sel.addEventListener("change", function () { b.ancho = sel.value; wrap.className = "bloque img " + sel.value; programarAutosave(); });
    cap.append(inp, sel);
    wrap.append(cap);
    return wrap;
  }

  async function insertarImagen(sd, host, idx, permitirTexto, camara) {
    var file = await Imagenes.elegir({ camara: camara });
    if (!file) return;
    var aviso = el("div", { class: "procesando" }, "Procesando imagen…");
    host.append(aviso);
    var r = await Imagenes.agregar(doc, file, {});
    aviso.remove();
    if (!r.ok) { msg(r.error || "No se pudo agregar la imagen.", "err"); return; }
    sd.bloques.splice(idx, 0, { tipo: "imagen", img: r.key, caption: "", ancho: "media" });
    pintarBloques(sd, host, permitirTexto);
    programarAutosave();
  }

  /* ----------------------------- tabla ------------------------------ */
  function renderTabla(s, sd, host) {
    var tabla = el("table", { class: "tabla-editor" });
    var thead = el("thead"); var trh = el("tr");
    s.columnas.forEach(function (col) { trh.append(el("th", {}, col.etiqueta)); });
    trh.append(el("th", {}, "")); thead.append(trh); tabla.append(thead);
    var tbody = el("tbody"); tabla.append(tbody);
    host.append(tabla);
    host.append(el("button", { class: "btn-fila", type: "button", onclick: function () {
      sd.filas.push(s.columnas.map(function () { return ""; }));
      pintarFilas(s, sd, tbody);
    } }, "＋ Agregar fila"));
    pintarFilas(s, sd, tbody);
  }
  function pintarFilas(s, sd, tbody) {
    tbody.innerHTML = "";
    sd.filas.forEach(function (fila, r) {
      var tr = el("tr");
      s.columnas.forEach(function (col, ci) {
        var td = el("td");
        var inp = el("input", { type: col.tipo === "numero" ? "number" : "text", value: fila[ci] || "" });
        inp.addEventListener("input", function () { fila[ci] = inp.value; programarAutosave(); });
        td.append(inp); tr.append(td);
      });
      var tx = el("td", { class: "x" });
      tx.append(el("button", { type: "button", title: "Quitar fila", onclick: function () { sd.filas.splice(r, 1); pintarFilas(s, sd, tbody); programarAutosave(); } }, "🗑"));
      tr.append(tx); tbody.append(tr);
    });
  }

  /* ---------------------------- acciones ---------------------------- */
  function renderBarra() {
    barra.innerHTML = "";
    var estadoBox = el("span", { id: "msgbox" });
    barra.append(
      el("button", { class: "btn", type: "button", onclick: function () { guardar("borrador"); } }, "💾 Guardar borrador"),
      el("button", { class: "btn", type: "button", onclick: function () { guardar("finalizado"); } }, "✓ Finalizar"),
      el("span", { class: "sep" }),
      estadoBox,
      verLink(),
      el("a", { class: "btn ghost", href: "index.html" }, "← Volver")
    );
  }
  function verLink() {
    if (doc.id.indexOf("tmp-") === 0) return el("span", {});
    return el("a", { class: "btn ghost", href: "ver.html?id=" + encodeURIComponent(doc.id) }, "👁 Vista / PDF");
  }

  function sincronizarMeta() {
    var meta = {};
    plantilla.secciones.forEach(function (s) {
      var sd = seccionDoc(s);
      if (s.tipo === "campos") Object.keys(sd.campos || {}).forEach(function (k) { if (sd.campos[k] !== "") meta[k] = sd.campos[k]; });
      if (sd.campos_extra) Object.keys(sd.campos_extra).forEach(function (k) { if (sd.campos_extra[k] !== "") meta[k] = sd.campos_extra[k]; });
    });
    doc.meta = meta;
    doc.autor = { nombre: meta.autor || meta.emisor || "", sector: meta.sector || "" };
  }

  function validar() {
    var faltan = [];
    plantilla.secciones.forEach(function (s) {
      var sd = seccionDoc(s);
      if (s.tipo === "campos") {
        (s.campos || []).forEach(function (c) {
          if (!c.requerido) return;
          var key = c.tipo === "rango_fecha" ? c.id + "_desde" : c.id;
          if (!(sd.campos[key] && String(sd.campos[key]).trim())) faltan.push(s.titulo + " — " + c.etiqueta);
        });
      } else if (s.tipo === "cuerpo" && s.obligatoria) {
        var hay = (sd.bloques || []).some(function (b) { return b.tipo === "imagen" || (b.texto && b.texto.trim()); });
        if (!hay) faltan.push(s.titulo + " — falta contenido");
      }
    });
    return faltan;
  }

  async function guardar(estado) {
    if (guardando) return;
    var box = document.getElementById("msgbox");
    limpiarFaltantes();
    sincronizarMeta();
    if (estado === "finalizado") {
      var faltan = validar();
      if (faltan.length) { pintarFaltantes(faltan); return; }
    }
    guardando = true;
    if (box) box.innerHTML = "<span class='procesando'>Guardando…</span>";
    doc.estado = estado;
    var r = await Backend.guardarDoc(doc);
    guardando = false;
    if (r && r.ok) {
      doc.id = r.id; doc.actualizado = r.actualizado || nowISO();
      borrarDraftNuevo();
      guardarDraft();
      render();
      msg(estado === "finalizado" ? "Documento finalizado y guardado." : "Borrador guardado.", "ok");
    } else {
      msg((r && r.error) || "La red cortó. Tus datos siguen cargados, probá Guardar de nuevo.", "err");
    }
  }

  /* --------------------------- utilidades --------------------------- */
  function msg(texto, tipo) {
    var box = document.getElementById("msgbox");
    if (!box) return;
    box.innerHTML = "";
    box.append(el("span", { class: "msg " + (tipo || "ok") }, texto));
    if (tipo === "ok") setTimeout(function () { if (box.firstChild) box.innerHTML = ""; }, 4000);
  }
  function pintarFaltantes(faltan) {
    limpiarFaltantes();
    var box = el("div", { class: "faltantes", id: "faltantes" },
      el("strong", {}, "Faltan datos obligatorios para finalizar:"),
      el("ul", {}, ...faltan.map(function (f) { return el("li", {}, f); }))
    );
    barra.parentNode.insertBefore(box, barra.nextSibling);
    msg("Revisá los campos obligatorios.", "err");
  }
  function limpiarFaltantes() { var f = document.getElementById("faltantes"); if (f) f.remove(); }
  function autoGrow(ta) { ta.style.height = "auto"; ta.style.height = (ta.scrollHeight) + "px"; }

  var datalistCreados = {};
  function datalist(nombre) {
    var id = "dl-" + nombre;
    if (!datalistCreados[nombre]) {
      var host = document.getElementById("datalists") || cont;
      var dl = el("datalist", { id: id });
      (LISTADOS[nombre] || []).forEach(function (v) { dl.append(el("option", { value: v })); });
      host.append(dl); datalistCreados[nombre] = true;
    }
    return id;
  }

  /* --------------------------- autosave ----------------------------- */
  function draftKey() { return doc.id.indexOf("tmp-") === 0 ? "it_draft_nuevo_" + TIPO : "it_draft_" + doc.id; }
  function programarAutosave() { clearTimeout(autosaveTimer); autosaveTimer = setTimeout(guardarDraft, 800); }
  function guardarDraft() { try { localStorage.setItem(draftKey(), JSON.stringify(doc)); } catch (_) {} }
  function leerDraftNuevo() {
    try { var s = localStorage.getItem("it_draft_nuevo_" + TIPO); return s ? JSON.parse(s) : null; } catch (_) { return null; }
  }
  function borrarDraftNuevo() { try { localStorage.removeItem("it_draft_nuevo_" + TIPO); } catch (_) {} }

})();
