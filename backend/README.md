# BUBA — Backend de pagos (Mercado Pago)

Funciones serverless que le dan a la web el pago online real. Se deployan gratis en [Vercel](https://vercel.com) en ~10 minutos.

## Qué hace

| Endpoint | Función |
|---|---|
| `POST /api/create-preference` | Recibe la orden del checkout y crea la preferencia de Checkout Pro. Devuelve `init_point` (la URL de pago de Mercado Pago a la que se redirige al cliente). |
| `POST /api/mp-webhook` | Recibe las notificaciones de Mercado Pago cuando un pago se acredita o rechaza. |

## Cómo deployarlo (una sola vez)

1. Crear cuenta gratis en **vercel.com** (con el mismo GitHub sirve).
2. **Add New → Project** → importar el repo `davidsued1/buba`.
3. En "Root Directory" elegir la carpeta **`backend`**.
4. En **Environment Variables** cargar:
   - `MP_ACCESS_TOKEN` → el Access Token de producción de Mercado Pago
     (Mercado Pago → Tu negocio → Configuración → Credenciales → Access Token).
   - `SITE_URL` → `https://bubadrinks.com.ar`
5. Deploy. Vercel te da una URL tipo `https://buba-backend.vercel.app`.
6. Pegar esa URL en el **panel de BUBA → Configuración → Pagos** y publicar.

Con eso, el botón **"Pagar con Mercado Pago"** del checkout queda funcionando de verdad: el cliente paga en Mercado Pago y vuelve a la web.

## Próximos pasos previstos (la estructura ya lo contempla)

- **Base de datos de pedidos** (Vercel KV / Firebase): que las órdenes de todos los clientes lleguen al panel, no solo las del navegador local.
- **Webhook → estado del pedido**: marcar "pagado" automáticamente cuando MP acredita.
- **Cotización de envíos por API**: Correo Argentino / Andreani calculando el precio real por código postal en el checkout.
