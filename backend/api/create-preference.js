/**
 * BUBA — Crear el pago en Mercado Pago (Checkout Pro)
 *
 * La web manda el pedido, esto crea la preferencia en Mercado Pago y
 * devuelve el link al que se manda al cliente para pagar. Habilita todos
 * los medios: tarjeta de crédito y débito, dinero en cuenta, transferencia
 * y efectivo (Rapipago / Pago Fácil), con cuotas.
 *
 * Única variable obligatoria (Vercel → Settings → Environment Variables):
 *   MP_ACCESS_TOKEN → Access Token de producción de Mercado Pago
 *
 * Opcional:
 *   SITE_URL → dirección de la tienda. Si no se define, se toma sola del
 *              pedido que llega desde la web.
 */

const cors = (res, origin) => {
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  cors(res, origin);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    return res.status(500).json({
      error: "Falta el Access Token de Mercado Pago",
      ayuda: "En Vercel → Settings → Environment Variables agregá MP_ACCESS_TOKEN y volvé a deployar.",
    });
  }

  try {
    const { order } = req.body || {};
    if (!order?.items?.length) return res.status(400).json({ error: "El pedido llegó vacío" });

    // la tienda: la que se configure, o la que hizo la compra
    const siteUrl = (process.env.SITE_URL || origin || "https://davidsued1.github.io/buba").replace(/\/$/, "");

    const items = order.items.map((it) => ({
      id: String(it.id || ""),
      title: String(it.name).slice(0, 250),
      quantity: Number(it.qty),
      unit_price: Number(it.price),
      currency_id: "ARS",
    }));

    // el descuento se reparte entre los productos (Mercado Pago no acepta importes negativos)
    if (order.promo?.discount > 0 && order.subtotal > 0) {
      const factor = 1 - order.promo.discount / order.subtotal;
      items.forEach((it) => { it.unit_price = Math.round(it.unit_price * factor * 100) / 100; });
    }
    if (order.shipping?.price > 0) {
      items.push({
        id: "envio",
        title: "Envío — " + order.shipping.name,
        quantity: 1,
        unit_price: Number(order.shipping.price),
        currency_id: "ARS",
      });
    }

    const [nombre, ...resto] = String(order.customer?.name || "").trim().split(" ");
    const dir = order.customer?.address || {};

    const preference = {
      items,
      external_reference: order.code,
      statement_descriptor: "BUBA DRINKS",
      payer: {
        name: nombre || undefined,
        surname: resto.join(" ") || undefined,
        email: order.customer?.email || undefined,
        phone: order.customer?.phone ? { number: String(order.customer.phone) } : undefined,
        address: dir.street ? { street_name: dir.street, zip_code: String(dir.cp || "") } : undefined,
      },
      // todos los medios habilitados, hasta 12 cuotas
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [],
        installments: 12,
      },
      back_urls: {
        success: `${siteUrl}/?pago=ok&pedido=${order.code}`,
        pending: `${siteUrl}/?pago=pendiente&pedido=${order.code}`,
        failure: `${siteUrl}/?pago=error&pedido=${order.code}`,
      },
      auto_return: "approved",
      notification_url: webhookUrl(req),
      metadata: { pedido: order.code, total: order.total },
    };
    if (!preference.notification_url) delete preference.notification_url;

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": order.code,
      },
      body: JSON.stringify(preference),
    });
    const data = await mpRes.json();

    if (!mpRes.ok) {
      console.error("[BUBA] Mercado Pago rechazó:", data);
      return res.status(502).json({
        error: data.message || "Mercado Pago rechazó el pago",
        detail: data,
      });
    }

    return res.status(200).json({ init_point: data.init_point, preference_id: data.id });
  } catch (err) {
    console.error("[BUBA] Error creando la preferencia:", err);
    return res.status(500).json({ error: err.message });
  }
};

function webhookUrl(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return host && !/localhost/.test(host) ? `https://${host}/api/mp-webhook` : "";
}
