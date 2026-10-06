const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { parseHtaccess, parseCsv, regexToLiteralPath, checkAll, findChainsInRules } = require('./redirects');

// Web simulada tras la migración, con aciertos y los errores típicos
const ROUTES = {
  '/tours/visita-guiada/': [301, '/tour/visita-guiada/'],
  '/tours/flamenco/': [302, '/tour/flamenco/'], // temporal
  '/tours/antiguo/': [301, '/tours/intermedio/'], // cadena
  '/tours/intermedio/': [301, '/tour/final/'],
  '/tours/bucle-a/': [301, '/tours/bucle-b/'],
  '/tours/bucle-b/': [301, '/tours/bucle-a/'],
  '/tours/roto/': [301, '/tour/no-existe/'],
  '/tours/equivocado/': [301, '/tour/otro/'],
};
const PAGES = new Set(['/tour/visita-guiada/', '/tour/flamenco/', '/tour/final/', '/tour/otro/', '/tour/esperado/']);

let server;
let base;
before(async () => {
  server = http.createServer((req, res) => {
    const r = ROUTES[req.url];
    if (r) {
      res.writeHead(r[0], { Location: r[1] });
      return res.end();
    }
    res.writeHead(PAGES.has(req.url) ? 200 : 404);
    res.end();
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const HTACCESS = `# Migración web vieja → nueva
Redirect 301 /tours/visita-guiada/ /tour/visita-guiada/
RedirectMatch 301 ^/tours/flamenco/?$ /tour/flamenco/
RedirectMatch 301 ^/blog/(.*)$ /noticias/$1
Redirect 302 /temporal/ /otra/
Redirect permanent /tours/antiguo/ /tour/final/
`;

test('parseHtaccess: Redirect, RedirectMatch literal, regex con grupos y temporales', () => {
  const rules = parseHtaccess(HTACCESS);
  assert.equal(rules.length, 5);
  assert.deepEqual(rules[0], { from: '/tours/visita-guiada/', to: '/tour/visita-guiada/', line: 2, type: 'Redirect' });
  assert.equal(rules[1].from, '/tours/flamenco/');
  assert.equal(rules[1].testable, true);
  assert.equal(rules[2].testable, false, 'los grupos no se pueden probar con una URL');
  assert.match(rules[3].problem, /302/);
  assert.equal(rules[4].from, '/tours/antiguo/');
});

test('regexToLiteralPath', () => {
  assert.equal(regexToLiteralPath('^/a/b/?$'), '/a/b/');
  assert.equal(regexToLiteralPath('^/fichero\\.html$'), '/fichero.html');
  assert.equal(regexToLiteralPath('^/blog/(.*)$'), null);
});

test('parseCsv ignora cabecera y comentarios', () => {
  assert.deepEqual(parseCsv('old,new\n# x\n/a/,/b/\n'), [{ from: '/a/', to: '/b/', line: 3, type: 'CSV' }]);
});

test('checkAll detecta cada tipo de problema', async () => {
  const rules = [
    { from: '/tours/visita-guiada/', to: '/tour/visita-guiada/', line: 1 },
    { from: '/tours/flamenco/', to: '/tour/flamenco/', line: 2 },
    { from: '/tours/antiguo/', to: '/tour/final/', line: 3 },
    { from: '/tours/bucle-a/', to: '/tour/x/', line: 4 },
    { from: '/tours/roto/', to: '/tour/no-existe/', line: 5 },
    { from: '/tours/equivocado/', to: '/tour/esperado/', line: 6 },
    { from: '/tour/flamenco/', to: '/tour/flamenco-nuevo/', line: 7 }, // la antigua no redirige
  ];
  const r = await checkAll(rules, base);
  const problems = (i) => r[i].problems.join(' | ');

  assert.equal(r[0].ok, true, problems(0));
  assert.match(problems(1), /302: debería ser 301/);
  assert.match(problems(2), /cadena de 2 saltos/);
  assert.equal(r[2].ok, false);
  assert.match(problems(3), /bucle/);
  assert.match(problems(4), /destino responde 404/);
  assert.match(problems(5), /termina en .*\/tour\/otro\/ en lugar de/);
  assert.match(problems(6), /no redirige \(HTTP 200\)/);
});

test('findChainsInRules: cadenas definidas en el propio .htaccess', () => {
  const rules = [
    { from: '/a/', to: '/b/', line: 1 },
    { from: '/b/', to: '/c/', line: 2 },
    { from: '/x/', to: 'https://www.example.com/y/', line: 3 },
  ];
  const chains = findChainsInRules(rules);
  assert.equal(chains.length, 1);
  assert.equal(chains[0].rule.line, 1);
  assert.equal(chains[0].chainsTo.line, 2);
});
