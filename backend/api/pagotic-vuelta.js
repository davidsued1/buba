/**
 * BUBA — Vuelta del cliente desde Pago TIC
 *
 * Al terminar de pagar, Pago TIC manda el navegador del cliente a la return_url con un POST
 * (con datos básicos del pago). Como la tienda es una página estática, acá se lo redirige con un
 * 303 (que convierte el POST en GET) a la tienda:
 *
 *   <SITE_URL>/?pago=<ok|pendiente|error>&pedido=<código>&proveedor=pagotic
 *
 * También acepta GET. Esto es solo para que el cliente vea un mensaje: nada de lo que llega acá
 * se toma como prueba de pago. La tienda le pregunta el estado real a /api/estado-pago, y el cobro
 * se confirma únicamente por el aviso verificado de /api/pagotic-webhook.
 */
const MAPA = {
  approved: "ok",
  pending: "pendiente", issued: "pendiente", in_process: "pendiente", review: "pendiente", validate: "pendiente",
};

/** Cuerpo de la petición como objeto, venga como JSON, form-urlencoded, texto o Buffer. Nunca lanza. */
function leerCuerpo(req) {
  let b = req.body;
  try {
    if (b && typeof b === "object" && !Buffer.isBuffer(b)) return b;
    if (Buffer.isBuffer(b)) b = b.toString("utf8");
    if (typeof b !== "string" || !b.trim()) return {};
    try {
      const j = JSON.parse(b);
      if (j && typeof j === "object") return j;
    } catch { /* no era JSON */ }
    return Object.fromEntries(new URLSearchParams(b));
  } catch {
    return {};
  }
}

/** Solo letras, números, guiones y guion bajo: el código del pedido va a una URL. */
const limpiarPedido = (v) => String(Array.isArray(v) ? v[0] : v || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);

module.exports = async (req, res) => {
  const q = req.query || {};
  const b = leerCuerpo(req);
  const pedido = limpiarPedido(q.pedido || b.pedido || b.external_transaction_id);
  const status = String(b.status || (b.payment && b.payment.status) || q.status || "").toLowerCase();
  // aprobado → ok; en proceso → pendiente; cualquier otra cosa o nada → pendiente: la tienda lo verifica
  const pago = MAPA[status] || "pendiente";

  const site = (process.env.SITE_URL || "https://bubadrinks.com.ar").replace(/\/$/, "");
  const destino = `${site}/?pago=${pago}` + (pedido ? `&pedido=${encodeURIComponent(pedido)}` : "") + "&proveedor=pagotic";

  res.setHeader("Location", destino);
  res.setHeader("Cache-Control", "no-store");
  res.status(303).end();
};
