/* ============================================================================
   config.js  —  Configuración del transporte (lo único que cambia OPS al integrar)
   ----------------------------------------------------------------------------
   BACKEND_URL vacío  => MODO DEMO (localStorage, sin desplegar nada).
   Cuando despliegues el Apps Script, pegá acá la URL /exec.
   El relay de Vercel salta el bloqueo de la red del laburo (ver docs).

   OJO: la API key de OPS NO va acá (va en las Script Properties del Apps Script).
   ========================================================================== */

const CONFIG = {
  // URL /exec del Apps Script desplegado. Vacío = modo demo.
  BACKEND_URL: "https://script.google.com/macros/s/AKfycbwMVcoRJaiHfPKH47_JKJEbDsmlY_c5B1owfAglIEPw3_W-fG1ry_4VaLKO91LDd25_/exec",

  // Relay pass-through en Vercel (api/proxy.js). Vacío = sólo directo.
  RELAY_URL: "",

  // Cache-busting de css/js. Subir en cada cambio (?v=...).
  VERSION: "20260914d"
};

if (typeof module !== "undefined" && module.exports) { module.exports = { CONFIG }; }
