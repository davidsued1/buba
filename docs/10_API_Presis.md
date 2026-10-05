# API e-Presis (Fast Mail) — especificación para reimplementar en Node

Esto sale de leer el plugin oficial de WooCommerce que mandó Fast Mail
(`docs/referencia/wp-woo-fastmail/`, versión 5.3, de Presis Consultores).
No hay documentación oficial de la API: **todo lo de acá es lo que el plugin
manda y lee**. Donde el código no muestra el valor real, el JSON dice
"ejemplo". Las referencias son `archivo:línea` dentro de
`docs/referencia/wp-woo-fastmail/` (se abrevia `includes/` → `i/`).

El token real va en una variable de entorno de Vercel (por ejemplo
`PRESIS_API_TOKEN`). En este doc siempre aparece como `<API_TOKEN>`.

---

## 1. Conexión

| Dato | Valor | Fuente |
|---|---|---|
| Base URL | `https://epresislv.fastmail.com.ar/` | `i/api/sdk-epresis.php:23` |
| Método | `POST` con body JSON en **todos** los endpoints (el SDK soporta GET pero nadie lo usa) | `sdk-epresis.php:55,77-79` |
| `Content-Type` | `application/json` | `sdk-epresis.php:58` |
| Header extra | `aws-x-prs-wp: presis-<dominio>` (dominio del sitio, ej. `presis-bubadrinks.com.ar`); solo se manda si hay dominio | `sdk-epresis.php:57,59-61` |
| Autenticación | `api_token` **en el body** (no hay `Authorization`) | `sdk-epresis.php:88-90` |

**Campos comunes** que el SDK agrega a *todo* body si no vienen ya
(`sdk-epresis.php:86-104`):

```json
{ "api_token": "<API_TOKEN>", "cp_origen": "1425", "codigo_sucursal": "<SUCURSAL>", "sucursal": "<SUCURSAL>" }
```

- `cp_origen` = CP de origen (opción `fastmail_postal_code`, `wp-woo-fastmail.php:57`).
- `codigo_sucursal` y `sucursal` llevan **el mismo valor**, el "Código de sucursal en Fastmail" (opción `fastmail_branch_code`, `general.php:43-49`).
- Los valores "1425" y "<SUCURSAL>" son ejemplo; los da Fast Mail.

**Otros detalles del cliente PHP** (no hace falta copiarlos): sigue redirects
(máx. 10), acepta cualquier `Accept-Encoding`, HTTP/1.1, **timeout infinito** y
**desactiva la verificación SSL** (`sdk-epresis.php:67-73`). En Node conviene
poner timeout (8-10 s) y dejar el SSL activado; si falla el certificado hay que
preguntarle a Fast Mail (ver sección 4).

**Cómo vuelven los errores.** El plugin nunca mira el HTTP status; mira la forma
del JSON:

- Error general: objeto con `message` (`isset($this->services->message)`,
  `sdk-epresis.php:147,162,194`). Si el body no es un array donde se espera un
  array, el plugin lo trata como fallo (`WC_Calculate.php:182`, `Shipping.php:240`).
- Error por guía en `multi-guias`: el item trae `message` y no trae `guia`
  (`i/admin/orders_list/result_shipping.php:50-52`).
- Etiquetas/remitos devuelven archivo crudo, no JSON (ver 2.5).

**Test de conexión** — `POST api/v2/dummy-test.json`, body = solo campos comunes
(`sdk-epresis.php:34,213-216`). Está "conectado" si la respuesta tiene `cliente`
y `cliente !== "Error"` (`i/admin/setting-sections/general.php:9,18`).

```json
// respuesta (ejemplo; el plugin solo lee "cliente")
{ "cliente": "BUBA DRINKS" }
```

Endpoints declarados en el SDK que **el plugin no usa** (no los implementamos):
`api/v1/public/servicios.json`, `api/v2/cotizador.json`, `api/v2/guias.json`,
`api/v2/provincias.json`, `api/v2/localidades.json`, `api/v2/version_cms.json`
(`sdk-epresis.php:24,27,28,32,33,38`; ningún método los llama, salvo
`VerificarVersion` que nadie invoca: `sdk-epresis.php:274`).

---

## 2. Endpoints que sí usa el plugin

Todas las rutas son relativas a la base URL. Todos los bodies llevan además los
campos comunes de la sección 1.

### 2.1 Servicios del cliente — `api/v2/servicios-cliente.json`

Lista los servicios contratados y las sucursales de retiro de cada uno.
Body: solo campos comunes (`sdk-epresis.php:125-139,143`).

Respuesta leída por el plugin (array de servicios):

| Campo | Uso |
|---|---|
| `codigo_servicio` | código del servicio (clave en alias, deshabilitados, gratis) |
| `descripcion` | nombre mostrable |
| `id` | id del servicio |
| `sucursales[]` | puntos de retiro: `id`, `calle`, `altura`, `provincia`, `localidad`, `cp` (`sdk-epresis.php:149-181`) |

Solo se listan los servicios que tienen la propiedad `sucursales`
(`sdk-epresis.php:149`). Hay un bug de caché: llama a la API dos veces siempre
(`sdk-epresis.php:130,139`); no nos importa.

```json
// respuesta (ejemplo)
[{ "id": 12, "codigo_servicio": "PAQ-DOM", "descripcion": "Paquetería a domicilio",
   "sucursales": [{ "id": 3, "calle": "Av. Rivadavia", "altura": "1234", "provincia": "BUENOS AIRES", "localidad": "CABA", "cp": "1033" }] }]
```

### 2.2 Cotización — `api/v2/precio-servicio.json` (el que usa el checkout)

**El checkout usa `precio-servicio.json`**: `ObtenerPrecioServicios` apunta a
`$services_prices_endpoind` (`sdk-epresis.php:26,223-226`), y esa función es la
única que llama el cálculo de envío (`WC_Calculate.php:181`) y la consulta
"calcular envío" de la ficha de producto (`i/hooks/product/route_consult_delivery.php:78`).
`cotizador.json` está declarado (`:27`) pero no lo llama nadie. Por qué es el
elegido: el plugin necesita, por servicio, el precio, las sucursales y el
desglose por producto (`productos_finales`), que es lo que lee
(`WC_Calculate.php:295,360,390`). Hay que asumir que `cotizador.json` devuelve
otra forma; ver dudas.

Body (`WC_Calculate.php:114-160`):

```json
{
  "tiempo": "", "cp_destino": "1900", "is_urgente": false, "valor_declarado": 0,
  "productos": [
    { "id": 123, "bultos": 1, "peso": 1.2,
      "dimensiones": { "alto": 12, "largo": 20, "profundidad": 15 } }
  ],
  "api_token": "<API_TOKEN>", "cp_origen": "1425", "codigo_sucursal": "<SUCURSAL>", "sucursal": "<SUCURSAL>"
}
```

Cómo se arma cada valor:

- `cp_destino`: CP de envío del cliente, string tal cual (`WC_Calculate.php:165`);
  si no hay CP, no cotiza (`:167`). En órdenes: CP de envío, o de facturación si
  falta (`:118`).
- `tiempo`: siempre `""`. `is_urgente`: siempre `false` (`:120-122`).
- `valor_declarado`: **en la práctica siempre `0`** en la cotización. Toma
  `$this->declared_value` (`:123,130`), que arranca en 0 y solo se suma en
  `verify_classes()` (`:242`), que se ejecuta *después* de armar el body (`:169`
  vs `:175`) y solo para productos con "envío gratis por producto". La variable
  local `$declared_value` (`:115,145`) se calcula pero no se usa.
- `productos[].id`: ID del producto de WooCommerce (`:148`). Es lo que después
  vuelve en `productos_finales[].id`.
- `productos[].bultos` = cantidad en carrito × "Pack" del producto
  (`fastmail_products_for_pack`, default 1) (`:142-143,149`).
- `peso`: **kg**, float, redondeado a 2 decimales (`Helper.php:140,146`), valor
  por unidad de producto (no multiplicado por la cantidad).
- `dimensiones`: **cm**, redondeadas a 2 decimales (`Helper.php:139,143-145`) y
  luego **truncadas a entero** (`(int)`, `WC_Calculate.php:152-154`). Mapeo:
  `alto` = height, `largo` = **width**, `profundidad` = **length** (`:152-154`).
  Ojo: en la guía el mapeo es otro (ver 2.3).
- Si algún producto no tiene alto, largo, ancho o peso cargados, **no se cotiza
  nada** (`Helper.php:135-137`, `WC_Calculate.php:135-137`). Los productos
  virtuales se ignoran (`Helper.php:86,105`).

Respuesta (array; cada elemento es un servicio). Campos leídos:

| Campo | Uso | Línea |
|---|---|---|
| `servicio.cod_serv` | código de servicio → `codigo_servicio` al crear la guía | `WC_Calculate.php:299` |
| `servicio.descripcion` | nombre del servicio | `:416` |
| `precio.importe_total_flete` | **precio del envío** (el plugin no suma nada más) | `:360` |
| `precio.sucursales[]` | si existe `[0]`, el servicio es de retiro en sucursal y se ofrece una opción por sucursal | `:295,328` |
| `precio.sucursales[].id`, `.full_address`, `.localidad` | etiqueta de la opción | `:405-408` |
| `precio.productos_finales[].id`, `.valor_item` | desglose por producto (solo se usa para envío gratis por producto) | `:390-393` |

Si la respuesta **no es un array** (error con `message`, etc.), no se muestra
ningún envío (`:182`).

```json
// respuesta (ejemplo)
[{ "servicio": { "cod_serv": "PAQ-DOM", "descripcion": "Paquetería a domicilio" },
   "precio": { "importe_total_flete": 4850.5, "sucursales": [],
               "productos_finales": [{ "id": 123, "valor_item": 4850.5 }] } }]
```

### 2.3 Crear guías — `api/v2/multi-guias.json`

El plugin crea guías **solo con `multi-guias.json`** (`EnviarMultiGuias`,
`sdk-epresis.php:218-221`; `Shipping.php:238`). `guias.json` no se usa. Un
request puede llevar varias guías; para BUBA mandamos una por pedido.

Body: `{ "guias": [ <guia>, ... ] }` + campos comunes (`Shipping.php:198,238`).
Cada `<guia>` (`Shipping.php:112-196`):

```json
{
  "codigo_sucursal": "<SUCURSAL>", "codigo_servicio": "PAQ-DOM", "codigo_ceco": "",
  "nro_constancia": "", "lote": "", "canal": "WooCommerce", "nro_precinto": "",
  "fragil": 0, "remito": 1042, "guia_agente": "", "fob": 0, "internacional": false,
  "valor_declarado": 0, "isInversa": false, "observaciones": "Timbre roto, golpear",
  "contrareembolso": 0, "pago_en": "ORIGEN", "tipo_operacion": "ENTREGA PAQUETERIA",
  "cobro_cheque": 0, "cobro_efectivo": 0, "is_urgente": false,
  "sender": {
    "empresa": "BUBA Drinks", "calle": "Calle 123", "altura": "", "piso": "", "dpto": "",
    "celular": "", "otra_info": "", "cp": "1425", "codigo_sucursal": "<SUCURSAL>",
    "remitente": "BUBA Drinks", "provincia": "BUENOS AIRES", "localidad": "CABA",
    "email": "admin@bubadrinks.com.ar", "contacto": "", "other_info": ""
  },
  "comprador": {
    "codigo": "", "destinatario": "Juan Pérez", "calle": "Mitre", "altura": "450",
    "piso": "2", "dpto": "B", "localidad": "La Plata", "provincia": "BUENOS AIRES",
    "tipo_doc": "", "documento": "", "horario": "", "nro_socio": "",
    "info_adicional_1": "Mitre 450", "info_adicional_2": "2B", "info_adicional_3": "",
    "info_adicional_4": "", "info_adicional_5": "", "email": "juan@mail.com",
    "celular": "1155550000", "cuit": "", "empresa": "", "contenido": "PAQUETERIA", "cp": "1900"
  },
  "productos": [
    { "sku": "BUBA-PACK4", "sku2": "", "descripcion": "Pack x4 BUBA", "bultos": 1, "peso": 1.2,
      "dimensiones": { "alto": 12, "largo": 20, "profundidad": 15 }, "is_bundle": false }
  ]
}
```

Los valores son ejemplo; la **estructura y los valores fijos** salen del código.
Cómo se calcula cada uno:

- `codigo_servicio`: el `servicio.cod_serv` que eligió el cliente al cotizar. El
  plugin lo guarda en el pedido como `fastmail_shipping` = base64 de
  `{"service_code": "...", "sucursal": {...}|false}` (`Shipping.php:47-84`,
  `WC_Calculate.php:298-303`, `i/hooks/shipping/save_shipping_service.php:19-21`).
  Nosotros hay que guardar `cod_serv` (y la sucursal si es retiro) en el pedido.
- `codigo_sucursal`: opción de sucursal de origen (`Shipping.php:113`). Se repite
  en `sender.codigo_sucursal` (`:143`) y en los campos comunes.
- `codigo_ceco`: opción "Código ceco / centro de costo" o `""` (`:110,115`,
  `general.php:149-155`).
- `remito`: **ID del pedido** de WooCommerce (`:121`). Es la clave con la que
  después se matchea la respuesta, el seguimiento y el webhook de estados.
  Nosotros: usar nuestro ID de pedido (idealmente numérico, ver dudas).
- Valores fijos: `canal: "WooCommerce"`, `pago_en: "ORIGEN"`, `tipo_operacion:
  "ENTREGA PAQUETERIA"`, `comprador.contenido: "PAQUETERIA"`, `fragil: 0`,
  `fob: 0`, `internacional: false`, `isInversa: false`, `contrareembolso: 0`,
  `cobro_*: 0`, `is_urgente: false`, y varios strings vacíos (`:114-132`).
- `observaciones`: nota del cliente en el pedido (`:127`, `Helper.php:197`).
- `valor_declarado`: **suma** del "Valor declarado" cargado en cada producto
  (`fastmail_declared_value`), una vez por línea, **sin multiplicar por la
  cantidad** (`:195`, `Helper.php:510`). Si no se cargó, 0.
- `sender`: `empresa`/`remitente` = nombre del sitio; `calle` = dirección de la
  tienda entera (altura/piso/dpto vacíos); `cp` = CP de origen; `email` = mail
  admin; `localidad` = ciudad de la tienda; `provincia` = se le pasa la *ciudad*
  a `get_province_name`, que espera código de provincia, así que casi siempre da
  `"BUENOS AIRES"` (default) (`:134-150`, `Helper.php:411-417`). Para BUBA
  hardcodear los datos reales.
- `comprador.destinatario`: nombre y apellido de envío, o de facturación si no hay
  dirección de envío (`Helper.php:192`).
- `comprador.cp`: CP de envío, o facturación (`Helper.php:198,387-395`).
- `comprador.localidad`: ciudad de envío, o facturación (`Helper.php:201,376-384`).
- `comprador.provincia`: código de estado de WooCommerce → nombre en MAYÚSCULAS sin
  tilde (tabla abajo). Cualquier código desconocido o vacío cae en `"BUENOS AIRES"`
  (`Helper.php:365-373,409-487`).
- `comprador.email` y `.celular`: **email y teléfono de facturación** (`Helper.php:199-200`).
- `comprador.tipo_doc`, `.documento`, `.cuit`, `.horario`, `.nro_socio`, `.codigo`,
  `.info_adicional_3..5`: van **vacíos** salvo que se mapeen a un campo del
  checkout (ver "mapeo de campos" abajo).
- `comprador.info_adicional_1/2`: líneas 1 y 2 de la dirección tal cual
  (`Shipping.php:93-99,164-165`).
- `productos[]`: uno por línea del pedido. `sku` = SKU de WooCommerce; `sku2` =
  campo de producto "Sucursal local" (`fastmail_product_home_branch`, que se
  guarda como entero); `descripcion` = nombre sin HTML; `bultos` = cantidad ×
  "Pack" (default 1); `peso` = kg (2 decimales) por unidad; `is_bundle` = siempre
  `false` (`Helper.php:510-518`, `Shipping.php:178-195`).
- `productos[].dimensiones` (cm, **float**): `alto` = height, `largo` = **length**,
  `profundidad` = **width** (`Shipping.php:188-192`). **Distinto de la cotización**
  (donde largo=width, profundidad=length y todo entero). Ver dudas.
- Los productos que son bundle de WPC (`woosb_ids` con más de 1 ítem) se saltean
  en la guía (`Helper.php:498-504`). No aplica a BUBA si no usamos ese plugin.

**Separación de dirección** (`Helper.php:207-294`). Toma línea 1 de envío (o de
facturación si la de envío está vacía) y línea 2 igual:

1. Línea 1 con regex `/(^\d*[\D]*)(\d+)(.*)/` → `calle` = lo que va antes del
   primer bloque de dígitos, `altura` = ese bloque de dígitos, el resto se trata
   como piso/depto. "Mitre 450" → calle "Mitre", altura "450". Nombres de calle
   con número ("Calle 12 450") se rompen.
2. Si no hay número en la línea 1, lo busca en la línea 2.
3. Piso/depto se sacan de la línea 2 con una cascada de regex (`piso 2, depto B`,
   `depto B piso 2`, `12C`, etc.) (`Helper.php:296-362`).
4. Si el admin mapeó `calle`/`altura`/`piso`/`dpto` a campos de checkout
   propios, **esos valores pisan** esta lógica (`mapCheckout`, `Shipping.php:152-157,201-219`;
   se prueba primero el campo de envío, después el de facturación, y con prefijos
   `""`, `"-"`, `"_"` sobre el meta del pedido).
   **Para BUBA: pedir calle, altura, piso y depto en campos separados y no parsear.**

**Si el cliente eligió retiro en sucursal** (`precio.sucursales[]` presente):
`calle/altura/piso/dpto` salen de la sucursal, y `comprador.empresa` =
`sucursal.razonSocial` (`Helper.php:203,213-220`). Para entrega a domicilio,
`sucursal` es `false`/vacío.

**Provincias** (código WooCommerce AR → valor enviado, `Helper.php:411-484`):
C CIUDAD AUTONOMA DE BUENOS AIRES, B BUENOS AIRES, K CATAMARCA, H CHACO,
U CHUBUT, X CORDOBA, W CORRIENTES, E ENTRE RIOS, P FORMOSA, Y JUJUY,
L LA PAMPA, F LA RIOJA, M MENDOZA, N MISIONES, Q NEUQUEN, R RIO NEGRO,
A SALTA, J SAN JUAN, D SAN LUIS, Z SANTA CRUZ, S SANTA FE,
G SANTIAGO DEL ESTERO, V TIERRA DEL FUEGO, T TUCUMAN.
(No hay llamada a `provincias.json`: el nombre lo arma el plugin.)

**Respuesta.** Array con un elemento por guía enviada (`Shipping.php:240-257`):

| Campo | Significado |
|---|---|
| `remito` | el `remito` que mandamos (ID de pedido); así se asocia (`Shipping.php:247`) |
| `guia` | número de guía; si viene truthy, la guía se creó (`:248`) |
| `message` | texto de error cuando no hay `guia` (`result_shipping.php:52`) |

Si la respuesta no es un array o el primer elemento no tiene la propiedad `guia`,
el plugin lo trata como "Error al impactar envíos" (`Shipping.php:240-242`). El
número de guía se guarda como `fastmail_shipping_tracking_number` (`:250`).

```json
// respuesta ok (ejemplo)
[{ "remito": 1042, "guia": "FM000123456" }]
// respuesta con error (ejemplo)
[{ "remito": 1042, "guia": "", "message": "CP de destino inexistente" }]
```

### 2.4 Imprimir etiquetas — `api/v1/public/print_etiquetas.json`

Body: `{ "ids": "<guia1>,<guia2>" }` + campos comunes (`sdk-epresis.php:233-239`).
`ids` es un **string** con **números de guía** (no el ID de pedido) separados por
coma; el plugin pasa el valor guardado en `fastmail_shipping_tracking_number`
(`Shipping.php:266-269`, `i/admin/orders/shipping_information_external.php:127`).

La respuesta **no es JSON**: es el archivo crudo. Si empieza con `%PDF-` es un
PDF; si no, es **HTML** listo para imprimir (trae un botón "Cerrar" con
`id="exit"`, que el plugin reemplaza por "Volver") (`sdk-epresis.php:239-248`,
`Shipping.php:271-291`). En Node: leer como `arrayBuffer`/`Buffer`, mirar los
primeros 5 bytes, y servir con `application/pdf` o `text/html`.

### 2.5 Remitos — `api/v1/public/print_guias.json`

Idéntico a 2.4 (mismo body `{ "ids": "..." }`, misma respuesta PDF o HTML), pero
devuelve el **remito/documento de la guía** (`sdk-epresis.php:251-267`,
`Shipping.php:295-323`). Es el papel para el chofer/sucursal; la etiqueta es la
que va pegada al paquete.

### 2.6 Seguimiento — `api/v2/seguimiento.json`

Body: `{ "remito": "<ID de pedido>" }` + campos comunes (`sdk-epresis.php:269-272`).
Ojo: se consulta por **remito (ID de pedido)**, no por número de guía; el
shortcode lo rotula "Número de orden" (`i/shortcodes/tracking/shortcode_tracking_view.php:7`,
`i/admin/setting-sections/tracking.php:5`). No se sabe si también acepta la guía.

Respuesta leída (`i/shortcodes/tracking/route_tracking.php:15-16`): `status ===
"ok"` y `guia.fechas[]` con `fecha` y `estado`. Si no, "información no
encontrada".

```json
// respuesta (ejemplo)
{ "status": "ok", "guia": { "fechas": [
  { "fecha": "2026-10-06 09:12", "estado": "Admitido" },
  { "fecha": "2026-10-07 15:40", "estado": "En distribución" } ] } }
```

### 2.7 Estados — `api/v2/estados.json`

Lista los estados posibles de e-Presis, para mapearlos a estados de pedido.
Body: solo campos comunes (`sdk-epresis.php:203-206`). Respuesta: array de
`{ "codigo": ..., "nombre": ... }` (`i/admin/setting-sections/state-mapping.php:15-17`).

```json
// respuesta (ejemplo)
[{ "codigo": "ENT", "nombre": "Entregado" }, { "codigo": "DIS", "nombre": "En distribución" }]
```

### 2.8 Activar notificaciones de cambio de estado — `api/v2/integracion.json`

Le dice a Presis a qué URL avisar cuando cambia el estado de una guía. El plugin
lo llama cada vez que se abre la pestaña "Estados" de sus ajustes
(`state-mapping.php:23-29`, `sdk-epresis.php:208-211`).

```json
{ "plataforma": "wordpress", "url": "https://<tu-dominio>/api/presis-webhook",
  "notificacion": true, "token": "<API_TOKEN>", "sucursal": "<SUCURSAL>",
  "api_token": "<API_TOKEN>", "cp_origen": "1425", "codigo_sucursal": "<SUCURSAL>" }
```

`plataforma` es literalmente `"wordpress"` en el plugin; para otro valor hay que
preguntarle a Fast Mail (ver dudas). La `url` es **la que Presis va a llamar**:
en WP es `admin-ajax.php?action=fastmail_change_status_api`; para nosotros sería
un endpoint nuevo en `backend/api/`. La respuesta no se lee.

**Qué POSTea Presis al sitio** (`i/api/change-states.php:7-66`):

- Método `POST` (cualquier otro devuelve 404 `{"error":"Not Found"}`, `:16-22`).
- Body JSON con: `token` (debe ser **igual** al `api_token` configurado; si no,
  error "Token Inválido", `:28-30`), `orden` (**ID de pedido** = el `remito` que
  mandamos; requerido, `:32-34`), `estado` (texto legible, se guarda como nota,
  `:42`) y `codigo` (código de estado de `estados.json`, se compara con `===`
  contra el mapeo, `:44-46`).
- Cómo se ubica el pedido: `wc_get_order($request->orden)` (`:36`); si no existe,
  error "Orden no encontrada".
- Qué hace: agrega una nota al pedido y, para cada estado de WooCommerce mapeado
  a ese `codigo`, cambia el estado del pedido (`:42-51`). El mapeo es la opción
  `fastmail_status_change[wc-<estado>] = <codigo>` (`state-mapping.php:31-37`).
- Respuesta: `200 {"success": true}`; en error `500 {"error": "<mensaje>"}`
  (`:53-62`).

```json
// lo que Presis envía (ejemplo; los 4 campos salen del código)
{ "token": "<API_TOKEN>", "orden": 1042, "estado": "Entregado", "codigo": "ENT" }
```

---

## 3. Flujo recomendado para BUBA

1. **Carrito/checkout**: pedir CP (y dirección en campos separados: calle, altura,
   piso, depto). Llamar `precio-servicio.json` con `cp_destino` y UN producto
   (el pack x4) con peso en kg y medidas en cm. Mostrar los servicios de
   `importe_total_flete`; guardar el `cod_serv` elegido (y la sucursal si es
   retiro). Cachear cotización corta por CP (no hay caché en el plugin para
   precios: `sdk-epresis.php:116`).
2. **Pago aprobado en Mercado Pago** (webhook `mp-webhook.js`): recién ahí llamar
   `multi-guias.json` con una guía, `remito` = ID de pedido. El plugin hace lo
   mismo al pasar el pedido al estado configurado (`i/hooks/shipping/send_epresis.php:37-52`)
   y evita duplicar si ya hay número de guía (`:46`): **hacer lo mismo
   (idempotencia)**, porque Mercado Pago reenvía webhooks. Guardar `guia` y
   `message` de error.
3. **Etiqueta**: `print_etiquetas.json` con `ids = guia`. Servir PDF o HTML según
   los primeros bytes (`%PDF-`). Opcional: `print_guias.json` para el remito.
4. **Seguimiento**: `seguimiento.json` por `remito` (ID de pedido) para la página
   de seguimiento, y/o registrar el webhook con `integracion.json`.

Configuración del plugin que se traduce a algo nuestro:

| Ajuste del plugin | Para BUBA |
|---|---|
| Token, CP origen, código de sucursal (`general.php:26-49`) | variables de entorno `PRESIS_API_TOKEN`, `PRESIS_CP_ORIGEN`, `PRESIS_SUCURSAL` |
| Campos de envío/facturación (`field-mapping.php`, `billing-mapping.php`) | no parsear: enviar `calle/altura/piso/dpto/documento/celular` ya separados |
| Mapeo de estados (`state-mapping.php`) | tabla `codigo` de Presis → estado interno del pedido |
| Alias de servicios (`alias-services.php`) | nombre amigable por `cod_serv` (el plugin los guarda como base64 del código) |
| Deshabilitar servicios (`disable-services-branches.php`) | lista de `cod_serv` a ocultar |
| Sucursal de origen | `codigo_sucursal` (y `sender.codigo_sucursal`) |
| Valor declarado por producto (`product_declared_value.php`) | precio del pack; ojo con que no se multiplica por cantidad |
| "Pack" / cantidad por pack (`product_quantity_for_pack.php`) | multiplica `bultos`; para un pack de 4 latas lo normal es 1 pack = 1 bulto |
| Envío gratis por monto/servicio (`general.php:101-127`) | opcional: si el total ≥ X, mostrar costo 0 (lógica en `WC_Calculate.php:359-398`) |
| Código CECO (`general.php:149`) | si Fast Mail lo da, va en `codigo_ceco` |

---

## 4. Dudas para Fast Mail

1. **Qué devuelve `cotizador.json`** y en qué difiere de `precio-servicio.json`.
   Confirmar que el checkout debe usar `precio-servicio.json`, y si
   `importe_total_flete` incluye IVA.
2. **Dimensiones/peso**: el plugin invierte `largo`/`profundidad` entre cotización
   (largo=width) y guía (largo=length), y cotiza con enteros pero crea con
   decimales. ¿Cuál es el orden correcto? ¿`peso` es por bulto o total, y se
   multiplica por `bultos`? ¿Las unidades son kg y cm (el plugin convierte a eso)?
3. **`remito`**: ¿tiene que ser numérico? ¿Acepta alfanumérico (ej. `BUBA-1042`)?
   ¿Tiene que ser único por cliente? ¿`seguimiento.json` acepta también el número
   de guía?
4. **`valor_declarado`**: en cotización el plugin manda siempre 0. ¿Hace falta
   mandarlo en la cotización para el seguro? ¿Hay mínimo/máximo?
5. **`integracion.json`**: ¿`plataforma` acepta otro valor que `"wordpress"`? ¿Qué
   forma exacta tiene el POST (los 4 campos que lee el plugin son todos?) ¿Reintenta
   si respondemos 500? ¿Hay IP de origen fija o firma además del `token`? ¿La URL
   se registra una vez o hay que re-registrarla?
6. **Códigos de estado**: lista completa y significado de `codigo` (`estados.json`),
   cuáles son finales (entregado, devuelto, etc.).
7. **Errores**: formato exacto de error en cada endpoint (status HTTP, `message`),
   y qué devuelven `print_etiquetas`/`print_guias` si la guía no existe (¿HTML,
   JSON o 4xx?). ¿Se puede pedir etiqueta de varias guías juntas sin límite?
8. **Header `aws-x-prs-wp: presis-<dominio>`**: ¿es obligatorio y se valida contra
   el dominio? ¿Qué pasa si llamamos desde Vercel (otro dominio/IP)? ¿Hay
   whitelist de dominios o IPs?
9. **SSL**: el plugin apaga la verificación (`sdk-epresis.php:70-71`). ¿El
   certificado de `epresislv.fastmail.com.ar` es válido? ¿Hay entorno de pruebas
   (sandbox) o todo impacta en producción?
10. **Retiro en sucursal vs domicilio**: ¿qué servicios tenemos contratados? ¿Los
    `sucursales[]` son puntos de retiro del destinatario o sucursales de origen?
11. **Campos obligatorios de `comprador`/`sender`**: ¿se exige `documento`,
    `celular`, `piso`? ¿`sender.provincia` debe ser el nombre en mayúsculas igual
    que `comprador.provincia`?
12. **Rate limit / timeout** recomendado, y si los precios de `precio-servicio`
    pueden cachearse por CP y peso.
