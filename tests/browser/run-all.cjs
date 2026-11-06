// Runs each walkthrough against a freshly started server.cjs (fresh seeded data), one at a time.
// Usage: node tests/browser/run-all.cjs [e2e-inventory.cjs ...]
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

const DIR = __dirname;
const ALL = ['e2e.cjs', 'e2e-collections.cjs', 'e2e-inventory.cjs', 'e2e-orders.cjs', 'e2e-promotions.cjs', 'e2e-settings.cjs', 'e2e-storefront.cjs'];
const PORT = 4317;

const portFree = () =>
  new Promise((resolve) => {
    const s = net.createServer().once('error', () => resolve(false)).once('listening', () => s.close(() => resolve(true)));
    s.listen(PORT);
  });

async function waitPortFree() {
  for (let i = 0; i < 50; i++) {
    if (await portFree()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`port ${PORT} still busy`);
}

function startServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [path.join(DIR, 'server.cjs')], { stdio: ['ignore', 'pipe', 'inherit'] });
    let buf = '';
    proc.stdout.on('data', (d) => {
      buf += d;
      if (buf.includes('HARNESS READY')) resolve(proc);
    });
    proc.on('exit', (code) => reject(new Error(`server exited early (${code})`)));
  });
}

function run(script) {
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, [path.join(DIR, script)], { stdio: 'inherit' });
    proc.on('exit', (code) => resolve(code));
  });
}

(async () => {
  const scripts = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
  const results = [];
  for (const script of scripts) {
    await waitPortFree();
    const server = await startServer();
    console.log(`\n===== ${script}`);
    const code = await run(script);
    server.removeAllListeners('exit');
    server.kill();
    results.push([script, code]);
  }
  console.log('\n===== Summary');
  for (const [s, c] of results) console.log(`${c === 0 ? 'PASS' : 'FAIL'}  ${s}`);
  process.exit(results.every(([, c]) => c === 0) ? 0 : 1);
})();
