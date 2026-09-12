# Informes Técnicos y Boletines · OPS

Sección web para que los supervisores carguen **Informes Técnicos de
Intervenciones Exitosas** y **Boletines de Mantenimiento** con una **estructura
fija obligatoria**, **imágenes intercaladas en el texto** (cámara del celu/tablet),
**exportación a PDF** y datos **estructurados para analizar** después.

Sucesor de PlanillaTaller. Mismo molde: frontend estático + backend liviano,
resiliencia relay+reintentos desde el arranque, y **modelo separado del backend**
para que OPS lo integre a su App cambiando sólo el transporte.

> Repo **fuera de OneDrive** a propósito (`C:\Users\eramirez\InformesTecnicos`):
> la sincronización corrompe el `.git`. GitHub es el respaldo.

## Estructura

```
InformesTecnicos/
  index.html            ✅ inicio: accesos + lista de documentos
  informe.html          ⏳ editor Informe Técnico            (próximo)
  boletin.html          ⏳ editor Boletín                    (próximo)
  ver.html              ⏳ lectura / impresión / PDF          (próximo)
  css/estilos.css       ✅ base (tokens, tema claro/oscuro, OPS #0080C0)
  js/
    config.js           ✅ URLs backend + relay (lo único que cambia OPS)
    common.js           ✅ postReintento (relay+reintentos), fechas, tema
    plantillas.js       ✅ LAS ESTRUCTURAS OBLIGATORIAS (informe + boletín)
    backend.js          ✅ EL ADAPTADOR (Apps Script / demo por localStorage)
    editor.js           ⏳ motor: renderiza plantilla -> secciones -> bloques
    imagenes.js         ⏳ captura (cámara) + compresión canvas + subida
    impresion.js        ⏳ armar HTML de impresión / PDF
    lista.js            ⏳ filtros del inicio
  apps-script/Codigo.gs ✅ backend prototipo (Sheets + Drive)
  api/proxy.js          ✅ relay Vercel (pass-through)
  docs/
    MODELO-DATOS.md     ✅ forma del documento (secciones, bloques, imágenes)
    CONTRATO-API.md     ✅ interfaz del adaptador + handoff a OPS
```

## Cómo probar ahora (modo demo, sin desplegar nada)

`config.js` viene con `BACKEND_URL` vacío ⇒ **modo demo**: todo se guarda en el
`localStorage` del navegador. Abrí `index.html` y ya lista/crea documentos localmente.
(Los editores llegan en el próximo paso; hoy el inicio y la base ya funcionan.)

## Desplegar el backend real

1. Crear la Google Sheet + Apps Script con `apps-script/Codigo.gs`.
2. Script Properties: `OPS_API_KEY`, `DRIVE_RAIZ_ID`.
3. Implementar como App web ("Cualquiera") y pegar la URL `/exec` en `js/config.js`.
4. (Opcional) Relay: importar el repo a Vercel y poner la URL del Apps Script en
   `api/proxy.js`; luego `RELAY_URL` en `js/config.js`.

## Decisiones (2026-09-12)

- Estructura fija = **plantilla-como-dato** (`plantillas.js`); el motor no deja saltearla.
- Imágenes **en medio del texto** = modelo de **bloques** (texto | imagen | …).
- Cámara directa vía `<input accept="image/*" capture="environment">` + compresión canvas.
- Imágenes en **Google Drive** vía Apps Script (bytes en Drive, id/URL en el doc).
- API key de OPS **server-side** (Script Properties), nunca en el front.
- Empezamos por el **Informe Técnico**; el Boletín reusa el mismo motor.

## Roadmap

1. `editor.js` + `informe.html` — motor de secciones/bloques (Informe primero).
2. `imagenes.js` — cámara + compresión + subida (Drive).
3. `impresion.js` + `ver.html` — PDF con formato.
4. `boletin.html` — reusar el motor con la otra plantilla.
5. Desplegar Sheet+Apps Script+Drive (+relay) y probar con datos reales.
6. `lista.js` — filtros/búsqueda para el análisis.
