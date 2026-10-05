/* ==========================================================================
   BUBA — Página de producto (producto.html?id=…)
   Comparte los datos de la tienda y el carrito (localStorage "buba-cart")
   con la home: agregar acá y comprar allá es el mismo pedido.
   ========================================================================== */

(function () {
  const $ = (id) => document.getElementById(id);
  const money = (n) => "$" + Math.round(n).toLocaleString("es-AR");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }
  function lsJSON(k) { try { return JSON.parse(lsGet(k)); } catch { return null; } }

  let STORE = window.BUBA_DEFAULTS;

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

  async function resolveStore() {
    let store = window.BUBA_DEFAULTS;
    try {
      const r = await fetch("data/store.json?t=" + Date.now(), { cache: "no-store" });
      if (r.ok) store = mergeStore(store, await r.json());
    } catch {}
    // Lo guardado en este navegador solo vale si tiene cambios sin publicar
    // (vista previa del panel) y es de la misma estructura. Si no, manda lo
    // publicado: así una copia vieja nunca pisa ni se vuelve a publicar.
    const local = lsJSON("buba-store");
    let pendiente = false;
    try { pendiente = localStorage.getItem("buba-dirty") === "1"; } catch {}
    if (local && pendiente && (local.version || 1) >= (store.version || 1)) store = mergeStore(store, local);
    return store;
  }

  /* Stock en vivo (igual que la home): si el servidor responde, pisa el de store.json. */
  async function aplicarStockVivo() {
    const api = String((STORE.config && STORE.config.apiBase) || "").replace(/\/$/, "");
    if (!api) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    try {
      const r = await fetch(api + "/api/stock", { signal: ctrl.signal, cache: "no-store" });
      const d = r.ok ? await r.json() : null;
      if (!d || d.ok !== true || !d.stock) return;
      (STORE.products || []).forEach((p) => {
        const n = d.stock[p.id];
        if (typeof n === "number" && Number.isFinite(n)) p.stock = Math.max(0, Math.floor(n));
      });
    } catch { /* sin respuesta: queda store.json */ }
    finally { clearTimeout(timer); }
  }

  /* Ficha por producto (doc 07 módulo 1). Los productos nuevos que se creen
     desde el panel usan la ficha genérica. */
  const DETAILS = {
    pack4: {
      tagline: "Prelanzamiento de edición limitada: los cuatro sabores, una lata de cada uno.",
      rows: [
        ["Incluye", "4 latas de 210 ml: Blueberry Limeade, Golden Peach, Pink Lemonade y Strawberry Ice"],
        ["Base", "Vodka premium"],
        ["Graduación", "10% vol. cada una"],
        ["Edición", "Prelanzamiento, unidades limitadas"],
        ["Envío", "CABA y GBA. Lo cotizás en el carrito."],
      ],
    },
  };
  const GENERIC_DETAIL = {
    tagline: "",
    rows: [
      ["Base", "Vodka premium"],
      ["Graduación", "10% vol."],
      ["Contenido", "210 ml — lata esférica PET"],
    ],
  };

  const cartCount = () => {
    const cart = lsJSON("buba-cart") || {};
    return Object.values(cart).reduce((s, q) => s + (q > 0 ? q : 0), 0);
  };
  const refreshCartCount = () => { if ($("cart-count")) $("cart-count").textContent = cartCount(); };

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
    const m = String(c.whatsapp || "").match(/^549(\d{2})(\d{4})(\d{4})$/);
    if ($("footer-wa")) $("footer-wa").textContent = m ? `+54 9 ${m[1]} ${m[2]}-${m[3]}` : "";
    if ($("footer-email")) $("footer-email").textContent = c.emailGeneral;
    if ($("footer-ig")) $("footer-ig").textContent = "@" + (c.instagram || "").replace(/^@/, "");
  }

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
        "<h2>Volvé en unos años</h2>" +
        '<p class="agegate__sub">Este sitio es solo para mayores de 18 años.</p>';
    });
  }

  function render(product) {
    document.title = `BUBA — ${product.name}`;
    const detail = DETAILS[product.id] || GENERIC_DETAIL;
    const out = (product.stock ?? 0) <= 0;

    $("pdp-media").innerHTML = product.img
      ? `<img src="${esc(product.img)}" alt="${esc(product.name)}">`
      : `<div class="photo photo--tall" data-flavor="${esc(product.id)}"><span class="photo__label">${esc(product.name).toUpperCase()}</span></div>`;
    $("pdp-name").textContent = product.name;
    $("pdp-desc").textContent = detail.tagline || product.desc || "";
    $("pdp-price").textContent = money(product.price);
    $("pdp-stock").textContent = out
      ? "Sin stock por ahora."
      : (product.stock <= 10 ? `Últimas ${product.stock}.` : "Hay stock.");
    $("pdp-stock").classList.toggle("is-out", out);
    if (out) $("pdp-buy").hidden = true;

    $("pdp-details").innerHTML = detail.rows.map(([k, v]) =>
      `<div class="pdp__detail-row"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("");

    // cantidad + agregar (respetando stock, igual que la home)
    let qty = 1;
    const maxQty = () => {
      const inCart = (lsJSON("buba-cart") || {})[product.id] || 0;
      return Math.max(0, (product.stock ?? 0) - inCart);
    };
    const syncQty = () => { $("qty-val").textContent = qty; };
    $("qty-dec").addEventListener("click", () => { qty = Math.max(1, qty - 1); syncQty(); });
    $("qty-inc").addEventListener("click", () => { qty = Math.min(Math.max(1, maxQty()), qty + 1); syncQty(); });
    $("pdp-add").addEventListener("click", () => {
      const room = maxQty();
      if (room <= 0) { alert(`Ya tenés todo el stock disponible de ${product.name} en el carrito.`); return; }
      const add = Math.min(qty, room);
      const cart = lsJSON("buba-cart") || {};
      cart[product.id] = (cart[product.id] || 0) + add;
      lsSet("buba-cart", JSON.stringify(cart));
      refreshCartCount();
      $("pdp-added").hidden = false;
      qty = 1; syncQty();
    });
  }

  function renderRelated(current) {
    const others = STORE.products.filter((p) => p.active !== false && p.id !== (current && current.id));
    const grid = $("pdp-related");
    if (!others.length) { $("pdp-related-section").hidden = true; return; }
    grid.innerHTML = others.map((p) => `
      <article class="product">
        <a class="product__link" href="producto.html?id=${encodeURIComponent(p.id)}">
          ${p.img
            ? `<div class="product__media"><img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy"></div>`
            : `<div class="photo" data-flavor="${esc(p.id)}"><span class="photo__label">${esc(p.name).toUpperCase()}</span></div>`}
          <div class="product__body">
            <h3 class="product__name">${esc(p.name)}</h3>
            <p class="product__desc">${esc(p.desc)}</p>
            <div class="product__row"><span class="product__price">${money(p.price)}</span></div>
          </div>
        </a>
      </article>`).join("");
  }

  window.addEventListener("storage", (e) => {
    if (e.key === "buba-cart") refreshCartCount();
  });

  document.addEventListener("DOMContentLoaded", async () => {
    STORE = await resolveStore();
    await aplicarStockVivo();
    // si la web está cerrada al público, mandamos a la portada (ahí está la pantalla de espera)
    const codigo = String(STORE.config.codigoAcceso || "");
    if (STORE.config.privado && lsGet("buba-acceso") !== codigo) {
      location.replace("index.html");
      return;
    }
    setupAgeGate();
    applyTexts();
    refreshCartCount();

    const id = new URLSearchParams(location.search).get("id");
    const product = STORE.products.find((p) => p.id === id && p.active !== false);
    if (!product) {
      $("pdp-layout").hidden = true;
      $("pdp-notfound").hidden = false;
      document.title = "BUBA — Producto no encontrado";
    } else {
      render(product);
    }
    renderRelated(product);

    if ($("hamburger")) $("hamburger").addEventListener("click", () => {
      const open = $("nav").classList.toggle("is-open");
      $("hamburger").setAttribute("aria-expanded", String(open));
    });
  });
})();
