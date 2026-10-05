/**
 * BUBA backend — Webhook de Mercado Pago
 *
 * Mercado Pago llama a esta URL cuando cambia el estado de un pago.
 * Consultamos el pago y dejamos registrado el resultado en los logs.
 *
 * Si el pago está aprobado y el pedido es con envío a domicilio, crea la
 * guía en Fast Mail (e-Presis). Solo si FASTMAIL_AUTO = "si" (apagado por
 * defecto). Ver backend/README.md y docs/10_API_Presis.md.
 */
const { presis, configurado } = require("../lib/presis");
const { armarGuia } = require("../lib/envio");

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

// DUDA: no sabemos qué devuelve seguimiento.json cuando el remito no existe. Según el plugin,
// existe si trae status "ok" y guia; si no sabemos, cualquier objeto/array con contenido que no sea error cuenta como "existe".
function remitoYaExiste(data) {
  if (!data || typeof data !== "object") return false;
  if (Array.isArray(data)) return data.length > 0 && !(data[0] && data[0].message && !data[0].guia);
  if (data.status === "ok" || data.guia) return true;
  if (data.message || data.status) return false;
  return Object.keys(data).length > 0;
}

async function crearGuia(pago) {
  const envio = pago.metadata.envio;
  const pedido = pago.external_reference || envio.pedido;
  const remito = String(pago.id);

  if (process.env.FASTMAIL_AUTO !== "si") {
    console.log("[BUBA] Envío NO creado (FASTMAIL_AUTO apagado)", pedido, remito);
    return;
  }

  // MP puede avisar varias veces el mismo pago: si el remito ya existe en Fast Mail, no se duplica.
  // (Dos avisos simultáneos podrían pasar los dos este control; Fast Mail no documenta si rechaza remitos repetidos.)
  const previo = await presis("api/v2/seguimiento.json", { remito });
  if (remitoYaExiste(previo.data)) {
    console.log("[BUBA] Envío ya existía en Fast Mail, no se duplica", pedido, remito);
    return;
  }

  const r = await presis(
    "api/v2/multi-guias.json",
    armarGuia(envio, {
      remito,
      codigoServicio: process.env.FASTMAIL_SERVICIO || "24",
      cpOrigen: process.env.FASTMAIL_CP,
      sucursal: process.env.FASTMAIL_SUCURSAL,
    })
  );
  const item = Array.isArray(r.data) ? r.data[0] : null;
  if (item && item.guia) {
    console.log("[BUBA] Guía Fast Mail creada", { pedido, remito, guia: item.guia });
  } else {
    const motivo = (item && item.message) || (r.data && r.data.message) || r.texto || "respuesta inesperada";
    console.error("[BUBA] Fast Mail no creó la guía", { pedido, remito, http: r.http, motivo });
  }
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
        if (pago.status === "approved" && pago.metadata && pago.metadata.envio && configurado()) {
          try { await crearGuia(pago); }
          catch (err) {
            console.error("[BUBA] Error creando el envío en Fast Mail:", err.name === "AbortError" ? "Fast Mail no respondió a tiempo" : err.message);
          }
        }
      }
    }
  } catch (err) {
    console.error("[BUBA] Error en webhook:", err.message);
  }
  // Siempre 200 para que MP no reintente infinitamente
  res.status(200).json({ ok: true });
};
