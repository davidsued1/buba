/**
 * BUBA — Armado de envíos para Fast Mail (funciones puras, sin red)
 *
 * datosEnvio(order)  → datos compactos que viajan en el `metadata` de Mercado Pago
 * datosCliente(order) → datos del cliente y del pedido (siempre), para el mail de aviso
 * armarGuia(envio)   → body de api/v2/multi-guias.json (ver docs/10_API_Presis.md §2.3)
 */

const MAX = 120;
const txt = (v) => String(v == null ? "" : v).trim().slice(0, MAX);

/** Datos del envío para guardar en la preferencia de MP. null si es retiro o no hay envío. */
function datosEnvio(order) {
  const ship = order && order.shipping;
  if (!ship || !String(ship.cps || "").trim()) return null;
  const c = order.customer || {};
  const a = c.address || {};
  const bultos = (order.items || []).reduce((n, it) => n + (Number(it.qty) || 0), 0);
  return {
    pedido: txt(order.code),
    nombre: txt(c.name),
    email: txt(c.email),
    telefono: txt(c.phone),
    calle: txt(a.street),
    piso_depto: txt(a.apt),
    ciudad: txt(a.city),
    provincia: txt(a.province),
    cp: txt(a.cp),
    notas: txt(a.notes),
    metodo: txt(ship.id),
    bultos: Math.max(1, bultos),
  };
}

/** Datos del cliente y del pedido para el aviso de venta. Siempre viaja, haya envío o retiro. */
function datosCliente(order) {
  const o = order || {};
  const c = o.customer || {};
  const s = o.shipping || {};
  return {
    pedido: txt(o.code),
    nombre: txt(c.name),
    email: txt(c.email),
    telefono: txt(c.phone),
    metodo_envio: txt(s.id),
    envio_nombre: txt(s.name),
    envio_precio: Number(s.price) || 0,
    notas: txt((c.address && c.address.notes) || ""),
  };
}

/** "Av. 9 de Julio 1500" → { calle: "Av. 9 de Julio", altura: "1500" } (sin número: "S/N") */
function separarCalle(texto) {
  const t = String(texto == null ? "" : texto).trim().replace(/\s+/g, " ");
  // último grupo de dígitos "suelto" (no pegado a letras: no cuenta "12C")
  const re = /(?<![\p{L}\d])\d+(?![\p{L}\d])/gu;
  let ult = null;
  for (let m; (m = re.exec(t)); ) ult = m;
  if (!ult) return { calle: t, altura: "S/N" };
  const calle = t
    .slice(0, ult.index)
    .replace(/[\s,]*#\s*$/, "")
    .replace(/[\s,]+(?:nro\.?|n[º°o]\.?|n\.?|numero|número)\s*$/i, "")
    .replace(/[\s,]+$/, "")
    .trim();
  if (!calle) return { calle: t, altura: "S/N" }; // solo un número: no hay calle que separar
  return { calle, altura: ult[0] };
}

/** "3 B" / "3B" / "piso 3 depto B" / "PB" → { piso, dpto } (mejor esfuerzo) */
function separarPisoDepto(texto) {
  const t = String(texto == null ? "" : texto).trim().replace(/\s+/g, " ");
  if (!t) return { piso: "", dpto: "" };
  const up = (s) => String(s).toUpperCase();

  let m;
  if ((m = /^(pb|ph|planta baja)$/i.exec(t))) return { piso: /planta/i.test(m[1]) ? "PB" : up(m[1]), dpto: "" };

  // formas explícitas: "piso 3 depto B", "depto B piso 3", "3° piso dpto 2", "dpto 4"
  const piso =
    /\bpiso\s*[:.]?\s*(\d{1,2}|pb|planta baja)\b/i.exec(t) ||
    /\b(\d{1,2})\s*[°º]?\s*piso\b/i.exec(t);
  const dpto = /\b(?:departamento|depto|dpto|dto|dep)\.?\s*[:.]?\s*([a-z0-9]{1,4})\b/i.exec(t);
  if (piso || dpto) {
    return {
      piso: piso ? (/planta/i.test(piso[1]) ? "PB" : up(piso[1])) : "",
      dpto: dpto ? up(dpto[1]) : "",
    };
  }

  // compactas: "3 B", "3B", "3°B", "3-B", "PB A", "12 4"
  if ((m = /^(\d{1,2}|pb)\s*[°º\-/.,]?\s*([a-z])$/i.exec(t))) return { piso: up(m[1]), dpto: up(m[2]) };
  if ((m = /^(\d{1,2}|pb)\s*[°º\-/.,\s]\s*(\d{1,3})$/i.exec(t))) return { piso: up(m[1]), dpto: m[2] };

  // solo piso: "3", "3°"
  if ((m = /^(\d{1,2})\s*[°º]?$/.exec(t))) return { piso: m[1], dpto: "" };

  return { piso: "", dpto: t };
}

// Tabla del plugin oficial (docs/10_API_Presis.md §2.3, Helper.php:411-484)
const PROVINCIAS = {
  "ciudad autonoma de buenos aires": "CIUDAD AUTONOMA DE BUENOS AIRES",
  caba: "CIUDAD AUTONOMA DE BUENOS AIRES",
  "capital federal": "CIUDAD AUTONOMA DE BUENOS AIRES",
  capital: "CIUDAD AUTONOMA DE BUENOS AIRES",
  "buenos aires": "BUENOS AIRES",
  catamarca: "CATAMARCA",
  chaco: "CHACO",
  chubut: "CHUBUT",
  cordoba: "CORDOBA",
  corrientes: "CORRIENTES",
  "entre rios": "ENTRE RIOS",
  formosa: "FORMOSA",
  jujuy: "JUJUY",
  "la pampa": "LA PAMPA",
  "la rioja": "LA RIOJA",
  mendoza: "MENDOZA",
  misiones: "MISIONES",
  neuquen: "NEUQUEN",
  "rio negro": "RIO NEGRO",
  salta: "SALTA",
  "san juan": "SAN JUAN",
  "san luis": "SAN LUIS",
  "santa cruz": "SANTA CRUZ",
  "santa fe": "SANTA FE",
  "santiago del estero": "SANTIAGO DEL ESTERO",
  "tierra del fuego": "TIERRA DEL FUEGO",
  tucuman: "TUCUMAN",
};

/** Nombre de provincia como lo manda el plugin (MAYÚSCULAS, sin tildes). Desconocida → "BUENOS AIRES" (igual que el plugin). */
function provinciaPresis(nombre) {
  const k = String(nombre || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
  return PROVINCIAS[k] || "BUENOS AIRES";
}

/**
 * Body de multi-guias.json con UNA guía. Los campos comunes (api_token, etc.)
 * los agrega presis().
 */
function armarGuia(envio, { remito, codigoServicio, cpOrigen, sucursal } = {}) {
  const { calle, altura } = separarCalle(envio.calle);
  const { piso, dpto } = separarPisoDepto(envio.piso_depto);
  const bultos = Math.max(1, Number(envio.bultos) || 1);
  const notas = String(envio.notas || "").trim();
  const nroRemito = /^\d{1,15}$/.test(String(remito)) ? Number(remito) : remito;
  const prov = provinciaPresis(envio.provincia);

  return {
    guias: [
      {
        codigo_sucursal: sucursal,
        codigo_servicio: codigoServicio,
        codigo_ceco: "",
        nro_constancia: "",
        lote: "",
        // DUDA: el plugin manda canal "WooCommerce"; no sabemos si Fast Mail acepta otro valor, usamos el del plugin
        canal: "WooCommerce",
        nro_precinto: "",
        fragil: 0,
        // DUDA: ¿remito tiene que ser numérico o acepta alfanumérico? (spec §4.3) — mandamos el id de pago de MP como número
        remito: nroRemito,
        guia_agente: "",
        fob: 0,
        internacional: false,
        valor_declarado: 0,
        isInversa: false,
        observaciones: `Pedido ${envio.pedido}` + (notas ? ` · ${notas}` : ""),
        contrareembolso: 0,
        pago_en: "ORIGEN",
        tipo_operacion: "ENTREGA PAQUETERIA",
        cobro_cheque: 0,
        cobro_efectivo: 0,
        is_urgente: false,
        sender: {
          empresa: "BUBA Drinks",
          // DUDA: no sabemos si Fast Mail exige calle/altura del remitente (spec §4.11); el plugin manda la dirección de la tienda
          calle: "",
          altura: "",
          piso: "",
          dpto: "",
          celular: "1161143631",
          otra_info: "",
          cp: cpOrigen,
          codigo_sucursal: sucursal,
          remitente: "BUBA Drinks",
          provincia: provinciaPresis("CABA"),
          localidad: "CABA",
          email: "bubadrinks0@gmail.com",
          contacto: "",
          other_info: "",
        },
        comprador: {
          codigo: "",
          destinatario: envio.nombre,
          calle,
          altura,
          piso,
          dpto,
          localidad: envio.ciudad,
          provincia: prov,
          tipo_doc: "",
          documento: "",
          horario: "",
          nro_socio: "",
          info_adicional_1: envio.pedido,
          info_adicional_2: "",
          info_adicional_3: "",
          info_adicional_4: "",
          info_adicional_5: "",
          email: envio.email,
          celular: envio.telefono,
          cuit: "",
          empresa: "",
          contenido: "PAQUETERIA",
          cp: envio.cp,
        },
        productos: [
          {
            sku: "pack4",
            sku2: "",
            descripcion: "BUBA Drinks · Pack de 4",
            bultos,
            // DUDA: ¿peso es por bulto o total? (spec §4.2). El plugin manda peso por unidad × bultos; acá mandamos el total (1 kg × bultos)
            peso: bultos * 1,
            // en la guía: alto = height, largo = length, profundidad = width (Shipping.php:188-192); la caja es 15 × 15 × 7,5
            dimensiones: { alto: 7.5, largo: 15, profundidad: 15 },
            is_bundle: false,
          },
        ],
      },
    ],
  };
}

module.exports = { datosEnvio, datosCliente, separarCalle, separarPisoDepto, provinciaPresis, armarGuia };
