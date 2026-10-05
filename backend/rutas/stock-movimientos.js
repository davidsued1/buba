/**
 * BUBA — Stock actual + historial de movimientos (lo usa la app de Stock)
 *
 * GET /api/stock-movimientos    header X-Stock-Clave: <STOCK_CLAVE>   (o ?clave=… para el link de descarga)
 *   → { ok: true, stock: { pack4: n }, movimientos: [...] }   (los últimos 300, el más nuevo primero)
 * GET /api/stock-movimientos?formato=csv&clave=…
 *   → stock-buba.csv para abrir en Excel (todo el historial guardado: hasta 2000 movimientos)
 *     Separador ";" y BOM UTF-8: Excel en español lo abre en columnas y con las tildes bien.
 */
const { configurado, leerStock, movimientos, autorizar, MOTIVOS, TIPOS, MAX_MOVS } = require("../lib/stock");

const cors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Stock-Clave");
};

const PRODUCTOS = { pack4: "Pack de 4" };

/** "05/10/2026 14:32" en hora argentina. */
function fechaAR(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(d).map((x) => [x.type, x.value])
  );
  return `${p.day}/${p.month}/${p.year} ${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}

/** Texto de una celda: entre comillas si hace falta y a prueba de fórmulas (=, +, -, @ al principio). */
function celdaTexto(v) {
  let s = String(v == null ? "" : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Cantidad con signo: entrada +n, salida -n, ajuste = diferencia contra lo que había (o el conteo si no se sabe). */
function cantidadFirmada(m) {
  if (m.tipo === "entrada") return `+${m.cant}`;
  if (m.tipo === "salida") return `-${m.cant}`;
  if (typeof m.antes === "number") { const dif = m.saldo - m.antes; return dif > 0 ? `+${dif}` : String(dif); }
  return String(m.cant);
}

function aCSV(lista) {
  const cab = ["Fecha", "Producto", "Tipo", "Cantidad", "Motivo", "Quién", "Nota", "Referencia", "Stock después"];
  const filas = lista.map((m) => [
    fechaAR(m.ts),
    PRODUCTOS[m.producto] || m.producto,
    TIPOS[m.tipo] || m.tipo,
    cantidadFirmada(m),
    MOTIVOS[m.motivo] || m.motivo,
    m.quien, m.nota, m.ref,
    m.saldo,
  ].map((c, i) => (i === 3 || i === 8 ? String(c == null ? "" : c) : celdaTexto(c))).join(";"));
  return "﻿" + [cab.join(";"), ...filas].join("\r\n") + "\r\n";
}

module.exports = async (req, res) => {
  cors(res);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Método no permitido" });

  const no = autorizar(req, { porQuery: true });
  if (no) return res.status(no.status).json({ ok: false, error: no.error, codigo: no.codigo });
  if (!configurado()) {
    return res.status(503).json({ ok: false, error: "Falta conectar la base de datos de stock en Vercel", codigo: "sin_base" });
  }

  try {
    const csv = String((req.query || {}).formato || "").toLowerCase() === "csv";
    if (csv) {
      const lista = await movimientos(MAX_MOVS);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="stock-buba.csv"');
      return res.status(200).send(aCSV(lista));
    }
    const [stock, lista] = await Promise.all([leerStock(), movimientos(300)]);
    return res.status(200).json({ ok: true, stock, movimientos: lista });
  } catch (err) {
    console.error("[BUBA] Stock: no se pudo leer el historial:", err.message);
    return res.status(503).json({ ok: false, error: "No se pudo leer la base de stock. Probá de nuevo.", codigo: "redis" });
  }
};

module.exports.aCSV = aCSV;
