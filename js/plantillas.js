/* ============================================================================
   plantillas.js  —  LA ESTRUCTURA OBLIGATORIA (plantilla-como-dato)
   ----------------------------------------------------------------------------
   Cada tipo de documento define sus secciones fijas acá. El editor las
   renderiza EN ORDEN y no se pueden saltear ni reordenar: así "siempre siguen
   la misma estructura" queda garantizado por el motor, no por disciplina.
   Adentro de cada sección el supervisor carga lo que quiera (texto + imágenes).

   TIPOS DE SECCIÓN
     campos  : conjunto de campos con nombre (estructurados, filtrables)
     cuerpo  : narrativa = lista ordenada de bloques (texto | imagen | ...);
               puede llevar `campos_extra` (metadatos estructurados al lado)
     tabla   : filas con columnas definidas (repuestos, materiales, parámetros)
     anexos  : galería de imágenes / documentos adjuntos

   TIPOS DE CAMPO
     texto | textarea | fecha | numero | opcion(+opciones) | check
     `listado`  : nombre de un listado maestro para autocompletar (datalist)
     `requerido`: bloquea finalizar el documento si está vacío
     `autofill` : (a nivel sección) campo que dispara backend.referencia()

   REGLA DE EXTENSIÓN (del playbook): agregar campos/secciones SIEMPRE al final
   y subir `version` para no descolocar documentos ya guardados.
   ========================================================================== */

const PLANTILLAS = {

  /* ------------------------------------------------------------------ */
  /* A) INFORME TÉCNICO DE INTERVENCIÓN EXITOSA                          */
  /* ------------------------------------------------------------------ */
  informe_intervencion: {
    tipo: "informe_intervencion",
    nombre: "Informe Técnico de Intervención Exitosa",
    prefijo: "INF",          // id => INF-2026-0001
    version: 3,
    secciones: [

      { id: "identificacion", titulo: "Identificación", tipo: "campos", obligatoria: true,
        campos: [
          { id: "titulo",            etiqueta: "Título del informe",        tipo: "texto",  requerido: true },
          { id: "nro_or",            etiqueta: "N° de Orden de Reparación",  tipo: "texto" },
          { id: "fecha_intervencion",etiqueta: "Fecha de la intervención",  tipo: "rango_fecha", requerido: true },
          { id: "autor",             etiqueta: "Supervisor de taller",       tipo: "texto",  requerido: true, listado: "supervisores" },
          { id: "box",               etiqueta: "Box",                        tipo: "texto" },
          { id: "tipo_intervencion", etiqueta: "Tipo de mantenimiento",      tipo: "opcion", opciones: ["Correctivo","Preventivo","Predictivo","Mejora"] },
          { id: "criticidad",        etiqueta: "Criticidad",                tipo: "opcion", opciones: ["Baja","Media","Alta","Crítica"] }
        ]
      },

      { id: "datos_equipo", titulo: "Datos del equipo", tipo: "campos", obligatoria: true, autofill: "dominio",
        campos: [
          { id: "dominio",     etiqueta: "Equipo (Dominio / Interno)", tipo: "texto", requerido: true },
          { id: "tipo_equipo", etiqueta: "Tipo de equipo",             tipo: "texto" },
          { id: "marca",       etiqueta: "Marca",                      tipo: "texto" },
          { id: "modelo",      etiqueta: "Modelo",                     tipo: "texto" },
          { id: "chasis",      etiqueta: "Chasis / Bin",               tipo: "texto" },
          { id: "medidor",     etiqueta: "Km / Horas",                 tipo: "texto" },
          { id: "obra",        etiqueta: "Obra",                       tipo: "texto", listado: "obras" },
          { id: "base",        etiqueta: "Base / Destino",             tipo: "texto" },
          { id: "sistema",     etiqueta: "Sistema afectado",           tipo: "texto", listado: "sistemas" },
          { id: "componente",  etiqueta: "Componente",                 tipo: "texto", listado: "componentes" }
        ]
      },

      { id: "motivo",               titulo: "Motivo de la intervención / síntoma", tipo: "cuerpo", obligatoria: true },
      { id: "diagnostico_inicial",  titulo: "Diagnóstico inicial",                 tipo: "cuerpo", obligatoria: true },

      { id: "causa_raiz", titulo: "Análisis de causa raíz", tipo: "cuerpo", obligatoria: true,
        campos_extra: [
          { id: "metodo",            etiqueta: "Método de análisis", tipo: "opcion", opciones: ["5 Porqués","Ishikawa","Árbol de fallas","Otro"] },
          { id: "causa_clasificada", etiqueta: "Causa raíz (clasificada)", tipo: "opcion",
            opciones: ["Desgaste","Falla de material","Error operativo","Falta de mantenimiento","Lubricación","Contaminación","Diseño / instalación","Otro"] }
        ]
      },

      { id: "diagnostico_definitivo", titulo: "Diagnóstico definitivo",              tipo: "cuerpo", obligatoria: true },
      { id: "acciones",               titulo: "Acciones realizadas — paso a paso",   tipo: "cuerpo", obligatoria: true },

      { id: "repuestos", titulo: "Repuestos y materiales utilizados", tipo: "tabla",
        columnas: [
          { id: "codigo",      etiqueta: "Código" },
          { id: "descripcion", etiqueta: "Descripción" },
          { id: "cantidad",    etiqueta: "Cant.", tipo: "numero" }
        ]
      },

      { id: "validacion", titulo: "Validación final / pruebas", tipo: "cuerpo", obligatoria: true,
        campos_extra: [
          { id: "parametros", etiqueta: "Parámetros medidos", tipo: "texto" },
          { id: "operativo",  etiqueta: "Equipo operativo",   tipo: "opcion", opciones: ["Sí","No","Con observaciones"] }
        ]
      },

      { id: "recomendaciones", titulo: "Recomendaciones / lecciones aprendidas", tipo: "cuerpo" },

      { id: "anexos", titulo: "Anexos", tipo: "anexos" },

      { id: "responsables", titulo: "Responsables / firmas", tipo: "campos",
        campos: [
          { id: "ejecuto",   etiqueta: "Ejecutó",   tipo: "texto" },
          { id: "superviso", etiqueta: "Supervisó", tipo: "texto" },
          { id: "aprobo",    etiqueta: "Aprobó",    tipo: "texto" }
        ]
      }
    ]
  },

  /* ------------------------------------------------------------------ */
  /* B) BOLETÍN DE MANTENIMIENTO                                         */
  /* ------------------------------------------------------------------ */
  boletin_mantenimiento: {
    tipo: "boletin_mantenimiento",
    nombre: "Boletín de Mantenimiento",
    prefijo: "BOL",          // id => BOL-2026-0001
    version: 3,
    secciones: [

      { id: "encabezado", titulo: "Encabezado", tipo: "campos", obligatoria: true,
        campos: [
          { id: "titulo",        etiqueta: "Título del boletín",         tipo: "texto", requerido: true },
          { id: "nro_or",        etiqueta: "N° de Orden de Reparación",  tipo: "texto" },
          { id: "fecha_emision", etiqueta: "Fecha de emisión",           tipo: "fecha", requerido: true },
          { id: "emisor",        etiqueta: "Emisor / supervisor",        tipo: "texto", requerido: true, listado: "supervisores" },
          { id: "box",           etiqueta: "Box",                        tipo: "texto" },
          { id: "clasificacion", etiqueta: "Tipo de mantenimiento / clasificación", tipo: "opcion", opciones: ["Preventivo","Correctivo","Predictivo","Alerta técnica"] },
          { id: "prioridad",     etiqueta: "Prioridad",                  tipo: "opcion", opciones: ["Baja","Media","Alta","Crítica"] },
          { id: "alcance_equipos", etiqueta: "Equipos / sistemas alcanzados", tipo: "texto" }
        ]
      },

      { id: "datos_equipo", titulo: "Datos del equipo", tipo: "campos", autofill: "dominio",
        campos: [
          { id: "dominio",     etiqueta: "Equipo (Dominio / Interno)", tipo: "texto" },
          { id: "tipo_equipo", etiqueta: "Tipo de equipo",             tipo: "texto" },
          { id: "marca",       etiqueta: "Marca",                      tipo: "texto" },
          { id: "modelo",      etiqueta: "Modelo",                     tipo: "texto" },
          { id: "chasis",      etiqueta: "Chasis / Bin",               tipo: "texto" },
          { id: "medidor",     etiqueta: "Km / Horas",                 tipo: "texto" },
          { id: "obra",        etiqueta: "Obra",                       tipo: "texto", listado: "obras" },
          { id: "base",        etiqueta: "Base / Destino",             tipo: "texto" },
          { id: "sistema",     etiqueta: "Sistema afectado",           tipo: "texto", listado: "sistemas" },
          { id: "componente",  etiqueta: "Componente",                 tipo: "texto", listado: "componentes" }
        ]
      },

      { id: "descripcion", titulo: "Descripción del acontecimiento", tipo: "cuerpo", obligatoria: true },

      { id: "alcance", titulo: "Alcance / equipos afectados", tipo: "cuerpo",
        campos_extra: [
          { id: "familia",  etiqueta: "Familia de equipos", tipo: "texto", listado: "sistemas" },
          { id: "obras",    etiqueta: "Obras alcanzadas",   tipo: "texto", listado: "obras" }
        ]
      },

      { id: "antecedentes", titulo: "Antecedentes / contexto",              tipo: "cuerpo" },
      { id: "desarrollo",   titulo: "Desarrollo / procedimiento paso a paso", tipo: "cuerpo", obligatoria: true },

      { id: "materiales", titulo: "Materiales y herramientas", tipo: "tabla",
        columnas: [
          { id: "item",        etiqueta: "Ítem" },
          { id: "descripcion", etiqueta: "Descripción" },
          { id: "cantidad",    etiqueta: "Cant.", tipo: "numero" }
        ]
      },

      { id: "costos", titulo: "Costos de la atención", tipo: "tabla",
        columnas: [
          { id: "tipo",    etiqueta: "Tipo de costo", opciones: ["Repuestos","Insumos","Mano de obra","Servicio tercerizado","Traslado","Otros"] },
          { id: "detalle", etiqueta: "Detalle" },
          { id: "moneda",  etiqueta: "Moneda", opciones: ["ARS","USD","EUR","Otra"] },
          { id: "monto",   etiqueta: "Monto", tipo: "numero" }
        ]
      },

      { id: "preventivas",  titulo: "Medidas preventivas / recomendaciones",   tipo: "cuerpo", obligatoria: true },
      { id: "conclusiones", titulo: "Conclusiones",                            tipo: "cuerpo" },
      { id: "anexos",       titulo: "Anexos",                                  tipo: "anexos" },
      { id: "referencias",  titulo: "Referencias / documentación relacionada", tipo: "cuerpo" }
    ]
  }
};

/* Helper: devuelve la plantilla de un tipo (o null). */
function plantillaDe(tipo) {
  return (PLANTILLAS && PLANTILLAS[tipo]) || null;
}

/* Export para Node (tests) sin romper el uso como <script> global en el navegador. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { PLANTILLAS, plantillaDe };
}
