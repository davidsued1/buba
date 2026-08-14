/**
 * BUBA backend — Webhook de Mercado Pago
 *
 * Mercado Pago llama a esta URL cuando cambia el estado de un pago.
 * Consultamos el pago y dejamos registrado el resultado en los logs.
 *
 * Próximo paso (cuando sumemos base de datos): actualizar acá el estado
 * del pedido (external_reference = código BUBA-XXXX) a "pagado" y disparar
 * la notificación de preparación/envío.
 */

module.exports = async (req, res) => {
  const token = process.env.MP_ACCESS_TOKEN;
  try {
    const paymentId =
      req.query?.["data.id"] ||
      req.body?.data?.id ||
      req.query?.id;

    if (paymentId && token) {
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const pago = await r.json();
        console.log("[BUBA] Pago recibido:", {
          pedido: pago.external_reference,
          estado: pago.status,
          monto: pago.transaction_amount,
          email: pago.payer?.email,
        });
      }
    }
  } catch (err) {
    console.error("[BUBA] Error en webhook:", err.message);
  }
  // Siempre 200 para que MP no reintente infinitamente
  res.status(200).json({ ok: true });
};
