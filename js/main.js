/* ==========================================================================
   BUBA — Lógica de la landing
   - Catálogo de productos (editar acá precios, sabores y descripciones)
   - Carrito con persistencia en localStorage
   - Checkout por WhatsApp (configurar número en WHATSAPP_NUMBER)
   - Menú mobile, animaciones de aparición, newsletter
   ========================================================================== */

// Número de WhatsApp para recibir pedidos (código de país + número, sin "+").
// Ejemplo Argentina: "5491122334455". Dejarlo vacío muestra el resumen del pedido.
const WHATSAPP_NUMBER = "";

const PRODUCTS = [
  {
    id: "frutilla",
    name: "BUBA Frutilla",
    desc: "Roja intensa. Frutilla real, dulzor justo.",
    price: 2500,
    swatch: "linear-gradient(160deg, #ff4d6d, #ff8fa3)",
  },
  {
    id: "mango",
    name: "BUBA Mango",
    desc: "Amarilla vibrante. Tropical sin empalagar.",
    price: 2500,
    swatch: "linear-gradient(160deg, #ffb703, #ffd166)",
  },
  {
    id: "menta",
    name: "BUBA Menta-Lima",
    desc: "Verde eléctrica. La más refrescante de todas.",
    price: 2500,
    swatch: "linear-gradient(160deg, #06d6a0, #7ae7c7)",
  },
  {
    id: "mora",
    name: "BUBA Mora",
    desc: "Violeta profunda. Frutos oscuros, sabor serio.",
    price: 2500,
    swatch: "linear-gradient(160deg, #7209b7, #b5179e)",
  },
  {
    id: "pack",
    name: "Pack Degustación x8",
    desc: "Dos de cada sabor. El punto de partida ideal.",
    price: 18000,
    swatch: "linear-gradient(160deg, #ff4d6d 0%, #ffb703 34%, #06d6a0 67%, #7209b7 100%)",
  },
];

const money = (n) => "$" + n.toLocaleString("es-AR");

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
      '<p class="cart__empty">Todavía no agregaste nada.<br>Tu color te está esperando.</p>';
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

  if (WHATSAPP_NUMBER) {
    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  } else {
    // Sin número configurado: mostramos el resumen para enviarlo a mano.
    alert(message + "\n\n(Configurá WHATSAPP_NUMBER en js/main.js para enviar el pedido directo por WhatsApp.)");
  }
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
