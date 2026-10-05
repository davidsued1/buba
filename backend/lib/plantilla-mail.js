/**
 * BUBA — Bloques para armar mails HTML (sin red, sin dependencias)
 *
 * HTML "a prueba de clientes de mail": tablas anidadas, estilos en línea,
 * ancho máximo 560 px, sin CSS externo (solo el logo en los mails al cliente). Pensado para leerse en el
 * celular (Gmail en iPhone). Todo valor dinámico se escapa acá; para pasar HTML
 * ya armado (y ya escapado) hay que envolverlo con raw().
 */

const FUENTE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const COLOR = {
  texto: "#1d1d1f",
  gris: "#6e6e73",
  grisClaro: "#8e8e93",
  linea: "#ececf0",
  fondo: "#f5f5f7",
  verde: "#1f9d55",
  rojo: "#d92d20",
  naranja: "#e8710a",
  oscuro: "#1d1d1f",
  whatsapp: "#25a244",
};

/** Colores de los 4 sabores de BUBA (firma de marca en los mails al cliente). */
const SABORES = ["#1c6fd6", "#f0922e", "#e5568f", "#d7191f"]; // Blueberry Limeade, Golden Peach, Pink Lemonade, Strawberry Ice

const AVISOS = {
  ok: { fondo: "#e8f6ed", color: "#1f7a3d" },
  warn: { fondo: "#fff6df", color: "#9a6700" },
  error: { fondo: "#fdecea", color: "#b42318" },
  info: { fondo: "#f2f2f4", color: "#1d1d1f" },
};

const esc = (v) =>
  String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Marca un HTML como ya armado: no se vuelve a escapar. */
const raw = (html) => ({ __html: String(html == null ? "" : html) });
const val = (v) => (v && typeof v === "object" && "__html" in v ? v.__html : esc(v));

/** Solo http(s) y mailto: cualquier otra cosa no se vuelve link. */
const urlSegura = (u) => (/^(https?:\/\/|mailto:)/i.test(String(u || "")) ? String(u) : "#");

const tabla = (extra, inner) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;${extra}">${inner}</table>`;

/** Caja blanca con esquinas redondeadas (la base de la cabecera y de cada sección). */
function tarjeta(inner) {
  return tabla("background:#ffffff;border-radius:16px", `<tr><td style="padding:20px;font-family:${FUENTE};color:${COLOR.texto}">${inner}</td></tr>`);
}

/** Sección con título (ej. "🛒 Qué compró") dentro de una tarjeta. */
function seccion(titulo, html) {
  return tarjeta(
    `<div style="margin:0 0 12px;font-size:13px;line-height:18px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${COLOR.gris}">${esc(titulo)}</div>${html}`
  );
}

/** Filas "etiqueta · valor". pares: [[k, v], ...]; v es texto (se escapa) o raw(html). Se saltean los vacíos. */
function filas(pares) {
  const rows = (pares || [])
    .filter((p) => p && p[1] != null && p[1] !== "")
    .map(
      ([k, v]) =>
        `<tr><td valign="top" style="padding:6px 12px 6px 0;width:104px;font-size:14px;line-height:20px;color:${COLOR.gris}">${esc(k)}</td>` +
        `<td valign="top" style="padding:6px 0;font-size:15px;line-height:20px;color:${COLOR.texto};word-break:break-word">${val(v)}</td></tr>`
    );
  return tabla("", rows.join(""));
}

/** Botón grande (toda el área es tocable). */
function boton(texto, url, color = COLOR.oscuro) {
  return tabla(
    "",
    `<tr><td align="center" bgcolor="${esc(color)}" style="background:${esc(color)};border-radius:12px">` +
      `<a href="${esc(urlSegura(url))}" style="display:block;padding:14px 12px;font-family:${FUENTE};font-size:16px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px">${esc(texto)}</a>` +
      `</td></tr>`
  );
}

/** Dos botones lado a lado (en pantallas muy angostas se apilan). Con uno solo, ocupa todo el ancho. */
function botones(lista) {
  const bs = (lista || []).filter(Boolean);
  if (!bs.length) return "";
  if (bs.length === 1) return bs[0];
  return tabla(
    "",
    `<tr><td class="col" width="50%" valign="top" style="padding-right:5px">${bs[0]}</td>` +
      `<td class="col" width="50%" valign="top" style="padding-left:5px">${bs[1]}</td></tr>`
  );
}

/** Cuadro de color. tipo: "ok" (verde) | "warn" (ámbar) | "error" (rojo) | "info" (gris). titulo opcional en negrita. */
function aviso(texto, tipo = "info", titulo = "") {
  const t = AVISOS[tipo] || AVISOS.info;
  return (
    `<div style="background:${t.fondo};color:${t.color};border-radius:12px;padding:14px 16px;font-size:15px;line-height:21px">` +
    (titulo ? `<div style="font-weight:700;margin:0 0 2px">${esc(titulo)}</div>` : "") +
    `${val(texto)}</div>`
  );
}

/** Texto en un recuadro gris, una línea por renglón, fácil de seleccionar y copiar (ej. una dirección). */
function bloqueTexto(lineas) {
  return (
    `<div style="background:${COLOR.fondo};border-radius:12px;padding:14px 16px;font-size:16px;line-height:24px;color:${COLOR.texto};-webkit-user-select:all;user-select:all">` +
    (lineas || []).filter((l) => l !== "" && l != null).map((l) => esc(l)).join("<br>") +
    `</div>`
  );
}

/** Tabla de compra: items [{ nombre, cant, subtotal }], extras [[k, v]] (ej. Envío) y total (todo ya formateado). */
function tablaCompra({ items = [], extras = [], total }) {
  const th = (t, al) => `<td align="${al}" style="padding:0 0 8px;font-size:12px;line-height:16px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:${COLOR.grisClaro}">${t}</td>`;
  const borde = `border-top:1px solid ${COLOR.linea};`;
  const filaItem = (it) =>
    `<tr><td valign="top" style="${borde}padding:10px 8px 10px 0;font-size:15px;line-height:20px;color:${COLOR.texto}">${esc(it.nombre)}</td>` +
    `<td valign="top" align="center" style="${borde}padding:10px 8px;font-size:15px;line-height:20px;color:${COLOR.gris};white-space:nowrap">${esc(it.cant)}</td>` +
    `<td valign="top" align="right" style="${borde}padding:10px 0;font-size:15px;line-height:20px;color:${COLOR.texto};white-space:nowrap">${esc(it.subtotal)}</td></tr>`;
  const filaExtra = ([k, v]) =>
    `<tr><td colspan="2" style="${borde}padding:10px 8px 10px 0;font-size:15px;line-height:20px;color:${COLOR.gris}">${esc(k)}</td>` +
    `<td align="right" style="${borde}padding:10px 0;font-size:15px;line-height:20px;color:${COLOR.texto};white-space:nowrap">${esc(v)}</td></tr>`;
  const filaTotal =
    `<tr><td colspan="2" style="border-top:2px solid ${COLOR.texto};padding:12px 8px 0 0;font-size:18px;line-height:24px;font-weight:700;color:${COLOR.texto}">Total</td>` +
    `<td align="right" style="border-top:2px solid ${COLOR.texto};padding:12px 0 0;font-size:18px;line-height:24px;font-weight:700;color:${COLOR.texto};white-space:nowrap">${esc(total)}</td></tr>`;
  return tabla(
    "",
    `<tr>${th("Producto", "left")}${th("Cant.", "center")}${th("Subtotal", "right")}</tr>` +
      items.map(filaItem).join("") +
      extras.map(filaExtra).join("") +
      filaTotal
  );
}

/** Logo de BUBA centrado (PNG publicado en el sitio). site: URL base sin barra final. */
function logoCabecera(site) {
  return (
    `<div style="text-align:center;padding:4px 0 0"><img src="${esc(String(site).replace(/\/$/, ""))}/assets/img/logo-full.png" width="180" alt="BUBA Ready Cocktails" style="display:block;border:0;height:auto;margin:0 auto"></div>`
  );
}

/** Franja finita con los 4 colores de los sabores (4 celdas de 25 %, 6 px de alto). */
function franjaColores() {
  const celdas = SABORES.map((c) => `<td width="25%" height="6" bgcolor="${c}" style="background:${c};height:6px;line-height:6px;font-size:1px">&nbsp;</td>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>${celdas}</tr></table>`;
}

/** Botones uno debajo del otro, a todo el ancho (mejor en el celular que dos botones con texto largo). */
function botonesApilados(lista) {
  return (lista || []).filter(Boolean).map((b, i) => `<div style="margin:${i ? 10 : 0}px 0 0">${b}</div>`).join("");
}

/** Cabecera: marca, pastilla de estado, monto grande y una línea de detalle. */
function cabecera({ marca = "BUBA DRINKS", pastilla, colorPastilla = COLOR.verde, monto, detalle = "", nota = "" }) {
  return (
    `<div style="font-size:12px;line-height:16px;font-weight:700;letter-spacing:.22em;color:${COLOR.gris}">${esc(marca)}</div>` +
    `<div style="margin:14px 0 0"><span style="display:inline-block;background:${esc(colorPastilla)};color:#ffffff;border-radius:999px;padding:5px 12px;font-size:12px;line-height:16px;font-weight:700;letter-spacing:.08em">${esc(pastilla)}</span></div>` +
    `<div style="margin:12px 0 0;font-size:34px;line-height:40px;font-weight:700;letter-spacing:-.02em;color:${COLOR.texto}">${esc(monto)}</div>` +
    (detalle ? `<div style="margin:6px 0 0;font-size:14px;line-height:20px;color:${COLOR.gris}">${esc(detalle)}</div>` : "") +
    (nota ? `<div style="margin:10px 0 0;font-size:15px;line-height:21px;color:${COLOR.texto}">${esc(nota)}</div>` : "")
  );
}

/**
 * Mail completo.
 *  preheader: texto que se ve en la lista de mails (no se ve dentro del mail)
 *  titulo:    <title> del documento
 *  cabecera:  HTML de cabecera() (va en la primera tarjeta)
 *  secciones: HTML de seccion() (cada una es una tarjeta)
 *  pie:       texto chico gris al final (texto, o raw(html) para varias líneas)
 */
function layout({ preheader = "", titulo = "BUBA Drinks", cabecera: cab = "", secciones = [], pie = "" }) {
  const relleno = "&zwnj;&nbsp;".repeat(40); // evita que el cuerpo se cuele en la vista previa
  const tarjetas = [cab ? tarjeta(cab) : "", ...secciones].filter(Boolean);
  const filasTarjetas = tarjetas.map((t) => `<tr><td style="padding:0 0 12px">${t}</td></tr>`).join("");
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(titulo)}</title>
<style>@media only screen and (max-width:340px){.col{display:block!important;width:100%!important;padding:0 0 10px!important}}</style></head>
<body style="margin:0;padding:0;background:${COLOR.fondo};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${COLOR.fondo}">${esc(preheader)}${relleno}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLOR.fondo}" style="background:${COLOR.fondo}"><tr><td align="center" style="padding:16px 12px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%">
${filasTarjetas}
${pie ? `<tr><td style="padding:8px 12px 0;font-family:${FUENTE};font-size:12px;line-height:18px;color:${COLOR.grisClaro};text-align:center">${val(pie)}</td></tr>` : ""}
</table></td></tr></table></body></html>`;
}

module.exports = { COLOR, SABORES, logoCabecera, franjaColores, botonesApilados, esc, raw, layout, cabecera, seccion, filas, boton, botones, aviso, bloqueTexto, tablaCompra };
