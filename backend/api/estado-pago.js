/**
 * BUBA — Estado real de un pago
 *
 * Cuando el cliente vuelve de Mercado Pago, la web pregunta acá cómo quedó
 * su pedido en vez de confiar en la dirección de vuelta (que en el celular
 * puede no coincidir, por ejemplo si pagó desde la app de Mercado Pago).
 *
 *   GET /api/estado-pago?pedido=BUBA-XXXX   (o ?id=<payment_id>)
 *
 * Solo devuelve el estado y el monto: ningún dato personal.
 */
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return res.status(200).json({ ok: false, mensaje: "Falta el Access Token" });

  const pedido = String(req.query?.pedido || "").trim();
  const id = String(req.query?.id || "").replace(/\D/g, "");
  if (!/^BUBA-[A-Z0-9-]{3,40}$/i.test(pedido) && !id) {
    return res.status(400).json({ ok: false, mensaje: "Falta el número de pedido" });
  }

  try {
    const url = id
      ? `https://api.mercadopago.com/v1/payments/${id}`
      : `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(pedido)}&sort=date_created&criteria=desc&limit=10`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return res.status(200).json({ ok: false, mensaje: "Mercado Pago respondió " + r.status });
    const data = await r.json();
    const pagos = id ? [data] : (data.results || []);
    // si el pedido tuvo varios intentos, vale el aprobado; si no, el más reciente
    const elegido = pagos.find((p) => p.status === "approved") || pagos[0];
    if (!elegido) return res.status(200).json({ ok: true, estado: "sin_pago" });
    return res.status(200).json({
      ok: true,
      estado: elegido.status,            // approved | pending | in_process | rejected | cancelled | refunded
      aprobado: elegido.status === "approved",
      monto: elegido.transaction_amount,
      pedido: elegido.external_reference || null,
    });
  } catch (err) {
    return res.status(200).json({ ok: false, mensaje: "No se pudo consultar: " + err.message });
  }
};
