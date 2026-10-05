/**
 * BUBA — Cliente mínimo de la API e-Presis de Fast Mail
 *
 * Variables de entorno (Vercel → Settings → Environment Variables):
 *   FASTMAIL_TOKEN     → token de la API que mandó Fast Mail
 *   FASTMAIL_SUCURSAL  → código de sucursal (ej. APP003)
 *   FASTMAIL_CP        → código postal de retiro (ej. 1425)
 *
 * Especificación de la API: docs/10_API_Presis.md
 */
const BASE = "https://epresislv.fastmail.com.ar/";

const VARIABLES = ["FASTMAIL_TOKEN", "FASTMAIL_SUCURSAL", "FASTMAIL_CP"];

/** true si están cargadas las 3 variables de Fast Mail */
function configurado() {
  return VARIABLES.every((k) => !!process.env[k]);
}

/**
 * POST a un endpoint de e-Presis. Agrega los campos comunes (api_token,
 * cp_origen, codigo_sucursal, sucursal) y devuelve { http, data, texto }.
 * `data` es el JSON de la respuesta (o null, y entonces viene `texto`).
 */
async function presis(ruta, body = {}) {
  const sucursal = process.env.FASTMAIL_SUCURSAL || "";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(BASE + ruta, {
      method: "POST",
      headers: { "Content-Type": "application/json", "aws-x-prs-wp": "presis-bubadrinks.com.ar" },
      body: JSON.stringify({
        api_token: process.env.FASTMAIL_TOKEN || "",
        cp_origen: process.env.FASTMAIL_CP || "",
        codigo_sucursal: sucursal,
        sucursal,
        ...body,
      }),
      signal: ctrl.signal,
    });
    const texto = await r.text();
    try { return { http: r.status, data: JSON.parse(texto) }; }
    catch { return { http: r.status, data: null, texto: texto.slice(0, 200) }; }
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { presis, configurado, BASE };
