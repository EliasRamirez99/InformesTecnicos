/* ============================================================================
   impresion.js — Vista de lectura formateada + PDF
   ----------------------------------------------------------------------------
   Renderiza el documento siguiendo el ORDEN de la plantilla (misma estructura
   siempre), con campos, tablas, texto e imágenes intercaladas. Las secciones
   vacías se muestran igual (marcadas "sin datos") para conservar la estructura.
   El PDF se hace con window.print() + el @media print de estilos.css (el usuario
   elige "Guardar como PDF" en el diálogo del navegador).
   ========================================================================== */

const Vista = (() => {

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function parrafos(texto) {
    return esc(texto).split(/\n{2,}/).map(function (p) { return el("p", { html: p.replace(/\n/g, "<br>") }); });
  }
  function fechaCab(meta) {
    var f = meta.fecha_intervencion || meta.fecha_emision;
    return f ? " · " + formatearFecha(f) : "";
  }

  function render(doc, host) {
    var pl = plantillaDe(doc.tipo);
    host.innerHTML = "";
    if (!pl) { host.textContent = "Tipo de documento desconocido."; return; }
    var meta = doc.meta || {};

    var cab = el("div", { class: "doc-cabecera" },
      el("div", { class: "doc-marca" }, el("img", { class: "doc-logo", src: "img/logo-ops.svg", alt: "OPS" }), el("span", {}, pl.nombre)),
      el("h1", {}, meta.titulo || pl.nombre),
      el("div", { class: "doc-id" }, doc.id + " · " + (doc.estado || "borrador") + fechaCab(meta) + (meta.autor || meta.emisor ? " · " + (meta.autor || meta.emisor) : ""))
    );
    host.append(cab);

    pl.secciones.forEach(function (s, i) {
      var sd = (doc.secciones || []).find(function (x) { return x.id === s.id; }) || {};
      var sec = el("section", { class: "doc-sec" });
      sec.append(el("h2", {}, (i + 1) + ". " + s.titulo));
      var cuerpo;
      if (s.tipo === "campos") cuerpo = pintarCampos(s, sd);
      else if (s.tipo === "tabla") cuerpo = pintarTabla(s, sd);
      else cuerpo = pintarCuerpo(s, sd, doc);
      if (cuerpo) sec.append(cuerpo);
      else sec.append(el("div", { class: "vacio-sec" }, "(sin datos)"));
      host.append(sec);
    });
  }

  function pintarCampos(s, sd) {
    var campos = (sd.campos) || {};
    var pares = (s.campos || []).filter(function (c) { return campos[c.id] != null && campos[c.id] !== ""; });
    if (!pares.length) return null;
    var dl = el("dl", { class: "doc-dl" });
    pares.forEach(function (c) {
      dl.append(el("dt", {}, c.etiqueta), el("dd", {}, c.tipo === "fecha" ? formatearFecha(campos[c.id]) : campos[c.id]));
    });
    return dl;
  }

  function pintarTabla(s, sd) {
    var filas = (sd.filas || []).filter(function (f) { return f.some(function (v) { return v && String(v).trim(); }); });
    if (!filas.length) return null;
    var tabla = el("table", { class: "doc-tabla" });
    var thead = el("thead"), trh = el("tr");
    s.columnas.forEach(function (col) { trh.append(el("th", {}, col.etiqueta)); });
    thead.append(trh); tabla.append(thead);
    var tbody = el("tbody");
    filas.forEach(function (f) {
      var tr = el("tr");
      s.columnas.forEach(function (col, ci) { tr.append(el("td", {}, f[ci] || "")); });
      tbody.append(tr);
    });
    tabla.append(tbody);
    return tabla;
  }

  function pintarCuerpo(s, sd, doc) {
    var frag = el("div", { class: "doc-cuerpo" });
    var algo = false;

    if (s.campos_extra && sd.campos_extra) {
      var ex = (s.campos_extra || []).filter(function (c) { return sd.campos_extra[c.id]; });
      if (ex.length) {
        var dl = el("dl", { class: "doc-dl" });
        ex.forEach(function (c) { dl.append(el("dt", {}, c.etiqueta), el("dd", {}, sd.campos_extra[c.id])); });
        frag.append(dl); algo = true;
      }
    }
    (sd.bloques || []).forEach(function (b) {
      if (b.tipo === "imagen") {
        var info = (doc.imagenes || {})[b.img] || {};
        var src = urlImagen(info);
        if (!src) return;
        var fig = el("figure", { class: b.ancho || "media" }, el("img", { src: src, alt: b.caption || "" }));
        if (b.caption) fig.append(el("figcaption", {}, b.caption));
        frag.append(fig); algo = true;
      } else if (b.texto && b.texto.trim()) {
        parrafos(b.texto).forEach(function (p) { frag.append(p); });
        algo = true;
      }
    });
    return algo ? frag : null;
  }

  function imprimir() { window.print(); }

  return { render, imprimir };
})();

if (typeof module !== "undefined" && module.exports) { module.exports = { Vista }; }
