/* ============================================================================
   backend.js  —  EL ADAPTADOR (única puerta al almacenamiento)
   ----------------------------------------------------------------------------
   El resto del frontend habla SÓLO con estas funciones. Cambiar de Apps Script
   a la API de OPS = reimplementar este archivo, nada más.
   Si CONFIG.BACKEND_URL está vacío => MODO DEMO con localStorage.
   Contrato completo en docs/CONTRATO-API.md.
   ========================================================================== */

const Backend = (() => {

  const hayBackend = () => !!(CONFIG && CONFIG.BACKEND_URL);
  const clave = () => { try { return sessionStorage.getItem("it_clave") || "123"; } catch (_) { return "123"; } };

  /* ---- MODO DEMO (localStorage) ------------------------------------- */
  const DEMO_DOCS = "it_demo_docs";       // { id: doc }
  const DEMO_SEQ  = "it_demo_seq";        // { "INF-2026": 3, ... }
  const leerDemo  = k => { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch (_) { return {}; } };
  const grabarDemo= (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

  function demoId(doc) {
    const pref = (plantillaDe(doc.tipo) || {}).prefijo || "DOC";
    const anio = new Date().getFullYear();
    const seq = leerDemo(DEMO_SEQ); const k = `${pref}-${anio}`;
    seq[k] = (seq[k] || 0) + 1; grabarDemo(DEMO_SEQ, seq);
    return `${k}-${String(seq[k]).padStart(4, "0")}`;
  }

  /* ---- API pública -------------------------------------------------- */

  async function guardarDoc(doc) {
    doc.actualizado = nowISO();
    if (!hayBackend()) {                         // DEMO
      const docs = leerDemo(DEMO_DOCS);
      if (!doc.id || String(doc.id).startsWith("tmp-")) doc.id = demoId(doc);
      docs[doc.id] = doc; grabarDemo(DEMO_DOCS, docs);
      return { ok: true, id: doc.id, actualizado: doc.actualizado };
    }
    const r = await postReintento({ accion: "guardar_doc", clave: clave(), doc });
    if (!r) return { ok: false, error: "La red cortó. Tus datos siguen cargados, probá Guardar de nuevo." };
    return r;
  }

  async function subirImagen(base64, meta = {}) {
    if (!hayBackend()) {                          // DEMO: data-URI local
      const ref = "demo_" + uuid().slice(0, 8);
      return { ok: true, ref, url: `data:${meta.mime || "image/jpeg"};base64,${base64}` };
    }
    const r = await postReintento({
      accion: "subir_imagen", clave: clave(),
      doc_id: meta.doc_id || "", nombre: meta.nombre || "imagen.jpg",
      mime: meta.mime || "image/jpeg", w: meta.w || 0, h: meta.h || 0, base64
    });
    if (!r) return { ok: false, error: "No se pudo subir la imagen (red)." };
    return r;
  }

  async function listarDocs(filtros = {}) {
    if (!hayBackend()) {                          // DEMO
      const docs = Object.values(leerDemo(DEMO_DOCS));
      const f = docs.filter(d => (!filtros.tipo || d.tipo === filtros.tipo));
      f.sort((a, b) => String(b.creado).localeCompare(String(a.creado)));
      return { ok: true, docs: f.map(resumen) };
    }
    const r = await getJSON({ accion: "listar_docs", ...filtros });
    return r || { ok: false, error: "Sin conexión.", docs: [] };
  }

  async function obtenerDoc(id) {
    if (!hayBackend()) {                          // DEMO
      const docs = leerDemo(DEMO_DOCS);
      return docs[id] ? { ok: true, doc: docs[id] } : { ok: false, error: "No existe." };
    }
    const r = await getJSON({ accion: "obtener_doc", id });
    return r || { ok: false, error: "Sin conexión." };
  }

  async function referencia(dominio) {
    if (!dominio) return { ok: false, error: "Falta dominio." };
    if (!hayBackend()) return { ok: false, error: "Autofill no disponible en demo." };
    const r = await getJSON({ accion: "referencia", dominio });
    return r || { ok: false, error: "Sin conexión con la API de OPS." };
  }

  function resumen(d) {
    return { id: d.id, tipo: d.tipo, estado: d.estado, meta: d.meta || {}, creado: d.creado, actualizado: d.actualizado };
  }

  return { guardarDoc, subirImagen, listarDocs, obtenerDoc, referencia, hayBackend };
})();

if (typeof module !== "undefined" && module.exports) { module.exports = { Backend }; }
