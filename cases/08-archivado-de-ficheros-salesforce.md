# 08 · Archivado de ficheros de Salesforce y procedimiento de recuperación

**Contexto:** cada reserva guarda en Salesforce sus entradas en PDF. Con miles de reservas al mes, el **almacenamiento de ficheros** de Salesforce (caro y limitado por licencia) se iba a agotar. Pero las entradas de reservas pasadas siguen haciendo falta de vez en cuando: reclamaciones, devoluciones o un cliente que las ha perdido.

## Solución

- **Script de archivado** en una instancia propia de AWS que:
  1. extrae los ficheros de las reservas cuya **fecha de actividad pasó hace más de 15 días**;
  2. los guarda en una unidad compartida, **organizados por día de ejecución**, junto con un JSON de relaciones (reserva ↔ documento ↔ ticket);
  3. los borra de Salesforce.
- **Criterio de borrado** sencillo y explicable: *fecha de comienzo del evento > 15 días antes de hoy*. Pasada la actividad y el plazo habitual de incidencias, la entrada ya no hace falta en el día a día.

## Procedimiento de recuperación (para operaciones)

Escrito para que cualquier persona de atención al cliente pueda recuperar una entrada sin pedir ayuda a sistemas:

1. En la carpeta raíz, ordenar por **última modificación**.
2. Buscar la **primera carpeta de copia posterior** a la fecha de la actividad. Las carpetas son los días en que se ejecutó el archivado, así que una entrada del día X está en la primera ejecución posterior a X + 15.
3. En `ContentDocumentLink_Booking`, localizar la reserva por su localizador.
4. Con el JSON de relaciones, obtener el documento correspondiente.
5. Buscar el PDF con Ctrl+F en la carpeta de entradas.

## Valoración

**Lo que funciona:**
- reduce un coste que crece de forma lineal;
- el criterio es predecible;
- operaciones puede recuperar entradas sin depender de sistemas.

**Lo que mejoraría hoy:**

| Hoy | Mejora |
|---|---|
| Recuperar exige navegar carpetas y un JSON | Un índice (CSV o una pequeña búsqueda) de localizador → ruta del fichero |
| El borrado depende de que el archivado haya terminado bien | Verificar antes de borrar: el fichero existe en destino y su hash coincide |
| La unidad compartida es un único destino | Ciclo de vida a almacenamiento frío (S3 Glacier o similar) con retención definida por obligaciones legales |
