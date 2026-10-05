/**
 * BUBA backend — Stock compartido (Upstash Redis por REST, sin dependencias)
 *
 * Una sola fuente de verdad para el stock: la web, el panel, los mails de venta y la app de Stock
 * (/stock/ en el sitio) leen y escriben acá. La base se crea en Vercel → Storage → Upstash for Redis
 * y se conecta al proyecto: Vercel carga solo las variables de conexión.
 *
 * Variables de entorno:
 *   KV_REST_API_URL / KV_REST_API_TOKEN               → las pone Vercel al conectar Upstash
 *   (o UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN, según cómo se haya conectado)
 *   STOCK_CLAVE      → clave que se pide en la app de Stock (obligatoria para escribir)
 *   STOCK_AVISO      → (opcional) de cuántos packs para abajo el mail de venta avisa "quedan pocos". Por defecto 10.
 *   STOCK_PRODUCTOS  → (opcional) ids de producto con stock, separados por coma. Por defecto "pack4".
 *
 * Claves en Redis:
 *   stock:<productoId>     entero con el stock actual
 *   stock:movs             lista (más nuevo primero) de movimientos en JSON, hasta 2000
 *   stock:venta:<pagoId>   marca de "esta venta ya descontó stock" (30 días): idempotencia
 *
 * Cada movimiento es atómico: entrada y salida usan INCRBY (no pisan lo que haga otro celular
 * al mismo tiempo) y guardan el stock resultante.
 */
const crypto = require("crypto");

const TIMEOUT_MS = 8000;
const MAX_MOVS = 2000;
const TTL_VENTA = 2592000; // 30 días

const MOTIVOS = {
  produccion: "Ingreso / producción",
  venta_directa: "Venta fuera de la web",
  regalo: "Regalo",
  rotura: "Rotura o pérdida",
  devolucion: "Devolución",
  ajuste: "Ajuste de conteo",
  venta_web: "Venta web",
};
const MOTIVOS_POR_TIPO = {
  entrada: ["produccion", "devolucion"],
  salida: ["venta_directa", "regalo", "rotura"],
  fijar: ["ajuste"],
};
const TIPOS = { entrada: "Entrada", salida: "Salida", fijar: "Ajuste" };

// ---------- conexión ----------

const url = () => String(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").trim().replace(/\/+$/, "");
const token = () => String(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

/** true si la base de stock está conectada (hay URL y token). */
const configurado = () => !!url() && !!token();

async function pedir(ruta, cuerpo) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url() + ruta, {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
      signal: ctrl.signal,
    });
    let data = null;
    try { data = await r.json(); } catch { /* sin JSON */ }
    if (!r.ok || data == null) throw new Error((data && data.error) || `Redis HTTP ${r.status}`);
    return data;
  } catch (err) {
    throw new Error(err.name === "AbortError" ? "La base de stock no respondió a tiempo" : err.message);
  } finally {
    clearTimeout(timer);
  }
}

/** Un comando: redis(["INCRBY", "stock:pack4", 3]) → result. Lanza si Redis devuelve error. */
async function redis(cmd) {
  const data = await pedir("", cmd);
  if (data.error) throw new Error(data.error);
  return data.result;
}

/** Varios comandos en un viaje: pipeline([[...], [...]]) → [result, ...]. Lanza si alguno falla. */
async function pipeline(cmds) {
  const data = await pedir("/pipeline", cmds);
  if (!Array.isArray(data)) throw new Error("Respuesta inesperada de la base de stock");
  return data.map((x) => {
    if (x && x.error) throw new Error(x.error);
    return x ? x.result : null;
  });
}

// ---------- productos ----------

/** Ids de producto con stock (STOCK_PRODUCTOS, por defecto solo "pack4"). */
function productos() {
  const l = String(process.env.STOCK_PRODUCTOS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return l.length ? l : ["pack4"];
}
const clave = (id) => `stock:${id}`;
const esProductoConStock = (id) => productos().includes(String(id));

/** Stock actual de cada producto: { pack4: n | null } (null = todavía no se cargó). */
async function leerStock(ids) {
  const lista = ids && ids.length ? ids : productos();
  const vals = await redis(["MGET", ...lista.map(clave)]);
  const out = {};
  lista.forEach((id, i) => {
    const n = vals && vals[i] != null ? parseInt(vals[i], 10) : NaN;
    out[id] = Number.isFinite(n) ? n : null;
  });
  return out;
}

// ---------- movimientos ----------

function errorDe(status, mensaje, extra) {
  const e = new Error(mensaje);
  e.status = status;
  Object.assign(e, extra || {});
  return e;
}

const recortar = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max);

/**
 * Registra un movimiento. { producto, cant, tipo: "entrada"|"salida"|"fijar", motivo, quien, nota, ref }
 * entrada suma, salida resta, fijar deja el stock en `cant` (ajuste de conteo).
 * El motivo "venta_web" solo lo puede usar el servidor (opciones.servidor = true).
 * Una salida cargada a mano no puede dejar el stock en negativo (409 sin_stock);
 * la venta web sí puede: si se vendió de más, el mail del dueño lo avisa.
 * Devuelve { saldo, movimiento }. Lanza un Error con .status (400 / 409) si algo no cierra.
 */
async function mover(datos, opciones = {}) {
  const d = datos || {};
  const servidor = opciones.servidor === true;
  const producto = String(d.producto || "");
  const tipo = String(d.tipo || "");
  const motivo = String(d.motivo || "");

  if (!esProductoConStock(producto)) throw errorDe(400, "Producto desconocido");
  if (!TIPOS[tipo]) throw errorDe(400, "Tipo de movimiento inválido");
  const cant = typeof d.cant === "number" ? d.cant : /^-?\d+$/.test(String(d.cant).trim()) ? Number(d.cant) : NaN;
  const max = tipo === "fijar" ? 100000 : 10000;
  const min = tipo === "fijar" ? 0 : 1;
  if (!Number.isInteger(cant) || cant < min || cant > max) {
    throw errorDe(400, tipo === "fijar" ? "La cantidad tiene que ser un número entero entre 0 y 100000" : "La cantidad tiene que ser un número entero entre 1 y 10000");
  }
  const permitidos = MOTIVOS_POR_TIPO[tipo].concat(servidor && tipo === "salida" ? ["venta_web"] : []);
  if (!permitidos.includes(motivo)) throw errorDe(400, "Motivo inválido");

  const quien = recortar(d.quien, 40);
  const nota = recortar(d.nota, 200);
  const ref = recortar(d.ref, 60);
  const k = clave(producto);

  let saldo;
  let antes;
  if (tipo === "fijar") {
    const previo = await redis(["SET", k, String(cant), "GET"]);
    const p = previo != null ? parseInt(previo, 10) : NaN;
    antes = Number.isFinite(p) ? p : null;
    saldo = cant;
  } else if (tipo === "entrada") {
    saldo = Number(await redis(["INCRBY", k, String(cant)]));
  } else {
    saldo = Number(await redis(["INCRBY", k, String(-cant)]));
    if (saldo < 0 && motivo !== "venta_web") {
      await redis(["INCRBY", k, String(cant)]); // deshace: no se puede sacar más de lo que hay
      throw errorDe(409, `Solo hay ${saldo + cant} en stock`, { codigo: "sin_stock", disponible: Math.max(0, saldo + cant) });
    }
  }

  const movimiento = { ts: new Date().toISOString(), producto, tipo, cant, motivo, quien, nota, ref, saldo };
  if (tipo === "fijar" && antes != null) movimiento.antes = antes;
  try {
    await pipeline([["LPUSH", "stock:movs", JSON.stringify(movimiento)], ["LTRIM", "stock:movs", 0, MAX_MOVS - 1]]);
  } catch (err) {
    // el stock ya cambió: no se lanza (reintentar duplicaría el movimiento), solo se avisa
    console.error("[BUBA] Stock: el movimiento se aplicó pero no quedó en el historial:", err.message);
    return { saldo, movimiento, sinHistorial: true };
  }
  return { saldo, movimiento };
}

/** Últimos movimientos, el más nuevo primero. */
async function movimientos(limit = 50) {
  const n = Math.min(Math.max(parseInt(limit, 10) || 50, 1), MAX_MOVS);
  const filas = await redis(["LRANGE", "stock:movs", 0, n - 1]);
  return (Array.isArray(filas) ? filas : [])
    .map((s) => { try { return JSON.parse(s); } catch { return null; } })
    .filter(Boolean);
}

// ---------- ventas web ----------

/** [{ id, qty }] de un pedido de la web (para el metadata de la preferencia de pago). Solo ids y cantidades. */
function itemsDePedido(order) {
  const items = order && Array.isArray(order.items) ? order.items : [];
  return items
    .map((it) => ({ id: String(it.id || "").slice(0, 40), qty: Math.floor(Number(it.qty)) }))
    .filter((it) => it.id && it.qty > 0);
}

/** Suma cantidades por producto y deja solo los que llevan stock (nunca el de prueba). */
function contarConStock(items) {
  const por = {};
  for (const it of Array.isArray(items) ? items : []) {
    const id = String(it && it.id || "");
    const qty = Math.floor(Number(it && (it.qty != null ? it.qty : it.cantidad)));
    if (!id || id === "prueba" || !(qty > 0) || !esProductoConStock(id)) continue;
    por[id] = (por[id] || 0) + qty;
  }
  return por;
}

/**
 * Antes de cobrar: ¿alcanza el stock? → null si alcanza (o si no se puede saber), o { producto, disponible }.
 * Si Redis falla no se frena la venta: se registra y se sigue.
 */
async function faltaStock(items) {
  if (!configurado()) return null;
  const pedidos = contarConStock(items);
  const ids = Object.keys(pedidos);
  if (!ids.length) return null;
  try {
    const st = await leerStock(ids);
    for (const id of ids) {
      if (st[id] != null && pedidos[id] > st[id]) return { producto: id, disponible: Math.max(0, st[id]) };
    }
  } catch (err) {
    console.error("[BUBA] Stock: no se pudo verificar la disponibilidad, se sigue con la venta:", err.message);
  }
  return null;
}

/**
 * Descuenta del stock una venta aprobada. Idempotente por pago: la marca stock:venta:<pagoId>
 * se crea con SET NX, así dos avisos del mismo pago descuentan una sola vez.
 * items: [{ id, qty }]. → { hecho: true, saldos: { pack4: n } } | { hecho: false, yaDescontado: true } | { hecho: false, sinItems: true }
 */
async function descontarVenta(pagoId, items, pedido) {
  const pedidos = contarConStock(items);
  const ids = Object.keys(pedidos);
  if (!ids.length) return { hecho: false, sinItems: true };

  const marca = `stock:venta:${pagoId}`;
  const primera = await redis(["SET", marca, "1", "NX", "EX", String(TTL_VENTA)]);
  if (primera !== "OK") return { hecho: false, yaDescontado: true };

  const saldos = {};
  try {
    for (const id of ids) {
      const r = await mover({ producto: id, tipo: "salida", cant: pedidos[id], motivo: "venta_web", quien: "Web", ref: pedido ? String(pedido) : String(pagoId) }, { servidor: true });
      saldos[id] = r.saldo;
    }
  } catch (err) {
    // si no se descontó nada, se suelta la marca para que un nuevo aviso pueda reintentar
    if (!Object.keys(saldos).length) { try { await redis(["DEL", marca]); } catch { /* nada */ } }
    throw err;
  }
  return { hecho: true, saldos };
}

// ---------- acceso (clave de la app) ----------

function igualesSeguro(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * Chequea la clave de stock. Header X-Stock-Clave (o ?clave= si porQuery, para el link de descarga).
 * → null si está bien, o { status, error, codigo } para responder.
 */
function autorizar(req, { porQuery = false } = {}) {
  const esperada = process.env.STOCK_CLAVE;
  if (!esperada) return { status: 503, error: "Falta STOCK_CLAVE", codigo: "sin_clave" };
  const h = req.headers || {};
  let dada = h["x-stock-clave"];
  if ((dada == null || dada === "") && porQuery) dada = (req.query || {}).clave;
  if (Array.isArray(dada)) dada = dada[0];
  if (dada == null || dada === "" || !igualesSeguro(dada, esperada)) return { status: 401, error: "Clave incorrecta", codigo: "clave" };
  return null;
}

/** Cantidad de packs en palabras: "queda 1 pack", "quedan 12 packs". */
const textoQuedan = (n) => `${Math.abs(n) === 1 && n > 0 ? "queda" : "quedan"} ${n} pack${n === 1 ? "" : "s"}`;

/** Umbral de "quedan pocos" (STOCK_AVISO, por defecto 10). */
function umbralAviso() {
  const n = parseInt(process.env.STOCK_AVISO, 10);
  return Number.isFinite(n) && n >= 0 ? n : 10;
}

module.exports = {
  configurado, redis, pipeline, productos, esProductoConStock, leerStock, mover, movimientos,
  descontarVenta, faltaStock, itemsDePedido, autorizar, textoQuedan, umbralAviso,
  MOTIVOS, TIPOS, MAX_MOVS,
};
