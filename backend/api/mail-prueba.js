/**
 * BUBA — Mail de prueba
 *
 * Abriendo esta dirección en el navegador se manda un mail de ejemplo a la
 * casilla de avisos (MAIL_AVISOS), para comprobar que los avisos de venta
 * llegan sin tener que hacer una compra. Como mucho uno por hora: si se
 * abre de nuevo dentro de la misma hora, no se repite.
 */
const { enviarMail, mailConfigurado } = require("../lib/mail");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!mailConfigurado()) {
    return res.status(200).json({
      ok: false,
      mensaje: "Faltan RESEND_API_KEY o MAIL_AVISOS en Vercel. Cargalos y hacé Redeploy.",
    });
  }
  const hora = new Date().toISOString().slice(0, 13); // AAAA-MM-DDTHH
  const r = await enviarMail({
    asunto: "✅ Prueba de avisos BUBA",
    texto: "Si te llegó este mail, los avisos de venta de BUBA están funcionando.\n\nCon cada venta aprobada vas a recibir un mail como este, con todos los datos de la compra.",
    html: '<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:16px;color:#1d1d1f;max-width:520px">' +
      '<p style="font-size:22px;font-weight:700;margin:0 0 12px">Los avisos de BUBA funcionan ✅</p>' +
      "<p>Con cada venta aprobada vas a recibir un mail como este, con todos los datos de la compra y, cuando esté prendida, la etiqueta de Fast Mail adjunta.</p></div>",
    idempotencia: "prueba-" + hora,
  });
  if (r.ok) return res.status(200).json({ ok: true, mensaje: "Mail de prueba enviado. Revisá tu casilla (y Spam)." });
  return res.status(200).json({ ok: false, mensaje: "Resend no mandó el mail", detalle: r.error || null });
};
