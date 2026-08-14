# BUBA — Web

Landing page + tienda para **BUBA**. Diseño oscuro premium en **negros opacos, blancos y grises**: la paleta base es neutra a propósito, para que el color de las bebidas (las fotos) sea el protagonista.

Dominio: **bubadrinks.com.ar** (ver "Conectar el dominio" abajo).

## Estructura

```
index.html            → Toda la estructura de la página
css/style.css         → Estilos (tema oscuro, secciones, responsive)
js/main.js            → Config de WhatsApp, catálogo, carrito, visor 360
assets/img/           → Fotos reales del producto (logo, productos, lifestyle)
assets/img/360/       → Fotos de la lata girando para el visor 360
CNAME                 → Dominio para GitHub Pages
```

## Secciones

1. **Hero + visor 360** — Título grande, CTAs (comprar / mayorista) y la lata girable
2. **Marquee** — Cinta blanca animada con mensajes de marca
3. **Beneficios** — Grilla de 6 beneficios
4. **Sabores / Tienda** — Productos con precio, "Agregar" y carrito
5. **Nosotros** — Historia de la marca
6. **Comparativa** — BUBA vs. bebidas comunes
7. **Mayoristas** — Sección invertida (fondo blanco) con CTA de WhatsApp y email para distribuidores
8. **Testimonios** — 3 reseñas (una mayorista)
9. **FAQ** — Preguntas frecuentes desplegables
10. **Contacto** — Newsletter + WhatsApp directo + email + Instagram
11. **Footer** + **botón flotante de WhatsApp** + **carrito** (drawer lateral con localStorage)

## Cómo personalizar

### 1. WhatsApp (lo más importante)
En `js/main.js`, arriba de todo, completá:

```js
const WHATSAPP_NUMBER = "5491122334455"; // código de país + número, sin "+"
```

Con eso se activan automáticamente: el pedido del carrito, el botón de mayoristas, el link de contacto y el botón flotante. Los mensajes prellenados (`WA_MSG_GENERAL`, `WA_MSG_MAYORISTA`) también se editan ahí.

### 2. Visor 360 de la lata
El visor gira las **fotos reales** de las latas (Blueberry Limeade y Golden Peach) con un mapeo esférico en canvas: vaivén automático + arrastre manual. Para agregar un sabor nuevo:

1. Guardá la foto (fondo transparente, lata centrada) en `assets/img/`.
2. Agregá una entrada en `CANS` de `js/main.js` con `cx/cy/r` (centro y radio de la esfera como fracción del ancho/alto de la imagen) y `warpTop` (desde qué altura empieza el giro, para que la tapa quede quieta).
3. Agregá el botón correspondiente en `#viewer-flavors` de `index.html`.

Las fotos originales en alta resolución (con el 10% ya corregido) quedan en `assets/img/*.png`; la web usa las versiones `.webp`.

### 3. Logo
Reemplazá el texto "BUBA." del header y footer por el logo real:

```html
<a href="#top" class="logo"><img src="assets/img/logo.svg" alt="BUBA" height="32"></a>
```

### 4. Fotos de producto
Los bloques `.photo` son placeholders con gradientes que simulan el color de cada variedad. Reemplazalos por fotos reales (`assets/img/tinta.jpg`, etc.) siguiendo los comentarios en el HTML y en `renderProducts()` de `js/main.js`.

### 5. Productos y precios
Editá el array `PRODUCTS` en `js/main.js` (nombres, descripciones, precios).

### 6. Newsletter
El formulario hoy solo muestra confirmación. Conectalo a tu servicio de mailing (Mailchimp, Brevo, etc.) en `setupNewsletter()` de `js/main.js`.

## Cómo verla

Sitio 100% estático, sin dependencias ni build:

- Abrí `index.html` en el navegador, o
- Servila con `python3 -m http.server` y entrá a `http://localhost:8000`

## Publicar y conectar el dominio (bubadrinks.com.ar, comprado en NIC.ar)

NIC.ar solo registra el dominio: **no** aloja registros DNS. Hay que delegarlo a un servicio de DNS (Cloudflare es gratis) y apuntarlo a GitHub Pages:

**Paso 1 — Cloudflare (gratis):**
1. Crear cuenta en cloudflare.com → "Add a domain" → `bubadrinks.com.ar` (plan Free).
2. Cloudflare te da 2 nameservers (algo como `ana.ns.cloudflare.com` y `bob.ns.cloudflare.com`).

**Paso 2 — NIC.ar:**
1. Entrar a nic.ar con clave fiscal / usuario.
2. Ir al dominio → **Delegaciones** → borrar las delegaciones actuales y cargar los 2 nameservers de Cloudflare.
3. Esperar la propagación (puede tardar de minutos a 48 hs).

**Paso 3 — Registros DNS en Cloudflare** (modo "DNS only", nube gris):

| Tipo  | Nombre | Valor |
|-------|--------|-------|
| A     | @      | 185.199.108.153 |
| A     | @      | 185.199.109.153 |
| A     | @      | 185.199.110.153 |
| A     | @      | 185.199.111.153 |
| CNAME | www    | davidsued1.github.io |

**Paso 4 — GitHub Pages:**
1. En GitHub → **Settings → Pages → Source: Deploy from a branch → Branch: main / (root)**.
2. En **Custom domain** escribir `bubadrinks.com.ar` (el archivo `CNAME` del repo ya lo tiene) y activar **Enforce HTTPS** cuando esté disponible.
