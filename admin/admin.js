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
  markDirty();
  if (!silent) flashSave("Guardado ✓");
}

/* Guardado automático mientras se escribe (medio segundo después de la última tecla) */
let autoTimer = null;
function queueSave() {
  clearTimeout(autoTimer);
  flashSave("Escribiendo…");
  autoTimer = setTimeout(() => { saveLocal(true); flashSave("Guardado ✓"); }, 500);
}

/* Cambios guardados en este navegador pero todavía no publicados online */
function markDirty() {
  lsSet("buba-dirty", "1");
  syncPublishState();
}
function clearDirty() {
  try { localStorage.removeItem("buba-dirty"); } catch {}
  syncPublishState();
}
function isDirty() { try { return localStorage.getItem("buba-dirty") === "1"; } catch { return false; } }

function syncPublishState() {
  const btn = $("btn-publish");
  if (!btn) return;
  const dirty = isDirty();
  btn.classList.toggle("is-dirty", dirty);
  btn.textContent = dirty ? "● Publicar cambios" : "Publicar";
  const dot = $("dirty-dot");
  if (dot) dot.hidden = !dirty;
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
  dashboard: { title: "Inicio", render: renderDashboard },
  orders: { title: "Pedidos", render: renderOrders },
  products: { title: "Productos y fotos", render: renderProducts },
  clients: { title: "Clientes", render: renderClients },
  shipping: { title: "Envíos", render: renderShipping },
  promos: { title: "Promociones", render: renderPromos },
  texts: { title: "Textos de la web", render: renderTexts },
  images: { title: "Fotos de la web", render: renderImages },
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
        <p class="hint" style="margin-bottom:8px">Foto del producto</p>
        ${imageBox(p.img, "p-img")}
      </div>
      <label class="check-row span-2"><input type="checkbox" id="p-active" ${p.active !== false ? "checked" : ""}> Visible en la tienda</label>
    </div>
    <div class="form-foot">
      <button class="btn btn--outline btn--sm" id="p-cancel">Cancelar</button>
      <button class="btn btn--solid btn--sm" id="p-save">Guardar producto</button>
    </div>`);

  let imgData = p.img;
  const modal = document.getElementById("modal");
  function onPickImage(data) {
    imgData = data;
    const drop = modal.querySelector('[data-drop="p-img"]');
    drop.innerHTML = `<img src="${data}" alt=""><span class="img-drop__txt">Tocá para cambiarla</span>` +
      '<input type="file" accept="image/*" hidden>';
    wireImageBox(modal, "p-img", onPickImage);
  }
  wireImageBox(modal, "p-img", onPickImage);
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
const TEXT_GROUPS = [
  { title: "Barra de arriba", icon: "📢", keys: { announce: "Texto de la barra de anuncio" } },
  { title: "Portada (hero)", icon: "🏠", keys: {
      heroEyebrow: "Etiqueta chica de arriba", heroTitle: "Título grande (Enter = salto de línea)",
      heroSub: "Texto descriptivo", heroCta1: "Botón principal", heroCta2: "Botón secundario",
      heroBadge1: "Dato 1", heroBadge2: "Dato 2", heroBadge3: "Dato 3" } },
  { title: "Tienda", icon: "🛒", keys: { shopEyebrow: "Etiqueta chica", shopTitle: "Título", shopSub: "Bajada" } },
  { title: "Por qué BUBA", icon: "⭐", keys: {
      benefitsTitle: "Título de la sección",
      benefit1Title: "Beneficio 1 — título", benefit1Text: "Beneficio 1 — texto",
      benefit2Title: "Beneficio 2 — título", benefit2Text: "Beneficio 2 — texto",
      benefit3Title: "Beneficio 3 — título", benefit3Text: "Beneficio 3 — texto" } },
  { title: "Nosotros", icon: "👥", keys: {
      aboutEyebrow: "Etiqueta chica", aboutTitle: "Título", aboutP1: "Párrafo 1",
      aboutP2: "Párrafo 2", aboutCta: "Botón" } },
  { title: "Mayoristas", icon: "🏪", keys: {
      wholesaleEyebrow: "Etiqueta chica", wholesaleTitle: "Título", wholesaleSub: "Bajada",
      wholesaleItem1: "Viñeta 1", wholesaleItem2: "Viñeta 2", wholesaleItem3: "Viñeta 3",
      wholesaleItem4: "Viñeta 4", wholesaleCta: "Botón de WhatsApp", wholesaleNote: "Nota al pie" } },
  { title: "Preguntas frecuentes", icon: "❓", keys: {
      faqEyebrow: "Etiqueta chica", faqTitle: "Título",
      faq1Q: "Pregunta 1", faq1A: "Respuesta 1", faq2Q: "Pregunta 2", faq2A: "Respuesta 2",
      faq3Q: "Pregunta 3", faq3A: "Respuesta 3", faq4Q: "Pregunta 4", faq4A: "Respuesta 4" } },
  { title: "Contacto / newsletter", icon: "✉️", keys: {
      contactEyebrow: "Etiqueta chica", contactTitle: "Título", contactSub: "Bajada",
      newsletterCta: "Botón de suscripción", newsletterOk: "Mensaje al suscribirse" } },
  { title: "Pie de página y legales", icon: "📄", keys: {
      footerTagline: "Texto de marca del pie", legal: "Leyenda legal (+18)", bigQuote: "Cita editorial" } },
];

function renderTexts(box) {
  box.innerHTML = `
    <p class="lead">Tocá cualquier texto, escribí y se guarda solo. Después tocá
    <strong>Publicar</strong> para que lo vea todo el mundo.</p>
    ${TEXT_GROUPS.map((g, gi) => `
      <details class="panel panel--acc" ${gi === 0 ? "open" : ""}>
        <summary><span>${g.icon}</span> ${esc(g.title)}</summary>
        <div class="acc__body">
          ${Object.keys(g.keys).map((key) => {
            const val = STORE.texts[key] || "";
            const long = val.length > 60 || key === "heroTitle";
            return `<label class="label-block">${esc(g.keys[key])}
              <textarea data-txt="${key}" rows="${long ? 3 : 1}">${esc(val)}</textarea>
            </label>`;
          }).join("")}
        </div>
      </details>`).join("")}`;

  // guardado automático mientras escribe
  box.querySelectorAll("[data-txt]").forEach((ta) => {
    ta.addEventListener("input", () => {
      STORE.texts[ta.dataset.txt] = ta.value;
      queueSave();
    });
  });
}

/* ==========================================================================
   IMÁGENES DE LA WEB
   ========================================================================== */
const IMAGE_SLOTS = [
  { key: "about", label: "Foto de la sección Nosotros", hint: "Vertical. Producción, equipo o lifestyle." },
  { key: "wholesale", label: "Foto de la sección Mayoristas", hint: "Vertical. Cajas, punto de venta o distribución." },
];

/* Cargador de imágenes reutilizable: comprime antes de guardar para que
   la web cargue rápido en el celular. */
function readImage(file, cb) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1400;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL("image/jpeg", 0.86));
    };
    img.onerror = () => cb(reader.result);
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function imgSrc(src) {
  if (!src) return "";
  return src.startsWith("data:") || src.startsWith("http") ? src : "../" + src;
}

/* Caja de carga: se usa en Imágenes y en la ficha de producto */
function imageBox(current, id) {
  return `
    <label class="img-drop" data-drop="${id}">
      ${current ? `<img src="${imgSrc(current)}" alt="">` : '<span class="img-drop__icon">📷</span>'}
      <span class="img-drop__txt">${current ? "Tocá para cambiarla" : "Tocá para elegir una foto"}</span>
      <input type="file" accept="image/*" hidden>
    </label>`;
}
function wireImageBox(scope, id, onPick) {
  const drop = scope.querySelector(`[data-drop="${id}"]`);
  if (!drop) return;
  const input = drop.querySelector("input[type=file]");
  drop.addEventListener("click", (e) => { e.preventDefault(); input.click(); });
  input.addEventListener("change", () => {
    const f = input.files[0];
    if (f) readImage(f, onPick);
  });
}

function renderImages(box) {
  if (!STORE.images) STORE.images = { about: "", wholesale: "" };
  box.innerHTML = `
    <p class="lead">Cambiá las fotos de la web. Se achican solas para que el sitio
    cargue rápido en el celular.</p>
    ${IMAGE_SLOTS.map((slot) => `
      <div class="panel">
        <h3>${esc(slot.label)}</h3>
        <p class="hint">${esc(slot.hint)}</p>
        ${imageBox(STORE.images[slot.key], "img-" + slot.key)}
        ${STORE.images[slot.key] ? `<button class="btn btn--danger btn--sm btn--block" data-clear-img="${slot.key}">Quitar foto</button>` : ""}
      </div>`).join("")}
    <div class="panel">
      <h3>Fotos de los productos</h3>
      <p class="hint">Las fotos de cada sabor se cambian desde <strong>Productos</strong>,
      tocando el producto que quieras.</p>
      <button class="btn btn--outline btn--block" id="go-products">Ir a Productos →</button>
    </div>`;

  IMAGE_SLOTS.forEach((slot) =>
    wireImageBox(box, "img-" + slot.key, (data) => {
      STORE.images[slot.key] = data;
      saveLocal();
      renderView();
    }));
  box.querySelectorAll("[data-clear-img]").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.preventDefault();
      STORE.images[b.dataset.clearImg] = "";
      saveLocal();
      renderView();
    }));
  $("go-products").addEventListener("click", () => { currentView = "products"; syncNav(); renderView(); });
}

/* ==========================================================================
   CONFIGURACIÓN
   ========================================================================== */
function renderSettings(box) {
  const gh = ghConfig();
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
      <h3>Analytics</h3>
      <div class="form-grid">
        <label>Google Analytics 4 (G-…)<input id="c-ga4" value="${esc(STORE.config.ga4Id || "")}" placeholder="G-XXXXXXXXXX"></label>
        <label>Meta Pixel ID<input id="c-meta" value="${esc(STORE.config.metaPixelId || "")}" placeholder="123456789012345"></label>
        <label>TikTok Pixel ID<input id="c-tiktok" value="${esc(STORE.config.tiktokPixelId || "")}" placeholder="XXXXXXXXXXXXXXXXXX"></label>
      </div>
      <div class="note">Pegá los IDs y publicá: la web empieza a medir visitas y compras automáticamente. Se consiguen gratis en Google Analytics, Meta Business y TikTok Ads.</div>
    </div>
    <div class="panel">
      <h3>Seguridad</h3>
      <label class="label-block">PIN del panel<input id="c-pin" value="${esc(STORE.config.adminPin)}"></label>
    </div>
    <div class="panel">
      <h3>Conexión con la web</h3>
      <p class="hint">${gh.token
        ? "✅ El panel está conectado. Cuando tocás <strong>Publicar</strong>, tus cambios salen a la web real."
        : "⚠️ Todavía no está conectado: podés editar y ver todo acá, pero los cambios <strong>no salen a la web</strong> hasta conectarlo. Se hace una sola vez y lleva un minuto."}</p>
      <button class="btn ${gh.token ? "btn--outline" : "btn--solid"} btn--block" id="btn-connect">
        ${gh.token ? "Volver a conectar" : "Conectar ahora"}
      </button>
      ${gh.token ? '<button class="btn btn--outline btn--block" id="btn-check" style="margin-top:10px">Revisar la conexión</button>' : ""}
      <p class="wiz-status" id="check-status"></p>
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
    STORE.config.ga4Id = $("c-ga4").value.trim();
    STORE.config.metaPixelId = $("c-meta").value.trim();
    STORE.config.tiktokPixelId = $("c-tiktok").value.trim();
    STORE.config.adminPin = $("c-pin").value.trim() || "buba2026";
    saveLocal();
  });
  $("btn-connect").addEventListener("click", () => openConnectWizard());
  if ($("btn-check")) $("btn-check").addEventListener("click", async () => {
    const st = $("check-status");
    st.className = "wiz-status";
    st.textContent = "Revisando…";
    const r = await diagnose(ghConfig());
    st.className = "wiz-status " + (r.ok ? "ok" : "err");
    st.textContent = r.ok
      ? `✓ Todo bien. Conectado como ${r.login}: podés publicar.`
      : r.message;
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
/* Llamada cruda a la API de GitHub. `path` es la ruta completa a partir de
   api.github.com (ej: "/repos/davidsued1/buba"). Devuelve la respuesta y
   nunca lanza: cada caller decide qué hacer con el status. */
async function ghFetch(gh, path, options = {}) {
  return fetch("https://api.github.com" + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + gh.token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
}

/* Igual que ghFetch pero lanza un error legible si algo falla. */
async function ghRequest(gh, path, options = {}) {
  const res = await ghFetch(gh, path, options);
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).message || ""; } catch {}
    const err = new Error(detail || "Error " + res.status);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/* Rutas de contenido del repo */
const contentPath = (gh, file, ref) =>
  `/repos/${gh.repo}/contents/${file}` + (ref ? `?ref=${encodeURIComponent(ref)}` : "");

async function ghPutFile(gh, path, base64Content, message) {
  // si el archivo ya existe hay que mandar su sha para reemplazarlo
  let sha;
  const head = await ghFetch(gh, contentPath(gh, path, gh.branch));
  if (head.ok) sha = (await head.json()).sha;

  const res = await ghFetch(gh, contentPath(gh, path), {
    method: "PUT",
    body: JSON.stringify({ message, content: base64Content, branch: gh.branch, ...(sha ? { sha } : {}) }),
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).message || ""; } catch {}
    const err = new Error(detail || "Error " + res.status);
    err.status = res.status;
    throw err;
  }
}

const toB64 = (str) => btoa(unescape(encodeURIComponent(str)));

/* ==========================================================================
   PUBLICAR — asistente de conexión (una sola vez) y publicación en un toque
   ========================================================================== */
const GH_OWNER = "davidsued1";
const GH_REPO = "davidsued1/buba";
const GH_BRANCH = "claude/buba-web-minimal-design-5k85u5";
const TOKEN_URL = "https://github.com/settings/tokens/new?scopes=repo&description=Panel%20BUBA";

function ghConfig() {
  const gh = lsJSON("buba-admin-gh") || {};
  return { token: gh.token || "", repo: gh.repo || GH_REPO, branch: gh.branch || GH_BRANCH };
}
const isConnected = () => !!ghConfig().token;

/* Asistente: 3 pasos, con el link directo al permiso ya configurado */
function openConnectWizard(afterConnect) {
  openModal("Conectar el panel con tu web", `
    <p class="lead">Se hace <strong>una sola vez</strong>. Son 3 pasos y lleva un minuto.</p>

    <ol class="wizard">
      <li>
        <strong>Tocá este botón</strong>
        <p class="hint">Se abre GitHub en otra pestaña, en la pantalla de crear la llave.
        Si te pide usuario y contraseña, entrá con <strong>tu cuenta ${GH_OWNER}</strong>.</p>
        <a class="btn btn--solid btn--block" href="${TOKEN_URL}" target="_blank" rel="noopener">Abrir GitHub →</a>
      </li>
      <li>
        <strong>En GitHub, hacé solo esto</strong>
        <ul class="wizard__sub">
          <li>En <em>Expiration</em> elegí <strong>No expiration</strong>
            <span class="hint">(si no, dentro de un mes deja de andar)</span></li>
          <li>Fijate que la casilla <strong>repo</strong> esté tildada
            <span class="hint">— es la primera de la lista, la de arriba de todo. Ya te la dejamos marcada, pero confirmá que tenga el tilde ✓</span></li>
          <li>Bajá hasta el final y tocá el botón verde <strong>Generate token</strong></li>
        </ul>
      </li>
      <li>
        <strong>Copiá la llave y pegala acá</strong>
        <p class="hint">Aparece una sola vez, en un recuadro verde. Empieza con <code>ghp_</code>.
        Tocá el ícono de copiar que está al lado.</p>
        <input id="wiz-token" type="password" placeholder="ghp_…" autocomplete="off" spellcheck="false">
      </li>
    </ol>

    <p class="wiz-status" id="wiz-status"></p>
    <button class="btn btn--solid btn--block" id="wiz-save">Conectar</button>
    <p class="hint" style="margin-top:14px">
      ¿Ya lo hiciste y te da error? El mensaje de acá arriba te dice exactamente qué falta.
    </p>
  `);

  $("wiz-save").addEventListener("click", async () => {
    const token = $("wiz-token").value.trim();
    const st = $("wiz-status");
    const say = (msg, cls) => { st.textContent = msg; st.className = "wiz-status " + (cls || ""); };

    if (!token) return say("Pegá la llave que copiaste de GitHub.", "err");
    if (/\s/.test(token)) return say("La llave tiene espacios: copiala de nuevo, entera y sin cortar.", "err");

    const gh = { token, repo: GH_REPO, branch: GH_BRANCH };
    say("Revisando la llave…");
    const check = await diagnose(gh);
    if (!check.ok) return say(check.message, "err");

    lsSet("buba-admin-gh", gh);
    say("✓ Listo, quedó conectado", "ok");
    setTimeout(() => { closeModal(); syncPublishState(); if (afterConnect) afterConnect(); }, 800);
  });
}

/* Revisa la llave de punta a punta y devuelve un mensaje que se entienda:
   1. ¿es válida?  2. ¿ve el repositorio?  3. ¿puede escribir en él? */
async function diagnose(gh) {
  // 1. ¿la llave sirve?
  let me;
  try {
    me = await ghRequest(gh, "/user");
  } catch (err) {
    if (err.status === 401)
      return { ok: false, message: "Esa llave no es válida o ya venció. Creá una nueva y copiala entera." };
    if (!err.status)
      return { ok: false, message: "No hay conexión con GitHub. Revisá internet y probá de nuevo." };
    return { ok: false, message: "GitHub respondió: " + err.message };
  }

  // 2. ¿ve el repositorio?
  let repo;
  try {
    repo = await ghRequest(gh, `/repos/${gh.repo}`);
  } catch (err) {
    if (err.status === 404)
      return { ok: false, message: `La llave no llega al repositorio ${gh.repo}. Si creaste una llave "Fine-grained", volvé a crearla como "Tokens (classic)" con el permiso repo tildado.` };
    return { ok: false, message: "GitHub respondió: " + err.message };
  }

  // 3. ¿puede escribir? (lo que realmente hace falta para publicar)
  if (!repo.permissions || !repo.permissions.push) {
    return { ok: false, message: 'La llave puede mirar pero no escribir. Al crearla tenés que tildar la casilla "repo" (la de arriba de todo). Creá una nueva con ese permiso.' };
  }
  if (me.login && repo.owner && me.login.toLowerCase() !== repo.owner.login.toLowerCase()) {
    return { ok: false, message: `Esa llave es de la cuenta "${me.login}", y la web está en la cuenta "${repo.owner.login}". Entrá a GitHub con la cuenta correcta y creá la llave desde ahí.` };
  }
  return { ok: true, login: me.login };
}

async function publishOnline() {
  if (!isConnected()) { openConnectWizard(publishOnline); return; }
  const gh = ghConfig();
  const btn = $("btn-publish");
  btn.disabled = true;
  btn.textContent = "Publicando…";
  try {
    const store = JSON.parse(JSON.stringify(STORE));
    // subir imágenes nuevas (las que cargaste desde el panel) como archivos del repo
    for (const p of store.products) {
      if (p.img && p.img.startsWith("data:")) {
        p.img = await uploadImage(gh, p.img, `prod-${p.id}`, `Foto de ${p.name}`);
      }
      if (Array.isArray(p.gallery)) {
        for (let i = 0; i < p.gallery.length; i++) {
          if (p.gallery[i] && p.gallery[i].startsWith("data:")) {
            p.gallery[i] = await uploadImage(gh, p.gallery[i], `prod-${p.id}-${i + 1}`, `Foto de ${p.name}`);
          }
        }
      }
    }
    for (const key of Object.keys(store.images || {})) {
      const img = store.images[key];
      if (img && img.startsWith("data:")) {
        store.images[key] = await uploadImage(gh, img, `web-${key}`, `Imagen de la web: ${key}`);
      }
    }
    flashSave("Publicando los cambios…");
    await ghPutFile(gh, "data/store.json", toB64(JSON.stringify(store, null, 2)), "Cambios desde el panel BUBA");
    STORE = store;
    lsSet("buba-store", STORE);
    clearDirty();
    renderView();
    openModal("¡Publicado! 🎉", `
      <p class="lead">Tus cambios ya están viajando a la web.</p>
      <p>En <strong>1 o 2 minutos</strong> los va a ver todo el mundo. Si entrás ahora y
      todavía ves lo viejo, esperá un momento y recargá.</p>
      <a class="btn btn--solid btn--block" href="https://davidsued1.github.io/buba/" target="_blank" rel="noopener">Ver mi web →</a>
    `);
  } catch (err) {
    const causa = err.status === 401
      ? "La llave venció o dejó de ser válida."
      : err.status === 403 || err.status === 404
      ? 'La llave no tiene permiso para escribir. Al crearla hay que tildar la casilla "repo".'
      : err.status === 409
      ? "Alguien más publicó al mismo tiempo. Probá de nuevo en un momento."
      : "No se pudo conectar con GitHub.";
    openModal("No se pudo publicar", `
      <p class="lead">${esc(causa)}</p>
      <p class="hint">Detalle técnico: ${esc(err.message)}</p>
      <p>Tus cambios <strong>no se perdieron</strong>: siguen guardados acá. Conectá de nuevo y volvé a tocar Publicar.</p>
      <button class="btn btn--solid btn--block" id="err-reconnect">Volver a conectar</button>
    `);
    $("err-reconnect").addEventListener("click", () => openConnectWizard(publishOnline));
    flashSave("Error al publicar", true);
  }
  btn.disabled = false;
  syncPublishState();
}

/* sube una imagen (data URI) al repo y devuelve su ruta */
async function uploadImage(gh, dataUri, name, label) {
  const ext = (dataUri.match(/^data:image\/(\w+)/) || [])[1] || "png";
  const path = `assets/img/uploads/${name}-${Date.now().toString(36)}.${ext === "jpeg" ? "jpg" : ext}`;
  flashSave("Subiendo " + label + "…");
  await ghPutFile(gh, path, dataUri.split(",")[1], `${label} (panel BUBA)`);
  return path;
}

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
  document.querySelectorAll("#side-nav button, #tabbar button").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.view === currentView));
}

function closeSidebar() {
  document.getElementById("sidebar").classList.remove("is-open");
  document.getElementById("sidebar-overlay").hidden = true;
}


document.addEventListener("DOMContentLoaded", async () => {
  STORE = await resolveStore();
  ORDERS = lsJSON("buba-orders") || [];

  setupLogin();
  renderView();

  // navegación: menú lateral y barra inferior
  const goto = (e) => {
    const btn = e.target.closest("[data-view]");
    if (!btn) return;
    currentView = btn.dataset.view;
    syncNav();
    renderView();
    closeSidebar();
    document.querySelector(".main").scrollTo({ top: 0 });
  };
  $("side-nav").addEventListener("click", goto);
  $("tabbar").addEventListener("click", goto);
  $("btn-menu").addEventListener("click", () => {
    $("sidebar").classList.add("is-open");
    $("sidebar-overlay").hidden = false;
  });
  $("sidebar-overlay").addEventListener("click", closeSidebar);

  $("modal-close").addEventListener("click", closeModal);
  $("modal-overlay").addEventListener("click", closeModal);
  $("btn-publish").addEventListener("click", publishOnline);
  syncPublishState();

  // primera vez sin conectar: ofrecer el asistente
  if (!isConnected() && sessionStorage.getItem("buba-wiz-shown") !== "1") {
    sessionStorage.setItem("buba-wiz-shown", "1");
    setTimeout(() => { if (!$("app").hidden) openConnectWizard(); }, 900);
  }
  $("logout").addEventListener("click", () => {
    sessionStorage.removeItem("buba-admin-ok");
    location.reload();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
});
