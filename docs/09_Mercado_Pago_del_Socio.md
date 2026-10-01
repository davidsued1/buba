# Cobrar con el Mercado Pago del socio (mientras sale el CUIT)

Hasta que exista la cuenta de la sociedad, la web cobra con la cuenta de
Mercado Pago del socio. Cuando salga la de la sociedad se cambia **una sola
clave en Vercel** y la web no se toca.

Conviene hacerlo **los dos juntos en una compu** (unos 20 minutos): la
clave secreta sale de la cuenta del socio y termina en el Vercel de David.
Así nunca viaja por WhatsApp, mail ni chats.

## Parte 1 — La clave de Mercado Pago (la hace el socio, con su cuenta)

1. Entrar a <https://www.mercadopago.com.ar/developers/panel> y tocar
   **Crear aplicación**.
2. Nombre: **BUBA**. Tipo: **Pagos online**, con **Checkout Pro**.
3. Entrar a **Credenciales de producción**. Si pide activarlas:
   - Industria: **Alimentos y bebidas**
   - Sitio web: **https://bubadrinks.com.ar**
4. Copiar el **Access Token** (empieza con `APP_USR-`). No guardarlo en
   ningún lado: va directo a la parte 2.

## Parte 2 — El servidor en Vercel (la hace David, con su GitHub)

1. Entrar a <https://vercel.com/new> → **Continue with GitHub** (cuenta
   davidsued1).
2. Elegir el repositorio **buba** → **Import**.
3. En **Root Directory** tocar **Edit** y elegir la carpeta **backend**.
4. Abrir **Environment Variables** y agregar:
   - Name: `MP_ACCESS_TOKEN`
   - Value: la clave que copió el socio
5. **Deploy**. Vercel da una dirección tipo `https://buba-xxxx.vercel.app`.

## Parte 3 — Conectarlo con la web

1. Panel BUBA → **Configuración → Cobrar con Mercado Pago**.
2. Pegar la dirección de Vercel → **Probar el cobro**. Tiene que decir
   **"✓ Conectado"** en **modo producción**.
3. **Publicar**.

## Parte 4 — Compra de prueba real

1. En el panel bajar el precio del pack a **$100** y publicar (la web sigue
   cerrada con código, nadie más la ve).
2. Comprar desde el celular de David con **su** tarjeta o cuenta, no con la
   del socio: Mercado Pago no deja pagarse a uno mismo.
3. Verificar que al socio le llegue el aviso del pago y que la web muestre
   "¡Pedido confirmado!".
4. El socio devuelve la plata desde la actividad de ese cobro.
5. Volver el precio a **$24.000** y publicar.

## A tener en cuenta

- **Impuestos:** mientras tanto las ventas entran a nombre del socio.
  Hablarlo con el contador por su categoría de monotributo.
- **Si algo falla:** mandar captura de la pantalla, nunca la clave. Si la
  clave se llega a ver en una foto o mensaje, el socio la renueva desde el
  mismo panel de Mercado Pago.
- **Los datos de envío** (dirección, teléfono, notas) todavía no llegan a
  ningún lado: el aviso de Mercado Pago trae monto, nombre y número de
  pedido. Se resuelve con la planilla de pedidos (Fase 2 del plan).

## El día que salga la cuenta de la sociedad

1. Repetir la **parte 1** con la cuenta de la sociedad.
2. Vercel → proyecto → **Settings → Environment Variables** → editar
   `MP_ACCESS_TOKEN` y pegar la clave nueva → **Save**.
3. **Deployments** → los tres puntitos del último → **Redeploy**.
4. Panel → **Probar el cobro**. Listo: no hay que tocar la web.
