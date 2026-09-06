#!/usr/bin/env node
// Run with `node scripts/check.mjs`. No installation or network access required.
// The small DOM below supplies events and controls to the real page scripts.
// Layout and native browser constraint validation remain browser-QA tasks.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = new URL('https://mpusceddu.github.io/cdu-vallendar/');
let passed = 0;
let failed = 0;
async function check(name, run) {
  try {
    await run();
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}\n  ${error.message}`);
  }
}

function decode(text) {
  return text.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (_, entity) => {
    if (entity.startsWith('#x')) return String.fromCodePoint(parseInt(entity.slice(2), 16));
    if (entity.startsWith('#')) return String.fromCodePoint(Number(entity.slice(1)));
    return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: '\u00a0' }[entity];
  });
}

class Element {
  constructor(tag, attrs = {}) {
    this.tagName = tag;
    this.attrs = attrs;
    this.children = [];
    this.parent = null;
    this.listeners = new Map();
    this.hidden = 'hidden' in attrs;
    this.checked = 'checked' in attrs;
    this.dataset = Object.fromEntries(Object.entries(attrs)
      .filter(([key]) => key.startsWith('data-'))
      .map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), value]));
    this._value = attrs.value;
  }
  get textContent() { return this.children.map(child => typeof child === 'string' ? child : child.textContent).join(''); }
  set textContent(value) { this.children = [String(value)]; }
  get text() { return this.textContent; }
  get options() { return this.children.filter(child => child instanceof Element && child.tagName === 'option'); }
  get value() {
    if (this._value !== undefined) return this._value;
    if (this.tagName === 'select') return this.options.find(option => 'selected' in option.attrs)?.value ?? this.options[0]?.value ?? '';
    if (this.tagName === 'textarea' || this.tagName === 'option') return this.textContent;
    return '';
  }
  set value(value) { this._value = String(value); }
  get selectedIndex() { return this.options.findIndex(option => option.value === this.value); }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  matches(selector) {
    if (selector.startsWith('#')) return this.attrs.id === selector.slice(1);
    if (selector.startsWith('.')) return (this.attrs.class ?? '').split(/\s+/).includes(selector.slice(1));
    const match = selector.match(/^([a-z][\w-]*)?(?:\[([^\]=]+)(?:="([^"]*)")?\])?$/i);
    assert(match, `Unsupported test DOM selector: ${selector}`);
    return (!match[1] || this.tagName === match[1]) && (!match[2] || (match[2] in this.attrs && (match[3] === undefined || this.attrs[match[2]] === match[3])));
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => child instanceof Element ? [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)] : []);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  async dispatch(type) {
    const event = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    for (let current = this; current; current = current.parent) {
      event.currentTarget = current;
      for (const listener of current.listeners.get(type) ?? []) await listener(event);
    }
    return event;
  }
  reportValidity() {
    this.validityChecks = (this.validityChecks ?? 0) + 1;
    return this.querySelectorAll('[required]').every(control => control.attrs.type === 'checkbox' ? control.checked : control.value.length > 0);
  }
  focus() { this.focused = true; }
  select() { this.selected = true; }
  scrollIntoView() { this.scrolled = true; }
}

function parseHtml(source) {
  const doc = new Element('document');
  const stack = [doc];
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const html = source.replace(/<!--[^]*?-->/g, '').replace(/<(script|style)\b[^>]*>[^]*?<\/\1>/gi, '');
  for (const token of html.match(/<![^>]*>|<\/[^>]+>|<[^>]+>|[^<]+/g) ?? []) {
    if (token.startsWith('<!')) continue;
    if (token.startsWith('</')) {
      const tag = token.match(/^<\/\s*([\w-]+)/)?.[1].toLowerCase();
      const index = stack.findLastIndex(node => node.tagName === tag);
      if (index > 0) stack.length = index;
    } else if (token.startsWith('<')) {
      const match = token.match(/^<([\w-]+)\b([^]*?)\/?\s*>$/);
      if (!match) continue;
      const attrs = {};
      for (const attribute of match[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
        attrs[attribute[1].toLowerCase()] = decode(attribute[2] ?? attribute[3] ?? attribute[4] ?? '');
      }
      const element = new Element(match[1].toLowerCase(), attrs);
      element.parent = stack.at(-1);
      element.parent.children.push(element);
      if (!voidTags.has(element.tagName) && !token.endsWith('/>')) stack.push(element);
    } else {
      stack.at(-1).children.push(decode(token));
    }
  }
  return doc;
}

function filesBelow(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') return [];
    const full = join(dir, entry.name);
    return entry.isDirectory() ? filesBelow(full) : [full];
  });
}
const htmlFiles = filesBelow(root).filter(file => file.endsWith('.html'));
const sourceByPath = new Map(htmlFiles.map(file => [relative(root, file), readFileSync(file, 'utf8')]));
const documents = new Map([...sourceByPath].map(([path, source]) => [path, parseHtml(source)]));

await check('Internal links and fragments resolve under /cdu-vallendar/', () => {
  let count = 0;
  for (const [path, doc] of documents) {
    const pageUrl = new URL(path.endsWith('/index.html') || path === 'index.html' ? path.replace(/index\.html$/, '') : path, base);
    for (const anchor of doc.querySelectorAll('a[href]')) {
      const href = anchor.getAttribute('href');
      const target = new URL(href, pageUrl);
      if (target.origin !== base.origin || !['http:', 'https:'].includes(target.protocol)) continue;
      assert(target.pathname.startsWith(base.pathname), `${path}: ${href} leaves the GitHub Pages project base`);
      let targetPath = decodeURIComponent(target.pathname.slice(base.pathname.length));
      if (!targetPath || targetPath.endsWith('/')) targetPath += 'index.html';
      const diskPath = resolve(root, targetPath);
      assert(diskPath.startsWith(`${root}/`), `${path}: ${href} escapes the project`);
      assert(existsSync(diskPath), `${path}: target is missing: ${href}`);
      assert(statSync(diskPath).isFile(), `${path}: link does not resolve to a file: ${href}`);
      if (target.hash && targetPath.endsWith('.html')) {
        const fragment = decodeURIComponent(target.hash.slice(1));
        assert(documents.get(targetPath)?.querySelectorAll('[id]').some(node => node.attrs.id === fragment), `${path}: missing fragment ${href}`);
      }
      count++;
    }
  }
  assert(count > 0, 'No internal links were discovered');
  console.log(`  ${count} internal links, ${documents.size} HTML pages`);
});

await check('Every page uses the same non-empty stylesheet version', () => {
  const versions = new Set();
  for (const [path, doc] of documents) {
    const stylesheet = doc.querySelectorAll('link[href]').find(link => /(?:^|\/)assets\/styles\.css(?:\?|$)/.test(link.attrs.href));
    assert(stylesheet, `${path}: shared stylesheet is missing`);
    const version = new URL(stylesheet.attrs.href, new URL(path, base)).searchParams.get('v');
    assert(version && /^[\w.-]+$/.test(version), `${path}: stylesheet version is missing or malformed`);
    versions.add(version);
  }
  assert.equal(versions.size, 1, `Mixed stylesheet versions: ${[...versions].join(', ')}`);
});

function runPage(path, script, url = new URL(path.replace(/index\.html$/, ''), base).href) {
  const document = parseHtml(sourceByPath.get(path));
  const window = new Element('window');
  window.location = { href: url };
  const history = [url];
  let cursor = 0;
  window.history = {
    pushState(_state, _title, next) {
      history.splice(cursor + 1);
      history.push(new URL(next, window.location.href).href);
      cursor++;
      window.location.href = history[cursor];
    },
    async back() {
      if (cursor > 0) {
        window.location.href = history[--cursor];
        await window.dispatch('popstate');
      }
    }
  };
  let clipboardBlocked = false;
  const copied = [];
  const navigator = { clipboard: { async writeText(text) {
    if (clipboardBlocked) throw new Error('Clipboard denied');
    copied.push(text);
  } } };
  vm.runInNewContext(readFileSync(join(root, script), 'utf8'), { document, window, navigator, URL, console }, { filename: script });
  return { document, window, copied, blockClipboard() { clipboardBlocked = true; }, select: selector => document.querySelector(selector) };
}

async function validProposal() {
  const page = runPage('thema-vorschlagen/index.html', 'assets/thema-vorschlagen.js');
  const values = {
    '#proposal-place': 'urbar', '#proposal-category': 'local', '#proposal-location': 'Bürgerhaus',
    '#proposal-topic': 'Beleuchtung prüfen', '#proposal-situation': 'Der öffentliche Weg ist abends schlecht beleuchtet.',
    '#proposal-goal': 'Die zuständige Stelle soll die Beleuchtung prüfen.'
  };
  for (const [selector, value] of Object.entries(values)) {
    page.select(selector).value = value;
    await page.select(selector).dispatch('change');
  }
  page.select('#proposal-confirmation').checked = true;
  await page.select('#proposal-confirmation').dispatch('change');
  return page;
}

await check('Proposal keeps Urbar jurisdiction when the independent finder changes', async () => {
  const page = await validProposal();
  page.select('#route-place').value = 'weitersburg';
  await page.select('#route-place').dispatch('change');
  page.select('#route-topic').value = 'vg';
  await page.select('#route-topic').dispatch('change');
  assert.match(page.select('[data-route-result]').textContent, /Voraussichtlich: Verbandsgemeinderat/);
  const submit = await page.select('[data-proposal-form]').dispatch('submit');
  assert(submit.defaultPrevented, 'Submit must not navigate or send a request');
  const text = page.select('[data-proposal-text]').value;
  assert.match(text, /Ort \/ räumlicher Bezug: Urbar/);
  assert.match(text, /Erste Zuständigkeitseinordnung: Ortsgemeinderat Urbar/);
  assert.doesNotMatch(text, /Weitersburg|Einordnung: Verbandsgemeinderat/);
  assert.equal(page.select('[data-proposal-output]').hidden, false);
});

await check('Missing required text and missing confirmation each prevent a proposal', async () => {
  for (const invalid of ['text', 'confirmation']) {
    const page = await validProposal();
    if (invalid === 'text') page.select('#proposal-topic').value = '';
    else page.select('#proposal-confirmation').checked = false;
    await page.select('[data-proposal-form]').dispatch('submit');
    assert(page.select('[data-proposal-form]').validityChecks > 0, 'Native form validation was not requested');
    assert.equal(page.select('[data-proposal-text]').value, '');
    assert.equal(page.select('[data-proposal-output]').hidden, true);
  }
});

await check('Input and selection changes both clear an outdated proposal and copy status', async () => {
  for (const [selector, event, value] of [['#proposal-topic', 'input', 'Neues Thema'], ['#proposal-place', 'change', 'vallendar']]) {
    const page = await validProposal();
    await page.select('[data-proposal-form]').dispatch('submit');
    await page.select('[data-copy-proposal]').dispatch('click');
    assert(page.select('[data-copy-status]').textContent.length > 0);
    page.select(selector).value = value;
    await page.select(selector).dispatch(event);
    assert.equal(page.select('[data-proposal-output]').hidden, true);
    assert.equal(page.select('[data-proposal-text]').value, '');
    assert.equal(page.select('[data-copy-status]').textContent, '');
  }
});

await check('Clipboard copies exactly the draft; denied access selects the manual fallback', async () => {
  const page = await validProposal();
  await page.select('[data-proposal-form]').dispatch('submit');
  await page.select('[data-copy-proposal]').dispatch('click');
  assert.deepEqual(page.copied, [page.select('[data-proposal-text]').value]);
  page.blockClipboard();
  await page.select('[data-copy-proposal]').dispatch('click');
  assert(page.select('[data-proposal-text]').focused);
  assert(page.select('[data-proposal-text]').selected);
  assert.match(page.select('[data-copy-status]').textContent, /Strg\+C.*Cmd\+C/);
});

const motionMetadata = documents.get('politik/index.html').querySelectorAll('[data-council]').map(card => ({
  council: card.dataset.council,
  source: card.querySelector('a[href]')?.attrs.href,
  draft: Boolean(card.querySelector('.motion-status-draft'))
}));

function assertFilter(page, council) {
  const actual = page.document.querySelectorAll('[data-council]').filter(card => !card.hidden);
  const expected = motionMetadata.filter(card => council === 'all' || card.council === council);
  assert.equal(actual.length, expected.length);
  if (council !== 'all') assert(actual.every(card => card.dataset.council === council));
  const sourced = expected.filter(card => card.source).length;
  const drafts = expected.length - sourced;
  const count = page.select('[data-result-count]').textContent;
  if (sourced) assert.match(count, new RegExp(`\\b${sourced} Eintr(?:ag|äge) mit öffentlicher Quelle`));
  if (drafts) assert.match(count, new RegExp(`\\b${drafts} ausgearbeitete Initiativ(?:e|en) \\(Einreichung öffentlich noch nicht belegt\\)`));
  if (!expected.length) assert.match(count, /Keine Einträge/);
  assert.equal(page.select('[data-empty-state]').hidden, expected.length > 0);
  const pressed = page.document.querySelectorAll('[data-filter]').filter(button => button.attrs['aria-pressed'] === 'true');
  assert.equal(pressed.length, 1);
  assert.equal(pressed[0].dataset.filter, council);
}

await check('Real archive metadata distinguishes public sources from unverified drafts', () => {
  assert(motionMetadata.length > 0, 'The archive is unexpectedly empty');
  assert(motionMetadata.some(card => card.source), 'Expected at least one publicly sourced entry');
  assert(motionMetadata.some(card => card.draft), 'Expected at least one clearly marked draft');
  for (const card of motionMetadata) {
    assert(card.source || card.draft, 'An entry without a public source must be labelled as a draft');
    if (card.source) assert.equal(new URL(card.source).protocol, 'https:');
  }
  console.log(`  ${motionMetadata.length} entries: ${motionMetadata.filter(card => card.source).length} sourced, ${motionMetadata.filter(card => !card.source).length} unverified`);
});

await check('Every council filter shows the real cards and distinguishes draft counts', async () => {
  const page = runPage('politik/index.html', 'assets/politik.js');
  assertFilter(page, 'all');
  for (const button of page.document.querySelectorAll('[data-filter]')) {
    await button.dispatch('click');
    assertFilter(page, button.dataset.filter);
  }
  for (const council of ['niederwerth', 'weitersburg']) {
    const button = page.document.querySelectorAll('[data-filter]').find(node => node.dataset.filter === council);
    await button.dispatch('click');
    assert.match(page.select('[data-empty-title]').textContent, council === 'niederwerth' ? /Keine klassische CDU-Fraktion/ : /keine CDU-Vertretung/i);
  }
});

await check('Deep links, filter URLs and browser Back restore the correct council', async () => {
  const page = runPage('politik/index.html', 'assets/politik.js', `${base}politik/?qa=check&rat=urbar#antraege`);
  assertFilter(page, 'urbar');
  const buttons = page.document.querySelectorAll('[data-filter]');
  await buttons.find(button => button.dataset.filter === 'vg').dispatch('click');
  assertFilter(page, 'vg');
  let url = new URL(page.window.location.href);
  assert.equal(url.searchParams.get('rat'), 'vg');
  assert.equal(url.searchParams.get('qa'), 'check');
  assert.equal(url.hash, '#antraege');
  assert.equal(url.pathname, '/cdu-vallendar/politik/');
  await page.window.history.back();
  assertFilter(page, 'urbar');
  assert.equal(new URL(page.window.location.href).searchParams.get('rat'), 'urbar');
  await buttons.find(button => button.dataset.filter === 'all').dispatch('click');
  assertFilter(page, 'all');
  url = new URL(page.window.location.href);
  assert.equal(url.searchParams.has('rat'), false);
  assert.equal(url.searchParams.get('qa'), 'check');
});

await check('Invalid URL filter falls back to all; valid mixed-case filter is normalized', () => {
  for (const [input, expected] of [['nonexistent', 'all'], ['%20URBAR%20', 'urbar']]) {
    const page = runPage('politik/index.html', 'assets/politik.js', `${base}politik/?rat=${input}`);
    assertFilter(page, expected);
  }
});

console.log(`\n${passed} passed, ${failed} failed.`);
process.exitCode = failed ? 1 : 0;
