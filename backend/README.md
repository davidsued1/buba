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

## Envíos con Fast Mail

Cuando un pago con envío a domicilio (no "retiro") se aprueba en Mercado
Pago, el backend puede crear solo la guía en Fast Mail (e-Presis).

| Variable | Obligatoria | Para qué |
|---|---|---|
| `FASTMAIL_TOKEN` | Sí | Token de la API que mandó Fast Mail |
| `FASTMAIL_SUCURSAL` | Sí | Código de sucursal (ej. `APP003`) |
| `FASTMAIL_CP` | Sí | Código postal de retiro (ej. `1425`) |
| `FASTMAIL_SERVICIO` | No | Código de servicio. Por defecto `24` (Servicio 24hs) |
| `FASTMAIL_AUTO` | No | Poné `si` para activar las guías automáticas. **Apagado por defecto**: sin esto solo se anota en los logs |

- Para probar la conexión sin crear nada, abrí `/api/fastmail-estado`.
- Las guías aparecen en tu cuenta web de Fast Mail, desde ahí se imprimen las etiquetas.
- Cada pack es una caja de 15 × 15 × 7,5 cm y se declara 1 kg por caja.
- Si Mercado Pago avisa dos veces el mismo pago, no se duplica la guía.
- Después de cambiar variables en Vercel hay que hacer **Redeploy**.

## Avisos por mail

Cada vez que se aprueba un pago, el backend te manda un mail con el pedido,
los productos, los datos del cliente, el envío y, si la guía de Fast Mail se
creó sola, **la etiqueta adjunta** lista para imprimir. Usa [Resend](https://resend.com).

1. Creá una cuenta en <https://resend.com> y generá una **API key**.
2. En Vercel → Settings → Environment Variables cargá:

| Variable | Obligatoria | Para qué |
|---|---|---|
| `RESEND_API_KEY` | Sí | La API key de Resend |
| `MAIL_AVISOS` | Sí | Mails que reciben los avisos, separados por coma. Mientras el dominio no esté verificado en Resend, tiene que ser el mismo mail con el que te registraste |
| `MAIL_FROM` | No | Remitente. Cuando verifiques el dominio `bubadrinks.com.ar` en Resend, usá algo como `BUBA Drinks <ventas@bubadrinks.com.ar>`. Por defecto sale de `onboarding@resend.dev` |

3. Hacé **Redeploy**.

- Si Mercado Pago avisa dos veces el mismo pago, el mail sale una sola vez.
- Si falta `RESEND_API_KEY` o `MAIL_AVISOS`, simplemente no se mandan mails (lo demás sigue andando).
- El resultado del envío de cada mail queda en los logs de Vercel (`[BUBA] Mail de venta`).

## Probar sin cobrar de verdad

Usá el Access Token de **prueba** (empieza con `TEST-`) en vez del de
producción. `/api/estado` te avisa cuando estás en ese modo. Las tarjetas
de prueba están en la documentación de Mercado Pago.
