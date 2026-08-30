/**
 * BUBA — Chequeo de la conexión con Mercado Pago
 *
 * Abriendo esta dirección en el navegador (o desde el panel) se ve de una
 * si el Access Token está bien cargado y a qué cuenta pertenece.
 * No expone el token: solo dice si funciona y de quién es la cuenta.
 */
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    return res.status(200).json({
      ok: false,
      motivo: "sin_token",
      mensaje: "Falta cargar el Access Token. En Vercel: Settings → Environment Variables → agregar MP_ACCESS_TOKEN, y después Redeploy.",
    });
  }

  const esPrueba = /^TEST-/.test(token);
  try {
    const r = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      return res.status(200).json({
        ok: false,
        motivo: r.status === 401 ? "token_invalido" : "error_mp",
        mensaje: r.status === 401
          ? "El Access Token no es válido. Copialo de nuevo desde Mercado Pago (Tus integraciones → Credenciales de producción)."
          : "Mercado Pago respondió con un error (" + r.status + ").",
      });
    }
    const cuenta = await r.json();
    return res.status(200).json({
      ok: true,
      modo: esPrueba ? "prueba" : "produccion",
      cuenta: cuenta.nickname || cuenta.email || "—",
      pais: cuenta.site_id,
      mensaje: esPrueba
        ? "Conectado en modo PRUEBA. Sirve para probar, pero no cobra plata de verdad: cambiá al token de producción cuando quieras vender."
        : "Todo listo: los pagos van a tu cuenta de Mercado Pago.",
    });
  } catch (err) {
    return res.status(200).json({ ok: false, motivo: "sin_conexion", mensaje: "No se pudo hablar con Mercado Pago: " + err.message });
  }
};
