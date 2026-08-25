/* ==========================================================================
   BUBA — SEO en runtime
   - Canonical, Open Graph / Twitter Card y JSON-LD (Organization +
     ItemList en la home, Product individual si la URL trae ?id=).
   - Script clásico (sin módulos): expone window.BUBA_SEO.inject(store).
   - Idempotente: los tags propios se marcan con data-buba-seo y se
     actualizan en vez de duplicarse. Nunca rompe: todo va en try/catch.
   ========================================================================== */
(function () {
  "use strict";

  const LOGO = "assets/img/logo-full.png";

  /* ---------- Utilidades ---------- */

  // resuelve una ruta relativa (ej. "assets/img/peach.webp") a URL absoluta
  function absUrl(path) {
    try { return new URL(path, document.baseURI).href; } catch { return path; }
  }

  // URL actual sin querystring, salvo el parámetro id (y sin hash)
  function canonicalUrl() {
    const u = new URL(window.location.href);
    const id = u.searchParams.get("id");
    u.search = id ? "?id=" + encodeURIComponent(id) : "";
    u.hash = "";
    return u.href;
  }

  // URL base del sitio (la home), derivada de la página actual
  function siteUrl() {
    return new URL(".", window.location.href).href;
  }

  // crea (o reutiliza) un tag propio en <head>, identificado por data-buba-seo
  function ensureTag(tagName, key) {
    let el = document.head.querySelector(tagName + '[data-buba-seo="' + key + '"]');
    if (!el) {
      el = document.createElement(tagName);
      el.setAttribute("data-buba-seo", key);
      document.head.appendChild(el);
    }
    return el;
  }

  function setMeta(key, property, content) {
    const el = ensureTag("meta", key);
    el.setAttribute(property.startsWith("og:") ? "property" : "name", property);
    el.setAttribute("content", content);
  }

  /* ---------- Canonical ---------- */
  function injectCanonical() {
    const link = ensureTag("link", "canonical");
    link.setAttribute("rel", "canonical");
    link.setAttribute("href", canonicalUrl());
  }

  /* ---------- Open Graph + Twitter ---------- */
  function injectOpenGraph(store, product) {
    const texts = store.texts || {};
    const title = product
      ? product.name + " — BUBA Drinks"
      : "BUBA Drinks — " + (texts.heroEyebrow || "Ready cocktails");
    const desc = (product ? product.desc : texts.heroSub) ||
      "Cocktails con vodka premium, listos para tomar, en lata esférica. Venta solo a mayores de 18.";
    // imagen: la del producto, o la primera del catálogo, o el logo
    const first = (store.products || []).find((p) => p.img);
    const img = (product && product.img) || (first && first.img) || LOGO;

    setMeta("og-title", "og:title", title);
    setMeta("og-description", "og:description", desc);
    setMeta("og-type", "og:type", product ? "product" : "website");
    setMeta("og-url", "og:url", canonicalUrl());
    setMeta("og-image", "og:image", absUrl(img));
    setMeta("tw-card", "twitter:card", "summary_large_image");
  }

  /* ---------- JSON-LD ---------- */
  function productLD(p) {
    return {
      "@type": "Product",
      "name": p.name,
      "description": p.desc,
      "image": p.img ? absUrl(p.img) : absUrl(LOGO),
      "url": siteUrl() + "producto.html?id=" + encodeURIComponent(p.id),
      "offers": {
        "@type": "Offer",
        "price": p.price,
        "priceCurrency": "ARS",
        "availability": (p.stock ?? 0) > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      },
    };
  }

  function injectJsonLd(store, product) {
    const ig = String(store.config?.instagram || "").replace(/^@/, "");
    const graph = [{
      "@type": "Organization",
      "name": "BUBA Drinks",
      "url": siteUrl(),
      "logo": absUrl(LOGO),
      "sameAs": ig ? ["https://instagram.com/" + ig] : [],
    }];

    if (product) {
      // página de producto: el Product individual
      graph.push(productLD(product));
    } else {
      // home: el catálogo completo como ItemList
      graph.push({
        "@type": "ItemList",
        "itemListElement": (store.products || [])
          .filter((p) => p.active !== false)
          .map((p, i) => ({ "@type": "ListItem", "position": i + 1, "item": productLD(p) })),
      });
    }

    const script = ensureTag("script", "jsonld");
    script.setAttribute("type", "application/ld+json");
    script.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
  }

  /* ---------- API pública ---------- */
  window.BUBA_SEO = {
    inject(store) {
      if (!store) return;
      // si la URL trae ?id=, apuntamos todo a ese producto
      let product = null;
      try {
        const id = new URL(window.location.href).searchParams.get("id");
        product = id ? (store.products || []).find((p) => p.id === id) : null;
      } catch { /* sin producto: seguimos como home */ }

      try { injectCanonical(); } catch { /* nunca rompemos la página */ }
      try { injectOpenGraph(store, product); } catch { /* idem */ }
      try { injectJsonLd(store, product); } catch { /* idem */ }
    },
  };
})();
