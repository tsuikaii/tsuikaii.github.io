import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve, join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = value => createHash('sha256').update(value).digest('hex');
const skip = 'script,style,pre,code,kbd,samp,ruby,svg,math,textarea,time,[data-no-translate],[translate="no"],[data-i18n],.katex';
const mathPattern = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|(?<!\\)\$(?!\$)[^$\n]+?\$)/g;

export function prepareDocument(html, page) {
  const { document } = parseHTML(html);
  const main = document.querySelector('#main');
  if (!main) return null;
  const previous = document.querySelector('#translation-source');
  if (previous) return { html, source: JSON.parse(previous.textContent) };
  // Entity decoding can create adjacent text nodes; merge them before matching
  // math delimiters or collecting translation fragments.
  main.normalize();
  const segments = [];
  const ids = new Map();
  function add(text) {
    // Include Chinese punctuation after inline emphasis/links so English and
    // Japanese can translate it too; whitespace and pure numbers stay intact.
    if (!/[\p{L}、。，：；！？]/u.test(text)) return null;
    if (!ids.has(text)) {
      const id = 's' + segments.length;
      ids.set(text, id);
      segments.push({ id, text });
    }
    return ids.get(text);
  }
  function visit(node) {
    if (node.nodeType === 1 && node.matches(skip)) return;
    if (node.nodeType === 3) {
      const parts = node.textContent.split(mathPattern);
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < parts.length; index++) {
        const text = parts[index];
        const id = index % 2 === 0 ? add(text) : null;
        if (id) {
          const span = document.createElement('span');
          span.setAttribute('data-translation-id', id);
          span.textContent = text;
          fragment.appendChild(span);
        } else {
          fragment.appendChild(document.createTextNode(text));
        }
      }
      node.replaceWith(fragment);
      return;
    }
    for (const child of Array.from(node.childNodes)) visit(child);
  }
  visit(main);
  for (const element of main.querySelectorAll('[alt], [title], [aria-label]')) {
    if (element.closest(skip)) continue;
    for (const attr of ['alt', 'title', 'aria-label']) {
      if (attr === 'aria-label' && element.hasAttribute('data-i18n-aria')) continue;
      const id = add(element.getAttribute(attr) || '');
      if (id) element.setAttribute('data-translation-' + attr, id);
    }
  }
  // Map details are rendered on demand. Include only their human-readable fields.
  const mapData = document.querySelector('#gallery-map-data');
  if (mapData) {
    const entries = JSON.parse(mapData.textContent);
    const location = value => { if (value) { add(value.name || ''); add(value.place || ''); } };
    for (const entry of entries) {
      add(entry.title || '');
      location(entry.location);
      for (const photo of entry.photos || []) {
        add(photo.caption || ''); add(photo.alt || ''); location(photo.location);
      }
    }
  }
  const titleId = add(document.title);
  if (titleId) document.querySelector('title').setAttribute('data-translation-id', titleId);
  const source = { version: 1, page, llmEnabled: !main.querySelector('[data-no-llm]'), hash: hash(JSON.stringify(segments)), segments };
  const script = document.createElement('script');
  script.id = 'translation-source';
  script.type = 'application/json';
  script.textContent = JSON.stringify(source).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  document.querySelector('head').appendChild(script);
  return { html: document.toString(), source };
}

export async function build(destination = resolve(root, '_site')) {
  const sources = join(destination, 'translations', 'source');
  await rm(sources, { recursive: true, force: true });
  await mkdir(sources, { recursive: true });
  await mkdir(join(destination, 'assets', 'js'), { recursive: true });
  await copyFile(join(root, 'node_modules/opencc-js/dist/umd/cn2t.js'), join(destination, 'assets/js/opencc.js'));
  await copyFile(join(root, 'node_modules/opencc-js/LICENSE'), join(destination, 'assets/js/opencc-LICENSE.txt'));
  await copyFile(join(root, 'node_modules/opencc-js/THIRD_PARTY_LICENSES.md'), join(destination, 'assets/js/opencc-THIRD_PARTY_LICENSES.txt'));
  let count = 0;
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'translations') await walk(path); }
      else if (entry.name.endsWith('.html')) {
        const file = '/' + relative(destination, path).split('\\').join('/');
        const page = file.endsWith('/index.html') ? file.slice(0, -10) : file;
        const result = prepareDocument(await readFile(path, 'utf8'), page);
        if (!result) continue;
        await writeFile(path, result.html);
        await writeFile(join(sources, hash(page) + '.json'), JSON.stringify(result.source));
        count++;
      }
    }
  }
  await walk(destination);
  console.log(`Translation sources: ${count} pages; OpenCC copied locally.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build(process.argv[2] ? resolve(process.argv[2]) : undefined);
}
