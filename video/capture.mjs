import {chromium} from 'playwright';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const base = (process.env.SIGNALFORGE_BASE || 'https://signalforge.faadil-casecraft.workers.dev').replace(/\/$/, '');
const outDir = path.resolve('public/captures');

await mkdir(outDir, {recursive: true});

const browser = await chromium.launch({headless: true});
const page = await browser.newPage({
  viewport: {width: 1600, height: 1000},
  deviceScaleFactor: 1,
});

const targets = [
  ['home', '/'],
  ['dashboard', '/dashboard'],
  ['token', '/token'],
  ['playground', '/playground'],
];

for (const [name, pathname] of targets) {
  const url = `${base}${pathname}`;
  console.log(`Capturing ${url}`);
  await page.goto(url, {waitUntil: 'networkidle', timeout: 60000});
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: path.join(outDir, `${name}.png`),
    fullPage: false,
  });
}

const health = await fetch(`${base}/health`).then((r) => {
  if (!r.ok) throw new Error(`/health returned ${r.status}`);
  return r.json();
});

const xagent = await fetch(`${base}/.well-known/xagent-verification.json`).then((r) => {
  if (!r.ok) throw new Error(`X-Agent verification returned ${r.status}`);
  return r.json();
});

if (health.commit !== xagent.commit) {
  throw new Error(`Runtime binding mismatch: health=${health.commit} xagent=${xagent.commit}`);
}

await writeFile(
  path.join(outDir, 'runtime-proof.json'),
  `${JSON.stringify({captured_at: new Date().toISOString(), health, xagent}, null, 2)}\n`,
  'utf8',
);

await browser.close();

console.log(`Captured product surfaces in ${outDir}`);
console.log(`Bound runtime commit: ${health.commit}`);
