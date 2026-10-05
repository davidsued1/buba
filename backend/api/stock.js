/**
 * BUBA — Stock actual (público, solo lectura)
 *
 * GET /api/stock → { ok: true, stock: { pack4: 48 } }
 * La web de la tienda lo lee para mostrar "Sin stock" / "Últimas N" con el número real.
 * Si la base de stock no está conectada: { ok: false } (la web sigue con lo que dice store.json).
 * El stock se maneja desde la app de Stock (/stock/). Ver backend/lib/stock.js y docs/12_Stock.md.
 */
const { configurado, leerStock } = require("../lib/stock");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Método no permitido" });

  if (!configurado()) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: false });
  }
  try {
    const stock = await leerStock();
    res.setHeader("Cache-Control", "public, max-age=10");
    return res.status(200).json({ ok: true, stock });
  } catch (err) {
    console.error("[BUBA] Stock: no se pudo leer:", err.message);
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({ ok: false });
  }
};
