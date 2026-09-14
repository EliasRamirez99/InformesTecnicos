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

  async function comprimir(file) {
    const cfg = (typeof CONFIG !== "undefined" && CONFIG) || {};
    const maxLado = cfg.IMG_MAX_LADO || 1400;
    const calidadIni = cfg.IMG_CALIDAD || 0.78;
    const maxKB = cfg.IMG_MAX_KB || 350;

    let fuente, w, h;
    try {
      fuente = await createImageBitmap(file, { imageOrientation: "from-image" });
      w = fuente.width; h = fuente.height;
    } catch (_) {
      fuente = await cargarImg(file); w = fuente.naturalWidth; h = fuente.naturalHeight;
    }

    // Dibuja a un canvas escalado a `lado` y exporta JPEG a calidad `q`.
    const encode = (lado, q) => {
      const escala = Math.min(1, lado / Math.max(w, h));
      const cw = Math.max(1, Math.round(w * escala)), ch = Math.max(1, Math.round(h * escala));
      const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
      cv.getContext("2d").drawImage(fuente, 0, 0, cw, ch);
      const durl = cv.toDataURL("image/jpeg", q);
      const b64 = durl.split(",")[1] || "";
      return { dataURL: durl, base64: b64, w: cw, h: ch, kb: b64.length * 0.75 / 1024 };
    };

    // Objetivo de peso: baja calidad; si aún no entra, baja resolución.
    const lados = [maxLado, 1100, 900];
    let out = encode(maxLado, calidadIni);
    for (const lado of lados) {
      let q = calidadIni;
      out = encode(lado, q);
      while (out.kb > maxKB && q > 0.45) {
        q = Math.round((q - 0.08) * 100) / 100;
        out = encode(lado, q);
      }
      if (out.kb <= maxKB) break;
    }

    if (fuente.close) fuente.close();
    return { base64: out.base64, dataURL: out.dataURL, mime: "image/jpeg", w: out.w, h: out.h, bytes: Math.round(out.base64.length * 0.75) };
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
      ref: r.ref, url: urlImagen({ ref: r.ref, url: r.url }), nombre: file.name || "foto.jpg",
      w: c.w, h: c.h, bytes: c.bytes, subida: nowISO()
    };
    return { ok: true, key };
  }

  return { elegir, comprimir, agregar };
})();

if (typeof module !== "undefined" && module.exports) { module.exports = { Imagenes }; }
