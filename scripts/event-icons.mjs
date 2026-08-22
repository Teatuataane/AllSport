#!/usr/bin/env node
// Manage event icon PNGs in public/event-icons/.
// Slugs come straight from lib/eventData.ts so the list is always current.
//
// Usage:
//   node scripts/event-icons.mjs status              List done / missing / unknown icons
//   node scripts/event-icons.mjs slugs               Print all slugs in domain order (Canva page order)
//   node scripts/event-icons.mjs rename <dir>        Dry-run: map Canva's numbered exports to slug names
//   node scripts/event-icons.mjs rename <dir> --apply  Copy renamed files into public/event-icons/
//
// The rename command assumes the Canva design has one icon per page, in the
// same order as `slugs` prints. Page 1 -> first slug, page 2 -> second, etc.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const iconsDir = path.join(root, 'public', 'event-icons')

const src = fs.readFileSync(path.join(root, 'lib', 'eventData.ts'), 'utf8')
const events = [...src.matchAll(/slug:\s*'([^']+)',\s*\n\s*name:\s*'([^']+)',\s*\n\s*domain:\s*'([^']+)'/g)]
  .map((m) => ({ slug: m[1], name: m[2], domain: m[3] }))

if (events.length === 0) {
  console.error('Could not parse any events out of lib/eventData.ts — has its format changed?')
  process.exit(1)
}

const cmd = process.argv[2]

if (cmd === 'slugs') {
  let lastDomain = ''
  events.forEach((e, i) => {
    if (e.domain !== lastDomain) {
      console.log(`\n# ${e.domain}`)
      lastDomain = e.domain
    }
    console.log(`${String(i + 1).padStart(3)}  ${e.slug.padEnd(24)} ${e.name}`)
  })
  console.log(`\n${events.length} events total`)
} else if (cmd === 'status') {
  const files = fs.existsSync(iconsDir)
    ? fs.readdirSync(iconsDir).filter((f) => f.toLowerCase().endsWith('.png'))
    : []
  const have = new Set(files.map((f) => f.replace(/\.png$/i, '')))
  const slugs = new Set(events.map((e) => e.slug))

  const missing = events.filter((e) => !have.has(e.slug))
  const unknown = [...have].filter((s) => !slugs.has(s))

  console.log(`Done: ${events.length - missing.length}/${events.length}`)
  if (missing.length) {
    console.log('\nMissing:')
    for (const e of missing) console.log(`  ${e.slug.padEnd(24)} ${e.name} (${e.domain})`)
  }
  if (unknown.length) {
    console.log('\nIn folder but not a known slug (typo or renamed event?):')
    for (const s of unknown) console.log(`  ${s}.png`)
  }
} else if (cmd === 'rename') {
  const dir = process.argv[3]
  const apply = process.argv.includes('--apply')
  if (!dir || !fs.existsSync(dir)) {
    console.error('Usage: node scripts/event-icons.mjs rename <folder-of-canva-exports> [--apply]')
    process.exit(1)
  }

  // Canva multi-page downloads look like "Design Name-42.png". Pair each file's
  // trailing page number with the Nth event slug.
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .map((f) => {
      const m = f.match(/(\d+)\D*\.png$/i)
      return { file: f, page: m ? parseInt(m[1], 10) : null }
    })

  const unnumbered = files.filter((f) => f.page === null)
  const numbered = files.filter((f) => f.page !== null).sort((a, b) => a.page - b.page)

  if (unnumbered.length) {
    console.log('Skipping (no page number in filename):')
    for (const f of unnumbered) console.log(`  ${f.file}`)
    console.log('')
  }

  let ok = 0
  for (const { file, page } of numbered) {
    const event = events[page - 1]
    if (!event) {
      console.log(`  ${file}  ->  page ${page} is beyond the ${events.length}-event list, skipped`)
      continue
    }
    const dest = path.join(iconsDir, `${event.slug}.png`)
    console.log(`  ${file}  ->  ${event.slug}.png  (${event.name})`)
    if (apply) {
      fs.copyFileSync(path.join(dir, file), dest)
      ok++
    }
  }

  if (apply) console.log(`\nCopied ${ok} icon(s) into public/event-icons/`)
  else console.log('\nDry run — check the mapping above, then re-run with --apply')
} else if (cmd === 'sheet') {
  // Build a browser page to visually check every icon and fix mis-named ones.
  // Each icon gets a dropdown of all events; pick the correct one, then the page
  // writes a collision-free bash script that builds a corrected _fixed/ folder.
  const files = fs
    .readdirSync(iconsDir)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort()

  const slugSet = new Set(events.map((e) => e.slug))
  const data = files.map((f) => ({ file: f, current: f.replace(/\.png$/i, '') }))

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AllSport event icon checker</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f4f4f5; color: #18181b; }
  header { position: sticky; top: 0; background: #111; color: #fff; padding: 16px 20px; z-index: 10; }
  header h1 { margin: 0 0 4px; font-size: 18px; }
  header p { margin: 0; font-size: 13px; color: #bbb; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; padding: 20px; padding-bottom: 260px; }
  .card { background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 12px; text-align: center; }
  .card.changed { border-color: #2371BB; box-shadow: 0 0 0 2px #2371BB33; }
  .card.dup select { border-color: #EA4742; background: #fde8e8; }
  .thumb { width: 100%; height: 150px; object-fit: contain; background: repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 0 0 / 20px 20px; border-radius: 8px; }
  .fname { font-size: 12px; color: #71717a; margin: 8px 0 6px; word-break: break-all; }
  select { width: 100%; padding: 6px; font-size: 13px; border: 1px solid #d4d4d8; border-radius: 8px; background: #fff; }
  footer { position: fixed; bottom: 0; left: 0; right: 0; background: #18181b; color: #fff; padding: 12px 20px; box-shadow: 0 -4px 20px #0003; }
  footer .row { display: flex; gap: 12px; align-items: center; margin-bottom: 8px; }
  footer button { background: #4DB26E; color: #fff; border: 0; border-radius: 8px; padding: 8px 16px; font-size: 14px; font-weight: 600; cursor: pointer; }
  footer .warn { color: #F9B051; font-size: 13px; }
  textarea { width: 100%; height: 120px; font-family: ui-monospace, Menlo, monospace; font-size: 12px; border-radius: 8px; border: 0; padding: 10px; box-sizing: border-box; }
</style>
</head>
<body>
<header>
  <h1>AllSport event icon checker</h1>
  <p>Look at each icon, pick the correct event in the dropdown below it. Cards you change turn blue. Red = two icons picked the same event (fix those). When done, click <b>Copy fix script</b> and paste it into Terminal.</p>
</header>
<div class="grid" id="grid"></div>
<footer>
  <div class="row">
    <button onclick="copyScript()">Copy fix script</button>
    <span class="warn" id="warn"></span>
  </div>
  <textarea id="out" readonly></textarea>
</footer>
<script>
  const EVENTS = ${JSON.stringify(events.map((e) => ({ slug: e.slug, name: e.name, domain: e.domain })))};
  const FILES = ${JSON.stringify(data)};
  const KNOWN = new Set(EVENTS.map(e => e.slug));

  let optionsHtml = '<option value="__keep">— keep current —</option>' +
    '<option value="__delete">🗑 not an event (leave out)</option>';
  let lastDomain = '';
  for (const e of EVENTS) {
    if (e.domain !== lastDomain) { optionsHtml += '<optgroup label="' + e.domain + '">'; lastDomain = e.domain; }
    optionsHtml += '<option value="' + e.slug + '">' + e.name + '  (' + e.slug + ')</option>';
  }

  const grid = document.getElementById('grid');
  FILES.forEach((f, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.idx = i;
    const startVal = KNOWN.has(f.current) ? f.current : '__delete';
    card.innerHTML =
      '<img class="thumb" src="' + encodeURIComponent(f.file) + '" alt="">' +
      '<div class="fname">' + f.file + '</div>' +
      '<select>' + optionsHtml + '</select>';
    const sel = card.querySelector('select');
    sel.value = startVal === f.current ? f.current : (KNOWN.has(f.current) ? f.current : '__delete');
    if (KNOWN.has(f.current)) sel.value = f.current; else sel.value = '__delete';
    sel.addEventListener('change', refresh);
    grid.appendChild(card);
  });

  function chosenSlug(card) {
    const v = card.querySelector('select').value;
    const cur = FILES[card.dataset.idx].current;
    if (v === '__keep') return cur;
    if (v === '__delete') return null;
    return v;
  }

  function refresh() {
    const counts = {};
    document.querySelectorAll('.card').forEach(card => {
      const slug = chosenSlug(card);
      const cur = FILES[card.dataset.idx].current;
      card.classList.toggle('changed', slug !== cur && slug !== null);
      if (slug) counts[slug] = (counts[slug] || 0) + 1;
    });
    let dupes = 0;
    document.querySelectorAll('.card').forEach(card => {
      const slug = chosenSlug(card);
      const isDup = slug && counts[slug] > 1;
      card.classList.toggle('dup', isDup);
      if (isDup) dupes++;
    });
    buildScript(counts, dupes);
  }

  function buildScript(counts, dupes) {
    const lines = [
      '# Run this from ~/allsport. It builds public/event-icons/_fixed/ with corrected names.',
      'cd ~/allsport/public/event-icons',
      'rm -rf _fixed && mkdir _fixed'
    ];
    let deleted = [];
    document.querySelectorAll('.card').forEach(card => {
      const slug = chosenSlug(card);
      const cur = FILES[card.dataset.idx].current;
      const file = FILES[card.dataset.idx].file;
      if (slug === null) { deleted.push(file); return; }
      lines.push('cp "' + file + '" "_fixed/' + slug + '.png"');
    });
    lines.push('');
    lines.push('# Review the _fixed folder. If it looks right, swap it in with:');
    lines.push('#   rm -f *.png && mv _fixed/*.png . && rmdir _fixed');
    if (deleted.length) lines.push('# Left out (not events): ' + deleted.join(', '));
    document.getElementById('out').value = lines.join('\\n');
    document.getElementById('warn').textContent = dupes
      ? (dupes + ' icon(s) share an event name — fix the red cards first.')
      : '';
  }

  function copyScript() {
    const ta = document.getElementById('out');
    ta.select();
    navigator.clipboard.writeText(ta.value).then(() => {
      const b = document.querySelector('footer button');
      b.textContent = 'Copied!'; setTimeout(() => b.textContent = 'Copy fix script', 1500);
    });
  }

  refresh();
</script>
</body>
</html>`

  const dest = path.join(iconsDir, '_verify.html')
  fs.writeFileSync(dest, html)
  console.log(`Wrote ${dest}`)
  console.log(`Open it with:  open "${dest}"`)
  console.log(`(${files.length} icons, ${slugSet.size} events in the dropdown)`)
} else {
  console.log('Usage: node scripts/event-icons.mjs <status|slugs|rename <dir> [--apply]|sheet>')
  process.exit(1)
}
