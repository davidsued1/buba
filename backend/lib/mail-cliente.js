/**
 * BUBA — Mail de confirmación de pedido para el CLIENTE (funciones puras, sin red)
 *
 * armarMailCliente(pago, envioRes) → { asunto, html, texto }
 *
 * Se manda después de un pago aprobado de Mercado Pago (ver api/mp-webhook.js).
 * pago: el pago tal cual lo devuelve Mercado Pago (con metadata.cliente / metadata.envio).
 * envioRes: resultado del paso de Fast Mail ({ estado: "creada", guia } | "retiro" | ...).
 */
const { COLOR, esc, raw, layout, seccion, boton, botonesApilados, bloqueTexto, tablaCompra, logoCabecera, franjaColores } = require("./plantilla-mail");

const FASTMAIL_URL = "https://www.fastmail.com.ar";
const WHATSAPP = "5491161143631";
const INSTAGRAM = "https://instagram.com/buba.drinks";
const VERDE_WA = "#25d366";

const pesos = (n) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
const mon = (n) => `$${pesos(n)}`;

const MEDIOS = {
  visa: "Visa", master: "Mastercard", amex: "American Express", debvisa: "Visa débito", debmaster: "Mastercard débito",
  account_money: "Dinero en Mercado Pago", naranja: "Naranja", cabal: "Cabal", maestro: "Maestro",
  rapipago: "Rapipago", pagofacil: "Pago Fácil",
};
// medios donde "en 1 cuota" suena raro: se omite cuando es una sola
const SIN_CUOTAS = new Set(["debvisa", "debmaster", "maestro", "account_money", "rapipago", "pagofacil"]);
const medioLegible = (id) => MEDIOS[String(id || "").toLowerCase()] || String(id || "") || "medio no informado";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** true si parece un mail (no valida que exista). */
const emailValido = (e) => typeof e === "string" && e.length <= 254 && /^[^\s@<>,;"']+@[^\s@<>,;"']+\.[^\s@<>,;"']+$/.test(e.trim());

/** Mail del comprador: metadata.cliente.email → metadata.envio.email → payer.email (el primero que parezca válido). "" si ninguno. */
function emailCliente(pago) {
  const md = (pago && pago.metadata) || {};
  const candidatos = [md.cliente && md.cliente.email, md.envio && md.envio.email, pago && pago.payer && pago.payer.email];
  const e = candidatos.find((c) => emailValido(c));
  return e ? e.trim() : "";
}

/** Primer día hábil (lun a vie, sin feriados) estrictamente posterior a la fecha del pago, en hora argentina → "lunes 12/10". */
function fechaDespacho(pago) {
  const d = new Date((pago && (pago.date_approved || pago.date_created)) || Date.now());
  const base = isNaN(d) ? new Date() : d;
  const partes = {};
  for (const p of new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(base)) partes[p.type] = p.value;
  const f = new Date(Date.UTC(+partes.year, +partes.month - 1, +partes.day));
  do { f.setUTCDate(f.getUTCDate() + 1); } while (f.getUTCDay() === 0 || f.getUTCDay() === 6);
  return `${DIAS[f.getUTCDay()]} ${f.getUTCDate()}/${f.getUTCMonth() + 1}`;
}

/** Arma { asunto, html, texto } del mail de confirmación para el cliente. */
function armarMailCliente(pago, envioRes = {}) {
  const site = (process.env.SITE_URL || "https://bubadrinks.com.ar").replace(/\/$/, "");
  const md = pago.metadata || {};
  const env = md.envio || null;
  const cli = md.cliente || {};
  const payer = pago.payer || {};
  const pedido = pago.external_reference || cli.pedido || (env && env.pedido) || `pago ${pago.id}`;
  const nombre = String(cli.nombre || (env && env.nombre) || [payer.first_name, payer.last_name].filter(Boolean).join(" ") || "").trim();
  const primerNombre = nombre.split(/\s+/)[0] || "";
  const total = mon(pago.transaction_amount);
  const entrega = !!env && envioRes.estado !== "retiro";
  const despacho = fechaDespacho(pago);
  const cuotas = Number(pago.installments) || 1;
  const medioId = String(pago.payment_method_id || "").toLowerCase();
  const pagoFrase =
    `Pagaste con ${medioLegible(pago.payment_method_id)}` +
    (cuotas > 1 || !SIN_CUOTAS.has(medioId) ? ` en ${cuotas} cuota${cuotas === 1 ? "" : "s"}` : "");

  // ----- productos (el envío, si vino como ítem, va en su propia fila)
  const todos = pago.additional_info && Array.isArray(pago.additional_info.items) ? pago.additional_info.items : [];
  const esEnvio = (it) => String(it.id || "") === "envio" || /env[ií]o/i.test(String(it.title || ""));
  const subtotal = (it) => (Number(it.quantity) || 1) * (Number(it.unit_price) || 0);
  const items = todos.filter((it) => !esEnvio(it)).map((it) => ({
    nombre: String(it.title || it.id || "Producto").replace(/^BUBA Drinks\s*·\s*(?=\S)/i, ""),
    cant: `× ${Number(it.quantity) || 1}`,
    subtotal: mon(subtotal(it)),
  }));
  const itemsEnvio = todos.filter(esEnvio);
  const precioEnvio = itemsEnvio.length ? itemsEnvio.reduce((n, it) => n + subtotal(it), 0) : Number(cli.envio_precio);
  const hayPrecioEnvio = itemsEnvio.length > 0 || cli.envio_precio != null;
  const filaEnvio = !entrega
    ? [["Envío", "Retiro en persona"]]
    : hayPrecioEnvio ? [["Envío", precioEnvio > 0 ? mon(precioEnvio) : "Sin costo"]] : [];

  const lineasDir = env
    ? [env.calle, env.piso_depto ? `Piso/Depto: ${env.piso_depto}` : "", [env.ciudad, env.provincia].filter(Boolean).join(", "), env.cp ? `CP ${env.cp}` : ""].filter(Boolean)
    : [];
  const guia = envioRes.estado === "creada" && envioRes.guia ? String(envioRes.guia) : "";

  const asunto = `¡Gracias por tu compra! Pedido ${pedido} · BUBA Drinks`;
  const preheader = `Pedido ${pedido} confirmado · ${entrega ? `Sale el ${despacho}` : "Retiro en persona"} · Total ${total}`;
  const mensajeWa = `Hola BUBA! Tengo una consulta por mi pedido ${pedido}`;
  const urlWa = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensajeWa)}`;
  const saludo = primerNombre ? `¡Gracias por tu compra, ${primerNombre}!` : "¡Gracias por tu compra!";

  // ----- texto plano
  const t = [saludo, "Tu pedido está confirmado y ya lo estamos preparando.", `Pedido ${pedido}`, "", "TU PEDIDO"];
  if (items.length) for (const it of items) t.push(`- ${it.nombre} ${it.cant} — ${it.subtotal}`);
  for (const [k, v] of filaEnvio) t.push(`${k}: ${v}`);
  t.push(`TOTAL: ${total}`, `${pagoFrase}.`, "", "CUÁNDO LLEGA");
  if (entrega) {
    t.push(`Lo armamos y sale el ${despacho}.`, "Te llega con Fast Mail en 24 hs hábiles desde que sale.", "", ...lineasDir);
    if (guia) t.push("", `Tu número de seguimiento: ${guia}`, `Seguir mi envío: ${FASTMAIL_URL}`);
  } else {
    t.push("Elegiste retiro en persona: te escribimos por WhatsApp para coordinar día y hora.");
  }
  t.push("", "¿DUDAS?", "Escribinos y te ayudamos.", `WhatsApp: ${urlWa}`, `Instagram: ${INSTAGRAM}`, "", "BUBA Drinks · Hecho en Argentina · bubadrinks.com.ar", "Beber con moderación. Prohibida su venta a menores de 18 años.");

  // ----- html
  const hero =
    logoCabecera(site) +
    `<div style="margin:18px 0 0">${franjaColores()}</div>` +
    `<div style="padding:30px 0 6px;text-align:center">` +
    `<div style="font-size:30px;line-height:36px;font-weight:700;letter-spacing:-.02em;color:${COLOR.texto}">${esc(saludo)}</div>` +
    `<div style="margin:12px 0 0;font-size:17px;line-height:25px;color:${COLOR.gris}">Tu pedido está confirmado y ya lo estamos preparando.</div>` +
    `<div style="margin:20px 0 0"><span style="display:inline-block;background:${COLOR.fondo};border:1px solid ${COLOR.linea};color:${COLOR.texto};border-radius:999px;padding:7px 16px;font-size:14px;line-height:20px;font-weight:600;letter-spacing:.02em">Pedido ${esc(pedido)}</span></div>` +
    `</div>`;

  const compra =
    tablaCompra({ items, extras: filaEnvio, total }) +
    `<div style="margin:16px 0 0;font-size:14px;line-height:20px;color:${COLOR.gris}">${esc(pagoFrase)}</div>`;

  const cuando = entrega
    ? `<div style="font-size:19px;line-height:26px;font-weight:700;letter-spacing:-.01em;color:${COLOR.texto}">Lo armamos y sale el ${esc(despacho)}</div>` +
      `<div style="margin:6px 0 16px;font-size:15px;line-height:22px;color:${COLOR.gris}">Te llega con Fast Mail en 24 hs hábiles desde que sale.</div>` +
      bloqueTexto(lineasDir) +
      (guia
        ? `<div style="margin:18px 0 0;font-size:14px;line-height:20px;color:${COLOR.gris}">Tu número de seguimiento</div>` +
          `<div style="margin:2px 0 14px;font-size:20px;line-height:26px;font-weight:700;letter-spacing:.02em;color:${COLOR.texto};word-break:break-all">${esc(guia)}</div>` +
          boton("Seguir mi envío", FASTMAIL_URL, COLOR.oscuro)
        : "")
    : `<div style="font-size:19px;line-height:26px;font-weight:700;letter-spacing:-.01em;color:${COLOR.texto}">Retiro en persona</div>` +
      `<div style="margin:6px 0 0;font-size:15px;line-height:22px;color:${COLOR.gris}">Elegiste retiro en persona: te escribimos por WhatsApp para coordinar día y hora.</div>`;

  const dudas =
    `<div style="margin:0 0 16px;font-size:15px;line-height:22px;color:${COLOR.gris}">Escribinos y te ayudamos enseguida. Sos parte de la edición limitada de lanzamiento de BUBA: ¡que la disfrutes!</div>` +
    botonesApilados([boton("Escribinos por WhatsApp", urlWa, VERDE_WA), boton("Instagram", INSTAGRAM, COLOR.oscuro)]);

  const html = layout({
    titulo: `Tu pedido BUBA ${pedido}`,
    preheader,
    cabecera: hero,
    secciones: [seccion("Tu pedido", compra), seccion("Cuándo llega", cuando), seccion("¿Dudas?", dudas)],
    pie: raw(`BUBA Drinks · Hecho en Argentina · bubadrinks.com.ar<br>Beber con moderación. Prohibida su venta a menores de 18 años.`),
  });

  return { asunto, html, texto: t.join("\n") };
}

module.exports = { armarMailCliente, emailCliente, emailValido, fechaDespacho, medioLegible };
