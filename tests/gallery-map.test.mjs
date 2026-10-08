import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parseHTML } from 'linkedom';

const script = readFileSync(new URL('../assets/js/gallery-map.js', import.meta.url), 'utf8');
const messages = { mapHint: 'Choose a place', selectedPlace: 'Selected place', photoShort: '{count} photos', photos: '{count} photos', posts: '{count} posts', locations: '{count} places', mapSwitchLight: 'Switch to light map', mapSwitchDark: 'Switch to dark map' };
const location = { id: 'temple', name: 'Temple <script>unsafe</script>', lat: 34.3, lng: 132.3, zoom: 12 };
const photo = { src: '/thumb.jpg', full_src: '/original.jpg', caption: '<img src=x onerror=alert(1)>', location };
const entries = [{ title: 'Trip', url: '/trip/', date_display: '2026-07-16', photos: [photo, photo] }];

function setup({ token = 'pk.local-test', supported = true, missingSDK = false, data = entries, hour = 12, dark = false, query = '' } = {}) {
  const { document, window: domWindow } = parseHTML('<section data-gallery-earth><button data-gallery-map-theme></button><button data-gallery-map-overview></button><div data-gallery-map></div><p data-gallery-map-status></p><aside class="gallery-map-detail" hidden><button data-gallery-map-close></button><button data-gallery-map-toggle></button><span data-gallery-map-toggle-label></span><div data-gallery-map-detail></div></aside><script id="gallery-map-data" type="application/json"></script></section>');
  const windowListeners = {};
  const mediaListeners = {};
  const darkMedia = { matches: dark, addEventListener(name, callback) { mediaListeners[name] = callback; } };
  const window = { location: { search: query }, Event: domWindow.Event, innerWidth: 1200, innerHeight: 800, addEventListener(name, callback) { windowListeners[name] = callback; }, matchMedia: name => name.includes('color-scheme') ? darkMedia : ({ matches: false, addEventListener() {} }) };
  document.querySelector('[data-gallery-map]').dataset.mapboxToken = token;
  document.getElementById('gallery-map-data').textContent = JSON.stringify(data);
  let map;
  class MapMock {
    constructor(options) { this.options = options; this.handlers = {}; this.bindings = {}; this.sources = {}; this.layers = []; this.controls = []; this.canvas = { style: {} }; this.touchZoomRotate = { disableRotation() {} }; map = this; }
    on(name, layer, callback) { const key = typeof layer === 'function' ? name : name + ':' + layer; this.handlers[key] = callback || layer; this.bindings[key] = (this.bindings[key] || 0) + 1; }
    addControl(control) { this.controls.push(control); }
    setStyle(style) { this.style = style; this.sources = {}; this.layers = []; }
    setProjection(projection) { this.projection = projection; }
    project(coordinates) { return { x: coordinates[0], y: coordinates[1] }; }
    setFog(fog) { this.fog = fog; }
    fitBounds(bounds, options) { this.overview = { bounds, options }; }
    easeTo(options) { this.camera = options; }
    flyTo(options) { this.camera = options; }
    getStyle() { return { layers: [] }; }
    addSource(id, source) { source.setData = data => { source.data = data; }; source.getClusterLeaves = (id, limit, offset, callback) => callback(null, source.data.features); this.sources[id] = source; }
    getSource(id) { return this.sources[id]; }
    addLayer(layer) { this.layers.push(layer); }
    getCanvas() { return this.canvas; }
  }
  class PopupMock {
    setLngLat() { return this; } setHTML(html) { this.html = html; return this; } setText() { return this; } addTo() { return this; } remove() {}
  }
  class BoundsMock { extend() { return this; } }
  const sdk = { Map: MapMock, Popup: PopupMock, LngLatBounds: BoundsMock, NavigationControl: class {}, AttributionControl: class {}, supported: () => supported };
  if (!missingSDK) window.mapboxgl = sdk;
  runInNewContext(script, { window, document, URLSearchParams, Date: class { getHours() { return hour; } }, mapboxgl: sdk, siteLabel: (key, count) => (messages[key] || key).replace('{count}', count) });
  return { document, window, setDark(value) { darkMedia.matches = value; mediaListeners.change(); }, resize(width, height) { window.innerWidth = width; window.innerHeight = height; windowListeners.resize(); }, get map() { return map; }, select(id) { map.handlers['click:gallery-points-hit']({ features: [{ properties: { id } }] }); } };
}

test('photo locations are grouped into Mapbox longitude/latitude points and clusters', () => {
  const app = setup();
  app.map.handlers['style.load']();
  const source = app.map.sources['gallery-locations'];
  assert.equal(source.cluster, true);
  assert.equal(source.data.features.length, 1);
  assert.deepEqual(Array.from(source.data.features[0].geometry.coordinates), [132.3, 34.3]);
  assert.equal(source.data.features[0].properties.photoCount, 2);
  assert.equal(app.map.options.projection, 'globe');
  assert.equal(app.map.options.scrollZoom, true);
  assert.equal(app.map.options.cooperativeGestures, false);
  assert.equal(app.map.options.touchZoomRotate, true);
  assert.equal(app.map.options.dragRotate, true);
  assert.equal(app.map.controls.length, 1);
  assert.equal(app.map.fog['space-color'], '#0b111b');
  app.map.handlers['click:gallery-clusters']({ features: [{ properties: { cluster_id: 7 }, geometry: { coordinates: [130, 35] } }] });
  assert.equal(app.document.querySelector('[data-gallery-map-place]').dataset.galleryMapPlace, 'temple');
  app.document.querySelector('[data-gallery-map-place]').click();
  assert.equal(app.map.camera.zoom, 12);
});

test('selection shows the matching post and original image safely; closing clears selection', () => {
  const app = setup();
  app.map.handlers['style.load']();
  app.select('temple');
  const detail = app.document.querySelector('[data-gallery-map-detail]');
  assert.equal(detail.querySelector('a').getAttribute('href'), '/trip/');
  assert.equal(detail.querySelector('.gallery-map-cover img').dataset.fullSrc, '/original.jpg');
  assert.equal(detail.querySelector('script'), null);
  assert.equal(detail.querySelector('img[onerror]'), null);
  assert(detail.textContent.includes('<img src=x onerror=alert(1)>'));
  assert.equal(app.map.sources['gallery-selection'].data.features.length, 1);
  assert.equal(detail.closest('aside').hidden, false);
  assert.equal(app.map.camera.padding.right, 380);
  assert.deepEqual(Array.from(app.map.camera.center), [132.3, 34.3]);
  app.document.querySelector('[data-gallery-map-close]').click();
  assert.equal(app.map.sources['gallery-selection'].data.features.length, 0);
  assert.equal(detail.textContent, '');
  assert.equal(detail.closest('aside').hidden, true);
  assert.equal(app.map.camera.padding.right, 0);
});

test('missing token, unsupported WebGL and unavailable SDK show a clear error', () => {
  for (const [options, expected] of [[{ token: '' }, 'mapUnconfigured'], [{ supported: false }, 'mapUnsupported'], [{ missingSDK: true }, 'mapFailed']]) {
    const app = setup(options);
    assert.equal(app.map, undefined);
    assert.equal(app.document.querySelector('[data-gallery-map-status]').textContent, expected);
    assert.equal(app.document.querySelector('aside').hidden, true);
  }
});

test('invalid coordinates are skipped without affecting valid location selection', () => {
  const app = setup({ data: [{ ...entries[0], photos: [photo, { ...photo, location: { id: 'invalid', lat: null, lng: 200 } }] }] });
  app.map.handlers['style.load']();
  app.select('temple');
  assert.equal(app.map.sources['gallery-locations'].data.features.length, 1);
  assert.equal(app.map.sources['gallery-selection'].data.features[0].properties.id, 'temple');
  assert.equal(app.map.camera.zoom, 12);
});

test('closing a photo panel clears its marker without returning to the globe', () => {
  const app = setup();
  app.map.handlers['style.load']();
  app.select('temple');
  app.document.querySelector('[data-gallery-map-close]').click();
  assert.equal(app.document.querySelector('aside').hidden, true);
  assert.equal(app.map.sources['gallery-selection'].data.features.length, 0);
  assert.equal(app.map.camera.zoom, undefined);
  assert.equal(app.map.camera.padding.right, 0);
});

test('resizing fits the globe to the screen while preserving manual exploration', () => {
  const app = setup();
  app.map.handlers['style.load']();
  const desktopZoom = app.map.camera.zoom;
  app.resize(390, 844);
  assert(app.map.camera.zoom < desktopZoom);
  app.map.handlers.dragstart();
  const camera = app.map.camera;
  app.resize(1200, 800);
  assert.equal(app.map.camera, camera);
});


test('automatic map appearance follows the system and ignores local night hours', () => {
  for (const options of [{ dark: true }, { dark: true, hour: 19 }, { dark: true, hour: 6 }]) {
    const app = setup(options);
    assert.equal(app.map.options.style, 'mapbox://styles/mapbox/dark-v11');
    app.map.handlers['style.load']();
    assert.equal(app.document.querySelector('[data-gallery-earth]').dataset.mapTheme, 'dark');
    assert.equal(app.map.fog['space-color'], '#05070b');
  }
  for (const options of [{ hour: 7 }, { hour: 18 }, { hour: 19 }, { hour: 6 }, { dark: true, query: '?map-theme=light' }]) {
    assert.equal(setup(options).map.options.style, 'mapbox://styles/mapbox/light-v11');
  }
});

test('theme changes preserve the camera and selection while restoring layers once', () => {
  const app = setup();
  app.map.handlers['style.load']();
  app.select('temple');
  const camera = app.map.camera;
  app.setDark(true);
  assert.equal(app.map.style, 'mapbox://styles/mapbox/dark-v11');
  app.map.handlers['style.load']();
  assert.equal(app.map.camera, camera);
  assert.equal(app.map.sources['gallery-selection'].data.features[0].properties.id, 'temple');
  assert.equal(app.map.bindings['click:gallery-clusters'], 1);
  assert.equal(app.map.bindings['click:gallery-points-hit'], 1);
  app.setDark(false);
  app.map.handlers['style.load']();
  assert.equal(app.map.style, 'mapbox://styles/mapbox/light-v11');
});

test('the globe button restores the overview and clears the photo panel', () => {
  const app = setup();
  app.map.handlers['style.load']();
  const overviewZoom = app.map.camera.zoom;
  app.select('temple');
  app.document.querySelector('[data-gallery-map-overview]').click();
  assert.equal(app.map.camera.zoom, overviewZoom);
  assert.equal(app.map.camera.pitch, 0);
  assert.equal(app.map.camera.bearing, 0);
  assert.equal(app.map.camera.padding.right, 0);
  assert.equal(app.document.querySelector('aside').hidden, true);
});

test('small landmarks decluster early and overlapping tap targets select the nearest place', () => {
  const app = setup({ data: [{ ...entries[0], photos: [photo, { ...photo, location: { ...location, id: 'nearby', name: 'Nearby', lng: 132.4 } }] }] });
  app.map.handlers['style.load']();
  assert.equal(app.map.sources['gallery-locations'].clusterMaxZoom, 8);
  assert.equal(app.map.sources['gallery-locations'].clusterRadius, 28);
  assert.equal(app.map.layers.find(layer => layer.id === 'gallery-points-hit').paint['circle-radius'], 22);
  app.map.handlers['click:gallery-points-hit']({ point: { x: 132.39, y: 34.3 }, features: app.map.sources['gallery-locations'].data.features });
  assert.equal(app.map.sources['gallery-selection'].data.features[0].properties.id, 'nearby');
  assert.equal(app.map.camera.zoom, 12);
});


test('the sun/moon button overrides system appearance for the current visit without moving the camera', () => {
  const app = setup();
  app.map.handlers['style.load']();
  app.select('temple');
  const camera = app.map.camera;
  const button = app.document.querySelector('[data-gallery-map-theme]');
  assert.equal(button.getAttribute('aria-label'), 'Switch to dark map');
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  button.click();
  assert.equal(app.map.style, 'mapbox://styles/mapbox/dark-v11');
  app.map.handlers['style.load']();
  assert.equal(app.map.camera, camera);
  assert.equal(app.map.sources['gallery-selection'].data.features[0].properties.id, 'temple');
  assert.equal(button.getAttribute('aria-label'), 'Switch to light map');
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  button.click();
  app.map.handlers['style.load']();
  assert.equal(app.map.style, 'mapbox://styles/mapbox/light-v11');
  app.setDark(true);
  assert.equal(app.document.querySelector('[data-gallery-earth]').dataset.mapTheme, 'light');
  assert.equal(app.map.camera, camera);
  assert.equal(setup({ dark: true }).map.options.style, 'mapbox://styles/mapbox/dark-v11');
});
