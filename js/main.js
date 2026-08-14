/* ==========================================================================
   BUBA — Lógica de la landing
   - Configuración de contacto (WhatsApp) y catálogo de productos
   - Visor 360 de la lata (drag para girar; usa fotos reales si existen)
   - Carrito con persistencia en localStorage + pedido por WhatsApp
   - Menú mobile, animaciones de aparición, newsletter
   ========================================================================== */

/* ---------- Configuración ---------- */

// Número de WhatsApp que recibe pedidos y consultas.
// Código de país + número, sin "+" ni espacios. Ejemplo Argentina: "5491122334455".
const WHATSAPP_NUMBER = "";

// Mensajes prellenados según desde dónde escriben.
const WA_MSG_GENERAL = "¡Hola BUBA! Quiero hacerles una consulta.";
const WA_MSG_MAYORISTA =
  "¡Hola BUBA! Tengo un comercio y me interesa vender sus bebidas. ¿Me pasan info de precios mayoristas?";

// Visor 360: cantidad de fotos reales en assets/img/360/ (frame-01.webp, frame-02.webp, ...).
// Con 0 se muestra la lata simulada. Recomendado: 24 o 36 fotos.
const FRAME_COUNT = 0;
const FRAME_PATH = (i) => `assets/img/360/frame-${String(i).padStart(2, "0")}.webp`;

const PRODUCTS = [
  {
    id: "tinta",
    name: "BUBA Uva Tinta",
    desc: "Violeta profunda. La uva en su versión más intensa.",
    price: 2500,
    swatch: "radial-gradient(120% 120% at 30% 20%, #a4508b, #5f0a87 55%, #2c0735)",
  },
  {
    id: "rosada",
    name: "BUBA Uva Rosada",
    desc: "Rosa vibrante. Fresca, liviana, la favorita del verano.",
    price: 2500,
    swatch: "radial-gradient(120% 120% at 30% 20%, #ff8fa3, #e0526f 55%, #7a1f3d)",
  },
  {
    id: "blanca",
    name: "BUBA Uva Blanca",
    desc: "Dorada y sutil. Dulzor delicado, sabor elegante.",
    price: 2500,
    swatch: "radial-gradient(120% 120% at 30% 20%, #e9f5a3, #b4c95a 55%, #5c6e1e)",
  },
  {
    id: "pack",
    name: "Pack Degustación x12",
    desc: "Cuatro de cada variedad. El punto de partida ideal.",
    price: 27000,
    swatch: "linear-gradient(150deg, #5f0a87, #e0526f 50%, #b4c95a)",
  },
];

const money = (n) => "$" + n.toLocaleString("es-AR");

const waLink = (msg) =>
  WHATSAPP_NUMBER
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`
    : null;

/* ---------- Render de productos ---------- */
function renderProducts() {
  const grid = document.getElementById("products");
  grid.innerHTML = PRODUCTS.map(
    (p) => `
    <article class="product reveal">
      <!-- Placeholder: reemplazar por <img src="assets/img/${p.id}.jpg" alt="${p.name}"> -->
      <div class="photo" data-flavor="${p.id}">
        <span class="photo__label">FOTO ${p.name.toUpperCase()}</span>
      </div>
      <div class="product__body">
        <h3 class="product__name">${p.name}</h3>
        <p class="product__desc">${p.desc}</p>
        <div class="product__row">
          <span class="product__price">${money(p.price)}</span>
          <button class="btn btn--outline btn--sm" data-add="${p.id}">Agregar</button>
        </div>
      </div>
    </article>`
  ).join("");
}

/* ---------- Visor 360 ---------- */
function setupViewer() {
  const stage = document.getElementById("viewer-stage");
  if (!stage) return;

  const DRAG_SENSITIVITY = 4; // px de arrastre por paso de giro

  let frames = [];
  let current = 0;
  let dragging = false;
  let lastX = 0;
  let idleSpin = null;

  const label = document.getElementById("can-label");
  let labelOffset = 0;

  // Giro del placeholder: desplaza la "etiqueta" para simular rotación.
  function spinPlaceholder(delta) {
    if (!label) return;
    labelOffset = (labelOffset - delta) % label.scrollWidth;
    label.style.transform = `translateX(${labelOffset}px)`;
  }

  // Giro con fotos reales: cambia el frame visible.
  function showFrame(i) {
    const n = frames.length;
    current = ((i % n) + n) % n;
    frames.forEach((img, idx) => (img.style.display = idx === current ? "block" : "none"));
  }

  function step(delta) {
    if (frames.length) showFrame(current + Math.sign(delta));
    else spinPlaceholder(delta * 2);
  }

  // Rotación automática suave cuando nadie interactúa.
  function startIdleSpin() {
    stopIdleSpin();
    idleSpin = setInterval(() => step(1), frames.length ? 120 : 40);
  }
  function stopIdleSpin() {
    if (idleSpin) clearInterval(idleSpin);
    idleSpin = null;
  }

  // Carga de fotos reales si están configuradas.
  if (FRAME_COUNT > 0) {
    let loaded = 0;
    for (let i = 1; i <= FRAME_COUNT; i++) {
      const img = new Image();
      img.src = FRAME_PATH(i);
      img.alt = `Lata BUBA, vista ${i}`;
      img.style.display = "none";
      img.onload = () => {
        if (++loaded === FRAME_COUNT) {
          document.getElementById("can-placeholder")?.remove();
          frames.forEach((f) => stage.appendChild(f));
          showFrame(0);
        }
      };
      frames.push(img);
    }
  }

  stage.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    stopIdleSpin();
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    if (Math.abs(dx) >= DRAG_SENSITIVITY) {
      step(dx);
      lastX = e.clientX;
    }
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    startIdleSpin();
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    startIdleSpin();
  }
}

/* ---------- Carrito ---------- */
const CART_KEY = "buba-cart";

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || {};
  } catch {
    return {};
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

let cart = loadCart();

function cartEntries() {
  return Object.entries(cart)
    .map(([id, qty]) => ({ product: PRODUCTS.find((p) => p.id === id), qty }))
    .filter((e) => e.product && e.qty > 0);
}

function cartTotal() {
  return cartEntries().reduce((sum, e) => sum + e.product.price * e.qty, 0);
}

function cartCount() {
  return cartEntries().reduce((sum, e) => sum + e.qty, 0);
}

function updateCartUI() {
  document.getElementById("cart-count").textContent = cartCount();
  document.getElementById("cart-total").textContent = money(cartTotal());

  const box = document.getElementById("cart-items");
  const entries = cartEntries();

  if (!entries.length) {
    box.innerHTML =
      '<p class="cart__empty">Todavía no agregaste nada.<br>Tu uva te está esperando.</p>';
    return;
  }

  box.innerHTML = entries
    .map(
      ({ product: p, qty }) => `
      <div class="cart-item">
        <div class="cart-item__swatch" style="background:${p.swatch}"></div>
        <div class="cart-item__info">
          <div class="cart-item__name">${p.name}</div>
          <div class="cart-item__price">${money(p.price)} c/u</div>
        </div>
        <div class="cart-item__qty">
          <button data-dec="${p.id}" aria-label="Quitar uno">−</button>
          <span>${qty}</span>
          <button data-inc="${p.id}" aria-label="Agregar uno">+</button>
        </div>
      </div>`
    )
    .join("");
}

function addToCart(id, delta = 1) {
  cart[id] = Math.max(0, (cart[id] || 0) + delta);
  if (cart[id] === 0) delete cart[id];
  saveCart(cart);
  updateCartUI();
}

/* ---------- Drawer del carrito ---------- */
const cartEl = document.getElementById("cart");
const overlayEl = document.getElementById("cart-overlay");

function openCart() {
  cartEl.hidden = false;
  overlayEl.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeCart() {
  cartEl.hidden = true;
  overlayEl.hidden = true;
  document.body.style.overflow = "";
}

/* ---------- Checkout ---------- */
function checkout() {
  const entries = cartEntries();
  if (!entries.length) return;

  const lines = entries.map(
    ({ product: p, qty }) => `• ${qty}x ${p.name} — ${money(p.price * qty)}`
  );
  const message =
    "¡Hola BUBA! Quiero hacer este pedido:\n\n" +
    lines.join("\n") +
    `\n\nTotal: ${money(cartTotal())}`;

  const url = waLink(message);
  if (url) {
    window.open(url, "_blank");
  } else {
    // Sin número configurado: mostramos el resumen para enviarlo a mano.
    alert(message + "\n\n(Configurá WHATSAPP_NUMBER en js/main.js para enviar el pedido directo por WhatsApp.)");
  }
}

/* ---------- Links de WhatsApp ---------- */
function setupWhatsAppLinks() {
  const targets = [
    ["wholesale-whatsapp", WA_MSG_MAYORISTA],
    ["contact-whatsapp", WA_MSG_GENERAL],
    ["float-whatsapp", WA_MSG_GENERAL],
  ];
  targets.forEach(([id, msg]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const url = waLink(msg);
    if (url) {
      el.href = url;
    } else {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        alert("Configurá WHATSAPP_NUMBER en js/main.js para activar los botones de WhatsApp.");
      });
    }
  });
}

/* ---------- Menú mobile ---------- */
function setupMobileMenu() {
  const burger = document.getElementById("hamburger");
  const nav = document.getElementById("nav");

  burger.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", String(open));
  });

  nav.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      nav.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
    })
  );
}

/* ---------- Animaciones de aparición ---------- */
function setupReveal() {
  const observer = new IntersectionObserver(
    (items) => {
      items.forEach((item) => {
        if (item.isIntersecting) {
          item.target.classList.add("is-visible");
          observer.unobserve(item.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
}

/* ---------- Newsletter ---------- */
function setupNewsletter() {
  const form = document.getElementById("newsletter-form");
  const ok = document.getElementById("newsletter-ok");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    // Conectar acá con el servicio de mailing (Mailchimp, Brevo, etc.)
    form.hidden = true;
    ok.hidden = false;
  });
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  renderProducts();
  updateCartUI();
  setupViewer();
  setupWhatsAppLinks();
  setupMobileMenu();
  setupNewsletter();
  setupReveal();

  document.getElementById("cart-open").addEventListener("click", openCart);
  document.getElementById("cart-close").addEventListener("click", closeCart);
  overlayEl.addEventListener("click", closeCart);
  document.getElementById("cart-checkout").addEventListener("click", checkout);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCart();
  });

  // Delegación de clicks para agregar / modificar cantidades
  document.body.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    const inc = e.target.closest("[data-inc]");
    const dec = e.target.closest("[data-dec]");
    if (add) {
      addToCart(add.dataset.add, 1);
      openCart();
    }
    if (inc) addToCart(inc.dataset.inc, 1);
    if (dec) addToCart(dec.dataset.dec, -1);
  });
});
