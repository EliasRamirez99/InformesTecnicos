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
  VERSION: "20260915b",

  // Compresión de imágenes (para no llenar Google Drive). Cada foto se reduce
  // hasta quedar bajo IMG_MAX_KB, bajando calidad y —si hace falta— resolución.
  IMG_MAX_LADO: 1400,   // lado más largo, en px
  IMG_CALIDAD: 0.78,    // calidad JPEG inicial (0–1)
  IMG_MAX_KB: 350       // peso objetivo máximo por imagen (KB)
};

if (typeof module !== "undefined" && module.exports) { module.exports = { CONFIG }; }
