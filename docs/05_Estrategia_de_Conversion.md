Experiencia Principal de la Home (Signature Experience)
Objetivo

No quiero que el usuario entre a una tienda online.

Quiero que entre a una experiencia.

La primera interacción con la marca debe ser memorable y diferente a cualquier otra tienda de bebidas.

El objetivo no es mostrar el producto inmediatamente.

El objetivo es generar curiosidad, sorprender al usuario y contar la historia del producto de una forma visual.

Si una persona recuerda la animación días después de haber visitado la web, entonces la experiencia cumplió su objetivo.

Concepto

En lugar de mostrar directamente una BUBA terminada, quiero que el usuario vea cómo "nace" la bebida.

Cada sabor contará su propia historia utilizando ingredientes reales, simulaciones de líquidos y animaciones 3D.

Debe sentirse como una mezcla entre una publicidad de Apple, un comercial de perfumes premium y una experiencia interactiva moderna.

Todo debe desarrollarse en tiempo real, evitando videos pre-renderizados siempre que sea posible.

Flujo de la experiencia
Escena 1

El usuario entra a la Home.

No aparece ninguna lata.

No aparece ningún botón gigante.

En el centro de la pantalla existe una única fruta flotando.

Ejemplo:

Blueberry Limeade

Una uva hiperrealista.

Ultra HD.

Con materiales PBR.

Con gotas de agua.

Con iluminación cinematográfica.

Con profundidad.

Debe sentirse completamente real.

Escena 2

La fruta responde al usuario.

Cuando mueve el mouse:

gira lentamente
cambia la iluminación
responde con inercia
proyecta sombras reales

Cuando hace scroll:

la cámara comienza a acercarse lentamente.

Escena 3

Comienza la transformación.

Otra fruta aparece.

Por ejemplo una lima.

Las dos frutas comienzan a girar alrededor de un mismo eje.

No deben chocar.

Todo debe sentirse natural.

Escena 4

Las frutas empiezan a desintegrarse.

No explotan.

Se transforman lentamente en pequeñas partículas.

Las partículas se convierten en líquido.

Ese líquido conserva el color característico del sabor.

Debe verse extremadamente realista.

Escena 5

El líquido comienza a girar.

Se forma un remolino.

El remolino crea una esfera transparente.

La esfera representa el envase de BUBA.

Todavía no existe ninguna etiqueta.

Escena 6

La esfera comienza a cerrarse.

Se forman automáticamente:

la tapa
el envase
el contenido

Todo mediante animaciones.

No debe aparecer de golpe.

Debe construirse frente al usuario.

Escena 7

Aparece lentamente la etiqueta.

La etiqueta rodea la esfera.

Debe sentirse como si estuviera colocándose automáticamente.

No simplemente aparecer.

Escena 8

La iluminación cambia.

La cámara gira.

Ahora sí aparece la BUBA completamente terminada.

En ese momento aparece el botón:

Comprar ahora.

Objetivo emocional

El usuario debe sentir que acaba de presenciar algo diferente.

No solamente una animación.

Una experiencia.

Interacción

Todo debe responder al usuario.

Mouse.

Scroll.

Touch.

Gyroscope.

No queremos una experiencia pasiva.

Queremos una experiencia viva.

Performance

La experiencia debe ser extremadamente fluida.

Objetivo:

60 FPS estables.

Nunca sacrificar rendimiento por calidad visual.

Si alguna simulación afecta el rendimiento deberá simplificarse.

Tecnología recomendada

Utilizar:

React Three Fiber
Three.js
GSAP
Framer Motion
React Spring
HDR Environment
PBR Materials
Post Processing moderado
Shader Materials cuando aporten valor
Instanced Meshes para partículas
Lazy Loading de recursos 3D
Compresión Draco para modelos GLTF
Texturas comprimidas (KTX2/Basis) para reducir peso

No utilizar videos para esta experiencia salvo que sea absolutamente necesario.

Escalabilidad

La experiencia debe construirse de forma modular.

Cada sabor debe tener su propio archivo de configuración.

Ejemplo:

Blueberry Limeade

fruta principal
fruta secundaria
color del líquido
partículas
iluminación
animaciones
sonidos futuros

Golden Peach

durazno
color naranja
configuración independiente

Pink Lemonade

limón
frutos rojos
configuración independiente

De esta manera agregar un nuevo sabor únicamente requerirá crear una nueva configuración.

Modo simplificado

No todos los dispositivos podrán renderizar una experiencia tan compleja.

Antes de iniciar la experiencia deberá detectarse automáticamente:

potencia del dispositivo
memoria disponible
GPU
navegador
FPS estimados

Si el dispositivo no alcanza el rendimiento esperado, cargar automáticamente una versión optimizada.

El usuario nunca deberá notar el cambio.

Reglas para Claude

BUBA DRINKS
Estrategia de Conversión (Conversion Strategy)
Objetivo

El objetivo principal de la plataforma no es mostrar productos.

El objetivo principal es convertir visitantes en clientes.

Cada decisión de diseño, programación, contenido y experiencia debe aumentar la probabilidad de compra.

Si una funcionalidad no ayuda al usuario o no mejora la conversión, deberá replantearse.

Filosofía

La mejor experiencia de usuario es aquella que permite comprar sin pensar.

El usuario nunca debe sentirse perdido.

Nunca debe buscar información.

Nunca debe preguntarse qué hacer.

Todo debe ser intuitivo.

Embudo de Conversión

Toda la web debe seguir este recorrido:

Captar la atención.
Generar curiosidad.
Explicar rápidamente el producto.
Generar confianza.
Mostrar prueba social.
Eliminar objeciones.
Facilitar la compra.
Incentivar la recompra.

Cada sección de la Home debe responder a una de estas etapas.

Los primeros 5 segundos

En menos de cinco segundos el usuario debe responder mentalmente estas preguntas:

¿Qué vende BUBA?
¿Por qué es diferente?
¿Por qué debería probarla?
¿Dónde la compro?

Si alguna de estas respuestas no queda clara, la Home debe rediseñarse.

Menos clics = Más ventas

Reducir siempre la cantidad de pasos.

Objetivo:

Agregar al carrito en un clic.
Comprar en menos de un minuto.
Checkout simple.
Formularios mínimos.
Confianza antes que precio

El usuario debe confiar antes de comparar precios.

Por eso la Home debe mostrar rápidamente:

Historia de la marca.
Calidad del producto.
Packaging.
Opiniones reales.
Métodos de pago.
Métodos de envío.
Seguridad.
Mostrar el producto rápidamente

Aunque exista una experiencia interactiva inicial, el producto real debe aparecer muy pronto.

No ocultar el producto durante demasiado tiempo.

La experiencia nunca debe perjudicar las ventas.

Explicar el producto visualmente

Las personas no leen.

Observan.

Siempre explicar utilizando:

imágenes
videos
renders
animaciones
íconos

Reducir el texto al mínimo necesario.

Comprar desde cualquier parte

El usuario debe poder comprar desde cualquier sección importante.

Siempre debe existir un camino rápido hacia la compra.

Propuesta de valor

En pocos segundos debe entenderse:

Cocktail listo para tomar.
Envase esférico único.
Alta graduación alcohólica.
Sabores frutales.
Ideal para compartir.
Eliminar objeciones

Antes de comprar, el usuario puede preguntarse:

¿Será rico?
¿Tiene mucho azúcar?
¿Es fuerte?
¿Cómo llega el pedido?
¿Cuánto tarda?
¿Es seguro pagar?
¿Qué dicen otras personas?

La web debe responder estas preguntas antes de que el usuario tenga que buscarlas.

Prueba social

Siempre mostrar evidencia real.

Ejemplos:

Clientes.
Videos.
TikToks.
Instagram.
Eventos.
Fotos reales.

No utilizar testimonios inventados.

Escasez

Utilizar escasez únicamente cuando sea real.

Nunca crear urgencias falsas.

Ejemplos válidos:

Últimas unidades.
Edición limitada.
Nuevo sabor.
Lanzamiento.
Upselling

Durante la compra mostrar opciones relevantes.

Ejemplos:

Agregar otra unidad.
Pack de cuatro.
Pack personalizado.
Edición limitada.

Nunca interrumpir la compra.

Cross Selling

Relacionar productos.

Ejemplos:

Merchandising.
Vasos.
Conservadoras.
Stickers.
Accesorios.

Preparar la arquitectura aunque todavía no existan.

Recompra

La venta no termina cuando el usuario paga.

Preparar la plataforma para:

Emails.
WhatsApp.
Descuentos.
Fidelización.
Referidos.
Puntos.
Psicología del color

Los colores deben acompañar la navegación.

Cada sabor podrá modificar sutilmente la experiencia visual.

Nunca utilizar colores agresivos.

Psicología del movimiento

Toda animación debe dirigir la atención.

Nunca distraer.

Nunca competir con el contenido.

Errores

Cuando exista un error:

Explicar claramente qué ocurrió.
Explicar cómo solucionarlo.
Nunca culpar al usuario.
Objetivo del Checkout

El checkout tiene un único objetivo:

Finalizar la compra.

Eliminar cualquier elemento que pueda distraer.

Objetivo del Panel

El panel administrativo tiene otro objetivo:

Reducir el tiempo operativo.

Cada tarea administrativa debe requerir la menor cantidad posible de clics.

Indicadores de éxito

La plataforma deberá medir automáticamente:

Conversión.
Abandono de carrito.
Tiempo hasta la compra.
Productos más vendidos.
Embudo de conversión.
Valor promedio del pedido.
Clientes nuevos.
Clientes recurrentes.
Regla de Oro

Antes de agregar cualquier nueva funcionalidad preguntarse:

¿Esta funcionalidad aumenta la probabilidad de que el usuario compre o mejore la operación del negocio?

Si la respuesta es no, no debería desarrollarse en esta etapa.

Reglas para Claude

Antes de diseñar cualquier pantalla:

Definir cuál es el objetivo de esa pantalla.
Identificar qué acción queremos que realice el usuario.
Reducir la cantidad de decisiones que debe tomar.
Diseñar el recorrido visual de arriba hacia abajo.
Validar que cada elemento tenga un propósito.

Nunca diseñar una pantalla únicamente porque "se ve linda".

Definición de éxito

La web será considerada exitosa cuando:

El usuario entienda el producto en segundos.
Comprar sea extremadamente simple.
La experiencia sea memorable.
El diseño transmita una marca internacional.
La plataforma convierta visitantes en clientes con la menor fricción posible.