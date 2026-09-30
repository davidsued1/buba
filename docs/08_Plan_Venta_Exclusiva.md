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

**Falta de David:** precio real del pack, stock inicial, tarifas reales
de Mandalo Ya por cordón, fotos del pack y de los sabores nuevos.

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

### Fase 3 — Mercado Pago
Todo está armado (`backend/README.md`). Cuando exista la cuenta de la
sociedad: asistente del panel → pegar el Access Token en Vercel → pegar
la dirección → Probar el cobro. Cinco minutos.

### Fase 4 — Mandalo Ya
Hoy no tienen API. Caminos, del más simple al más completo:

1. **Preguntarles** si aceptan pedidos por mail, planilla (CSV) o si tienen
   integración con alguna plataforma: muchas logísticas la tienen aunque
   no la publiciten. Esto define el resto.
2. **Aviso automático por mail** con el pedido listo para cargar (se
   resuelve en la Fase 2, sin costo).
3. **Exportar los pedidos del día** en el formato que ellos pidan (CSV o
   Excel) desde el panel, para importarlos de una.
4. **Carga automática en su web** (un robot que entra con el usuario de
   BUBA y carga cada pedido). Es viable, pero es lo último: se rompe si
   ellos cambian su pantalla.

**Falta de David:** la respuesta de Mandalo Ya y el enlace de la web donde
hoy carga los pedidos, para ver qué datos pide y en qué formato.

## Orden sugerido
1. Fase 1 → cargar precio, stock y fotos desde el panel (hoy).
2. Fase 2 → planilla compartida (próxima sesión, no depende de nadie).
3. Fase 3 → en cuanto esté la cuenta de Mercado Pago.
4. Fase 4 → en cuanto responda Mandalo Ya.
