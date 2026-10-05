/**
 * BUBA — Contactos de clientes en Resend (para mandar novedades por mail)
 *
 * guardarContacto({ email, nombre, origen, quiereNovedades }) → { ok, motivo }
 * Nunca lanza.
 *
 * Resend tiene dos APIs de contactos y soportamos las dos:
 *  1. Contactos globales:  POST /contacts  (cuentas nuevas)
 *  2. Audiencias:          POST /audiences/{id}/contacts  (cuentas viejas, si la 1 da 404/405)
 *     La audiencia es RESEND_AUDIENCE_ID, o se busca/crea una llamada "Clientes BUBA".
 *
 * Requiere una API key con permiso "Full access": las claves solo para enviar no pueden con contactos.
 * Nunca se vuelve a suscribir a alguien que ya existe: si ya está cargado y quiere novedades, no se toca nada.
 *
 * `origen` ("compra", "pre-lanzamiento", "web") se recibe para el futuro, pero Resend no tiene dónde guardarlo todavía.
 */

const API = "https://api.resend.com";
const NOMBRE_AUDIENCIA = "Clientes BUBA";
const MOTIVO_PERMISO = "La clave de Resend no tiene permiso para contactos (crear una con Full access)";

let audienciaId = null; // se acuerda de la audiencia entre invocaciones de la misma instancia

/** Llamada a Resend con timeout de 8 s. Devuelve { status, ok, data }. Puede lanzar (lo atrapa guardarContacto). */
async function llamar(metodo, ruta, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(API + ruta, {
      method: metodo,
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    let data = null;
    try { data = await r.json(); } catch { /* respuesta sin JSON */ }
    return { status: r.status, ok: r.status >= 200 && r.status < 300, data };
  } finally {
    clearTimeout(timer);
  }
}

const sinPermiso = (r) => r.status === 401 || r.status === 403;
const mensaje = (r) => (r.data && (r.data.message || r.data.name)) || `HTTP ${r.status}`;
const yaExiste = (r) =>
  r.status === 409 || (r.status === 422 && /already|exist|duplicate/i.test(String((r.data && r.data.message) || "")));
const falla = (r) => ({ ok: false, motivo: sinPermiso(r) ? MOTIVO_PERMISO : mensaje(r) });

/** Id de la audiencia "Clientes BUBA": variable de entorno, o la busca, o la crea. { id } | { motivo } */
async function obtenerAudiencia() {
  if (audienciaId) return { id: audienciaId };
  if (process.env.RESEND_AUDIENCE_ID) return { id: (audienciaId = process.env.RESEND_AUDIENCE_ID) };

  const lista = await llamar("GET", "/audiences");
  if (!lista.ok) return { motivo: falla(lista).motivo };
  const todas = Array.isArray(lista.data && lista.data.data) ? lista.data.data : [];
  const existente = todas.find((a) => a && a.name === NOMBRE_AUDIENCIA);
  if (existente && existente.id) return { id: (audienciaId = existente.id) };

  const nueva = await llamar("POST", "/audiences", { name: NOMBRE_AUDIENCIA });
  if (nueva.ok && nueva.data && nueva.data.id) return { id: (audienciaId = nueva.data.id) };
  return { motivo: nueva.ok ? "Resend no devolvió el id de la audiencia" : falla(nueva).motivo };
}

/** El contacto ya estaba cargado: solo se lo da de baja si pidió no recibir novedades. */
async function yaCargado(rutaContacto, quiere) {
  if (quiere) return { ok: true };
  const r = await llamar("PATCH", rutaContacto, { unsubscribed: true });
  return r.ok ? { ok: true } : falla(r);
}

async function enAudiencia(email, cuerpo, quiere) {
  const aud = await obtenerAudiencia();
  if (!aud.id) return { ok: false, motivo: aud.motivo };
  const ruta = `/audiences/${encodeURIComponent(aud.id)}/contacts`;
  const rutaContacto = `${ruta}/${encodeURIComponent(email)}`;

  // en esta API crear un contacto que ya existe puede pisarlo (y volver a suscribirlo): se mira antes
  const previo = await llamar("GET", rutaContacto);
  if (previo.ok) return yaCargado(rutaContacto, quiere);
  if (sinPermiso(previo)) return falla(previo);

  const r = await llamar("POST", ruta, cuerpo);
  if (r.ok) return { ok: true };
  if (yaExiste(r)) return yaCargado(rutaContacto, quiere);
  return falla(r);
}

async function guardarContacto({ email, nombre, origen, quiereNovedades = true } = {}) {
  try {
    if (!process.env.RESEND_API_KEY) return { ok: false, motivo: "Falta RESEND_API_KEY" };
    const mail = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return { ok: false, motivo: "Mail inválido" };

    const quiere = quiereNovedades !== false;
    const [primero, ...resto] = String(nombre || "").trim().split(/\s+/).filter(Boolean);
    const cuerpo = { email: mail };
    if (primero) cuerpo.first_name = primero;
    if (resto.length) cuerpo.last_name = resto.join(" ");
    cuerpo.unsubscribed = !quiere;

    const r = await llamar("POST", "/contacts", cuerpo);
    if (r.status === 404 || r.status === 405) return await enAudiencia(mail, cuerpo, quiere);
    if (r.ok) return { ok: true };
    if (yaExiste(r)) return await yaCargado(`/contacts/${encodeURIComponent(mail)}`, quiere);
    return falla(r);
  } catch (err) {
    return { ok: false, motivo: err.name === "AbortError" ? "Resend no respondió a tiempo" : err.message };
  }
}

/** Solo para las pruebas: olvida la audiencia guardada. */
const _olvidarAudiencia = () => { audienciaId = null; };

module.exports = { guardarContacto, _olvidarAudiencia };
