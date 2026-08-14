# BUBA — Plataforma de e-commerce

Tienda online + panel de administración propio para **BUBA** (cocktail frutal con vodka premium). Diseño claro premium en blancos y grises con bloques negros de identidad; el color lo ponen las latas.

Dominio: **bubadrinks.com.ar** (guía de conexión abajo).

## Arquitectura

```
index.html            → Web pública (landing + tienda + checkout)
css/style.css         → Estilos de la web
js/main.js            → Lógica: visor 360, carrito, checkout, envíos, pagos
js/store-defaults.js  → Estructura y datos por defecto de la tienda
data/store.json       → Datos "publicados" (lo que edita el panel)
admin/                → Panel de administración (PIN por defecto: buba2026)
backend/              → Funciones serverless para Mercado Pago (deploy en Vercel)
assets/img/           → Fotos del producto (+ uploads/ para las subidas del panel)
```

### Cómo fluyen los datos

1. La web pública carga `data/store.json` (+ los cambios locales del panel si estás en el mismo navegador).
2. El panel `/admin` edita **todo**: productos, stock, precios, textos, envíos, promos, configuración.
3. **Guardar** en el panel = cambios locales (se ven al instante en la web del mismo navegador — vista previa).
4. **Publicar online** = el panel hace commit de `data/store.json` (y las imágenes nuevas) al repo vía API de GitHub → GitHub Pages redeploya → la web se actualiza para todo el mundo en 1-2 minutos. Requiere un token de GitHub que se carga una sola vez en Configuración.

### Pedidos y pagos

- El checkout pide datos del cliente, dirección completa (con opción de capturar ubicación GPS), método de envío (Moto CABA/GBA, Correo Argentino, Andreani, retiro — editables desde el panel) y aplica códigos de descuento.
- **Mercado Pago**: el botón llama al backend (`backend/`), que crea la preferencia de Checkout Pro y redirige al cliente a pagar. Hasta deployar el backend, funciona en modo demo (registra el pedido y avisa que se coordina el pago).
- **WhatsApp**: alternativa siempre disponible; arma el mensaje con el detalle completo del pedido.
- Cada pedido descuenta stock y queda en el panel con su estado: pendiente → pagado → preparando → enviado → entregado (o cancelado).

> **Limitación actual (por diseño, sin servidor):** los pedidos se registran en el navegador donde se hicieron. El siguiente paso de la estructura es sumar la base de datos al backend (ver `backend/README.md`) para que todos los pedidos de todos los clientes lleguen al panel.

## Panel de administración

`https://tu-dominio/admin/` — PIN inicial: `buba2026` (cambialo en Configuración).

- **Dashboard**: ventas, pedidos pendientes, stock bajo.
- **Pedidos**: detalle completo (cliente, dirección, GPS→Maps, productos), cambio de estado.
- **Productos**: alta/baja/edición, precio y stock inline, foto (se sube al repo al publicar), tarjetas "próximamente".
- **Clientes**: se arman solos a partir de los pedidos.
- **Envíos**: métodos, tiempos y tarifas; umbral de envío gratis.
- **Promociones**: códigos % o $ fijos, pausables.
- **Textos**: todos los títulos y párrafos de la web.
- **Configuración**: WhatsApp, Instagram, emails, URL del backend de pagos, PIN, credenciales de publicación.

## Visor 360

La lata gira completa (cuerpo esférico + tapa con la anilla) reproyectando la foto real en canvas — sin tocar las imágenes originales. Arrastrás para girarla con inercia y vuelve exacta a la posición inicial en cada vuelta. Para sumar un sabor: foto con fondo transparente en `assets/img/`, entrada en `CANS` (js/main.js) con la geometría de la esfera y la tapa, y su botón en `#viewer-flavors`.

## Ver el sitio localmente

```
python3 -m http.server
# → http://localhost:8000 (web) y http://localhost:8000/admin/ (panel)
```

## Publicar y conectar el dominio (bubadrinks.com.ar, comprado en NIC.ar)

NIC.ar solo registra el dominio: **no** aloja registros DNS. Hay que delegarlo a un servicio de DNS (Cloudflare es gratis) y apuntarlo a GitHub Pages:

**Paso 1 — GitHub Pages:** Settings → Pages → Source: Deploy from a branch → `main` / (root). Queda en `https://davidsued1.github.io/buba/`.

**Paso 2 — Cloudflare (gratis):** agregar `bubadrinks.com.ar` (plan Free) → anotar los 2 nameservers que te da.

**Paso 3 — NIC.ar:** Mis dominios → bubadrinks.com.ar → Delegaciones → cargar los 2 nameservers de Cloudflare.

**Paso 4 — DNS en Cloudflare** (modo "DNS only", nube gris):

| Tipo  | Nombre | Valor |
|-------|--------|-------|
| A     | @      | 185.199.108.153 |
| A     | @      | 185.199.109.153 |
| A     | @      | 185.199.110.153 |
| A     | @      | 185.199.111.153 |
| CNAME | www    | davidsued1.github.io |

**Paso 5 — GitHub:** Settings → Pages → Custom domain: `bubadrinks.com.ar` (el archivo `CNAME` del repo ya está) → Enforce HTTPS.

## Roadmap preparado

- [ ] Backend con base de datos: pedidos de todos los clientes en el panel
- [ ] Webhook de MP → estado "pagado" automático
- [ ] Cotización de envío por CP con APIs de Correo Argentino / Andreani
- [ ] Emails transaccionales (confirmación de pedido, envío despachado)
- [ ] Cuentas mayoristas con precios propios
