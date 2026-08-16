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
    heroEyebrow: "Ready cocktails · Hecho en Argentina",
    heroTitle: "El color\nse toma.",
    heroSub: "El cocktail con vodka premium, listo para tomar, en una esfera que se ve venir de lejos.",
    benefitsTitle: "Por qué BUBA",
    benefitsSub: "",
    shopTitle: "Elegí tu color",
    shopSub: "Venta solo a mayores de 18.",
    aboutTitle: "Dos amigos y una esfera",
    aboutP1: "BUBA nace de dos emprendedores que convirtieron una idea en un producto real: un cocktail listo para tomar, en una lata que no se confunde con nada.",
    aboutP2: "Los mejores recuerdos nacen cuando la gente se junta. BUBA está para hacer esos momentos más divertidos.",
    wholesaleTitle: "Llevá BUBA a tu comercio",
    wholesaleSub: "¿Tenés un bar, restaurante, vinoteca, kiosco o distribuidora? Trabajamos con precios mayoristas, entregas programadas y material de marca para tu punto de venta.",
    contactTitle: "Sumate a la comunidad BUBA",
    contactSub: "Nuevos sabores, tandas limitadas y descuentos, antes que nadie. Sin spam, palabra.",
    footerTagline: "Ready cocktails. El color se toma.\nHecho en Argentina. bubadrinks.com.ar",
    legal: "Beber con moderación. Prohibida su venta a menores de 18 años.",
    announce: "Envíos a todo el país · Venta exclusiva +18 · Hecho en Argentina",
    bigQuote: "“Los mejores recuerdos nacen cuando las personas se juntan. BUBA está para hacer esos momentos más divertidos.”",
  },

  products: [
    {
      id: "blueberry",
      name: "Blueberry Limeade",
      desc: "La Azul.",
      price: 3500,
      stock: 100,
      active: true,
      img: "assets/img/blueberry.webp",
    },
    {
      id: "peach",
      name: "Golden Peach",
      desc: "La Naranja. Durazno.",
      price: 3500,
      stock: 100,
      active: true,
      img: "assets/img/peach.webp",
    },
    {
      id: "pack",
      name: "Pack x8",
      desc: "Cuatro de cada sabor.",
      price: 26000,
      stock: 50,
      active: true,
      img: "assets/img/pack.webp",
    },
  ],

  comingSoon: ["Pink Lemonade", "Strawberry Ice"],

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
