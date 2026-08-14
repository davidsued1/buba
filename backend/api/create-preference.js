/**
 * BUBA backend — Crear preferencia de pago (Mercado Pago Checkout Pro)
 *
 * Función serverless para Vercel. Recibe la orden armada por la web,
 * crea una preferencia en Mercado Pago y devuelve el init_point
 * (la URL a la que se redirige al cliente para pagar).
 *
 * Variables de entorno necesarias (Vercel → Settings → Environment Variables):
 *   MP_ACCESS_TOKEN  → Access Token de producción de Mercado Pago
 *                      (Mercado Pago → Tu negocio → Configuración → Credenciales)
 *   SITE_URL         → URL pública de la tienda, ej: https://bubadrinks.com.ar
 */

const ALLOWED_ORIGINS = "*"; // ajustar a https://bubadrinks.com.ar al salir a producción

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const token = process.env.MP_ACCESS_TOKEN;
  const siteUrl = process.env.SITE_URL || "https://bubadrinks.com.ar";
  if (!token) return res.status(500).json({ error: "Falta configurar MP_ACCESS_TOKEN" });

  try {
    const { order } = req.body || {};
    if (!order?.items?.length) return res.status(400).json({ error: "Orden vacía" });

    const items = order.items.map((it) => ({
      title: String(it.name).slice(0, 250),
      quantity: Number(it.qty),
      unit_price: Number(it.price),
      currency_id: "ARS",
    }));
    if (order.shipping?.price > 0) {
      items.push({ title: "Envío — " + order.shipping.name, quantity: 1, unit_price: Number(order.shipping.price), currency_id: "ARS" });
    }
    if (order.promo?.discount > 0) {
      // MP no acepta ítems negativos: aplicamos el descuento prorrateado
      const factor = 1 - order.promo.discount / order.subtotal;
      items.forEach((it) => { if (!it.title.startsWith("Envío")) it.unit_price = Math.round(it.unit_price * factor); });
    }

    const preference = {
      items,
      external_reference: order.code,
      payer: {
        name: order.customer?.name,
        email: order.customer?.email,
        phone: { number: order.customer?.phone },
      },
      back_urls: {
        success: `${siteUrl}/?pago=ok&pedido=${order.code}`,
        pending: `${siteUrl}/?pago=pendiente&pedido=${order.code}`,
        failure: `${siteUrl}/?pago=error&pedido=${order.code}`,
      },
      auto_return: "approved",
      notification_url: `${siteUrl.includes("localhost") ? "" : deriveWebhookUrl(req)}`,
      statement_descriptor: "BUBA DRINKS",
    };
    if (!preference.notification_url) delete preference.notification_url;

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(preference),
    });
    const data = await mpRes.json();
    if (!mpRes.ok) return res.status(502).json({ error: "Mercado Pago rechazó la preferencia", detail: data });

    return res.status(200).json({ init_point: data.init_point, preference_id: data.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

function deriveWebhookUrl(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return host ? `https://${host}/api/mp-webhook` : "";
}
