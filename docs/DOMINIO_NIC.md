# Conectar bubadrinks.com.ar a la web

NIC.ar no permite cargar los datos de la web (registros A / CNAME): solo
deja **delegar** el dominio a un servicio que los administre. Se usa
Cloudflare, que es gratis.

El recorrido es: Cloudflare da dos servidores → se cargan en NIC →
se cargan los datos de GitHub en Cloudflare → GitHub emite el candado.

## 1. Cloudflare

1. Crear cuenta gratis en <https://dash.cloudflare.com/sign-up>.
2. **Add a domain** → escribir `bubadrinks.com.ar` → continuar.
3. Elegir el plan **Free** (abajo de todo).
4. Cloudflare muestra dos servidores tipo `xxx.ns.cloudflare.com`.
   Anotarlos: van en el paso 2.

## 2. NIC.ar — delegar

1. En **Mis dominios** → `bubadrinks.com.ar` → botón **DELEGAR**.
2. Cargar los dos servidores de Cloudflare (uno en cada campo).
3. Guardar. NIC tarda entre 30 minutos y 24 horas en aplicarlo.

## 3. Cloudflare — cargar los datos de la web

En **DNS → Records → Add record**, cargar cinco registros:

| Tipo | Name | Contenido | Proxy |
|---|---|---|---|
| A | `@` | 185.199.108.153 | DNS only (nube gris) |
| A | `@` | 185.199.109.153 | DNS only |
| A | `@` | 185.199.110.153 | DNS only |
| A | `@` | 185.199.111.153 | DNS only |
| CNAME | `www` | davidsued1.github.io | DNS only |

> **Importante**: la nubecita tiene que quedar **gris** (DNS only), no
> naranja. Con la naranja GitHub no puede emitir el certificado.

En **SSL/TLS → Overview**, elegir modo **Full**.

## 4. GitHub — activar el dominio

1. Repositorio `buba` → **Settings → Pages**.
2. En **Custom domain** escribir `bubadrinks.com.ar` → **Save**.
   (El archivo `CNAME` del repo ya lo trae, así que suele estar hecho.)
3. Esperar el tilde verde del DNS check.
4. Tildar **Enforce HTTPS** (puede tardar hasta una hora en habilitarse).

## Cómo saber que funcionó

Abrir <https://bubadrinks.com.ar>: aparece la web con candado en la barra
del navegador. Hasta que propague sigue funcionando la dirección de
GitHub, así que nunca se queda sin sitio.

## Si algo no anda

| Síntoma | Causa habitual |
|---|---|
| "El sitio no se encuentra" | Todavía no propagó: esperar y reintentar |
| GitHub dice "improperly configured" | Faltan registros A o la nube está naranja |
| No deja tildar Enforce HTTPS | El certificado tarda: reintentar en una hora |
| Entra sin candado / aviso de inseguro | Poner Cloudflare en SSL **Full** y esperar |
