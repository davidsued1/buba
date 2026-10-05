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
 *
 * Con cada venta aprobada también guarda el mail del comprador en los contactos
 * de Resend (para novedades). Ver backend/lib/contactos.js.
 *
 * Si la plata vuelve (reembolso total, parcial o contracargo) manda un segundo
 * mail de recordatorio para dar de baja la guía de Fast Mail a mano. No anula
 * nada solo. Los pagos cancelados o rechazados no hacen nada (nunca se aprobaron).
 */
const { presis, etiqueta, configurado } = require("../lib/presis");
const { enviarMail, mailConfigurado } = require("../lib/mail");
const { armarGuia, esFalso } = require("../lib/envio");
const { guardarContacto } = require("../lib/contactos");
const { COLOR, esc, raw, layout, cabecera, seccion, filas, boton, botones, aviso, bloqueTexto, tablaCompra } = require("../lib/plantilla-mail");

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

const pesos = (n) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
const mon = (n) => `$${pesos(n)}`;

function fechaAR(pago) {
  const d = new Date(pago.date_approved || pago.date_created || Date.now());
  const f = isNaN(d) ? new Date() : d;
  return f.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).replace(", ", " ") + "\u00a0hs";
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

const MEDIOS = {
  visa: "Visa", master: "Mastercard", amex: "American Express", debvisa: "Visa débito", debmaster: "Mastercard débito",
  account_money: "Dinero en Mercado Pago", naranja: "Naranja", cabal: "Cabal", maestro: "Maestro",
  rapipago: "Rapipago", pagofacil: "Pago Fácil",
};
/** "visa" → "Visa". Si no lo conocemos, el id tal cual. */
const medioLegible = (id) => MEDIOS[String(id || "").toLowerCase()] || String(id || "") || "medio no informado";

/** Datos del pedido y del cliente, con respaldo en los datos del pagador de Mercado Pago. */
function datosPago(pago) {
  const md = pago.metadata || {};
  const env = md.envio || null;
  const cli = md.cliente || {};
  const payer = pago.payer || {};
  const payerNombre = [payer.first_name, payer.last_name].filter(Boolean).join(" ");
  const payerTel = payer.phone && (payer.phone.number ? `${payer.phone.area_code || ""}${payer.phone.number}` : "");
  const telefono = cli.telefono || (env && env.telefono) || payerTel || "";
  return {
    env, cli,
    pedido: pago.external_reference || cli.pedido || (env && env.pedido) || `pago ${pago.id}`,
    nombre: cli.nombre || (env && env.nombre) || payerNombre || "",
    email: cli.email || (env && env.email) || payer.email || "",
    telefono,
    wa: linkWhatsapp(telefono),
    envioNombre: cli.envio_nombre || cli.metodo_envio || (env ? "Envío a domicilio" : "Retiro en persona"),
    eta: cli.envio_eta || "",
    novedades: !esFalso(cli.marketing),
  };
}

/** Tarjeta "Cliente": nombre, botones de WhatsApp y mail, y datos de contacto. Devuelve { html, texto }. */
function tarjetaCliente(d, { novedades }) {
  const mensaje = `¡Hola${d.nombre ? " " + d.nombre : ""}! Te escribimos de BUBA por tu pedido ${d.pedido}.`;
  const bWa = d.wa ? boton("WhatsApp", `${d.wa}?text=${encodeURIComponent(mensaje)}`, COLOR.whatsapp) : "";
  const bMail = d.email ? boton("Mail", `mailto:${encodeURI(d.email)}?subject=${encodeURIComponent("Tu pedido BUBA " + d.pedido)}`, COLOR.oscuro) : "";
  const botonesHtml = botones([bWa, bMail]);
  const rows = [
    ["Email", d.email ? raw(`<a href="mailto:${esc(encodeURI(d.email))}" style="color:#0066cc;text-decoration:none">${esc(d.email)}</a>`) : "—"],
    ["Teléfono", d.telefono || "—"],
  ];
  if (novedades) rows.push(["Novedades por mail", d.novedades ? "Sí, quiere recibir" : "No"]);
  const html =
    `<div style="margin:0 0 ${botonesHtml ? 14 : 8}px;font-size:18px;line-height:24px;font-weight:700;color:${COLOR.texto}">${esc(d.nombre || "—")}</div>` +
    (botonesHtml ? `<div style="margin:0 0 10px">${botonesHtml}</div>` : "") +
    filas(rows);
  const texto = [d.nombre || "—", `Email: ${d.email || "—"}`, `Teléfono: ${d.telefono || "—"}`];
  if (d.wa) texto.push(`WhatsApp: ${d.wa}`);
  if (novedades) texto.push(`Novedades por mail: ${d.novedades ? "Sí, quiere recibir" : "No"}`);
  return { html, texto };
}

/** Cuadro "Fast Mail" según cómo salió el envío → { tipo, titulo, texto } */
function avisoEnvio(envioRes) {
  switch (envioRes.estado) {
    case "creada":
      return {
        tipo: "ok", titulo: "Guía creada",
        texto: `Guía Nº ${envioRes.guia} · ` + (envioRes.conEtiqueta ? "Etiqueta adjunta: imprimila y pegala en la caja." : "No pudimos adjuntar la etiqueta: bajala desde fastmail.com.ar."),
      };
    case "apagada":
      return { tipo: "warn", titulo: "Guía automática apagada", texto: "La guía automática está apagada. Cargá el envío a mano en fastmail.com.ar." };
    case "error":
      return { tipo: "error", titulo: "No se pudo crear la guía", texto: `Fast Mail no creó la guía (${envioRes.motivo || "motivo desconocido"}). Cargalo a mano en fastmail.com.ar.` };
    case "retiro":
      return { tipo: "info", titulo: "Sin envío", texto: "Retiro en persona: coordiná con el cliente por WhatsApp." };
    default:
      return { tipo: "warn", titulo: "Fast Mail sin configurar", texto: "Fast Mail no está configurado en el servidor. Cargá el envío a mano en fastmail.com.ar." };
  }
}

const FASTMAIL_URL = "https://www.fastmail.com.ar";
/** Tarjeta "Fast Mail": cuadro de color y, si hay envío, botón para abrir Fast Mail. */
const tarjetaFastMail = (av, conBoton) =>
  seccion("🚚 Fast Mail", aviso(av.texto, av.tipo, av.titulo) + (conBoton ? `<div style="margin:14px 0 0">${boton("Abrir Fast Mail", FASTMAIL_URL, COLOR.oscuro)}</div>` : ""));

/** Arma { asunto, html, texto } del aviso de venta. */
function armarMailVenta(pago, envioRes) {
  const d = datosPago(pago);
  const { env, cli } = d;
  const total = mon(pago.transaction_amount);
  const fecha = fechaAR(pago);
  const cuotas = Number(pago.installments) || 1;
  const pagoFrase = `Pagó con ${medioLegible(pago.payment_method_id)} en ${cuotas} cuota${cuotas === 1 ? "" : "s"}`;

  // productos (el envío, si vino como ítem, va en su propia fila)
  const todos = pago.additional_info && Array.isArray(pago.additional_info.items) ? pago.additional_info.items : [];
  const esEnvio = (it) => String(it.id || "") === "envio" || /env[ií]o/i.test(String(it.title || ""));
  const subtotal = (it) => (Number(it.quantity) || 1) * (Number(it.unit_price) || 0);
  const items = todos.filter((it) => !esEnvio(it)).map((it) => ({
    nombre: String(it.title || it.id || "Producto").replace(/^BUBA Drinks\s*·\s*(?=\S)/i, ""),
    cant: Number(it.quantity) || 1,
    subtotal: mon(subtotal(it)),
  }));
  const itemsEnvio = todos.filter(esEnvio);
  const precioEnvio = itemsEnvio.length ? itemsEnvio.reduce((n, it) => n + subtotal(it), 0) : Number(cli.envio_precio);
  const hayPrecioEnvio = itemsEnvio.length > 0 || cli.envio_precio != null || !env;
  const filaEnvio = hayPrecioEnvio ? [["Envío", precioEnvio > 0 ? mon(precioEnvio) : "Sin costo"]] : [];

  const bultos = env && env.bultos ? `${env.bultos} (cajas de 15×15×7,5 cm)` : "";
  const notas = env ? env.notas || cli.notas || "" : "";
  const lineasDir = env
    ? [env.calle, env.piso_depto ? `Piso/Depto: ${env.piso_depto}` : "", env.ciudad, env.provincia, env.cp ? `CP ${env.cp}` : ""].filter(Boolean)
    : [];

  const av = avisoEnvio(envioRes);
  const cliente = tarjetaCliente(d, { novedades: true });
  const asunto = `🟢 Nueva venta BUBA — ${d.pedido} — ${total}`;

  // ----- texto plano
  const t = [`VENTA APROBADA — ${total}`, `Pedido ${d.pedido} · ${fecha}`, ``, `QUÉ COMPRÓ`];
  if (items.length) for (const it of items) t.push(`- ${it.nombre} × ${it.cant} — ${it.subtotal}`);
  else t.push(`(sin detalle de productos: mirá el pago en Mercado Pago)`);
  for (const [k, v] of filaEnvio) t.push(`${k}: ${v}`);
  t.push(`TOTAL: ${total}`, `${pagoFrase}.`);
  t.push(``, `CLIENTE`, ...cliente.texto);
  t.push(``, `ENVÍO`, d.envioNombre + (d.eta ? ` · ${d.eta}` : ""));
  if (env) {
    t.push(...lineasDir);
    if (notas) t.push(`Notas: ${notas}`);
    if (bultos) t.push(`Bultos: ${bultos}`);
  } else {
    t.push(`Retiro en persona — coordiná día y hora por WhatsApp.`);
  }
  t.push(``, `FAST MAIL`, av.titulo, av.texto);
  if (env) t.push(`Abrir Fast Mail: ${FASTMAIL_URL}`);
  t.push(``, `Despacho: día hábil siguiente a la compra · ID de pago MP ${pago.id}`);

  // ----- html
  const compra = (items.length || filaEnvio.length
    ? tablaCompra({ items, extras: filaEnvio, total })
    : filas([["Total", raw(`<strong>${esc(total)}</strong>`)]])) +
    `<div style="margin:14px 0 0;font-size:14px;line-height:20px;color:${COLOR.gris}">${esc(pagoFrase)}</div>`;

  const envioHtml = env
    ? `<div style="margin:0 0 12px;font-size:16px;line-height:22px;font-weight:600;color:${COLOR.texto}">${esc(d.envioNombre)}${d.eta ? ` <span style="font-weight:400;color:${COLOR.gris}">· ${esc(d.eta)}</span>` : ""}</div>` +
      bloqueTexto(lineasDir) +
      `<div style="margin:8px 0 0">${filas([["Notas", notas], ["Bultos", bultos]])}</div>`
    : `<div style="font-size:16px;line-height:22px;font-weight:600;color:${COLOR.texto}">Retiro en persona</div>` +
      `<div style="margin:4px 0 0;font-size:15px;line-height:21px;color:${COLOR.gris}">Coordiná día y hora por WhatsApp.</div>`;

  const html = layout({
    titulo: `Nueva venta BUBA ${d.pedido}`,
    preheader: [d.pedido, total, d.nombre, d.envioNombre].filter(Boolean).join(" · "),
    cabecera: cabecera({ pastilla: "VENTA APROBADA", colorPastilla: COLOR.verde, monto: total, detalle: `Pedido ${d.pedido} · ${fecha}` }),
    secciones: [
      seccion("🛒 Qué compró", compra),
      seccion("👤 Cliente", cliente.html),
      seccion("📦 Envío", envioHtml),
      tarjetaFastMail(av, !!env),
    ],
    pie: `Despacho: día hábil siguiente a la compra · ID de pago MP ${pago.id}`,
  });

  return { asunto, html, texto: t.join("\n") };
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

/** Paso 3: guarda al comprador en los contactos de Resend. Nunca lanza ni frena nada. */
async function guardarComprador(pago) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const d = datosPago(pago);
    if (!d.email) { console.log("[BUBA] Contacto", { ok: false, motivo: "la compra no trae mail" }); return; }
    const r = await guardarContacto({ email: d.email, nombre: d.nombre, origen: "compra", quiereNovedades: d.novedades });
    console.log("[BUBA] Contacto", { ok: r.ok, motivo: r.motivo });
  } catch (err) {
    console.error("[BUBA] Error guardando el contacto:", err.message);
  }
}

// ---------- mail de devolución ----------

/** "total" | "contracargo" | "parcial" si el pago devolvió la plata; null si no. */
function tipoDevolucion(pago) {
  if (pago.status === "refunded") return "total";
  if (pago.status === "charged_back") return "contracargo";
  if (pago.status === "approved" && pago.status_detail === "partially_refunded") return "parcial";
  return null;
}

/** Número de guía dentro de la respuesta de seguimiento.json, o null. */
function numeroGuia(data) {
  const deItem = (o) => {
    if (!o || typeof o !== "object") return null;
    for (const k of ["guia", "numero_guia", "nro_guia"]) {
      const v = o[k];
      if ((typeof v === "string" && v.trim()) || (typeof v === "number" && v)) return String(v).trim();
    }
    return null;
  };
  if (Array.isArray(data)) return deItem(data[0]);
  return deItem(data) || deItem(data && data.guia);
}

/** Cuadro "Fast Mail" del mail de devolución. Nunca lanza. { tipo, titulo, texto, envio } */
async function avisoDevolucionEnvio(pago) {
  const remito = String(pago.id);
  const md = pago.metadata || {};
  const pedido = pago.external_reference || md.pedido || (md.envio && md.envio.pedido) || `pago ${pago.id}`;
  if (!md.envio) {
    return { tipo: "info", titulo: "Sin envío", texto: "Era retiro en persona: no hay envío para anular.", envio: false };
  }
  let guia = null;
  if (configurado()) {
    try {
      const r = await presis("api/v2/seguimiento.json", { remito });
      guia = numeroGuia(r.data);
    } catch (err) {
      console.error("[BUBA] No se pudo consultar la guía en Fast Mail:", err.name === "AbortError" ? "Fast Mail no respondió a tiempo" : err.message);
    }
  }
  if (guia) {
    return { tipo: "error", titulo: "Dar de baja la guía", envio: true, texto: `Este pedido tenía envío con Fast Mail. Entrá a fastmail.com.ar y dá de baja la guía Nº ${guia} (remito ${remito}).` };
  }
  return {
    tipo: "warn", titulo: "Revisar la guía", envio: true,
    texto: `Este pedido tenía envío a domicilio. Si se había creado la guía en Fast Mail, buscala por el remito ${remito} o por el pedido ${pedido} y dala de baja. Si la guía automática estaba apagada, no hay nada que anular.`,
  };
}

/** Arma { asunto, html, texto } del aviso de devolución. tipo: "total" | "contracargo" | "parcial" */
function armarMailDevolucion(pago, tipo, av) {
  const d = datosPago(pago);
  const monto = mon(pago.transaction_amount);
  const devueltoNum = pago.transaction_amount_refunded != null && pago.transaction_amount_refunded !== ""
    ? Number(pago.transaction_amount_refunded)
    : (tipo === "parcial" ? 0 : Number(pago.transaction_amount));
  const devuelto = mon(devueltoNum);
  const fecha = fechaAR(pago);

  const titulo = tipo === "contracargo" ? "🔴 Contracargo BUBA" : tipo === "parcial" ? "🟠 Devolución parcial BUBA" : "🔴 Venta devuelta BUBA";
  const asunto = tipo === "parcial"
    ? `${titulo} — ${d.pedido} — ${devuelto} de ${monto}`
    : `${titulo} — ${d.pedido} — ${monto}`;
  const intro = tipo === "contracargo"
    ? "El cliente desconoció el pago (contracargo)."
    : tipo === "parcial"
      ? "Se devolvió una parte del pago."
      : "Se devolvió el pago completo.";
  const pie = "La devolución de la plata ya figura en Mercado Pago. Este mail es solo un recordatorio.";
  const pastilla = tipo === "contracargo" ? "CONTRACARGO" : tipo === "parcial" ? "DEVOLUCIÓN PARCIAL" : "VENTA DEVUELTA";

  const cliente = tarjetaCliente(d, { novedades: false });

  const t = [
    `${pastilla} — ${devuelto}`,
    intro,
    `Pedido ${d.pedido} · Venta del ${fecha}`,
    ``,
    `DEVOLUCIÓN`,
    `Venta: ${monto}`,
    `Monto devuelto: ${devuelto}`,
    `Envío: ${d.envioNombre}`,
    ``,
    `CLIENTE`,
    ...cliente.texto,
    ``,
    `FAST MAIL`,
    av.titulo,
    av.texto,
  ];
  if (av.envio) t.push(`Abrir Fast Mail: ${FASTMAIL_URL}`);
  t.push(``, pie, `ID de pago MP ${pago.id}`);

  const html = layout({
    titulo: `${pastilla} BUBA ${d.pedido}`,
    preheader: [pastilla, d.pedido, devuelto, d.nombre].filter(Boolean).join(" · "),
    cabecera: cabecera({
      pastilla, colorPastilla: tipo === "parcial" ? COLOR.naranja : COLOR.rojo, monto: devuelto,
      detalle: `Pedido ${d.pedido} · Venta del ${fecha}`, nota: intro,
    }),
    secciones: [
      seccion("💸 Devolución", filas([
        ["Venta", monto],
        ["Monto devuelto", raw(`<strong>${esc(devuelto)}</strong>`)],
        ["Envío", d.envioNombre],
      ])),
      seccion("👤 Cliente", cliente.html),
      tarjetaFastMail(av, av.envio),
    ],
    pie: `${pie} · ID de pago MP ${pago.id}`,
  });

  return { asunto, html, texto: t.join("\n") };
}

/** Mail de aviso de devolución / contracargo. Nunca lanza. */
async function avisarDevolucion(pago, tipo) {
  console.log("[BUBA] Pago devuelto", { pedido: pago.external_reference, tipo, id: pago.id });
  if (!mailConfigurado()) return;
  try {
    const aviso = await avisoDevolucionEnvio(pago);
    const m = armarMailDevolucion(pago, tipo, aviso);
    const r = await enviarMail({
      asunto: m.asunto,
      html: m.html,
      texto: m.texto,
      idempotencia: tipo === "parcial"
        ? `devolucion-parcial-${pago.id}-${pago.transaction_amount_refunded}`
        : `devolucion-${pago.id}`,
    });
    console.log("[BUBA] Mail de devolución", { ok: r.ok, id: r.id, error: r.error });
  } catch (err) {
    console.error("[BUBA] Error armando el mail de devolución:", err.message);
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
        const devolucion = tipoDevolucion(pago);
        if (devolucion) {
          // plata devuelta: solo recordatorio por mail (aunque sea "approved", no se repite el flujo de venta)
          await avisarDevolucion(pago, devolucion);
        } else if (pago.status === "approved") {
          const envioRes = await resolverEnvio(pago);
          await avisarVenta(pago, envioRes);
          // segundo aviso del mismo pago: el contacto ya se guardó con el primero
          if (envioRes.estado !== "ya_existia") await guardarComprador(pago);
        } else if (pago.status === "cancelled" || pago.status === "rejected") {
          console.log("[BUBA] Pago no aprobado, no se hace nada", pago.external_reference, pago.status);
        }
      }
    }
  } catch (err) {
    console.error("[BUBA] Error en webhook:", err.message);
  }
  // Siempre 200 para que MP no reintente infinitamente
  res.status(200).json({ ok: true });
};
