/**
 * BUBA — Anotarse para recibir novedades ("Avisame" del pre-lanzamiento)
 *
 * La web manda { email, origen } y se guarda el mail en los contactos de
 * Resend (ver backend/lib/contactos.js). Es público, por eso:
 *  - solo acepta mail y origen ("pre-lanzamiento" o "web")
 *  - el campo `sitio` es una trampa para robots: si viene con algo, se responde ok y no se guarda
 *  - nunca dice si el mail ya estaba anotado
 */
const { guardarContacto } = require("../lib/contactos");

const cors = (res, origin) => {
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

const ORIGENES = ["pre-lanzamiento", "web"];
const MAIL_VALIDO = /^[^\s@,;<>()"]+@[^\s@,;<>()"]+\.[^\s@,;<>()"]{2,}$/;

function leerBody(req) {
  const b = req.body;
  if (b && typeof b === "object") return b;
  if (typeof b === "string") {
    try { const j = JSON.parse(b); return j && typeof j === "object" ? j : {}; } catch { return {}; }
  }
  return {};
}

module.exports = async (req, res) => {
  cors(res, req.headers && req.headers.origin);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false });

  const body = leerBody(req);

  // trampa para robots: un humano no ve este campo
  if (body.sitio !== undefined && body.sitio !== null && String(body.sitio).trim() !== "") {
    return res.status(200).json({ ok: true });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || email.length > 120 || !MAIL_VALIDO.test(email)) {
    return res.status(400).json({ ok: false });
  }
  const origen = ORIGENES.includes(body.origen) ? body.origen : "web";

  const r = await guardarContacto({ email, nombre: "", origen, quiereNovedades: true });
  if (!r.ok) {
    console.error("[BUBA] Suscripción no guardada:", r.motivo);
    return res.status(200).json({ ok: false });
  }
  console.log("[BUBA] Suscripción guardada", { origen });
  return res.status(200).json({ ok: true });
};
