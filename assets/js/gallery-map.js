(function () {
  "use strict";
  var mapRoot = document.querySelector("[data-gallery-map]");
  var detailRoot = document.querySelector("[data-gallery-map-detail]");
  var dataElement = document.getElementById("gallery-map-data");

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  if (!mapRoot || !detailRoot || !dataElement) {
    return;
  }

  var rawEntries;

  try {
    rawEntries = JSON.parse(dataElement.textContent);
  } catch (error) {
    return;
  }

  var groupedLocations = Object.create(null);
  var activeLocationId = null;
  var clusterGroups = null;
  var selectionRequest = 0;
  var entries = Array.isArray(rawEntries) ? rawEntries : [];

  entries.forEach(function (entry) {
    (entry.photos || []).forEach(function (photo) {
      var location = photo.location || entry.location;
      var id;
      var linkedEntry;

      if (!location || typeof location.lat !== "number" || typeof location.lng !== "number" ||
          !Number.isFinite(location.lat) || !Number.isFinite(location.lng) ||
          Math.abs(location.lat) > 85 || Math.abs(location.lng) > 180) {
        return;
      }

      id = location.id || entry.title;

      if (!groupedLocations[id]) {
        groupedLocations[id] = {
          id: id,
          location: location,
          entries: [],
          photos: [],
          photoCount: 0
        };
      }

      linkedEntry = groupedLocations[id].entries.find(function (candidate) {
        return candidate.url === entry.url;
      });

      if (!linkedEntry) {
        linkedEntry = {
          title: entry.title,
          url: entry.url,
          date_display: entry.date_display,
          photo_count: 0
        };
        groupedLocations[id].entries.push(linkedEntry);
      }

      linkedEntry.photo_count += 1;
      groupedLocations[id].photoCount += 1;
      groupedLocations[id].photos.push({
        src: photo.src,
        full_src: photo.full_src,
        caption: photo.caption,
        alt: photo.alt,
        post_title: entry.title,
        post_url: entry.url,
        post_date_display: entry.date_display
      });
    });
  });

  var locations = Object.keys(groupedLocations).map(function (id) {
    return groupedLocations[id];
  }).sort(function (first, second) {
    return second.photoCount - first.photoCount;
  });

  if (!locations.length) {
    return;
  }

  function buildDetailMarkup(group) {
    var entriesMarkup = group.entries.map(function (entry) {
      return (
        "<a class=\"gallery-map-post-link\" href=\"" + escapeHtml(entry.url) + "\">" +
          "<span class=\"gallery-map-post-title\" data-source-text=\"" + escapeHtml(entry.title) + "\">" + escapeHtml(blogText(entry.title)) + "</span>" +
          "<span class=\"gallery-map-post-meta\">" + escapeHtml(blogDate(entry.date_display)) + " · " + escapeHtml(blogT('photoShort', entry.photo_count)) + "</span>" +
        "</a>"
      );
    }).join("");
    var photosMarkup = group.photos.slice(1, 6).map(function (photo) {
      return (
        "<figure class=\"gallery-map-thumb\">" +
          "<img src=\"" + escapeHtml(photo.src) + "\" alt=\"" + escapeHtml(blogText(photo.alt || photo.caption || group.location.name)) + "\" data-source-alt=\"" + escapeHtml(photo.alt || photo.caption || group.location.name) + "\" class=\"zoomable-image\" data-full-src=\"" + escapeHtml(photo.full_src || photo.src) + "\" loading=\"lazy\">" +
          "<figcaption data-source-text=\"" + escapeHtml(photo.caption || photo.post_title) + "\">" + escapeHtml(blogText(photo.caption || photo.post_title)) + "</figcaption>" +
        "</figure>"
      );
    }).join("");

    return (
      "<figure class=\"gallery-map-cover\"><img src=\"" + escapeHtml(group.photos[0].src) + "\" alt=\"" + escapeHtml(blogText(group.photos[0].alt || group.location.name)) + "\" data-source-alt=\"" + escapeHtml(group.photos[0].alt || group.location.name) + "\" class=\"zoomable-image\" data-full-src=\"" + escapeHtml(group.photos[0].full_src || group.photos[0].src) + "\"></figure>" +
      "<div class=\"gallery-map-detail-header\">" +
        "<p class=\"gallery-map-eyebrow\" data-i18n=\"selectedPlace\">" + escapeHtml(blogT('selectedPlace')) + "</p>" +
        "<h3 class=\"gallery-map-place\" data-source-text=\"" + escapeHtml(group.location.name) + "\">" + escapeHtml(blogText(group.location.name)) + "</h3>" +
        "<p class=\"gallery-map-place-subtitle\" data-source-text=\"" + escapeHtml(group.location.place || '') + "\">" + escapeHtml(blogText(group.location.place || '')) + "</p>" +
      "</div>" +
      "<div class=\"gallery-map-summary\">" +
        "<span data-i18n=\"photos\" data-count=\"" + group.photoCount + "\">" + escapeHtml(blogT('photos', group.photoCount)) + "</span>" +
        "<span data-i18n=\"posts\" data-count=\"" + group.entries.length + "\">" + escapeHtml(blogT('posts', group.entries.length)) + "</span>" +
      "</div>" +
      "<div class=\"gallery-map-posts\">" + entriesMarkup + "</div>" +
      "<div class=\"gallery-map-thumbs\">" + photosMarkup + "</div>"
    );
  }
  var statusRoot = document.querySelector('[data-gallery-map-status]');
  var toggleButton = document.querySelector('[data-gallery-map-toggle]');
  var toggleLabel = document.querySelector('[data-gallery-map-toggle-label]');
  var detailPanel = detailRoot.closest('.gallery-map-detail');
  var map;
  var hoverPopup;
  var mapReady = false;
  var overviewActive = true;
  var statusKey = 'mapLoading';
  var token = mapRoot.dataset.mapboxToken || '';
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var closeButton = document.querySelector('[data-gallery-map-close]');
  var overviewButton = document.querySelector('[data-gallery-map-overview]');
  var themeButton = document.querySelector('[data-gallery-map-theme]');
  var earthRoot = document.querySelector('[data-gallery-earth]') || mapRoot;
  var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  var themeOverride = new URLSearchParams(window.location.search).get('map-theme');
  var currentTheme;

  function preferredTheme() {
    if (themeOverride === 'dark' || themeOverride === 'light') return themeOverride;
    return darkQuery.matches ? 'dark' : 'light';
  }

  function styleForTheme(theme) {
    return theme === 'dark' ? (mapRoot.dataset.mapboxDarkStyle || 'mapbox://styles/mapbox/dark-v11') :
      (mapRoot.dataset.mapboxStyle || 'mapbox://styles/mapbox/light-v11');
  }

  function updateThemeButton(theme) {
    if (!themeButton) return;
    var labelKey = theme === 'dark' ? 'mapSwitchLight' : 'mapSwitchDark';
    themeButton.dataset.i18nAria = labelKey;
    themeButton.setAttribute('aria-label', blogT(labelKey));
    themeButton.setAttribute('title', blogT(labelKey));
    themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
  }

  function refreshTheme() {
    var theme = preferredTheme();
    updateThemeButton(theme);
    if (theme === currentTheme) return;
    currentTheme = theme;
    earthRoot.dataset.mapTheme = theme;
    if (map) {
      mapReady = false;
      if (hoverPopup) hoverPopup.remove();
      map.setStyle(styleForTheme(theme), { diff: false });
    }
  }
  refreshTheme();
  if (themeButton) themeButton.addEventListener('click', function () {
    themeOverride = currentTheme === 'dark' ? 'light' : 'dark';
    refreshTheme();
  });
  var overviewCenter = [
    (Math.min.apply(null, locations.map(function (group) { return group.location.lng; })) + Math.max.apply(null, locations.map(function (group) { return group.location.lng; }))) / 2,
    (Math.min.apply(null, locations.map(function (group) { return group.location.lat; })) + Math.max.apply(null, locations.map(function (group) { return group.location.lat; }))) / 2
  ];

  function overviewZoom() {
    var diameter = Math.min(window.innerWidth, window.innerHeight) * (window.innerWidth <= 768 ? 0.68 : 0.82);
    return Math.max(0, Math.min(2.8, Math.log2(diameter * Math.PI / 512)));
  }

  function cameraPadding() {
    if (!activeLocationId) return { top: 0, bottom: 0, left: 0, right: 0 };
    if (window.innerWidth <= 768) return { top: 64, bottom: Math.min(window.innerHeight * 0.44, 420), left: 16, right: 16 };
    return { top: 24, bottom: 40, left: 40, right: 380 };
  }

  function setStatus(key) {
    statusKey = key;
    if (!statusRoot) return;
    statusRoot.hidden = !key;
    if (key) {
      statusRoot.dataset.i18n = key;
      statusRoot.textContent = blogT(key);
    }
  }

  function expandDetail() {
    detailPanel.classList.remove('is-collapsed');
    if (toggleButton) toggleButton.setAttribute('aria-expanded', 'true');
  }

  function updateSelection() {
    if (!mapReady) return;
    // The selected location is rendered separately so it stays visible in a cluster.
    map.getSource('gallery-selection').setData({
      type: 'FeatureCollection',
      features: activeLocationId ? [featureForGroup(groupedLocations[activeLocationId])] : []
    });
  }

  function featureForGroup(group) {
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [group.location.lng, group.location.lat] },
      properties: { id: group.id, name: blogText(group.location.name), photoCount: group.photoCount }
    };
  }

  function selectLocation(id, shouldFly) {
    var group = groupedLocations[id];
    if (!group) return;
    selectionRequest += 1;
    clusterGroups = null;
    activeLocationId = id;
    overviewActive = false;
    detailPanel.hidden = false;
    detailRoot.innerHTML = buildDetailMarkup(group);
    detailRoot.scrollTop = 0;
    detailPanel.scrollTop = 0;
    if (toggleLabel) {
      toggleLabel.removeAttribute('data-i18n');
      toggleLabel.textContent = blogText(group.location.name) + ' · ' + blogT('photoShort', group.photoCount);
    }
    expandDetail();
    updateSelection();
    if (hoverPopup) hoverPopup.remove();
    if (mapReady && shouldFly) {
      map.flyTo({
        center: [group.location.lng, group.location.lat],
        zoom: Math.max(12, Math.min(16, parseInt(group.location.zoom, 10) || 12)),
        bearing: 0, pitch: 0, padding: cameraPadding(),
        duration: reducedMotion.matches ? 0 : 1400
      });
    }
  }

  function closeDetail() {
    selectionRequest += 1;
    clusterGroups = null;
    activeLocationId = null;
    detailPanel.hidden = true;
    if (hoverPopup) hoverPopup.remove();
    detailRoot.innerHTML = '';
    updateSelection();
    if (map) map.easeTo({ padding: cameraPadding(), duration: reducedMotion.matches ? 0 : 350 });
  }

  function showOverview() {
    closeDetail();
    overviewActive = true;
    if (!map) return;
    map.flyTo({
      center: overviewCenter, zoom: overviewZoom(), bearing: 0, pitch: 0,
      padding: cameraPadding(), duration: mapReady && !reducedMotion.matches ? 1400 : 0
    });
  }

  function showCluster(groups) {
    clusterGroups = groups;
    activeLocationId = null;
    overviewActive = false;
    updateSelection();
    if (hoverPopup) hoverPopup.remove();
    detailPanel.hidden = false;
    expandDetail();
    if (toggleLabel) {
      toggleLabel.removeAttribute('data-i18n');
      toggleLabel.textContent = blogT('locations', groups.length);
    }
    detailRoot.innerHTML = '<div class="gallery-map-location-list">' + groups.map(function (group) {
      return '<button type="button" class="gallery-map-location-item" data-gallery-map-place="' + escapeHtml(group.id) + '">' +
        '<img src="' + escapeHtml(group.photos[0].src) + '" alt="" loading="lazy">' +
        '<span><strong>' + escapeHtml(blogText(group.location.name)) + '</strong><small>' +
        escapeHtml(blogT('photoShort', group.photoCount)) + '</small></span></button>';
    }).join('') + '</div>';
    detailRoot.scrollTop = 0;
  }

  detailRoot.addEventListener('click', function (event) {
    var placeButton = event.target.closest('[data-gallery-map-place]');
    if (placeButton) selectLocation(placeButton.dataset.galleryMapPlace, true);
  });
  if (overviewButton) overviewButton.addEventListener('click', showOverview);
  if (closeButton) closeButton.addEventListener('click', closeDetail);
  if (toggleButton) toggleButton.addEventListener('click', function () {
    var collapsed = detailPanel.classList.toggle('is-collapsed');
    toggleButton.setAttribute('aria-expanded', String(!collapsed));
    if (map) map.easeTo({ padding: collapsed ? { top: 64, bottom: 80, left: 16, right: 16 } : cameraPadding(), duration: reducedMotion.matches ? 0 : 350 });
  });
  var mobileQuery = window.matchMedia('(max-width: 48em)');
  mobileQuery.addEventListener('change', function () {
    if (!mobileQuery.matches) expandDetail();
    if (map && activeLocationId) map.easeTo({ padding: cameraPadding(), duration: 0 });
  });
  document.addEventListener('blog:languagechange', function () {
    updateThemeButton(currentTheme);
    if (activeLocationId) selectLocation(activeLocationId, false);
    else if (clusterGroups) showCluster(clusterGroups);
    else if (toggleLabel) toggleLabel.textContent = blogT('selectedPlace');
    if (mapReady) map.getSource('gallery-locations').setData({ type: 'FeatureCollection', features: locations.map(featureForGroup) });
    if (statusKey) setStatus(statusKey);
  });

  if (!/^pk\./.test(token)) {
    setStatus('mapUnconfigured');
    return;
  }
  if (typeof window.mapboxgl === 'undefined') {
    setStatus('mapFailed');
    return;
  }
  if (!mapboxgl.supported()) {
    setStatus('mapUnsupported');
    return;
  }

  try {
    map = new mapboxgl.Map({
      container: mapRoot, accessToken: token,
      style: styleForTheme(currentTheme),
      projection: 'globe',
      center: overviewCenter, zoom: overviewZoom(), minZoom: -0.5, maxZoom: 18,
      renderWorldCopies: false, scrollZoom: true, dragRotate: true,
      pitchWithRotate: true, touchPitch: true, touchZoomRotate: true,
      attributionControl: false, cooperativeGestures: false
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
    showOverview();
  } catch (error) {
    setStatus('mapFailed');
    return;
  }

  map.on('error', function () {
    if (!mapReady) setStatus('mapFailed');
  });
  map.on('dragstart', function () { overviewActive = false; });
  map.on('zoomstart', function (event) {
    if (event.originalEvent) overviewActive = false;
  });
  window.addEventListener('resize', function () {
    if (!mapReady) return;
    if (overviewActive) map.easeTo({ zoom: overviewZoom(), padding: cameraPadding(), duration: 0 });
    else if (activeLocationId) map.easeTo({ padding: cameraPadding(), duration: 0 });
  });

  // A style switch keeps the camera but removes custom sources and layers.
  map.on('style.load', function () {
    var dark = currentTheme === 'dark';
    map.setProjection('globe');
    map.setFog({
      color: dark ? '#111820' : '#d5e4ec',
      'high-color': dark ? '#202b3b' : '#5b7d9b', 'space-color': dark ? '#05070b' : '#0b111b',
      'horizon-blend': 0.035, 'star-intensity': dark ? 0.35 : 0.18
    });
    var layers = map.getStyle().layers || [];
    layers.forEach(function (layer) {
      if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', dark ? '#171b20' : '#f5f2eb');
      if (layer.id === 'water' && layer.type === 'fill') map.setPaintProperty(layer.id, 'fill-color', dark ? '#080e15' : '#cbdfe6');
      if (layer.type === 'symbol' && /poi/.test(layer.id)) {
        map.setLayerZoomRange(layer.id, 12, layer.maxzoom || 24);
      }
      if (layer.type === 'symbol' && /transit|road.*label/.test(layer.id)) {
        map.setLayoutProperty(layer.id, 'visibility', 'none');
      }
      if (layer.type === 'fill' && /building/.test(layer.id)) map.setPaintProperty(layer.id, 'fill-opacity', 0.35);
    });
    map.addSource('gallery-locations', {
      type: 'geojson', data: { type: 'FeatureCollection', features: locations.map(featureForGroup) },
      cluster: true, clusterMaxZoom: 8, clusterRadius: 28
    });
    map.addLayer({
      id: 'gallery-clusters', type: 'circle', source: 'gallery-locations', filter: ['has', 'point_count'],
      paint: {
        'circle-color': dark ? '#486e84' : '#527989', 'circle-radius': ['step', ['get', 'point_count'], 19, 10, 23, 30, 28],
        'circle-opacity': 0.94, 'circle-stroke-width': 3, 'circle-stroke-color': dark ? '#b9d7e7' : '#fff', 'circle-stroke-opacity': 0.85
      }
    });
    map.addLayer({
      id: 'gallery-cluster-count', type: 'symbol', source: 'gallery-locations', filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'], 'text-size': 12 },
      paint: { 'text-color': '#fff' }
    });
    map.addLayer({
      id: 'gallery-points', type: 'circle', source: 'gallery-locations', filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'photoCount'], 1, 7, 30, 11],
        'circle-color': dark ? '#89bed8' : '#6e94a5', 'circle-stroke-color': dark ? '#d3e8f3' : '#fff', 'circle-stroke-width': 2, 'circle-opacity': 0.95
      }
    });
    map.addLayer({
      id: 'gallery-point-labels', type: 'symbol', source: 'gallery-locations', minzoom: 7,
      filter: ['!', ['has', 'point_count']],
      layout: { 'text-field': ['get', 'name'], 'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': 12, 'text-anchor': 'top', 'text-offset': [0, 1.2], 'text-max-width': 12 },
      paint: { 'text-color': dark ? '#e0edf4' : '#254453', 'text-halo-color': dark ? '#171b20' : '#f5f2eb', 'text-halo-width': 1.5 }
    });
    // Keep small landmarks easy to tap without making their visible dots oversized.
    map.addLayer({
      id: 'gallery-points-hit', type: 'circle', source: 'gallery-locations', filter: ['!', ['has', 'point_count']],
      paint: { 'circle-radius': 22, 'circle-opacity': 0 }
    });
    map.addSource('gallery-selection', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: 'gallery-selected', type: 'circle', source: 'gallery-selection',
      paint: { 'circle-radius': 11, 'circle-color': dark ? '#64afcf' : '#275769', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 }
    });
    if (!hoverPopup) hoverPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: 'gallery-map-hover-popup' });
    mapReady = true;
    setStatus(null);
    updateSelection();
  });

  map.on('click', 'gallery-clusters', function (event) {
    var feature = event.features && event.features[0];
    if (!feature || !mapReady) return;
    var request = ++selectionRequest;
    map.getSource('gallery-locations').getClusterLeaves(feature.properties.cluster_id, feature.properties.point_count, 0, function (error, leaves) {
      if (error || request !== selectionRequest) return;
      var groups = leaves.map(function (leaf) { return groupedLocations[leaf.properties.id]; }).filter(Boolean);
      groups.sort(function (first, second) { return second.photoCount - first.photoCount; });
      if (groups.length) showCluster(groups);
    });
  });

  function nearestFeature(event) {
    var features = event.features || [];
    if (!event.point || features.length < 2) return features[0];
    return features.slice().sort(function (first, second) {
      function distance(feature) {
        var point = map.project(feature.geometry.coordinates);
        return Math.pow(point.x - event.point.x, 2) + Math.pow(point.y - event.point.y, 2);
      }
      return distance(first) - distance(second);
    })[0];
  }
  ['gallery-points-hit', 'gallery-selected'].forEach(function (layerId) {
    if (layerId === 'gallery-points-hit') map.on('click', layerId, function (event) {
      var feature = nearestFeature(event);
      if (feature) selectLocation(feature.properties.id, true);
    });
    map.on('mouseenter', layerId, function (event) {
      map.getCanvas().style.cursor = 'pointer';
      var feature = nearestFeature(event);
      var group = feature && groupedLocations[feature.properties.id];
      if (group && group.id !== activeLocationId && hoverPopup) {
        hoverPopup.setLngLat(feature.geometry.coordinates).setText(blogText(group.location.name) + ' · ' + blogT('photoShort', group.photoCount)).addTo(map);
      }
    });
    map.on('mouseleave', layerId, function () {
      map.getCanvas().style.cursor = '';
      if (hoverPopup) hoverPopup.remove();
    });
  });
  map.on('mouseenter', 'gallery-clusters', function () { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'gallery-clusters', function () { map.getCanvas().style.cursor = ''; });

  darkQuery.addEventListener('change', refreshTheme);
})();
