# 01 — Estado y Arquitectura Actual

**BUBA DRINKS · Plataforma web** — Foto real de lo construido al 2026-08-25, contra la visión de los docs 06 y 07.

---

## 1. Qué está construido hoy

Sitio **estático HTML/CSS/JS puro** (sin frameworks ni build), hosteado gratis en **GitHub Pages** con deploy automático por GitHub Actions en cada push (`.github/workflows/pages.yml`). Dominio `bubadrinks.com.ar` vía CNAME.

- **Web pública** (`index.html`, `js/main.js`): landing one-page con hero, visor 360, tienda, beneficios, nosotros, mayoristas, FAQ, contacto/newsletter. Age gate +18, mobile first.
- **Visor 360** propio en canvas: capas base + etiqueta (`assets/img/*-base.webp` / `*-label.webp`), proyección cilíndrica del texto y tapa rotando, con drag, inercia y giro automático.
- **Datos de la tienda**: defaults en `js/store-defaults.js` → sobreescritos por `data/store.json` (lo publicado) → sobreescritos por `localStorage` (cambios locales del panel). Una sola estructura para todo: productos, textos, imágenes, envíos, promos, config.
- **Panel `/admin`** (PIN de acceso): dashboard, pedidos con estados, productos (alta/edición/stock/fotos), clientes derivados de pedidos, envíos, códigos de descuento, textos e imágenes de la web, configuración. **Publicar online** = commit de `store.json` + imágenes al repo vía API de GitHub con token personal → Pages redeploya en 1-2 min.
- **Checkout** de 3 pasos sin recargar página: datos + dirección (con captura GPS opcional), método de envío filtrado por **zona** (CABA / GBA / interior según provincia + CP), cupones, envío gratis por umbral, y pago por **Mercado Pago** (vía backend) o **WhatsApp** (mensaje armado con el pedido). Las órdenes descuentan stock y quedan en `localStorage`.
- **Backend Mercado Pago** (`backend/`): dos funciones serverless listas para deployar en Vercel — `create-preference` (Checkout Pro, devuelve `init_point`) y `mp-webhook` (recibe notificaciones de pago; hoy solo loguea). Sin backend configurado, el checkout corre en modo demo.

## 2. Cumplimiento por módulo (doc 07)

| # | Módulo | Estado | Detalle honesto |
|---|--------|--------|-----------------|
| 1 | Ecommerce | 🟡 | Home, tienda, carrito y checkout funcionan. Sin página de producto individual, reseñas, cross-selling ni **Mi Cuenta** (pendiente, requiere backend con usuarios). |
| 2 | Panel Administrativo | 🟡 | Dashboard, pedidos, productos, clientes, envíos, promos y CMS de textos/imágenes operativos. Pero los **pedidos solo existen en el navegador donde se compró** hasta tener backend con base de datos. Sin inventario avanzado ni roles. |
| 3 | Logística | 🟡 | Métodos por zona (moto CABA/GBA, Correo, Andreani, retiro) con tarifa fija editable y envío gratis por umbral. Sin etiquetas, tracking ni APIs de correo. |
| 4 | Promociones | 🟡 | Cupones % y $ fijos, pausables. Sin 2x1/3x2, promos por fecha/ciudad/cliente. |
| 5 | Integraciones | 🟡 | Mercado Pago listo (falta deployar) y WhatsApp activo. Analytics, píxeles, email marketing, CRM y facturación pendientes. |
| 6 | Emails | ❌ | Ningún email automático. Requiere backend + servicio de envío (Resend/Brevo). |
| 7 | SEO | 🟡 | Title, description y semántica correctos en la home. Sin OG image, schema, sitemap ni SEO administrable por página. |
| 8 | Seguridad | 🟡 | HTTPS por Pages, escapado XSS consistente, token de GitHub solo en el navegador. El PIN del panel es **ofuscación, no seguridad real** (los datos son públicos por diseño; no hay nada sensible que proteger todavía). |
| 9 | Analytics | ❌ | No hay medición. GA4/Clarity son un `<script>` de distancia, pero no están. |
| 10 | Administración de la Web | ✅ | Textos, imágenes, productos, precios, stock, envíos, promos y contacto: todo editable desde el panel sin tocar código. |
| 11 | Escalabilidad | 🟡 | La estructura de datos y la abstracción de envíos escalan; el storage (JSON + localStorage) no. Multi-idioma/moneda, suscripciones y mayoristas con precios propios pendientes. |
| 12 | Rendimiento | ✅ | Estático sin frameworks, WebP, lazy loading, canvas con LUTs precalculadas. Carga muy por debajo de 2 s. |

## 3. Decisiones de arquitectura y por qué

1. **Estático primero.** Costo cero de hosting, deploy trivial, sin servidores que mantener ni caer. Para 3 productos y una marca lanzando, cualquier stack más pesado era sobre-ingeniería. El doc 06 se alcanza por fases sin tirar nada.
2. **`store.json` como fuente de verdad administrable.** Una única estructura (defaults → publicado → local) hace que el panel edite *todo* lo que el sitio muestra. Es el contrato de datos que después migra tal cual a una base de datos.
3. **GitHub como "base de datos" de contenido.** Publicar = commit vía API. Se gana versionado, backup e infraestructura gratis, sin backend propio para el CMS.
4. **Envíos por zona como abstracción.** `detectZone(provincia, CP)` + métodos con precio/ETA editables. Cuando lleguen las APIs de Correo/Andreani, solo cambia el origen del precio; el checkout y el panel no se tocan.
5. **Backend mínimo y aislado.** Solo lo que exige un secreto (el token de MP) vive en serverless. El resto no paga ese costo.

## 4. Roadmap de migración hacia el doc 06

### Fase 2 — Pedidos centralizados y pago real
- Deploy del backend en Vercel + **base de datos Postgres (Supabase** u otra): tablas `orders`, `customers`, `products`.
- El checkout postea la orden al backend (hoy ya arma el objeto completo); el panel las lee por API en vez de localStorage.
- **Webhook MP → estado "pagado"** automático (el hook ya recibe y consulta el pago; falta persistirlo).
- Se reusa: estructura de orden, checkout, panel de pedidos, `create-preference`, `mp-webhook`.
- Requiere del dueño: cuenta Vercel, Access Token de producción de Mercado Pago, cuenta Supabase.

### Fase 3 — Cuenta, emails y envíos reales
- **Mi Cuenta**: auth de Supabase (email/magic link), historial de pedidos, direcciones.
- **Emails transaccionales** (confirmación, pago aprobado, despachado) con Resend o Brevo.
- **Cotización de envío por API** de Correo Argentino / Andreani por CP, detrás de la abstracción de zona existente.
- Se reusa: checkout, datos de cliente ya capturados, métodos de envío del panel.
- Requiere: dominio verificado para emails, cuentas/credenciales de Correo Argentino y Andreani.

### Fase 4 — Crecimiento
- **Analytics avanzado**: GA4 + Meta Pixel + Clarity, embudo de compra, eventos de checkout.
- **Multi-idioma/moneda**: `texts` ya centraliza todos los strings; se extiende a diccionarios por idioma y precios por moneda.
- Promociones avanzadas (2x1, por fecha), mayoristas con precios propios, suscripciones.
- Requiere: cuentas de Google/Meta/Clarity y definición comercial de mercados.

## 5. Límites conocidos

- **Los pedidos viven solo en el navegador del comprador**; el panel los ve únicamente en ese mismo navegador. Se resuelve en Fase 2.
- **El stock no es real**: se descuenta localmente, sin sincronización entre clientes ni reservas.
- El **webhook de MP no actualiza pedidos** todavía (solo registra en logs).
- **Sin Mi Cuenta, sin emails, sin analytics.**
- El PIN del panel no es autenticación real; el token de GitHub queda en el navegador de quien publica.
- Publicar desde **dos navegadores a la vez** puede pisar cambios (último commit gana).
- Imágenes subidas desde el panel viajan como base64 hasta publicarse (pesadas en localStorage).
- Tarifas de envío fijas por método; sin cotización por peso/CP ni tracking.
