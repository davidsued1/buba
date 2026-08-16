/* ==========================================================================
   BUBA — Datos por defecto de la tienda.
   Este archivo define la estructura completa que administra el panel /admin.
   La web pública resuelve los datos en este orden:
     1. Estos defaults
     2. data/store.json (lo que el panel publicó online)
     3. localStorage "buba-store" (cambios locales del panel, vista previa)
   ========================================================================== */

window.BUBA_DEFAULTS = {
  version: 1,

  config: {
    storeName: "BUBA",
    whatsapp: "5491161143631",    // +54 9 11 6114-3631
    instagram: "buba.drinks",
    emailGeneral: "bubadrinks0@gmail.com",
    emailMayoristas: "bubadrinks0@gmail.com",
    apiBase: "",                  // URL del backend (Mercado Pago). Vacío = modo demo
    freeShippingFrom: 40000,      // envío gratis desde este subtotal (0 = nunca)
    adminPin: "buba2026",         // PIN de acceso al panel
  },

  texts: {
    heroEyebrow: "Cocktail frutal · Vodka premium",
    heroTitle: "El color\nse toma.",
    heroSub: "BUBA es el cocktail listo para tomar que no necesita presentarse: fruta, vodka premium y una lata esférica que se ve venir de lejos. Enfriás, abrís y listo.",
    benefitsTitle: "Por qué BUBA",
    benefitsSub: "Menos verso, más cocktail. Esto es lo que te llevás en cada lata.",
    shopTitle: "Elegí tu color",
    shopSub: "Cada sabor tiene su color. Cada color, su momento. Venta solo a mayores de 18.",
    aboutTitle: "Empezamos con una pregunta simple",
    aboutP1: "¿Por qué todos los tragos listos para tomar se ven iguales? Góndolas enteras de latas idénticas, con mucha promesa y poco adentro.",
    aboutP2: "BUBA nace para cambiar eso: un cocktail frutal elaborado con vodka premium, en una lata esférica que no se confunde con nada. Que el producto hable por su color, y que la etiqueta diga poco porque el trago dice todo.",
    wholesaleTitle: "Llevá BUBA a tu comercio",
    wholesaleSub: "¿Tenés un bar, restaurante, vinoteca, kiosco o distribuidora? Trabajamos con precios mayoristas, entregas programadas y material de marca para tu punto de venta.",
    contactTitle: "Enterate antes que nadie",
    contactSub: "Nuevos sabores, tandas limitadas y descuentos. Sin spam, palabra.",
    footerTagline: "Cocktail frutal con vodka premium.\nHecho en Argentina. bubadrinks.com.ar",
    legal: "Beber con moderación. Prohibida su venta a menores de 18 años.",
    announce: "Envíos a todo el país · Venta exclusiva +18 · Hecho en Argentina",
    bigQuote: "“Un trago que no necesita presentarse: lo ves llegar a la mesa y ya sabés que es BUBA.”",
  },

  products: [
    {
      id: "blueberry",
      name: "BUBA Blueberry Limeade",
      desc: "Azul eléctrico. Arándano y lima con vodka premium.",
      price: 3500,
      stock: 100,
      active: true,
      img: "assets/img/blueberry.webp",
    },
    {
      id: "peach",
      name: "BUBA Golden Peach",
      desc: "Dorado intenso. Durazno maduro con vodka premium.",
      price: 3500,
      stock: 100,
      active: true,
      img: "assets/img/peach.webp",
    },
    {
      id: "pack",
      name: "Pack Degustación x8",
      desc: "Cuatro de cada sabor. El punto de partida ideal.",
      price: 26000,
      stock: 50,
      active: true,
      img: "",
    },
  ],

  comingSoon: ["Nuevo sabor 03", "Nuevo sabor 04"],

  // Imágenes de secciones de la web (vacío = placeholder). Se cargan desde el panel.
  images: {
    about: "",       // sección Nosotros
    wholesale: "",   // sección Mayoristas
  },

  shipping: [
    { id: "moto", name: "Moto (CABA y GBA)", eta: "En el día", price: 3500, active: true },
    { id: "correo", name: "Correo Argentino", eta: "3 a 6 días hábiles", price: 4500, active: true },
    { id: "andreani", name: "Andreani", eta: "2 a 4 días hábiles", price: 6000, active: true },
    { id: "retiro", name: "Retiro en punto de entrega", eta: "Coordinamos por WhatsApp", price: 0, active: true },
  ],

  promos: [
    { code: "BUBA10", type: "percent", value: 10, active: true },
  ],
};
