/**
 * BUBA — Rutas agrupadas en una sola función
 *
 * El plan gratis de Vercel acepta hasta 12 funciones (un archivo por función en api/).
 * Estas rutas viven en rutas/ y se atienden desde acá, con las mismas direcciones de siempre:
 *   /api/stock-movimiento, /api/stock-movimientos, /api/pagotic-estado,
 *   /api/fastmail-estado, /api/mail-prueba
 * Los archivos que están en api/ tienen prioridad; esto atiende solo lo que no tiene archivo propio.
 * Para sumar una ruta nueva sin pasar el límite: crear rutas/<nombre>.js y agregarla abajo.
 */
const RUTAS = {
  "stock-movimiento": require("../rutas/stock-movimiento"),
  "stock-movimientos": require("../rutas/stock-movimientos"),
  "pagotic-estado": require("../rutas/pagotic-estado"),
  "fastmail-estado": require("../rutas/fastmail-estado"),
  "mail-prueba": require("../rutas/mail-prueba"),
};

module.exports = async (req, res) => {
  const ruta = String((req.query || {}).ruta || "");
  const atender = Object.prototype.hasOwnProperty.call(RUTAS, ruta) ? RUTAS[ruta] : null;
  if (!atender) return res.status(404).json({ error: "No existe", ruta });
  return atender(req, res);
};
