# Modelo de datos — Informes Técnicos y Boletines

Este documento define **la forma del dato**, independiente de dónde se guarde.
El backend (hoy Apps Script + Google Sheets + Drive; mañana la API de OPS) debe
respetar este contrato. Ver también [CONTRATO-API.md](CONTRATO-API.md).

## 1. El documento

Un Informe o un Boletín es **un documento estructurado** (no una fila plana).
Se serializa como un único objeto JSON:

```jsonc
{
  "id": "INF-2026-0001",            // prefijo de la plantilla + año + correlativo
  "tipo": "informe_intervencion",   // o "boletin_mantenimiento"
  "version_plantilla": 1,           // versión de la estructura con que se creó
  "estado": "borrador",             // "borrador" | "finalizado"
  "creado": "2026-09-12T13:00:00Z",
  "actualizado": "2026-09-12T13:40:00Z",
  "autor": { "nombre": "E. Ramírez", "sector": "Taller" },

  // META = campos estructurados y filtrables (la capa de ANÁLISIS).
  // Se llena a partir de las secciones tipo "campos"/"campos_extra".
  "meta": {
    "dominio": "ABC123", "tipo_equipo": "Retroexcavadora",
    "sistema": "Hidráulico", "componente": "Bomba principal",
    "tipo_intervencion": "Correctiva", "criticidad": "Alta",
    "causa_clasificada": "Desgaste", "fecha_intervencion": "2026-09-10"
  },

  // SECCIONES = el contenido, en el ORDEN fijo que impone la plantilla.
  "secciones": [
    { "id": "datos_equipo", "tipo": "campos",
      "campos": { "dominio": "ABC123", "marca": "CAT", "modelo": "420F" } },

    { "id": "acciones", "tipo": "cuerpo",
      "campos_extra": { },
      "bloques": [
        { "tipo": "texto",  "texto": "Se desmontó el conjunto hidráulico..." },
        { "tipo": "imagen", "img": "img_ab12", "caption": "Bomba desmontada" },
        { "tipo": "texto",  "html": "Se reemplazó el retén y se rearmó." }
      ] },

    { "id": "repuestos", "tipo": "tabla",
      "filas": [ ["RET-7788", "Retén bomba hidráulica", "1"] ] }
  ],

  // IMÁGENES = diccionario ref-local -> ubicación real de los bytes.
  // Desacopla el documento de DÓNDE viven los archivos (Drive hoy, OPS mañana).
  "imagenes": {
    "img_ab12": {
      "ref": "1AbC...driveFileId", "url": "https://.../uc?id=1AbC...",
      "nombre": "bomba.jpg", "w": 1600, "h": 1200, "bytes": 245113,
      "subida": "2026-09-12T13:20:00Z"
    }
  }
}
```

## 2. Tipos de sección

| tipo     | contenido                                   | campo en JSON            |
|----------|---------------------------------------------|--------------------------|
| `campos` | campos con nombre                           | `campos: { id: valor }`  |
| `cuerpo` | narrativa como bloques ordenados            | `bloques: [ ... ]` (+ `campos_extra`) |
| `tabla`  | filas con columnas fijas                    | `filas: [ [c1,c2,...] ]` |
| `anexos` | galería de imágenes/documentos              | `bloques: [ {tipo:"imagen"...} ]` |

La lista y el orden de secciones **los define la plantilla** (`js/plantillas.js`),
no el documento. El documento sólo aporta los valores.

## 3. Bloques (para imágenes en medio del texto)

Una sección `cuerpo` es una **lista ordenada de bloques**. Entre dos bloques de
texto se intercala una imagen: eso resuelve "colocar imágenes en medio del texto".

```jsonc
{ "tipo": "texto",  "texto": "…" }                    // texto plano; se renderiza como párrafos (\n = salto)
{ "tipo": "imagen", "img": "img_ab12", "caption": "…", "ancho": "media" }  // ancho: full|media|chica
{ "tipo": "lista",  "items": ["...","..."] }          // viñetas (opcional)
{ "tipo": "tabla",  "filas": [["...","..."]] }        // tabla suelta (opcional)
```

Las imágenes **nunca** guardan los bytes en el bloque: guardan una clave `img`
que resuelve contra `documento.imagenes[img].url`.

## 4. Imágenes

- Se capturan con `<input type="file" accept="image/*" capture="environment">`
  → en celular/tablet abre la **cámara trasera** directo; también "elegir de galería".
- Se **comprimen en el navegador** (canvas → JPEG ~1600 px, calidad ~0.8) antes de
  subir, para que la subida sea liviana en la red de campo.
- Se suben vía `backend.subirImagen()` y el backend devuelve `{ ref, url }`.
- En el prototipo los bytes viven en **Google Drive** (una carpeta por documento);
  el JSON sólo guarda el id/URL. Para el PDF se cachea el base64 comprimido local
  (evita problemas de auth/CORS de Drive en la ventana de impresión).

## 5. Identificadores y correlativos

- `id = <prefijo>-<año>-<NNNN>` (`INF-2026-0001`, `BOL-2026-0001`). El correlativo
  lo asigna el backend al guardar por primera vez (evita colisiones entre usuarios).
- Mientras es borrador local, se usa un id temporal `tmp-<uuid>` hasta el primer guardado.

## 6. Reglas de compatibilidad (del playbook)

- **Campos/columnas nuevos SIEMPRE al final** y subir `version` de la plantilla.
- Un documento viejo (`version_plantilla` menor) se abre igual: las secciones
  nuevas aparecen vacías; nunca se pierde lo cargado.
- El backend guarda el JSON **tal cual** (no lo re-modela). Si migra el formato,
  respalda el anterior antes (idempotente + verificable por conteos).

## 7. Para el análisis posterior

`meta` concentra los campos estructurados (dominio, sistema, componente, tipo de
intervención, causa clasificada, criticidad, fechas). Eso permite consultas como
"causas raíz más frecuentes por tipo de equipo" o "intervenciones del sistema
hidráulico en la obra X" sin parsear la narrativa. `sistema`/`componente` se
alinean al catálogo Sistema-Componente del ecosistema ProgramaCampo.
