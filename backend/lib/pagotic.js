/**
 * BUBA — Cliente mínimo de la API de Pago TIC (antes "Pay per TIC")
 * Documentación oficial: https://documentos.paypertic.com
 *
 * Variables de entorno (Vercel → Settings → Environment Variables):
 *   PAGOTIC_USERNAME       → usuario de la API
 *   PAGOTIC_PASSWORD       → contraseña de la API
 *   PAGOTIC_CLIENT_ID      → client_id de OAuth
 *   PAGOTIC_CLIENT_SECRET  → client_secret de OAuth
 *   PAGOTIC_API_URL        → (opcional) base de la API. Por defecto https://api.paypertic.com
 *   PAGOTIC_AUTH_URL       → (opcional) URL del token. Por defecto la de producción
 *   PAGOTIC_COLLECTOR_ID   → (opcional) collector_id con el que se cobra
 *
 * Nada de acá imprime ni devuelve credenciales: los textos de error pasan por limpiar().
 */

const AUTH_URL_DEFECTO = "https://a.paypertic.com/auth/realms/entidades/protocol/openid-connect/token";
const API_URL_DEFECTO = "https://api.paypertic.com";
const VARIABLES = ["PAGOTIC_USERNAME", "PAGOTIC_PASSWORD", "PAGOTIC_CLIENT_ID", "PAGOTIC_CLIENT_SECRET"];
const SECRETAS = VARIABLES; // todas se enmascaran en los mensajes de error
const TIMEOUT_MS = 10000;
const MARGEN_S = 60; // el token se renueva 60 s antes de vencer

const env = (k) => String(process.env[k] || "").trim();

/** Nombres de las variables obligatorias que faltan. */
const faltantes = () => VARIABLES.filter((k) => !env(k));
/** true si están cargadas las 4 variables obligatorias. */
const configurado = () => faltantes().length === 0;

const apiUrl = () => (env("PAGOTIC_API_URL") || API_URL_DEFECTO).replace(/\/+$/, "");
const authUrl = () => env("PAGOTIC_AUTH_URL") || AUTH_URL_DEFECTO;
const collectorId = () => env("PAGOTIC_COLLECTOR_ID");

/** Recorta un texto y le tapa cualquier credencial que el proveedor haya repetido. */
function limpiar(texto, max = 300) {
  let t = String(texto == null ? "" : texto);
  for (const k of SECRETAS) {
    const v = env(k);
    if (v.length >= 3) t = t.split(v).join("***");
  }
  return t.slice(0, max);
}

/** fetch con timeout de 10 s; el cuerpo se lee antes de soltar el timeout. */
async function pedir(url, opts) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    const texto = await r.text();
    let data = null;
    try { data = texto ? JSON.parse(texto) : null; } catch { /* no era JSON */ }
    return { http: r.status, data, texto: limpiar(texto) };
  } finally {
    clearTimeout(timer);
  }
}

const motivoDeError = (err) => (err && err.name === "AbortError" ? "Pago TIC no respondió a tiempo" : (err && err.message) || "error de red");

// token en memoria de esta instancia (Vercel reutiliza la instancia entre llamadas cercanas)
let cache = { token: null, vence: 0 };

/**
 * Pide un token nuevo. Nunca lanza.
 * → { ok:true, token, expira_en } | { ok:false, http, mensaje, detalle }
 */
async function pedirToken() {
  if (!configurado()) return { ok: false, http: 0, mensaje: "Faltan variables de Pago TIC", detalle: faltantes().join(", ") };
  try {
    const r = await pedir(authUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        username: env("PAGOTIC_USERNAME"),
        password: env("PAGOTIC_PASSWORD"),
        grant_type: "password",
        client_id: env("PAGOTIC_CLIENT_ID"),
        client_secret: env("PAGOTIC_CLIENT_SECRET"),
      }).toString(),
    });
    const d = r.data;
    if (r.http >= 200 && r.http < 300 && d && d.access_token) {
      const exp = Number(d.expires_in) > 0 ? Number(d.expires_in) : 300;
      cache = { token: d.access_token, vence: Date.now() + (exp - MARGEN_S) * 1000 };
      return { ok: true, token: d.access_token, expira_en: exp };
    }
    cache = { token: null, vence: 0 };
    const detalle = (d && (d.error_description || d.error || d.message)) ? limpiar(d.error_description || d.error || d.message) : r.texto;
    return { ok: false, http: r.http, mensaje: "Pago TIC no aceptó las credenciales", detalle: detalle || `HTTP ${r.http}` };
  } catch (err) {
    return { ok: false, http: 0, mensaje: "No se pudo llegar a Pago TIC", detalle: limpiar(motivoDeError(err)) };
  }
}

/**
 * Token vigente: el guardado si le quedan más de 60 s; si no, uno nuevo.
 * Nunca lanza: { ok, token?, expira_en?, http?, mensaje?, detalle? }. `fresco: true` ignora el guardado.
 */
async function token({ fresco = false } = {}) {
  if (!fresco && cache.token && Date.now() < cache.vence) {
    return { ok: true, token: cache.token, expira_en: Math.max(0, Math.round((cache.vence - Date.now()) / 1000) + MARGEN_S) };
  }
  return pedirToken();
}

/**
 * Llamada a la API con Bearer. Nunca lanza: { http, data, texto }.
 * http 0 = no hubo respuesta (sin credenciales, red o timeout); `texto` explica por qué.
 * Si la API contesta 401 se pide un token nuevo y se reintenta una vez.
 */
async function api(metodo, ruta, body) {
  const url = apiUrl() + (ruta.startsWith("/") ? ruta : "/" + ruta);
  for (let intento = 0; intento < 2; intento++) {
    const t = await token({ fresco: intento > 0 });
    if (!t.ok) return { http: t.http || 0, data: null, texto: [t.mensaje, t.detalle].filter(Boolean).join(": ") };
    try {
      const r = await pedir(url, {
        method: metodo,
        headers: {
          Authorization: `Bearer ${t.token}`,
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (r.http === 401 && intento === 0) { cache = { token: null, vence: 0 }; continue; }
      return r;
    } catch (err) {
      return { http: 0, data: null, texto: limpiar(motivoDeError(err)) };
    }
  }
  return { http: 401, data: null, texto: "Pago TIC rechazó el token" };
}

/** POST /pagos → { http, data, texto }. data.form_url es adonde se manda al cliente. */
const crearPago = (body) => api("POST", "/pagos", body);

/** Arma la query de filtros de la API de consulta: [{campo, valor, op?}] → "filters[0][field]=…" (op por defecto EQUAL). */
function queryFiltros(filtros) {
  return filtros
    .map((f, i) => `filters[${i}][field]=${encodeURIComponent(f.campo)}&filters[${i}][operation]=${encodeURIComponent(f.op || "EQUAL")}&filters[${i}][value]=${encodeURIComponent(f.valor)}`)
    .join("&");
}

/** Fecha en el formato de los filtros de Pago TIC (yyyyMMddTHHmmssSSSZ, hora argentina): hace `dias` días a las 00:00. */
function fechaFiltro(dias = 7, ahora = new Date()) {
  const ar = new Date(ahora.getTime() - 3 * 3600 * 1000 - dias * 86400 * 1000); // corrido a UTC-3
  const p = (n, l = 2) => String(n).padStart(l, "0");
  return `${ar.getUTCFullYear()}${p(ar.getUTCMonth() + 1)}${p(ar.getUTCDate())}T000000000-0300`;
}

/**
 * Pagos de un pedido. La API exige combinaciones mínimas de filtros (no alcanza con el número de
 * pedido solo): se usa número de cobrador + fecha si está PAGOTIC_COLLECTOR_ID, y si no,
 * mail del pagador + fecha. → { http, pagos:[…] (solo los de ese pedido), texto }
 */
async function buscarPorPedido(pedido, email) {
  const desde = { campo: "request_date", op: "GREATER_THAN", valor: fechaFiltro(7) };
  const intentos = [];
  if (collectorId()) intentos.push([{ campo: "collector_id", valor: collectorId() }, desde]);
  if (email) intentos.push([{ campo: "payer.email", valor: String(email).trim().toLowerCase() }, desde]);
  if (!intentos.length) return { http: 0, pagos: [], texto: "falta el mail del pagador para consultar" };
  let ultimo = { http: 0, pagos: [], texto: "" };
  for (const filtros of intentos) {
    const r = await buscarPagos(filtros);
    const deEste = r.pagos.filter((p) => String(p.external_transaction_id || "").toLowerCase() === String(pedido).toLowerCase());
    if (r.http >= 200 && r.http < 300) return { http: r.http, pagos: deEste, texto: "" };
    ultimo = { http: r.http, pagos: [], texto: r.texto };
  }
  return ultimo;
}

/** Saca la lista de pagos de una respuesta de consulta ({ data:[…] } o directamente […]). */
function listaDe(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

/** Busca pagos con filtros de igualdad. → { http, pagos:[…], texto } */
async function buscarPagos(filtros) {
  const r = await api("GET", "/pagos?" + queryFiltros(filtros));
  return { http: r.http, pagos: r.http >= 200 && r.http < 300 ? listaDe(r.data) : [], texto: r.texto };
}

/**
 * Pago por id (UUID). → { http, pago, texto }; pago = null si no existe o no se pudo verificar.
 * Primero GET /pagos/{id}; si ese endpoint no existe (404/405) se consulta con el filtro por id.
 */
async function obtenerPago(id) {
  const buscado = String(id || "").trim();
  if (!buscado) return { http: 0, pago: null, texto: "falta el id" };
  const igual = (p) => p && typeof p === "object" && String(p.id || "").toLowerCase() === buscado.toLowerCase();

  const r = await api("GET", "/pagos/" + encodeURIComponent(buscado));
  if (r.http >= 200 && r.http < 300) {
    const d = r.data;
    const p = igual(d) ? d : d && igual(d.data) ? d.data : listaDe(d).find(igual);
    return { http: r.http, pago: p || null, texto: p ? "" : "la respuesta no trae ese pago" };
  }
  if (r.http !== 404 && r.http !== 405) return { http: r.http, pago: null, texto: r.texto };

  // plan B (el endpoint por id puede no existir en todas las cuentas): filtros por id,
  // con el número de cobrador si lo tenemos (la API pide combinaciones mínimas)
  const planes = [];
  if (collectorId()) {
    planes.push([{ campo: "collector_id", valor: collectorId() }, { campo: "id", valor: buscado }]);
    planes.push([{ campo: "collector_id", valor: collectorId() }, { campo: "payment_id", valor: buscado }]);
  }
  planes.push([{ campo: "id", valor: buscado }]);
  let b = { http: 0, pagos: [], texto: "" };
  for (const filtros of planes) {
    b = await buscarPagos(filtros);
    const p = b.pagos.find(igual); // se exige el mismo id: un filtro ignorado no puede colar otro pago
    if (p) return { http: b.http, pago: p, texto: "" };
  }
  return { http: b.http || r.http, pago: null, texto: b.texto || r.texto };
}

/** Estado de Pago TIC → el nombre que ya entiende la web (los de Mercado Pago). Desconocido: tal cual. */
function estadoComoMP(status) {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return "approved";
  if (["pending", "issued", "in_process", "review", "validate", "deferred"].includes(s)) return "pending";
  if (["rejected", "cancelled", "overdue"].includes(s)) return "rejected";
  if (s === "refunded") return "refunded";
  return s;
}

/** Solo para las pruebas: olvida el token guardado. */
const _olvidarToken = () => { cache = { token: null, vence: 0 }; };

module.exports = {
  configurado, faltantes, token, api, crearPago, obtenerPago, buscarPagos, buscarPorPedido, fechaFiltro, estadoComoMP, apiUrl, collectorId, limpiar, _olvidarToken,
  AUTH_URL_DEFECTO, API_URL_DEFECTO,
};
