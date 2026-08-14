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
El visor ya funciona con una lata simulada (se puede arrastrar para girar). Para usar las fotos reales:

1. Sacá **24 o 36 fotos** de la lata girando sobre su eje (mismo encuadre, misma luz, fondo neutro), o exportá los frames desde un render 3D.
2. Guardalas como `assets/img/360/frame-01.webp`, `frame-02.webp`, etc.
3. En `js/main.js` poné `const FRAME_COUNT = 24;` (o la cantidad que sea).

El visor detecta las fotos, elimina la lata simulada y pasa a girar con las imágenes reales.

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

## Publicar y conectar el dominio (bubadrinks.com.ar)

1. **Activar GitHub Pages**: en GitHub → **Settings → Pages → Source: Deploy from a branch → Branch: main / (root)**.
2. **Dominio**: el archivo `CNAME` de este repo ya dice `bubadrinks.com.ar`. En **Settings → Pages → Custom domain** escribí `bubadrinks.com.ar` y guardá.
3. **DNS en NIC Argentina / tu proveedor DNS**: creá estos registros:

   | Tipo  | Nombre | Valor |
   |-------|--------|-------|
   | A     | @      | 185.199.108.153 |
   | A     | @      | 185.199.109.153 |
   | A     | @      | 185.199.110.153 |
   | A     | @      | 185.199.111.153 |
   | CNAME | www    | davidsued1.github.io |

4. Esperá la propagación (de minutos a unas horas) y activá **Enforce HTTPS** en Settings → Pages.

> Nota: NIC.ar no maneja los registros DNS directamente; el dominio tiene que estar delegado a un DNS (por ejemplo, el del hosting, Cloudflare gratis, o DonWeb). Ahí es donde se cargan los registros de la tabla.
