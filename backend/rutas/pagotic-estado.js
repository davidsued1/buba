/**
 * BUBA — Prueba de conexión con Pago TIC
 *
 *   GET /api/pagotic-estado
 *
 * Pide un token con las credenciales cargadas en Vercel. No crea ni cobra nada y no devuelve
 * ninguna credencial. Lo usa el botón "Probar conexión" del panel (Configuración → Pago TIC).
 */
const { configurado, faltantes, token, apiUrl } = require("../lib/pagotic");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!configurado()) {
    const faltan = faltantes();
    return res.status(200).json({
      ok: false,
      mensaje: "Faltan variables de Pago TIC en Vercel: " + faltan.join(", "),
      faltan,
    });
  }
  const t = await token({ fresco: true });
  if (!t.ok) {
    return res.status(200).json({ ok: false, mensaje: t.mensaje, http: t.http, detalle: t.detalle });
  }
  // Diagnóstico de solo lectura: ?pedido=BUBA-XXXX&email=<mail del pagador>
  // Busca ese pedido (mail + fecha) y prueba la consulta por id. Exige pedido y mail juntos
  // y devuelve solo datos mínimos de pagos de ese pedido.
  const q = req.query || {};
  const pedido = String(q.pedido || "").trim();
  const email = String(q.email || "").trim();
  if (/^BUBA-[A-Z0-9-]{3,40}$/i.test(pedido) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const P = require("../lib/pagotic");
    const b = await P.buscarPorPedido(pedido, email);
    const minimo = (p) => ({
      id: p.id, pedido: p.external_transaction_id, estado: p.status, monto: p.final_amount,
      tipo: p.type || null, cobrador: p.collector_id || (p.collector && (p.collector.id || p.collector)) || null,
    });
    const salida = { ok: true, consulta: "diagnostico", busqueda: { http: b.http, encontrados: b.pagos.length, error: b.texto ? P.limpiar(b.texto, 200) : undefined }, pagos: b.pagos.map(minimo) };
    if (b.pagos[0] && b.pagos[0].id) {
      const r = await P.api("GET", "/pagos/" + encodeURIComponent(b.pagos[0].id));
      salida.consulta_por_id = { http: r.http, funciona: r.http >= 200 && r.http < 300, error: r.http >= 300 ? P.limpiar(r.texto || "", 200) : undefined };
    }
    return res.status(200).json(salida);
  }

  return res.status(200).json({
    ok: true,
    mensaje: "Conectado con Pago TIC",
    api: apiUrl(),
    expira_en: t.expira_en,
  });
};
