/* ============================================================================
   common.js  —  utilidades compartidas + RESILIENCIA de red
   ----------------------------------------------------------------------------
   Portado de PlanillaTaller: la red del laburo bloquea a ratos servicios
   externos, así que desde el día uno: timeout + reintentos con backoff +
   alternancia directo<->relay, recordando qué ruta anduvo.
   ========================================================================== */

/* ---------- DOM helpers ---------- */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
function el(tag, attrs = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const k in attrs) {
    if (k === "class") n.className = attrs[k];
    else if (k === "html") n.innerHTML = attrs[k];
    else if (k.startsWith("on") && typeof attrs[k] === "function") n.addEventListener(k.slice(2), attrs[k]);
    else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  }
  for (const h of hijos) { if (h != null) n.append(h.nodeType ? h : document.createTextNode(h)); }
  return n;
}

/* ---------- básicos ---------- */
const nowISO = () => new Date().toISOString();
function uuid() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8); return v.toString(16);
  });
}

/* URL para MOSTRAR una imagen en <img>. Las de Drive se sirven por el endpoint
   `thumbnail` (el uc?export=view ya no embebe); las de demo usan su data-URI. */
function urlImagen(info) {
  if (!info) return "";
  var ref = info.ref;
  if (ref && String(ref).indexOf("demo_") !== 0) return "https://lh3.googleusercontent.com/d/" + ref + "=w1600";
  return info.url || "";
}

/* Fecha -> dd-mm-aaaa (acepta ISO, d/m/a, d-m-a). */
function formatearFecha(v) {
  if (!v) return "";
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);            // ISO
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/); // d/m/a o d-m-a
  if (m) { const a = m[3].length === 2 ? "20" + m[3] : m[3]; return `${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}-${a}`; }
  return s;
}

/* ---------- red con timeout ---------- */
function fetchConTimeout(url, opts = {}, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

const RUTA_KEY = "it_ruta_relay";   // "1" = arrancar por relay
function rutasPreferidas() {
  const base = CONFIG.BACKEND_URL || "";
  const relay = CONFIG.RELAY_URL || "";
  if (!relay) return base ? [{ url: base, relay: false }] : [];
  const arr = [{ url: base, relay: false }, { url: relay, relay: true }];
  let usarRelay = false;
  try { usarRelay = localStorage.getItem(RUTA_KEY) === "1"; } catch (_) {}
  return usarRelay ? arr.reverse() : arr;
}
function recordarRuta(relay) { try { localStorage.setItem(RUTA_KEY, relay ? "1" : "0"); } catch (_) {} }

/* POST con reintentos + backoff + alternancia directo<->relay.
   Devuelve el JSON, o null si falló la red en todos los intentos. */
async function postReintento(body, intentos = 3) {
  const rutas = rutasPreferidas();
  if (!rutas.length) return null;                 // sin backend => el caller cae a demo
  const payload = JSON.stringify(body);
  for (let i = 0; i < intentos; i++) {
    for (const r of rutas) {
      try {
        const resp = await fetchConTimeout(r.url, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" }, // evita preflight CORS
          body: payload
        }, 15000);
        const json = await resp.json();
        recordarRuta(r.relay);
        return json;
      } catch (_) { await esperar(300); }         // probá la otra ruta enseguida
    }
    await esperar(900 * (i + 1));                  // backoff antes de la próxima vuelta
  }
  return null;
}

/* GET (lecturas) con alternancia directo<->relay + reintentos (arranque en frío
   de Apps Script a veces falla la 1ª). Devuelve el JSON o null si falló todo. */
async function getJSON(params, intentos = 3) {
  const rutas = rutasPreferidas();
  if (!rutas.length) return null;
  const qs = new URLSearchParams(params).toString();
  for (let i = 0; i < intentos; i++) {
    for (const r of rutas) {
      try {
        const sep = r.url.includes("?") ? "&" : "?";
        const resp = await fetchConTimeout(r.url + sep + qs, {}, 9000);  // corto: si se cuelga, reintenta ya
        const json = await resp.json();
        recordarRuta(r.relay);
        return json;
      } catch (_) { await esperar(300); }
    }
    await esperar(600 * (i + 1));
  }
  return null;
}

/* Caché liviana en localStorage (para carga instantánea + resiliencia). */
function cacheGet(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (_) { return null; } }
function cacheSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }

const esperar = ms => new Promise(res => setTimeout(res, ms));

/* ---------- tema claro/oscuro ---------- */
function initTema() {
  let osc = false;
  try { osc = localStorage.getItem("it_tema") === "oscuro"; } catch (_) {}
  document.documentElement.classList.toggle("oscuro", osc);
  const marca = $(".brand");
  if (marca && !$(".tema-toggle", marca)) {
    const btn = el("button", { class: "tema-toggle", title: "Tema", type: "button" }, osc ? "☀" : "🌙");
    btn.addEventListener("click", () => {
      const nuevo = !document.documentElement.classList.contains("oscuro");
      document.documentElement.classList.toggle("oscuro", nuevo);
      btn.textContent = nuevo ? "☀" : "🌙";
      try { localStorage.setItem("it_tema", nuevo ? "oscuro" : "claro"); } catch (_) {}
    });
    marca.append(btn);
  }
}
document.addEventListener("DOMContentLoaded", initTema);

if (typeof module !== "undefined" && module.exports) {
  module.exports = { formatearFecha, uuid, postReintento, getJSON };
}
