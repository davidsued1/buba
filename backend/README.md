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
| `SITE_URL` | No | Dirección de la tienda. Si falta, se deduce sola (Pago TIC: `https://bubadrinks.com.ar`) |

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
| `FASTMAIL_AUTO` | No | Guías automáticas **prendidas por defecto**. Poné `no` para apagarlas (los envíos se cargan a mano y el mail de venta lo avisa) |

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

## Mail al cliente

Con cada pago aprobado, además del aviso para vos, el comprador recibe un **mail de
confirmación de pedido** con la marca de BUBA: lo que compró, el total, cuándo sale
y llega (primer día hábil siguiente a la compra, más 24 hs hábiles de Fast Mail), la
dirección, el número de seguimiento si la guía se creó sola y botones de WhatsApp e
Instagram. En retiro en persona avisa que lo contactan por WhatsApp.

Para que salga hace falta:

1. **Verificar el dominio** `bubadrinks.com.ar` en Resend (Domains). Sin dominio verificado,
   Resend solo deja escribirle al dueño de la cuenta, no a clientes.
2. Cargar `MAIL_FROM` en Vercel con ese dominio, por ejemplo `BUBA Drinks <hola@bubadrinks.com.ar>`.
   **Si `MAIL_FROM` no está, el mail al cliente no se manda** (el aviso de venta sigue saliendo).

| Variable | Obligatoria | Para qué |
|---|---|---|
| `MAIL_FROM` | Sí, para que salga | Remitente con el dominio verificado |
| `MAIL_REPLY_TO` | No | A dónde le llegan las respuestas del cliente. Por defecto `bubadrinks0@gmail.com` |
| `SITE_URL` | No | Dirección del sitio, de donde se carga el logo. Por defecto `https://bubadrinks.com.ar` |

- Para ver exactamente qué recibe un cliente, abrí `/api/mail-prueba?cliente=1`: manda el mail
  con datos de ejemplo (1 pack, envío a CABA, guía creada) a la casilla de `MAIL_AVISOS`
  (como mucho uno por hora).
- Sale una sola vez por pago, aunque Mercado Pago avise dos veces. Log: `[BUBA] Mail al cliente`
  (solo muestra el dominio del mail, no la dirección).
- En tu aviso de venta, **Responder** le escribe directo al cliente.

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

## Pago TIC (segunda opción de cobro, en prueba)

Pago TIC (antes "Pay per TIC") se suma como **segundo botón** al lado de Mercado Pago, con todos los
medios que tenga habilitados la cuenta: tarjeta, transferencia, DEBIN, cupón de pago en efectivo, etc.
Queda **oculto** hasta que lo actives. Mercado Pago no cambia en nada. Detalle del contrato y dudas
abiertas: `docs/11_Pago_TIC.md`.

| Variable | Obligatoria | Para qué |
|---|---|---|
| `PAGOTIC_USERNAME` | Sí | Usuario de la API |
| `PAGOTIC_PASSWORD` | Sí | Contraseña de la API |
| `PAGOTIC_CLIENT_ID` | Sí | `client_id` de OAuth |
| `PAGOTIC_CLIENT_SECRET` | Sí | `client_secret` de OAuth |
| `PAGOTIC_API_URL` | No | Base de la API. Por defecto `https://api.paypertic.com` (producción). Para pruebas, la del sandbox que te pasen |
| `PAGOTIC_AUTH_URL` | No | URL del token. Por defecto `https://a.paypertic.com/auth/realms/entidades/protocol/openid-connect/token` |
| `PAGOTIC_COLLECTOR_ID` | No | Si lo definís, se manda como `collector_id` al crear el pago y se usa de filtro al consultar |

Las credenciales viven solo en Vercel (nunca en la web, el panel ni el repositorio). Además se usa
`SITE_URL` (ver arriba): a ella vuelve el cliente después de pagar, y si falta se usa `https://bubadrinks.com.ar`.

| Dirección | Para qué |
|---|---|
| `/api/pagotic-crear` | La web la llama al tocar "Pagar con Pago TIC": crea el pago y devuelve `form_url` (adonde se manda al cliente) |
| `/api/pagotic-vuelta` | Pago TIC manda acá al cliente (por POST) al terminar; lo redirige (303) a la tienda con `?pago=ok\|pendiente\|error&pedido=…&proveedor=pagotic`. No confirma nada |
| `/api/pagotic-webhook` | Pago TIC avisa acá cada cambio de estado. El aviso no viene firmado: se consulta el pago a su API y solo se actúa sobre esa respuesta. `approved` → mismo flujo que Mercado Pago (guía de Fast Mail, mail al dueño, mail al cliente, contacto); `refunded` → mail de devolución; el resto, solo log. Siempre responde 200 |
| `/api/estado-pago?proveedor=pagotic&pedido=BUBA-XXXX` | La web la usa al volver para mostrar el estado real (también acepta `&id=<UUID>`) |
| `/api/pagotic-estado` | Prueba de conexión: pide un token y dice si las credenciales andan (abrila en el navegador) |

Las transferencias y cupones pueden quedar `pending`/`issued` por horas: la web muestra "Tu pago está en proceso"
y la venta (guía y mails) se procesa recién cuando el webhook ve `approved`. El remito de Fast Mail sale del UUID
del pago (primeros 15 caracteres hexadecimales pasados a decimal), así un aviso repetido no duplica nada.

**Cómo probarlo**

1. Cargá las 4 variables `PAGOTIC_*` en Vercel (y `PAGOTIC_API_URL` / `PAGOTIC_AUTH_URL` si es el sandbox) y volvé a deployar.
2. Abrí `https://<tu-backend>.vercel.app/api/pagotic-estado`: tiene que decir `"Conectado con Pago TIC"`. Si falla, muestra qué variable falta o el error de Pago TIC.
3. En el panel → **Configuración → Pago TIC (prueba)** tocá **Probar conexión**, tildá **Mostrar el botón de Pago TIC en el checkout**, **Guardar** y **Publicar**.
4. Hacé una compra de prueba: en el paso 3 aparece **Pagar con Pago TIC**. Pagá con el medio de prueba que te den.
5. Mirá en Vercel → Logs que llegue `[BUBA] Pago TIC recibido` y, al aprobarse, los mails. Para apagarlo, destildá la casilla y publicá.

**Devoluciones.** Hoy el mail de devolución es solo un recordatorio (igual que con Mercado Pago). Para devolver
la plata hay que pedirlo a Pago TIC: `POST {API}/pagos/devolucion/{id}` con `{"type":"online"}` y el token
`Bearer` (todavía no está automatizado). Cuando el pago pasa a `refunded`, el webhook manda el aviso.

## Probar sin cobrar de verdad

Usá el Access Token de **prueba** (empieza con `TEST-`) en vez del de
producción. `/api/estado` te avisa cuando estás en ese modo. Las tarjetas
de prueba están en la documentación de Mercado Pago.
