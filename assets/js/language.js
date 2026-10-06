(function () {
  "use strict";
  var control = document.querySelector('.language-control');
  var toggle = document.getElementById('language-toggle');
  var panel = document.getElementById('language-panel');
  var options = document.querySelectorAll('[data-language]');
  var sourceElement = document.getElementById('translation-source');
  if (!control || !toggle || !panel || !sourceElement || !window.BLOG_MESSAGES) return;
  var source;
  try { source = JSON.parse(sourceElement.textContent); } catch (_) { return; }
  var supported = ['zh-Hans', 'zh-Hant', 'en', 'ja'];
  var language = 'zh-Hans';
  var contentLanguage = 'zh-Hans';
  var translated = Object.create(null);
  var originals = Object.create(null);
  var originalIds = new Map();
  var dates = new WeakMap();
  var revision = 0;
  var controller;
  var conversionPromise;
  var convert;
  var statusKey = '';
  var status = document.getElementById('translation-status');
  var retry = document.getElementById('translation-retry');
  var scriptURL = document.currentScript.src;
  source.segments.forEach(function (segment) {
    originals[segment.id] = segment.text;
    originalIds.set(segment.text, segment.id);
  });

  function t(key, count) {
    var result = window.BLOG_MESSAGES[language][key] || window.BLOG_MESSAGES['zh-Hans'][key] || key;
    return result.replace('{count}', typeof count === 'undefined' ? '' : String(count));
  }
  function text(original) {
    if (contentLanguage === 'zh-Hant' && convert) return convert(original);
    var id = originalIds.get(original);
    return id && Object.prototype.hasOwnProperty.call(translated, id) ? translated[id] : original;
  }
  function date(value) {
    var match = String(value).match(/^(\d{4})(?:年|-)(\d{1,2})(?:月|-)(\d{1,2})/);
    if (!match || language === 'zh-Hans') return value;
    var iso = match[1] + '-' + match[2].padStart(2, '0') + '-' + match[3].padStart(2, '0');
    return new Intl.DateTimeFormat(language, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'));
  }
  function setText(element, value) { if (element.textContent !== value) element.textContent = value; }
  function setAttribute(element, attr, value) { if (element.getAttribute(attr) !== value) element.setAttribute(attr, value); }
  function refresh() {
    document.querySelectorAll('[data-i18n]').forEach(function (element) { setText(element, t(element.dataset.i18n, element.dataset.count)); });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (element) { setAttribute(element, 'aria-label', t(element.dataset.i18nAria)); });
    document.querySelectorAll('[data-source-text]').forEach(function (element) { setText(element, text(element.dataset.sourceText)); });
    document.querySelectorAll('[data-source-alt]').forEach(function (element) { setAttribute(element, 'alt', text(element.dataset.sourceAlt)); });
    document.querySelectorAll('[data-translation-id]').forEach(function (element) {
      var original = originals[element.getAttribute('data-translation-id')];
      if (typeof original === 'string') setText(element, text(original));
    });
    ['alt', 'title', 'aria-label'].forEach(function (attr) {
      document.querySelectorAll('[data-translation-' + attr + ']').forEach(function (element) {
        var original = originals[element.getAttribute('data-translation-' + attr)];
        if (typeof original === 'string') setAttribute(element, attr, text(original));
      });
    });
    document.querySelectorAll('time[datetime]').forEach(function (element) {
      if (!dates.has(element)) dates.set(element, element.textContent);
      setText(element, language === 'zh-Hans' ? dates.get(element) : date(element.getAttribute('datetime')));
    });
    if (status) setText(status, statusKey ? t(statusKey) : '');
    // Keep the actual content language accurate while translating or on failure.
    document.querySelectorAll('#main .entry-content, #main .entry-title, #main .archive-title, #main [data-source-text]').forEach(function (element) {
      setAttribute(element, 'lang', contentLanguage);
    });
  }
  function announce(key, canRetry) {
    statusKey = key;
    if (retry) retry.hidden = !canRetry;
    var feedback = control.querySelector('.translation-feedback');
    if (feedback) feedback.hidden = !key;
    toggle.setAttribute('aria-busy', key === 'loading' || key === 'converting' ? 'true' : 'false');
    refresh();
  }
  function setPanel(open, focusToggle) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      var current = panel.querySelector('[aria-pressed="true"]');
      if (current) current.focus();
    } else if (focusToggle) toggle.focus();
  }
  function contentChanged() {
    window.BlogI18n.contentLanguage = contentLanguage;
    refresh();
    document.dispatchEvent(new CustomEvent('blog:languagechange', { detail: { language: language, contentLanguage: contentLanguage } }));
  }
  function loadConversion() {
    if (convert) return Promise.resolve(convert);
    if (!conversionPromise) {
      conversionPromise = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = new URL('opencc.js', scriptURL).href;
        script.onload = function () {
          try { convert = window.OpenCC.Converter({ from: 'cn', to: 'tw' }); resolve(convert); }
          catch (error) { script.remove(); conversionPromise = null; reject(error); }
        };
        script.onerror = function () { script.remove(); conversionPromise = null; reject(new Error('OpenCC unavailable')); };
        document.head.appendChild(script);
      });
    }
    return conversionPromise;
  }
  function validate(result, target) {
    if (!result || result.hash !== source.hash || result.language !== target || !Array.isArray(result.segments) || result.segments.length !== source.segments.length) throw new Error('Invalid translation');
    var values = Object.create(null);
    result.segments.forEach(function (item) {
      if (!item || !Object.prototype.hasOwnProperty.call(originals, item.id) || Object.prototype.hasOwnProperty.call(values, item.id) || typeof item.text !== 'string' || !item.text.trim()) throw new Error('Invalid segment');
      values[item.id] = item.text;
    });
    return values;
  }
  async function changeLanguage(target, updateURL) {
    if (!supported.includes(target)) target = 'zh-Hans';
    var token = ++revision;
    if (controller) controller.abort();
    language = target;
    window.BlogI18n.language = target;
    options.forEach(function (option) { option.setAttribute('aria-pressed', option.dataset.language === target ? 'true' : 'false'); });
    document.documentElement.lang = target;
    if (updateURL) {
      var url = new URL(window.location.href);
      if (target === 'zh-Hans') url.searchParams.delete('lang');
      else url.searchParams.set('lang', target);
      history.replaceState(history.state, '', url);
    }
    translated = Object.create(null);
    contentLanguage = 'zh-Hans';
    announce('', false);
    contentChanged();
    if (target === 'zh-Hans') return;
    if (target === 'zh-Hant') {
      announce('converting', false);
      try {
        await loadConversion();
        if (revision !== token) return;
        contentLanguage = 'zh-Hant';
        announce('', false);
        contentChanged();
      } catch (_) { if (revision === token) announce('conversionFailed', true); }
      return;
    }
    if (source.llmEnabled === false) return;
    var endpoint = control.getAttribute('data-translation-endpoint');
    if (!endpoint) { announce('unavailable', false); return; }
    announce('loading', false);
    controller = new AbortController();
    var timer = setTimeout(function () { if (revision === token) controller.abort(); }, 180000);
    try {
      var response = await fetch(endpoint.replace(/\/$/, '') + '/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', signal: controller.signal,
        body: JSON.stringify({ page: source.page, sourceHash: source.hash, language: target })
      });
      if (!response.ok) {
        var error = new Error('Translation request failed');
        error.status = response.status;
        throw error;
      }
      var values = validate(await response.json(), target);
      if (revision !== token) return;
      translated = values;
      contentLanguage = target;
      announce('', false);
      contentChanged();
    } catch (error) {
      if (revision === token) announce(error.status === 429 ? 'limited' : error.status === 409 ? 'changed' : error.status === 503 ? 'unavailable' : 'failed', true);
    } finally { clearTimeout(timer); }
  }
  window.BlogI18n = { language: language, contentLanguage: contentLanguage, t: t, text: text, date: date, refresh: refresh, changeLanguage: changeLanguage };
  toggle.addEventListener('click', function () { setPanel(panel.hidden, false); });
  options.forEach(function (option) {
    option.addEventListener('click', function () { setPanel(false, true); changeLanguage(option.dataset.language, true); });
  });
  document.addEventListener('click', function (event) { if (!control.contains(event.target)) setPanel(false, false); });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); setPanel(false, true); }
  });
  if (retry) retry.addEventListener('click', function () { changeLanguage(language, false); });
  window.addEventListener('popstate', function () { changeLanguage(new URL(window.location.href).searchParams.get('lang') || 'zh-Hans', false); });
  document.addEventListener('click', function (event) {
    var anchor = event.target.closest && event.target.closest('a[href]');
    if (!anchor || anchor.hasAttribute('download') || anchor.getAttribute('href').startsWith('#')) return;
    var url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin || !/\/$|\.html$/.test(url.pathname)) return;
    if (language === 'zh-Hans') url.searchParams.delete('lang');
    else url.searchParams.set('lang', language);
    anchor.href = url.href;
  }, true);
  var scheduled = false;
  new MutationObserver(function () {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(function () { scheduled = false; refresh(); });
  }).observe(document.body, { childList: true, subtree: true });
  var initial = new URL(window.location.href).searchParams.get('lang');
  // Every fresh visit defaults to Chinese. Only an explicit URL or click
  // requests another language; neither preferences nor translations persist.
  changeLanguage(initial || 'zh-Hans', false);
})();
