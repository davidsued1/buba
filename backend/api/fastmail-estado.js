/**
 * BUBA — Prueba de conexión con Fast Mail (e-Presis)
 *
 * Abriendo esta dirección en el navegador se ve si los datos de Fast Mail
 * cargados en Vercel funcionan y qué servicios tiene habilitados la cuenta.
 * NO crea ningún envío: solo consulta. No muestra el token.
 *
 * Variables (Vercel → Settings → Environment Variables):
 *   FASTMAIL_TOKEN     → token de la API que mandó Fast Mail
 *   FASTMAIL_SUCURSAL  → código de sucursal (ej. APP003)
 *   FASTMAIL_CP        → código postal de retiro (ej. 1425)
 *
 * Especificación de la API: docs/10_API_Presis.md
 */
const BASE = "https://epresislv.fastmail.com.ar/";

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

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  const faltan = ["FASTMAIL_TOKEN", "FASTMAIL_SUCURSAL", "FASTMAIL_CP"].filter((k) => !process.env[k]);
  if (faltan.length) {
    return res.status(200).json({
      ok: false,
      mensaje: "Faltan datos en Vercel: " + faltan.join(", "),
      ayuda: "Vercel → buba-pagos → Settings → Environment Variables. Después: Deployments → Redeploy.",
    });
  }

  try {
    const prueba = await presis("api/v2/dummy-test.json");
    const cliente = prueba.data && prueba.data.cliente;
    if (!cliente || cliente === "Error") {
      return res.status(200).json({
        ok: false,
        mensaje: "Fast Mail no aceptó los datos. Revisá el token y el código de sucursal.",
        respuesta: prueba.data ? (prueba.data.message || prueba.data) : (prueba.texto || "sin respuesta"),
        http: prueba.http,
      });
    }

    const serv = await presis("api/v2/servicios-cliente.json");
    const lista = Array.isArray(serv.data) ? serv.data : [];
    return res.status(200).json({
      ok: true,
      mensaje: "Conectado con Fast Mail",
      cliente,
      cp_retiro: process.env.FASTMAIL_CP,
      sucursal: process.env.FASTMAIL_SUCURSAL,
      servicios: lista.map((s) => ({ codigo: s.codigo_servicio, nombre: s.descripcion })),
      aviso_servicios: Array.isArray(serv.data) ? undefined : (serv.data && serv.data.message) || "No se pudieron leer los servicios",
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      mensaje: err.name === "AbortError" ? "Fast Mail no respondió a tiempo" : "No se pudo conectar: " + err.message,
    });
  }
};
