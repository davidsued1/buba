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
    for (const k of ["config", "texts"]) if (over[k]) out[k] = { ...base[k], ...over[k] };
    for (const k of ["products", "shipping", "promos", "comingSoon"]) if (Array.isArray(over[k])) out[k] = over[k];
    if (over.images) out.images = { ...base.images, ...over.images };
    return out;
  }

  async function resolveStore() {
    let store = window.BUBA_DEFAULTS;
    try {
      const r = await fetch("data/store.json", { cache: "no-store" });
      if (r.ok) store = mergeStore(store, await r.json());
    } catch {}
    const local = lsJSON("buba-store");
    if (local) store = mergeStore(store, local);
    return store;
  }

  /* Ficha por producto (doc 07 módulo 1). Los productos nuevos que se creen
     desde el panel usan la ficha genérica. */
  const DETAILS = {
    blueberry: {
      tagline: "La Azul. Arándanos y lima, bien frío.",
      rows: [
        ["Sabor", "Blueberry Limeade — arándanos con limeade cítrica"],
        ["Base", "Vodka premium"],
        ["Graduación", "10% vol."],
        ["Contenido", "210 ml — lata esférica PET"],
        ["Cómo se toma", "Directo de la lata, bien fría. O sobre hielo."],
      ],
    },
    peach: {
      tagline: "La Naranja. Durazno dorado, dulce y fresco.",
      rows: [
        ["Sabor", "Golden Peach — durazno"],
        ["Base", "Vodka premium"],
        ["Graduación", "10% vol."],
        ["Contenido", "210 ml — lata esférica PET"],
        ["Cómo se toma", "Directo de la lata, bien fría. O sobre hielo."],
      ],
    },
    pack: {
      tagline: "Para la juntada: cuatro de cada sabor.",
      rows: [
        ["Incluye", "8 latas: 4 Blueberry Limeade + 4 Golden Peach"],
        ["Base", "Vodka premium"],
        ["Graduación", "10% vol. cada una"],
        ["Contenido", "210 ml por lata"],
        ["Ideal para", "Previas, cumpleaños, regalos que no fallan"],
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
      ? "Sin stock por ahora — volvé pronto."
      : (product.stock <= 10 ? `¡Últimas ${product.stock} unidades!` : "En stock, listo para enviarse.");
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
