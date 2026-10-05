/**
 * BUBA backend — Webhook de Mercado Pago
 *
 * Mercado Pago llama a esta URL cuando cambia el estado de un pago.
 * Consultamos el pago y dejamos registrado el resultado en los logs.
 *
 * Si el pago está aprobado y el pedido es con envío a domicilio, crea la
 * guía en Fast Mail (e-Presis). Solo si FASTMAIL_AUTO = "si" (apagado por
 * defecto). Ver backend/README.md y docs/10_API_Presis.md.
 *
 * Además avisa por mail (Resend) de cada venta aprobada, con la etiqueta de
 * Fast Mail adjunta si se creó la guía. Ver backend/lib/mail.js.
 */
const { presis, etiqueta, configurado } = require("../lib/presis");
const { enviarMail, mailConfigurado } = require("../lib/mail");
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

/** Crea la guía en Fast Mail. Devuelve { estado: "creada", guia } | "apagada" | "ya_existia" | "error" (con motivo). */
async function crearGuia(pago) {
  const envio = pago.metadata.envio;
  const pedido = pago.external_reference || envio.pedido;
  const remito = String(pago.id);

  if (process.env.FASTMAIL_AUTO !== "si") {
    console.log("[BUBA] Envío NO creado (FASTMAIL_AUTO apagado)", pedido, remito);
    return { estado: "apagada" };
  }

  // MP puede avisar varias veces el mismo pago: si el remito ya existe en Fast Mail, no se duplica.
  // (Dos avisos simultáneos podrían pasar los dos este control; Fast Mail no documenta si rechaza remitos repetidos.)
  const previo = await presis("api/v2/seguimiento.json", { remito });
  if (remitoYaExiste(previo.data)) {
    console.log("[BUBA] Envío ya existía en Fast Mail, no se duplica", pedido, remito);
    return { estado: "ya_existia" };
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
    return { estado: "creada", guia: String(item.guia) };
  }
  const motivo = (item && item.message) || (r.data && r.data.message) || r.texto || "respuesta inesperada";
  console.error("[BUBA] Fast Mail no creó la guía", { pedido, remito, http: r.http, motivo });
  return { estado: "error", motivo: String(motivo) };
}

// ---------- mail de venta ----------

const esc = (v) =>
  String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const pesos = (n) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });

function fechaAR(pago) {
  const d = new Date(pago.date_approved || pago.date_created || Date.now());
  const f = isNaN(d) ? new Date() : d;
  return f.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }) + " hs";
}

/** Link de WhatsApp si el número parece un celular argentino; si no, null. */
function linkWhatsapp(tel) {
  let d = String(tel || "").replace(/\D/g, "");
  if (d.startsWith("54")) { d = d.slice(2); if (d.startsWith("9") && d.length === 11) d = d.slice(1); }
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length !== 10) {
    // con el 15 de celular: área (2 a 4 dígitos) + 15 + número = 10 dígitos sin el 15
    for (const area of [2, 3, 4]) {
      if (d.length === 12 && d.slice(area, area + 2) === "15") { d = d.slice(0, area) + d.slice(area + 2); break; }
    }
  }
  return d.length === 10 ? `https://wa.me/549${d}` : null;
}

/** Cuadro "Fast Mail" según cómo salió el envío → { titulo, texto } */
function avisoEnvio(envioRes) {
  switch (envioRes.estado) {
    case "creada":
      return { color: "#1f7a3d", fondo: "#e8f6ed", texto: `Guía Nº ${envioRes.guia}` + (envioRes.conEtiqueta ? " — etiqueta adjunta, imprimila y pegala en la caja." : ". No pudimos adjuntar la etiqueta: bajala desde fastmail.com.ar.") };
    case "apagada":
      return { color: "#9a6700", fondo: "#fff6df", texto: "La guía automática está apagada: cargá el envío a mano en fastmail.com.ar." };
    case "error":
      return { color: "#b42318", fondo: "#fdecea", texto: `Fast Mail no creó la guía (${envioRes.motivo || "motivo desconocido"}). Cargalo a mano en fastmail.com.ar.` };
    case "retiro":
      return { color: "#1d1d1f", fondo: "#f2f2f4", texto: "Retiro en persona: coordiná con el cliente por WhatsApp." };
    default:
      return { color: "#9a6700", fondo: "#fff6df", texto: "Fast Mail no está configurado en el servidor: cargá el envío a mano en fastmail.com.ar." };
  }
}

/** Arma { asunto, html, texto } del aviso de venta. */
function armarMailVenta(pago, envioRes) {
  const md = pago.metadata || {};
  const env = md.envio || null;
  const cli = md.cliente || {};
  const payer = pago.payer || {};
  const payerNombre = [payer.first_name, payer.last_name].filter(Boolean).join(" ");
  const payerTel = payer.phone && (payer.phone.number ? `${payer.phone.area_code || ""}${payer.phone.number}` : "");

  const pedido = pago.external_reference || cli.pedido || (env && env.pedido) || `pago ${pago.id}`;
  const monto = pesos(pago.transaction_amount);
  const nombre = cli.nombre || (env && env.nombre) || payerNombre || "";
  const email = cli.email || (env && env.email) || payer.email || "";
  const telefono = cli.telefono || (env && env.telefono) || payerTel || "";
  const wa = linkWhatsapp(telefono);
  const cuotas = Number(pago.installments) || 1;
  const medio = `${pago.payment_method_id || "—"} · ${cuotas} cuota${cuotas === 1 ? "" : "s"}`;
  const items = (pago.additional_info && Array.isArray(pago.additional_info.items) ? pago.additional_info.items : [])
    .map((it) => `${it.title || it.id || "Producto"} × ${it.quantity || 1} — $${pesos(it.unit_price)}`);

  const envioLinea = cli.envio_nombre || cli.metodo_envio
    ? `${cli.envio_nombre || cli.metodo_envio}${Number(cli.envio_precio) > 0 ? ` — $${pesos(cli.envio_precio)}` : Number(cli.envio_precio) === 0 ? " — sin costo" : ""}`
    : (env ? "Envío a domicilio" : "Retiro en persona");
  const direccion = env
    ? [
        ["Calle", env.calle], ["Piso/Depto", env.piso_depto], ["Ciudad", env.ciudad],
        ["Provincia", env.provincia], ["CP", env.cp], ["Notas", env.notas || cli.notas],
        ["Bultos", env.bultos],
      ].filter(([, v]) => v !== "" && v != null)
    : [];

  const aviso = avisoEnvio(envioRes);
  const asunto = `🟢 Nueva venta BUBA — ${pedido} — $${monto}`;

  // texto plano
  const t = [
    `NUEVA VENTA BUBA`,
    ``,
    `Pedido: ${pedido}`,
    `Fecha: ${fechaAR(pago)}`,
    `Total: $${monto}`,
    `Medio de pago: ${medio}`,
    `ID de pago de Mercado Pago: ${pago.id}`,
  ];
  if (items.length) t.push(``, `PRODUCTOS`, ...items.map((i) => `- ${i}`));
  t.push(``, `CLIENTE`, `Nombre: ${nombre || "—"}`, `Email: ${email || "—"}`, `Teléfono: ${telefono || "—"}`);
  if (wa) t.push(`WhatsApp: ${wa}`);
  t.push(``, `ENVÍO`, envioLinea);
  for (const [k, v] of direccion) t.push(`${k}: ${v}`);
  t.push(``, `FAST MAIL`, aviso.texto, ``, `Despacho: día hábil siguiente a la compra.`);

  // html
  const fila = (k, v) => `<tr><td style="padding:4px 12px 4px 0;color:#6e6e73;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;color:#1d1d1f">${v}</td></tr>`;
  const h2 = (x) => `<h2 style="margin:22px 0 6px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#6e6e73">${x}</h2>`;
  const tabla = (filas) => `<table role="presentation" style="border-collapse:collapse;font-size:15px;width:100%">${filas.join("")}</table>`;
  const h = `<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#f5f5f7">
<div style="max-width:560px;margin:0 auto;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="background:#ffffff;border-radius:14px;padding:20px">
<h1 style="margin:0 0 4px;font-size:20px;color:#1d1d1f">🟢 Nueva venta BUBA</h1>
<p style="margin:0 0 12px;font-size:28px;font-weight:700;color:#1d1d1f">$${esc(monto)}</p>
${tabla([
  fila("Pedido", `<strong>${esc(pedido)}</strong>`),
  fila("Fecha", esc(fechaAR(pago))),
  fila("Medio de pago", esc(medio)),
  fila("ID de pago MP", esc(pago.id)),
])}
${items.length ? h2("Productos") + `<ul style="margin:0;padding-left:18px;font-size:15px;color:#1d1d1f">${items.map((i) => `<li style="margin:2px 0">${esc(i)}</li>`).join("")}</ul>` : ""}
${h2("Cliente")}
${tabla([
  fila("Nombre", esc(nombre || "—")),
  fila("Email", email ? `<a href="mailto:${esc(email)}" style="color:#0066cc">${esc(email)}</a>` : "—"),
  fila("Teléfono", wa ? `<a href="${esc(wa)}" style="color:#0066cc">${esc(telefono)}</a> (WhatsApp)` : esc(telefono || "—")),
])}
${h2("Envío")}
${tabla([fila("Método", esc(envioLinea)), ...direccion.map(([k, v]) => fila(k, esc(v)))])}
${h2("Fast Mail")}
<div style="background:${aviso.fondo};color:${aviso.color};border-radius:10px;padding:12px 14px;font-size:15px;line-height:1.4">${esc(aviso.texto)}</div>
<p style="margin:20px 0 0;font-size:13px;color:#6e6e73">Despacho: día hábil siguiente a la compra.</p>
</div></div></body></html>`;

  return { asunto, html: h, texto: t.join("\n") };
}

/** Paso 1: guía de Fast Mail. Nunca lanza. { estado, guia?, motivo?, etiqueta? } */
async function resolverEnvio(pago) {
  if (!(pago.metadata && pago.metadata.envio)) return { estado: "retiro" };
  if (!configurado()) return { estado: "sin_configurar" };
  let res;
  try { res = await crearGuia(pago); }
  catch (err) {
    const motivo = err.name === "AbortError" ? "Fast Mail no respondió a tiempo" : err.message;
    console.error("[BUBA] Error creando el envío en Fast Mail:", motivo);
    return { estado: "error", motivo };
  }
  // la etiqueta solo sirve para adjuntarla al mail: sin mail configurado no se pide
  if (res.estado === "creada" && mailConfigurado()) {
    try { res.etiqueta = await etiqueta(res.guia); }
    catch (err) { console.error("[BUBA] Error bajando la etiqueta:", err.message); }
    if (!res.etiqueta) console.error("[BUBA] No se pudo bajar la etiqueta de la guía", res.guia);
  }
  return res;
}

/** Paso 2: mail de aviso. Nunca lanza. */
async function avisarVenta(pago, envioRes) {
  // segundo aviso del mismo pago: el primero ya mandó el mail
  if (envioRes.estado === "ya_existia" || !mailConfigurado()) return;
  try {
    const m = armarMailVenta(pago, { ...envioRes, conEtiqueta: !!envioRes.etiqueta });
    const r = await enviarMail({
      asunto: m.asunto,
      html: m.html,
      texto: m.texto,
      adjuntos: envioRes.etiqueta ? [envioRes.etiqueta] : [],
      idempotencia: "venta-" + pago.id,
    });
    console.log("[BUBA] Mail de venta", { ok: r.ok, id: r.id, error: r.error });
  } catch (err) {
    console.error("[BUBA] Error armando el mail de venta:", err.message);
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
        if (pago.status === "approved") {
          const envioRes = await resolverEnvio(pago);
          await avisarVenta(pago, envioRes);
        }
      }
    }
  } catch (err) {
    console.error("[BUBA] Error en webhook:", err.message);
  }
  // Siempre 200 para que MP no reintente infinitamente
  res.status(200).json({ ok: true });
};
