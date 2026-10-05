/**
 * BUBA — Crear el pago en Pago TIC (segunda opción de cobro, apagada por defecto)
 *
 * La web manda el pedido (el mismo que a create-preference), esto crea el pago en
 * Pago TIC y devuelve { form_url, id }: la web manda al cliente a form_url para pagar.
 *
 *   POST /api/pagotic-crear   { order }
 *
 * No se manda `type` ni `presets`: el formulario de Pago TIC ofrece todos los medios habilitados
 * en la cuenta (tarjeta, transferencia, DEBIN, cupón de pago, etc.). Los que no se acreditan al
 * instante quedan "pending"/"issued" y el webhook los procesa recién cuando pasan a "approved".
 *
 * Variables: ver lib/pagotic.js y backend/README.md (sección "Pago TIC").
 * Opcional: SITE_URL → dirección de la tienda (si falta, la de la web que hizo la compra).
 *
 * Al volver del pago, el navegador del cliente cae en /api/pagotic-vuelta (por POST) y de ahí
 * a la tienda. El aviso que de verdad confirma el cobro llega a /api/pagotic-webhook.
 */
const { datosEnvio, datosCliente } = require("../lib/envio");
const { configurado, faltantes, crearPago, collectorId, limpiar } = require("../lib/pagotic");
const { faltaStock, itemsDePedido } = require("../lib/stock");

const MARCA = "BUBA Drinks";
// plazo para pagar: las transferencias y los cupones de pago en efectivo pueden tardar horas o días
const PLAZO_MS = 3 * 24 * 3600 * 1000;

const cors = (res, origin) => {
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

const redondear = (n) => Math.round(n * 100) / 100;

/** Fecha en el formato de Pago TIC: yyyy-MM-dd'T'HH:mm:ssZ, hora argentina (UTC-3, sin horario de verano). */
function fechaPagoTIC(ms) {
  const d = new Date(ms - 3 * 3600 * 1000); // los getUTC* de d son la hora de pared argentina
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}-0300`;
}

/** Nombre del pagador: solo letras y espacios (Pago TIC no acepta otra cosa). */
function nombrePagador(nombre) {
  const n = String(nombre || "").replace(/[^\p{L} ]/gu, " ").replace(/\s+/g, " ").trim();
  return (n || "Cliente BUBA").slice(0, 100);
}

/**
 * Líneas del pago. El descuento se reparte entre los productos como en create-preference
 * (Pago TIC no acepta importes negativos) y el centavo que deja el redondeo se ajusta en
 * la última línea de producto, así la suma de details da exactamente el total del pedido.
 */
function armarDetalle(order) {
  const prods = order.items.map((it) => ({
    id: String(it.id || ""),
    nombre: String(it.name || "Producto"),
    qty: Number(it.qty),
    bruto: Number(it.price) * Number(it.qty),
  }));
  const subtotal = prods.reduce((n, l) => n + l.bruto, 0);
  const descuento = Math.min(Math.max(Number(order.promo && order.promo.discount) || 0, 0), subtotal);
  const objetivo = redondear(subtotal - descuento);
  const factor = subtotal > 0 ? objetivo / subtotal : 1;
  const montos = prods.map((l) => redondear(l.bruto * factor));
  if (montos.length) montos[montos.length - 1] = redondear(montos[montos.length - 1] + (objetivo - montos.reduce((n, m) => n + m, 0)));

  const details = prods.map((l, i) => ({
    external_reference: l.id || order.code,
    concept_id: l.id,
    concept_description: `${MARCA} · ${l.nombre} × ${l.qty}`.slice(0, 250),
    amount: montos[i],
  }));
  const envio = order.shipping;
  if (envio && Number(envio.price) > 0) {
    details.push({
      external_reference: "envio",
      concept_id: "envio",
      concept_description: `${MARCA} · ${String(envio.name || "Envío")}`.slice(0, 250),
      amount: redondear(Number(envio.price)),
    });
  }
  return details;
}

function hostDe(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return host ? String(host) : "";
}

/** Body de POST /pagos. Función pura (la prueba la usa directo). */
function armarPago(order, { host, siteUrl, ahora = Date.now() }) {
  const code = String(order.code);
  const cod = encodeURIComponent(code);
  const venceMs = ahora + PLAZO_MS;
  const pago = {
    external_transaction_id: code,
    currency_id: "ARS",
    due_date: fechaPagoTIC(venceMs),
    last_due_date: fechaPagoTIC(venceMs),
    return_url: `https://${host}/api/pagotic-vuelta?pedido=${cod}`,
    back_url: `${siteUrl}/?pago=error&pedido=${cod}&proveedor=pagotic`,
    details: armarDetalle(order),
    payer: {
      name: nombrePagador(order.customer && order.customer.name),
      email: String((order.customer && order.customer.email) || "").trim(),
      external_reference: String((order.customer && order.customer.email) || code).trim().toLowerCase(),
    },
    metadata: { pedido: code, cliente: datosCliente(order), envio: datosEnvio(order), items: itemsDePedido(order) },
  };
  if (!pago.metadata.envio) delete pago.metadata.envio;
  if (host && !/localhost|127\.0\.0\.1/.test(host)) pago.notification_url = `https://${host}/api/pagotic-webhook`;
  if (collectorId()) pago.collector_id = collectorId();
  return pago;
}

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  cors(res, origin);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  if (!configurado()) {
    return res.status(500).json({
      error: "Falta configurar Pago TIC",
      ayuda: "En Vercel → Settings → Environment Variables agregá " + faltantes().join(", ") + " y volvé a deployar.",
    });
  }

  try {
    const { order } = req.body || {};
    if (!order || !order.code || !Array.isArray(order.items) || !order.items.length) {
      return res.status(400).json({ error: "El pedido llegó vacío" });
    }
    if (!order.items.every((it) => Number(it.qty) > 0 && Number(it.price) >= 0)) {
      return res.status(400).json({ error: "El pedido tiene productos con cantidad o precio inválido" });
    }
    // ¿alcanza el stock? (igual que en create-preference; si la base falla, no se frena la venta)
    const falta = await faltaStock(itemsDePedido(order));
    if (falta) return res.status(409).json({ error: "sin_stock", producto: falta.producto, disponible: falta.disponible });
    const host = hostDe(req);
    if (!host) return res.status(500).json({ error: "No se pudo saber la dirección del servidor de pagos" });
    const siteUrl = (process.env.SITE_URL || origin || "https://bubadrinks.com.ar").replace(/\/$/, "");

    const r = await crearPago(armarPago(order, { host, siteUrl }));
    const d = r.data;
    if (r.http >= 200 && r.http < 300 && d && d.form_url) {
      return res.status(200).json({ form_url: d.form_url, id: d.id });
    }
    const motivo = (d && (d.message || d.error_description || d.error || d.detail)) || r.texto || `HTTP ${r.http}`;
    console.error("[BUBA] Pago TIC no creó el pago:", { http: r.http, motivo: limpiar(motivo) });
    return res.status(502).json({
      error: limpiar(typeof motivo === "string" ? motivo : JSON.stringify(motivo)) || "Pago TIC rechazó el pago",
      http: r.http,
    });
  } catch (err) {
    console.error("[BUBA] Error creando el pago en Pago TIC:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

module.exports.armarPago = armarPago;
module.exports.fechaPagoTIC = fechaPagoTIC;
