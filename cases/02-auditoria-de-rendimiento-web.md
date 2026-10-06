# 02 · Auditoría de rendimiento de un portfolio de webs

**Contexto:** varias webs de venta de entradas alojadas en una infraestructura compartida empezaron a cargar lento de forma intermitente. Cada incidencia se trataba por separado ("la web X va lenta") y no había datos para encontrar la causa.

## Método

1. **Medición periódica y simultánea:** peticiones HTTP GET a todas las webs en la misma ronda, registrando el **TTFB** (tiempo hasta las cabeceras: servidor y aplicación) y el **tiempo total** (descarga completa).
2. **Comparación en el tiempo** de los tiempos de cada web frente a su comportamiento habitual.
3. **Correlación entre webs:** si el pico aparece en una sola web, el problema es de esa web; si aparece en varias a la vez, es de lo que comparten.

## Hallazgo

Los picos de latencia aparecían **en varias webs a la vez y en la misma franja horaria**. Eso descartaba problemas propios de cada web y apuntaba a:

- la configuración del servidor o la infraestructura compartida;
- la falta de optimización de la plataforma común;
- un pico de visitas en una web que se llevaba los recursos de las demás (fallo en cascada).

## Recomendaciones

- Revisar y ajustar la configuración del servidor compartido.
- Repartir las webs con más carga y las de menos carga entre recursos distintos.
- Monitorizar de forma continua para medir el efecto de cada cambio.

## Herramienta

La auditoría original se hizo con un script de Axios. La he rehecho como herramienta reutilizable en [`tools/latency-monitor`](../tools/latency-monitor):

```bash
node tools/latency-monitor/cli.js monitor --urls webs.txt --interval 60 --rounds 120 --out mediciones.csv
node tools/latency-monitor/cli.js analyze mediciones.csv --min-sites 3
```

- Mide TTFB y tiempo total de todas las webs **en paralelo**, para que las mediciones de una ronda sean comparables.
- Calcula para cada web el p50, el p95 y la tasa de errores.
- Detecta **incidentes compartidos**: minutos en los que al menos N webs superan a la vez **su propia mediana × 3**, o fallan.

> Un detalle que salió al escribir los tests: el primer umbral se basaba en el p95, y con pocas muestras los propios picos que se quieren detectar inflan el p95 y lo vuelven ciego. Basar el umbral en la mediana lo resuelve.
