/**
 * BUBA — Mail de prueba
 *
 * Abriendo esta dirección en el navegador se manda un mail de ejemplo a la
 * casilla de avisos (MAIL_AVISOS), para comprobar que los avisos de venta
 * llegan sin tener que hacer una compra. Como mucho uno por hora: si se
 * abre de nuevo dentro de la misma hora, no se repite.
 *
 * Con ?cliente=1 manda, también a la casilla de avisos, el mail de confirmación
 * que reciben los clientes (con datos de ejemplo), para ver cómo les queda.
 */
const { enviarMail, mailConfigurado } = require("../lib/mail");
const { armarMailCliente } = require("../lib/mail-cliente");
const { datosEnvio, datosCliente } = require("../lib/envio");

/** Pago de ejemplo con los precios reales: 1 pack a $24.000 + envío a CABA $3.800, guía creada. */
function pagoDeEjemplo() {
  const order = {
    code: "BUBA-EJEMPLO1", total: 27800, subtotal: 24000,
    customer: { name: "Sofía Martínez", email: "sofia@ejemplo.com", phone: "11 5555-0000", marketing: true, address: { street: "Av. Santa Fe 1234", apt: "5 B", city: "CABA", province: "Ciudad Autónoma de Buenos Aires", cp: "1059", notes: "" } },
    shipping: { id: "caba", name: "Envío a CABA", price: 3800, cps: "1000-1499", eta: "24 a 48 hs hábiles", domicilio: true },
    items: [{ id: "pack4", name: "Pack de 4", price: 24000, qty: 1 }],
  };
  return {
    id: 1234567890, status: "approved", external_reference: order.code, transaction_amount: order.total,
    payment_method_id: "visa", installments: 3, date_approved: new Date().toISOString(),
    payer: { email: order.customer.email },
    metadata: { pedido: order.code, total: order.total, cliente: datosCliente(order), envio: datosEnvio(order) },
    additional_info: { items: [
      { id: "pack4", title: "BUBA Drinks · Pack de 4", quantity: "1", unit_price: "24000" },
      { id: "envio", title: "BUBA Drinks · Envío a CABA", quantity: "1", unit_price: "3800" },
    ] },
  };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!mailConfigurado()) {
    return res.status(200).json({
      ok: false,
      mensaje: "Faltan RESEND_API_KEY o MAIL_AVISOS en Vercel. Cargalos y hacé Redeploy.",
    });
  }
  const hora = new Date().toISOString().slice(0, 13); // AAAA-MM-DDTHH
  const q = req.query || {};
  if (q.cliente === "1" || q.cliente === "si") {
    const m = armarMailCliente(pagoDeEjemplo(), { estado: "creada", guia: "FM000123456" });
    // va a la casilla de avisos (no a un cliente) y lo dice en el asunto para que no se confunda con una venta
    const rc = await enviarMail({ asunto: "[Ejemplo] " + m.asunto, html: m.html, texto: m.texto, idempotencia: "prueba-cliente2-" + hora });
    if (rc.ok) return res.status(200).json({ ok: true, mensaje: "Mail de ejemplo del cliente enviado a la casilla de avisos. Revisá tu casilla (y Spam)." });
    return res.status(200).json({ ok: false, mensaje: "Resend no mandó el mail", detalle: rc.error || null });
  }
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
