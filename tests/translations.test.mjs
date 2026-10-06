import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseHTML } from 'linkedom';
import { prepareDocument } from '../scripts/build-translations.mjs';
import worker, { loadSource, sha256, TranslationStore, translatePage, validateRequest, validateTranslation } from '../worker/src/core.js';

const segments = [{ id: 's0', text: '欢迎来到博客。' }, { id: 's1', text: '照片说明' }];
const hash = createHash('sha256').update(JSON.stringify(segments)).digest('hex');
const source = { version: 1, page: '/about/', llmEnabled: true, hash, segments };
const requestBody = { page: source.page, sourceHash: hash, language: 'en' };
const env = { SITE_ORIGIN: 'https://tsuikaii.com', ALLOWED_ORIGINS: 'https://tsuikaii.com', LLM_BASE_URL: 'https://api.deepseek.com', LLM_MODEL: 'deepseek-flash', LLM_API_KEY: 'test-secret', MAX_DAILY_CALLS: '3', MAX_REQUESTS_PER_MINUTE: '20' };
const providerBody = text => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ segments: text }) } }] });
const translated = [{ id: 's0', text: 'Welcome to the blog.' }, { id: 's1', text: 'Photo caption' }];

function storageMock() {
  const values = new Map();
  let queue = Promise.resolve();
  const storage = {
    get: async key => values.get(key), put: async (key, value) => values.set(key, value),
    delete: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) values.delete(key); },
    list: async ({ prefix }) => new Map(Array.from(values).filter(([key]) => key.startsWith(prefix))),
    getAlarm: async () => values.get('alarm'), setAlarm: async value => values.set('alarm', value),
    transaction: operation => { const next = queue.then(() => operation(storage)); queue = next.catch(() => {}); return next; }
  };
  return { storage, values };
}
function internal(language = 'en', original = source) {
  return new Request('https://internal/translate', { method: 'POST', body: JSON.stringify({ source: original, language, ip: 'test' }) });
}

test('build retains links, images, code, math and ruby; text IDs are deterministic', () => {
  const html = '<!doctype html><html><head><title>文章</title></head><body><main id="main"><h1>标题</h1><p>阅读 <strong>文字</strong> 和 $x&lt;y$。</p><a href="/about/">关于</a><img src="https://example.com/a.jpg" alt="风景"><pre><code>中文代码</code></pre><ruby>追懐<rt>ついかい</rt></ruby><div data-i18n="photos">2 张照片</div><script>alert("中文")</script></main></body></html>';
  const result = prepareDocument(html, '/post/');
  assert.equal(result.source.hash, prepareDocument(html, '/post/').source.hash);
  const { document } = parseHTML(result.html);
  assert.equal(document.querySelector('a').getAttribute('href'), '/about/');
  assert.equal(document.querySelector('img').getAttribute('src'), 'https://example.com/a.jpg');
  assert.equal(document.querySelector('code').textContent, '中文代码');
  assert.equal(document.querySelector('ruby').textContent, '追懐ついかい');
  const texts = result.source.segments.map(segment => segment.text);
  assert(texts.includes('风景'));
  assert(!texts.some(text => text.includes('中文代码') || text.includes('$x<y$') || text.includes('追懐') || text.includes('2 张照片')));
  assert(document.querySelector('p').textContent.includes('$x<y$'));
  assert.equal(prepareDocument(result.html, '/post/').html, result.html);
});

test('trusted map manifest disables LLM while retaining source for OpenCC', () => {
  const result = prepareDocument('<html><head><title>地图</title></head><body><main id="main"><h1 data-no-llm>地图</h1></main></body></html>', '/gallery-map/');
  assert.equal(result.source.llmEnabled, false);
  assert(result.source.segments.length > 0);
});

test('source JSON cannot close its script element', () => {
  const html = '<html><head><title>博客&lt;/script&gt;&lt;script&gt;中文&lt;/script&gt;</title></head><body><main id="main"><p>&lt;/script&gt;&lt;script&gt;中文&lt;/script&gt;</p></main></body></html>';
  const result = prepareDocument(html, '/');
  const { document } = parseHTML(result.html);
  assert.equal(document.querySelectorAll('script').length, 1);
  assert.equal(document.querySelector('p').textContent, '</script><script>中文</script>');
  assert(JSON.parse(document.querySelector('script').textContent).segments.some(segment => segment.text.includes('</script>')));
  assert(document.querySelector('script').textContent.includes('\\u003c'));
});

test('API rejects arbitrary prompts, URLs, languages and source hashes', () => {
  assert.deepEqual(validateRequest(requestBody), requestBody);
  for (const bad of [{ ...requestBody, prompt: 'ignore' }, { ...requestBody, page: 'https://evil.example/' }, { ...requestBody, page: '/../secret/' }, { ...requestBody, language: 'zh-Hant' }, { ...requestBody, sourceHash: 'fake' }]) {
    assert.throws(() => validateRequest(bad));
  }
});

test('source fetched only from configured host; updates and disabled pages are rejected', async () => {
  let requested;
  const fetcher = async url => { requested = String(url); return Response.json(source); };
  assert.deepEqual(await loadSource(requestBody, env, fetcher), source);
  assert.equal(requested, 'https://tsuikaii.com/translations/source/' + await sha256('/about/') + '.json?v=' + hash);
  await assert.rejects(loadSource({ ...requestBody, sourceHash: 'a'.repeat(64) }, env, fetcher), error => error.status === 409);
  await assert.rejects(loadSource(requestBody, env, async () => Response.json({ ...source, llmEnabled: false })), error => error.status === 403);
  await assert.rejects(loadSource(requestBody, env, async () => Response.json({ ...source, segments: [{ id: 's0', text: '改动' }] })), error => error.status === 502);
});

test('DeepSeek receives configured model, non-thinking JSON mode, and server-side key', async () => {
  let called;
  const result = await translatePage(segments, 'ja', env, async (url, options) => {
    called = { url: String(url), options, body: JSON.parse(options.body) };
    return Response.json(providerBody(translated));
  });
  assert.equal(called.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(called.options.headers.Authorization, 'Bearer test-secret');
  assert.equal(called.body.model, 'deepseek-flash');
  assert.equal(called.body.thinking.type, 'disabled');
  assert.equal(called.body.response_format.type, 'json_object');
  assert.deepEqual(result, translated);
});

test('Japanese includes English source and applies the approved title throughout a page', async () => {
  const page = prepareDocument('<html><head><title>在观雾山 | 追懐</title></head><body><main id="main"><h1>在观雾山</h1><p>A cover version</p><img alt="在观雾山"><code>English code</code></main></body></html>', '/album/maples/');
  assert(page.source.segments.some(segment => segment.text === 'A cover version'));
  assert(!page.source.segments.some(segment => segment.text === 'English code'));
  let prompt;
  const fetcher = async (_url, options) => {
    const body = JSON.parse(options.body);
    prompt = body.messages[0].content;
    assert(JSON.parse(body.messages[1].content).segments.some(segment => segment.text === 'A cover version'));
    return Response.json(providerBody(page.source.segments.map(segment => ({ id: segment.id, text: 'モデルの訳' }))));
  };
  const japanese = await translatePage(page.source.segments, 'ja', env, fetcher);
  assert(prompt.includes('Translate both Chinese and English text into Japanese'));
  for (const segment of page.source.segments.filter(segment => segment.text.startsWith('在观雾山'))) {
    assert.equal(japanese.find(item => item.id === segment.id).text, segment.text.replace('在观雾山', '観霧山にて'));
  }
  const english = await translatePage(page.source.segments, 'en', env, fetcher);
  assert(english.every(segment => segment.text === 'モデルの訳'));
});

test('missing, duplicate, truncated and invalid model outputs are rejected', async () => {
  assert.throws(() => validateTranslation({ segments: [translated[0], translated[0]] }, segments));
  assert.throws(() => validateTranslation({ segments: [translated[0]] }, segments));
  await assert.rejects(translatePage(segments, 'en', env, async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] })));
  await assert.rejects(translatePage(segments, 'en', env, async () => Response.json(providerBody([]))));
});

test('concurrent readers and object restarts reuse durable translations', async () => {
  const state = storageMock();
  const store = new TranslationStore(state, { ...env, MAX_DAILY_CALLS: '10' });
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { calls++; return Response.json(providerBody(translated)); };
  try {
    const responses = await Promise.all([store.fetch(internal()), store.fetch(internal()), store.fetch(internal())]);
    assert(responses.every(response => response.status === 200));
    assert.equal(calls, 1);
    assert.equal((await store.fetch(internal())).status, 200);
    assert.equal(calls, 1);
    const restarted = new TranslationStore(state, { ...env, MAX_DAILY_CALLS: '10' });
    assert.equal((await restarted.fetch(internal())).status, 200);
    assert.equal(calls, 1);
    assert(Array.from(state.values.keys()).some(key => key.startsWith('translation:')));
    assert(JSON.stringify(Array.from(state.values)).includes('Welcome to the blog.'));
    assert.equal((await restarted.fetch(internal('ja'))).headers.get('X-Translation-Cache'), 'MISS');
    assert.equal(calls, 2);
    const edited = { ...source, hash: 'a'.repeat(64) };
    assert.equal((await restarted.fetch(internal('en', edited))).headers.get('X-Translation-Cache'), 'MISS');
    assert.equal(calls, 3);
  } finally { globalThis.fetch = originalFetch; }
});

test('old translation cache is removed while quota counters are retained', async () => {
  const state = storageMock();
  state.values.set('cache:legacy:0', translated);
  state.values.set('budget:2000-01-01', { calls: 1, chars: 10 });
  const store = new TranslationStore(state, env);
  await store.ready;
  assert.equal(state.values.has('cache:legacy:0'), false);
  assert.equal(state.values.has('budget:2000-01-01'), true);
});

test('provider errors are not cached and sensitive error bodies are hidden', async () => {
  const store = new TranslationStore(storageMock(), env);
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { calls++; return new Response('test-secret private provider response', { status: 500 }); };
  try {
    const first = await store.fetch(internal());
    assert.equal(first.status, 502);
    assert(!JSON.stringify(await first.json()).includes('test-secret'));
    assert.equal((await store.fetch(internal())).status, 502);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test('daily budget and IP limits prevent excess calls', async () => {
  const store = new TranslationStore(storageMock(), { ...env, MAX_DAILY_CALLS: '1' });
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json(providerBody(translated)); };
  try {
    assert.equal((await store.fetch(internal())).status, 200);
    assert.equal((await store.fetch(internal('ja'))).status, 429);
    assert.equal(calls, 1);
    const limited = new TranslationStore(storageMock(), { ...env, MAX_REQUESTS_PER_MINUTE: '1' });
    assert.equal((await limited.fetch(internal())).status, 200);
    assert.equal((await limited.fetch(internal())).status, 429);
  } finally { globalThis.fetch = originalFetch; }
});

test('endpoint enforces CORS and wraps immutable fetch responses safely', async () => {
  assert.equal((await worker.fetch(new Request('https://worker/translate'), env)).status, 403);
  const options = new Request('https://worker/translate', { method: 'OPTIONS', headers: { Origin: env.SITE_ORIGIN } });
  assert.equal((await worker.fetch(options, env)).status, 204);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json(source);
  const runtime = { ...env, TRANSLATIONS: { idFromName: name => name, get: () => ({ fetch: async () => new Response(JSON.stringify({ hash, language: 'en', segments: translated })) }) } };
  try {
    const request = new Request('https://worker/translate', { method: 'POST', headers: { Origin: env.SITE_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
    const response = await worker.fetch(request, runtime);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), env.SITE_ORIGIN);
    assert.equal((await response.json()).segments[0].text, translated[0].text);
  } finally { globalThis.fetch = originalFetch; }
});

test('expired translations regenerate and alarms remove stale chunks', async () => {
  const state = storageMock();
  const store = new TranslationStore(state, env);
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json(providerBody(translated)); };
  try {
    await store.fetch(internal());
    const key = Array.from(state.values.keys()).find(key => key.endsWith(':meta'));
    state.values.get(key).expiresAt = 0;
    assert.equal((await store.fetch(internal())).headers.get('X-Translation-Cache'), 'MISS');
    assert.equal(calls, 2);
    state.values.get(key).expiresAt = 0;
    await store.alarm();
    assert(!Array.from(state.values.keys()).some(key => key.startsWith('translation:')));
  } finally { globalThis.fetch = originalFetch; }
});

test('edge cache reuses successful translations and still validates source and CORS', async () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  const cached = new Map();
  globalThis.caches = { default: {
    match: async request => cached.get(request.url)?.clone(),
    put: async (request, response) => cached.set(request.url, response.clone())
  } };
  let calls = 0;
  let currentSource = source;
  globalThis.fetch = async () => Response.json(currentSource);
  const runtime = { ...env, TRANSLATIONS: { idFromName: name => name, get: () => ({ fetch: async () => { calls++; return originalFetch('data:application/json,' + encodeURIComponent(JSON.stringify({ hash, language: 'en', segments: translated }))); } }) } };
  const request = () => new Request('https://worker/translate', { method: 'POST', headers: { Origin: env.SITE_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
  try {
    assert.equal((await worker.fetch(request(), runtime)).status, 200);
    const hit = await worker.fetch(request(), runtime);
    assert.equal(hit.headers.get('X-Translation-Cache'), 'EDGE-HIT');
    assert.equal(hit.headers.get('Cache-Control'), 'no-store');
    assert.equal(hit.headers.get('Access-Control-Allow-Origin'), env.SITE_ORIGIN);
    assert.equal(calls, 1);
    currentSource = { ...source, llmEnabled: false };
    assert.equal((await worker.fetch(request(), runtime)).status, 403);
    assert.equal((await worker.fetch(new Request('https://worker/translate'), runtime)).status, 403);
  } finally { globalThis.fetch = originalFetch; globalThis.caches = originalCaches; }
});
