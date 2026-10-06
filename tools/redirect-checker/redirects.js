'use strict';

/**
 * Validación de redirecciones SEO tras una migración de web.
 *
 * - Lee el mapa "URL antigua → URL nueva" de un .htaccess (Redirect / RedirectMatch 301) o de un CSV.
 * - Comprueba en vivo cada URL antigua: debe responder 301 (no 302: Google no transfiere igual la
 *   autoridad), en un solo salto (las cadenas pierden rendimiento y crawl budget), sin bucles, y
 *   terminar en la URL esperada con un 200.
 */

const MAX_HOPS = 10;

/** Extrae reglas de un .htaccess. Las RedirectMatch con regex se marcan como no comprobables literalmente. */
function parseHtaccess(text) {
  const rules = [];
  const lines = String(text).split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    let m = line.match(/^Redirect\s+(301|permanent)\s+(\S+)\s+(\S+)/i);
    if (m) {
      rules.push({ from: m[2], to: m[3], line: i + 1, type: 'Redirect' });
      return;
    }
    m = line.match(/^RedirectMatch\s+(301|permanent)\s+(\S+)\s+(\S+)/i);
    if (m) {
      const literal = regexToLiteralPath(m[2]);
      rules.push({ from: literal, to: m[3], line: i + 1, type: 'RedirectMatch', pattern: m[2], testable: literal !== null });
      return;
    }
    if (/^Redirect(Match)?\s+(302|temp)\b/i.test(line)) {
      rules.push({ line: i + 1, type: 'Temporary', raw: line, problem: 'redirección temporal (302) en una migración' });
    }
  });
  return rules;
}

/**
 * "^/tours/visita/?$" → "/tours/visita/". Solo para patrones "casi literales" (anclas, barra opcional,
 * puntos escapados). Si hay grupos o comodines devuelve null: no se puede probar con una sola URL.
 */
function regexToLiteralPath(pattern) {
  let p = pattern.replace(/^\^/, '').replace(/\$$/, '');
  p = p.replace(/\/\?$/, '/'); // barra final opcional → se prueba con barra
  p = p.replace(/\\\./g, '.').replace(/\\-/g, '-');
  if (/[()[\]*+?{}|\\^$]/.test(p)) return null;
  return p.startsWith('/') ? p : `/${p}`;
}

function parseCsv(text) {
  return String(text)
    .split(/\r?\n/)
    .map((l, i) => ({ l: l.trim(), i }))
    .filter(({ l }) => l && !l.startsWith('#') && !/^old\s*,/i.test(l))
    .map(({ l, i }) => {
      const [from, to] = l.split(',').map((s) => s.trim());
      return { from, to, line: i + 1, type: 'CSV' };
    });
}

/** Sigue la cadena de redirecciones manualmente para poder inspeccionar cada salto. */
async function trace(url, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  const hops = [];
  const seen = new Set();
  let current = url;
  for (let i = 0; i < MAX_HOPS; i++) {
    if (seen.has(current)) return { hops, loop: true };
    seen.add(current);
    const res = await fetchImpl(current, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    const location = res.headers.get('location');
    hops.push({ url: current, status: res.status, location });
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    return { hops, loop: false, final: current, finalStatus: res.status };
  }
  return { hops, loop: true };
}

function normalize(u) {
  const url = new URL(u);
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

/** Evalúa una regla contra el sitio. → { ok, problems[], hops } */
async function check(rule, baseUrl, opts) {
  if (rule.problem) return { rule, ok: false, problems: [rule.problem], hops: [] };
  if (rule.testable === false) return { rule, ok: null, problems: ['patrón con comodines: revisar manualmente'], hops: [] };

  const source = new URL(rule.from, baseUrl).toString();
  const expected = new URL(rule.to, baseUrl).toString();
  const problems = [];
  let result;
  try {
    result = await trace(source, opts);
  } catch (err) {
    return { rule, ok: false, problems: [`error de red: ${err.message}`], hops: [] };
  }
  const { hops } = result;

  if (result.loop) problems.push('bucle o demasiados saltos');
  if (!hops.length || hops[0].status < 300 || hops[0].status >= 400) {
    problems.push(`la URL antigua no redirige (HTTP ${hops[0]?.status})`);
  } else {
    if (hops[0].status !== 301 && hops[0].status !== 308) problems.push(`redirección ${hops[0].status}: debería ser 301`);
    const redirects = hops.filter((h) => h.status >= 300 && h.status < 400).length;
    if (redirects > 1) problems.push(`cadena de ${redirects} saltos: apuntar directamente al destino final`);
  }
  if (!result.loop) {
    if (normalize(result.final) !== normalize(expected)) problems.push(`termina en ${result.final} en lugar de ${expected}`);
    if (result.finalStatus !== 200) problems.push(`el destino responde ${result.finalStatus}`);
  }
  return { rule, ok: problems.length === 0, problems, hops };
}

async function checkAll(rules, baseUrl, { concurrency = 4, ...opts } = {}) {
  const results = new Array(rules.length);
  let next = 0;
  async function worker() {
    while (next < rules.length) {
      const i = next++;
      results[i] = await check(rules[i], baseUrl, opts);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, rules.length) }, worker));
  return results;
}

/** Reglas cuyo destino es a su vez el origen de otra regla (cadenas definidas en el propio fichero). */
function findChainsInRules(rules) {
  const sources = new Map(rules.filter((r) => r.from).map((r) => [r.from.replace(/\/$/, ''), r]));
  return rules
    .filter((r) => r.to)
    .map((r) => {
      let path;
      try {
        path = new URL(r.to, 'http://x').pathname.replace(/\/$/, '');
      } catch {
        return null;
      }
      const next = sources.get(path);
      return next && next !== r ? { rule: r, chainsTo: next } : null;
    })
    .filter(Boolean);
}

module.exports = { parseHtaccess, parseCsv, regexToLiteralPath, trace, check, checkAll, findChainsInRules };
