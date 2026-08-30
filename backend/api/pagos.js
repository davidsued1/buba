/**
 * BUBA — Últimos cobros recibidos
 *
 * Le pregunta a Mercado Pago por los pagos de la cuenta y los devuelve
 * limpios para mostrarlos en el panel. Así se ve la plata que entró sin
 * tener que abrir Mercado Pago.
 */
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return res.status(200).json({ ok: false, mensaje: "Falta cargar el Access Token en Vercel." });

  try {
    const r = await fetch(
      "https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=30",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!r.ok) {
      return res.status(200).json({ ok: false, mensaje: "Mercado Pago respondió " + r.status });
    }
    const data = await r.json();
    const ESTADOS = {
      approved: "aprobado",
      pending: "pendiente",
      in_process: "en revisión",
      rejected: "rechazado",
      cancelled: "cancelado",
      refunded: "devuelto",
      charged_back: "contracargo",
    };
    const pagos = (data.results || []).map((p) => ({
      id: p.id,
      pedido: p.external_reference || null,
      estado: ESTADOS[p.status] || p.status,
      aprobado: p.status === "approved",
      monto: p.transaction_amount,
      neto: p.transaction_details?.net_received_amount ?? null,
      medio: p.payment_method_id,
      cuotas: p.installments,
      email: p.payer?.email || null,
      fecha: p.date_created,
    }));
    return res.status(200).json({ ok: true, pagos });
  } catch (err) {
    return res.status(200).json({ ok: false, mensaje: "No se pudo consultar: " + err.message });
  }
};
