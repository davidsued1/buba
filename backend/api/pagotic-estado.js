/**
 * BUBA — Prueba de conexión con Pago TIC
 *
 *   GET /api/pagotic-estado
 *
 * Pide un token con las credenciales cargadas en Vercel. No crea ni cobra nada y no devuelve
 * ninguna credencial. Lo usa el botón "Probar conexión" del panel (Configuración → Pago TIC).
 */
const { configurado, faltantes, token, apiUrl } = require("../lib/pagotic");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!configurado()) {
    const faltan = faltantes();
    return res.status(200).json({
      ok: false,
      mensaje: "Faltan variables de Pago TIC en Vercel: " + faltan.join(", "),
      faltan,
    });
  }
  const t = await token({ fresco: true });
  if (!t.ok) {
    return res.status(200).json({ ok: false, mensaje: t.mensaje, http: t.http, detalle: t.detalle });
  }
  return res.status(200).json({
    ok: true,
    mensaje: "Conectado con Pago TIC",
    api: apiUrl(),
    expira_en: t.expira_en,
  });
};
