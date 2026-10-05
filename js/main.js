/* ==========================================================================
   BUBA — Web pública
   - Datos de la tienda: defaults + data/store.json (publicado por el panel)
     + localStorage (cambios locales del panel). Todo editable desde /admin.
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
    const r = await fetch("data/store.json?t=" + Date.now(), { cache: "no-store" });
    if (r.ok) store = mergeStore(store, await r.json());
  } catch { /* offline o file:// → defaults */ }
  // Lo guardado en este navegador solo vale si tiene cambios sin publicar
  // (vista previa del panel) y es de la misma estructura. Si no, manda lo
  // publicado: así una copia vieja nunca pisa ni se vuelve a publicar.
  const local = lsJSON("buba-store");
  let pendiente = false;
  try { pendiente = localStorage.getItem("buba-dirty") === "1"; } catch {}
  if (local && pendiente && (local.version || 1) >= (store.version || 1)) store = mergeStore(store, local);
  return store;
}

// merge superficial por sección: cada bloque del panel reemplaza al default
function mergeStore(base, over) {
  const out = { ...base };
  // Si lo guardado es de una estructura anterior, las listas (productos,
  // envíos, sabores) y los textos se descartan: manda la estructura nueva.
  // Solo se conservan la configuración y las imágenes.
  const vieja = (over.version || 1) < (base.version || 1);
  if (over.config) out.config = { ...base.config, ...over.config };
  // Un valor vacío guardado en un navegador no borra uno publicado
  // (por ejemplo, la dirección de pagos).
  for (const k of Object.keys(over.config || {})) {
    if (over.config[k] === "" && base.config && base.config[k]) out.config[k] = base.config[k];
  }
  if (!vieja) {
    if (over.texts) out.texts = { ...base.texts, ...over.texts };
    for (const k of ["products", "flavors", "shipping", "promos", "comingSoon"]) {
      if (Array.isArray(over[k])) out[k] = over[k];
    }
  }
  if (over.images) out.images = { ...base.images, ...over.images };
  out.version = Math.max(base.version || 1, over.version || 1);
  return out;
}

/* ---------- Imagen de portada (cargada desde el panel) ---------- */
function applyImages() {
  const box = $("hero-media");
  if (!box) return;
  const pack = activeProducts()[0];
  const src = (STORE.images && STORE.images.hero) || (pack && pack.img) || "";
  box.innerHTML = src
    ? `<img src="${esc(src)}" alt="Pack x4 BUBA">`
    : '<div class="placeholder placeholder--hero"><span>IMAGEN DEL PACK x4</span><small>Se carga desde el panel → Fotos</small></div>';
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
  if ($("footer-ig")) $("footer-ig").textContent = "@" + ig;
  if ($("footer-email")) $("footer-email").textContent = c.emailGeneral;
  if ($("footer-wa")) $("footer-wa").textContent = formatWa(c.whatsapp);
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
  const el = $("float-whatsapp");
  if (!el) return;
  const url = waLink("¡Hola BUBA! Quiero hacerles una consulta.");
  if (url) el.href = url;
  else el.addEventListener("click", (e) => {
    e.preventDefault();
    alert("El WhatsApp de la tienda todavía no está configurado (se carga desde el panel /admin).");
  });
}

/* ==========================================================================
   MODO PRIVADO — la web tapada hasta la apertura
   Con el código de acceso se entra y queda recordado en ese dispositivo.
   ========================================================================== */
function setupCurtain() {
  const cur = $("curtain");
  if (!cur) return true;
  const c = STORE.config;
  const codigo = String(c.codigoAcceso || "");

  // ya entró antes, o viene con el código en el link (bubadrinks.com.ar/?acceso=xxxx)
  const q = new URLSearchParams(location.search);
  if (q.get("acceso") && codigo && q.get("acceso") === codigo) {
    lsSet("buba-acceso", codigo);
    history.replaceState(null, "", location.pathname + location.hash);
  }
  if (!c.privado || lsGet("buba-acceso") === codigo) return true;

  cur.hidden = false;
  document.body.classList.add("is-locked");

  $("curtain-toggle").addEventListener("click", () => {
    $("curtain-code").hidden = false;
    $("curtain-toggle").hidden = true;
    $("curtain-input").focus();
  });
  $("curtain-code").addEventListener("submit", (e) => {
    e.preventDefault();
    if ($("curtain-input").value.trim() === codigo) {
      lsSet("buba-acceso", codigo);
      cur.hidden = true;
      document.body.classList.remove("is-locked");
      setupAgeGate();
    } else {
      $("curtain-err").hidden = false;
    }
  });
  $("curtain-news").addEventListener("submit", (e) => {
    e.preventDefault();
    $("curtain-news").hidden = true;
    $("curtain-ok").hidden = false;
  });
  return false;
}

/* ---------- Verificación de edad ---------- */
function setupAgeGate() {
  const gate = $("agegate");
  if (!gate || lsGet("buba-adult") === "1") return;
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
   TIENDA + CARRITO
   ========================================================================== */
const activeProducts = () => STORE.products.filter((p) => p.active !== false && p.prueba !== true);
// Productos de prueba: solo se ven con la web cerrada (modo privado) para que el dueño pruebe la compra.
const testProducts = () =>
  STORE.config.privado ? STORE.products.filter((p) => p.prueba === true && p.active !== false) : [];
const findProduct = (id) => STORE.products.find((p) => p.id === id);

const activeFlavors = () => (STORE.flavors || []).filter((f) => f.active !== false);

// color de relleno cuando un sabor todavía no tiene foto
function flavorColor(f) {
  const n = (f.name + " " + f.id).toLowerCase();
  if (/pink|rosa|lemonade/.test(n)) return "radial-gradient(120% 120% at 30% 20%, #ffb1d4 0%, #ec5f9f 55%, #96285f 100%)";
  if (/straw|frutilla|roja|ice/.test(n)) return "radial-gradient(120% 120% at 30% 20%, #ff8f8f 0%, #e03e3e 55%, #8a1010 100%)";
  if (/peach|durazno|naranja/.test(n)) return "var(--ph-peach)";
  return "var(--ph-blueberry)";
}

function renderFlavors() {
  const grid = $("flavors");
  if (!grid) return;
  grid.innerHTML = activeFlavors().map((f) => `
    <button type="button" class="flavor" data-flavor="${esc(f.id)}" aria-label="Ver ${esc(f.name)}">
      ${f.img
        ? `<div class="flavor__media"><img src="${esc(f.img)}" alt="${esc(f.name)}" loading="lazy"></div>`
        : `<div class="flavor__media flavor__media--color" style="background:${esc(f.color || flavorColor(f))}"><span style="color:${esc(f.ink || "#fff")}">${esc(f.name.split(" ")[0])}</span></div>`}
      <span class="flavor__name">${esc(f.name)}</span>
      <span class="flavor__notes">${esc((f.notes || []).join(" · "))}</span>
    </button>`).join("");
}

/* ---------- Ficha del sabor (hoja inferior / diálogo) ---------- */
let flavorOpener = null;

function openFlavor(id) {
  const f = activeFlavors().find((x) => x.id === id);
  if (!f || !$("flavor-sheet")) return;
  flavorOpener = document.activeElement;

  $("fs-name").textContent = f.name;

  const desc = $("fs-desc");
  desc.textContent = "";
  String(f.desc || "").split("\n").forEach((line, i) => {
    if (i) desc.appendChild(document.createElement("br"));
    desc.appendChild(document.createTextNode(line));
  });

  const notes = $("fs-notes");
  notes.textContent = "";
  (f.notes || []).forEach((n) => {
    const li = document.createElement("li");
    li.textContent = n;
    notes.appendChild(li);
  });

  const media = $("fs-media");
  media.textContent = "";
  if (f.img) {
    const img = document.createElement("img");
    img.src = f.img;
    img.alt = f.name;
    media.appendChild(img);
    media.hidden = false;
  } else {
    media.hidden = true;
  }

  const sheet = $("flavor-sheet");
  sheet.style.setProperty("--fs-bg", f.color || "#f5f5f7");
  sheet.style.setProperty("--fs-ink", f.ink || "#1d1d1f");
  sheet.hidden = false;
  $("flavor-overlay").hidden = false;
  document.body.style.overflow = "hidden";
  $("fs-close").focus();
}

function closeFlavor() {
  const sheet = $("flavor-sheet");
  if (!sheet || sheet.hidden) return;
  sheet.hidden = true;
  $("flavor-overlay").hidden = true;
  document.body.style.overflow = "";
  if (flavorOpener && flavorOpener.focus) flavorOpener.focus();
  flavorOpener = null;
}

/* Despacho: el pedido de un día D sale el primer día hábil posterior a D
   (lunes a viernes, sin los feriados que carga el panel). */
const DIAS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
function fechaDespacho(desde = new Date()) {
  const feriados = (STORE.config && STORE.config.feriados) || [];
  const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  for (let i = 0; i < 30; i++) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6 && !feriados.includes(iso(d))) break;
  }
  return d;
}
function textoDespacho(d) {
  const hoy = new Date();
  const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
  const esManana = d.getFullYear() === manana.getFullYear() && d.getMonth() === manana.getMonth() && d.getDate() === manana.getDate();
  return `${esManana ? "mañana" : "el"} ${DIAS_ES[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

// texto de disponibilidad del pack según el stock real
function stockLabel(p) {
  const st = p.stock ?? 0;
  if (st <= 0) return { cls: "is-out", txt: "Sin stock" };
  if (st <= 10) return { cls: "is-low", txt: `Últimas ${st}` };
  return { cls: "is-ok", txt: "Hay stock" };
}

function renderProducts() {
  const grid = $("products");
  if (!grid) return;
  renderFlavors();
  const p = activeProducts()[0];
  if (!p) {
    grid.innerHTML = '<p class="pack-empty">Muy pronto abrimos la venta.</p>';
    return;
  }
  const out = (p.stock ?? 0) <= 0;
  const st = stockLabel(p);
  grid.innerHTML = `
    <article class="pack">
      <div class="pack__media">
        ${p.img
          ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy">`
          : '<div class="placeholder placeholder--pack"><span>FOTO DEL PACK</span></div>'}
      </div>
      <div class="pack__body">
        <p class="pack__price">${money(p.price)}</p>
        <span class="pack__stock ${st.cls}">${st.txt}</span>
        ${out
          ? '<a href="#" class="btn btn--outline btn--lg btn--block" id="pack-waitlist">Avisame cuando vuelva</a>'
          : `<div class="qty" role="group" aria-label="Cantidad">
          <button type="button" class="qty__btn" id="pack-dec" aria-label="Menos">−</button>
          <span class="qty__val" id="pack-qty">1</span>
          <button type="button" class="qty__btn" id="pack-inc" aria-label="Más">+</button>
        </div>
        <p class="pack__limit" id="pack-limit" hidden></p>
        <button type="button" class="btn btn--solid btn--lg btn--block" id="pack-buy">${esc(STORE.texts.packCta || "Comprar")}</button>
        <p class="pack__note">${esc(STORE.texts.packNote || "Envío a CABA y GBA. Lo cotizás en el carrito con tu código postal.")}</p>
        <p class="pack__dispatch">Si comprás hoy, sale ${esc(textoDespacho(fechaDespacho()))}.</p>`}
      </div>
    </article>${testProducts().length ? `
    <div class="pack-test">
      <p class="pack-test__title">🧪 Modo prueba</p>
      <p class="pack-test__text">Solo se ve con la web cerrada. El envío de esta compra sale $0.</p>
      ${testProducts().map((t) => `
      <div class="pack-test__row">
        <span class="pack-test__name">${esc(t.name)}</span>
        <span class="pack-test__price">${money(t.price)}</span>
        <button type="button" class="btn btn--outline btn--block" data-add-prueba="${esc(t.id)}">Agregar al carrito</button>
      </div>`).join("")}
    </div>` : ""}`;

  if (!grid.dataset.pruebaBound) {
    grid.dataset.pruebaBound = "1";
    grid.addEventListener("click", (e) => {
      const b = e.target.closest("[data-add-prueba]");
      if (!b) return;
      addToCart(b.dataset.addPrueba, 1);
      openCart();
    });
  }

  const wl = $("pack-waitlist");
  if (wl) wl.addEventListener("click", (e) => {
    e.preventDefault();
    const url = waLink("¡Hola BUBA! Quiero que me avisen cuando vuelva el pack de 4.");
    if (url) window.open(url, "_blank");
  });

  const buy = $("pack-buy");
  if (!buy) return;
  let qty = 1;
  const qtyEl = $("pack-qty"), limit = $("pack-limit");
  const maxQty = () => Math.max(1, (p.stock ?? 0) - (cart[p.id] || 0));
  const showQty = () => { qtyEl.textContent = qty; };
  $("pack-inc").addEventListener("click", () => {
    if (qty >= maxQty()) {
      limit.textContent = `Solo quedan ${p.stock} en stock.`;
      limit.hidden = false;
      return;
    }
    qty++;
    limit.hidden = true;
    showQty();
  });
  $("pack-dec").addEventListener("click", () => {
    if (qty > 1) qty--;
    limit.hidden = true;
    showQty();
  });
  buy.addEventListener("click", () => {
    addToCart(p.id, qty);
    qty = 1;
    limit.hidden = true;
    showQty();
    openCart();
  });
}

/* ---------- Carrito ---------- */
let cart = lsJSON("buba-cart") || {};

const cartEntries = () =>
  Object.entries(cart)
    .map(([id, qty]) => ({ product: findProduct(id), qty }))
    // un producto de prueba no cuenta si la web ya está abierta al público
    .filter((e) => e.product && e.qty > 0 && !(e.product.prueba && !STORE.config.privado));

const cartSubtotal = () => cartEntries().reduce((s, e) => s + e.product.price * e.qty, 0);
const cartCount = () => cartEntries().reduce((s, e) => s + e.qty, 0);

function updateCartUI() {
  $("cart-count").textContent = cartCount();
  $("cart-total").textContent = money(cartSubtotal());

  const entries = cartEntries();
  if (!entries.length) {
    $("cart-items").innerHTML =
      '<p class="cart__empty">Todavía no agregaste nada.</p>';
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
  const cp = ($("cart-cp") && $("cart-cp").value.trim()) || lsGet("buba-cp") || "";
  if (cp && $("f-cp") && !$("f-cp").value) $("f-cp").value = cp;
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
  if (!$("geo-btn")) return;
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
  // Carrito solo con productos de prueba: el envío sale $0
  const entries = cartEntries();
  if (entries.length && entries.every((e) => e.product.prueba === true)) return 0;
  const free = STORE.config.freeShippingFrom;
  if (free > 0 && cartSubtotal() >= free) return 0;
  return method.price;
}

/* Zonas de envío por código postal.
   Cada método de envío tiene "cps": rangos y listas ("1000-1499, 1602").
   Un método sin códigos postales se ofrece siempre (retiro en persona). */
function cpMatches(cps, cp) {
  const n = parseInt(String(cp).replace(/\D/g, ""), 10);
  if (!n) return false;
  return String(cps || "").split(",").some((part) => {
    const t = part.trim();
    if (!t) return false;
    const m = t.match(/^(\d{4})\s*-\s*(\d{4})$/);
    if (m) return n >= Number(m[1]) && n <= Number(m[2]);
    return Number(t) === n;
  });
}

// métodos disponibles para un CP: los que lo cubren + los que no piden CP
function methodsForCp(cp) {
  const all = STORE.shipping.filter((m) => m.active !== false);
  return all.filter((m) => !String(m.cps || "").trim() || cpMatches(m.cps, cp));
}
const deliveryFor = (cp) => methodsForCp(cp).find((m) => String(m.cps || "").trim());

function renderShipOptions() {
  const box = $("ship-options");
  const addr = checkoutState.customer?.address || {};
  const methods = methodsForCp(addr.cp);
  const delivery = methods.find((m) => String(m.cps || "").trim());
  if (checkoutState.shipping && !methods.some((m) => m.id === checkoutState.shipping.id)) {
    checkoutState.shipping = null;
  }
  const zoneNote = delivery
    ? `<p class="ship-zone">Enviamos a <strong>${esc(addr.city || "")} (CP ${esc(addr.cp || "")})</strong> con Mandalo Ya.</p>`
    : `<p class="ship-zone ship-zone--none">${esc(STORE.config.envioNoCubierto || "Por ahora no llegamos a ese código postal.")}</p>`;
  const dispatchNote = delivery
    ? `<p class="ship-dispatch">Armamos tu pedido y sale ${esc(textoDespacho(fechaDespacho()))}. Los pedidos de viernes a domingo salen el lunes.</p>`
    : "";
  box.innerHTML = zoneNote + dispatchNote + methods.map((m) => {
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
  // el envío a domicilio queda preseleccionado; si no hay cobertura, el retiro
  if (!checkoutState.shipping) {
    const pre = delivery || methods[0];
    const inp = pre && box.querySelector(`input[name=ship][value="${pre.id}"]`);
    if (inp) { inp.checked = true; inp.dispatchEvent(new Event("change")); }
  }
  $("next-3").disabled = !checkoutState.shipping;
}

/* Cotizador del carrito: el cliente ve cuánto sale el envío antes de comprar */
function setupCartQuote() {
  const btn = $("cart-quote-btn"), inp = $("cart-cp"), out = $("cart-quote-result");
  if (!btn || !inp || !out) return;
  const quote = () => {
    const cp = inp.value.trim();
    if (cp.length < 4) { out.className = "cart-quote__result"; out.textContent = "Faltan números del código postal."; return; }
    const d = deliveryFor(cp);
    lsSet("buba-cp", cp);
    if (d) {
      const price = shipPrice(d);
      out.className = "cart-quote__result is-ok";
      out.innerHTML = `${esc(d.name)}: <strong>${price === 0 ? "GRATIS" : money(price)}</strong><br><span class="cart-quote__ship">Sale ${esc(textoDespacho(fechaDespacho()))} · ${esc(d.eta)}</span>`;
    } else {
      out.className = "cart-quote__result is-none";
      out.textContent = STORE.config.envioNoCubierto || "Por ahora no llegamos a ese código postal.";
    }
  };
  btn.addEventListener("click", quote);
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); quote(); } });
  let liveTimer = null;
  inp.addEventListener("input", () => {
    clearTimeout(liveTimer);
    if (inp.value.trim().length === 4) liveTimer = setTimeout(quote, 250);
    else out.textContent = "";
  });
  const saved = lsGet("buba-cp");
  if (saved) { inp.value = saved; quote(); }
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
  // el botón de Mercado Pago solo aparece si el servidor de pagos está conectado
  if ($("pay-mp")) $("pay-mp").hidden = !STORE.config.apiBase;
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
  if (!$("promo-apply")) return;
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
  trackPurchase(order);
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
    // sin servidor de pagos no se finge un pago: se ofrece coordinarlo por WhatsApp
    alert("El pago con Mercado Pago no está disponible en este momento. Podés coordinar el pago por WhatsApp.");
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
  if (!$("checkout") || !$("cart-checkout")) return;
  $("cart-checkout").addEventListener("click", openCheckout);
  $("checkout-close").addEventListener("click", closeCheckout);
  $("checkout-overlay").addEventListener("click", closeCheckout);

  const savedCp = lsGet("buba-cp");
  if (savedCp && $("f-cp") && !$("f-cp").value) $("f-cp").value = savedCp;
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
/* ---------- Init ---------- */
// Si el panel (otra pestaña del mismo sitio) guarda cambios, la web se
// actualiza en vivo sin recargar.
window.addEventListener("storage", async (e) => {
  if (e.key !== "buba-store") return;
  STORE = await resolveStore();
  applyTexts();
  applyImages();
  renderProducts();
  updateCartUI();
  setupWhatsAppLinks();
});

/* ---------- Analytics (doc 07 módulo 9): IDs configurables desde el panel ---------- */
function setupAnalytics() {
  const c = STORE.config;
  try {
    if (c.ga4Id) {
      const s = document.createElement("script");
      s.async = true;
      s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(c.ga4Id);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      gtag("js", new Date());
      gtag("config", c.ga4Id);
    }
    if (c.metaPixelId) {
      !(function (f, b, e, v, n, t) {
        if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
        f._fbq = n; n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
        t = b.createElement(e); t.async = true; t.src = v;
        b.getElementsByTagName(e)[0].parentNode.insertBefore(t, b.getElementsByTagName(e)[0]);
      })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      fbq("init", c.metaPixelId);
      fbq("track", "PageView");
    }
    if (c.tiktokPixelId) {
      const s = document.createElement("script");
      s.async = true;
      s.src = "https://analytics.tiktok.com/i18n/pixel/sdk.js?sdkid=" + encodeURIComponent(c.tiktokPixelId);
      document.head.appendChild(s);
    }
  } catch { /* analytics nunca debe romper la web */ }
}

// evento de compra hacia los pixels configurados
function trackPurchase(order) {
  try {
    if (window.gtag) gtag("event", "purchase", {
      transaction_id: order.code, value: order.total, currency: "ARS",
      items: order.items.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.qty })),
    });
    if (window.fbq) fbq("track", "Purchase", { value: order.total, currency: "ARS" });
  } catch {}
}

/* ---------- Vuelta desde Mercado Pago ---------- */
/* Vuelta desde Mercado Pago.
   La dirección de vuelta (?pago=ok|pendiente|error) no siempre coincide con
   lo que pasó: en el celular el cliente puede pagar desde la app de Mercado
   Pago y volver por otro camino. Por eso se le pregunta al servidor el estado
   real del pedido y el mensaje se arma con esa respuesta. */
const PAGO_TEXTOS = {
  ok: ["¡Listo, pago confirmado! 🎉", "Ya estamos preparando tu pedido. Te escribimos por WhatsApp para coordinar la entrega."],
  pendiente: ["Tu pago está en proceso", "Cuando Mercado Pago lo confirme te avisamos. Si pagaste en efectivo, puede tardar unas horas."],
  error: ["El pago no se completó", "Si ves el débito en tu cuenta, no te preocupes: escribinos por WhatsApp con tu número de pedido y lo revisamos. Si no, podés intentar de nuevo."],
  verificando: ["Verificando tu pago…", "Estamos confirmando el pago con Mercado Pago. Un momento."],
};

// estados de Mercado Pago → mensaje de la web
const estadoDesdeMP = (s) =>
  s === "approved" ? "ok"
  : (s === "pending" || s === "in_process" || s === "authorized") ? "pendiente"
  : (s === "rejected" || s === "cancelled" || s === "null") ? "error"
  : null;

function showPaymentResult(estado, pedido) {
  const textos = PAGO_TEXTOS[estado];
  if (!textos) return;
  if (estado === "ok" && pedido) {
    const orders = lsJSON("buba-orders") || [];
    const o = orders.find((x) => x.code === pedido);
    if (o) { o.status = "pagado"; lsSet("buba-orders", JSON.stringify(orders)); }
  }
  if (estado === "ok") { cart = {}; lsSet("buba-cart", JSON.stringify(cart)); updateCartUI(); }
  $("done-msg").textContent = textos[1];
  $("done-code").textContent = pedido ? "Nº de pedido: " + pedido : "";
  $("step-done").querySelector("h3").textContent = textos[0];
  const icon = $("step-done").querySelector(".done-icon");
  if (icon) icon.textContent = { ok: "✓", pendiente: "…", verificando: "…", error: "!" }[estado] || "✓";
  $("checkout").hidden = false;
  $("checkout-overlay").hidden = false;
  document.body.style.overflow = "hidden";
  gotoStep(4);
}

async function checkPaymentReturn() {
  const q = new URLSearchParams(location.search);
  const vuelta = q.get("pago");
  if (!vuelta) return;
  const pedido = q.get("pedido") || q.get("external_reference") || "";
  const paymentId = q.get("payment_id") || q.get("collection_id") || "";
  // lo que dice Mercado Pago en la propia dirección de vuelta, si lo trae
  let estado = estadoDesdeMP(q.get("collection_status") || q.get("status")) || vuelta;
  history.replaceState(null, "", location.pathname);

  const api = String(STORE.config.apiBase || "").replace(/\/$/, "");
  if (!api || (!pedido && !paymentId) || estado === "ok") { showPaymentResult(estado, pedido); return; }

  showPaymentResult("verificando", pedido);
  try {
    const params = paymentId && /^\d+$/.test(paymentId) ? "id=" + paymentId : "pedido=" + encodeURIComponent(pedido);
    const r = await fetch(`${api}/api/estado-pago?${params}`, { cache: "no-store" });
    const data = r.ok ? await r.json() : null;
    const real = data && data.ok ? estadoDesdeMP(data.estado) : null;
    if (real) estado = real;
    else if (data && data.ok && data.estado === "sin_pago" && estado !== "pendiente") estado = "error";
  } catch { /* sin respuesta: queda lo que dijo la vuelta */ }
  showPaymentResult(estado, pedido);
}

document.addEventListener("DOMContentLoaded", async () => {
  STORE = await resolveStore();

  applyTexts();
  const abierta = setupCurtain();
  if (abierta) setupAgeGate();
  applyImages();
  setupAnalytics();
  if (window.BUBA_SEO) window.BUBA_SEO.inject(STORE);
  renderProducts();
  updateCartUI();
  setupWhatsAppLinks();
  setupCheckout();
  setupCartQuote();

  if ($("cart-open")) $("cart-open").addEventListener("click", openCart);
  if ($("cart-close")) $("cart-close").addEventListener("click", closeCart);
  // volviendo de una página de producto con ?cart=1, abrimos el carrito
  checkPaymentReturn();
  if (new URLSearchParams(location.search).has("cart")) {
    history.replaceState(null, "", location.pathname + location.hash);
    if (cartEntries().length) openCart();
  }
  if ($("cart-overlay")) $("cart-overlay").addEventListener("click", closeCart);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeFlavor(); closeCart(); closeCheckout(); }
  });
  if ($("flavors")) $("flavors").addEventListener("click", (e) => {
    const card = e.target.closest("[data-flavor]");
    if (card) openFlavor(card.dataset.flavor);
  });
  if ($("fs-close")) $("fs-close").addEventListener("click", closeFlavor);
  if ($("flavor-overlay")) $("flavor-overlay").addEventListener("click", closeFlavor);

  document.body.addEventListener("click", (e) => {
    const inc = e.target.closest("[data-inc]");
    const dec = e.target.closest("[data-dec]");
    if (inc) addToCart(inc.dataset.inc, 1);
    if (dec) addToCart(dec.dataset.dec, -1);
  });
});
