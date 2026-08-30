# Que no se pierda nunca

Guía para asegurar el proyecto y compartirlo con el socio. Ninguno de
estos pasos toca la web: se puede hacer con la tienda funcionando.

---

## Primero: entender qué se puede perder y qué no

| Cosa | ¿Se puede perder? |
|---|---|
| El código, las fotos, la web | **No.** Vive en GitHub, no en ningún chat |
| La conversación con el asistente | Sí, pero no importa: todo lo importante quedó escrito en el repositorio |
| La cuenta de GitHub | Sí, si se pierde el acceso al mail → **resolver esto** |
| El dominio | Sí, si vence o se pierde la Clave Fiscal → **resolver esto** |

Lo que sigue cierra esos dos agujeros.

---

## 1. Sumar un segundo mail a la cuenta de GitHub (2 minutos)

Sirve para recuperar la cuenta si se pierde el acceso al mail principal.

1. <https://github.com/settings/emails>
2. **Add email address** → cargar el segundo mail
3. Confirmar desde ese mail

## 2. Activar la verificación en dos pasos (importante)

1. <https://github.com/settings/security>
2. **Enable two-factor authentication**
3. **Guardar los códigos de recuperación** que muestra: son la única
   forma de entrar si se pierde el teléfono

---

## 3. Que el socio también sea dueño

Hay dos caminos. El primero es más rápido; el segundo es el correcto
para una sociedad.

### Opción A — Sumarlo como colaborador (5 minutos)

Le da permiso total sobre el repositorio, pero el dueño sigue siendo uno.

1. <https://github.com/davidsued1/buba/settings/access>
2. **Add people** → usuario o mail del socio
3. Elegir el rol **Admin**
4. El socio acepta la invitación desde su mail

### Opción B — Pasar el proyecto a una organización (recomendado)

Una organización de GitHub es gratis y puede tener **varios dueños**. Si
uno pierde la cuenta, el otro sigue teniendo todo.

1. Crear la organización: <https://github.com/account/organizations/new>
   → plan **Free** → nombre sugerido: `bubadrinks`
2. Invitar al socio como **Owner**:
   Organización → **People** → *Invite member* → rol **Owner**
3. Transferir el repositorio:
   <https://github.com/davidsued1/buba/settings> → abajo de todo,
   **Danger Zone** → **Transfer ownership** → elegir la organización
4. Revisar que la web siga andando y volver a activar Pages si hiciera
   falta: la dirección pasa a ser `bubadrinks.github.io/buba`, pero con
   el dominio propio configurado eso no se nota.

> Al transferir cambia la dirección de GitHub del sitio. Conviene hacerlo
> **después** de que el dominio propio esté funcionando con candado, así
> nadie nota el cambio.

---

## 4. Copia descargada (hacerlo cada tanto)

1. <https://github.com/davidsued1/buba>
2. Botón verde **Code** → **Download ZIP**
3. Guardar el ZIP en Google Drive, con la fecha en el nombre

Ese ZIP tiene **todo**: la web, el panel, las fotos y los documentos.
Con eso solo se puede reconstruir el sitio completo en cualquier lado.

---

## 5. Los otros servicios

| Servicio | Cómo sumar al socio |
|---|---|
| **Cloudflare** (DNS del dominio) | Manage Account → Members → Invite → rol Administrator |
| **NIC.ar** (dueño del dominio) | Está a nombre del titular con Clave Fiscal. Para pasarlo a la sociedad: botón *Transferir* en Mis dominios |
| **Vercel** (cobros) | Settings → Members → Invite (cuando esté creado) |
| **Mercado Pago** | La cuenta va a nombre de la sociedad, con el CUIT |

---

## 6. Fechas para no perder de vista

| Qué | Cuándo |
|---|---|
| Vencimiento del dominio | **3 de junio de 2027** — renovar en NIC.ar antes |
| Llave de GitHub del panel | Sin vencimiento si se creó con *No expiration* |

> Conviene poner el vencimiento del dominio en el calendario con dos
> semanas de aviso. Si el dominio vence, la web se cae y el nombre queda
> libre para que lo tome cualquiera.

---

## 7. Si mañana hay que explicarle todo a otra persona

Alcanza con pasarle este repositorio y decirle que lea `LEEME_PRIMERO.md`.
Ahí está dónde vive cada cosa, cómo se publica y qué falta hacer.
