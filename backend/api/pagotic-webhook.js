/**
 * BUBA backend — Webhook de Pago TIC
 *
 * Pago TIC avisa por POST a esta URL cuando cambia el estado de un pago. El aviso NO viene firmado,
 * así que no se le cree nada: solo se toma el id, se consulta el pago en la API de Pago TIC con nuestro
 * token y se actúa sobre lo que responde la API (nunca sobre lo que dice el aviso).
 *
 *   approved → procesarVentaAprobada (guía de Fast Mail, mails, contacto), igual que Mercado Pago
 *   refunded → procesarDevolucion "total" (mail recordatorio)
 *   otros    → solo log
 *
 * Responde siempre 200: si no, Pago TIC reintenta durante hasta 5 días.
 */
const { obtenerPago, configurado } = require("../lib/pagotic");
const { procesarVentaAprobada, procesarDevolucion, ventaDesdePagoTIC } = require("../lib/venta");

/** Id del pago según el aviso (cuerpo o query). Solo se acepta algo con forma de UUID. */
function idDelAviso(req) {
  const q = req.query || {};
  const b = req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body) ? req.body : {};
  const id = String(b.id || q.id || "").trim();
  return /^[0-9a-f][0-9a-f-]{7,63}$/i.test(id) ? id : null;
}

module.exports = async (req, res) => {
  try {
    const id = idDelAviso(req);
    if (!id) {
      console.log("[BUBA] Pago TIC: aviso sin id, se ignora");
    } else if (!configurado()) {
      console.error("[BUBA] Pago TIC: aviso recibido pero faltan las variables PAGOTIC_*");
    } else {
      const r = await obtenerPago(id);
      if (!r.pago) {
        console.error("[BUBA] Pago TIC: no se pudo verificar el pago, no se hace nada", { id, http: r.http, motivo: r.texto });
      } else {
        const p = r.pago;
        const estado = String(p.status || "").toLowerCase();
        console.log("[BUBA] Pago TIC recibido:", { pedido: p.external_transaction_id, estado, monto: p.final_amount, email: p.payer && p.payer.email });
        if (estado === "approved") await procesarVentaAprobada(ventaDesdePagoTIC(p));
        else if (estado === "refunded") await procesarDevolucion(ventaDesdePagoTIC(p), "total");
        else console.log("[BUBA] Pago TIC no aprobado, no se hace nada", p.external_transaction_id, estado);
      }
    }
  } catch (err) {
    console.error("[BUBA] Error en webhook de Pago TIC:", err.message);
  }
  res.status(200).json({ ok: true });
};
