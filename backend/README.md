# Pagos de BUBA con Mercado Pago

Esta carpeta es el "cajero" de la tienda: recibe el pedido desde la web,
lo registra en Mercado Pago y devuelve el link donde el cliente paga.

Hace falta porque la clave secreta de Mercado Pago **no puede vivir dentro
de la web** (cualquiera podría verla y cobrar en tu nombre). Acá queda
guardada en un servidor, escondida.

## Qué queda habilitado

Tarjeta de crédito y débito, dinero en cuenta de Mercado Pago,
transferencia, efectivo (Rapipago / Pago Fácil) y hasta 12 cuotas.

## Cómo ponerlo online (una sola vez)

1. **Sacá tu clave de Mercado Pago**
   - Entrá a <https://www.mercadopago.com.ar/developers/panel>
   - Creá una aplicación (nombre: `BUBA`, tipo: pagos online / Checkout Pro)
   - Andá a **Credenciales de producción** y copiá el **Access Token**
     (empieza con `APP_USR-`)

2. **Publicá esta carpeta en Vercel** (gratis)
   - Entrá a <https://vercel.com> y creá la cuenta con **Continue with GitHub**
   - **Add New… → Project** → elegí el repositorio `buba` → **Import**
   - En **Root Directory** tocá *Edit* y elegí la carpeta **`backend`**
   - Abrí **Environment Variables** y agregá:
     - Name: `MP_ACCESS_TOKEN` · Value: el Access Token del paso 1
   - **Deploy**

3. **Conectalo con la tienda**
   - Vercel te da una dirección tipo `https://buba-pagos.vercel.app`
   - Pegala en el panel BUBA → **Configuración → Cobrar con Mercado Pago**
   - Tocá **Probar el cobro**: tiene que decir "✓ Conectado"
   - **Publicar**

## Variables

| Variable | Obligatoria | Para qué |
|---|---|---|
| `MP_ACCESS_TOKEN` | Sí | La clave de tu cuenta de Mercado Pago |
| `SITE_URL` | No | Dirección de la tienda. Si falta, se deduce sola |

## Direcciones que expone

| Dirección | Para qué |
|---|---|
| `/api/estado` | Dice si la conexión con Mercado Pago está bien (abrila en el navegador) |
| `/api/create-preference` | La usa la web al tocar "Pagar con Mercado Pago" |
| `/api/mp-webhook` | Mercado Pago avisa acá cuando se confirma un pago |

## Probar sin cobrar de verdad

Usá el Access Token de **prueba** (empieza con `TEST-`) en vez del de
producción. `/api/estado` te avisa cuando estás en ese modo. Las tarjetas
de prueba están en la documentación de Mercado Pago.
