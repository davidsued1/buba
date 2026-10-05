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
| `/api/suscribir` | La usa el formulario "Avisame" de la web para anotar un mail (ver "Contactos para novedades") |

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

Cada vez que se aprueba un pago, el backend te manda un mail (pensado para leerlo
en el celular) con el total, lo que compró, el cliente con botones de WhatsApp y
mail, el envío con la dirección lista para copiar y, si la guía de Fast Mail se
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

**Mail de devolución.** Si Mercado Pago devuelve la plata de una venta (reembolso
total, devolución parcial o contracargo), el backend manda un segundo mail, con
asunto 🔴 *Venta devuelta*, 🔴 *Contracargo* o 🟠 *Devolución parcial*. Trae el
pedido, el monto, lo devuelto y los datos del cliente, y te recuerda dar de baja
la guía en fastmail.com.ar (si Fast Mail está configurado, busca el número de
guía por el remito). **No anula nada solo**: es solo un recordatorio, y en las
devoluciones parciales no se vuelve a crear la guía ni a mandar el mail de venta.
También sale una sola vez por devolución (log: `[BUBA] Mail de devolución`). Los
pagos cancelados o rechazados no mandan nada.

## Contactos para novedades (Resend)

Cada vez que se aprueba una compra, el mail del comprador se guarda en los
**Contactos de Resend** (en cuentas viejas, en la Audience **"Clientes BUBA"**,
que se crea sola si no existe). Así tenés la lista armada para mandar novedades
por mail más adelante. Va después del aviso de venta y nunca lo frena: el
resultado queda en los logs de Vercel (`[BUBA] Contacto`).

- Si el cliente destildó "quiero recibir novedades" en el checkout, se guarda
  igual pero como **desuscripto**: no le llega ningún broadcast. Si no hay dato, se asume que sí quiere.
- A quien ya estaba cargado no se lo vuelve a suscribir nunca; solo se lo da de baja si lo pidió.
- Las devoluciones, los pagos cancelados y los segundos avisos del mismo pago no guardan nada.

**Importante: la API key de Resend tiene que ser "Full access".** Las claves
creadas solo con permiso de *Sending access* mandan mails pero **no pueden
tocar contactos**; en ese caso el log dice "La clave de Resend no tiene permiso
para contactos". Creá una nueva en Resend → API Keys → *Full access* y
reemplazala en `RESEND_API_KEY`.

| Variable | Obligatoria | Para qué |
|---|---|---|
| `RESEND_AUDIENCE_ID` | No | Id de la audiencia a usar (solo cuentas con Audiences). Si falta, se busca o crea "Clientes BUBA" |

**Formulario "Avisame" (`/api/suscribir`).** Recibe `POST` con JSON
`{ "email": "...", "origen": "pre-lanzamiento" }` (`origen` puede ser
`pre-lanzamiento` o `web`; por defecto `web`). Responde `{ "ok": true }` aunque
el mail ya estuviera anotado. Si falta la clave de Resend o no tiene permiso,
responde `{ "ok": false }` y el motivo queda en los logs. El campo `sitio` es una
trampa para robots: tiene que ir vacío.

**Ver, exportar y mandar novedades.** En <https://resend.com/audience> (o *Contacts*)
ves todos los contactos y podés exportarlos a CSV. Para mandar una novedad a todos:
*Broadcasts → Create broadcast*, elegí la audiencia "Clientes BUBA" (o el segmento),
escribí el mail y enviá. Resend agrega solo el link para darse de baja y respeta
a los desuscriptos. Para mandar broadcasts desde tu dominio, verificalo antes en Resend.

## Probar sin cobrar de verdad

Usá el Access Token de **prueba** (empieza con `TEST-`) en vez del de
producción. `/api/estado` te avisa cuando estás en ese modo. Las tarjetas
de prueba están en la documentación de Mercado Pago.
