"""Separa cada foto de lata en dos capas para el visor 360:
- *-base.webp : la lata SIN texto (texto borrado con inpainting) → queda fija
- *-label.webp: SOLO el texto impreso, con transparencia → es lo que gira

Además genera composiciones de verificación:
- verify-<n>-0.jpg   : base + label en posición original (debe ≈ la foto)
- verify-<n>-rot.jpg : simulación del render JS a distintos ángulos
"""
import numpy as np
import cv2
from PIL import Image, ImageFilter

OUT = "."  # las verificaciones se guardan junto al script

CANS = {
    "blueberry": {
        "src": "assets/img/blueberry.webp",
        "region": (0.08, 0.36, 0.92, 0.88),          # x0,y0,x1,y1 del bloque de texto
        "is_text": lambda r, g, b: (r > 190) & (g > 190) & (b > 190),
        "sphere": (0.499, 0.490, 0.497),
        "dilate": 11,             # cx, cy(frac H), r(frac W)
    },
    "peach": {
        "src": "assets/img/peach.webp",
        "region": (0.06, 0.34, 0.94, 0.92),
        "is_text": lambda r, g, b: (b > 105) & (g > 145),
        "sphere": (0.499, 0.509, 0.494),
        "dilate": 17,
    },
}


def split(name, cfg):
    im = Image.open(cfg["src"]).convert("RGBA")
    W, H = im.size
    a = np.array(im)
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)

    x0, y0, x1, y1 = cfg["region"]
    region = np.zeros((H, W), bool)
    region[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = True

    mask = cfg["is_text"](r, g, b) & region & (a[..., 3] > 128)
    mask_u8 = mask.astype(np.uint8) * 255
    print(name, "px de texto:", mask.sum())

    # --- capa de texto: original con alpha suavizado en el borde del glifo
    label_alpha = Image.fromarray(mask_u8).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    label = a.copy()
    label[..., 3] = np.minimum(a[..., 3], np.array(label_alpha))
    Image.fromarray(label).save(f"assets/img/{name}-label.webp", quality=95)

    # --- capa base: inpainting sobre la máscara dilatada (borra texto + halo)
    dil = cv2.dilate(mask_u8, np.ones((cfg.get("dilate", 7),) * 2, np.uint8))
    rgb = cv2.cvtColor(a, cv2.COLOR_RGBA2BGR)
    inp = cv2.inpaint(rgb, dil, 6, cv2.INPAINT_TELEA)
    base = a.copy()
    base[..., :3] = cv2.cvtColor(inp, cv2.COLOR_BGR2RGB)
    Image.fromarray(base).save(f"assets/img/{name}-base.webp", quality=88)

    # --- verificación 1: recomposición en θ=0
    comp = Image.fromarray(base.copy())
    comp.alpha_composite(Image.fromarray(label))
    bg = Image.new("RGBA", (W, H), (245, 246, 247, 255))
    side = Image.new("RGBA", (W * 2, H), (245, 246, 247, 255))
    side.paste(Image.alpha_composite(bg, im), (0, 0))
    side.paste(Image.alpha_composite(bg, comp), (W, 0))
    side.convert("RGB").save(f"{OUT}/verify-{name}-0.jpg", quality=85)

    # --- verificación 2: simulación del render a varios ángulos
    cx, cyf, rf = cfg["sphere"]
    cx, cy, R = cx * W, cyf * H, rf * W
    lab = label.astype(np.float32)
    frames = []
    for theta in (0.7, 1.6, 2.6):
        out = base.astype(np.float32).copy()
        ys, xs = np.mgrid[0:H, 0:W]
        ny = (ys - cy) / R
        nx = (xs - cx) / R
        inside = (nx**2 + ny**2 <= 0.996) & (np.abs(ny) < 0.999)
        cosLat = np.sqrt(np.clip(1 - ny**2, 1e-6, 1))
        lon = np.arcsin(np.clip(nx / cosLat, -1, 1))
        ok = inside & (np.abs(nx / cosLat) <= 1)
        lon0 = lon - theta
        # visible solo si la longitud original cae en el frente
        cosL0 = np.cos(lon0)
        vis = ok & (cosL0 > 0.02)
        sx = cx + R * cosLat * np.sin(lon0)
        sxi = np.clip(np.round(sx).astype(int), 0, W - 1)
        src = lab[ys[vis], sxi[vis]]
        fade = np.clip(cosL0[vis] / 0.12, 0, 1)
        alpha = (src[:, 3] / 255.0) * fade
        for c in range(3):
            out[ys[vis], xs[vis], c] = src[:, c] * alpha + out[ys[vis], xs[vis], c] * (1 - alpha)
        frames.append(Image.alpha_composite(bg, Image.fromarray(out.astype(np.uint8))).convert("RGB"))
    strip = Image.new("RGB", (W * 3, H), (245, 246, 247))
    for i, f in enumerate(frames):
        strip.paste(f, (W * i, 0))
    strip.save(f"{OUT}/verify-{name}-rot.jpg", quality=85)


for name, cfg in CANS.items():
    split(name, cfg)
print("listo")
