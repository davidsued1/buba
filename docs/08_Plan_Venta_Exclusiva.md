# Plan: venta exclusiva del pack x4

Ordena lo que hace falta para vender **un solo producto** (el pack con los
cuatro sabores) con pago por Mercado Pago, envíos con Mandalo Ya y stock
compartido entre los dos socios. Cada fase se puede usar apenas termina.

## Cómo queda armado

```
Cliente → web (GitHub Pages)
            ├─ cotiza el envío por código postal (zonas de Mandalo Ya)
            └─ paga → cajero (Vercel) → Mercado Pago
                                            │ pago aprobado (aviso automático)
                                            ▼
                     Planilla de Google (Apps Script)
                       ├─ descuenta el stock
                       ├─ anota el pedido con todos los datos del envío
                       └─ avisa por mail a los socios (y a Mandalo Ya)
                                            ▲
                     Los socios editan el stock desde el celu
                     (app de Google Sheets o el panel)
                                            ▼
                     La web lee el stock real: "En stock" / "Agotado"
```

Sin base de datos propia ni servidor que mantener: la planilla **es** el
sistema de gestión, y se ve desde cualquier celular.

## Fases

### Fase 1 — Modo pack único ✅ (hecha)
- Los cuatro sabores se presentan en una galería; no se venden sueltos.
- El pack es lo único a la venta, con etiqueta de stock (En stock /
  Quedan N / Agotado + "Avisame cuando vuelva").
- Zonas de envío por código postal: CABA, GBA 1er, 2do y 3er cordón,
  retiro en persona. Los precios y los códigos postales se editan en el
  panel → Envíos, con un probador de CP.
- El carrito cotiza el envío antes de comprar; el CP pasa al checkout y
  el envío queda preseleccionado. Fuera de cobertura: aviso + solo retiro.
- Panel: gestión del pack y ficha de cada sabor (nombre, texto, foto).
- Precio del pack cargado: $24.000.
- Tarifas reales de Mandalo Ya cargadas: CABA $3.800 · 1er cordón $6.200 ·
  2do y 3er cordón $8.500.
- La web se simplificó a un flujo de una sola pantalla en el celular:
  portada → pack con cantidad → sabores.

**Falta de David:** fotos del pack (portada y producto) y de Pink
Lemonade / Strawberry Ice, y el stock inicial real.

### Fase 2 — Stock y pedidos compartidos (Google Sheets)
- Una planilla con dos pestañas: **Stock** y **Pedidos**.
- Un script publicado desde la propia planilla (Apps Script) que la web
  y el cajero pueden consultar: leer stock, descontar, registrar pedido,
  mandar avisos por mail. Se instala pegando el código una vez.
- La web muestra el stock real de la planilla; el panel también lo edita.
- Cada pago aprobado descuenta stock y deja el pedido anotado con
  nombre, dirección, CP, zona y monto: listo para cargar en Mandalo Ya.

**Falta de David:** una cuenta de Google para la planilla (sirve
bubadrinks0@gmail.com) y el mail del socio.

### Fase 3 — Mercado Pago ✅ (funcionando)
Conectado con la cuenta del socio mientras sale la de la sociedad
(`docs/09_Mercado_Pago_del_Socio.md`). Compra real probada: cobra, vuelve a
la web y la web confirma el estado real con Mercado Pago. Cuando exista la
cuenta de la sociedad se cambia solo la clave en Vercel.

### Fase 4 — Logística con Fast Mail (Presis)
Fast Mail (grupo de MandaloYa) confirmó que la integración **no** va por
MandaloYa sino por **Presis**, su plataforma nueva con API propia.

Lo que ofrece la API, según su equipo de integración:
- **Carga de órdenes** desde la web.
- **Etiquetas:** al crear la orden asigna un número de guía, que figura en
  la etiqueta; la etiqueta se baja por la API.
- **Seguimiento:** estado de cada envío por número de guía. El destinatario
  recibe avisos de Fast Mail (ingreso a depósito, salida a distribución)
  con link de seguimiento en fastmail.com.ar.
- **Cotizador propio:** los códigos postales están agrupados en cordones
  asociados a servicios (en el día, día siguiente, interior). El precio
  sale de cordón de retiro + cordón de entrega + servicio + **medidas y
  peso** del paquete.

Estado de la cuenta:
- Alta de cuenta corriente y usuario en fastmail.com.ar: hecha (usuario
  BUBADRINKS). Sucursal y CP de retiro informados por Fast Mail (CP 1425).
- Enviaron además una integración para WooCommerce (no aplica: la web es
  propia). Su token **no** se guarda acá; para Presis van a dar
  credenciales nuevas, que se cargan solo en Vercel.
- Colectas: hoy se piden por formulario con 24 hs de anticipación (antes
  de las 10 hs sale en el día). Falta confirmar si con la API es automático.
- Seguimiento para el cliente: CABA y GBA en fastmail.com.ar; interior por
  Andreani.

Cómo va a quedar:
1. En el carrito, el cliente pone su CP y la web le pide el precio al
   cotizador de Presis (a través del servidor de Vercel).
2. Paga con Mercado Pago. Los datos de envío viajan guardados dentro del
   pago (metadata), así el servidor los tiene al aprobarse.
3. Al aprobarse el pago, el servidor crea la orden en Presis, recibe el
   número de guía y la etiqueta, y avisa a los socios con todo listo.
4. El cliente recibe los avisos de seguimiento de Fast Mail.

Datos del paquete (uno por pack):
- Caja de **15 × 15 × 7,5 cm**.
- Peso real con las 4 latas: **0,9 kg**. Se declara **1 kg** para no quedar
  por debajo del real (Fast Mail cotiza por peso y medidas).
- Si se compran 2 packs, van 2 bultos.

Despacho: los pedidos se arman la noche anterior y salen al **día hábil
siguiente** a la compra. Lo de viernes a domingo sale el lunes. Los
feriados se cargan en el panel → Envíos.

La API de Presis está documentada a partir del plugin oficial de Fast Mail
(`docs/referencia/wp-woo-fastmail`, ficha en `docs/10_API_Presis.md`).

**Falta:** las credenciales de Presis tras el alta comercial y confirmar
con Fast Mail qué servicio corresponde para que el cliente reciba al día
siguiente del despacho.

## Orden sugerido
1. Fase 1 → cargar precio, stock y fotos desde el panel (hoy).
2. Fase 2 → planilla compartida (próxima sesión, no depende de nadie).
3. Fase 3 → hecha con la cuenta del socio; cambiar la clave cuando esté la de la sociedad.
4. Fase 4 → en cuanto lleguen la documentación y las credenciales de Presis.
