# 11 · Pago TIC (segunda pasarela de cobro)

Pago TIC (antes "Pay per TIC") se integra como **segunda opción** junto a Mercado Pago. Queda oculta
(`config.pagotic: false`) hasta que se active desde el panel. Documentación oficial: <https://documentos.paypertic.com>.
Código: `backend/lib/pagotic.js`, `backend/api/pagotic-*.js`, `backend/lib/venta.js`. Puesta en marcha: `backend/README.md`.

## Contrato de la API que usamos

| Qué | Cómo |
|---|---|
| Token | `POST https://a.paypertic.com/auth/realms/entidades/protocol/openid-connect/token`, form-urlencoded: `username`, `password`, `grant_type=password`, `client_id`, `client_secret`. Devuelve `access_token` y `expires_in` (s). Se guarda en memoria hasta 60 s antes de vencer |
| Crear pago | `POST {API}/pagos` (producción `https://api.paypertic.com`) con `Authorization: Bearer`. Devuelve `id` (UUID), `form_url`, `final_amount`, `status` |
| Consultar | `GET {API}/pagos/{id}`; si da 404/405, `GET {API}/pagos?filters[0][field]=id&filters[0][operation]=EQUAL&filters[0][value]={id}` |
| Por pedido | `GET {API}/pagos?filters[0][field]=external_transaction_id&filters[0][operation]=EQUAL&filters[0][value]=BUBA-XXXX` (+ filtro `collector_id` si hay `PAGOTIC_COLLECTOR_ID`) |
| Devolución | `POST {API}/pagos/devolucion/{id}` con `{"type":"online"}` (no automatizada) |
| Estados | pending, issued, in_process, approved, rejected, cancelled, refunded, deferred, objected, review, validate, overdue. Finales: approved, rejected, cancelled, refunded, overdue |

Body de `POST /pagos` (lo arma `api/pagotic-crear.js`):

- `external_transaction_id` = código del pedido; `currency_id` = `ARS`.
- `details[]`: una línea por producto (`concept_id` = id del producto, `concept_description` = `BUBA Drinks · <nombre> × <cantidad>`, `amount` = precio × cantidad con el descuento prorrateado) y una de envío (`concept_id: "envio"`) si cuesta algo. La suma da exactamente el total del pedido (el centavo del redondeo se ajusta en la última línea de producto).
- `payer`: `name` (solo letras y espacios), `email`, `external_reference` (el mail en minúsculas).
- `metadata`: `{ pedido, cliente, envio }` (los mismos datos que viajan a Mercado Pago; los usa el webhook para el mail y la guía).
- `return_url` → `/api/pagotic-vuelta?pedido=…`; `back_url` → `<tienda>/?pago=error&pedido=…&proveedor=pagotic`; `notification_url` → `/api/pagotic-webhook`.
- `due_date` y `last_due_date` = ahora + 3 días (formato `yyyy-MM-dd'T'HH:mm:ss-0300`), para dar tiempo a transferencias y cupones.
- **No** se manda `type` ni `presets`: el formulario ofrece todos los medios habilitados en la cuenta (tarjeta, transferencia, DEBIN, cupón, etc.).

## Flujo

1. El cliente toca **Pagar con Pago TIC** (paso 3 del checkout; solo si `config.pagotic` y `apiBase`). La web llama a `/api/pagotic-crear` y lo manda a `form_url`.
2. Paga en Pago TIC. Su navegador vuelve por **POST** a `/api/pagotic-vuelta`, que lo redirige (303) a `/?pago=ok|pendiente|error&pedido=…&proveedor=pagotic`. Esa redirección es solo cosmética: nunca confirma un cobro.
3. La web, al volver con `proveedor=pagotic`, **siempre** consulta `/api/estado-pago?proveedor=pagotic&pedido=…` (aun si dice `ok`) y muestra "¡Listo, pago confirmado!", "Tu pago está en proceso" o "El pago no se completó" según el estado real. El estado de Pago TIC se traduce a los nombres de Mercado Pago: approved; pending/issued/in_process/review/validate/deferred → pending; rejected/cancelled/overdue → rejected; refunded.
4. **Webhook** (`/api/pagotic-webhook`): toma el `id`, consulta el pago a la API con nuestro token y actúa solo sobre esa respuesta (el aviso no está firmado). `approved` → `procesarVentaAprobada` (guía Fast Mail salvo `FASTMAIL_AUTO=no`, mail al dueño, mail al cliente si hay `MAIL_FROM`, contacto en Resend). `refunded` → `procesarDevolucion(…, "total")`. Todo lo demás, solo log. Siempre 200.
5. Una transferencia o cupón que queda `pending`/`issued` y se aprueba horas después dispara el flujo completo recién ahí. Un aviso repetido no duplica nada: el remito de Fast Mail es determinístico y los mails tienen clave de idempotencia (`venta-<id>`, `cliente-<id>`, `devolucion-<id>`).

**Remito de Fast Mail.** Con Mercado Pago es el id del pago. Con Pago TIC el id es un UUID, así que se toman los primeros 15 caracteres hexadecimales (sin guiones) y se pasan a decimal con `BigInt` (hasta 19 dígitos; el mismo pago da siempre el mismo remito). Se manda a Fast Mail como texto numérico.

**Refactor común.** El procesamiento posterior al pago aprobado y a la devolución salió de `mp-webhook.js` a `lib/venta.js` y trabaja sobre una *venta* normalizada (`proveedor`, `id`, `pedido`, `monto`, `items`, `metadata`, datos del pagador). Los mails de Mercado Pago salen byte a byte iguales que antes.

## Preguntas abiertas para Pago TIC

1. **Sandbox**: ¿cuál es la URL base de la API y de autenticación de pruebas? (`PAGOTIC_API_URL` y `PAGOTIC_AUTH_URL` son configurables; hoy el default es producción.)
2. **`GET /pagos/{id}`**: ¿existe? Si no, el plan B (consulta con filtro `id`) ya está cubierto.
3. **`collector_id`**: ¿es obligatorio para nuestra cuenta? ¿Qué valor corresponde?
4. **Payload del `return_url`**: ¿qué campos trae el POST (¿`status`, `id`, `external_transaction_id`?) y en qué formato (form-urlencoded o JSON)? Hoy se lee de forma defensiva y todo lo desconocido cuenta como "pendiente".
5. **Notificaciones**: ¿vienen cifradas o firmadas en algún caso? Hoy se asumen en texto plano y sin firma, por eso se verifica contra la API.
6. **Medio de pago**: ¿en qué campo del pago viene el medio usado (tarjeta, transferencia, cupón)? Se busca en `payment_methods[0]` (`description`, `media_payment_id`, `name`) y, si no aparece, el mail dice solo "Pago TIC".
7. **Fechas**: ¿`due_date` y `last_due_date` pueden ser iguales? ¿`due_date` es obligatorio? Mandamos las dos a +3 días.
8. **`details.amount`**: ¿se acepta el importe como número JSON sin ceros finales (`9000` en lugar de `9000.00`)?
9. **Vencimiento**: ¿qué estado pasa cuando vence un cupón (`overdue`)? ¿Se notifica?
10. **Costos y condiciones**: comisión por medio de pago, costo por transferencia/DEBIN/cupón, plazos de acreditación, cuotas, política de devoluciones y contracargos (`objected`), y si hay costo de alta o mínimo mensual.
11. **Devoluciones parciales**: ¿se informan como estado propio o como `approved` con otro detalle? Hoy solo se atiende `refunded` (total).

## Tarjetas de prueba (documentación oficial de Pago TIC)

Para la cuenta en modo de pruebas. Fuente: documentos.paypertic.com → SOP → Tarjetas de prueba.

| Marca | Número | Vencimiento | Código | Resultado |
|---|---|---|---|---|
| Visa | 4704550000000005 | 12/2029 | 123 | Aprobada |
| Visa | 4507990000000010 | 12/año actual | 125 | Aprobada |
| Mastercard | 5165850000000008 | 12/2029 | 123 | Aprobada |
| Visa | 4507910000000018 | — | — | Rechazada (05) |
| Mastercard | 5323620000000004 | — | — | Rechazada (39) |

Las páginas de cada marca listan más tarjetas rechazadas con su código de error.
