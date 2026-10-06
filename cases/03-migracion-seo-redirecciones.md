# 03 · Migración SEO: de la web antigua a la nueva sin perder posicionamiento

**Contexto:** se migró la web principal de tours a una nueva estructura de URLs (`/tours/…` pasó a `/tour/…`, con slugs renombrados). Cada URL antigua indexada en Google tenía que redirigir con un **301** a su equivalente nueva, o el posicionamiento y los enlaces entrantes se perderían.

## Procedimiento definido

1. **Backup antes de tocar nada:** se descarga el `.htaccess` directamente del servidor (por SFTP) y se guarda una copia base **también en el servidor**. Siempre se trabaja sobre una copia de esa base, nunca sobre el original.
2. **Dos tipos de regla**, con `RedirectMatch` como mecanismo principal:
   ```apache
   Redirect 301 /tours/visita-guiada-parque/ https://www.example.com/tour/visita-guiada-parque/
   RedirectMatch 301 ^/tours/espectaculo-flamenco/?$ https://www.example.com/tour/espectaculo-flamenco/
   ```
   `RedirectMatch` con `/?$` cubre la URL con barra final y sin ella en una sola regla.
3. **Carga:** se sustituye el `.htaccess` del servidor por el nuevo, con las credenciales guardadas en el gestor de sitios y en el almacén de credenciales.

## Lo que faltaba: comprobar que funciona

El procedimiento garantizaba que el fichero se podía revertir, pero no que las redirecciones funcionasen. Los errores típicos de una migración pasan desapercibidos durante semanas:

| Error | Efecto |
|---|---|
| `302` en lugar de `301` | Google no transfiere igual la autoridad de la URL antigua |
| Cadenas (A → B → C) | Más latencia y menos presupuesto de rastreo; cada salto resta |
| Bucles | La URL deja de funcionar |
| Destino que da 404 | Se pierde la página |
| Destino equivocado | La URL acaba en otra página |

He construido [`tools/redirect-checker`](../tools/redirect-checker) para cerrar ese hueco:

```bash
node tools/redirect-checker/cli.js --base https://www.example.com --htaccess .htaccess
```

- Lee las reglas del propio `.htaccess`: `Redirect` y `RedirectMatch` casi literales. Las que tienen comodines las marca para revisión manual.
- Avisa de las **cadenas definidas dentro del propio fichero** antes de desplegar.
- Recorre en vivo cada redirección **salto a salto** y comprueba el código, el número de saltos, los bucles, el destino final y que este responda 200.
- Sale con código 1 si algo falla, así que se puede añadir a la checklist de despliegue o a CI.
