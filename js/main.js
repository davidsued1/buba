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
  // Si lo guardado es de una estructura anterior, las listas (productos,
  // envíos, sabores) se descartan: manda la estructura nueva. Los textos y
  // la configuración se conservan siempre.
  const vieja = (over.version || 1) < (base.version || 1);
  if (!vieja) {
    for (const k of ["products", "flavors", "shipping", "promos", "comingSoon"]) {
      if (Array.isArray(over[k])) out[k] = over[k];
    }
  }
  if (over.images) out.images = { ...base.images, ...over.images };
  out.version = Math.max(base.version || 1, over.version || 1);
  return out;
}

/* ---------- Imágenes de secciones (cargadas desde el panel) ---------- */
function applyImages() {
  const imgs = STORE.images || {};
  [["about", "about-media", "Nosotros BUBA"], ["wholesale", "wholesale-media", "Mayoristas BUBA"]].forEach(([key, id, alt]) => {
    const box = $(id);
    if (!box || !imgs[key]) return;
    box.innerHTML = `<img class="section-img" src="${esc(imgs[key])}" alt="${alt}">`;
  });
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
   VISOR 360 — el cuerpo queda fijo, giran la TAPA y lo IMPRESO
   - El vidrio y el líquido (transparentes) no cambian al girar: quedan
     fijos, con el color y los brillos intactos.
   - La tapa metálica rota en su plano: la anilla da vueltas de verdad.
   - El texto impreso (capa aparte, assets/img/*-label.webp) gira derecho
     alrededor, proyectado en cilindro: todo el bloque se mueve junto, se
     esconde por el borde (atrás no dice nada) y reaparece. Una vuelta
     completa vuelve exactamente a la posición inicial.
   ========================================================================== */
const CANS = {
  blueberry: {
    base: "assets/img/blueberry-base.webp",
    label: "assets/img/blueberry-label.webp",
    sphere: { cx: 0.499, cy: 0.490, r: 0.497 },
    // cara superior de la tapa (los aros y la anilla); el borde con
    // perspectiva queda fijo y se funde suave en el límite
    lid: { ex: 0.503, ey: 0.098, rx: 0.370, ry: 0.092 },
  },
  peach: {
    base: "assets/img/peach-base.webp",
    label: "assets/img/peach-label.webp",
    sphere: { cx: 0.499, cy: 0.509, r: 0.494 },
    lid: { ex: 0.500, ey: 0.095, rx: 0.360, ry: 0.088 },
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
      // render a resolución de pantalla (retina incluido) para máxima nitidez
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const H = Math.min(880, Math.max(420, Math.round((stage.clientHeight || 460) * dpr)));
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

      const baseData = baseCv.getContext("2d").getImageData(0, 0, W, H);

      const cx = cfg.sphere.cx * W, cy = cfg.sphere.cy * H, r = cfg.sphere.r * W;
      const ex = cfg.lid.ex * W, ey = cfg.lid.ey * H, rx = cfg.lid.rx * W, ry = cfg.lid.ry * H;

      // LUT del cuerpo (proyección cilíndrica: el texto gira derecho, todo
      // el bloque junto) — solo píxeles dentro de la esfera y fuera de la tapa
      const idx = [], sinL = [], cosL = [];
      // LUT de la tapa: rotación con fundido hacia el borde (el borde con
      // perspectiva no se toca, así nada queda torcido)
      const lIdx = [], lUx = [], lUy = [], lW = [];

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const eu = (x - ex) / rx, ev = (y - ey) / ry;
          const rho2 = eu * eu + ev * ev;
          if (rho2 <= 1) {
            const rhoL = Math.sqrt(rho2);
            lIdx.push(y * W + x);
            lUx.push(eu);
            lUy.push(ev);
            lW.push(Math.min(1, Math.max(0, (1 - rhoL) / 0.24))); // 1 al centro, 0 en el borde
            continue;
          }
          const nx = (x - cx) / r, ny = (y - cy) / r;
          if (nx * nx + ny * ny > 0.998) continue;
          const lon = Math.asin(Math.max(-1, Math.min(1, nx)));
          idx.push(y * W + x);
          sinL.push(Math.sin(lon));
          cosL.push(Math.cos(lon));
        }
      }

      cache[key] = {
        baseCv, baseData, label, overlayCv, W, H, cx, cy, r, ex, ey, rx, ry,
        idx: Int32Array.from(idx),
        sinL: Float32Array.from(sinL),
        cosL: Float32Array.from(cosL),
        lIdx: Int32Array.from(lIdx),
        lUx: Float32Array.from(lUx),
        lUy: Float32Array.from(lUy),
        lW: Float32Array.from(lW),
      };
      cb(cache[key]);
    });
  }

  function render() {
    if (!active) return;
    const { baseCv, baseData, label, overlayCv, W, H, cx, cy, r, ex, ey, rx, ry,
            idx, sinL, cosL, lIdx, lUx, lUy, lW } = active;
    canvas.width = W; canvas.height = H;

    const cosT = Math.cos(theta), sinT = Math.sin(theta);

    // --- 1. base + tapa girando ---
    const out = ctx.createImageData(W, H);
    out.data.set(baseData.data);
    const sb = baseData.data, ob = out.data;
    for (let i = 0; i < lIdx.length; i++) {
      const w = lW[i];
      if (w <= 0) continue;
      // rotar la cara de la tapa (la anilla da vueltas, en el mismo
      // sentido en que viaja el texto por el frente)
      const ux = lUx[i], uy = lUy[i];
      const su = ux * cosT - uy * sinT;
      const sv = uy * cosT + ux * sinT;
      const sx = ex + su * rx, sy = ey + sv * ry;
      const x0 = Math.max(0, Math.min(W - 1, Math.floor(sx)));
      const y0 = Math.max(0, Math.min(H - 1, Math.floor(sy)));
      const x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1);
      const fx = Math.min(1, Math.max(0, sx - x0)), fy = Math.min(1, Math.max(0, sy - y0));
      const a00 = (y0 * W + x0) * 4, a10 = (y0 * W + x1) * 4;
      const a01 = (y1 * W + x0) * 4, a11 = (y1 * W + x1) * 4;
      const q = lIdx[i] * 4;
      for (let ch = 0; ch < 4; ch++) {
        const top = sb[a00 + ch] + (sb[a10 + ch] - sb[a00 + ch]) * fx;
        const bot = sb[a01 + ch] + (sb[a11 + ch] - sb[a01 + ch]) * fx;
        const rot = top + (bot - top) * fy;
        // fundido hacia el borde: centro gira, borde queda quieto
        ob[q + ch] = rot * w + sb[q + ch] * (1 - w);
      }
    }

    // --- 2. texto girando derecho (cilindro) ---
    const s = label.data;
    const octx = overlayCv.getContext("2d");
    const lay = octx.createImageData(W, H);
    const o = lay.data;
    for (let i = 0; i < idx.length; i++) {
      const sinL0 = sinL[i] * cosT - cosL[i] * sinT;
      const cosL0 = cosL[i] * cosT + sinL[i] * sinT;
      if (cosL0 <= 0.02) continue; // atrás: la lata no dice nada

      const p = idx[i], row = (p / W) | 0;
      const sx = cx + r * sinL0;
      const x0 = Math.max(0, Math.min(W - 1, Math.floor(sx)));
      const x1 = Math.min(W - 1, x0 + 1);
      const fx = Math.min(1, Math.max(0, sx - x0));
      const a0 = (row * W + x0) * 4, a1 = (row * W + x1) * 4;

      const aC = s[a0 + 3] + (s[a1 + 3] - s[a0 + 3]) * fx;
      if (aC < 2) continue; // sin texto acá: la base queda intacta

      const fade = Math.min(1, cosL0 / 0.12); // se desvanece justo en el borde
      const q = p * 4;
      o[q] = s[a0] + (s[a1] - s[a0]) * fx;
      o[q + 1] = s[a0 + 1] + (s[a1 + 1] - s[a0 + 1]) * fx;
      o[q + 2] = s[a0 + 2] + (s[a1 + 2] - s[a0 + 2]) * fx;
      o[q + 3] = aC * fade;
    }

    octx.putImageData(lay, 0, 0);
    ctx.putImageData(out, 0, 0);      // lata quieta + tapa girando
    ctx.drawImage(overlayCv, 0, 0);   // el texto, girando derecho alrededor

    // --- 3. luces que acompañan el giro (para que se sienta la vuelta) ---
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.99, 0, Math.PI * 2);
    ctx.clip();

    // brillo vertical que barre la esfera al girar
    const hx = cx + r * 0.9 * Math.sin(-theta + 1.15);
    const sheen = ctx.createLinearGradient(hx - r * 0.4, 0, hx + r * 0.4, 0);
    sheen.addColorStop(0, "rgba(255,255,255,0)");
    sheen.addColorStop(0.5, "rgba(255,255,255,0.11)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // al mostrar la parte de atrás, la lata queda apenas en sombra
    const backShade = 0.12 * (1 - Math.cos(theta)) / 2;
    if (backShade > 0.004) {
      ctx.fillStyle = `rgba(10,10,12,${backShade.toFixed(3)})`;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    ctx.restore();
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
    window.__bubaTheta = theta; // para diagnóstico
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
    // inercia acotada: un tirón fuerte no dispara vueltas de más
    vel = Math.max(-0.06, Math.min(0.06, (dTheta / dt) * 16));
    lastX = e.clientX;
    lastT = performance.now();
  });
  const endDrag = () => {
    dragging = false;
    // si el usuario frenó antes de soltar, no hay inercia
    if (performance.now() - lastT > 120) vel = 0;
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
    <article class="flavor reveal is-visible">
      ${f.img
        ? `<div class="flavor__media"><img src="${esc(f.img)}" alt="${esc(f.name)}" loading="lazy"></div>`
        : `<div class="flavor__media flavor__media--color" style="background:${flavorColor(f)}"><span>${esc(f.name.split(" ")[0])}</span></div>`}
      <h3 class="flavor__name">${esc(f.name)}</h3>
      <p class="flavor__desc">${esc(f.desc || "")}</p>
    </article>`).join("");
}

// texto de disponibilidad del pack según el stock real
function stockLabel(p) {
  const st = p.stock ?? 0;
  if (st <= 0) return { cls: "is-out", txt: "Agotado por ahora" };
  if (st <= 10) return { cls: "is-low", txt: `¡Quedan ${st}!` };
  return { cls: "is-ok", txt: "En stock" };
}

function renderProducts() {
  const grid = $("products");
  if (!grid) return;
  renderFlavors();
  const items = activeProducts();
  if (!items.length) {
    grid.innerHTML = '<p class="pack-empty">Muy pronto abrimos la venta.</p>';
    return;
  }
  grid.innerHTML = items.map((p) => {
    const out = (p.stock ?? 0) <= 0;
    const st = stockLabel(p);
    const href = "producto.html?id=" + encodeURIComponent(p.id);
    return `
    <article class="pack reveal is-visible">
      <a class="pack__media" href="${href}">
        ${p.img
          ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy">`
          : `<div class="photo photo--tall" data-flavor="pack"><span class="photo__label">FOTO DEL PACK</span></div>`}
      </a>
      <div class="pack__body">
        <span class="pack__stock ${st.cls}">${st.txt}</span>
        <h3 class="pack__name">${esc(p.name)}</h3>
        <p class="pack__desc">${esc(p.desc)}</p>
        <p class="pack__price">${money(p.price)}</p>
        ${out
          ? `<a href="#" class="btn btn--outline btn--block" id="pack-waitlist">Avisame cuando vuelva</a>`
          : `<button class="btn btn--solid btn--block" data-add="${esc(p.id)}">Agregar al carrito</button>`}
        <a class="pack__more" href="${href}">Ver el detalle →</a>
      </div>
    </article>`;
  }).join("");

  const wl = $("pack-waitlist");
  if (wl) wl.addEventListener("click", (e) => {
    e.preventDefault();
    const url = waLink("¡Hola BUBA! Quiero que me avisen cuando vuelva el pack.");
    if (url) window.open(url, "_blank");
    else document.getElementById("contacto")?.scrollIntoView({ behavior: "smooth" });
  });
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
    if (cp.length < 4) { out.className = "cart-quote__result"; out.textContent = "Escribí los 4 números del código postal."; return; }
    const d = deliveryFor(cp);
    lsSet("buba-cp", cp);
    if (d) {
      const price = shipPrice(d);
      out.className = "cart-quote__result is-ok";
      out.innerHTML = `${esc(d.name)}: <strong>${price === 0 ? "GRATIS" : money(price)}</strong> · ${esc(d.eta)}`;
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
function checkPaymentReturn() {
  const q = new URLSearchParams(location.search);
  const estado = q.get("pago");
  if (!estado) return;
  const pedido = q.get("pedido") || "";
  const textos = {
    ok: ["¡Listo, pago confirmado! 🎉", "Ya estamos preparando tu pedido. Te escribimos por WhatsApp para coordinar la entrega."],
    pendiente: ["Tu pago está en proceso", "Cuando Mercado Pago lo confirme te avisamos. Si pagaste en efectivo, puede tardar unas horas."],
    error: ["El pago no se pudo completar", "No se te cobró nada. Podés intentar de nuevo o escribirnos por WhatsApp para coordinar."],
  }[estado];
  if (!textos) return;

  // marcar el pedido como pagado en el historial local
  if (estado === "ok" && pedido) {
    const orders = lsJSON("buba-orders") || [];
    const o = orders.find((x) => x.code === pedido);
    if (o) { o.status = "pagado"; lsSet("buba-orders", JSON.stringify(orders)); }
  }

  history.replaceState(null, "", location.pathname);
  $("done-msg").textContent = textos[1];
  $("done-code").textContent = pedido ? "Nº de pedido: " + pedido : "";
  $("step-done").querySelector("h3").textContent = textos[0];
  $("checkout").hidden = false;
  $("checkout-overlay").hidden = false;
  document.body.style.overflow = "hidden";
  gotoStep(4);
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
  setupViewer();
  setupWhatsAppLinks();
  setupMobileMenu();
  setupNewsletter();
  setupReveal();
  setupCheckout();
  setupCartQuote();

  $("cart-open").addEventListener("click", openCart);
  $("cart-close").addEventListener("click", closeCart);
  // volviendo de una página de producto con ?cart=1, abrimos el carrito
  checkPaymentReturn();
  if (new URLSearchParams(location.search).has("cart")) {
    history.replaceState(null, "", location.pathname + location.hash);
    if (cartEntries().length) openCart();
  }
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
