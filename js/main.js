/* ==========================================================================
   BUBA — Web pública
   - Datos de la tienda: defaults + data/store.json (publicado por el panel)
     + localStorage (cambios locales del panel). Todo editable desde /admin.
   - Visor 360: rotación física completa de la lata (cuerpo esférico con
     envoltura continua + tapa girando) sobre la foto real, en canvas.
   - Carrito + checkout completo: datos, dirección (con geolocalización),
     método de envío, promociones, Mercado Pago (vía backend) o WhatsApp.
   ========================================================================== */

/* ---------- Utilidades ---------- */
const $ = (id) => document.getElementById(id);
const money = (n) => "$" + Math.round(n).toLocaleString("es-AR");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function lsGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* sin persistencia */ }
}
function lsJSON(key) {
  try { return JSON.parse(lsGet(key)); } catch { return null; }
}

/* ---------- Resolución de datos de la tienda ---------- */
let STORE = window.BUBA_DEFAULTS;

async function resolveStore() {
  let store = window.BUBA_DEFAULTS;
  try {
    const r = await fetch("data/store.json", { cache: "no-store" });
    if (r.ok) store = mergeStore(store, await r.json());
  } catch { /* offline o file:// → defaults */ }
  const local = lsJSON("buba-store");
  if (local) store = mergeStore(store, local);
  return store;
}

// merge superficial por sección: cada bloque del panel reemplaza al default
function mergeStore(base, over) {
  const out = { ...base };
  for (const k of ["config", "texts"]) {
    if (over[k]) out[k] = { ...base[k], ...over[k] };
  }
  for (const k of ["products", "shipping", "promos", "comingSoon"]) {
    if (Array.isArray(over[k])) out[k] = over[k];
  }
  if (over.version) out.version = over.version;
  return out;
}

/* ---------- Aplicar textos y contactos administrables ---------- */
function applyTexts() {
  document.querySelectorAll("[data-txt]").forEach((el) => {
    const val = STORE.texts[el.dataset.txt];
    if (!val) return;
    el.textContent = "";
    String(val).split("\n").forEach((line, i) => {
      if (i) el.appendChild(document.createElement("br"));
      el.appendChild(document.createTextNode(line));
    });
  });

  const c = STORE.config;
  const ig = (c.instagram || "").replace(/^@/, "");
  if ($("contact-ig")) {
    $("contact-ig").textContent = "@" + ig;
    $("contact-ig").href = "https://instagram.com/" + ig;
  }
  if ($("footer-ig")) $("footer-ig").textContent = "@" + ig;
  [["contact-email", c.emailGeneral], ["wholesale-email", c.emailMayoristas]].forEach(([id, mail]) => {
    if ($(id)) { $(id).textContent = mail; $(id).href = "mailto:" + mail; }
  });
  if ($("footer-email")) $("footer-email").textContent = c.emailGeneral;
  const fm = $("footer-email-mayoristas");
  if (fm) {
    const dup = c.emailMayoristas === c.emailGeneral;
    fm.hidden = dup;
    if (!dup) fm.textContent = c.emailMayoristas;
  }
  if ($("footer-wa")) $("footer-wa").textContent = formatWa(c.whatsapp);
  const cw = $("contact-whatsapp");
  if (cw && c.whatsapp) cw.textContent = "WhatsApp " + formatWa(c.whatsapp);
}

// "5491161143631" → "+54 9 11 6114-3631"
function formatWa(num) {
  const m = String(num || "").match(/^549(\d{2})(\d{4})(\d{4})$/);
  return m ? `+54 9 ${m[1]} ${m[2]}-${m[3]}` : (num ? "+" + num : "");
}

const waLink = (msg) =>
  STORE.config.whatsapp
    ? `https://wa.me/${STORE.config.whatsapp}?text=${encodeURIComponent(msg)}`
    : null;

function setupWhatsAppLinks() {
  const MSG_GENERAL = "¡Hola BUBA! Quiero hacerles una consulta.";
  const MSG_MAYORISTA = "¡Hola BUBA! Tengo un comercio y me interesa vender sus cocktails. ¿Me pasan info de precios mayoristas?";
  [["wholesale-whatsapp", MSG_MAYORISTA], ["contact-whatsapp", MSG_GENERAL], ["float-whatsapp", MSG_GENERAL]]
    .forEach(([id, msg]) => {
      const el = $(id);
      if (!el) return;
      const url = waLink(msg);
      if (url) el.href = url;
      else el.addEventListener("click", (e) => {
        e.preventDefault();
        alert("El WhatsApp de la tienda todavía no está configurado (se carga desde el panel /admin).");
      });
    });
}

/* ---------- Verificación de edad ---------- */
function setupAgeGate() {
  const gate = $("agegate");
  if (lsGet("buba-adult") === "1") return;
  gate.hidden = false;
  document.body.style.overflow = "hidden";
  $("age-yes").addEventListener("click", () => {
    lsSet("buba-adult", "1");
    gate.hidden = true;
    document.body.style.overflow = "";
  });
  $("age-no").addEventListener("click", () => {
    gate.querySelector(".agegate__box").innerHTML =
      '<p class="agegate__logo">BUBA<span class="logo__dot">.</span></p>' +
      "<h2>Volvé en unos años</h2>" +
      '<p class="agegate__sub">Este sitio es solo para mayores de 18 años.</p>' +
      '<p class="agegate__legal">' + esc(STORE.texts.legal) + "</p>";
  });
}

/* ==========================================================================
   VISOR 360 — la lata queda FIJA, lo impreso gira alrededor
   La foto de la lata (vidrio, líquido, brillos, tapa) no se toca: es la
   base estática. El texto impreso se separó en una capa aparte
   (assets/img/*-label.webp) y es lo único que se reproyecta sobre la
   esfera: se desliza, se comprime en el borde, desaparece (del otro lado
   la lata no dice nada) y reaparece al completar la vuelta. En 360° vuelve
   exactamente a la posición inicial.
   ========================================================================== */
const CANS = {
  blueberry: {
    base: "assets/img/blueberry-base.webp",
    label: "assets/img/blueberry-label.webp",
    sphere: { cx: 0.499, cy: 0.490, r: 0.497 },
  },
  peach: {
    base: "assets/img/peach-base.webp",
    label: "assets/img/peach-label.webp",
    sphere: { cx: 0.499, cy: 0.509, r: 0.494 },
  },
};

function setupViewer() {
  const stage = $("viewer-stage");
  const canvas = $("viewer-canvas");
  if (!stage || !canvas) return;

  const ctx = canvas.getContext("2d");
  const cache = {};
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let active = null;
  let theta = 0;
  let vel = 0;
  let dragging = false;
  let lastX = 0, lastT = 0;
  let idleAt = 0;

  function loadImg(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = src;
    });
  }

  function buildCan(key, cb) {
    if (cache[key]) return cb(cache[key]);
    const cfg = CANS[key];
    Promise.all([loadImg(cfg.base), loadImg(cfg.label)]).then(([baseImg, labelImg]) => {
      const H = Math.min(560, Math.max(380, stage.clientHeight || 460));
      const W = Math.round((baseImg.width / baseImg.height) * H);

      // base estática (lista para dibujar tal cual)
      const baseCv = document.createElement("canvas");
      baseCv.width = W; baseCv.height = H;
      baseCv.getContext("2d").drawImage(baseImg, 0, 0, W, H);

      // capa de texto, como datos para muestrear
      const labCv = document.createElement("canvas");
      labCv.width = W; labCv.height = H;
      labCv.getContext("2d").drawImage(labelImg, 0, 0, W, H);
      const label = labCv.getContext("2d").getImageData(0, 0, W, H);

      // canvas del texto rotado (se redibuja en cada frame)
      const overlayCv = document.createElement("canvas");
      overlayCv.width = W; overlayCv.height = H;

      // LUT de la esfera: seno/coseno de la longitud de cada píxel
      const cx = cfg.sphere.cx * W, cy = cfg.sphere.cy * H, r = cfg.sphere.r * W;
      const idx = [], sinL = [], cosL = [], rho = [];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const nx = (x - cx) / r, ny = (y - cy) / r;
          if (nx * nx + ny * ny > 0.998) continue;
          const cosLat = Math.sqrt(1 - ny * ny);
          if (cosLat < 0.04) continue;
          const lon = Math.asin(Math.max(-1, Math.min(1, nx / cosLat)));
          idx.push(y * W + x);
          sinL.push(Math.sin(lon));
          cosL.push(Math.cos(lon));
          rho.push(r * cosLat);
        }
      }

      cache[key] = {
        baseCv, label, overlayCv, W, H, cx, r,
        idx: Int32Array.from(idx),
        sinL: Float32Array.from(sinL),
        cosL: Float32Array.from(cosL),
        rho: Float32Array.from(rho),
      };
      cb(cache[key]);
    });
  }

  function render() {
    if (!active) return;
    const { baseCv, label, overlayCv, W, H, cx, idx, sinL, cosL, rho } = active;
    canvas.width = W; canvas.height = H;

    const cosT = Math.cos(theta), sinT = Math.sin(theta);
    const s = label.data;
    const octx = overlayCv.getContext("2d");
    const out = octx.createImageData(W, H);
    const o = out.data;

    for (let i = 0; i < idx.length; i++) {
      // longitud original del punto que hoy se ve en este píxel
      const sinL0 = sinL[i] * cosT - cosL[i] * sinT;
      const cosL0 = cosL[i] * cosT + sinL[i] * sinT;
      if (cosL0 <= 0.02) continue; // ese punto está en la parte de atrás: sin texto

      const p = idx[i], row = (p / W) | 0;
      const sx = cx + rho[i] * sinL0;
      const x0 = Math.max(0, Math.min(W - 1, Math.floor(sx)));
      const x1 = Math.min(W - 1, x0 + 1);
      const fx = Math.min(1, Math.max(0, sx - x0));
      const a0 = (row * W + x0) * 4, a1 = (row * W + x1) * 4;

      const aC = s[a0 + 3] + (s[a1 + 3] - s[a0 + 3]) * fx;
      if (aC < 2) continue; // acá no hay texto impreso: la base queda intacta

      const fade = Math.min(1, cosL0 / 0.12); // se desvanece justo en el borde
      const q = p * 4;
      o[q] = s[a0] + (s[a1] - s[a0]) * fx;
      o[q + 1] = s[a0 + 1] + (s[a1 + 1] - s[a0 + 1]) * fx;
      o[q + 2] = s[a0 + 2] + (s[a1 + 2] - s[a0 + 2]) * fx;
      o[q + 3] = aC * fade;
    }

    octx.putImageData(out, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(baseCv, 0, 0);      // la lata, quieta, con su color intacto
    ctx.drawImage(overlayCv, 0, 0);   // el texto, girando alrededor
  }

  let lastTheta = -1;
  function loop(now) {
    if (dragging) {
      // el drag actualiza theta directamente
    } else if (Math.abs(vel) > 0.0004) {
      theta += vel;
      vel *= 0.95; // inercia al soltar
      idleAt = now;
    } else if (!reduceMotion && now - idleAt > 1600) {
      theta += 0.005; // giro continuo automático
    }
    if (active && theta !== lastTheta) {
      render();
      lastTheta = theta;
    }
    requestAnimationFrame(loop);
  }

  function show(key) {
    buildCan(key, (can) => {
      active = can;
      lastTheta = -1;
    });
  }

  stage.addEventListener("pointerdown", (e) => {
    dragging = true;
    vel = 0;
    lastX = e.clientX;
    lastT = performance.now();
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (!dragging || !active) return;
    const dx = e.clientX - lastX;
    const dt = Math.max(1, performance.now() - lastT);
    const dTheta = dx / (active.r * 1.1); // sensación de agarrar la esfera
    theta += dTheta;
    vel = (dTheta / dt) * 16; // velocidad para la inercia
    lastX = e.clientX;
    lastT = performance.now();
  });
  const endDrag = () => {
    dragging = false;
    idleAt = performance.now();
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  const flavorBox = $("viewer-flavors");
  flavorBox.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-can]");
    if (!btn) return;
    flavorBox.querySelectorAll("button").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    show(btn.dataset.can);
  });

  show("blueberry");
  requestAnimationFrame(loop);
}

/* ==========================================================================
   TIENDA + CARRITO
   ========================================================================== */
const activeProducts = () => STORE.products.filter((p) => p.active !== false);
const findProduct = (id) => STORE.products.find((p) => p.id === id);

function renderProducts() {
  const grid = $("products");
  const cards = activeProducts().map((p) => {
    const out = (p.stock ?? 0) <= 0;
    return `
    <article class="product reveal is-visible">
      ${p.img
        ? `<div class="product__media"><img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy"></div>`
        : `<div class="photo" data-flavor="${esc(p.id)}"><span class="photo__label">FOTO ${esc(p.name).toUpperCase()}</span></div>`}
      <div class="product__body">
        <h3 class="product__name">${esc(p.name)}</h3>
        <p class="product__desc">${esc(p.desc)}</p>
        <div class="product__row">
          <span class="product__price">${money(p.price)}</span>
          ${out
            ? '<span class="product__stock-tag">Sin stock</span>'
            : `<button class="btn btn--outline btn--sm" data-add="${esc(p.id)}">Agregar</button>`}
        </div>
      </div>
    </article>`;
  });

  const soon = (STORE.comingSoon || []).map((name) => `
    <article class="product product--soon reveal is-visible">
      <div class="product__media product__media--soon"><span>?</span></div>
      <div class="product__body">
        <h3 class="product__name">${esc(name)}</h3>
        <p class="product__desc">Muy pronto. Suscribite abajo para enterarte antes que nadie.</p>
        <div class="product__row"><span class="product__soon-tag">Próximamente</span></div>
      </div>
    </article>`);

  grid.innerHTML = cards.concat(soon).join("");
}

/* ---------- Carrito ---------- */
let cart = lsJSON("buba-cart") || {};

const cartEntries = () =>
  Object.entries(cart)
    .map(([id, qty]) => ({ product: findProduct(id), qty }))
    .filter((e) => e.product && e.qty > 0);

const cartSubtotal = () => cartEntries().reduce((s, e) => s + e.product.price * e.qty, 0);
const cartCount = () => cartEntries().reduce((s, e) => s + e.qty, 0);

function updateCartUI() {
  $("cart-count").textContent = cartCount();
  $("cart-total").textContent = money(cartSubtotal());

  const entries = cartEntries();
  if (!entries.length) {
    $("cart-items").innerHTML =
      '<p class="cart__empty">Todavía no agregaste nada.<br>Tu color te está esperando.</p>';
    return;
  }
  $("cart-items").innerHTML = entries.map(({ product: p, qty }) => `
    <div class="cart-item">
      ${p.img
        ? `<img class="cart-item__swatch" src="${esc(p.img)}" alt="">`
        : '<div class="cart-item__swatch"></div>'}
      <div class="cart-item__info">
        <div class="cart-item__name">${esc(p.name)}</div>
        <div class="cart-item__price">${money(p.price)} c/u</div>
      </div>
      <div class="cart-item__qty">
        <button data-dec="${esc(p.id)}" aria-label="Quitar uno">−</button>
        <span>${qty}</span>
        <button data-inc="${esc(p.id)}" aria-label="Agregar uno">+</button>
      </div>
    </div>`).join("");
}

function addToCart(id, delta = 1) {
  const p = findProduct(id);
  if (!p) return;
  const next = Math.max(0, (cart[id] || 0) + delta);
  if (delta > 0 && next > (p.stock ?? 0)) {
    alert(`Solo quedan ${p.stock} unidades de ${p.name}.`);
    return;
  }
  cart[id] = next;
  if (!next) delete cart[id];
  lsSet("buba-cart", JSON.stringify(cart));
  updateCartUI();
}

function openCart() { $("cart").hidden = false; $("cart-overlay").hidden = false; document.body.style.overflow = "hidden"; }
function closeCart() { $("cart").hidden = true; $("cart-overlay").hidden = true; document.body.style.overflow = ""; }

/* ==========================================================================
   CHECKOUT
   ========================================================================== */
const checkoutState = { step: 1, customer: null, shipping: null, promo: null, geo: null };

function openCheckout() {
  if (!cartEntries().length) return;
  closeCart();
  gotoStep(1);
  $("checkout").hidden = false;
  $("checkout-overlay").hidden = false;
  document.body.style.overflow = "hidden";
}
function closeCheckout() {
  $("checkout").hidden = true;
  $("checkout-overlay").hidden = true;
  document.body.style.overflow = "";
}

function gotoStep(n) {
  checkoutState.step = n;
  ["step-1", "step-2", "step-3", "step-done"].forEach((id, i) => {
    $(id).hidden = (i + 1) !== n && !(n === 4 && id === "step-done");
  });
  if (n === 4) { $("step-1").hidden = $("step-2").hidden = $("step-3").hidden = true; $("step-done").hidden = false; }
  document.querySelectorAll("#checkout-steps span").forEach((s) => {
    const step = Number(s.dataset.step);
    s.classList.toggle("is-active", step === n);
    s.classList.toggle("is-done", step < n);
  });
  if (n === 2) renderShipOptions();
  if (n === 3) renderSummary();
}

/* ---------- Paso 1: datos ---------- */
function collectCustomer() {
  return {
    name: $("f-name").value.trim(),
    email: $("f-email").value.trim(),
    phone: $("f-phone").value.trim(),
    address: {
      street: $("f-street").value.trim(),
      apt: $("f-apt").value.trim(),
      city: $("f-city").value.trim(),
      province: $("f-province").value,
      cp: $("f-cp").value.trim(),
      notes: $("f-notes").value.trim(),
      geo: checkoutState.geo,
    },
  };
}

function setupGeo() {
  $("geo-btn").addEventListener("click", () => {
    const status = $("geo-status");
    if (!navigator.geolocation) { status.textContent = "Tu navegador no soporta geolocalización."; return; }
    status.textContent = "Buscando tu ubicación…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        checkoutState.geo = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        };
        status.textContent = `✓ Ubicación capturada (${checkoutState.geo.lat}, ${checkoutState.geo.lng})`;
      },
      () => { status.textContent = "No pudimos acceder a tu ubicación. Completá la dirección a mano."; },
      { timeout: 8000 }
    );
  });
}

/* ---------- Paso 2: envío ---------- */
function shipPrice(method) {
  const free = STORE.config.freeShippingFrom;
  if (free > 0 && cartSubtotal() >= free) return 0;
  return method.price;
}

// Zona según provincia + código postal: caba | gba | interior
function detectZone(province, cp) {
  const n = parseInt(String(cp).replace(/\D/g, ""), 10) || 0;
  if (province === "CABA" || (n >= 1000 && n <= 1499)) return "caba";
  if (province === "Buenos Aires" && n >= 1500 && n <= 2000) return "gba";
  return "interior";
}

const ZONE_LABELS = { caba: "CABA", gba: "GBA", interior: "Interior del país" };

function renderShipOptions() {
  const box = $("ship-options");
  const addr = checkoutState.customer?.address || {};
  const zone = detectZone(addr.province, addr.cp);
  let methods = STORE.shipping.filter((m) => m.active !== false);
  // la moto solo llega a CABA y GBA
  methods = methods.filter((m) => m.id !== "moto" || zone !== "interior");
  if (checkoutState.shipping && !methods.some((m) => m.id === checkoutState.shipping.id)) {
    checkoutState.shipping = null;
  }
  const zoneNote = `<p class="ship-zone">Enviando a: <strong>${esc(addr.city || "")}, ${esc(addr.province || "")}</strong> (zona ${ZONE_LABELS[zone]})</p>`;
  box.innerHTML = zoneNote + methods.map((m) => {
    const price = shipPrice(m);
    return `
    <label class="ship-option${checkoutState.shipping?.id === m.id ? " is-selected" : ""}">
      <input type="radio" name="ship" value="${esc(m.id)}" ${checkoutState.shipping?.id === m.id ? "checked" : ""}>
      <div class="ship-option__info">
        <div class="ship-option__name">${esc(m.name)}</div>
        <div class="ship-option__eta">${esc(m.eta)}</div>
      </div>
      <div class="ship-option__price ${price === 0 ? "is-free" : ""}">${price === 0 ? "GRATIS" : money(price)}</div>
    </label>`;
  }).join("");

  box.querySelectorAll("input[name=ship]").forEach((input) => {
    input.addEventListener("change", () => {
      const m = methods.find((x) => x.id === input.value);
      checkoutState.shipping = { id: m.id, name: m.name, eta: m.eta, price: shipPrice(m) };
      box.querySelectorAll(".ship-option").forEach((el) => el.classList.remove("is-selected"));
      input.closest(".ship-option").classList.add("is-selected");
      $("next-3").disabled = false;
    });
  });
  $("next-3").disabled = !checkoutState.shipping;
}

/* ---------- Paso 3: resumen + promos + pago ---------- */
function promoDiscount() {
  const p = checkoutState.promo;
  if (!p) return 0;
  return p.type === "percent" ? cartSubtotal() * (p.value / 100) : Math.min(p.value, cartSubtotal());
}

function orderTotal() {
  return cartSubtotal() - promoDiscount() + (checkoutState.shipping?.price ?? 0);
}

function renderSummary() {
  const rows = cartEntries().map(({ product: p, qty }) =>
    `<div class="summary__row"><span>${qty} × ${esc(p.name)}</span><strong>${money(p.price * qty)}</strong></div>`);
  rows.push(`<div class="summary__row"><span>Subtotal</span><strong>${money(cartSubtotal())}</strong></div>`);
  if (checkoutState.promo) {
    rows.push(`<div class="summary__row"><span>Descuento (${esc(checkoutState.promo.code)})</span><strong class="discount">− ${money(promoDiscount())}</strong></div>`);
  }
  const ship = checkoutState.shipping;
  rows.push(`<div class="summary__row"><span>Envío · ${esc(ship.name)}</span><strong>${ship.price === 0 ? "GRATIS" : money(ship.price)}</strong></div>`);
  rows.push(`<div class="summary__row total"><span>Total</span><span>${money(orderTotal())}</span></div>`);
  $("summary").innerHTML = rows.join("");
}

function setupPromo() {
  $("promo-apply").addEventListener("click", () => {
    const code = $("promo-input").value.trim().toUpperCase();
    const status = $("promo-status");
    const promo = (STORE.promos || []).find((p) => p.active !== false && p.code.toUpperCase() === code);
    if (promo) {
      checkoutState.promo = promo;
      status.textContent = "✓ Descuento aplicado";
      status.className = "promo-status ok";
    } else {
      checkoutState.promo = null;
      status.textContent = "Código inválido";
      status.className = "promo-status err";
    }
    renderSummary();
  });
}

/* ---------- Crear la orden ---------- */
function buildOrder(payMethod) {
  return {
    code: "BUBA-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
    createdAt: new Date().toISOString(),
    items: cartEntries().map(({ product: p, qty }) => ({ id: p.id, name: p.name, price: p.price, qty })),
    customer: checkoutState.customer,
    shipping: checkoutState.shipping,
    promo: checkoutState.promo ? { code: checkoutState.promo.code, discount: Math.round(promoDiscount()) } : null,
    subtotal: cartSubtotal(),
    total: Math.round(orderTotal()),
    payMethod,
    status: "pendiente",
  };
}

function persistOrder(order) {
  const orders = lsJSON("buba-orders") || [];
  orders.unshift(order);
  lsSet("buba-orders", JSON.stringify(orders));

  // descontar stock (queda reflejado en el panel)
  const store = JSON.parse(JSON.stringify(STORE));
  order.items.forEach((it) => {
    const p = store.products.find((x) => x.id === it.id);
    if (p) p.stock = Math.max(0, (p.stock ?? 0) - it.qty);
  });
  lsSet("buba-store", JSON.stringify(store));
  STORE = store;
  renderProducts();
}

function finishOrder(order, msg) {
  persistOrder(order);
  cart = {};
  lsSet("buba-cart", JSON.stringify(cart));
  updateCartUI();
  $("done-msg").textContent = msg;
  $("done-code").textContent = "Nº de pedido: " + order.code;
  gotoStep(4);
}

function orderWaMessage(order) {
  const lines = order.items.map((it) => `• ${it.qty}x ${it.name} — ${money(it.price * it.qty)}`);
  const a = order.customer.address;
  return (
    `¡Hola BUBA! Quiero confirmar mi pedido ${order.code}:\n\n` +
    lines.join("\n") +
    (order.promo ? `\nDescuento ${order.promo.code}: −${money(order.promo.discount)}` : "") +
    `\nEnvío: ${order.shipping.name} — ${order.shipping.price === 0 ? "GRATIS" : money(order.shipping.price)}` +
    `\nTotal: ${money(order.total)}\n\n` +
    `Soy ${order.customer.name} (${order.customer.phone}).\n` +
    `Dirección: ${a.street}${a.apt ? " " + a.apt : ""}, ${a.city}, ${a.province} (CP ${a.cp}).` +
    (a.notes ? `\nNotas: ${a.notes}` : "") +
    `\n\nSoy mayor de 18 años.`
  );
}

/* ---------- Pago ---------- */
async function payWithMP() {
  const order = buildOrder("mercadopago");
  const api = STORE.config.apiBase;
  if (!api) {
    finishOrder(order,
      "Registramos tu pedido. El pago online con Mercado Pago se está terminando de configurar: " +
      "te vamos a contactar por WhatsApp o email para completar el pago.");
    return;
  }
  const btn = $("pay-mp");
  btn.disabled = true;
  btn.textContent = "Conectando con Mercado Pago…";
  try {
    const res = await fetch(api.replace(/\/$/, "") + "/api/create-preference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    persistOrder(order);
    window.location.href = data.init_point;
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Pagar con Mercado Pago";
    alert("No pudimos conectar con Mercado Pago (" + err.message + "). Probá de nuevo o coordiná por WhatsApp.");
  }
}

function payWithWhatsApp() {
  const order = buildOrder("whatsapp");
  const url = waLink(orderWaMessage(order));
  finishOrder(order,
    url
      ? "Te abrimos WhatsApp con el detalle del pedido para coordinar pago y entrega."
      : "Registramos tu pedido. Te vamos a contactar para coordinar pago y entrega.");
  if (url) window.open(url, "_blank");
}

/* ---------- Wiring del checkout ---------- */
function setupCheckout() {
  $("cart-checkout").addEventListener("click", openCheckout);
  $("checkout-close").addEventListener("click", closeCheckout);
  $("checkout-overlay").addEventListener("click", closeCheckout);

  $("step-1").addEventListener("submit", (e) => {
    e.preventDefault();
    checkoutState.customer = collectCustomer();
    gotoStep(2);
  });
  $("back-1").addEventListener("click", () => gotoStep(1));
  $("next-3").addEventListener("click", () => gotoStep(3));
  $("back-2").addEventListener("click", () => gotoStep(2));
  $("pay-mp").addEventListener("click", payWithMP);
  $("pay-wa").addEventListener("click", payWithWhatsApp);
  $("done-close").addEventListener("click", closeCheckout);
  setupGeo();
  setupPromo();
}

/* ==========================================================================
   MISC
   ========================================================================== */
function setupMobileMenu() {
  const burger = $("hamburger");
  const nav = $("nav");
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

function setupReveal() {
  const observer = new IntersectionObserver((items) => {
    items.forEach((item) => {
      if (item.isIntersecting) {
        item.target.classList.add("is-visible");
        observer.unobserve(item.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
}

function setupNewsletter() {
  $("newsletter-form").addEventListener("submit", (e) => {
    e.preventDefault();
    // Conectar acá con el servicio de mailing (Mailchimp, Brevo, etc.)
    $("newsletter-form").hidden = true;
    $("newsletter-ok").hidden = false;
  });
}

/* ---------- Init ---------- */
// Si el panel (otra pestaña del mismo sitio) guarda cambios, la web se
// actualiza en vivo sin recargar.
window.addEventListener("storage", async (e) => {
  if (e.key !== "buba-store") return;
  STORE = await resolveStore();
  applyTexts();
  renderProducts();
  updateCartUI();
  setupWhatsAppLinks();
});

document.addEventListener("DOMContentLoaded", async () => {
  STORE = await resolveStore();

  setupAgeGate();
  applyTexts();
  renderProducts();
  updateCartUI();
  setupViewer();
  setupWhatsAppLinks();
  setupMobileMenu();
  setupNewsletter();
  setupReveal();
  setupCheckout();

  $("cart-open").addEventListener("click", openCart);
  $("cart-close").addEventListener("click", closeCart);
  $("cart-overlay").addEventListener("click", closeCart);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeCart(); closeCheckout(); }
  });

  document.body.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    const inc = e.target.closest("[data-inc]");
    const dec = e.target.closest("[data-dec]");
    if (add) { addToCart(add.dataset.add, 1); openCart(); }
    if (inc) addToCart(inc.dataset.inc, 1);
    if (dec) addToCart(dec.dataset.dec, -1);
  });
});
