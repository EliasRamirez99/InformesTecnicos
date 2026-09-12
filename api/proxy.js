/* ============================================================================
   api/proxy.js — Relay pass-through en Vercel
   ----------------------------------------------------------------------------
   Salta el bloqueo intermitente de la red del laburo a script.google.com.
   Reenvía GET/POST al Apps Script y devuelve el JSON. CORS abierto.
   La URL del Apps Script va HARDCODEADA acá: al re-desplegar el script hay que
   actualizarla en DOS lugares -> js/config.js Y este archivo.
   Deploy: importar el repo a Vercel (login con GitHub); cada push redepliega.
   ========================================================================== */

const APPS_SCRIPT_URL = "PEGAR_AQUI_LA_URL_/exec_DEL_APPS_SCRIPT";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    let url = APPS_SCRIPT_URL;
    let opts = { method: req.method, redirect: "follow" };

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
      opts.headers = { "Content-Type": "text/plain;charset=utf-8" };
      opts.body = body;
    } else {
      const qs = req.url.split("?")[1];
      if (qs) url += (url.includes("?") ? "&" : "?") + qs;
    }

    const r = await fetch(url, opts);
    const text = await r.text();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).send(text);
  } catch (err) {
    return res.status(200).json({ ok: false, error: "relay: " + String(err) });
  }
}
