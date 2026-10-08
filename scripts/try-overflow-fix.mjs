/**
 * Applies candidate CSS overrides one at a time and reports whether each one
 * stops the window from scrolling sideways, and what it costs the inner
 * scroller (which must keep scrolling, since the table is legitimately wider
 * than its column).
 *
 * Usage: node scripts/try-overflow-fix.mjs <url> <width> <height>
 */
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const [url = 'http://localhost:5173/tracker', width = '1920', height = '900'] =
  process.argv.slice(2);
const PORT = 9400 + Math.floor(Math.random() * 500);
const PROFILE = `/tmp/chrome-measure-${PORT}`;

const CANDIDATES = [
  ['baseline (no override)', ''],
  ['sticky cells -> static', 'th.sticky, td.sticky { position: static !important; }'],
  ['sticky th only -> static', 'th.sticky { position: static !important; }'],
  ['sticky td only -> static', 'td.sticky { position: static !important; }'],
  ['border-collapse -> separate', 'table { border-collapse: separate !important; border-spacing: 0 !important; }'],
  ['header button -> block', 'thead button { display: block !important; }'],
  ['scroller: contain paint', '.overflow-x-auto { contain: paint !important; }'],
  ['scroller: isolation isolate', '.overflow-x-auto { isolation: isolate !important; }'],
  ['scroller: position relative', '.overflow-x-auto { position: relative !important; }'],
  ['html+body overflow-x hidden', 'html, body { overflow-x: hidden !important; }'],
  ['html+body max-width 100%', 'html, body { max-width: 100% !important; }'],
];

const chrome = spawn(
  'google-chrome',
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--remote-debugging-port=${PORT}`,
    `--window-size=${width},${height}`,
    `--user-data-dir=${PROFILE}`,
    url,
  ],
  { stdio: 'ignore' },
);

const expressionFor = (css) => `(() => {
  const de = document.documentElement;
  const ID = '__overflow_probe__';
  document.getElementById(ID)?.remove();
  const css = ${JSON.stringify(css)};
  if (css) {
    const style = document.createElement('style');
    style.id = ID;
    style.textContent = css;
    document.head.appendChild(style);
  }
  // Force layout.
  void de.offsetHeight;

  const scroller = document.querySelector('.overflow-x-auto');
  const table = document.querySelector('table');
  const stickyTh = document.querySelector('thead th.sticky');

  const out = {
    docScroll: de.scrollWidth,
    client: de.clientWidth,
    overflow: de.scrollWidth - de.clientWidth,
    scrollerClient: scroller ? scroller.clientWidth : null,
    scrollerScroll: scroller ? scroller.scrollWidth : null,
    tableWidth: table ? Math.round(table.getBoundingClientRect().width) : null,
    stickyWorks: null,
  };

  // The sticky first column must stay pinned when the inner scroller moves.
  if (scroller && stickyTh) {
    const before = stickyTh.getBoundingClientRect().left;
    scroller.scrollLeft = 300;
    void de.offsetHeight;
    const after = stickyTh.getBoundingClientRect().left;
    out.stickyWorks = Math.abs(after - before) < 2;
    out.stickyShift = Math.round(after - before);
    scroller.scrollLeft = 0;
  }
  return JSON.stringify(out);
})()`;

let ws;
try {
  let target = null;
  for (let i = 0; i < 40 && !target; i += 1) {
    await sleep(300);
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json());
      target = list.find((t) => t.type === 'page' && t.url === url);
    } catch {
      /* not up yet */
    }
  }
  if (!target) throw new Error(`could not attach to a page target for ${url}`);

  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  await sleep(2500);

  let nextId = 1;
  const evaluate = (expression) =>
    new Promise((resolve, reject) => {
      const id = nextId;
      nextId += 1;
      const onMessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id !== id) return;
        ws.removeEventListener('message', onMessage);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else if (msg.result.exceptionDetails)
          reject(new Error(JSON.stringify(msg.result.exceptionDetails)));
        else resolve(JSON.parse(msg.result.result.value));
      };
      ws.addEventListener('message', onMessage);
      ws.send(
        JSON.stringify({
          id,
          method: 'Runtime.evaluate',
          params: { expression, returnByValue: true },
        }),
      );
      setTimeout(() => reject(new Error('evaluate timed out')), 20000);
    });

  console.log(`\n  ${url} at ${width}x${height}\n`);
  console.log(
    '  ' +
      'override'.padEnd(30) +
      'win-overflow'.padEnd(14) +
      'inner scroll'.padEnd(18) +
      'sticky col',
  );
  console.log('  ' + '-'.repeat(76));

  for (const [label, css] of CANDIDATES) {
    const r = await evaluate(expressionFor(css));
    const verdict = r.overflow > 1 ? `${r.overflow}px SCROLLS` : 'none';
    const inner = `${r.scrollerClient}/${r.scrollerScroll}`;
    const sticky = r.stickyWorks === null ? 'n/a' : r.stickyWorks ? 'pinned' : `drifts ${r.stickyShift}px`;
    console.log('  ' + label.padEnd(30) + verdict.padEnd(14) + inner.padEnd(18) + sticky);
  }
  console.log();
} finally {
  ws?.close();
  chrome.kill('SIGKILL');
  await sleep(300);
  await rm(PROFILE, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
}
