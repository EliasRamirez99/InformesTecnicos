# Contrato de backend (el adaptador)

El frontend **no habla con Google ni con OPS directo**: habla con un adaptador
(`js/backend.js`) que expone estas funciones. El día que OPS haga su endpoint de
escritura, se reimplementa **sólo este archivo** y el resto del frontend no cambia.
Ver el modelo del dato en [MODELO-DATOS.md](MODELO-DATOS.md).

## 1. Interfaz que consume el frontend

| Función                         | Qué hace                                   | Acceso   |
|---------------------------------|--------------------------------------------|----------|
| `guardarDoc(doc)`               | crea o actualiza un documento (upsert)     | escritura|
| `subirImagen(base64, meta)`     | sube una imagen, devuelve `{ ref, url }`   | escritura|
| `listarDocs(filtros)`           | lista documentos (id, tipo, meta, fechas)  | lectura  |
| `obtenerDoc(id)`                | trae el documento completo                 | lectura  |
| `referencia(dominio)`           | datos del equipo desde la API OPS (autofill)| lectura |

Todas devuelven Promesas y pasan por `postReintento` (reintentos + backoff +
alternancia directo↔relay). Ver [§5 Resiliencia](#5-resiliencia).

### Formas de request/response

```jsonc
// guardarDoc
POST { accion:"guardar_doc", clave:"<sector>", doc:{...} }
  -> { ok:true, id:"INF-2026-0001", actualizado:"..." }

// subirImagen  (base64 SIN el prefijo data:)
POST { accion:"subir_imagen", clave:"<sector>", doc_id:"INF-2026-0001",
       nombre:"bomba.jpg", mime:"image/jpeg", w:1600, h:1200, base64:"..." }
  -> { ok:true, ref:"<driveId>", url:"https://.../uc?id=<driveId>" }

// listarDocs  (lectura abierta)
GET  ?accion=listar_docs&tipo=informe_intervencion&dominio=ABC123&desde=...&hasta=...
  -> { ok:true, docs:[ { id, tipo, estado, meta, creado, actualizado } ] }

// obtenerDoc
GET  ?accion=obtener_doc&id=INF-2026-0001
  -> { ok:true, doc:{...documento completo...} }

// referencia  (el server pega a la API OPS con la X-API-Key; ver §4)
GET  ?accion=referencia&dominio=ABC123
  -> { ok:true, equipo:{ dominio, tipo_equipo, marca, modelo, medidor, ubicacion } }
```

Errores: `{ ok:false, error:"<mensaje>", code:"<opcional>" }`.

## 2. Implementación del prototipo (Apps Script + Sheets + Drive)

- **Base de datos:** una Google Sheet. Pestaña `documentos` con una fila por
  documento: `[id, tipo, estado, creado, actualizado, autor, meta_json, doc_json]`.
  El JSON del documento va en `doc_json` (texto; las imágenes NO van ahí, van a Drive).
- **Imágenes:** Google Drive. Una carpeta por documento (`INF-2026-0001/`) dentro de
  una carpeta raíz del proyecto. `subir_imagen` hace `Utilities.base64Decode` →
  `folder.createFile(blob)` → devuelve `getId()` + URL de visualización.
- **Correlativos:** `PropertiesService` guarda el último número por prefijo/año.
- **Escrituras** piden `clave` de sector (validación simple server-side, como en
  PlanillaTaller). **Lecturas** abiertas.
- Código en [`../apps-script/Codigo.gs`](../apps-script/Codigo.gs).

## 3. Camino a la API de OPS (handoff)

Cuando OPS integre esto a su App:
1. Implementan `guardar_doc` / `subir_imagen` / `listar_docs` / `obtener_doc` contra
   su propia base y su storage de imágenes.
2. Cambian `CONFIG.BACKEND_URL` en `js/config.js` por su endpoint.
3. El modelo del documento (MODELO-DATOS.md) viaja igual; sólo cambia el transporte.

## 4. API OPS read-only para autofill — la key va SERVER-SIDE

`referencia(dominio)` trae marca/modelo/horómetro/ubicación del equipo desde la
**API pública read-only de OPS** (`gestion.opssrlapp.com`, header `X-API-Key`,
versión por-endpoint). **La API key NO va en el frontend**: vive en las
Script Properties del Apps Script (`OPS_API_KEY`) y el server hace el fetch.
Esto respeta la regla del ecosistema: las API keys nunca viajan al cliente ni al
proveedor equivocado.

> Nota: si OPS no habilita CORS/consulta puntual por dominio, el autofill puede
> quedar en fase 2 sin bloquear la carga (el usuario completa los datos a mano).

## 5. Resiliencia (desde el arranque)

Igual que PlanillaTaller, porque la red del laburo bloquea servicios externos:
- `CONFIG.RELAY_URL` = relay pass-through en Vercel ([`../api/proxy.js`](../api/proxy.js)).
- `postReintento(body, intentos)` (en `common.js`): POST con 2-3 reintentos, backoff,
  timeout 15 s, y **alternancia directo↔relay**; recuerda en `localStorage` qué ruta
  respondió para no comer el timeout la próxima.
- El **Guardar** nunca resetea el formulario si la red corta: avisa y conserva todo.
- Idempotencia: cada `guardar_doc` lleva el `id` (o un `cid` temporal) para que un
  reintento no duplique el documento.

## 6. Modo demo (sin backend)

Si `CONFIG.BACKEND_URL` está vacío, `backend.js` usa `localStorage` como store falso
(guardar/listar/obtener) e imágenes como data-URI local. Permite desarrollar y probar
toda la UI sin desplegar nada. Igual patrón que el modo demo de PlanillaTaller.
