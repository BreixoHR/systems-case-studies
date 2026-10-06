const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { measure, round, analyze, percentile, toCsvLine, parseCsv, CSV_HEADER } = require('./latency');

let server;
let base;
before(async () => {
  server = http.createServer((req, res) => {
    const delay = Number(new URL(req.url, 'http://x').searchParams.get('delay') || 0);
    const status = Number(new URL(req.url, 'http://x').searchParams.get('status') || 200);
    setTimeout(() => {
      res.writeHead(status, { 'Content-Type': 'text/html' });
      res.write('<html>'); // cabeceras + primer byte
      setTimeout(() => res.end('x'.repeat(50000) + '</html>'), 40); // el resto, más tarde
    }, delay);
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('measure distingue TTFB de tiempo total', async () => {
  const r = await measure(`${base}/?delay=60`);
  assert.equal(r.status, 200);
  assert.ok(r.ttfbMs >= 55, `ttfb ${r.ttfbMs}`);
  assert.ok(r.totalMs >= r.ttfbMs + 30, `total ${r.totalMs} vs ttfb ${r.ttfbMs}`);
  assert.equal(r.error, null);
});

test('measure registra timeouts y errores sin lanzar', async () => {
  const slow = await measure(`${base}/?delay=500`, { timeoutMs: 100 });
  assert.equal(slow.error, 'timeout');
  const down = await measure('http://127.0.0.1:1/');
  assert.ok(down.error);
});

test('round mide todas las webs en paralelo', async () => {
  const started = Date.now();
  const rs = await round([`${base}/?delay=100`, `${base}/?delay=100`, `${base}/?delay=100`]);
  assert.equal(rs.length, 3);
  assert.ok(Date.now() - started < 280, 'en paralelo, no en serie');
});

test('percentile', () => {
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50), 5);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95), 10);
  assert.equal(percentile([null, 3], 50), 3);
  assert.equal(percentile([], 50), null);
});

test('analyze separa picos aislados de incidentes compartidos', () => {
  const sites = ['https://a.example', 'https://b.example', 'https://c.example', 'https://d.example'];
  const rows = [];
  for (let minute = 0; minute < 30; minute++) {
    const at = new Date(Date.UTC(2026, 4, 1, 10, minute, 5)).toISOString();
    for (const url of sites) {
      let total = 300 + (minute % 3) * 20;
      if (minute === 12 && url === sites[0]) total = 5000; // pico aislado de una sola web
      if (minute === 20) total = 4000; // todas lentas a la vez: infraestructura
      rows.push({ at, url, status: 200, ttfbMs: total - 50, totalMs: total, error: null });
    }
  }
  rows.push({ at: new Date(Date.UTC(2026, 4, 1, 10, 25, 5)).toISOString(), url: sites[1], status: 0, ttfbMs: null, totalMs: 30000, error: 'timeout' });

  const { sites: stats, incidents } = analyze(rows, { minSites: 3 });
  assert.equal(stats.length, 4);
  assert.equal(stats.find((s) => s.url === sites[1]).errorRate, +(1 / 31).toFixed(3));
  assert.equal(incidents.length, 1, JSON.stringify(incidents));
  assert.equal(incidents[0].at, '2026-05-01T10:20:00.000Z');
  assert.equal(incidents[0].sites.length, 4);
});

test('CSV ida y vuelta', () => {
  const r = { at: '2026-05-01T10:00:00.000Z', url: 'https://a.example/?x=1,2', status: 200, ttfbMs: 120, totalMs: 340, error: null };
  const back = parseCsv(`${CSV_HEADER}\n${toCsvLine(r)}\n${toCsvLine({ ...r, ttfbMs: null, status: 0, error: 'fetch failed, "dns"' })}`);
  assert.deepEqual(back[0], r);
  assert.equal(back[1].error, 'fetch failed, "dns"');
  assert.equal(back[1].ttfbMs, null);
});
