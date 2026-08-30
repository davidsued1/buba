# Conectar bubadrinks.com.ar

El dominio está comprado en NIC.ar. Falta decirle a NIC "cuando alguien
escriba bubadrinks.com.ar, mostrale la web que está en GitHub".

## Datos que hay que cargar

**Registros A** (para bubadrinks.com.ar, sin www):

| Tipo | Nombre | Valor |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |

**Registro CNAME** (para www.bubadrinks.com.ar):

| Tipo | Nombre | Valor |
|---|---|---|
| CNAME | www | davidsued1.github.io |

> Si el panel de NIC pide el nombre completo en vez de `@`, poner
> `bubadrinks.com.ar`. Si pide un TTL, dejar el que viene por defecto.

## Pasos

1. Entrar a <https://nic.ar> con Clave Fiscal de AFIP.
2. **Mis dominios** → `bubadrinks.com.ar` → **Delegaciones / DNS**.
3. Si el dominio usa los servidores DNS de NIC, cargar los registros de
   arriba. Si NIC no deja cargar registros, ver la alternativa Cloudflare.
4. Guardar y esperar: la propagación tarda entre 30 minutos y 24 horas.
5. En GitHub: repositorio → **Settings → Pages → Custom domain** →
   escribir `bubadrinks.com.ar` → **Save**.
6. Cuando GitHub muestre el tilde verde, activar **Enforce HTTPS**
   (el candado). Puede tardar hasta una hora en habilitarse.

El archivo `CNAME` de este repositorio ya tiene el dominio cargado, así
que el paso 5 suele quedar hecho solo.

## Alternativa: Cloudflare (si NIC no deja cargar registros)

1. Crear cuenta gratis en <https://cloudflare.com> y agregar el dominio.
2. Cloudflare da dos servidores de nombres (`algo.ns.cloudflare.com`).
3. En NIC.ar → Delegaciones → reemplazar los servidores por esos dos.
4. Cargar en Cloudflare los mismos registros A y CNAME de la tabla.
5. En SSL/TLS elegir modo **Full**.

## Cómo saber que funcionó

Abrir <https://bubadrinks.com.ar>: tiene que aparecer la web con candado
en la barra del navegador. Mientras tanto sigue funcionando la dirección
de siempre, así que no hay riesgo de quedarse sin sitio.
