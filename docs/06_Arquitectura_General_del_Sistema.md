# BUBA DRINKS

# Arquitectura General del Sistema

## Objetivo

Este documento define la arquitectura completa de la plataforma de BUBA DRINKS.

No estamos construyendo únicamente una tienda online.

Estamos desarrollando el sistema operativo completo de la empresa.

Toda la arquitectura deberá ser modular, escalable, mantenible y preparada para crecer durante muchos años sin necesidad de rehacer el proyecto.

El sistema debe permitir agregar nuevos módulos en el futuro sin afectar el funcionamiento de los existentes.

---

# Filosofía

Toda funcionalidad deberá pertenecer a un módulo.

Nunca mezclar responsabilidades.

Nunca escribir código específico para un único caso.

Todo deberá ser reutilizable.

Cada módulo debe poder evolucionar independientemente.

---

# Arquitectura General

La plataforma estará dividida en cuatro grandes áreas.

1. Sitio Público
2. Panel Administrativo
3. Backend / API
4. Infraestructura

---

# 1. Sitio Público

Es la cara visible de la marca.

Debe ser extremadamente rápida, moderna y enfocada en la conversión.

Incluye:

- Home
- Productos
- Packs
- Combos
- Carrito
- Checkout
- Nosotros
- Historia
- Preguntas Frecuentes
- Contacto
- Blog
- Mayoristas
- Eventos
- Promociones
- Landing Pages
- Mi Cuenta
- Seguimiento del pedido

Todo debe administrarse desde el panel.

Nada debe estar escrito directamente en el código.

---

# 2. Panel Administrativo

El panel será el centro de operaciones de BUBA.

No será un simple administrador de productos.

Será el lugar desde donde se administrará toda la empresa.

El panel deberá incluir:

Dashboard

Productos

Categorías

Colecciones

Pedidos

Clientes

Usuarios

Roles

Permisos

Stock

Compras

Movimientos

Logística

Envíos

Moto Mensajería

Correo Argentino

Andreani

Promociones

Cupones

Gift Cards

Referidos

Programa de Puntos

Analytics

Campañas

Landing Pages

CMS

Blog

SEO

Archivos

Configuraciones

Integraciones

Logs

Backups

Auditoría

---

# Dashboard Ejecutivo

Al ingresar al panel se deberá visualizar un resumen completo del negocio.

Ejemplos:

Ventas del día.

Ventas del mes.

Productos más vendidos.

Clientes nuevos.

Clientes recurrentes.

Facturación.

Pedidos pendientes.

Pedidos enviados.

Pedidos entregados.

Stock crítico.

Embudo de ventas.

Conversión.

ROAS.

CAC.

LTV.

Ticket Promedio.

Todo configurable.

---

# Sistema de Productos

Cada producto deberá tener:

Nombre.

Slug.

Descripción.

Descripción corta.

Historia.

Ingredientes.

Información nutricional.

Graduación alcohólica.

Peso.

Dimensiones.

SKU.

Código interno.

Código de barras.

Precio.

Precio promocional.

Costo.

Margen.

Stock.

Stock reservado.

Stock mínimo.

Galería.

Videos.

Modelos 3D.

SEO.

Productos relacionados.

Cross Selling.

Upselling.

Estado.

Fecha de publicación.

Etiquetas.

Colecciones.

---

# Sistema de Pedidos

Cada pedido tendrá un ciclo completo.

Pendiente.

Pago pendiente.

Pago aprobado.

Preparando.

Empaquetado.

Etiqueta generada.

Despachado.

En camino.

Entregado.

Cancelado.

Devuelto.

Reembolsado.

Todo el historial deberá quedar registrado.

---

# Sistema de Clientes

Cada cliente tendrá una ficha completa.

Datos personales.

Direcciones.

Historial.

Pedidos.

Valor total comprado.

Frecuencia.

Última compra.

Segmento.

Referidos.

Puntos.

Cupones.

Preferencias.

Observaciones.

Nunca perder información histórica.

---

# Sistema de Logística

La logística será completamente modular.

Cada operador logístico será un proveedor independiente.

Ejemplos:

Correo Argentino.

Andreani.

Moto propia.

Cadetería externa.

Retiro en depósito.

Cada proveedor deberá implementar la misma interfaz para facilitar futuras integraciones.

---

# Sistema de Envíos

El sistema deberá poder:

Calcular costo.

Calcular tiempos.

Elegir proveedor.

Generar etiquetas.

Imprimir etiquetas.

Generar códigos de seguimiento.

Actualizar estados automáticamente.

Registrar incidencias.

Calcular envío gratis.

Calcular promociones.

---

# Sistema de Promociones

Debe permitir crear promociones sin necesidad de programar.

Ejemplos:

2x1.

3x2.

Happy Hour.

Cyber Monday.

Black Friday.

Cupón.

Descuento por cantidad.

Descuento por monto.

Envío gratis.

Promociones por cliente.

Promociones por ciudad.

Promociones por fecha.

Todo configurable.

---

# CMS

Todo el contenido del sitio deberá poder modificarse desde el panel.

No depender del programador.

Ejemplos:

Homepage.

Historia.

Nosotros.

FAQ.

Landing Pages.

Banners.

Promociones.

Footer.

Menús.

SEO.

---

# Analytics

Todo deberá medirse.

Cada clic.

Cada scroll.

Cada compra.

Cada formulario.

Cada abandono.

Cada búsqueda.

Cada filtro.

Cada banner.

Cada campaña.

No tomar decisiones sin datos.

---

# Integraciones

Toda integración deberá desarrollarse como un módulo independiente.

Ejemplos:

Mercado Pago.

Google Analytics.

Google Tag Manager.

Google Ads.

Search Console.

Meta Pixel.

TikTok Pixel.

Meta Conversions API.

Correo Argentino.

Andreani.

WhatsApp.

Email Marketing.

CRM.

ERP.

Facturación.

Cada integración deberá poder reemplazarse sin afectar el resto del sistema.

---

# API

Toda la plataforma deberá construirse API First.

El Frontend nunca deberá acceder directamente a la base de datos.

Toda comunicación deberá realizarse mediante servicios bien definidos.

Esto permitirá desarrollar:

Aplicaciones móviles.

Paneles externos.

Marketplace.

Distribuidores.

Integraciones futuras.

---

# Seguridad

Toda funcionalidad deberá considerar:

Autenticación.

Autorización.

Permisos.

Validaciones.

Logs.

Auditoría.

Backups.

Protección contra ataques.

Nunca confiar en datos enviados desde el cliente.

---

# Escalabilidad

La plataforma deberá soportar en el futuro:

Más productos.

Más usuarios.

Más países.

Más idiomas.

Más monedas.

Más operadores logísticos.

Más pasarelas de pago.

Más sucursales.

Más depósitos.

Más marcas.

Todo sin modificar la arquitectura principal.

---

# Regla Principal

Antes de desarrollar cualquier funcionalidad preguntarse:

¿Este módulo podrá seguir funcionando correctamente cuando BUBA multiplique por diez su tamaño?

Si la respuesta es no, debe replantearse el diseño.

---

# Checklist para Claude

Antes de comenzar cualquier módulo verificar:

✓ ¿Existe una responsabilidad clara?

✓ ¿Es reutilizable?

✓ ¿Es escalable?

✓ ¿Es desacoplado?

✓ ¿Puede configurarse desde el panel?

✓ ¿Está preparado para futuras integraciones?

✓ ¿Está documentado?

Si alguna respuesta es negativa, el diseño debe corregirse antes de comenzar a programar.