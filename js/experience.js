/* ==========================================================================
   BUBA — Hero inmersivo: la línea de llenado
   La lata real de BUBA (esfera PET con la serigrafía de verdad) aparece
   vacía sobre la línea de producción. Al scrollear:
     1. La llenadora industrial está posicionada sobre la lata
     2. El líquido azul entra y el nivel sube siguiendo el scroll
        (superficie con ondas, burbujas, chorro con impacto, transparencia)
     3. El pico se retira y entra el cabezal de tapado
     4. La tapa baja, se asienta y el collar de sellado la fija girando
     5. La lata queda terminada: luz de estudio, logo y "Comprar ahora"

   Técnica: Three.js vendoreado (sin CDN). Materiales PBR con transmisión
   para el PET, líquido recortado por un plano de clipping que sube con el
   scroll (con inclinación de oleaje), superficie de malla radial deformada
   por CPU, burbujas por Points reciclados bajo el nivel. Tiers por
   capacidad del equipo; con reduced-motion o sin WebGL la sección
   desaparece y queda el hero clásico.
   ========================================================================== */

import * as THREE from "../assets/vendor/three.module.min.js";
import { RoomEnvironment } from "../assets/vendor/RoomEnvironment.js";

/* ---------- Config por sabor ---------- */
const FLAVORS = {
  blueberry: {
    liquid: 0x1596c8,
    surface: 0x53c2e8,
    bubble: 0xbfeaff,
    label: "assets/img/blueberry-label.webp",
  },
  peach: {
    liquid: 0xe8920a,
    surface: 0xf7bf5a,
    bubble: 0xffe9c2,
    label: "assets/img/peach-label.webp",
  },
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);

/* ---------- ¿Puede correr en este dispositivo? ---------- */
function capability() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return "skip";
  if ((navigator.deviceMemory || 8) <= 2) return "skip";
  const probe = document.createElement("canvas");
  const gl = probe.getContext("webgl2") || probe.getContext("webgl");
  if (!gl) return "skip";
  return matchMedia("(max-width: 760px)").matches ? "low" : "high";
}

/* Disco radial subdividido (para deformar la superficie del líquido) */
function makeDiskGeometry(rings, segments) {
  const pos = [], idx = [], uv = [];
  pos.push(0, 0, 0); uv.push(0.5, 0.5);
  for (let r = 1; r <= rings; r++) {
    const rad = r / rings;
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      pos.push(Math.cos(a) * rad, Math.sin(a) * rad, 0);
      uv.push(0.5 + Math.cos(a) * rad * 0.5, 0.5 + Math.sin(a) * rad * 0.5);
    }
  }
  const ringStart = (r) => 1 + (r - 1) * segments;
  for (let s = 0; s < segments; s++) idx.push(0, ringStart(1) + s, ringStart(1) + ((s + 1) % segments));
  for (let r = 1; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const a = ringStart(r) + s, b = ringStart(r) + ((s + 1) % segments);
      const c = ringStart(r + 1) + s, d = ringStart(r + 1) + ((s + 1) % segments);
      idx.push(a, c, d, a, d, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function main() {
  const section = document.getElementById("experience");
  const canvas = document.getElementById("exp-canvas");
  if (!section || !canvas) return;

  const tier = capability();
  if (tier === "skip") { section.remove(); return; }
  section.hidden = false;

  const flavor = FLAVORS.blueberry;
  const DPR = Math.min(tier === "high" ? 2 : 1.5, window.devicePixelRatio || 1);
  const BUBBLES = tier === "high" ? 320 : 130;

  /* ---------- base: estudio ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier === "high", alpha: true });
  renderer.setPixelRatio(DPR);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
  camera.position.set(0, 0.6, 8.6);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;

  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(4.5, 7, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xf2f6ff, 0.8);
  rim.position.set(-6, 3, -5);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  /* ---------- la lata: esfera PET transparente con la serigrafía real ---------- */
  const R = 1.7;
  const can = new THREE.Group();
  scene.add(can);

  /* Medidas reales del envase (foto de la lata vacía):
     ∅ máximo 75 mm · alto del cuerpo 64 mm · boca y tapa de 55 mm.
     La esfera se trunca arriba justo donde mide 55 mm (y sigue un cuello
     corto recto hasta los 64 mm) y abajo en la base plana de apoyo,
     que tiene el domo hundido característico. */
  const MM = R / 37.5;                 // escala: 75 mm de ancho = 2R
  const TOP_CUT = 25.5 * MM;           // corte superior (ahí el cuerpo mide 55 mm)
  const BOT_CUT = -32 * MM;            // base plana
  const NECK_R = 27.5 * MM;            // boca de 55 mm
  const NECK_TOP = 32 * MM;            // alto total del cuerpo: 64 mm
  const thetaTop = Math.acos(TOP_CUT / R);
  const thetaBot = Math.acos(BOT_CUT / R);

  // PET por alpha real (transmission taparía el líquido interior): pared
  // frontal con reflejos clearcoat + pared trasera tenue para dar volumen.
  const shellGeo = new THREE.SphereGeometry(R, 96, 64, 0, Math.PI * 2, thetaTop, thetaBot - thetaTop);
  const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, transparent: true, opacity: 0.16,
    roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.04,
    envMapIntensity: 1.25, depthWrite: false,
  });
  const shell = new THREE.Mesh(shellGeo, shellMat);
  shell.renderOrder = 7;
  can.add(shell);
  const shellBack = new THREE.Mesh(shellGeo, new THREE.MeshPhysicalMaterial({
    color: 0xdfe9f0, transparent: true, opacity: 0.08,
    roughness: 0.06, side: THREE.BackSide, depthWrite: false,
  }));
  shellBack.renderOrder = 0;
  can.add(shellBack);

  // cuello recto hasta la boca + borde
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(NECK_R, NECK_R, NECK_TOP - TOP_CUT, 64, 1, true),
    shellMat
  );
  neck.position.y = (NECK_TOP + TOP_CUT) / 2;
  neck.renderOrder = 7;
  can.add(neck);
  const neckRim = new THREE.Mesh(
    new THREE.TorusGeometry(NECK_R, 0.022, 12, 64),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, roughness: 0.05, clearcoat: 1 })
  );
  neckRim.rotation.x = Math.PI / 2;
  neckRim.position.y = NECK_TOP;
  neckRim.renderOrder = 7;
  can.add(neckRim);

  // base plana + domo hundido del fondo (se ve a través del PET)
  const baseR = Math.sqrt(R * R - BOT_CUT * BOT_CUT);
  const baseDisc = new THREE.Mesh(
    new THREE.CircleGeometry(baseR, 48),
    new THREE.MeshPhysicalMaterial({ color: 0xf2f6f9, transparent: true, opacity: 0.22, roughness: 0.08, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false })
  );
  baseDisc.rotation.x = -Math.PI / 2;
  baseDisc.position.y = BOT_CUT + 0.005;
  baseDisc.renderOrder = 0;
  can.add(baseDisc);
  const baseDome = new THREE.Mesh(
    new THREE.SphereGeometry(baseR * 0.62, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: 0xeef4f8, transparent: true, opacity: 0.3, roughness: 0.06, clearcoat: 1, depthWrite: false })
  );
  baseDome.scale.set(1, 0.5, 1);
  baseDome.position.y = BOT_CUT;
  baseDome.renderOrder = 1;
  can.add(baseDome);

  // serigrafía real (misma foto de la lata, con el 10%)
  new THREE.TextureLoader().load(flavor.label, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(1.15, 0.62);
    tex.offset.set(-0.075, 0.14);
    const geo = new THREE.SphereGeometry(R * 1.012, 96, 48, Math.PI / 2 - 1.05, 2.1, Math.PI * 0.32, Math.PI * 0.5);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.FrontSide, depthWrite: false });
    const label = new THREE.Mesh(geo, mat);
    label.renderOrder = 8;
    can.add(label);
  });

  /* ---------- el líquido (recortado por el plano del nivel) ---------- */
  const FILL_MIN = BOT_CUT + 0.1;     // apenas sobre el domo del fondo
  const FILL_MAX = TOP_CUT * 0.91;    // nivel correcto: hombro, con espacio de cabeza
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), FILL_MIN);
  // el líquido nunca baja de la base plana real
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(BOT_CUT + 0.02));

  const liquidMat = new THREE.MeshPhysicalMaterial({
    color: flavor.liquid, transparent: true, opacity: 0.92,
    roughness: 0.06, clearcoat: 0.8, clearcoatRoughness: 0.1,
    envMapIntensity: 0.7, clippingPlanes: [clipPlane, floorPlane],
  });
  const liquid = new THREE.Mesh(new THREE.SphereGeometry(R * 0.965, 72, 48), liquidMat);
  liquid.renderOrder = 1;
  liquid.visible = false;
  can.add(liquid);

  // superficie del líquido: disco radial con oleaje
  const SURF_RINGS = 9, SURF_SEGS = 48;
  const surfGeo = makeDiskGeometry(SURF_RINGS, SURF_SEGS);
  const surfBase = surfGeo.attributes.position.array.slice();
  const surfMat = new THREE.MeshPhysicalMaterial({
    color: flavor.surface, transparent: true, opacity: 0.95,
    roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05,
    envMapIntensity: 1.2, side: THREE.DoubleSide,
  });
  const surface = new THREE.Mesh(surfGeo, surfMat);
  surface.renderOrder = 2;
  surface.visible = false;
  can.add(surface);

  // ondas de impacto del chorro (dos anillos que se expanden en loop)
  const ripples = [0, 1].map((i) => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 48),
      new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 3;
    m.userData.phase = i * 0.5;
    can.add(m);
    return m;
  });

  // burbujas que suben dentro del líquido
  const bGeo = new THREE.BufferGeometry();
  const bPos = new Float32Array(BUBBLES * 3);
  const bVel = new Float32Array(BUBBLES);
  for (let i = 0; i < BUBBLES; i++) {
    bPos[i * 3] = 99; bPos[i * 3 + 1] = 99; bPos[i * 3 + 2] = 0; // fuera de escena
    bVel[i] = 0.004 + Math.random() * 0.012;
  }
  bGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
  const bMat = new THREE.PointsMaterial({
    color: flavor.bubble, size: 0.07, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const bubbles = new THREE.Points(bGeo, bMat);
  bubbles.renderOrder = 4;
  can.add(bubbles);

  /* ---------- la tapa de 55 mm (baja desde el cabezal de tapado) ---------- */
  const LID_R = NECK_R + 0.03;        // calza justo sobre la boca
  const LID_SEAT = NECK_TOP + 0.075;  // asienta sobre el borde del cuello
  const lid = new THREE.Group();
  {
    const metal = new THREE.MeshStandardMaterial({ color: 0xd8d8da, metalness: 0.92, roughness: 0.3 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(LID_R, LID_R + 0.035, 0.15, 64), metal);
    lid.add(cap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(LID_R + 0.02, 0.05, 20, 72), metal);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.075;
    lid.add(ring);
    const tab = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.042, 12, 40), metal);
    tab.rotation.x = Math.PI / 2;
    tab.position.set(0.26, 0.12, 0);
    lid.add(tab);
  }
  scene.add(lid);

  /* ---------- la línea: base + llenadora + cabezal de tapado ---------- */
  const steel = new THREE.MeshStandardMaterial({ color: 0xd2d6db, metalness: 0.9, roughness: 0.34 });
  const steelDark = new THREE.MeshStandardMaterial({ color: 0x26282c, metalness: 0.65, roughness: 0.45 });

  // plataforma / puck de la cinta (la lata apoya justo encima)
  const puck = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.14, 64), steelDark);
  puck.position.y = BOT_CUT - 0.07;
  scene.add(puck);

  // sombra blanda
  const shadowTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    grad.addColorStop(0, "rgba(10,12,16,0.36)");
    grad.addColorStop(1, "rgba(10,12,16,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 4.4),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.9, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = BOT_CUT - 0.17;
  scene.add(shadow);

  // riel superior de la línea
  const machine = new THREE.Group();
  scene.add(machine);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(9, 0.3, 0.42), steel);
  rail.position.y = 3.55;
  machine.add(rail);
  const railTrim = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.46), steelDark);
  railTrim.position.y = 3.36;
  machine.add(railTrim);

  // cabezal llenador (pico)
  const filler = new THREE.Group();
  {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.15, 32), steel);
    pipe.position.y = 3.2;
    filler.add(pipe);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.3, 0.6, 48), steel);
    body.position.y = 2.55;
    filler.add(body);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.045, 16, 48), steelDark);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 2.3;
    filler.add(collar);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.055, 0.34, 32), steelDark);
    tip.position.y = 2.11;
    filler.add(tip);
  }
  machine.add(filler);
  const NOZZLE_TIP = 1.96;

  // chorro de líquido
  const streamMat = new THREE.MeshPhysicalMaterial({
    color: flavor.liquid, transparent: true, opacity: 0,
    roughness: 0.04, clearcoat: 1, envMapIntensity: 0.8, depthWrite: false,
  });
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.035, 1, 20, 1, true), streamMat);
  stream.renderOrder = 4;
  scene.add(stream);

  // cabezal de tapado + collar de sellado
  const capper = new THREE.Group();
  {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.0, 32), steel);
    pipe.position.y = 3.0;
    capper.add(pipe);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.62, 0.7), steel);
    body.position.y = 2.35;
    capper.add(body);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.1, 0.74), steelDark);
    trim.position.y = 2.08;
    capper.add(trim);
  }
  machine.add(capper);

  const sealMat = new THREE.MeshStandardMaterial({
    color: 0x9ba1a8, metalness: 0.95, roughness: 0.22,
    emissive: 0x9ed4f4, emissiveIntensity: 0,
  });
  const sealCollar = new THREE.Group();
  {
    const ringO = new THREE.Mesh(new THREE.TorusGeometry(LID_R + 0.16, 0.07, 20, 72), sealMat);
    ringO.rotation.x = Math.PI / 2;
    sealCollar.add(ringO);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(LID_R + 0.2, LID_R + 0.2, 0.18, 72, 1, true), sealMat);
    wall.position.y = 0.14;
    sealCollar.add(wall);
    for (let i = 0; i < 3; i++) { // mordazas del sellador
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, 0.26), steelDark);
      const a = (i / 3) * Math.PI * 2;
      jaw.position.set(Math.cos(a) * (LID_R + 0.08), -0.02, Math.sin(a) * (LID_R + 0.08));
      jaw.rotation.y = -a;
      sealCollar.add(jaw);
    }
  }
  scene.add(sealCollar);

  /* ---------- interacción ---------- */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener("pointermove", (e) => {
    pointer.tx = (e.clientX / innerWidth - 0.5) * 2;
    pointer.ty = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });

  const hint = document.getElementById("exp-hint");
  const cta = document.getElementById("exp-cta");
  const skip = document.getElementById("exp-skip");
  skip.addEventListener("click", () => {
    const bottom = section.offsetTop + section.offsetHeight - innerHeight + 1;
    window.scrollTo({ top: bottom, behavior: "auto" });
  });

  /* ---------- timeline por scroll ---------- */
  //   0.00–0.06  lata vacía en la línea
  //   0.06–0.58  llenado (nivel = scroll)
  //   0.58–0.61  el chorro se corta
  //   0.60–0.70  el pico se retira · 0.64–0.74 entra el tapador
  //   0.75–0.82  baja la tapa y se asienta
  //   0.82–0.925 sellado: collar baja, gira y vuelve
  //   0.92–1.00  la máquina se va, luz final, logo + Comprar ahora
  let progress = 0;
  let lastFillY = FILL_MIN;

  function readProgress() {
    const rect = section.getBoundingClientRect();
    const total = section.offsetHeight - innerHeight;
    progress = clamp01(-rect.top / Math.max(1, total));
  }

  const camBase = new THREE.Vector3(0, 0.55, 9.4);
  const tmp = new THREE.Vector3();

  function update(t, dt) {
    const p = progress;

    /* --- nivel de llenado --- */
    const fillT = seg(p, 0.06, 0.58);
    const filling = fillT > 0 && fillT < 1;
    const fillY = lerp(FILL_MIN, FILL_MAX, fillT);
    const fillVel = clamp01((fillY - lastFillY) / Math.max(0.001, dt) * 0.9);
    lastFillY = fillY;

    // oleaje: inclinación pequeña del plano + del disco (más al llenar)
    const slosh = (filling ? 0.035 : 0.008) + fillVel * 0.02;
    const tx = Math.sin(t * 0.0021) * slosh;
    const tz = Math.cos(t * 0.0017) * slosh;
    const n = new THREE.Vector3(tx, -1, tz).normalize();
    clipPlane.normal.copy(n);
    clipPlane.constant = -n.dot(new THREE.Vector3(0, fillY, 0));

    liquid.visible = fillT > 0.004;
    surface.visible = liquid.visible && fillT < 0.999;

    const rSurf = Math.sqrt(Math.max(0.02, R * R * 0.93 - fillY * fillY));
    if (surface.visible) {
      surface.position.y = fillY;
      surface.scale.set(rSurf, rSurf, 1);
      surface.rotation.set(-Math.PI / 2 + tz * 1.4, 0, tx * 1.4);
      // ondas radiales + depresión donde golpea el chorro
      const arr = surfGeo.attributes.position.array;
      const amp = (filling ? 0.022 : 0.006) / Math.max(0.4, rSurf);
      for (let i = 0; i < arr.length; i += 3) {
        const x = surfBase[i], y = surfBase[i + 1];
        const r = Math.hypot(x, y);
        let z = Math.sin(r * 9 - t * 0.006) * amp * (1 - r * 0.55);
        if (filling) z -= Math.exp(-r * r * 26) * 0.05; // impacto del chorro
        arr[i + 2] = z;
      }
      surfGeo.attributes.position.needsUpdate = true;
      surfGeo.computeVertexNormals();
    }

    /* --- chorro + ondas de impacto --- */
    const streamOn = seg(p, 0.055, 0.075) * (1 - smooth(seg(p, 0.58, 0.61)));
    streamMat.opacity = streamOn * 0.85;
    stream.visible = streamOn > 0.01;
    if (stream.visible) {
      const top = NOZZLE_TIP, bot = fillY + 0.02;
      stream.scale.set(1 + Math.sin(t * 0.013) * 0.08, Math.max(0.05, top - bot), 1 + Math.cos(t * 0.017) * 0.08);
      stream.position.y = (top + bot) / 2;
    }
    ripples.forEach((rp) => {
      const on = stream.visible && surface.visible;
      const ph = ((t * 0.0011 + rp.userData.phase) % 1 + 1) % 1;
      rp.visible = on;
      if (on) {
        rp.position.y = fillY + 0.015;
        const s = lerp(0.12, rSurf * 0.85, ph);
        rp.scale.set(s, s, 1);
        rp.material.opacity = 0.4 * (1 - ph);
      }
    });

    /* --- burbujas --- */
    bMat.opacity = liquid.visible ? (filling ? 0.85 : 0.4 * (1 - smooth(seg(p, 0.9, 0.98)))) : 0;
    if (liquid.visible) {
      const arr = bGeo.attributes.position.array;
      const yTop = fillY - 0.06;
      for (let i = 0; i < BUBBLES; i++) {
        const j = i * 3;
        if (arr[j] > 50 || arr[j + 1] > yTop) {
          // renace abajo (cerca del chorro mientras llena)
          const rr = Math.random();
          const yb = FILL_MIN + 0.1 + Math.random() * Math.max(0.05, (yTop - FILL_MIN - 0.15));
          const rMax = Math.sqrt(Math.max(0.01, R * R * 0.86 - yb * yb));
          const a = Math.random() * Math.PI * 2;
          const rad = (filling && rr < 0.45 ? Math.random() * 0.3 : Math.random()) * rMax;
          arr[j] = Math.cos(a) * rad;
          arr[j + 1] = yb;
          arr[j + 2] = Math.sin(a) * rad;
        } else {
          arr[j + 1] += bVel[i] * (dt * 60);
          arr[j] += Math.sin(t * 0.003 + i) * 0.0009;
        }
      }
      bGeo.attributes.position.needsUpdate = true;
    }

    /* --- coreografía de la máquina --- */
    const fillerOut = smooth(seg(p, 0.60, 0.70));
    filler.position.x = -fillerOut * 4.4;
    filler.position.y = fillerOut * 0.5;

    const capperIn = smooth(seg(p, 0.64, 0.74));
    capper.position.x = lerp(6.5, 0, capperIn);

    // la tapa viaja con el tapador y después baja hasta asentarse
    const lidDrop = smooth(seg(p, 0.75, 0.82));
    const lidSettle = 1 - Math.abs(Math.sin(seg(p, 0.80, 0.84) * Math.PI)) * 0.03; // toque de asiento
    if (lidDrop <= 0) {
      lid.position.set(capper.position.x, 1.92, 0);
    } else {
      lid.position.set(0, lerp(1.92, LID_SEAT, lidDrop) * lidSettle, 0);
    }

    // collar de sellado: baja, gira (sella) y vuelve al cabezal
    const sealDown = smooth(seg(p, 0.82, 0.855));
    const sealSpin = seg(p, 0.855, 0.895);
    const sealUp = smooth(seg(p, 0.895, 0.925));
    sealCollar.position.set(capper.position.x * (1 - sealDown), lerp(2.35, LID_SEAT + 0.1, sealDown) + sealUp * 1.6, 0);
    sealCollar.rotation.y = sealSpin * Math.PI * 6;
    sealMat.emissiveIntensity = sealSpin > 0 && sealSpin < 1 ? Math.sin(sealSpin * Math.PI) * 0.35 : 0;
    sealCollar.visible = p > 0.8 && sealUp < 0.999;

    // al final, toda la línea se retira
    const outro = smooth(seg(p, 0.92, 0.985));
    machine.position.y = outro * 4.2;
    capper.position.x = lerp(capper.position.x, 6.5, outro);
    // la línea se retira y la lata queda en plano producto
    puck.position.y = BOT_CUT - 0.07 - outro * 3.2;
    shadow.material.opacity = 0.9 - outro * 0.25;
    shadow.position.y = BOT_CUT - 0.17 - outro * 0.28;

    /* --- lata: quieta durante el proceso, se luce al final --- */
    can.rotation.y = pointer.x * 0.12 + outro * 0.1;
    can.position.y = outro * 0.45;
    lid.position.y += outro * 0.45; // la tapa acompaña a la lata

    /* --- luz final + CTA --- */
    const s8 = smooth(seg(p, 0.93, 0.995));
    key.intensity = 1.5 + s8 * 0.9;
    renderer.toneMappingExposure = 1.05 + s8 * 0.12;
    cta.hidden = s8 < 0.35;
    hint.style.opacity = p > 0.01 && p < 0.88 ? 1 : 0;

    /* --- cámara con inercia --- */
    pointer.x = lerp(pointer.x, pointer.tx, 0.06);
    pointer.y = lerp(pointer.y, pointer.ty, 0.06);
    // en pantallas angostas la cámara se aleja para que la lata entre a lo ancho
    const fit = camera.aspect < 1 ? Math.min(1.45, 1 + (1 - camera.aspect) * 0.55) : 1;
    const dolly = (lerp(9.4, 7.6, smooth(seg(p, 0.04, 0.3))) + smooth(seg(p, 0.9, 1)) * 2.6) * fit;
    const height = lerp(0.55, 0.3, smooth(seg(p, 0.5, 0.9))) + s8 * 0.2;
    tmp.set(camBase.x + pointer.x * 0.5, height - pointer.y * 0.25, dolly);
    camera.position.lerp(tmp, 0.08);
    // al final mira un poco más abajo: la lata sube en el cuadro y el CTA respira
    camera.lookAt(0, lerp(0.15, -0.18, smooth(seg(p, 0.88, 0.99))), 0);
  }

  /* ---------- loop ---------- */
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 }).observe(section);

  function resize() {
    const stage = canvas.parentElement;
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize);
  resize();

  addEventListener("scroll", readProgress, { passive: true });
  readProgress();

  let lastT = 0;
  function loop(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    if (visible) {
      update(t, dt);
      renderer.render(scene, camera);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

main();
