# 12 · Stock compartido

El stock del pack de 4 vive en **un solo lugar** (una base de datos en la nube) y lo usan todos:

- **La web** muestra "Hay stock", "Últimas N" o "Sin stock" con el número real, y no deja comprar más de lo que hay.
- **Cada venta aprobada** descuenta sola (una vez por pago, aunque Mercado Pago avise dos veces).
- **La app de Stock** (`/stock/`) es donde David y Matías cargan entradas, salidas y ajustes desde el celular.
- **El mail de venta** que llega al dueño dice cuántos packs quedan y avisa si quedan pocos.
- **El panel** (`/admin/`) muestra el stock en vivo, solo lectura.

Código: `backend/lib/stock.js`, `backend/api/stock*.js`, `stock/`. Detalle técnico: `backend/README.md` → "Stock compartido".

## Cómo funciona

- Hay un número por producto (`stock:pack4`) y una lista de movimientos (los últimos 2000). Cada movimiento guarda fecha, tipo, cantidad, motivo, quién lo cargó, nota y **cuánto quedó**.
- **Entrada** suma, **Salida** resta, **Ajustar conteo** deja el stock exactamente en el número que contaste. Las sumas y restas son atómicas: si dos celulares cargan a la vez, no se pisan.
- Las ventas de la web aparecen en el historial como "−1 Venta web · BUBA-XXXX".
- Una **salida cargada a mano** no puede dejar el stock en negativo (te dice cuántos hay). Una **venta web** sí puede: si pasa, el mail de venta avisa en rojo "Se vendió más de lo que había: revisá el stock" y se corrige con un ajuste.
- Antes de cobrar, la web le pregunta al servidor si alcanza. Si justo se agotó, avisa "Justo se agotó: quedan N packs. Ajustá la cantidad." y deja el carrito con lo que hay.
- Si la base de stock se cae, **la venta no se frena**: se vende igual y se registra el problema en los logs de Vercel.
- Una **devolución de plata no repone el stock sola** (no sabemos si el pack vuelve). El mail de devolución recuerda: "Si el pack vuelve, cargá una Devolución en la app de Stock."
- Los productos de prueba (`prueba`) nunca tocan el stock.

## Puesta en marcha (una sola vez)

1. **Crear la base.** Vercel → proyecto `buba-pagos` → **Storage** → **Create Database** → **Upstash for Redis** (plan gratis alcanza) → conectarla al proyecto `buba-pagos`. Vercel agrega solo las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
2. **Poner la clave.** Settings → Environment Variables → nueva variable `STOCK_CLAVE` con la clave que van a usar David y Matías (algo que no sea fácil de adivinar). Marcá Production.
3. **Redeploy.** Deployments → ⋯ → Redeploy (las variables nuevas solo se toman al volver a publicar).
4. **Publicar la app.** La carpeta `stock/` se publica con el resto del sitio en GitHub Pages: la app queda en `https://<tu-sitio>/stock/` (por ejemplo `https://bubadrinks.com.ar/stock/`).
5. **Configurar cada celular.** Abrí la app, elegí tu nombre, escribí la clave de stock y tocá **Entrar**. Queda guardado en ese celular.
6. **Cargar el stock inicial.** Tocá **Ajustar conteo**, poné cuántos packs hay de verdad y guardá. Hasta que no hagas este paso, la web sigue usando el número de `store.json` y la app muestra "todavía no hay stock cargado".

Si algo falta, la app lo dice: "Falta conectar la base de datos de stock en Vercel" (pasos 1 y 3) o "Clave incorrecta".

## Usar la app

- **+ Entrada**: elegí el motivo (*Ingreso / producción* o *Devolución*), la cantidad (con − / + o tipeándola), una nota si querés, y **Guardar**. Aparece "Listo: quedan N".
- **− Salida**: motivo *Venta fuera de la web*, *Regalo* o *Rotura o pérdida*. Todo lo que sale y no es una venta de la web se carga acá.
- **Ajustar conteo**: cuando contás los packs y no coincide. Pedís confirmación y queda registrado como "Ajuste de conteo" (con la diferencia).
- **Movimientos**: los últimos 50, con quién lo cargó, cuándo y cuánto quedó. La pantalla se actualiza sola cada 30 segundos.
- **Número grande**: verde si hay más de 10, ámbar de 1 a 10, rojo en 0 o menos.
- **Agregar a la pantalla de inicio** (para que se abra como una app): iPhone → Compartir → *Agregar a inicio*. Android → menú ⋮ → *Agregar a pantalla principal*.
- **Cambiar quién usa el celular**: tocá "cambiar" arriba a la derecha. Si cambiás `STOCK_CLAVE` en Vercel, la app pide la nueva.

La página es pública (está en GitHub Pages) pero no sirve de nada sin la clave, y no la indexan los buscadores.

## Exportar a Excel

En la app, **Descargar Excel** baja `stock-buba.csv` con todo el historial guardado (hasta 2000 movimientos): fecha (hora argentina), producto, tipo, cantidad (con signo), motivo, quién, nota, referencia (pedido) y stock después. Usa `;` como separador y tildes en UTF-8, así Excel en español lo abre directo en columnas. El link lleva la clave en la dirección: no lo compartas.

## Variables de entorno (Vercel)

| Variable | Qué hace |
|---|---|
| `STOCK_CLAVE` | **Obligatoria para la app.** La clave de stock. Sin ella, los endpoints de movimientos contestan "Falta STOCK_CLAVE" |
| `STOCK_AVISO` | Opcional. Con cuántos packs (o menos) el mail de venta avisa "Quedan pocos packs". Por defecto 10 |
| `STOCK_PRODUCTOS` | Opcional. Ids de producto que llevan stock, separados por coma. Por defecto `pack4` |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Las pone Vercel al conectar Upstash (también se aceptan `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`) |

## Qué pasa si...

- **No conecté la base:** la web usa el stock de `store.json` y las ventas no descuentan nada (como antes).
- **Vendí algo en una feria:** Salida → *Venta fuera de la web*.
- **Un cliente pidió la plata de vuelta y me devuelve el pack:** Entrada → *Devolución*.
- **Me equivoqué al cargar:** hacé el movimiento contrario, o **Ajustar conteo** con el número real. Los movimientos no se borran: el historial es el registro.
- **El stock de la web y el real no coinciden:** **Ajustar conteo**.
