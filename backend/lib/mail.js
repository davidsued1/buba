/**
 * BUBA — Envío de mails con Resend (https://resend.com)
 *
 * Variables de entorno (Vercel → Settings → Environment Variables):
 *   RESEND_API_KEY → clave de la API de Resend
 *   MAIL_AVISOS    → mails que reciben los avisos, separados por coma
 *   MAIL_FROM      → (opcional) remitente, ej. "BUBA Drinks <hola@bubadrinks.com.ar>"
 *                    Por defecto "BUBA Drinks <onboarding@resend.dev>". Es obligatorio
 *                    (con dominio verificado) para mandarle el mail de confirmación al cliente.
 */

/** true si están cargadas RESEND_API_KEY y MAIL_AVISOS */
function mailConfigurado() {
  return !!process.env.RESEND_API_KEY && destinatarios().length > 0;
}

/**
 * true si se puede escribirle a clientes: hace falta RESEND_API_KEY y MAIL_FROM.
 * Resend solo deja mandar a terceros desde un dominio verificado; sin MAIL_FROM
 * salimos de onboarding@resend.dev, que únicamente llega al dueño de la cuenta.
 */
function puedeMandarAClientes() {
  return !!process.env.RESEND_API_KEY && !!String(process.env.MAIL_FROM || "").trim();
}

function destinatarios() {
  return String(process.env.MAIL_AVISOS || "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Manda un mail de aviso. Nunca lanza: devuelve { ok, id, error }.
 * adjuntos: [{ nombre, base64 }]
 * para: (opcional) destinatario o lista; si no viene, van los de MAIL_AVISOS.
 * responderA: (opcional) a quién le escribe quien aprieta "Responder" (reply_to).
 * idempotencia: Resend descarta durante 24 h un segundo envío con la misma clave
 * (evita mails duplicados si Mercado Pago avisa dos veces el mismo pago).
 */
async function enviarMail({ asunto, html, texto, adjuntos = [], idempotencia, para, responderA } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const headers = {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    };
    if (idempotencia) headers["Idempotency-Key"] = String(idempotencia);

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: process.env.MAIL_FROM || "BUBA Drinks <onboarding@resend.dev>",
        to: para ? (Array.isArray(para) ? para : [para]) : destinatarios(),
        ...(responderA ? { reply_to: responderA } : {}),
        subject: asunto,
        html,
        text: texto,
        attachments: adjuntos.map((a) => ({ filename: a.nombre, content: a.base64 })),
      }),
      signal: ctrl.signal,
    });
    let data = null;
    try { data = await r.json(); } catch { /* respuesta sin JSON */ }
    if (r.ok && data && data.id) return { ok: true, id: data.id, error: null };
    return { ok: false, id: null, error: (data && (data.message || data.name)) || `HTTP ${r.status}` };
  } catch (err) {
    return { ok: false, id: null, error: err.name === "AbortError" ? "Resend no respondió a tiempo" : err.message };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { enviarMail, mailConfigurado, puedeMandarAClientes };
