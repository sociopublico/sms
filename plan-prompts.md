Como era un proyecto bastante grande y todo vibecodeado, fui haciendo un doc de prompts con todas las cosas que ibamos a tener que ir modificando (para no escribirlo todo directo en el chat) y tener un seguimiendo escrito de todas las modificaciones.

~~en los logs:~~

- ~~el log podria tener su fecha con formato de 24hs?~~ 
- ~~la tabla de los logs y su contenedor deberian ocupar como maximo 1080px de ancho~~
- ~~en los logs deberiamos guardar con un formato distinto los objetos, por ejemplo si la accion es un insert, el objeto a veces se ve raro, ponele en este insert timeline_week_tasks, veo lo siguiente:
{
"new": {
"task_id": "6c1770c7-84a2-51a4-8e7c-77047b1b13ad",
"timeline_week_id": "f6595173-6ab6-457f-9702-92d69db0656e"
},
"old": null
}
y debería quedar en un formato mas legible, por ejemplo con el nombre de la tarea y la fecha de la semana.~~
- ~~el header de los logs deberia ser sticky y tener el mismo formato que el resto de los headers de las tablas.~~

~~sobre los usuarios:~~

- ~~tengo que poder darle acceso solo de lectura a un usuario, por defecto se agregan con permisos de edicion y si trato de cambiar de edicion a solo lectura, se borra el usuario. Debería poder decidir con qué permisos agrego a un usuario (por defecto, cualquier usuario de @sociopublico.com puede sumarse con accesos de lectura)~~
- ~~que solo tengas que poner la primera parte del email, y que se entienda que el resto es @sociopublico.com, qye se vea digamos el @sociopublico.com al lado del email.~~

~~en la vista de proyectos:~~

- ~~las cards de cada proyecto pueden ser colapsables, que se pueda ver el nombre del proyecto y el cliente, y que se pueda expandir para ver los workstreams.~~

~~en la vista de nuevo workstream:~~

- ~~si se elige un proyecto existente, no deberia preguntar ni por nombre de proyecto, ni por cliente, ni por id ni ficha de proyecto~~
- ~~que los clientes tambien sean un select, y que se pueda crear un nuevo cliente desde el select.~~
- ~~la pantalla de editar un proyecto y de crear un nuevo workstream deberian tener el mismo formato que la pantalla de crear un nuevo proyecto.~~

~~en la vista de workload:~~

- ~~no hace falta esto de Workstreams por semana
0
2
4
6
8
con los colores, saquemoslo~~
- ~~podemos hacer que las pills de animacion, asistencia, contenido etc sean más chicas y se vean a la derecha del titulo y bajada? (como en otra columna)~~  
- ~~hagamos algo, cambiemos el codigo de color y pongamos un puntito celeste si la semana que viene se quedan sin tarea cargada, y puntito naranja si no tienen tarea esta semana tampoco~~
- ~~podemos poner los numeritos en bold y subirles 2px el tamaño de la fuente?~~
- ~~podemos hacer que la tabla tambien tenga solo 6 semanas en caso de que la pantalla sea más chica?~~

~~en la vista de timeline:~~

- ~~necesitaría cambiar lo siguiente: necesitaría que podamos tener no solo los workstreams sino tambien los proyectos, lo ideal seria que podamos tener cada proyecto (que sea colapsable) y adentro tener los workstreams y las tareas, y que se puedan abrir y cerrar.~~

~~en la navbar:~~ 

- ~~no hace falta que muestre "Edita" o "lector", directamente que no muestre nada al lado del nombre de usuario.~~
- ~~en vez del mail, pongamos el nombre/apodo.~~
- ~~en el menu, organicemos mejor las opciones:~~ 
  - ~~que haya un item "proyectos", que tenga las opciones: lista de proyectos (el actual proyectos) y crear nuevo proyecto~~
  - ~~que haya un item "timeline" que tenga el timeline~~
  - ~~que haya una opción "personas", que tenga las opciones personas, workload, tareas, roles~~
  - ~~que haya una opción "admin" que tenga los items: usuarios, logs~~

~~Workstream y project deberian ser cosas distintas~~
  - ~~En lista de proyectos: Nuevo proyecto → formulario de proyecto. En esta instancia no se crea un workstream~~
  - ~~En ficha de proyecto: Nuevo workstream → solo nombre, proyecto ya fijado.~~
  - ~~Alinear el nav con eso (hoy dice “Crear nuevo proyecto” y aterriza en copy de workstream).~~
  - ~~Me gustaría también que si hay un proyecto que aún no tiene workstream lo marquemos de alguna manera, podemos agregar un cta directo que sea Agregar workstream~~

~~En la vista cada proyecto agregar datos de la ficha de KIKE~~
  - ~~modifiquemos primero la DB de los proyectos y luego cambiaremos la UI. Necesito que en los proyectos agreguemos los siguientes datos: Partner, Fecha firma del contrato, Link a la propuesta, carpeta General del proyecto, Duración prevista, Fehca de comienzo (kickoff), Fecha de finalización, Agenda de pagos, Punto de Cobro. Toda la anterior es data que estaba en la ficha de proyecto de Kike~~

~~En la vista de proyectos:~~
  - ~~Poder tener filtros de tiene ficha proyectos o no y tiene label de horas o no (el label de horas relaciona el nombre que tiene en la hoja de horas o en los csvs con el nombre que tiene en la lista de proyectos!)~~
  - ~~Creo que no hace falta vistas abrir todos cerrar todos~~

Pendientes:

- La ficha de proyecto y el nomenclador deberían estar en el mismo lugar
- Que cosas deberian ver las PMs? Que cosas los admins? filtrar un poco ahí, tambien pensar tres tipos de usuarios (solo lectura, pms, admins)

- En los workstreams:
  - Deberíamos tener entregables y que las pms puedan configurar fecha estimada y fecha real de entrega, y que en la lista de proyectos aparezcan los entregables y si ya se entregaron o no
    - Re mil a futuro: notificaciones para kike o entregables nuevos o algo asi
  - En form de workstream medio feo como esta configurado el equipo (donde dice Jose PM y la card que dice elegir persona y elegir rol), cambiar el layout, quizas una tabla tambien para que una persona pueda tener varios roles y elegirlos todos en el momento, que se parezca más a una tabla y sea mas dinamico
- En la vista de timeline:
  - Marcar el inicio y el fin del proyecto como está pautado de alguna manera en la vista de timeline, y tambien si puede ser la fecha estimada de los entregables

Ideas: 

- Extensión o algo de Toggle que traiga automáticamente las horas? 

