'use strict';

/**
 * Monitor de latencia multisitio y detector de picos simultáneos.
 *
 * Mide periódicamente TTFB (hasta las cabeceras) y tiempo total de varias webs alojadas en la
 * misma infraestructura. Un pico aislado en una web suele ser un problema de esa web; un pico
 * en muchas webs A LA VEZ apunta a la infraestructura compartida (servidor, red, base de datos,
 * o una web que se lleva los recursos de las demás). Es lo que este análisis separa.
 */

const { performance } = require('node:perf_hooks');

/** Una medición: { url, at, status, ttfbMs, totalMs, error } */
async function measure(url, { fetchImpl = fetch, timeoutMs = 30000, now = () => new Date() } = {}) {
  const at = now().toISOString();
  const start = performance.now();
  try {
    const res = await fetchImpl(url, {
      redirect: 'follow',
      headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'latency-monitor/1.0' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const ttfbMs = performance.now() - start;
    await res.arrayBuffer(); // descarga completa
    const totalMs = performance.now() - start;
    return { url, at, status: res.status, ttfbMs: Math.round(ttfbMs), totalMs: Math.round(totalMs), error: null };
  } catch (err) {
    return { url, at, status: 0, ttfbMs: null, totalMs: Math.round(performance.now() - start), error: err.name === 'TimeoutError' ? 'timeout' : err.message };
  }
}

/** Una ronda: todas las URLs a la vez, para que las mediciones sean comparables en el tiempo. */
function round(urls, opts) {
  return Promise.all(urls.map((u) => measure(u, opts)));
}

function percentile(values, p) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const idx = Math.min(v.length - 1, Math.max(0, Math.ceil((p / 100) * v.length) - 1));
  return v[idx];
}

/**
 * Analiza las mediciones:
 *  - por sitio: p50/p95 de TTFB y total, % de errores;
 *  - "incidentes compartidos": rondas (agrupadas por minuto) en las que al menos `minSites`
 *    webs superan a la vez su propia mediana × `factor`, o fallan.
 *
 * El umbral se basa en la mediana y no en el p95: con pocas muestras, los propios picos que se
 * quieren detectar inflan el p95 y lo vuelven ciego (lo detectó el test con dos picos en una web).
 */
function analyze(rows, { minSites = 3, factor = 3, bucketSeconds = 60 } = {}) {
  const bySite = new Map();
  for (const r of rows) {
    if (!bySite.has(r.url)) bySite.set(r.url, []);
    bySite.get(r.url).push(r);
  }

  const sites = [...bySite.entries()].map(([url, list]) => {
    const ok = list.filter((r) => !r.error && r.status && r.status < 500);
    return {
      url,
      samples: list.length,
      errorRate: +(1 - ok.length / list.length).toFixed(3),
      ttfbP50: percentile(ok.map((r) => r.ttfbMs), 50),
      ttfbP95: percentile(ok.map((r) => r.ttfbMs), 95),
      totalP50: percentile(ok.map((r) => r.totalMs), 50),
      totalP95: percentile(ok.map((r) => r.totalMs), 95),
    };
  });
  const thresholds = new Map(sites.map((s) => [s.url, s.totalP50 == null ? Infinity : s.totalP50 * factor]));

  const buckets = new Map();
  for (const r of rows) {
    const key = new Date(Math.floor(Date.parse(r.at) / (bucketSeconds * 1000)) * bucketSeconds * 1000).toISOString();
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(r);
  }
  const incidents = [];
  for (const [at, list] of [...buckets.entries()].sort()) {
    const affected = list.filter((r) => r.error || r.status >= 500 || r.totalMs > thresholds.get(r.url));
    const distinct = new Set(affected.map((r) => r.url));
    if (distinct.size >= minSites) {
      incidents.push({
        at,
        sites: [...distinct],
        worstMs: Math.max(...affected.map((r) => r.totalMs || 0)),
        errors: affected.filter((r) => r.error || r.status >= 500).length,
      });
    }
  }
  return { sites, incidents };
}

const CSV_HEADER = 'at,url,status,ttfb_ms,total_ms,error';

function toCsvLine(r) {
  const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [r.at, r.url, r.status, r.ttfbMs, r.totalMs, r.error].map(esc).join(',');
}

function parseCsv(text) {
  return String(text)
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"'));
      const [at, url, status, ttfb, total, error] = cells;
      return { at, url, status: Number(status), ttfbMs: ttfb === '' ? null : Number(ttfb), totalMs: Number(total), error: error || null };
    });
}

module.exports = { measure, round, analyze, percentile, CSV_HEADER, toCsvLine, parseCsv };
