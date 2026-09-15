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
    var f = meta.fecha_intervencion_desde || meta.fecha_emision;
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

  function valorCampo(c, campos) {
    if (c.tipo === "rango_fecha") {
      var d = formatearFecha(campos[c.id + "_desde"]);
      var h = campos[c.id + "_hasta"] ? formatearFecha(campos[c.id + "_hasta"]) : "";
      return (h && h !== d) ? (d + " a " + h) : d;
    }
    if (c.tipo === "fecha") return formatearFecha(campos[c.id]);
    return campos[c.id];
  }
  /* Grilla de datos multi-columna (más presentable que uno abajo del otro). */
  function gridCampos(pares, campos) {
    var grid = el("div", { class: "doc-campos" });
    pares.forEach(function (c) {
      grid.append(el("div", { class: "doc-campo" },
        el("span", { class: "k" }, c.etiqueta),
        el("span", { class: "v" }, valorCampo(c, campos) || "—")));
    });
    return grid;
  }
  function pintarCampos(s, sd) {
    var campos = (sd.campos) || {};
    var pares = (s.campos || []).filter(function (c) {
      if (c.tipo === "rango_fecha") return campos[c.id + "_desde"];
      return campos[c.id] != null && campos[c.id] !== "";
    });
    if (!pares.length) return null;
    return gridCampos(pares, campos);
  }

  function _num(n) {
    try { return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); } catch (_) { return String(n); }
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

    // Totales por moneda (tablas con columnas 'moneda' + 'monto', ej. Costos)
    var iM = s.columnas.findIndex(function (c) { return c.id === "moneda"; });
    var iV = s.columnas.findIndex(function (c) { return c.id === "monto"; });
    if (iM >= 0 && iV >= 0) {
      var tot = {};
      filas.forEach(function (f) {
        var m = (String(f[iM] || "").trim()) || "—";
        var v = parseFloat(String(f[iV] || "").replace(",", ".")) || 0;
        tot[m] = (tot[m] || 0) + v;
      });
      var tfoot = el("tfoot");
      Object.keys(tot).forEach(function (m) {
        var tr = el("tr", { class: "total" });
        tr.append(el("td", { colspan: String(iV || 1) }, "Total " + m));
        tr.append(el("td", {}, _num(tot[m])));
        for (var k = iV + 1; k < s.columnas.length; k++) tr.append(el("td", {}, ""));
        tfoot.append(tr);
      });
      tabla.append(tfoot);
    }
    return tabla;
  }

  function pintarCuerpo(s, sd, doc) {
    var frag = el("div", { class: "doc-cuerpo" });
    var algo = false;

    if (s.campos_extra && sd.campos_extra) {
      var ex = (s.campos_extra || []).filter(function (c) { return sd.campos_extra[c.id]; });
      if (ex.length) { frag.append(gridCampos(ex, sd.campos_extra)); algo = true; }
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
