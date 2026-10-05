/* ==========================================================================
   BUBA — App de Stock
   Página estática (GitHub Pages) que habla con el backend de Vercel:
     GET  /api/stock-movimientos   stock + historial   (header X-Stock-Clave)
     POST /api/stock-movimiento    cargar un movimiento
   La clave y el nombre quedan guardados en este celular (localStorage).
   Es pública pero no sirve de nada sin la clave de stock.
   ========================================================================== */
(function () {
  "use strict";

  const API_FALLBACK = "https://buba-pagos.vercel.app";
  const K_QUIEN = "buba-stock-quien";
  const K_CLAVE = "buba-stock-clave";
  const K_HINT = "buba-stock-hint";
  const PRODUCTO = "pack4";
  const POCO = 10; // de acá para abajo se pinta en ámbar (el mail de venta usa STOCK_AVISO, por defecto igual)

  const MOTIVOS = {
    entrada: [["produccion", "Ingreso / producción"], ["devolucion", "Devolución"]],
    salida: [["venta_directa", "Venta fuera de la web"], ["regalo", "Regalo"], ["rotura", "Rotura o pérdida"]],
  };
  const CORTO = {
    produccion: "Ingreso", devolucion: "Devolución", venta_directa: "Venta directa", regalo: "Regalo",
    rotura: "Rotura o pérdida", ajuste: "Ajuste de conteo", venta_web: "Venta web",
  };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin persistencia: queda en memoria */ } };

  const S = {
    api: API_FALLBACK, quien: "", clave: "", stock: null, movs: [],
    sheet: null, // "mov" | "ajuste" | null
    tipo: "entrada", motivo: "produccion", cant: 1,
    guardando: false, intervalo: null,
  };

  /* ---------- utilidades de texto ---------- */
  const MENOS = "−";
  const quedan = (n) => (n === 1 ? "queda 1" : `quedan ${n}`);
  const packs = (n) => (n === 1 ? "pack" : "packs");

  const fmtAR = (opts) => new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour12: false, ...opts });
  function partes(d) {
    const p = Object.fromEntries(fmtAR({ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d).map((x) => [x.type, x.value]));
    return { dia: `${p.year}-${p.month}-${p.day}`, ddmm: `${p.day}/${p.month}`, hm: `${p.hour === "24" ? "00" : p.hour}:${p.minute}` };
  }
  function cuando(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const f = partes(d);
    const hoy = partes(new Date()).dia;
    const ayer = partes(new Date(Date.now() - 86400000)).dia;
    return `${f.dia === hoy ? "hoy" : f.dia === ayer ? "ayer" : f.ddmm} ${f.hm}`;
  }

  /* ---------- servidor ---------- */
  async function resolverApi() {
    try {
      const r = await fetch("../data/store.json?t=" + Date.now(), { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        const base = j && j.config && j.config.apiBase;
        if (base) return String(base).replace(/\/+$/, "");
      }
    } catch { /* sin store.json: se usa el de siempre */ }
    return API_FALLBACK;
  }

  async function llamar(ruta, { method = "GET", body } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    let r;
    try {
      r = await fetch(S.api + ruta, {
        method,
        headers: { "X-Stock-Clave": S.clave, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
        cache: "no-store",
      });
    } catch {
      throw { red: true };
    } finally {
      clearTimeout(timer);
    }
    let data = null;
    try { data = await r.json(); } catch { /* sin JSON */ }
    if (!r.ok || !data || data.ok === false) throw { status: r.status, data };
    return data;
  }

  function mensajeError(e) {
    if (e && e.red) return "No hay conexión con el servidor. Revisá tu internet y probá de nuevo.";
    const st = e && e.status;
    const d = (e && e.data) || {};
    if (st === 401) return "Clave incorrecta";
    if (st === 503 && d.codigo === "sin_clave") return "Falta cargar STOCK_CLAVE en Vercel (Settings → Environment Variables).";
    if (st === 503 && d.codigo === "sin_base") return "Falta conectar la base de datos de stock en Vercel";
    if (st === 404) return "El servidor todavía no tiene la app de Stock. Falta actualizar el backend en Vercel.";
    if (d.error) return d.error;
    return `Algo salió mal (error ${st || "de conexión"}). Probá de nuevo.`;
  }

  /* ---------- pantallas ---------- */
  function mostrar(cual) {
    $("setup").hidden = cual !== "setup";
    $("app").hidden = cual !== "app";
  }

  function irAConfigurar(mensaje) {
    mostrar("setup");
    $("setup-err").hidden = !mensaje;
    $("setup-err").textContent = mensaje || "";
    $("clave").value = "";
    $("setup-cancel").hidden = !(S.quien && S.clave);
    marcarChip(S.quien);
    const esChip = !!document.querySelector(`#quien-chips [data-quien="${CSS.escape(S.quien)}"]`);
    $("quien-libre").value = esChip ? "" : S.quien;
  }

  function marcarChip(nombre) {
    document.querySelectorAll("#quien-chips .chip").forEach((c) => c.setAttribute("aria-checked", String(c.dataset.quien === nombre)));
  }

  function nombreElegido() {
    const libre = $("quien-libre").value.trim();
    if (libre) return libre.slice(0, 40);
    const c = document.querySelector('#quien-chips .chip[aria-checked="true"]');
    return c ? c.dataset.quien : "";
  }

  function pintarCuenta() {
    const n = S.stock;
    const caja = $("count");
    const num = $("count-num"), lbl = $("count-lbl"), av = $("count-aviso");
    if (n == null) {
      caja.dataset.estado = "vacio";
      num.textContent = "—";
      lbl.textContent = "todavía no hay stock cargado";
      av.textContent = "Tocá «Ajustar conteo» y poné cuántos packs hay.";
      av.hidden = false;
      return;
    }
    num.textContent = String(n);
    lbl.textContent = `${packs(n)} disponible${n === 1 ? "" : "s"}`;
    if (n > POCO) { caja.dataset.estado = "ok"; av.hidden = true; }
    else if (n >= 1) { caja.dataset.estado = "poco"; av.textContent = "Quedan pocos: cargá una entrada cuando haya."; av.hidden = false; }
    else {
      caja.dataset.estado = "sin";
      av.textContent = n < 0 ? "Se vendió más de lo que había: revisá el conteo." : "Sin stock.";
      av.hidden = false;
    }
  }

  function filaMov(m) {
    const web = m.motivo === "venta_web";
    let signo, cls = m.tipo, ico;
    if (m.tipo === "entrada") { signo = `+${m.cant}`; ico = "↑"; }
    else if (m.tipo === "salida") { signo = `${MENOS}${m.cant}`; ico = "↓"; }
    else {
      ico = "≈";
      if (typeof m.antes === "number") { const d = m.saldo - m.antes; signo = d > 0 ? `+${d}` : d < 0 ? `${MENOS}${Math.abs(d)}` : "±0"; }
      else signo = `= ${m.cant}`;
    }
    if (web) cls = "web";
    const motivo = CORTO[m.motivo] || m.motivo || "";
    const titulo = m.tipo === "fijar"
      ? `<b>${esc(signo)}</b> Ajuste de conteo`
      : `<b>${esc(signo)}</b> ${esc(motivo)}` + (web && m.ref ? ` <span class="mov__ref">· ${esc(m.ref)}</span>` : "");
    const partesMeta = [];
    if (!web && m.quien) partesMeta.push(esc(m.quien));
    partesMeta.push(esc(cuando(m.ts)));
    if (typeof m.saldo === "number") partesMeta.push(`${quedan(m.saldo)}`);
    return `<li class="mov">
      <span class="mov__ico mov__ico--${cls}" aria-hidden="true">${ico}</span>
      <div class="mov__body">
        <div class="mov__tit">${titulo}</div>
        <div class="mov__meta">${partesMeta.join(" · ")}</div>
        ${m.nota ? `<div class="mov__nota">“${esc(m.nota)}”</div>` : ""}
      </div></li>`;
  }

  function pintarLista() {
    const lista = S.movs.slice(0, 50);
    $("lista").innerHTML = lista.map(filaMov).join("");
    $("lista-vacia").hidden = lista.length > 0;
  }

  function pintar() {
    $("usuario-nombre").textContent = S.quien;
    prepararDescarga();
    pintarCuenta();
    pintarLista();
  }

  // Descargar Excel: la clave viaja en un encabezado (no en la dirección), así no queda en el
  // historial del navegador ni en los registros del servidor.
  function prepararDescarga() {
    const btn = $("btn-csv");
    if (!btn || btn.dataset.listo) return;
    btn.dataset.listo = "1";
    btn.removeAttribute("target");
    btn.href = "#";
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const texto = btn.textContent;
      btn.textContent = "Preparando…";
      try {
        const r = await fetch(`${S.api}/api/stock-movimientos?formato=csv`, { headers: { "X-Stock-Clave": S.clave }, cache: "no-store" });
        if (!r.ok) throw new Error(r.status === 401 ? "Clave incorrecta" : "Error " + r.status);
        const url = URL.createObjectURL(await r.blob());
        const a = document.createElement("a");
        a.href = url; a.download = "stock-buba.csv";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } catch (err) {
        alert("No se pudo descargar: " + err.message);
      } finally {
        btn.textContent = texto;
      }
    });
  }

  function banner(texto, grave) {
    const b = $("banner");
    b.hidden = !texto;
    b.textContent = texto || "";
    b.classList.toggle("banner--bad", !!grave);
  }

  let toastTimer = null;
  function toast(texto, malo) {
    const t = $("toast");
    t.textContent = texto;
    t.classList.toggle("toast--bad", !!malo);
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }

  /* ---------- datos ---------- */
  function aplicar(data) {
    const n = data.stock ? data.stock[PRODUCTO] : null;
    S.stock = typeof n === "number" ? n : null;
    S.movs = Array.isArray(data.movimientos) ? data.movimientos : [];
    pintar();
  }

  async function refrescar() {
    try {
      const data = await llamar("/api/stock-movimientos");
      banner("");
      aplicar(data);
      return true;
    } catch (e) {
      if (e && e.status === 401) {
        lsSet(K_CLAVE, "");
        S.clave = "";
        irAConfigurar("La clave cambió. Ingresá la nueva.");
        return false;
      }
      banner(mensajeError(e) + (e && e.red ? " Se muestra lo último que se vio." : ""), !(e && e.red));
      return false;
    }
  }

  /* ---------- configurar ---------- */
  async function enviarConfiguracion(ev) {
    ev.preventDefault();
    const err = $("setup-err");
    const nombre = nombreElegido();
    const clave = $("clave").value.trim();
    err.hidden = true;
    if (!nombre) { err.textContent = "Elegí tu nombre o escribilo."; err.hidden = false; return; }
    if (!clave) { err.textContent = "Escribí la clave de stock."; err.hidden = false; return; }
    const btn = $("setup-ok");
    btn.disabled = true;
    btn.textContent = "Verificando…";
    const anterior = S.clave;
    S.clave = clave;
    try {
      const data = await llamar("/api/stock-movimientos");
      S.quien = nombre;
      lsSet(K_QUIEN, nombre);
      lsSet(K_CLAVE, clave);
      mostrar("app");
      banner("");
      aplicar(data);
      mostrarSugerencia();
    } catch (e) {
      S.clave = anterior;
      err.textContent = mensajeError(e);
      err.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  }

  /* ---------- hoja de movimiento ---------- */
  function abrirHoja(modo, tipo) {
    S.sheet = modo;
    $("toast").hidden = true;
    $("sheet-err").hidden = true;
    $("nota").value = "";
    $("sheet-ok").disabled = false;
    if (modo === "ajuste") {
      $("sheet-title").textContent = "Ajustar conteo";
      $("sheet-mov").hidden = true;
      $("sheet-ajuste").hidden = false;
      $("conteo").value = "";
      $("conteo-ahora").textContent = S.stock == null ? "Todavía no hay stock cargado." : `Ahora figuran ${S.stock} ${packs(S.stock)}.`;
      $("sheet-ok").textContent = "Guardar conteo";
    } else {
      $("sheet-mov").hidden = false;
      $("sheet-ajuste").hidden = true;
      $("sheet-ok").textContent = "Guardar";
      elegirTipo(tipo);
      S.cant = 1;
      $("cant").value = "1";
    }
    $("overlay").hidden = false;
    $("sheet").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function elegirTipo(tipo) {
    S.tipo = tipo;
    S.motivo = MOTIVOS[tipo][0][0];
    $("sheet-title").textContent = tipo === "entrada" ? "Entrada" : "Salida";
    document.querySelectorAll("#seg button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.tipo === tipo)));
    $("motivo-chips").innerHTML = MOTIVOS[tipo]
      .map(([id, txt]) => `<button type="button" class="chip" role="radio" aria-checked="${id === S.motivo}" data-motivo="${id}">${esc(txt)}</button>`)
      .join("");
  }

  function cerrarHoja() {
    if (!S.sheet) return;
    S.sheet = null;
    $("sheet").hidden = true;
    $("overlay").hidden = true;
    document.body.style.overflow = "";
  }

  const soloDigitos = (v) => String(v).replace(/\D+/g, "");
  function cambiarCant(n) {
    S.cant = Math.min(10000, Math.max(1, n));
    $("cant").value = String(S.cant);
  }

  function errorHoja(texto) {
    $("sheet-err").textContent = texto;
    $("sheet-err").hidden = false;
  }

  async function guardar(ev) {
    ev.preventDefault();
    if (S.guardando || !S.sheet) return;
    const ajuste = S.sheet === "ajuste";
    let body;
    if (ajuste) {
      const txt = soloDigitos($("conteo").value);
      const n = txt === "" ? NaN : parseInt(txt, 10);
      if (!Number.isInteger(n) || n < 0 || n > 100000) { errorHoja("Poné cuántos packs contaste (un número entre 0 y 100000)."); return; }
      const ahora = S.stock == null ? "" : ` Ahora figuran ${S.stock}.`;
      if (!window.confirm(`¿Dejar el stock en ${n} ${packs(n)}?${ahora}`)) return;
      body = { producto: PRODUCTO, tipo: "fijar", cant: n, motivo: "ajuste" };
    } else {
      const n = parseInt(soloDigitos($("cant").value) || "0", 10);
      if (!Number.isInteger(n) || n < 1 || n > 10000) { errorHoja("La cantidad tiene que ser un número entre 1 y 10000."); return; }
      body = { producto: PRODUCTO, tipo: S.tipo, cant: n, motivo: S.motivo };
    }
    body.quien = S.quien;
    body.nota = $("nota").value.trim();

    S.guardando = true;
    $("sheet-err").hidden = true;
    $("sheet-ok").disabled = true;
    $("sheet-ok").textContent = "Guardando…";
    try {
      const r = await llamar("/api/stock-movimiento", { method: "POST", body });
      S.stock = r.saldo;
      if (r.movimiento) S.movs = [r.movimiento].concat(S.movs);
      pintar();
      cerrarHoja();
      toast(`Listo: ${quedan(r.saldo)}`);
      refrescar();
    } catch (e) {
      if (e && e.status === 401) { cerrarHoja(); S.clave = ""; lsSet(K_CLAVE, ""); irAConfigurar("La clave cambió. Ingresá la nueva."); }
      else if (e && e.status === 409 && e.data && e.data.codigo === "sin_stock") {
        errorHoja(`Solo hay ${e.data.disponible} ${packs(e.data.disponible)}. Si el conteo está mal, corregilo con «Ajustar conteo».`);
      } else if (e && e.red) {
        errorHoja("No hay conexión: no pudimos confirmar si se guardó. Antes de volver a intentar, mirá si aparece en Movimientos.");
      } else errorHoja(mensajeError(e));
    } finally {
      S.guardando = false;
      $("sheet-ok").disabled = false;
      $("sheet-ok").textContent = ajuste ? "Guardar conteo" : "Guardar";
    }
  }

  /* ---------- agregar a inicio ---------- */
  function mostrarSugerencia() {
    const caja = $("hint");
    const ua = navigator.userAgent || "";
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const instalada = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
    const chico = window.matchMedia && (window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(max-width: 700px)").matches);
    if (instalada || lsGet(K_HINT) === "1" || (!ios && !chico)) { caja.hidden = true; return; }
    $("hint-txt").textContent = ios
      ? "Tocá Compartir (el cuadradito con la flecha) y después «Agregar a inicio»."
      : "Tocá el menú ⋮ del navegador y después «Agregar a pantalla principal».";
    caja.hidden = false;
  }

  /* ---------- arranque ---------- */
  function conectar() {
    $("setup-form").addEventListener("submit", enviarConfiguracion);
    $("quien-chips").addEventListener("click", (e) => {
      const c = e.target.closest("[data-quien]");
      if (!c) return;
      marcarChip(c.dataset.quien);
      $("quien-libre").value = "";
    });
    $("quien-libre").addEventListener("input", () => { if ($("quien-libre").value.trim()) marcarChip(""); });
    $("setup-cancel").addEventListener("click", () => { mostrar("app"); });
    $("btn-usuario").addEventListener("click", () => irAConfigurar(""));

    $("btn-entrada").addEventListener("click", () => abrirHoja("mov", "entrada"));
    $("btn-salida").addEventListener("click", () => abrirHoja("mov", "salida"));
    $("btn-ajuste").addEventListener("click", () => abrirHoja("ajuste"));
    $("hint-x").addEventListener("click", () => { lsSet(K_HINT, "1"); $("hint").hidden = true; });

    $("overlay").addEventListener("click", cerrarHoja);
    $("sheet-x").addEventListener("click", cerrarHoja);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarHoja(); });
    $("seg").addEventListener("click", (e) => { const b = e.target.closest("[data-tipo]"); if (b && b.dataset.tipo !== S.tipo) elegirTipo(b.dataset.tipo); });
    $("motivo-chips").addEventListener("click", (e) => {
      const c = e.target.closest("[data-motivo]");
      if (!c) return;
      S.motivo = c.dataset.motivo;
      document.querySelectorAll("#motivo-chips .chip").forEach((x) => x.setAttribute("aria-checked", String(x === c)));
    });
    $("cant-menos").addEventListener("click", () => cambiarCant((parseInt(soloDigitos($("cant").value), 10) || 1) - 1));
    $("cant-mas").addEventListener("click", () => cambiarCant((parseInt(soloDigitos($("cant").value), 10) || 0) + 1));
    $("cant").addEventListener("input", () => {
      const t = soloDigitos($("cant").value);
      $("cant").value = t;
      if (t) S.cant = parseInt(t, 10);
    });
    $("cant").addEventListener("focus", () => $("cant").select());
    $("cant").addEventListener("blur", () => { if (!soloDigitos($("cant").value)) cambiarCant(1); });
    $("conteo").addEventListener("input", () => { $("conteo").value = soloDigitos($("conteo").value); });
    $("sheet").addEventListener("submit", guardar);

    // se actualiza solo cada 30 s mientras la pantalla se está viendo
    S.intervalo = setInterval(() => {
      if (document.visibilityState === "visible" && !$("app").hidden && !S.guardando) refrescar();
    }, 30000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && !$("app").hidden && !S.guardando) refrescar();
    });
  }

  async function iniciar() {
    S.api = await resolverApi();
    S.quien = lsGet(K_QUIEN) || "";
    S.clave = lsGet(K_CLAVE) || "";
    conectar();
    if (!S.quien || !S.clave) { irAConfigurar(""); return; }
    mostrar("app");
    pintar();
    mostrarSugerencia();
    await refrescar();
  }

  iniciar();
})();
