/* ============================================================================
   listados.js — datos maestros para los datalist de los campos.
   Semilla + fallback offline. Más adelante se refrescan desde el backend
   (como cfg_listados en PlanillaTaller). Campo con listado vacío = texto libre.
   sistemas/componentes alineados al catálogo Sistema-Componente del ecosistema.
   ========================================================================== */

const LISTADOS = {
  supervisores: [],   // vienen del backend
  obras: [],          // vienen del backend

  sistemas: [
    "Motor", "Sistema hidráulico", "Sistema eléctrico", "Transmisión",
    "Sistema de frenos", "Sistema neumático", "Refrigeración",
    "Sistema de combustible", "Dirección", "Tren de rodaje", "Chasis / estructura",
    "Cabina", "Sistema de admisión y escape", "Lubricación"
  ],

  componentes: [
    "Bomba hidráulica", "Cilindro hidráulico", "Válvula", "Manguera / conexión",
    "Alternador", "Motor de arranque", "Batería", "Cableado / arnés",
    "Radiador", "Bomba de agua", "Termostato", "Turbo", "Inyector",
    "Filtro", "Rodamiento", "Retén / sello", "Correa", "Cardán / crucetas",
    "Embrague", "Caja de cambios", "Diferencial", "Pastillas / cintas de freno"
  ]
};

if (typeof module !== "undefined" && module.exports) { module.exports = { LISTADOS }; }
