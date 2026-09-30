/* ==========================================================================
   BUBA — Datos por defecto de la tienda.
   Este archivo define la estructura completa que administra el panel /admin.
   La web pública resuelve los datos en este orden:
     1. Estos defaults
     2. data/store.json (lo que el panel publicó online)
     3. localStorage "buba-store" (cambios locales del panel, vista previa)
   ========================================================================== */

window.BUBA_DEFAULTS = {
  version: 3,

  config: {
    storeName: "BUBA",
    whatsapp: "5491161143631",    // +54 9 11 6114-3631
    instagram: "buba.drinks",
    emailGeneral: "bubadrinks0@gmail.com",
    emailMayoristas: "bubadrinks0@gmail.com",
    apiBase: "",                  // URL del backend (Mercado Pago). Vacío = modo demo
    freeShippingFrom: 0,          // envío gratis desde este subtotal (0 = nunca)
    envioNoCubierto: "Por ahora enviamos a CABA y GBA. Para otras zonas escribinos por WhatsApp y lo vemos.",
    adminPin: "buba2026",         // PIN de acceso al panel
    // Modo privado: la web queda tapada con una pantalla de "Muy pronto" y
    // solo entra quien tenga el código. Se maneja desde el panel.
    privado: true,
    codigoAcceso: "buba2026",
    privadoTitulo: "Muy pronto",
    privadoTexto: "Estamos preparando algo que se ve venir de lejos.\nDejanos tu mail y te avisamos antes que a nadie.",
    ga4Id: "",                    // Google Analytics 4 (G-XXXXXXX)
    metaPixelId: "",              // Meta / Facebook Pixel
    tiktokPixelId: "",            // TikTok Pixel
  },

  // Pocos textos, todos editables desde el panel → Textos.
  texts: {
    heroTitle: "El pack de 4.",
    heroSub: "Cuatro sabores. Vodka premium. Listo para tomar.",
    heroCta1: "Quiero comprar",
    shopTitle: "Los 4 sabores",
    shopSub: "Vienen juntos en el pack.",
    packTitle: "Pack x4",
    packSub: "Una lata de cada sabor.",
    packCta: "Comprar",
    footerTagline: "Ready cocktails. Hecho en Argentina.",
    legal: "Beber con moderación. Prohibida su venta a menores de 18 años.",
  },

  // Lo único que se vende: el pack con los cuatro sabores.
  // img vacío = la web muestra el lugar de la foto hasta que se cargue desde el panel.
  products: [
    {
      id: "pack4",
      name: "Pack x4",
      desc: "Una lata de cada sabor.",
      price: 24000,
      stock: 50,
      active: true,
      img: "",
    },
  ],

  // Los sabores se muestran (no se venden sueltos). Foto y texto desde el panel.
  flavors: [
    { id: "blueberry", name: "Blueberry Limeade", desc: "La Azul. Arándanos y lima.", img: "assets/img/blueberry.webp", active: true },
    { id: "peach", name: "Golden Peach", desc: "La Naranja. Durazno dorado.", img: "assets/img/peach.webp", active: true },
    { id: "pink", name: "Pink Lemonade", desc: "La Rosa. Limonada frutal.", img: "", active: true },
    { id: "strawberry", name: "Strawberry Ice", desc: "La Roja. Frutilla helada.", img: "", active: true },
  ],

  comingSoon: [],

  // Imágenes de la web (vacío = lugar reservado). Se cargan desde el panel → Fotos.
  images: {
    hero: "",        // foto grande de la portada (el pack x4)
  },

  // Envíos con Mandalo Ya (tarifas bonificadas 2026). La zona se detecta por
  // código postal. "cps" acepta rangos y listas: "1000-1499, 1602, 1636-1640".
  // Si un CP cae en dos zonas, gana la primera de la lista.
  // Una zona sin códigos postales se ofrece siempre (retiro en persona).
  shipping: [
    { id: "caba", name: "Envío a CABA", eta: "24 a 48 hs hábiles", price: 3800, active: true,
      cps: "1000-1499" },
    // 1er cordón: Vicente López, San Isidro, San Fernando, San Martín, 3 de Febrero,
    // Hurlingham, Ituzaingó, Morón, La Matanza norte, Avellaneda, Lanús, Lomas de Zamora.
    { id: "gba1", name: "Envío a GBA — 1er cordón", eta: "24 a 72 hs hábiles", price: 6200, active: true,
      cps: "1602-1611, 1636-1646, 1650-1657, 1672-1688, 1702-1714, 1750-1758, 1766, 1822-1836, 1870-1875" },
    // 2do y 3er cordón (misma tarifa): Tigre, Malvinas Argentinas, José C. Paz, San Miguel,
    // Moreno, Merlo, La Matanza sur, Ezeiza, Esteban Echeverría, Alte. Brown, Quilmes,
    // Berazategui, Florencio Varela.
    { id: "gba2", name: "Envío a GBA — 2do y 3er cordón", eta: "48 a 96 hs hábiles", price: 8500, active: true,
      cps: "1612-1621, 1647-1649, 1660-1669, 1718-1724, 1742-1746, 1759-1778, 1801-1807, 1840-1856, 1876-1894" },
    { id: "retiro", name: "Retiro en persona", eta: "Coordinamos por WhatsApp", price: 0, active: true, cps: "" },
  ],

  promos: [
    { code: "BUBA10", type: "percent", value: 10, active: true },
  ],
};
