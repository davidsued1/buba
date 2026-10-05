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

/** POST a e-Presis con los campos comunes; `leer(respuesta)` lee el cuerpo antes de soltar el timeout. */
async function llamar(ruta, body, leer) {
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
    return await leer(r);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST a un endpoint de e-Presis. Agrega los campos comunes (api_token,
 * cp_origen, codigo_sucursal, sucursal) y devuelve { http, data, texto }.
 * `data` es el JSON de la respuesta (o null, y entonces viene `texto`).
 */
function presis(ruta, body = {}) {
  return llamar(ruta, body, async (r) => {
    const texto = await r.text();
    try { return { http: r.status, data: JSON.parse(texto) }; }
    catch { return { http: r.status, data: null, texto: texto.slice(0, 200) }; }
  });
}

/**
 * Igual que presis() pero para respuestas que son un archivo (etiquetas, remitos).
 * Devuelve { http, buffer, tipo }: tipo "pdf" si empieza con %PDF-, "html" si no.
 */
function presisArchivo(ruta, body = {}) {
  return llamar(ruta, body, async (r) => {
    const buffer = Buffer.from(await r.arrayBuffer());
    const tipo = buffer.subarray(0, 5).toString("latin1") === "%PDF-" ? "pdf" : "html";
    return { http: r.status, buffer, tipo };
  });
}

/** Etiqueta de una guía: { nombre, base64 } o null si falló o vino vacía. */
async function etiqueta(guia) {
  try {
    const r = await presisArchivo("api/v1/public/print_etiquetas.json", { ids: String(guia) });
    if (r.http < 200 || r.http >= 300 || !r.buffer.length) return null;
    return {
      nombre: `etiqueta-${guia}.${r.tipo === "pdf" ? "pdf" : "html"}`,
      base64: r.buffer.toString("base64"),
    };
  } catch {
    return null;
  }
}

module.exports = { presis, presisArchivo, etiqueta, configurado, BASE };
