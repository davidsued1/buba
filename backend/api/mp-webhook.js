/**
 * BUBA backend — Webhook de Mercado Pago
 *
 * Mercado Pago llama a esta URL cuando cambia el estado de un pago.
 * Consultamos el pago y dejamos registrado el resultado en los logs.
 *
 * Si el pago está aprobado y el pedido es con envío a domicilio, crea la
 * guía en Fast Mail (e-Presis). Solo si FASTMAIL_AUTO = "si" (apagado por
 * defecto). Ver backend/README.md y docs/10_API_Presis.md.
 *
 * Además avisa por mail (Resend) de cada venta aprobada, con la etiqueta de
 * Fast Mail adjunta si se creó la guía. Ver backend/lib/mail.js.
 *
 * Si hay un dominio verificado en Resend (MAIL_FROM), también le manda al comprador
 * un mail de confirmación de pedido. Ver backend/lib/mail-cliente.js.
 *
 * Con cada venta aprobada también guarda el mail del comprador en los contactos
 * de Resend (para novedades). Ver backend/lib/contactos.js.
 *
 * Si la plata vuelve (reembolso total, parcial o contracargo) manda un segundo
 * mail de recordatorio para dar de baja la guía de Fast Mail a mano. No anula
 * nada solo. Los pagos cancelados o rechazados no hacen nada (nunca se aprobaron).
 *
 * Desde que existe Pago TIC, todo lo que viene después de "el pago está aprobado"
 * (guía, mails, contacto) vive en lib/venta.js y se comparte con api/pagotic-webhook.js:
 * acá solo se recibe el aviso, se consulta el pago y se lo traduce con ventaDesdeMP().
 */
const { procesarVentaAprobada, procesarDevolucion, ventaDesdeMP } = require("../lib/venta");

/** Id del pago según la forma del aviso. null si no es un aviso de pago. */
function pagoDelAviso(req) {
  const q = req.query || {};
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const topic = String(q.topic || q.type || b.topic || b.type || "").toLowerCase();
  const accion = String(b.action || "");
  if (topic && topic !== "payment" && !/^payment\./.test(accion)) return null; // merchant_order, etc.

  const deResource = String(b.resource || q.resource || "").match(/\/payments\/(\d+)/);
  return q["data.id"] || (b.data && b.data.id) || q.id || b.id || (deResource && deResource[1]) || null;
}

/** "total" | "contracargo" | "parcial" si el pago devolvió la plata; null si no. */
function tipoDevolucion(pago) {
  if (pago.status === "refunded") return "total";
  if (pago.status === "charged_back") return "contracargo";
  if (pago.status === "approved" && pago.status_detail === "partially_refunded") return "parcial";
  return null;
}

module.exports = async (req, res) => {
  const token = process.env.MP_ACCESS_TOKEN;
  try {
    const paymentId = pagoDelAviso(req);

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
        const devolucion = tipoDevolucion(pago);
        if (devolucion) {
          // plata devuelta: solo recordatorio por mail (aunque sea "approved", no se repite el flujo de venta)
          await procesarDevolucion(ventaDesdeMP(pago), devolucion);
        } else if (pago.status === "approved") {
          await procesarVentaAprobada(ventaDesdeMP(pago));
        } else if (pago.status === "cancelled" || pago.status === "rejected") {
          console.log("[BUBA] Pago no aprobado, no se hace nada", pago.external_reference, pago.status);
        }
      }
    }
  } catch (err) {
    console.error("[BUBA] Error en webhook:", err.message);
  }
  // Siempre 200 para que MP no reintente infinitamente
  res.status(200).json({ ok: true });
};
