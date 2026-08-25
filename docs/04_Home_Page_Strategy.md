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

Antes de escribir una sola línea de código:

Diseñar toda la experiencia.
Crear un storyboard completo.
Definir todas las escenas.
Definir la duración de cada animación.
Definir la posición de la cámara.
Definir las luces.
Definir los materiales.
Definir la física.
Definir la interacción con el usuario.
Optimizar la experiencia antes de comenzar a programar.

No comenzar a desarrollar hasta que exista un flujo completo aprobado.

Importante

La experiencia no debe parecer una demo de Three.js.

No debe parecer una plantilla.

No debe sentirse como una animación genérica.

Debe convertirse en la identidad visual de BUBA.

Cuando alguien vea esa introducción, debe reconocer inmediatamente que pertenece a BUBA DRINKS