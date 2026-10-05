/**
 * BUBA — Cargar un movimiento de stock (lo usa la app de Stock)
 *
 * POST /api/stock-movimiento   header X-Stock-Clave: <STOCK_CLAVE>
 *   { producto: "pack4", tipo: "entrada" | "salida" | "fijar", cant, motivo, quien, nota }
 *   → { ok: true, saldo, movimiento }
 *
 * 401 clave incorrecta · 503 falta STOCK_CLAVE o la base de stock · 400 datos inválidos ·
 * 409 sin_stock (una salida no puede dejar el stock en negativo; para corregir, "Ajustar conteo").
 * El motivo "venta_web" no se acepta por acá: solo lo carga el servidor cuando se vende.
 */
const { configurado, mover, autorizar } = require("../lib/stock");

const cors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Stock-Clave");
};

module.exports = async (req, res) => {
  cors(res);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Método no permitido" });

  const no = autorizar(req);
  if (no) return res.status(no.status).json({ ok: false, error: no.error, codigo: no.codigo });
  if (!configurado()) {
    return res.status(503).json({ ok: false, error: "Falta conectar la base de datos de stock en Vercel", codigo: "sin_base" });
  }

  try {
    let b = req.body;
    if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = null; } }
    if (!b || typeof b !== "object") return res.status(400).json({ ok: false, error: "Datos inválidos" });
    const r = await mover({ producto: b.producto, tipo: b.tipo, cant: b.cant, motivo: b.motivo, quien: b.quien, nota: b.nota });
    console.log("[BUBA] Stock", { tipo: r.movimiento.tipo, motivo: r.movimiento.motivo, cant: r.movimiento.cant, saldo: r.saldo, quien: r.movimiento.quien });
    return res.status(200).json({ ok: true, saldo: r.saldo, movimiento: r.movimiento });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ ok: false, error: err.message, ...(err.codigo ? { codigo: err.codigo, disponible: err.disponible } : {}) });
    }
    console.error("[BUBA] Stock: error cargando el movimiento:", err.message);
    return res.status(503).json({ ok: false, error: "No se pudo guardar en la base de stock. Probá de nuevo.", codigo: "redis" });
  }
};
