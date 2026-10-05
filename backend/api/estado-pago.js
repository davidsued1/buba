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
    const email = String(req.query?.email || "").trim();
    let pagos = [];
    let fallo = null;
    if (idValido) {
      const r = await P.obtenerPago(id);
      if (r.pago) pagos = [r.pago];
      else if (r.http !== 404) fallo = r;
    }
    // sin id (o sin resultado por id): búsqueda por pedido con las combinaciones que acepta la API
    if (!pagos.length && /^BUBA-[A-Z0-9-]{3,40}$/i.test(pedido)) {
      const r = await P.buscarPorPedido(pedido, email);
      if (r.http >= 200 && r.http < 300) { pagos = r.pagos; fallo = null; }
      else fallo = fallo || r;
    }
    if (!pagos.length && fallo) {
      return res.status(200).json({ ok: false, mensaje: "Pago TIC respondió " + (fallo.http || "sin respuesta"), detalle: P.limpiar(fallo.texto || "", 200) });
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
