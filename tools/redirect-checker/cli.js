#!/usr/bin/env node
'use strict';

/**
 *   node cli.js --base https://www.example.com --htaccess ./.htaccess
 *   node cli.js --base https://www.example.com --csv ./redirects.csv [--json]
 *
 * Sale con código 1 si alguna redirección falla (útil en CI tras desplegar el .htaccess).
 */
const fs = require('node:fs');
const { parseHtaccess, parseCsv, checkAll, findChainsInRules } = require('./redirects');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const base = arg('base');
  const file = arg('htaccess') || arg('csv');
  if (!base || !file) {
    console.error('Uso: node cli.js --base <url> (--htaccess <fichero> | --csv <fichero>) [--json]');
    process.exit(2);
  }
  const text = fs.readFileSync(file, 'utf8');
  const rules = arg('htaccess') ? parseHtaccess(text) : parseCsv(text);

  for (const c of findChainsInRules(rules)) {
    console.warn(`⚠ línea ${c.rule.line}: ${c.rule.from} → ${c.rule.to}, que a su vez redirige (línea ${c.chainsTo.line})`);
  }

  const results = await checkAll(rules, base);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const r of results) {
      const mark = r.ok === true ? '✔' : r.ok === null ? '?' : '✖';
      const label = r.rule.from ? `${r.rule.from} → ${r.rule.to}` : r.rule.raw;
      console.log(`${mark} [línea ${r.rule.line}] ${label}${r.problems.length ? '\n    ' + r.problems.join('\n    ') : ''}`);
    }
  }
  const failed = results.filter((r) => r.ok === false).length;
  const manual = results.filter((r) => r.ok === null).length;
  console.log(`\n${results.length} reglas · ${results.length - failed - manual} correctas · ${failed} con problemas · ${manual} a revisar a mano`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main();
