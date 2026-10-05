/**
 * BUBA — Estado real de un pago
 *
 * Cuando el cliente vuelve de Mercado Pago, la web pregunta acá cómo quedó
 * su pedido en vez de confiar en la dirección de vuelta (que en el celular
 * puede no coincidir, por ejemplo si pagó desde la app de Mercado Pago).
 *
 *   GET /api/estado-pago?pedido=BUBA-XXXX   (o ?id=<payment_id>)
 *   GET /api/estado-pago?proveedor=pagotic&pedido=BUBA-XXXX   (o &id=<UUID del pago>)   → Pago TIC
 *
 * Con Pago TIC el estado se traduce a los nombres de Mercado Pago (approved, pending,
 * rejected, refunded) para que la web use el mismo mapeo.
 *
 * Solo devuelve el estado y el monto: ningún dato personal.
 */
const P = require("../lib/pagotic");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (String(req.query?.proveedor || "").toLowerCase() === "pagotic") return estadoPagoTIC(req, res);

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

/** Estado de un pedido pagado con Pago TIC. Misma forma de respuesta que con Mercado Pago. */
async function estadoPagoTIC(req, res) {
  if (!P.configurado()) return res.status(200).json({ ok: false, mensaje: "Falta configurar Pago TIC" });

  const pedido = String(req.query?.pedido || "").trim();
  const id = String(req.query?.id || "").trim();
  const idValido = /^[0-9a-f][0-9a-f-]{7,63}$/i.test(id);
  if (!/^BUBA-[A-Z0-9-]{3,40}$/i.test(pedido) && !idValido) {
    return res.status(400).json({ ok: false, mensaje: "Falta el número de pedido" });
  }

  try {
    let pagos;
    if (idValido) {
      const r = await P.obtenerPago(id);
      if (!r.pago && r.http !== 404) return res.status(200).json({ ok: false, mensaje: "Pago TIC respondió " + r.http });
      pagos = r.pago ? [r.pago] : [];
    } else {
      const filtros = [{ campo: "external_transaction_id", valor: pedido }];
      if (P.collectorId()) filtros.push({ campo: "collector_id", valor: P.collectorId() });
      const r = await P.buscarPagos(filtros);
      if (r.http < 200 || r.http >= 300) return res.status(200).json({ ok: false, mensaje: "Pago TIC respondió " + r.http });
      // la consulta es por igualdad; igual se descarta lo que no sea de este pedido
      pagos = r.pagos.filter((p) => !p.external_transaction_id || String(p.external_transaction_id).toLowerCase() === pedido.toLowerCase());
    }
    // si el pedido tuvo varios intentos, vale el aprobado; si no, el primero que devuelve la API
    const elegido = pagos.find((p) => P.estadoComoMP(p.status) === "approved") || pagos[0];
    if (!elegido) return res.status(200).json({ ok: true, estado: "sin_pago" });
    const estado = P.estadoComoMP(elegido.status);
    return res.status(200).json({
      ok: true,
      estado,
      aprobado: estado === "approved",
      monto: elegido.final_amount != null ? Number(elegido.final_amount) : null,
      pedido: elegido.external_transaction_id || null,
    });
  } catch (err) {
    return res.status(200).json({ ok: false, mensaje: "No se pudo consultar: " + err.message });
  }
}
