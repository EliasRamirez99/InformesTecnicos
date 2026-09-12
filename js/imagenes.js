/* ============================================================================
   imagenes.js — captura + compresión + subida
   ----------------------------------------------------------------------------
   - elegir({camara}) abre el selector; en celular/tablet con capture:"environment"
     abre la CÁMARA TRASERA directo. Sin capture = galería/archivo.
   - comprimir() escala a ~1600px y exporta JPEG (liviano para red de campo);
     corrige orientación EXIF vía createImageBitmap(imageOrientation:"from-image").
   - agregar() comprime, sube por Backend.subirImagen y registra la imagen en el
     documento (ref/URL). Los bytes NO quedan en el JSON del documento.
   ========================================================================== */

const Imagenes = (() => {

  function elegir({ camara = false, multiple = false } = {}) {
    return new Promise(res => {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = "image/*";
      if (camara) inp.capture = "environment";
      if (multiple) inp.multiple = true;
      inp.style.position = "fixed"; inp.style.left = "-9999px";
      inp.addEventListener("change", () => {
        const out = multiple ? Array.from(inp.files) : (inp.files[0] || null);
        inp.remove(); res(out);
      }, { once: true });
      document.body.append(inp);
      inp.click();
    });
  }

  async function comprimir(file, maxLado = 1600, calidad = 0.82) {
    let fuente, w, h;
    try {
      fuente = await createImageBitmap(file, { imageOrientation: "from-image" });
      w = fuente.width; h = fuente.height;
    } catch (_) {
      fuente = await cargarImg(file); w = fuente.naturalWidth; h = fuente.naturalHeight;
    }
    const escala = Math.min(1, maxLado / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * escala)), ch = Math.max(1, Math.round(h * escala));
    const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
    cv.getContext("2d").drawImage(fuente, 0, 0, cw, ch);
    if (fuente.close) fuente.close();
    const dataURL = cv.toDataURL("image/jpeg", calidad);
    const base64 = dataURL.split(",")[1] || "";
    return { base64, dataURL, mime: "image/jpeg", w: cw, h: ch, bytes: Math.round(base64.length * 0.75) };
  }

  function cargarImg(file) {
    return new Promise((res, rej) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = e => { URL.revokeObjectURL(url); rej(e); };
      img.src = url;
    });
  }

  /* Comprime, sube y registra la imagen en doc.imagenes. Devuelve { ok, key }. */
  async function agregar(doc, file, meta = {}) {
    if (!file) return { ok: false, error: "sin archivo" };
    let c;
    try { c = await comprimir(file); }
    catch (e) { return { ok: false, error: "no se pudo procesar la imagen" }; }
    const r = await Backend.subirImagen(c.base64, {
      doc_id: doc.id, nombre: file.name || "foto.jpg", mime: c.mime, w: c.w, h: c.h
    });
    if (!r || !r.ok) return { ok: false, error: (r && r.error) || "falló la subida" };
    const key = "img_" + uuid().slice(0, 8);
    doc.imagenes = doc.imagenes || {};
    doc.imagenes[key] = {
      ref: r.ref, url: r.url, nombre: file.name || "foto.jpg",
      w: c.w, h: c.h, bytes: c.bytes, subida: nowISO()
    };
    return { ok: true, key };
  }

  return { elegir, comprimir, agregar };
})();

if (typeof module !== "undefined" && module.exports) { module.exports = { Imagenes }; }
