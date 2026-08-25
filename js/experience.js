/* ==========================================================================
   BUBA — Experiencia principal de la Home (doc 04: Signature Experience)

   El usuario ve "nacer" la bebida al scrollear:
     Escena 1-2  Fruta flotando que responde al mouse
     Escena 3    Segunda fruta, ambas orbitan un mismo eje
     Escena 4    Las frutas se desintegran en partículas
     Escena 5    Las partículas se vuelven líquido y forman un remolino
     Escena 6    El remolino se convierte en la esfera BUBA + tapa
     Escena 7    La etiqueta real envuelve la esfera
     Escena 8    Luz final + "Comprar ahora"

   Reglas del doc 04/05 respetadas:
   - Tiempo real (Three.js vendoreado, sin CDN ni videos)
   - Config independiente por sabor (FLAVORS)
   - Detección de dispositivo con degradado automático y sin experiencia
     en equipos flojos o con reduced-motion (la home normal queda intacta)
   - La conversión primero: botón "Saltar intro" siempre visible y la
     intro solo se muestra la primera visita (después, directo al producto)
   ========================================================================== */

import * as THREE from "../assets/vendor/three.module.min.js";
import { RoomEnvironment } from "../assets/vendor/RoomEnvironment.js";

/* ---------- Config por sabor (agregar un sabor = agregar una entrada) ---------- */
const FLAVORS = {
  blueberry: {
    liquid: 0x1596c8,
    liquidDeep: 0x0a4d6e,
    particle: 0x1080b8,
    fruitA: { kind: "berries", color: 0x2f3f86, count: 7 },
    fruitB: { kind: "lime", color: 0x9ccb3b },
    label: "assets/img/blueberry-label.webp",
  },
  peach: {
    liquid: 0xe8920a,
    liquidDeep: 0x8a5203,
    particle: 0xd07f06,
    fruitA: { kind: "berries", color: 0xf49f36, count: 5 },
    fruitB: { kind: "lime", color: 0xffd166 },
    label: "assets/img/peach-label.webp",
  },
};

const SEEN_KEY = "buba-intro-seen";

function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

/* ---------- ¿Corresponde mostrar la experiencia en este dispositivo? ---------- */
function capability() {
  if (lsGet(SEEN_KEY) === "1") return "skip";                    // ya la vio
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return "skip";
  if ((navigator.deviceMemory || 8) <= 2) return "skip";         // equipo flojo
  const probe = document.createElement("canvas");
  const gl = probe.getContext("webgl2") || probe.getContext("webgl");
  if (!gl) return "skip";
  const mobile = matchMedia("(max-width: 760px)").matches;
  return mobile ? "low" : "high";
}

/* ---------- utilidades de animación ---------- */
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
// progreso local dentro de un tramo [a,b] del progreso global, suavizado
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);

function main() {
  const section = document.getElementById("experience");
  const canvas = document.getElementById("exp-canvas");
  if (!section || !canvas) return;

  const tier = capability();
  if (tier === "skip") { section.remove(); return; }
  section.hidden = false;

  const flavor = FLAVORS.blueberry;
  const PARTICLES = tier === "high" ? 4200 : 1800;
  const DPR = Math.min(tier === "high" ? 2 : 1.5, window.devicePixelRatio || 1);

  /* ---------- base ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier === "high", alpha: true });
  renderer.setPixelRatio(DPR);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
  camera.position.set(0, 0.2, 9);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;

  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(4, 6, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xfff2df, 0.7);
  rim.position.set(-6, 2, -4);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));

  /* ---------- escena 1: la fruta principal (racimo de arándanos) ---------- */
  const fruitA = new THREE.Group();
  {
    const mat = new THREE.MeshPhysicalMaterial({
      color: flavor.fruitA.color, roughness: 0.32, clearcoat: 1,
      clearcoatRoughness: 0.25, sheen: 0.4, transparent: true,
    });
    const calyxMat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.9, transparent: true });
    const geo = new THREE.SphereGeometry(0.5, 48, 32);
    const calyxGeo = new THREE.ConeGeometry(0.14, 0.08, 5);
    const spots = [
      [0, 0, 0, 1.15], [0.75, 0.35, -0.1, 0.92], [-0.7, 0.42, 0.18, 0.85],
      [0.25, -0.68, 0.3, 0.9], [-0.45, -0.55, -0.35, 0.8], [0.05, 0.75, 0.45, 0.72],
      [-0.15, 0.1, -0.75, 0.78],
    ].slice(0, flavor.fruitA.count);
    for (const [x, y, z, s] of spots) {
      const b = new THREE.Mesh(geo, mat);
      b.position.set(x, y, z);
      b.scale.setScalar(s);
      fruitA.add(b);
      const c = new THREE.Mesh(calyxGeo, calyxMat);
      c.position.set(x, y + 0.5 * s, z);
      c.scale.setScalar(s);
      fruitA.add(c);
    }
    fruitA.userData.mats = [mat, calyxMat];
  }
  scene.add(fruitA);

  /* ---------- escena 3: la fruta secundaria (lima) ---------- */
  const fruitB = new THREE.Group();
  {
    const mat = new THREE.MeshPhysicalMaterial({
      color: flavor.fruitB.color, roughness: 0.5, clearcoat: 0.6,
      clearcoatRoughness: 0.4, transparent: true,
    });
    const lime = new THREE.Mesh(new THREE.SphereGeometry(0.62, 48, 32), mat);
    lime.scale.set(1, 0.92, 1);
    fruitB.add(lime);
    fruitB.userData.mats = [mat];
  }
  fruitB.position.set(2.4, 0.4, 0);
  fruitB.scale.setScalar(0.001);
  fruitB.visible = false;
  scene.add(fruitB);

  /* ---------- escenas 4-5: partículas (fruta → remolino → esfera) ---------- */
  const R = 1.7; // radio de la esfera BUBA
  const pGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(PARTICLES * 3);
  const start = new Float32Array(PARTICLES * 3);   // sobre las frutas
  const swirlP = new Float32Array(PARTICLES * 3);  // parámetros del remolino
  const final_ = new Float32Array(PARTICLES * 3);  // sobre la esfera
  const stag = new Float32Array(PARTICLES);        // desfasaje por partícula
  {
    const v = new THREE.Vector3();
    for (let i = 0; i < PARTICLES; i++) {
      // inicio: superficie de una de las dos frutas
      const onA = i % 3 !== 0;
      v.randomDirection().multiplyScalar(onA ? 0.9 + Math.random() * 0.5 : 0.62);
      if (!onA) v.add(new THREE.Vector3(2.4, 0.4, 0)); // posición de la lima
      start.set([v.x, v.y, v.z], i * 3);
      // remolino: radio, fase angular, altura
      swirlP[i * 3] = 0.5 + Math.random() * 1.9;           // radio
      swirlP[i * 3 + 1] = Math.random() * Math.PI * 2;     // fase
      swirlP[i * 3 + 2] = (Math.random() - 0.5) * 3.2;     // altura
      // final: distribución pareja sobre la esfera (fibonacci)
      const k = i + 0.5;
      const phi = Math.acos(1 - 2 * k / PARTICLES);
      const theta = Math.PI * (1 + Math.sqrt(5)) * k;
      final_[i * 3] = R * Math.sin(phi) * Math.cos(theta);
      final_[i * 3 + 1] = R * Math.cos(phi);
      final_[i * 3 + 2] = R * Math.sin(phi) * Math.sin(theta);
      stag[i] = Math.random() * 0.14;
    }
    pos.set(start);
  }
  pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({
    color: flavor.particle, size: 0.05, sizeAttenuation: true,
    transparent: true, opacity: 0, depthWrite: false,
  });
  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  /* ---------- escena 6: la esfera BUBA + tapa ---------- */
  const can = new THREE.Group();
  const liquidMat = new THREE.MeshPhysicalMaterial({
    color: flavor.liquid, transmission: 0.72, thickness: 2.4, ior: 1.32,
    roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.06,
    transparent: true, opacity: 1,
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), liquidMat);
  can.add(sphere);

  const lid = new THREE.Group();
  {
    const metal = new THREE.MeshStandardMaterial({ color: 0xd8d8da, metalness: 0.92, roughness: 0.32 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.06, 0.16, 64), metal);
    lid.add(cap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.055, 20, 72), metal);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    lid.add(ring);
    const tab = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 12, 40), metal);
    tab.rotation.x = Math.PI / 2;
    tab.position.set(0.28, 0.13, 0);
    lid.add(tab);
    lid.position.y = R * 0.82 + 0.05;
    lid.scale.setScalar(0.001);
  }
  can.add(lid);

  // etiqueta real envolviendo la esfera (escena 7)
  let labelMesh = null;
  new THREE.TextureLoader().load(flavor.label, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    // recortar al bloque de texto de la foto para que quede centrado
    tex.repeat.set(1.15, 0.62);
    tex.offset.set(-0.075, 0.14);
    // segmento centrado en phi=π/2, que es el lado que mira a la cámara
    const geo = new THREE.SphereGeometry(R * 1.012, 96, 48, Math.PI / 2 - 1.05, 2.1, Math.PI * 0.32, Math.PI * 0.5);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0, side: THREE.FrontSide, depthWrite: false,
    });
    labelMesh = new THREE.Mesh(geo, mat);
    can.add(labelMesh);
  });

  // sombra blanda en el piso
  const shadowTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    grad.addColorStop(0, "rgba(23,21,18,0.32)");
    grad.addColorStop(1, "rgba(23,21,18,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(5.4, 5.4),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -R - 0.35;
  scene.add(shadow);

  can.scale.setScalar(0.001);
  can.visible = false;
  scene.add(can);

  /* ---------- interacción: mouse / touch con inercia ---------- */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener("pointermove", (e) => {
    pointer.tx = (e.clientX / innerWidth - 0.5) * 2;
    pointer.ty = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });

  /* ---------- UI ---------- */
  const hint = document.getElementById("exp-hint");
  const cta = document.getElementById("exp-cta");
  const skip = document.getElementById("exp-skip");

  function endExperience() {
    lsSet(SEEN_KEY, "1");
    const bottom = section.offsetTop + section.offsetHeight - innerHeight + 1;
    window.scrollTo({ top: bottom, behavior: "instant" in window ? "instant" : "auto" });
  }
  skip.addEventListener("click", endExperience);
  cta.addEventListener("click", () => lsSet(SEEN_KEY, "1"));

  /* ---------- timeline por scroll ---------- */
  let progress = 0;
  let completed = false;

  function readProgress() {
    const rect = section.getBoundingClientRect();
    const total = section.offsetHeight - innerHeight;
    progress = clamp01(-rect.top / Math.max(1, total));
  }

  const camBase = new THREE.Vector3(0, 0.2, 9);
  const tmp = new THREE.Vector3();

  function update(t) {
    const p = progress;

    /* escena 1-2: fruta flotando (0 → .16) */
    const in1 = smooth(seg(p, 0, 0.05));
    const bob = Math.sin(t * 0.0012) * 0.12;
    fruitA.position.y = bob;
    fruitA.rotation.y = t * 0.00035 + pointer.x * 0.5;
    fruitA.rotation.x = pointer.y * 0.25;
    fruitA.scale.setScalar(Math.max(0.001, in1));

    /* escena 3: la lima entra y ambas orbitan (.16 → .34) */
    const s3 = smooth(seg(p, 0.16, 0.34));
    if (s3 > 0) {
      const orbit = s3 * Math.PI * 1.6 + t * 0.0005;
      const sep = lerp(3.2, 1.55, s3);
      fruitA.position.x = Math.cos(orbit) * sep * 0.5 * s3;
      fruitA.position.z = Math.sin(orbit) * sep * 0.35 * s3;
      fruitB.position.set(
        2.4 - s3 * (2.4 - Math.cos(orbit + Math.PI) * sep * 0.5),
        0.4 * (1 - s3) + bob * 0.6,
        Math.sin(orbit + Math.PI) * sep * 0.35 * s3
      );
      fruitB.scale.setScalar(lerp(0.001, 1, smooth(seg(p, 0.16, 0.22))));
    }

    /* escena 4: desintegración (.34 → .56): frutas se apagan, partículas viven */
    const s4 = seg(p, 0.34, 0.56);
    const fruitFade = 1 - smooth(seg(p, 0.34, 0.46));
    fruitA.visible = fruitFade > 0.01;
    fruitB.visible = s3 > 0 && fruitFade > 0.01; // la lima recién existe en la escena 3
    for (const g of [fruitA, fruitB]) {
      g.userData.mats.forEach((m) => (m.opacity = fruitFade));
      if (fruitFade < 1) g.scale.multiplyScalar(0.999);
    }
    pMat.opacity = smooth(seg(p, 0.34, 0.42)) * (1 - smooth(seg(p, 0.68, 0.78)));

    /* escenas 4-5-6: partículas → remolino → esfera (.34 → .78) */
    if (pMat.opacity > 0.001) {
      const arr = pGeo.attributes.position.array;
      for (let i = 0; i < PARTICLES; i++) {
        const d = stag[i];
        const toSwirl = smooth(seg(s4, d, 0.75 + d * 0.3));          // fruta → remolino
        const toSphere = smooth(seg(seg(p, 0.56, 0.76), d, 1));      // remolino → esfera
        const rad = swirlP[i * 3] * (1 - toSphere * 0.55);
        const ang = swirlP[i * 3 + 1] + t * 0.0022 + toSwirl * 5.2;
        const sx = Math.cos(ang) * rad;
        const sz = Math.sin(ang) * rad;
        const sy = swirlP[i * 3 + 2] * (1 - toSphere);
        const j = i * 3;
        const mx = lerp(start[j], sx, toSwirl);
        const my = lerp(start[j + 1], sy, toSwirl);
        const mz = lerp(start[j + 2], sz, toSwirl);
        arr[j] = lerp(mx, final_[j], toSphere);
        arr[j + 1] = lerp(my, final_[j + 1], toSphere);
        arr[j + 2] = lerp(mz, final_[j + 2], toSphere);
      }
      pGeo.attributes.position.needsUpdate = true;
    }

    /* escena 6: la esfera se materializa (.62 → .8) y llega la tapa */
    const s6 = smooth(seg(p, 0.62, 0.8));
    can.visible = s6 > 0;
    can.scale.setScalar(Math.max(0.001, s6));
    can.rotation.y = lerp(0.6, 0, smooth(seg(p, 0.62, 0.94))) + pointer.x * 0.18;
    liquidMat.opacity = s6;
    lid.scale.setScalar(Math.max(0.001, smooth(seg(p, 0.72, 0.84))));
    lid.position.y = lerp(R * 2.2, R * 0.82 + 0.05, smooth(seg(p, 0.72, 0.86)));
    shadow.material.opacity = s6 * 0.9;

    /* escena 7: la etiqueta se coloca (.82 → .94) */
    if (labelMesh) {
      const s7 = smooth(seg(p, 0.82, 0.94));
      labelMesh.material.opacity = s7;
      labelMesh.rotation.y = lerp(1.4, 0, s7);
    }

    /* escena 8: luz final + CTA (.9 → 1) */
    const s8 = smooth(seg(p, 0.9, 0.99));
    can.position.y = s8 * 0.6; // la lata sube un toque y le deja lugar al CTA
    key.intensity = 1.4 + s8 * 0.9;
    renderer.toneMappingExposure = 1.05 + s8 * 0.12;
    cta.hidden = s8 < 0.35;
    hint.style.opacity = p > 0.02 && p < 0.86 ? 1 : 0;

    if (p >= 0.96 && !completed) {
      completed = true;
      lsSet(SEEN_KEY, "1"); // la próxima visita va directo al producto
    }

    /* cámara con inercia */
    pointer.x = lerp(pointer.x, pointer.tx, 0.06);
    pointer.y = lerp(pointer.y, pointer.ty, 0.06);
    // al final la cámara se aleja un poco: la lata entera en cuadro, tapa incluida
    const zoom = lerp(9, 6.4, smooth(seg(p, 0.05, 0.3))) + smooth(seg(p, 0.78, 0.96)) * 1.6;
    tmp.set(camBase.x + pointer.x * 0.55, camBase.y - pointer.y * 0.3, zoom);
    camera.position.lerp(tmp, 0.08);
    camera.lookAt(0, 0, 0);
  }

  /* ---------- loop: solo renderiza cuando la sección está a la vista ---------- */
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

  function loop(t) {
    if (visible) {
      update(t);
      renderer.render(scene, camera);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

main();
