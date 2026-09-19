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
    this.style = {};
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
  removeAttribute(name) { delete this.attrs[name]; }
  getAttribute(name) { return this.attrs[name] ?? null; }
  get open() { return 'open' in this.attrs; }
  set open(value) { if (value) this.attrs.open = ''; else delete this.attrs.open; }
  matches(selector) {
    selector = selector.trim();
    if (selector.includes(',')) return selector.split(',').some(part => this.matches(part));
    if (selector.includes('>')) {
      const parts = selector.split(/\s*>\s*/);
      const child = parts.pop();
      return this.matches(child) && !!this.parent?.matches(parts.join(' > '));
    }
    if (selector.endsWith(':last-child')) {
      const siblings = this.parent?.children.filter(child => child instanceof Element) ?? [];
      return siblings.at(-1) === this && this.matches(selector.slice(0, -':last-child'.length));
    }
    if (selector.includes(' ')) {
      const parts = selector.trim().split(/\s+/);
      if (!this.matches(parts.pop())) return false;
      let ancestor = this.parent;
      while (parts.length) {
        const part = parts.pop();
        while (ancestor && !ancestor.matches(part)) ancestor = ancestor.parent;
        if (!ancestor) return false;
        ancestor = ancestor.parent;
      }
      return true;
    }
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
  getElementById(id) { return this.querySelectorAll('[id]').find(element => element.attrs.id === id) ?? null; }
  closest(selector) {
    for (let current = this; current; current = current.parent) if (current.matches(selector)) return current;
    return null;
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  async dispatch(type, properties = {}) {
    const event = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...properties };
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

await check('Public site and portal preview use separate, consistently versioned design families', () => {
  const versions = new Map([['website', new Set()], ['portal', new Set()]]);
  const portalPaths = new Set(['funktionstraeger/index.html', 'funktionstraeger/gremien.html', 'funktionstraeger/ci-guide.html']);
  for (const [path, doc] of documents) {
    const portal = portalPaths.has(path);
    const expectedPath = new URL(portal ? 'funktionstraeger/styles.css' : 'assets/styles.css', base).pathname;
    const stylesheets = doc.querySelectorAll('link[href]').filter(link => link.attrs.rel === 'stylesheet');
    const urls = stylesheets.map(link => new URL(link.attrs.href, new URL(path, base)));
    const stylesheet = urls.find(url => url.pathname === expectedPath);
    assert(stylesheet, `${path}: expected ${expectedPath} stylesheet is missing`);
    assert(!urls.some(url => url.pathname === new URL(portal ? 'assets/styles.css' : 'funktionstraeger/styles.css', base).pathname), `${path}: website and portal styles must not be mixed`);
    const version = stylesheet.searchParams.get('v');
    assert(version && /^[\w.-]+$/.test(version), `${path}: stylesheet version is missing or malformed`);
    versions.get(portal ? 'portal' : 'website').add(version);
  }
  assert.deepEqual([...versions.get('website')], ['20'], 'The website must consistently use stylesheet version 20');
  assert.deepEqual([...versions.get('portal')], ['1'], 'Portal preview must consistently use its own stylesheet version 1');
  assert.equal(documents.get('funktionstraeger/gremien.html')?.querySelectorAll('link[href]').filter(link => new URL(link.attrs.href, new URL('funktionstraeger/gremien.html', base)).pathname === new URL('funktionstraeger/gremien.css', base).pathname && new URL(link.attrs.href, base).searchParams.get('v') === '1').length, 1, 'The responsibilities page needs its own versioned supplementary stylesheet');
  assert.equal(documents.get('funktionstraeger/ci-guide.html')?.querySelectorAll('link[href]').filter(link => new URL(link.attrs.href, new URL('funktionstraeger/ci-guide.html', base)).pathname === new URL('funktionstraeger/ci-guide.css', base).pathname && new URL(link.attrs.href, base).searchParams.get('v') === '1').length, 1, 'The local CI guide needs its own versioned supplementary stylesheet');
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

async function changeValue(page, selector, value) {
  page.select(selector).value = value;
  await page.select(selector).dispatch('change');
}

async function proposalFromFinder() {
  const page = runPage('thema-vorschlagen/index.html', 'assets/thema-vorschlagen.js');
  await changeValue(page, '#route-place', 'urbar');
  await changeValue(page, '#route-topic', 'local');
  // Leave both form selects untouched: their ownership must remain with the finder.
  for (const [selector, value] of Object.entries({
    '#proposal-location': 'Bürgerhaus',
    '#proposal-topic': 'Beleuchtung prüfen',
    '#proposal-situation': 'Der öffentliche Weg ist abends schlecht beleuchtet.',
    '#proposal-goal': 'Die zuständige Stelle soll die Beleuchtung prüfen.'
  })) await changeValue(page, selector, value);
  page.select('#proposal-confirmation').checked = true;
  await page.select('#proposal-confirmation').dispatch('change');
  return page;
}

await check('Finder prefills and updates untouched form fields for every available choice', async () => {
  const page = runPage('thema-vorschlagen/index.html', 'assets/thema-vorschlagen.js');
  assert.equal(page.select('#proposal-place').value, '');
  assert.equal(page.select('#proposal-category').value, '');
  for (const [finder, field, other] of [
    ['#route-place', '#proposal-place', '#proposal-category'],
    ['#route-topic', '#proposal-category', '#proposal-place']
  ]) {
    const otherValue = page.select(other).value;
    const choices = page.select(finder).options.map(option => option.value).filter(value => value !== 'unknown');
    assert(choices.length > 0, `${finder}: expected selectable choices`);
    for (const value of [...choices, 'unknown']) {
      await changeValue(page, finder, value);
      assert.equal(page.select(field).value, value === 'unknown' ? '' : value, `${field}: finder selection was not transferred`);
      assert.equal(page.select(other).value, otherValue, `${finder} must not change the other form field`);
    }
  }
});

await check('Manual place choices, including clearing and county, survive later finder changes', async () => {
  for (const selected of ['urbar', 'vallendar', 'county', '']) {
    const page = await proposalFromFinder();
    await changeValue(page, '#proposal-place', selected);
    for (const nextPlace of ['weitersburg', 'unknown', 'niederwerth']) {
      await changeValue(page, '#route-place', nextPlace);
      assert.equal(page.select('#proposal-place').value, selected, `Manual place ${JSON.stringify(selected)} was overwritten`);
    }
    await changeValue(page, '#route-topic', 'county');
    assert.equal(page.select('#proposal-category').value, 'county', 'Editing the place must not disable category autofill');
    assert.equal(page.select('#proposal-place').value, selected);
  }
});

await check('Manual topic choices survive finder changes without disabling place autofill', async () => {
  for (const selected of ['local', 'county', 'higher', '']) {
    const page = await proposalFromFinder();
    await changeValue(page, '#proposal-category', selected);
    for (const nextTopic of ['vg', 'unknown', 'admin']) {
      await changeValue(page, '#route-topic', nextTopic);
      assert.equal(page.select('#proposal-category').value, selected, `Manual topic ${JSON.stringify(selected)} was overwritten`);
    }
    await changeValue(page, '#route-place', 'vallendar');
    assert.equal(page.select('#proposal-place').value, 'vallendar', 'Editing the category must not disable place autofill');
    assert.equal(page.select('#proposal-category').value, selected);
  }
});

await check('Finder-prefilled form produces a valid local-only draft with its own jurisdiction', async () => {
  const page = await proposalFromFinder();
  const submit = await page.select('[data-proposal-form]').dispatch('submit');
  assert(submit.defaultPrevented, 'The form must remain a local text workshop, not a sending action');
  assert.equal(page.select('[data-proposal-output]').hidden, false);
  const text = page.select('[data-proposal-text]').value;
  assert.match(text, /Ort \/ räumlicher Bezug: Urbar/);
  assert.match(text, /Erste Zuständigkeitseinordnung: Ortsgemeinderat Urbar/);
  assert.match(text, /THEMA: Beleuchtung prüfen/);
});

await check('Finder autofill changes invalidate a prepared draft and its copy status', async () => {
  for (const [finder, value, field] of [
    ['#route-place', 'vallendar', '#proposal-place'],
    ['#route-topic', 'vg', '#proposal-category'],
    ['#route-place', 'unknown', '#proposal-place'],
    ['#route-topic', 'unknown', '#proposal-category']
  ]) {
    const page = await proposalFromFinder();
    await page.select('[data-proposal-form]').dispatch('submit');
    assert.equal(page.select('[data-proposal-output]').hidden, false);
    await page.select('[data-copy-proposal]').dispatch('click');
    assert(page.select('[data-copy-status]').textContent.length > 0);
    await changeValue(page, finder, value);
    assert.equal(page.select(field).value, value === 'unknown' ? '' : value);
    assert.equal(page.select('[data-proposal-output]').hidden, true, `${finder}: outdated draft remains visible`);
    assert.equal(page.select('[data-proposal-text]').value, '');
    assert.equal(page.select('[data-copy-status]').textContent, '');
    if (value === 'unknown') {
      await page.select('[data-proposal-form]').dispatch('submit');
      assert.equal(page.select('[data-proposal-output]').hidden, true, 'An unknown finder selection must require a new valid form choice');
    }
  }
});

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
  id: card.attrs.id,
  council: card.dataset.council,
  source: card.querySelector('a[href]')?.attrs.href,
  confirmation: card.dataset.confirmation,
  draft: Boolean(card.querySelector('.motion-status-draft'))
}));

function motionCounts(cards) {
  return {
    sourced: cards.filter(card => card.source).length,
    confirmed: cards.filter(card => !card.source && card.confirmation === 'fraktion').length,
    drafts: cards.filter(card => !card.source && card.confirmation !== 'fraktion').length
  };
}

function assertMotionCounts(text, cards, { staticFallback = false } = {}) {
  const { sourced, confirmed, drafts } = motionCounts(cards);
  if (sourced) assert.match(text, new RegExp(`\\b${sourced} Eintr(?:ag|äge) mit öffentlicher Quelle`));
  else assert.doesNotMatch(text, /mit öffentlicher Quelle/);
  if (confirmed) assert(text.includes(`${confirmed} ${confirmed === 1 ? 'Eintrag' : 'Einträge'} mit Bestätigung aus der Fraktion`));
  else assert.doesNotMatch(text, /mit Bestätigung aus der Fraktion/);
  if (drafts) {
    const suffix = staticFallback ? '' : ' \\(Einreichung öffentlich noch nicht belegt\\)';
    assert.match(text, new RegExp(`\\b${drafts} ausgearbeitete Initiativ(?:e|en)${suffix}`));
  } else assert.doesNotMatch(text, /ausgearbeitete Initiativ/);
  if (!cards.length) assert.match(text, /Keine Einträge/);
}

function assertFilter(page, council) {
  const actual = page.document.querySelectorAll('[data-council]').filter(card => !card.hidden);
  const expected = motionMetadata.filter(card => council === 'all' || card.council === council);
  assert.equal(actual.length, expected.length);
  if (council !== 'all') assert(actual.every(card => card.dataset.council === council));
  assertMotionCounts(page.select('[data-result-count]').textContent, expected);
  assert.equal(page.select('[data-empty-state]').hidden, expected.length > 0);
  const pressed = page.document.querySelectorAll('[data-filter]').filter(button => button.attrs['aria-pressed'] === 'true');
  assert.equal(pressed.length, 1);
  assert.equal(pressed[0].dataset.filter, council);
}

await check('Real archive metadata separates public sources, faction confirmations and unverified drafts', () => {
  assert(motionMetadata.length > 0, 'The archive is unexpectedly empty');
  assert(motionMetadata.some(card => card.source), 'Expected at least one publicly sourced entry');
  assert(motionMetadata.some(card => card.confirmation === 'fraktion'), 'Expected at least one faction-confirmed entry');
  assert(motionMetadata.some(card => card.draft), 'Expected at least one clearly marked draft');
  for (const card of motionMetadata) {
    const categories = [Boolean(card.source), card.confirmation === 'fraktion', card.draft];
    assert.equal(categories.filter(Boolean).length, 1, `${card.id ?? card.council}: each entry must have exactly one evidence category`);
    if (card.confirmation) assert.equal(card.confirmation, 'fraktion', 'Unknown confirmation type');
    if (card.source) assert.equal(new URL(card.source).protocol, 'https:');
  }
  const { sourced, confirmed, drafts } = motionCounts(motionMetadata);
  console.log(`  ${motionMetadata.length} entries: ${sourced} sourced, ${confirmed} faction-confirmed, ${drafts} unverified`);
});

await check('Schankanlage remains implemented and faction-confirmed, with no invented public source', () => {
  const matches = documents.get('politik/index.html').querySelectorAll('#schankanlage-buergerhaus');
  assert.equal(matches.length, 1, 'The implemented Schankanlage entry must have one stable deep-link target');
  const card = matches[0];
  assert.equal(card.tagName, 'article');
  assert.equal(card.dataset.council, 'urbar');
  assert.equal(card.dataset.confirmation, 'fraktion');
  assert(!card.querySelector('a[href]'), 'Do not substitute a fabricated public-source URL for the confirmation');
  assert(!card.querySelector('.motion-status-draft'), 'An implemented entry must not retain the draft badge');
  const badge = card.querySelector('.motion-status-completed');
  assert(badge, 'The completed status must be explicit');
  assert(badge.matches('.motion-status') && badge.matches('.motion-status-approved'));
  assert.equal(badge.textContent.trim(), 'Umgesetzt');
  assert.match(card.textContent, /Acht Personen/);
  assert.match(card.textContent, /Schulung/);
  assert.match(card.textContent, /wieder nutzbar/);
  assert(card.textContent.includes('Umsetzung von der Fraktion bestätigt · Stand: 07.09.2026'));
  assert.doesNotMatch(card.textContent, /Ausgearbeitet|Einreichung öffentlich noch nicht belegt/);
});

await check('Confirmed implementation is counted separately in all, Urbar and VG views, including without JavaScript', () => {
  for (const [council, expected] of [
    ['all', { sourced: 24, confirmed: 1, drafts: 13 }],
    ['urbar', { sourced: 7, confirmed: 1, drafts: 8 }],
    ['vg', { sourced: 15, confirmed: 0, drafts: 5 }]
  ]) {
    const cards = motionMetadata.filter(card => council === 'all' || card.council === council);
    assert.deepEqual(motionCounts(cards), expected, `${council}: evidence-category totals changed`);
  }
  assertMotionCounts(documents.get('politik/index.html').querySelector('[data-result-count]').textContent, motionMetadata, { staticFallback: true });
});

await check('Every council filter shows the real cards and distinguishes all three evidence counts', async () => {
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

const portalPaths = ['funktionstraeger/index.html', 'funktionstraeger/gremien.html', 'funktionstraeger/ci-guide.html'];

await check('All portal pages disclose their public preview status, discourage indexing and retain legal links', () => {
  for (const path of portalPaths) {
    const doc = documents.get(path);
    assert(doc, `${path}: public preview page is missing`);
    assert.match(doc.textContent, /Öffentliche Vorschau/, `${path}: visible public-preview notice is missing`);
    assert.match(doc.textContent, /nicht passwortgeschützt|kein geschützter|ohne Anmeldung|öffentlich zugänglich/i, `${path}: actual access state must be clear`);
    const robots = doc.querySelectorAll('meta').find(meta => meta.attrs.name === 'robots')?.attrs.content;
    assert.match(robots ?? '', /(?:^|[,\s])noindex(?:$|[,\s])/i, `${path}: noindex is missing`);
    assert.match(robots ?? '', /(?:^|[,\s])nofollow(?:$|[,\s])/i, `${path}: nofollow is missing`);
    const hrefs = doc.querySelectorAll('a[href]').map(link => new URL(link.attrs.href, new URL(path, base)).pathname);
    for (const legal of ['impressum/', 'datenschutz/']) assert(hrefs.includes(new URL(legal, base).pathname), `${path}: ${legal} link is missing`);
    assert.equal(doc.querySelectorAll('input[type="password"]').length, 0, `${path}: public preview must not show a fake password gate`);
    assert.doesNotMatch(sourceByPath.get(path), /(?:https?:\/\/(?:localhost|127\.0\.0\.1)(?:[:/])|file:\/\/)/i, `${path}: local-only URL leaked into the public preview`);
  }
});

await check('Portal assets resolve locally below the Pages base, without borrowing website styles or remote images', () => {
  for (const path of portalPaths) {
    const source = sourceByPath.get(path);
    assert(source, `${path}: missing source`);
    const doc = documents.get(path);
    const assets = [
      ...doc.querySelectorAll('img[src]').map(node => node.attrs.src),
      ...doc.querySelectorAll('link[href]').filter(node => ['stylesheet', 'icon'].includes(node.attrs.rel)).map(node => node.attrs.href),
      ...[...source.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match => decode(match[1]))
    ];
    assert(assets.length >= 3, `${path}: expected image, styles and script references`);
    for (const asset of assets) {
      const url = new URL(asset, new URL(path, base));
      assert.equal(url.origin, base.origin, `${path}: remote asset ${asset}`);
      assert(url.pathname.startsWith(base.pathname), `${path}: asset leaves Pages base: ${asset}`);
      const diskPath = resolve(root, decodeURIComponent(url.pathname.slice(base.pathname.length)));
      assert(diskPath.startsWith(`${root}/`) && existsSync(diskPath) && statSync(diskPath).isFile(), `${path}: missing local asset ${asset}`);
    }
    const logo = doc.querySelectorAll('img[src]').find(node => /^\.\.\/assets\/images\//.test(node.attrs.src));
    assert(logo, `${path}: the preview should use the same local logo as the website`);
  }
});

await check('Portal scripts have no persistence, transmission, account or tracking integration', () => {
  for (const script of ['funktionstraeger/app.js', 'funktionstraeger/gremien.js', 'assets/site.js']) {
    const code = readFileSync(join(root, script), 'utf8');
    assert.doesNotMatch(code, /\b(?:localStorage|sessionStorage|indexedDB|XMLHttpRequest|WebSocket|EventSource)\b|\bfetch\s*\(|\.sendBeacon\s*\(|document\s*\.\s*cookie|window\s*\.\s*confirm\s*\(/, `${script}: the public preview must remain a non-persistent, non-sending demonstration`);
    assert.doesNotMatch(code, /\b(?:access_token|api_key|client_secret|authorization)\s*[:=]|(?:gh[pousr]_[A-Za-z0-9]{20,})/i, `${script}: possible credential material`);
    assert.doesNotMatch(code, /(?:https?:\/\/(?:localhost|127\.0\.0\.1)(?:[:/])|file:\/\/)/i, `${script}: local-only URL leaked`);
  }
});

await check('The portal links to its own CI guide, while seven modules and eight onboarding steps remain available without JavaScript', () => {
  const doc = documents.get('funktionstraeger/index.html');
  assert(doc, 'Portal index missing');
  assert.equal(doc.querySelectorAll('[data-module-card]').length, 7);
  assert.equal(doc.querySelectorAll('[data-onboarding-step]').length, 8);
  assert(doc.querySelectorAll('[data-module-card]').every(card => !card.hidden));
  const ci = doc.getElementById('ci-guide');
  assert(ci, 'CI guide needs a stable anchor');
  assert(ci.querySelectorAll('a[href]').some(link => new URL(link.attrs.href, new URL('funktionstraeger/index.html', base)).pathname === new URL('funktionstraeger/ci-guide.html', base).pathname), 'The CI card must lead directly to the local guide');
  assert.match(doc.textContent, /nicht gespeichert|nicht dauerhaft gespeichert|nur.*(?:Seite|Vorschau|Aufruf)/i, 'The temporary nature of the demo progress must be explained');
});

await check('The local CI guide provides five navigable sections and does not send readers to the external CI portal', () => {
  const path = 'funktionstraeger/ci-guide.html';
  const doc = documents.get(path);
  assert(doc, 'The local CI guide is missing');
  const links = doc.querySelectorAll('a[href]').map(link => new URL(link.attrs.href, new URL(path, base)));
  for (const id of ['farben', 'schriften', 'logo', 'gestaltung', 'downloads']) {
    assert(doc.getElementById(id), `The CI guide section #${id} is missing`);
    assert(links.some(link => link.pathname === new URL(path, base).pathname && link.hash === `#${id}`), `The CI guide section #${id} needs an in-page navigation link`);
  }
  assert(links.some(link => link.pathname === new URL('funktionstraeger/', base).pathname || link.pathname === new URL('funktionstraeger/index.html', base).pathname), 'The CI guide needs a link back to the portal');
  for (const sourcePath of ['funktionstraeger/index.html', path]) {
    assert(!documents.get(sourcePath).querySelectorAll('a[href]').some(link => new URL(link.attrs.href, new URL(sourcePath, base)).hostname === 'ci.cdu.de'), `${sourcePath}: the external CI-portal link should be replaced by our own guide`);
  }
});

await check('CI guide palette and locally loaded fonts match the existing website identity', () => {
  const doc = documents.get('funktionstraeger/ci-guide.html');
  assert(doc, 'The local CI guide is missing');
  const websiteCss = readFileSync(join(root, 'assets/styles.css'), 'utf8');
  for (const token of ['cdu-navy', 'cdu-teal', 'cdu-teal-dark', 'cdu-gold', 'paper', 'ink', 'muted', 'line']) {
    const hex = websiteCss.match(new RegExp(`--${token}\\s*:\\s*(#[a-f\\d]{6})`, 'i'))?.[1];
    assert(hex, `The website token --${token} is missing`);
    assert(doc.textContent.toLowerCase().includes(hex.toLowerCase()), `The CI guide must document the actual website color ${token}: ${hex}`);
  }
  const cssPath = 'funktionstraeger/ci-guide.css';
  const css = readFileSync(join(root, cssPath), 'utf8');
  const faces = [...css.matchAll(/@font-face\s*\{([^}]+)\}/gi)].map(match => match[1]);
  for (const [family, weight, font] of [['Inter', 400, 'inter-regular.ttf'], ['Inter', 800, 'inter-extrabold.ttf'], ['IBM Plex Serif', 400, 'ibm-plex-serif-regular.ttf']]) {
    const face = faces.find(block => new RegExp(`font-family\\s*:\\s*['"]?${family}['"]?\\s*;`, 'i').test(block) && new RegExp(`font-weight\\s*:\\s*${weight}\\s*;`, 'i').test(block));
    assert(face, `${family} ${weight} must be explicitly available to the CI examples`);
    assert.match(face, /font-display\s*:\s*swap\s*;/i, `${family} ${weight} must not block text rendering`);
    const sources = [...face.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/gi)].map(match => new URL(match[1], new URL(cssPath, base)));
    assert(sources.some(url => url.href === new URL(`assets/fonts/${font}`, base).href), `${family} ${weight} must load the actual local font file`);
    assert(sources.every(url => url.origin === base.origin && url.pathname.startsWith(base.pathname)), `${family} ${weight} must not fetch third-party fonts`);
  }
});

await check('CI guide provides real local logo and font downloads with their existing font licenses', () => {
  const path = 'funktionstraeger/ci-guide.html';
  const doc = documents.get(path);
  assert(doc, 'The local CI guide is missing');
  const downloads = doc.querySelectorAll('a[download]').map(link => new URL(link.attrs.href, new URL(path, base)).pathname);
  for (const asset of ['assets/images/cdu-gesamtlogo-transparent.png', 'assets/fonts/inter-regular.ttf', 'assets/fonts/inter-extrabold.ttf', 'assets/fonts/ibm-plex-serif-regular.ttf']) {
    assert(downloads.includes(new URL(asset, base).pathname), `The real local download is missing: ${asset}`);
    assert(existsSync(join(root, asset)) && statSync(join(root, asset)).size > 0, `Download file is missing or empty: ${asset}`);
  }
  const links = doc.querySelectorAll('a[href]').map(link => new URL(link.attrs.href, new URL(path, base)).pathname);
  for (const license of ['assets/fonts/LICENSE-Inter.txt', 'assets/fonts/LICENSE-IBM-Plex-Serif.txt']) {
    assert(links.includes(new URL(license, base).pathname), `The font license must remain accessible: ${license}`);
  }
});

await check('Public onboarding counts eight demo steps, resets immediately and does not survive a reload', async () => {
  const page = runPage('funktionstraeger/index.html', 'funktionstraeger/app.js');
  const steps = page.document.querySelectorAll('[data-onboarding-step]');
  const bar = page.select('[data-progress-bar]');
  assert.equal(page.select('[data-progress-count]').textContent, '0');
  assert(page.document.querySelectorAll('[data-total-steps]').every(node => node.textContent === '8'));
  for (const step of steps.slice(0, 4)) { step.checked = true; await step.dispatch('change'); }
  assert.equal(page.select('[data-progress-count]').textContent, '4');
  assert.equal(bar.attrs['aria-valuenow'], '4');
  assert.equal(bar.querySelector('span').style.width, '50%');
  for (const step of steps.slice(4)) { step.checked = true; await step.dispatch('change'); }
  assert.equal(page.select('[data-progress-count]').textContent, '8');
  assert.equal(bar.querySelector('span').style.width, '100%');
  assert.match(page.select('[data-progress-copy]').textContent, /Vorschau/);
  assert.match(page.select('[data-progress-copy]').textContent, /keine Zugänge/i, 'Completion must not imply actual permissions or onboarding');
  const reloaded = runPage('funktionstraeger/index.html', 'funktionstraeger/app.js');
  assert.equal(reloaded.select('[data-progress-count]').textContent, '0');
  assert(reloaded.document.querySelectorAll('[data-onboarding-step]').every(step => !step.checked));
  await page.select('[data-reset-progress]').dispatch('click');
  assert.equal(page.select('[data-progress-count]').textContent, '0');
  assert.equal(bar.querySelector('span').style.width, '0%');
  assert(steps.every(step => !step.checked));
});

await check('Portal module search includes section text and keywords, tolerates accents, and restores all seven modules', async () => {
  const page = runPage('funktionstraeger/index.html', 'funktionstraeger/app.js');
  const cards = page.document.querySelectorAll('[data-module-card]');
  const search = page.select('[data-module-search]');
  async function find(query) {
    search.value = query;
    await search.dispatch('input');
    const visible = cards.filter(card => !card.hidden);
    assert.equal(page.select('[data-search-status]').textContent, visible.length === 1 ? '1 Bereich gefunden' : `${visible.length} Bereiche gefunden`);
    assert.equal(page.select('[data-empty-search]').hidden, visible.length !== 0);
    return visible.map(card => card.attrs.href);
  }
  assert((await find('Logo')).includes('#arbeitsmittel'));
  assert((await find('  LOGO   SCHRIFTEN ')).includes('#arbeitsmittel'));
  assert((await find('Zustandigkeiten')).includes('#rollen'));
  assert((await find('Ausschuss')).includes('./gremien.html'));
  assert((await find('Mitgliederlisten')).includes('#sicherheit'));
  assert.equal((await find('KeinTreffer123')).length, 0);
  assert.equal((await find('   ')).length, 7);
});

await check('Responsibilities page offers ten real search examples and all five native local-council disclosures', () => {
  const doc = documents.get('funktionstraeger/gremien.html');
  assert(doc, 'Responsibilities page missing');
  const examples = doc.querySelectorAll('[data-example]');
  assert.equal(examples.length, 10);
  assert(examples.every(card => !card.hidden), 'All examples must be available without JavaScript');
  const details = doc.querySelectorAll('.local-details');
  assert.equal(details.length, 5);
  assert.deepEqual(details.map(node => node.attrs.id).sort(), ['ort-niederwerth', 'ort-stadt', 'ort-urbar', 'ort-vg', 'ort-weitersburg'].sort());
  assert(details.every(node => node.tagName === 'details' && node.querySelector('summary')));
});

await check('Responsibilities search filters real content with AND terms, handles umlauts and sharp S, and resets with focus', async () => {
  const page = runPage('funktionstraeger/gremien.html', 'funktionstraeger/gremien.js');
  const search = page.select('[data-example-search]');
  const examples = page.document.querySelectorAll('[data-example]');
  async function find(query) {
    search.value = query;
    await search.dispatch('input');
    const visible = examples.filter(card => !card.hidden);
    assert.equal(page.select('[data-example-status]').textContent, `${visible.length} von 10 Beispielen angezeigt`);
    assert.equal(page.select('[data-example-empty]').hidden, visible.length > 0);
    return visible;
  }
  assert.equal(page.select('[data-example-status]').textContent, '10 von 10 Beispielen angezeigt');
  assert.equal((await find('BURGERHAUS'))[0]?.querySelector('h3')?.textContent, 'Bürgerhaus und eigene Einrichtungen');
  assert.equal((await find('STRASSE'))[0]?.querySelector('h3')?.textContent, 'Straße sanieren oder Tempo ändern?');
  assert.equal((await find('  URBAR   REINIGUNG ')).length, 1);
  assert.equal((await find('Urbar Brandschutz')).length, 0);
  assert.equal((await find('   ')).length, 10);
  await find('KeinTreffer123');
  await page.select('[data-example-reset]').dispatch('click');
  assert.equal(search.value, '');
  assert(search.focused);
  assert(examples.every(card => !card.hidden));
  assert(page.select('[data-example-empty]').hidden);
  assert((await page.select('[data-example-form]').dispatch('submit')).defaultPrevented, 'Search Enter must never submit or navigate');
});

await check('Portal mobile links close their menus and responsibilities Escape returns focus to the menu button', async () => {
  for (const [path, script] of [['funktionstraeger/index.html', 'funktionstraeger/app.js'], ['funktionstraeger/gremien.html', 'funktionstraeger/gremien.js']]) {
    const page = runPage(path, script);
    const menu = page.select('.mobile-menu');
    assert(menu, `${path}: mobile menu missing`);
    menu.open = true;
    await menu.querySelector('a').dispatch('click');
    assert.equal(menu.open, false, `${path}: menu did not close after link activation`);
    if (path.endsWith('gremien.html')) {
      menu.open = true;
      await menu.dispatch('keydown', { key: 'Enter' });
      assert.equal(menu.open, true, 'Unrelated keys must not close the menu');
      await menu.dispatch('keydown', { key: 'Escape' });
      assert.equal(menu.open, false);
      assert(menu.querySelector('summary').focused);
    }
  }
});

await check('CI guide uses the real shared menu script for labels, links, Escape and outside clicks', async () => {
  const path = 'funktionstraeger/ci-guide.html';
  assert.match(sourceByPath.get(path), /<script\b[^>]*\bsrc="\.\.\/assets\/site\.js\?v=1"/, 'The guide must actually load the tested shared navigation script');
  const page = runPage(path, 'assets/site.js');
  const menu = page.select('.mobile-menu');
  const summary = menu?.querySelector('summary');
  assert(menu && summary, 'The CI guide needs a native mobile menu');
  assert.equal(summary.attrs['aria-label'], 'Menü öffnen');
  for (const link of menu.querySelectorAll('a')) {
    menu.open = true;
    await menu.dispatch('toggle');
    assert.equal(summary.attrs['aria-label'], 'Menü schließen');
    await link.dispatch('click');
    assert.equal(menu.open, false, `The guide menu must close after activating ${link.attrs.href}`);
    await menu.dispatch('toggle');
    assert.equal(summary.attrs['aria-label'], 'Menü öffnen');
  }
  menu.open = true;
  await menu.dispatch('keydown', { key: 'Enter' });
  assert.equal(menu.open, true, 'Unrelated keys must not close the guide menu');
  await menu.dispatch('keydown', { key: 'Escape' });
  assert.equal(menu.open, false, 'Escape must close the guide menu');
  menu.open = true;
  await summary.dispatch('click');
  assert.equal(menu.open, true, 'The outside-click handler must not treat clicks inside the menu as outside clicks');
  await page.select('#farben').dispatch('click');
  assert.equal(menu.open, false, 'Clicking outside the guide menu must close it');
});

console.log(`\n${passed} passed, ${failed} failed.`);
process.exitCode = failed ? 1 : 0;
