# BUBA — Manual de todo

> Si alguna vez te perdés, empezá por acá. Este archivo explica dónde vive
> cada cosa, cómo se toca y qué hacer si algo falla.
> Está pensado para leerse sin saber nada de programación.

---

## 1. Dónde está todo

| Qué | Dónde vive | Cómo se entra |
|---|---|---|
| **Todo el código y las fotos** | GitHub → `davidsued1/buba` | github.com con la cuenta davidsued1 |
| **La web publicada** | GitHub Pages (gratis, automático) | davidsued1.github.io/buba |
| **El dominio** | Comprado en NIC.ar, DNS en Cloudflare | nic.ar (Clave Fiscal) · dash.cloudflare.com |
| **El panel de administración** | Dentro de la misma web, carpeta `/admin` | La web + `/admin` |
| **Los cobros** (cuando se conecte) | Vercel + Mercado Pago | vercel.com · mercadopago.com.ar |

**Nada de esto vive en un chat.** Si se pierde la conversación con el asistente,
el proyecto sigue intacto: está todo en GitHub.

---

## 2. Accesos

| Para qué | Dato |
|---|---|
| Panel de administración | La web + `/admin` — PIN: `buba2026` |
| Entrar a la web mientras está cerrada | Código: `buba2026` |
| Enlace privado listo para compartir | `https://bubadrinks.com.ar/?acceso=buba2026` |
| WhatsApp de la tienda | +54 9 11 6114-3631 |
| Email de la tienda | bubadrinks0@gmail.com |

> El PIN y el código se cambian desde el panel → **Configuración**.
> Conviene cambiarlos antes de abrir la web al público.

**Lo que nunca se guarda acá**: la llave de GitHub del panel y el Access
Token de Mercado Pago. Esos viven solo en el navegador y en Vercel.

---

## 3. Cómo se cambia algo de la web

1. Entrar al panel (`/admin`) con el PIN.
2. Tocar lo que se quiera cambiar: **Textos**, **Productos y fotos**,
   **Fotos de la web**, **Envíos**, **Promociones**, **Configuración**.
3. Se guarda solo mientras se escribe.
4. Tocar **Publicar** (arriba a la derecha).
5. En 1 o 2 minutos está online para todo el mundo.

El botón Publicar se pone verde con un punto cuando hay cambios sin publicar.

---

## 4. El estado de la web (abierta o cerrada)

Hoy la web está **cerrada al público**: quien entra ve una pantalla de
"Muy pronto". Solo pasa quien tenga el código.

Para abrirla: panel → **Configuración → Estado de la web** → destildar
"Mantener la web cerrada al público" → **Publicar**.

---

## 5. Qué falta / próximos pasos

Está todo listado en el panel → **🚀 Puesta en marcha**, con su estado y
un botón para resolver cada punto. Al día de hoy:

- [x] Web online
- [x] Panel conectado (publica solo)
- [x] Web cerrada con código
- [x] Dominio delegado y verificado
- [ ] Candado (HTTPS) del dominio — lo emite GitHub solo
- [ ] Mercado Pago — falta la cuenta de la sociedad
- [ ] Fotos propias en Nosotros y Mayoristas

---

## 6. Seguridad: que no se pierda nunca

1. **Segundo dueño en GitHub.** Ver `docs/RESPALDO_Y_ACCESOS.md`.
2. **Copia descargada.** Bajar el ZIP del repositorio cada tanto y
   guardarlo en Drive: github.com/davidsued1/buba → botón verde **Code**
   → **Download ZIP**.
3. **Segundo mail en la cuenta de GitHub** para poder recuperarla.
4. **Cloudflare y NIC**: sumar al socio como usuario.

---

## 7. Documentos del proyecto

| Archivo | De qué trata |
|---|---|
| `docs/RESPALDO_Y_ACCESOS.md` | Cómo asegurar todo y compartirlo con el socio |
| `docs/DOMINIO_NIC.md` | Conectar bubadrinks.com.ar paso a paso |
| `backend/README.md` | Poner a andar los cobros con Mercado Pago |
| `docs/MANUAL_DE_MARCA.pdf` | Manual de marca original |
| `docs/00` a `docs/07` | Documentos de visión y especificación |

---

## 8. Cómo está hecha la web (para un técnico)

Sitio estático (HTML, CSS y JavaScript, sin frameworks) publicado en
GitHub Pages. Los contenidos viven en `data/store.json`, que el panel
actualiza escribiendo en el repositorio con la API de GitHub; cada cambio
dispara el deploy automático definido en `.github/workflows/pages.yml`.
Los cobros usan funciones serverless en `backend/` (Vercel) contra la API
de Mercado Pago. No hay base de datos ni servidor propio que mantener.
