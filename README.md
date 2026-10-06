# Systems Case Studies

Casos reales de **sistemas, infraestructura y arquitectura** de una agencia de turismo con decenas de webs de venta: contingencia, rendimiento, migraciones, QA de integraciones, red, sala de servidores y analítica.

Para cada caso se cuenta el problema, la decisión que se tomó y su motivo, y lo que haría distinto hoy. Dos de ellos incluyen una **herramienta funcional y testeada**.

![tests](https://img.shields.io/badge/tools-11%20tests-brightgreen) ![node](https://img.shields.io/badge/node-%E2%89%A518-339933) ![license](https://img.shields.io/badge/license-MIT-blue)

| # | Caso | Área | Herramienta |
|---|---|---|---|
| 01 | [Máquina de contingencia para un WordPress Multisite en Oracle Cloud](cases/01-maquina-de-contingencia.md) | Continuidad de negocio | |
| 02 | [Auditoría de rendimiento de un portfolio de webs](cases/02-auditoria-de-rendimiento-web.md) | Rendimiento | [`latency-monitor`](tools/latency-monitor) |
| 03 | [Migración SEO con redirecciones 301](cases/03-migracion-seo-redirecciones.md) | Web / SEO | [`redirect-checker`](tools/redirect-checker) |
| 04 | [Protocolo de pruebas de extremo a extremo: 5 motores de reserva → Salesforce](cases/04-protocolo-pruebas-integraciones.md) | QA de integraciones | |
| 05 | [Documentación y diagnóstico de la red de oficina](cases/05-red-de-oficina.md) | Redes | |
| 06 | [Dimensionamiento de una sala de servidores](cases/06-sala-de-servidores.md) | Hardware / eléctrico | |
| 07 | [Google Tag Gateway con CloudFront](cases/07-google-tag-gateway.md) | Analítica / CDN | |
| 08 | [Archivado de ficheros de Salesforce y recuperación](cases/08-archivado-de-ficheros-salesforce.md) | Costes / datos | |
| 09 | [Arquitectura: revisiones automáticas de reservas, antes y después de la compra](cases/09-revisiones-automaticas-de-reservas.md) | Arquitectura | |
| 10 | [Arquitectura: entrega y recuperación de entradas](cases/10-entrega-y-recuperacion-de-entradas.md) | Arquitectura | |
| 11 | [Diseño: plataforma multitenant para las webs del grupo](cases/11-plataforma-multitenant-de-landings.md) | Arquitectura | |

## Herramientas

### `latency-monitor`

Mide el TTFB y el tiempo total de varias webs en paralelo y detecta los **incidentes compartidos**: minutos en los que al menos N webs van lentas o fallan a la vez, lo que apunta a la infraestructura común y no a una web concreta.

```bash
node tools/latency-monitor/cli.js monitor --urls webs.txt --interval 60 --rounds 120 --out mediciones.csv
node tools/latency-monitor/cli.js analyze mediciones.csv --min-sites 3
```

### `redirect-checker`

Valida en vivo las redirecciones de un `.htaccess` (o de un CSV) y detecta:

- redirecciones 302 en lugar de 301;
- cadenas y bucles;
- destinos que dan 404 o que apuntan a una URL equivocada;
- cadenas definidas en el propio fichero.

Sale con código 1 si algo falla.

```bash
node tools/redirect-checker/cli.js --base https://www.example.com --htaccess .htaccess
```

Ninguna de las dos tiene dependencias. Los tests levantan servidores HTTP locales que simulan cada caso:

```bash
npm test
```

## Licencia

[MIT](LICENSE)
