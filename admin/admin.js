/* ==========================================================================
   Panel BUBA — administración de la tienda
   Los datos viven en un único objeto STORE (misma estructura que
   js/store-defaults.js). Guardar = localStorage (la web pública del mismo
   navegador lo refleja al instante). Publicar online = commit de
   data/store.json al repo vía API de GitHub → la web se actualiza para todos.
   ========================================================================== */

const $ = (id) => document.getElementById(id);
const money = (n) => "$" + Math.round(n).toLocaleString("es-AR");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function lsJSON(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function lsSet(key, v) { try { localStorage.setItem(key, typeof v === "string" ? v : JSON.stringify(v)); } catch {} }

/* ---------- Estado ---------- */
let STORE = null;
let ORDERS = lsJSON("buba-orders") || [];
let currentView = "dashboard";

function mergeStore(base, over) {
  const out = { ...base };
  for (const k of ["config", "texts"]) if (over[k]) out[k] = { ...base[k], ...over[k] };
  for (const k of ["products", "shipping", "promos", "comingSoon"]) if (Array.isArray(over[k])) out[k] = over[k];
  if (over.images) out.images = { ...base.images, ...over.images };
  return out;
}

async function resolveStore() {
  let store = JSON.parse(JSON.stringify(window.BUBA_DEFAULTS));
  try {
    const r = await fetch("../data/store.json", { cache: "no-store" });
    if (r.ok) store = mergeStore(store, await r.json());
  } catch {}
  const local = lsJSON("buba-store");
  if (local) store = mergeStore(store, local);
  return store;
}

function saveLocal(silent) {
  lsSet("buba-store", STORE);
  if (!silent) flashSave("Guardado ✓ (visible en la web de este navegador)");
}
function saveOrders() { lsSet("buba-orders", ORDERS); }

let saveTimer = null;
function flashSave(msg, isErr) {
  const el = $("save-state");
  el.textContent = msg;
  el.className = "save-state" + (isErr ? "" : " ok");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => (el.textContent = ""), 4000);
}

/* ==========================================================================
   LOGIN
   ========================================================================== */
function setupLogin() {
  if (sessionStorage.getItem("buba-admin-ok") === "1") {
    $("login").hidden = true;
    $("app").hidden = false;
    return;
  }
  $("login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if ($("login-pin").value === STORE.config.adminPin) {
      sessionStorage.setItem("buba-admin-ok", "1");
      $("login").hidden = true;
      $("app").hidden = false;
      renderView();
    } else {
      $("login-err").hidden = false;
    }
  });
}

/* ==========================================================================
   NAVEGACIÓN
   ========================================================================== */
const VIEWS = {
  dashboard: { title: "Dashboard", render: renderDashboard },
  orders: { title: "Pedidos", render: renderOrders },
  products: { title: "Productos", render: renderProducts },
  clients: { title: "Clientes", render: renderClients },
  shipping: { title: "Envíos", render: renderShipping },
  promos: { title: "Promociones", render: renderPromos },
  texts: { title: "Textos de la web", render: renderTexts },
  images: { title: "Imágenes de la web", render: renderImages },
  settings: { title: "Configuración", render: renderSettings },
};

function renderView() {
  const v = VIEWS[currentView];
  $("view-title").textContent = v.title;
  $("view").innerHTML = "";
  v.render($("view"));
  $("badge-orders").textContent = ORDERS.filter((o) => o.status === "pendiente").length || "";
}

/* ==========================================================================
   DASHBOARD
   ========================================================================== */
function renderDashboard(box) {
  const valid = ORDERS.filter((o) => o.status !== "cancelado");
  const ventas = valid.reduce((s, o) => s + (o.total || 0), 0);
  const pendientes = ORDERS.filter((o) => o.status === "pendiente").length;
  const lowStock = STORE.products.filter((p) => p.active !== false && (p.stock ?? 0) <= 10);

  box.innerHTML = `
    <div class="cards">
      <div class="stat"><div class="stat__label">Ventas registradas</div><div class="stat__value">${money(ventas)}</div><div class="stat__hint">${valid.length} pedidos</div></div>
      <div class="stat"><div class="stat__label">Pedidos pendientes</div><div class="stat__value">${pendientes}</div><div class="stat__hint">por gestionar</div></div>
      <div class="stat"><div class="stat__label">Productos activos</div><div class="stat__value">${STORE.products.filter((p) => p.active !== false).length}</div><div class="stat__hint">en la tienda</div></div>
      <div class="stat"><div class="stat__label">Stock bajo</div><div class="stat__value">${lowStock.length}</div><div class="stat__hint">≤ 10 unidades</div></div>
    </div>
    <div class="panel">
      <h3>Últimos pedidos</h3>
      ${ORDERS.length ? ordersTable(ORDERS.slice(0, 5), false) : '<p class="empty">Todavía no hay pedidos. Cuando alguien compre en la web, aparecen acá.</p>'}
    </div>
    ${lowStock.length ? `
    <div class="panel">
      <h3>⚠️ Reponer stock</h3>
      <div class="table-scroll"><table>
        <tr><th>Producto</th><th class="num">Stock</th></tr>
        ${lowStock.map((p) => `<tr><td>${esc(p.name)}</td><td class="num"><span class="pill pill--low">${p.stock}</span></td></tr>`).join("")}
      </table></div>
    </div>` : ""}
    <div class="note">Los pedidos de este panel se registran en este navegador (modo local). Cuando conectemos el backend de pagos, los pedidos de todos los clientes van a llegar acá automáticamente.</div>
  `;
}

/* ==========================================================================
   PEDIDOS
   ========================================================================== */
const STATUSES = ["pendiente", "pagado", "preparando", "enviado", "entregado", "cancelado"];

function ordersTable(list, withActions = true) {
  return `<div class="table-scroll"><table>
    <tr><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Envío</th><th class="num">Total</th><th>Estado</th>${withActions ? "<th></th>" : ""}</tr>
    ${list.map((o) => `
      <tr>
        <td><strong>${esc(o.code)}</strong><br><span class="hint">${esc(o.payMethod || "")}</span></td>
        <td>${new Date(o.createdAt).toLocaleDateString("es-AR")}<br><span class="hint">${new Date(o.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span></td>
        <td>${esc(o.customer?.name)}<br><span class="hint">${esc(o.customer?.address?.city || "")}, ${esc(o.customer?.address?.province || "")}</span></td>
        <td>${esc(o.shipping?.name || "-")}</td>
        <td class="num"><strong>${money(o.total)}</strong></td>
        <td>
          ${withActions
            ? `<select class="inline" data-status="${esc(o.code)}">${STATUSES.map((s) => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select>`
            : `<span class="pill pill--${esc(o.status)}">${esc(o.status)}</span>`}
        </td>
        ${withActions ? `<td class="row-actions">
          <button class="btn btn--outline" data-view-order="${esc(o.code)}">Ver</button>
          <button class="btn btn--danger" data-del-order="${esc(o.code)}">Borrar</button>
        </td>` : ""}
      </tr>`).join("")}
  </table></div>`;
}

function renderOrders(box) {
  box.innerHTML = `<div class="panel">
    ${ORDERS.length ? ordersTable(ORDERS) : '<p class="empty">Todavía no hay pedidos.</p>'}
  </div>`;

  box.querySelectorAll("[data-status]").forEach((sel) =>
    sel.addEventListener("change", () => {
      const o = ORDERS.find((x) => x.code === sel.dataset.status);
      if (o) { o.status = sel.value; saveOrders(); renderView(); }
    }));
  box.querySelectorAll("[data-view-order]").forEach((b) =>
    b.addEventListener("click", () => showOrder(b.dataset.viewOrder)));
  box.querySelectorAll("[data-del-order]").forEach((b) =>
    b.addEventListener("click", () => {
      if (!confirm("¿Borrar el pedido " + b.dataset.delOrder + "?")) return;
      ORDERS = ORDERS.filter((x) => x.code !== b.dataset.delOrder);
      saveOrders();
      renderView();
    }));
}

function showOrder(code) {
  const o = ORDERS.find((x) => x.code === code);
  if (!o) return;
  const a = o.customer.address || {};
  openModal("Pedido " + o.code, `
    <div class="order-detail">
      <h4>Cliente</h4>
      <p><strong>${esc(o.customer.name)}</strong> · ${esc(o.customer.phone)} · ${esc(o.customer.email)}</p>
      <h4>Entrega</h4>
      <p>${esc(a.street)} ${esc(a.apt || "")}, ${esc(a.city)}, ${esc(a.province)} (CP ${esc(a.cp)})</p>
      ${a.geo ? `<p class="hint">📍 Ubicación GPS: ${a.geo.lat}, ${a.geo.lng} — <a href="https://www.google.com/maps?q=${a.geo.lat},${a.geo.lng}" target="_blank" rel="noopener">ver en Maps</a></p>` : ""}
      ${a.notes ? `<p class="hint">Notas: ${esc(a.notes)}</p>` : ""}
      <p>Método: <strong>${esc(o.shipping?.name)}</strong> (${esc(o.shipping?.eta || "")}) — ${o.shipping?.price === 0 ? "GRATIS" : money(o.shipping?.price || 0)}</p>
      <h4>Productos</h4>
      ${o.items.map((it) => `<p>${it.qty} × ${esc(it.name)} — ${money(it.price * it.qty)}</p>`).join("")}
      ${o.promo ? `<p>Descuento ${esc(o.promo.code)}: −${money(o.promo.discount)}</p>` : ""}
      <h4>Total</h4>
      <p><strong>${money(o.total)}</strong> · pago vía ${esc(o.payMethod)} · estado: <span class="pill pill--${esc(o.status)}">${esc(o.status)}</span></p>
    </div>`);
}

/* ==========================================================================
   PRODUCTOS
   ========================================================================== */
function renderProducts(box) {
  box.innerHTML = `
    <div class="panel">
      <div class="panel__head">
        <h3>Catálogo</h3>
        <button class="btn btn--solid btn--sm" id="add-product">+ Agregar producto</button>
      </div>
      <div class="table-scroll"><table>
        <tr><th></th><th>Producto</th><th class="num">Precio</th><th class="num">Stock</th><th>Estado</th><th></th></tr>
        ${STORE.products.map((p, i) => `
          <tr>
            <td>${p.img ? `<img class="thumb" src="${absImg(p.img)}" alt="">` : '<span class="thumb thumb--empty">?</span>'}</td>
            <td><strong>${esc(p.name)}</strong><br><span class="hint">${esc(p.desc)}</span></td>
            <td class="num"><input class="inline inline--num" type="number" value="${p.price}" data-price="${i}"></td>
            <td class="num"><input class="inline inline--num" type="number" value="${p.stock ?? 0}" data-stock="${i}"></td>
            <td>${p.active !== false ? '<span class="pill pill--pagado">activo</span>' : '<span class="pill pill--off">oculto</span>'}</td>
            <td class="row-actions">
              <button class="btn btn--outline" data-edit="${i}">Editar</button>
              <button class="btn btn--outline" data-toggle="${i}">${p.active !== false ? "Ocultar" : "Mostrar"}</button>
              <button class="btn btn--danger" data-del="${i}">Borrar</button>
            </td>
          </tr>`).join("")}
      </table></div>
    </div>
    <div class="panel">
      <h3>Tarjetas "Próximamente"</h3>
      <p class="hint" style="margin-bottom:10px">Una por línea. Se muestran al final de la tienda.</p>
      <label class="label-block"><textarea id="coming-soon" rows="2">${esc((STORE.comingSoon || []).join("\n"))}</textarea></label>
      <button class="btn btn--solid btn--sm" id="save-coming">Guardar</button>
    </div>`;

  box.querySelectorAll("[data-price]").forEach((inp) =>
    inp.addEventListener("change", () => {
      STORE.products[inp.dataset.price].price = Number(inp.value) || 0;
      saveLocal();
    }));
  box.querySelectorAll("[data-stock]").forEach((inp) =>
    inp.addEventListener("change", () => {
      STORE.products[inp.dataset.stock].stock = Math.max(0, Number(inp.value) || 0);
      saveLocal();
    }));
  box.querySelectorAll("[data-toggle]").forEach((b) =>
    b.addEventListener("click", () => {
      const p = STORE.products[b.dataset.toggle];
      p.active = p.active === false;
      saveLocal();
      renderView();
    }));
  box.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => {
      const p = STORE.products[b.dataset.del];
      if (!confirm(`¿Borrar "${p.name}" del catálogo?`)) return;
      STORE.products.splice(Number(b.dataset.del), 1);
      saveLocal();
      renderView();
    }));
  box.querySelectorAll("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => editProduct(Number(b.dataset.edit))));
  $("add-product").addEventListener("click", () => editProduct(-1));
  $("save-coming").addEventListener("click", () => {
    STORE.comingSoon = $("coming-soon").value.split("\n").map((s) => s.trim()).filter(Boolean);
    saveLocal();
  });
}

function absImg(src) {
  return src.startsWith("data:") || src.startsWith("http") ? src : "../" + src;
}

function editProduct(index) {
  const isNew = index < 0;
  const p = isNew
    ? { id: "prod-" + Date.now().toString(36), name: "", desc: "", price: 0, stock: 0, active: true, img: "" }
    : STORE.products[index];

  openModal(isNew ? "Nuevo producto" : "Editar producto", `
    <div class="form-grid">
      <label class="span-2">Nombre<input id="p-name" value="${esc(p.name)}"></label>
      <label class="span-2">Descripción<input id="p-desc" value="${esc(p.desc)}"></label>
      <label>Precio ($)<input id="p-price" type="number" value="${p.price}"></label>
      <label>Stock<input id="p-stock" type="number" value="${p.stock ?? 0}"></label>
      <div class="span-2">
        <label class="img-drop" id="img-drop">
          ${p.img ? `<img id="p-img-preview" src="${absImg(p.img)}">` : '<img id="p-img-preview" style="display:none">'}
          <span>📷 Click para ${p.img ? "cambiar" : "cargar"} la foto del producto<br><span class="hint">Se sube al publicar online</span></span>
          <input type="file" id="p-img" accept="image/*" hidden>
        </label>
      </div>
      <label class="check-row span-2"><input type="checkbox" id="p-active" ${p.active !== false ? "checked" : ""}> Visible en la tienda</label>
    </div>
    <div class="form-foot">
      <button class="btn btn--outline btn--sm" id="p-cancel">Cancelar</button>
      <button class="btn btn--solid btn--sm" id="p-save">Guardar producto</button>
    </div>`);

  let imgData = p.img;
  $("img-drop").addEventListener("click", () => $("p-img").click());
  $("p-img").addEventListener("change", () => {
    const file = $("p-img").files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      imgData = reader.result;
      const prev = $("p-img-preview");
      prev.src = imgData;
      prev.style.display = "block";
    };
    reader.readAsDataURL(file);
  });
  $("p-cancel").addEventListener("click", closeModal);
  $("p-save").addEventListener("click", () => {
    p.name = $("p-name").value.trim();
    p.desc = $("p-desc").value.trim();
    p.price = Number($("p-price").value) || 0;
    p.stock = Math.max(0, Number($("p-stock").value) || 0);
    p.active = $("p-active").checked;
    p.img = imgData;
    if (!p.name) { alert("Poné un nombre."); return; }
    if (isNew) STORE.products.push(p);
    saveLocal();
    closeModal();
    renderView();
  });
}

/* ==========================================================================
   CLIENTES
   ========================================================================== */
function renderClients(box) {
  const map = new Map();
  ORDERS.forEach((o) => {
    const key = (o.customer?.email || o.customer?.phone || "").toLowerCase();
    if (!key) return;
    if (!map.has(key)) map.set(key, { ...o.customer, orders: 0, spent: 0, last: o.createdAt });
    const c = map.get(key);
    c.orders++;
    if (o.status !== "cancelado") c.spent += o.total || 0;
    if (o.createdAt > c.last) c.last = o.createdAt;
  });
  const clients = [...map.values()].sort((a, b) => b.spent - a.spent);

  box.innerHTML = `<div class="panel">
    ${clients.length ? `<div class="table-scroll"><table>
      <tr><th>Cliente</th><th>Contacto</th><th>Zona</th><th class="num">Pedidos</th><th class="num">Total gastado</th><th>Último pedido</th></tr>
      ${clients.map((c) => `
        <tr>
          <td><strong>${esc(c.name)}</strong></td>
          <td>${esc(c.phone)}<br><span class="hint">${esc(c.email)}</span></td>
          <td>${esc(c.address?.city || "")}, ${esc(c.address?.province || "")}</td>
          <td class="num">${c.orders}</td>
          <td class="num"><strong>${money(c.spent)}</strong></td>
          <td>${new Date(c.last).toLocaleDateString("es-AR")}</td>
        </tr>`).join("")}
    </table></div>` : '<p class="empty">Los clientes aparecen automáticamente cuando hacen su primer pedido.</p>'}
  </div>`;
}

/* ==========================================================================
   ENVÍOS
   ========================================================================== */
function renderShipping(box) {
  box.innerHTML = `
    <div class="panel">
      <div class="panel__head">
        <h3>Métodos de envío</h3>
        <button class="btn btn--solid btn--sm" id="add-ship">+ Agregar método</button>
      </div>
      <div class="table-scroll"><table>
        <tr><th>Método</th><th>Tiempo estimado</th><th class="num">Precio</th><th>Estado</th><th></th></tr>
        ${STORE.shipping.map((m, i) => `
          <tr>
            <td><input class="inline" value="${esc(m.name)}" data-sname="${i}"></td>
            <td><input class="inline" value="${esc(m.eta)}" data-seta="${i}"></td>
            <td class="num"><input class="inline inline--num" type="number" value="${m.price}" data-sprice="${i}"></td>
            <td>${m.active !== false ? '<span class="pill pill--pagado">activo</span>' : '<span class="pill pill--off">oculto</span>'}</td>
            <td class="row-actions">
              <button class="btn btn--outline" data-stoggle="${i}">${m.active !== false ? "Ocultar" : "Mostrar"}</button>
              <button class="btn btn--danger" data-sdel="${i}">Borrar</button>
            </td>
          </tr>`).join("")}
      </table></div>
      <div class="note">Estos métodos son los que ve el cliente en el checkout. Cuando integremos las APIs de Correo Argentino / Andreani, el precio se va a poder calcular automático por código postal; hoy es una tarifa fija por método.</div>
    </div>
    <div class="panel">
      <h3>Envío gratis</h3>
      <label class="label-block">Subtotal mínimo para envío gratis ($ — poné 0 para desactivarlo)
        <input type="number" id="free-from" value="${STORE.config.freeShippingFrom}">
      </label>
      <button class="btn btn--solid btn--sm" id="save-free">Guardar</button>
    </div>`;

  const upd = (attr, field, transform = (v) => v) =>
    box.querySelectorAll(`[data-${attr}]`).forEach((inp) =>
      inp.addEventListener("change", () => {
        STORE.shipping[inp.dataset[attr]][field] = transform(inp.value);
        saveLocal();
      }));
  upd("sname", "name");
  upd("seta", "eta");
  upd("sprice", "price", (v) => Number(v) || 0);

  box.querySelectorAll("[data-stoggle]").forEach((b) =>
    b.addEventListener("click", () => {
      const m = STORE.shipping[b.dataset.stoggle];
      m.active = m.active === false;
      saveLocal(); renderView();
    }));
  box.querySelectorAll("[data-sdel]").forEach((b) =>
    b.addEventListener("click", () => {
      STORE.shipping.splice(Number(b.dataset.sdel), 1);
      saveLocal(); renderView();
    }));
  $("add-ship").addEventListener("click", () => {
    STORE.shipping.push({ id: "ship-" + Date.now().toString(36), name: "Nuevo método", eta: "", price: 0, active: true });
    saveLocal(); renderView();
  });
  $("save-free").addEventListener("click", () => {
    STORE.config.freeShippingFrom = Number($("free-from").value) || 0;
    saveLocal();
  });
}

/* ==========================================================================
   PROMOCIONES
   ========================================================================== */
function renderPromos(box) {
  box.innerHTML = `
    <div class="panel">
      <div class="panel__head">
        <h3>Códigos de descuento</h3>
        <button class="btn btn--solid btn--sm" id="add-promo">+ Agregar código</button>
      </div>
      ${STORE.promos.length ? `<div class="table-scroll"><table>
        <tr><th>Código</th><th>Tipo</th><th class="num">Valor</th><th>Estado</th><th></th></tr>
        ${STORE.promos.map((p, i) => `
          <tr>
            <td><input class="inline" value="${esc(p.code)}" data-pcode="${i}" style="text-transform:uppercase"></td>
            <td><select class="inline" data-ptype="${i}">
              <option value="percent" ${p.type === "percent" ? "selected" : ""}>% del subtotal</option>
              <option value="fixed" ${p.type === "fixed" ? "selected" : ""}>$ fijos</option>
            </select></td>
            <td class="num"><input class="inline inline--num" type="number" value="${p.value}" data-pvalue="${i}"></td>
            <td>${p.active !== false ? '<span class="pill pill--pagado">activo</span>' : '<span class="pill pill--off">pausado</span>'}</td>
            <td class="row-actions">
              <button class="btn btn--outline" data-ptoggle="${i}">${p.active !== false ? "Pausar" : "Activar"}</button>
              <button class="btn btn--danger" data-pdel="${i}">Borrar</button>
            </td>
          </tr>`).join("")}
      </table></div>` : '<p class="empty">No hay códigos. Creá el primero.</p>'}
    </div>`;

  box.querySelectorAll("[data-pcode]").forEach((inp) =>
    inp.addEventListener("change", () => { STORE.promos[inp.dataset.pcode].code = inp.value.trim().toUpperCase(); saveLocal(); }));
  box.querySelectorAll("[data-ptype]").forEach((sel) =>
    sel.addEventListener("change", () => { STORE.promos[sel.dataset.ptype].type = sel.value; saveLocal(); }));
  box.querySelectorAll("[data-pvalue]").forEach((inp) =>
    inp.addEventListener("change", () => { STORE.promos[inp.dataset.pvalue].value = Number(inp.value) || 0; saveLocal(); }));
  box.querySelectorAll("[data-ptoggle]").forEach((b) =>
    b.addEventListener("click", () => {
      const p = STORE.promos[b.dataset.ptoggle];
      p.active = p.active === false;
      saveLocal(); renderView();
    }));
  box.querySelectorAll("[data-pdel]").forEach((b) =>
    b.addEventListener("click", () => { STORE.promos.splice(Number(b.dataset.pdel), 1); saveLocal(); renderView(); }));
  $("add-promo").addEventListener("click", () => {
    STORE.promos.push({ code: "NUEVO", type: "percent", value: 10, active: true });
    saveLocal(); renderView();
  });
}

/* ==========================================================================
   TEXTOS
   ========================================================================== */
const TEXT_LABELS = {
  heroEyebrow: "Hero — etiqueta chica de arriba",
  heroTitle: "Hero — título grande (usá saltos de línea)",
  heroSub: "Hero — texto descriptivo",
  benefitsTitle: "Beneficios — título",
  benefitsSub: "Beneficios — bajada",
  shopTitle: "Tienda — título",
  shopSub: "Tienda — bajada",
  aboutTitle: "Nosotros — título",
  aboutP1: "Nosotros — párrafo 1",
  aboutP2: "Nosotros — párrafo 2",
  wholesaleTitle: "Mayoristas — título",
  wholesaleSub: "Mayoristas — bajada",
  contactTitle: "Contacto — título",
  contactSub: "Contacto — bajada",
  footerTagline: "Footer — texto de marca",
  legal: "Leyenda legal (+18)",
  announce: "Barra de anuncio (arriba de todo)",
  bigQuote: "Cita editorial grande (antes de Mayoristas)",
};

function renderTexts(box) {
  box.innerHTML = `<div class="panel">
    <h3>Contenidos de la web pública</h3>
    ${Object.keys(TEXT_LABELS).map((key) => `
      <label class="label-block">${esc(TEXT_LABELS[key])}
        <textarea data-txt="${key}" rows="${(STORE.texts[key] || "").length > 80 ? 3 : 1}">${esc(STORE.texts[key] || "")}</textarea>
      </label>`).join("")}
    <button class="btn btn--solid" id="save-texts">Guardar textos</button>
  </div>`;

  $("save-texts").addEventListener("click", () => {
    box.querySelectorAll("[data-txt]").forEach((ta) => { STORE.texts[ta.dataset.txt] = ta.value; });
    saveLocal();
  });
}

/* ==========================================================================
   IMÁGENES DE LA WEB
   ========================================================================== */
const IMAGE_SLOTS = [
  { key: "about", label: "Sección Nosotros", hint: "Foto de producción, equipo o lifestyle (vertical, mín. 800px de ancho)" },
  { key: "wholesale", label: "Sección Mayoristas", hint: "Foto de cajas, punto de venta o distribución" },
];

function renderImages(box) {
  if (!STORE.images) STORE.images = { about: "", wholesale: "" };
  box.innerHTML = IMAGE_SLOTS.map((slot) => {
    const cur = STORE.images[slot.key];
    return `
    <div class="panel">
      <h3>${esc(slot.label)}</h3>
      <p class="hint" style="margin-bottom:12px">${esc(slot.hint)}</p>
      <label class="img-drop" data-slot="${slot.key}">
        ${cur ? `<img src="${cur.startsWith("data:") || cur.startsWith("http") ? cur : "../" + cur}" style="width:120px;height:120px;object-fit:cover">` : ""}
        <span>📷 Click para ${cur ? "cambiar" : "cargar"} la imagen<br><span class="hint">Se guarda al instante; se sube al repo al publicar online</span></span>
        <input type="file" accept="image/*" hidden>
      </label>
      ${cur ? `<button class="btn btn--danger btn--sm" data-clear-img="${slot.key}" style="margin-top:12px">Quitar imagen</button>` : ""}
    </div>`;
  }).join("");

  box.querySelectorAll(".img-drop").forEach((drop) => {
    const input = drop.querySelector("input[type=file]");
    drop.addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        STORE.images[drop.dataset.slot] = reader.result;
        saveLocal();
        renderView();
      };
      reader.readAsDataURL(file);
    });
  });
  box.querySelectorAll("[data-clear-img]").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      STORE.images[b.dataset.clearImg] = "";
      saveLocal();
      renderView();
    }));
}

/* ==========================================================================
   CONFIGURACIÓN
   ========================================================================== */
function renderSettings(box) {
  const gh = lsJSON("buba-admin-gh") || { token: "", repo: "davidsued1/buba", branch: "claude/buba-web-minimal-design-5k85u5" };
  box.innerHTML = `
    <div class="panel">
      <h3>Datos de contacto de la tienda</h3>
      <div class="form-grid">
        <label>WhatsApp (con código de país, sin +)<input id="c-wa" value="${esc(STORE.config.whatsapp)}" placeholder="5491161143631"></label>
        <label>Instagram (sin @)<input id="c-ig" value="${esc(STORE.config.instagram)}"></label>
        <label class="span-2">Email de la tienda<input id="c-email" value="${esc(STORE.config.emailGeneral)}"></label>
      </div>
    </div>
    <div class="panel">
      <h3>Pagos (Mercado Pago)</h3>
      <label class="label-block">URL del backend de pagos <span class="hint">— la que te da Vercel al deployar la carpeta backend/ (dejar vacío = modo demo)</span>
        <input id="c-api" value="${esc(STORE.config.apiBase)}" placeholder="https://buba-backend.vercel.app">
      </label>
      <div class="note">El backend crea la preferencia de pago con tu cuenta de Mercado Pago. Está listo en la carpeta <strong>backend/</strong> del repo: se deploya gratis en Vercel cargando tu Access Token de MP. Cuando tengas la URL, pegala acá y el botón "Pagar con Mercado Pago" queda funcionando.</div>
    </div>
    <div class="panel">
      <h3>Seguridad</h3>
      <label class="label-block">PIN del panel<input id="c-pin" value="${esc(STORE.config.adminPin)}"></label>
    </div>
    <div class="panel">
      <h3>Publicación online (GitHub)</h3>
      <p class="hint" style="margin-bottom:12px">"Publicar online" sube los cambios al repo y la web se actualiza para todo el mundo en 1-2 minutos. Necesita un token de GitHub con permiso de escritura sobre el repo (Settings → Developer settings → Fine-grained tokens). El token queda guardado solo en este navegador.</p>
      <div class="form-grid">
        <label>Token de GitHub<input id="gh-token" type="password" value="${esc(gh.token)}" placeholder="github_pat_…"></label>
        <label>Repositorio<input id="gh-repo" value="${esc(gh.repo)}"></label>
        <label>Rama<input id="gh-branch" value="${esc(gh.branch)}"></label>
      </div>
    </div>
    <div class="panel">
      <h3>Zona de riesgo</h3>
      <button class="btn btn--danger btn--sm" id="reset-local">Descartar cambios locales (volver a lo publicado)</button>
    </div>
    <div class="form-foot"><button class="btn btn--solid" id="save-settings">Guardar configuración</button></div>`;

  $("save-settings").addEventListener("click", () => {
    STORE.config.whatsapp = $("c-wa").value.trim();
    STORE.config.instagram = $("c-ig").value.trim().replace(/^@/, "");
    STORE.config.emailGeneral = $("c-email").value.trim();
    STORE.config.emailMayoristas = $("c-email").value.trim();
    STORE.config.apiBase = $("c-api").value.trim();
    STORE.config.adminPin = $("c-pin").value.trim() || "buba2026";
    lsSet("buba-admin-gh", { token: $("gh-token").value.trim(), repo: $("gh-repo").value.trim(), branch: $("gh-branch").value.trim() || "main" });
    saveLocal();
  });
  $("reset-local").addEventListener("click", async () => {
    if (!confirm("Esto descarta los cambios locales no publicados y vuelve a la última versión publicada. ¿Seguir?")) return;
    localStorage.removeItem("buba-store");
    STORE = await resolveStore();
    renderView();
    flashSave("Cambios locales descartados");
  });
}

/* ==========================================================================
   PUBLICAR ONLINE (commit vía API de GitHub)
   ========================================================================== */
async function ghRequest(gh, path, options = {}) {
  const res = await fetch(`https://api.github.com/repos/${gh.repo}/contents/${path}`, {
    ...options,
    headers: {
      Authorization: "Bearer " + gh.token,
      Accept: "application/vnd.github+json",
      ...(options.headers || {}),
    },
  });
  return res;
}

async function ghPutFile(gh, path, base64Content, message) {
  const head = await ghRequest(gh, `${path}?ref=${gh.branch}`);
  const sha = head.ok ? (await head.json()).sha : undefined;
  const res = await ghRequest(gh, path, {
    method: "PUT",
    body: JSON.stringify({ message, content: base64Content, branch: gh.branch, ...(sha ? { sha } : {}) }),
  });
  if (!res.ok) throw new Error(`GitHub ${res.status} al subir ${path}`);
}

const toB64 = (str) => btoa(unescape(encodeURIComponent(str)));

async function publishOnline() {
  const gh = lsJSON("buba-admin-gh");
  if (!gh?.token) {
    alert("Primero cargá tu token de GitHub en Configuración → Publicación online.");
    currentView = "settings";
    syncNav(); renderView();
    return;
  }
  const btn = $("btn-publish");
  btn.disabled = true;
  btn.textContent = "Publicando…";
  try {
    const store = JSON.parse(JSON.stringify(STORE));
    // subir imágenes nuevas (data URIs) como archivos del repo
    for (const p of store.products) {
      if (p.img && p.img.startsWith("data:")) {
        const ext = (p.img.match(/^data:image\/(\w+)/) || [])[1] || "png";
        const path = `assets/img/uploads/${p.id}.${ext === "jpeg" ? "jpg" : ext}`;
        flashSave("Subiendo imagen de " + p.name + "…");
        await ghPutFile(gh, path, p.img.split(",")[1], `Imagen de producto: ${p.name} (panel BUBA)`);
        p.img = path;
      }
    }
    for (const key of Object.keys(store.images || {})) {
      const img = store.images[key];
      if (img && img.startsWith("data:")) {
        const ext = (img.match(/^data:image\/(\w+)/) || [])[1] || "png";
        const path = `assets/img/uploads/web-${key}.${ext === "jpeg" ? "jpg" : ext}`;
        flashSave("Subiendo imagen de la web…");
        await ghPutFile(gh, path, img.split(",")[1], `Imagen de la web: ${key} (panel BUBA)`);
        store.images[key] = path;
      }
    }
    flashSave("Subiendo datos de la tienda…");
    await ghPutFile(gh, "data/store.json", toB64(JSON.stringify(store, null, 2)), "Actualización desde el panel BUBA");
    STORE = store;
    saveLocal(true);
    flashSave("✓ Publicado. La web se actualiza en 1-2 minutos.");
  } catch (err) {
    alert("No se pudo publicar: " + err.message + "\nRevisá el token y los permisos del repo.");
    flashSave("Error al publicar", true);
  }
  btn.disabled = false;
  btn.textContent = "Publicar online";
}

/* ==========================================================================
   MODAL + NAV + INIT
   ========================================================================== */
function openModal(title, html) {
  $("modal-title").textContent = title;
  $("modal-body").innerHTML = html;
  $("modal").hidden = false;
  $("modal-overlay").hidden = false;
}
function closeModal() {
  $("modal").hidden = true;
  $("modal-overlay").hidden = true;
}

function syncNav() {
  document.querySelectorAll("#side-nav button").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.view === currentView));
}

document.addEventListener("DOMContentLoaded", async () => {
  STORE = await resolveStore();
  ORDERS = lsJSON("buba-orders") || [];

  setupLogin();
  renderView();

  $("side-nav").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-view]");
    if (!btn) return;
    currentView = btn.dataset.view;
    syncNav();
    renderView();
  });

  $("modal-close").addEventListener("click", closeModal);
  $("modal-overlay").addEventListener("click", closeModal);
  $("btn-publish").addEventListener("click", publishOnline);
  $("btn-preview").addEventListener("click", () => window.open("../index.html", "_blank"));
  $("logout").addEventListener("click", () => {
    sessionStorage.removeItem("buba-admin-ok");
    location.reload();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
});
