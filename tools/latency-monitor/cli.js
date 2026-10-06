#!/usr/bin/env node
'use strict';

/**
 *   node cli.js monitor --urls urls.txt --interval 60 --rounds 120 --out mediciones.csv
 *   node cli.js analyze mediciones.csv [--min-sites 3]
 */
const fs = require('node:fs');
const { round, analyze, CSV_HEADER, toCsvLine, parseCsv } = require('./latency');

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? def : process.argv[i + 1];
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function monitor() {
  const urls = fs.readFileSync(arg('urls'), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
  const out = arg('out', 'mediciones.csv');
  const intervalMs = Number(arg('interval', 60)) * 1000;
  const rounds = Number(arg('rounds', 60));
  if (!fs.existsSync(out)) fs.writeFileSync(out, CSV_HEADER + '\n');

  for (let i = 0; i < rounds; i++) {
    const started = Date.now();
    const results = await round(urls);
    fs.appendFileSync(out, results.map(toCsvLine).join('\n') + '\n');
    const slow = results.filter((r) => r.error || r.totalMs > 3000).length;
    console.log(`${new Date().toISOString()} ronda ${i + 1}/${rounds} · ${results.length} webs · ${slow} lentas o con error`);
    if (i < rounds - 1) await sleep(Math.max(0, intervalMs - (Date.now() - started)));
  }
}

function report() {
  const rows = parseCsv(fs.readFileSync(process.argv[3], 'utf8'));
  const { sites, incidents } = analyze(rows, { minSites: Number(arg('min-sites', 3)) });
  console.log('Por sitio (ms):');
  console.table(sites.sort((a, b) => (b.totalP95 ?? 0) - (a.totalP95 ?? 0)));
  console.log(`\nIncidentes compartidos (≥ ${arg('min-sites', 3)} webs a la vez): ${incidents.length}`);
  for (const inc of incidents) console.log(`  ${inc.at}  ${inc.sites.length} webs · peor ${inc.worstMs} ms · ${inc.errors} errores`);
}

const cmd = process.argv[2];
if (cmd === 'monitor') monitor();
else if (cmd === 'analyze') report();
else console.error('Uso: node cli.js monitor --urls <fichero> [--interval s] [--rounds n] [--out csv] | analyze <csv>');
