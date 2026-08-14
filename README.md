# BUBA — Web

Landing page + tienda para BUBA, inspirada en el estilo de [Ciao Energy](https://www.ciaoenergy.com/).

Diseño en **blanco, negro y grises**: la paleta base es neutra a propósito, para que el color de las bebidas (las fotos) sea el protagonista.

## Estructura

```
index.html      → Toda la estructura de la página
css/style.css   → Estilos (paleta, secciones, responsive)
js/main.js      → Catálogo, carrito, checkout por WhatsApp, menú mobile
assets/img/     → Acá van las fotos reales del producto
```

## Secciones

1. **Hero** — Título grande + CTA de compra
2. **Marquee** — Cinta animada con mensajes de marca
3. **Beneficios** — Grilla de 6 beneficios
4. **Sabores / Tienda** — Tarjetas de producto con botón "Agregar" y carrito
5. **Nosotros** — Historia de la marca
6. **Comparativa** — BUBA vs. bebidas comunes (sección oscura)
7. **Testimonios** — 3 reseñas
8. **FAQ** — Preguntas frecuentes desplegables
9. **Contacto / Newsletter** — Captura de emails
10. **Footer** — Links y contacto
11. **Carrito** — Drawer lateral con persistencia (localStorage) y pedido por WhatsApp

## Cómo personalizar

### Fotos (importante)
Todos los bloques con clase `.photo` son **placeholders con gradientes** que simulan el color de cada bebida. Reemplazalos por fotos reales:

```html
<!-- Antes -->
<div class="photo" data-flavor="frutilla">...</div>

<!-- Después -->
<img src="assets/img/frutilla.jpg" alt="BUBA Frutilla" class="photo">
```

### Productos y precios
Editá el array `PRODUCTS` al inicio de `js/main.js` (nombre, descripción, precio).

### Pedidos por WhatsApp
En `js/main.js`, completá `WHATSAPP_NUMBER` con el número que recibe pedidos (ej: `"5491122334455"`). El carrito arma el mensaje con el detalle del pedido automáticamente.

### Newsletter
El formulario de la sección Contacto hoy solo muestra confirmación. Conectalo a tu servicio de mailing (Mailchimp, Brevo, etc.) en `setupNewsletter()` de `js/main.js`.

## Cómo verla

Es un sitio 100% estático, sin dependencias ni build:

- Abrí `index.html` en el navegador, o
- Servila con `python3 -m http.server` y entrá a `http://localhost:8000`

### Publicar gratis con GitHub Pages
En GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: main / (root)**. En unos minutos queda online en `https://davidsued1.github.io/buba/`.
