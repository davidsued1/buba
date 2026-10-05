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
 * Consultas extra (solo lectura): ?seguimiento=<remito> y ?cotizar=<CP>.
 *
 * Especificación de la API: docs/10_API_Presis.md
 */
const { presis } = require("../lib/presis");

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

    // Consultas de solo lectura para probar sin crear envíos:
    //   ?seguimiento=123456 → qué responde Fast Mail por ese número de remito
    //   ?cotizar=1414       → precio de 1 pack (1 bulto, 1 kg, 15×15×7,5) a ese CP
    const q = req.query || {};
    const remito = String(q.seguimiento || "").replace(/\D/g, "").slice(0, 20);
    if (remito) {
      const s = await presis("api/v2/seguimiento.json", { remito });
      return res.status(200).json({ ok: true, consulta: "seguimiento", remito, http: s.http, respuesta: s.data ?? s.texto ?? null });
    }
    const cp = String(q.cotizar || "").replace(/\D/g, "").slice(0, 4);
    if (cp.length === 4) {
      const c = await presis("api/v2/precio-servicio.json", {
        tiempo: "", cp_destino: cp, is_urgente: false, valor_declarado: 0,
        productos: [{ id: 1, bultos: 1, peso: 1, dimensiones: { alto: 8, largo: 15, profundidad: 15 } }],
      });
      return res.status(200).json({ ok: true, consulta: "cotizar", cp, http: c.http, respuesta: c.data ?? c.texto ?? null });
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
