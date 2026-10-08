/**
 * Finds what makes a page scroll sideways.
 *
 * Reading rects is not enough: a contained subtree still reports a wide
 * bounding box, and a transformed or positioned element can extend the
 * scrollable area without being wide itself. So this walks down the tree
 * hiding one child at a time and re-measuring `documentElement.scrollWidth`,
 * which is the number the browser actually scrolls to.
 *
 * Usage: node scripts/measure-overflow.mjs <url> <width> <height>
 */
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const [url = 'http://localhost:5173/tracker', width = '1440', height = '900'] =
  process.argv.slice(2);
// A fresh port per run, so a leftover Chrome from an earlier run can never be
// mistaken for this one's target.
const PORT = 9400 + Math.floor(Math.random() * 500);
const PROFILE = `/tmp/chrome-measure-${PORT}`;

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

const EXPRESSION = `(() => {
  const de = document.documentElement;

  // Keep the vertical scrollbar present for the whole scan. Without this,
  // hiding content reclaims the scrollbar's 15px and clientWidth changes
  // underneath the comparison.
  const hadOverflowY = de.style.getPropertyValue('overflow-y');
  de.style.setProperty('overflow-y', 'scroll', 'important');

  const viewport = de.clientWidth;
  const baseline = de.scrollWidth;
  // Horizontal overflow means scrollWidth exceeds the *current* clientWidth.
  const ok = () => de.scrollWidth <= de.clientWidth + 1;

  const describe = (el) =>
    '<' + el.tagName.toLowerCase() + '>' +
    (el.id ? '#' + el.id : '') +
    (el.className ? ' .' + String(el.className).trim().split(/\\s+/).join('.').slice(0, 100) : '');

  const info = (el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      el: describe(el),
      rect: Math.round(r.width),
      left: Math.round(r.left),
      right: Math.round(r.right),
      client: el.clientWidth,
      scroll: el.scrollWidth,
      overflowX: cs.overflowX,
      position: cs.position,
      display: cs.display,
      transform: cs.transform === 'none' ? '' : cs.transform,
      width: cs.width,
      minWidth: cs.minWidth,
    };
  };

  // Hide an element, measure, put it back exactly as it was.
  const withHidden = (el, fn) => {
    const had = el.style.getPropertyValue('display');
    const pri = el.style.getPropertyPriority('display');
    el.style.setProperty('display', 'none', 'important');
    const out = fn();
    if (had) el.style.setProperty('display', had, pri);
    else el.style.removeProperty('display');
    return out;
  };

  // Descend: at each level, find the single child that alone accounts for the
  // document's horizontal overflow.
  const trail = [];
  let node = document.body;
  let spread = false;
  for (let guard = 0; guard < 40; guard += 1) {
    const kids = Array.from(node.children);
    let culprit = null;
    for (const kid of kids) {
      if (withHidden(kid, ok)) { culprit = kid; break; }
    }
    if (!culprit) {
      // Nothing single-handedly responsible. Is it the children jointly, or
      // this element's own box?
      const prev = kids.map((k) => [k, k.style.getPropertyValue('display'), k.style.getPropertyPriority('display')]);
      for (const k of kids) k.style.setProperty('display', 'none', 'important');
      const allHidden = de.scrollWidth;
      const jointly = ok();
      for (const [k, had, pri] of prev) {
        if (had) k.style.setProperty('display', had, pri);
        else k.style.removeProperty('display');
      }
      spread = {
        owner: describe(node),
        ownBox: info(node),
        childrenJointly: jointly,
        scrollWithChildrenHidden: allHidden,
        clientThen: de.clientWidth,
        childCount: kids.length,
      };
      break;
    }
    trail.push(info(culprit));
    node = culprit;
  }

  if (hadOverflowY) de.style.setProperty('overflow-y', hadOverflowY);
  else de.style.removeProperty('overflow-y');

  return JSON.stringify({ viewport, baseline, overflow: baseline - viewport, trail, spread });
})()`;

try {
  let target = null;
  for (let i = 0; i < 40 && !target; i += 1) {
    await sleep(300);
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json());
      target = list.find((t) => t.type === 'page' && t.url === url);
    } catch {
      /* chrome not up yet */
    }
  }
  if (!target) throw new Error(`could not attach to a page target for ${url}`);
  console.log(`  attached to ${target.url} (debug port ${PORT})`);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  await sleep(2500);

  const result = await new Promise((resolve, reject) => {
    const id = 1;
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== id) return;
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result.result.value);
    });
    ws.send(
      JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: { expression: EXPRESSION, returnByValue: true },
      }),
    );
    setTimeout(() => reject(new Error('evaluate timed out')), 120000);
  });

  const data = JSON.parse(result);
  console.log(
    `  viewport ${data.viewport}px  scrollWidth ${data.baseline}px  overflow ${data.overflow}px` +
      `  ${data.overflow > 1 ? 'WINDOW SCROLLS SIDEWAYS' : 'no window scroll'}`,
  );

  if (data.trail.length) {
    console.log('\n  hiding any one of these removes the window scroll (outermost first):');
    for (const [i, c] of data.trail.entries()) {
      const pad = '  '.repeat(Math.min(i, 14));
      console.log(
        `    ${pad}${c.el}\n` +
          `    ${pad}  rect=${c.rect} left=${c.left} right=${c.right} client=${c.client} scroll=${c.scroll}\n` +
          `    ${pad}  overflow-x=${c.overflowX} position=${c.position} display=${c.display} ` +
          `width=${c.width} min-width=${c.minWidth}${c.transform ? ' transform=' + c.transform : ''}`,
      );
    }
    console.log(`\n  >>> deepest single cause: ${data.trail[data.trail.length - 1].el}`);
  }
  if (data.spread) {
    console.log(`\n  no single child below that point is responsible: ${JSON.stringify(data.spread)}`);
  }
  console.log();
  ws.close();
} finally {
  chrome.kill('SIGKILL');
  await sleep(300);
  await rm(PROFILE, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
}
