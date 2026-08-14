/* ==========================================================================
   BUBA — Lógica de la landing
   - Configuración de contacto (WhatsApp) y catálogo de productos
   - Verificación de edad (+18)
   - Visor 360: gira la foto real de la lata con un mapeo esférico en canvas
   - Carrito con persistencia en localStorage + pedido por WhatsApp
   - Menú mobile, animaciones de aparición, newsletter
   ========================================================================== */

/* ---------- Configuración ---------- */

// Número de WhatsApp que recibe pedidos y consultas.
// Código de país + número, sin "+" ni espacios. Ejemplo Argentina: "5491122334455".
const WHATSAPP_NUMBER = "";

const WA_MSG_GENERAL = "¡Hola BUBA! Quiero hacerles una consulta.";
const WA_MSG_MAYORISTA =
  "¡Hola BUBA! Tengo un comercio y me interesa vender sus cocktails. ¿Me pasan info de precios mayoristas?";

// Latas del visor 360. cx/cy/r describen la esfera dentro de la foto
// (fracciones del ancho/alto). warpTop: desde qué altura (fracción) empieza
// a girar la imagen (más arriba queda quieta la tapa metálica).
const CANS = {
  blueberry: {
    src: "assets/img/blueberry.webp",
    cx: 0.499, cy: 0.490, r: 0.497,
    warpTop: 0.30,
  },
  peach: {
    src: "assets/img/peach.webp",
    cx: 0.499, cy: 0.509, r: 0.494,
    warpTop: 0.26,
  },
};

const PRODUCTS = [
  {
    id: "blueberry",
    name: "BUBA Blueberry Limeade",
    desc: "Azul eléctrico. Arándano y lima con vodka premium.",
    price: 3500,
    img: "assets/img/blueberry.webp",
  },
  {
    id: "peach",
    name: "BUBA Golden Peach",
    desc: "Dorado intenso. Durazno maduro con vodka premium.",
    price: 3500,
    img: "assets/img/peach.webp",
  },
  {
    id: "pack",
    name: "Pack Degustación x8",
    desc: "Cuatro de cada sabor. El punto de partida ideal.",
    price: 26000,
    img: null,
    swatch: "linear-gradient(135deg, #1596c8 0%, #0b6e96 45%, #e8920a 55%, #c86e04 100%)",
  },
];

// Sabores que todavía no salieron (tarjetas "próximamente")
const COMING_SOON = ["Nuevo sabor 03", "Nuevo sabor 04"];

const money = (n) => "$" + n.toLocaleString("es-AR");

const waLink = (msg) =>
  WHATSAPP_NUMBER
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`
    : null;

/* ---------- Almacenamiento seguro (no rompe en incógnito/sandbox) ---------- */
function lsGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* sin persistencia */ }
}

/* ---------- Verificación de edad ---------- */
const AGE_KEY = "buba-adult";

function setupAgeGate() {
  const gate = document.getElementById("agegate");
  if (lsGet(AGE_KEY) === "1") return;

  gate.hidden = false;
  document.body.style.overflow = "hidden";

  document.getElementById("age-yes").addEventListener("click", () => {
    lsSet(AGE_KEY, "1");
    gate.hidden = true;
    document.body.style.overflow = "";
  });

  document.getElementById("age-no").addEventListener("click", () => {
    gate.querySelector(".agegate__box").innerHTML =
      '<p class="agegate__logo">BUBA<span class="logo__dot">.</span></p>' +
      "<h2>Volvé en unos años</h2>" +
      '<p class="agegate__sub">Este sitio es solo para mayores de 18 años.</p>' +
      '<p class="agegate__legal">Beber con moderación. Prohibida su venta a menores de 18 años.</p>';
  });
}

/* ---------- Visor 360 (mapeo esférico sobre la foto real) ---------- */
function setupViewer() {
  const stage = document.getElementById("viewer-stage");
  const canvas = document.getElementById("viewer-canvas");
  if (!stage || !canvas) return;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const cache = {}; // por sabor: { src ImageData, LUT esférica, tamaño }
  const MAX_ANGLE = 0.6;   // tope de giro manual (rad)
  const AUTO_AMP = 0.4;    // amplitud del vaivén automático (rad)
  let active = null;
  let theta = 0;           // ángulo actual (se acerca suavemente a target)
  let target = 0;
  let manual = false;      // true mientras el usuario arrastra
  let dragging = false;
  let lastX = 0;
  let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let rafId = null;

  function buildCan(key, cb) {
    if (cache[key]) return cb(cache[key]);
    const cfg = CANS[key];
    const img = new Image();
    img.src = cfg.src;
    img.onload = () => {
      // renderizar a la resolución del stage (más liviano que la foto entera)
      const H = Math.min(560, Math.max(380, stage.clientHeight || 460));
      const W = Math.round((img.width / img.height) * H);
      const off = document.createElement("canvas");
      off.width = W;
      off.height = H;
      const octx = off.getContext("2d");
      octx.drawImage(img, 0, 0, W, H);
      const src = octx.getImageData(0, 0, W, H);

      // LUT: para cada píxel de la esfera, su latitud/longitud aparente.
      // fade: el giro entra en rampa desde la tapa hacia abajo (sin costura).
      const cx = cfg.cx * W, cy = cfg.cy * H, r = cfg.r * W;
      const topY = Math.round(cfg.warpTop * H);
      const band = 0.2 * H;
      const idx = [], lon = [], rho = [], fade = [];
      for (let y = Math.max(0, topY); y < H; y++) {
        const t = Math.min(1, (y - topY) / band);
        const f = t * t * (3 - 2 * t); // smoothstep
        for (let x = 0; x < W; x++) {
          const nx = (x - cx) / r;
          const ny = (y - cy) / r;
          if (nx * nx + ny * ny > 0.999) continue;
          const cosLat = Math.sqrt(1 - ny * ny); // radio del paralelo a esta altura
          if (cosLat < 0.03) continue;
          idx.push(y * W + x);
          lon.push(Math.asin(Math.max(-1, Math.min(1, nx / cosLat))));
          rho.push(r * cosLat);
          fade.push(f);
        }
      }
      cache[key] = {
        src, W, H, cx,
        idx: Int32Array.from(idx),
        lon: Float32Array.from(lon),
        rho: Float32Array.from(rho),
        fade: Float32Array.from(fade),
      };
      cb(cache[key]);
    };
  }

  function render() {
    if (!active) return;
    const { src, W, H, cx, idx, lon, rho, fade } = active;
    canvas.width = W;
    canvas.height = H;

    const out = ctx.createImageData(W, H);
    out.data.set(src.data); // base: foto original (tapa y bordes quietos)

    const s = src.data, o = out.data;
    const LIM = Math.PI / 2 - 0.06; // en el borde la textura se comprime, no se corta
    for (let i = 0; i < idx.length; i++) {
      let L = lon[i] + theta * fade[i];
      if (L > LIM) L = LIM;
      else if (L < -LIM) L = -LIM;
      const p = idx[i];
      const sx = Math.round(cx + rho[i] * Math.sin(L));
      const sp = ((p / W) | 0) * W + Math.max(0, Math.min(W - 1, sx));
      const q = p * 4, sq = sp * 4;
      o[q] = s[sq]; o[q + 1] = s[sq + 1]; o[q + 2] = s[sq + 2]; o[q + 3] = s[sq + 3];
    }
    ctx.putImageData(out, 0, 0);
  }

  function loop(now) {
    if (!manual && !reduceMotion) {
      // vaivén automático suave
      target = AUTO_AMP * Math.sin((now || 0) / 1400);
    }
    const prev = theta;
    theta += (target - theta) * 0.12;
    if (active && Math.abs(theta - prev) > 0.0004) render();
    rafId = requestAnimationFrame(loop);
  }

  function show(key) {
    buildCan(key, (can) => {
      active = can;
      render();
    });
  }

  // Interacción: arrastrar para girar (con tope elástico a los costados)
  stage.addEventListener("pointerdown", (e) => {
    dragging = true;
    manual = true;
    lastX = e.clientX;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (!dragging || !active) return;
    target = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, target + (e.clientX - lastX) * 0.008));
    lastX = e.clientX;
  });
  const endDrag = () => {
    dragging = false;
    // al soltar, volver despacio al vaivén automático
    setTimeout(() => { manual = false; }, 1200);
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  // Selector de sabor
  const flavorBox = document.getElementById("viewer-flavors");
  flavorBox.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-can]");
    if (!btn) return;
    flavorBox.querySelectorAll("button").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    show(btn.dataset.can);
  });

  show("blueberry");
  loop();

  // pausar el giro cuando la pestaña no está visible
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelAnimationFrame(rafId);
    else loop();
  });
}

/* ---------- Render de productos ---------- */
function renderProducts() {
  const grid = document.getElementById("products");
  const cards = PRODUCTS.map(
    (p) => `
    <article class="product reveal">
      ${
        p.img
          ? `<div class="product__media"><img src="${p.img}" alt="${p.name}" loading="lazy"></div>`
          : `<div class="photo" data-flavor="${p.id}"><span class="photo__label">FOTO ${p.name.toUpperCase()}</span></div>`
      }
      <div class="product__body">
        <h3 class="product__name">${p.name}</h3>
        <p class="product__desc">${p.desc}</p>
        <div class="product__row">
          <span class="product__price">${money(p.price)}</span>
          <button class="btn btn--outline btn--sm" data-add="${p.id}">Agregar</button>
        </div>
      </div>
    </article>`
  );

  const soon = COMING_SOON.map(
    (name) => `
    <article class="product product--soon reveal">
      <div class="product__media product__media--soon"><span>?</span></div>
      <div class="product__body">
        <h3 class="product__name">${name}</h3>
        <p class="product__desc">Muy pronto. Suscribite abajo para enterarte antes que nadie.</p>
        <div class="product__row"><span class="product__soon-tag">Próximamente</span></div>
      </div>
    </article>`
  );

  grid.innerHTML = cards.concat(soon).join("");
}

/* ---------- Carrito ---------- */
const CART_KEY = "buba-cart";

function loadCart() {
  try {
    return JSON.parse(lsGet(CART_KEY)) || {};
  } catch {
    return {};
  }
}

function saveCart(cart) {
  lsSet(CART_KEY, JSON.stringify(cart));
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
        ${
          p.img
            ? `<img class="cart-item__swatch" src="${p.img}" alt="">`
            : `<div class="cart-item__swatch" style="background:${p.swatch}"></div>`
        }
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
    `\n\nTotal: ${money(cartTotal())}\n\nSoy mayor de 18 años.`;

  const url = waLink(message);
  if (url) {
    window.open(url, "_blank");
  } else {
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
  setupAgeGate();
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
