function blogT(key, count) {
  if (window.BlogI18n) return window.BlogI18n.t(key, count);
  var message = window.BLOG_MESSAGES && window.BLOG_MESSAGES['zh-Hans'][key];
  return (message || key).replace('{count}', String(count));
}
function blogText(value) { return window.BlogI18n ? window.BlogI18n.text(value) : value; }
function blogDate(value) { return window.BlogI18n ? window.BlogI18n.date(value) : value; }

(function () {
  var submenuLinks = document.querySelectorAll(".menu-item-has-children > .submenu-link");
  var mobileQuery = window.matchMedia("(max-width: 48em)");
  var closeTimers = new WeakMap();
  var DESKTOP_CLOSE_DELAY = 260;

  function setSubmenuState(parent, link, isOpen) {
    if (!parent || !link) {
      return;
    }

    link.setAttribute("aria-expanded", isOpen ? "true" : "false");
    parent.classList.toggle("open", isOpen);
  }

  function collapseSubmenusOnMobile() {
    if (!mobileQuery.matches) {
      return;
    }

    submenuLinks.forEach(function (link) {
      setSubmenuState(link.closest(".menu-item-has-children"), link, false);
    });
  }

  function clearCloseTimer(parent) {
    var timerId;

    if (!parent) {
      return;
    }

    timerId = closeTimers.get(parent);
    if (timerId) {
      window.clearTimeout(timerId);
      closeTimers.delete(parent);
    }
  }

  function scheduleClose(parent, link) {
    clearCloseTimer(parent);
    closeTimers.set(
      parent,
      window.setTimeout(function () {
        setSubmenuState(parent, link, false);
        closeTimers.delete(parent);
      }, DESKTOP_CLOSE_DELAY)
    );
  }

  submenuLinks.forEach(function (link) {
    var parent = link.closest(".menu-item-has-children");

    if (parent) {
      parent.addEventListener("mouseenter", function () {
        if (mobileQuery.matches) {
          return;
        }

        clearCloseTimer(parent);
        setSubmenuState(parent, link, true);
      });

      parent.addEventListener("mouseleave", function () {
        if (mobileQuery.matches) {
          return;
        }

        scheduleClose(parent, link);
      });
    }

    link.addEventListener("click", function (event) {
      var currentParent = link.closest(".menu-item-has-children");
      var expanded = link.getAttribute("aria-expanded") === "true";

      event.preventDefault();
      clearCloseTimer(currentParent);
      submenuLinks.forEach(function (otherLink) {
        if (otherLink !== link) {
          setSubmenuState(otherLink.closest(".menu-item-has-children"), otherLink, false);
        }
      });
      setSubmenuState(currentParent, link, !expanded);
    });
  });

  document.addEventListener("click", function (event) {
    submenuLinks.forEach(function (link) {
      var parent = link.closest(".menu-item-has-children");

      if (parent && !parent.contains(event.target)) {
        clearCloseTimer(parent);
        setSubmenuState(parent, link, false);
      }
    });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") {
      return;
    }

    submenuLinks.forEach(function (link) {
      setSubmenuState(link.closest(".menu-item-has-children"), link, false);
    });
  });

  collapseSubmenusOnMobile();
})();

(function () {
  var lightbox;
  var lightboxStage;
  var lightboxImage;
  var closeButton;
  var originalLink;
  var lightboxLoadToken = 0;
  var activePointers = new Map();
  var dragOrigin = null;
  var pinchState = null;
  var currentScale = 1;
  var currentX = 0;
  var currentY = 0;
  var baseWidth = 0;
  var baseHeight = 0;
  var maxScale = 4;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getStageMetrics() {
    if (!lightboxStage) {
      return null;
    }

    return {
      width: lightboxStage.clientWidth,
      height: lightboxStage.clientHeight
    };
  }

  function getDisplayedWidth(scale) {
    return baseWidth * scale;
  }

  function getDisplayedHeight(scale) {
    return baseHeight * scale;
  }

  function clampOffsets() {
    var metrics = getStageMetrics();
    var displayedWidth;
    var displayedHeight;
    var maxOffsetX;
    var maxOffsetY;

    if (!metrics) {
      return;
    }

    displayedWidth = getDisplayedWidth(currentScale);
    displayedHeight = getDisplayedHeight(currentScale);
    maxOffsetX = Math.max(0, (displayedWidth - metrics.width) / 2);
    maxOffsetY = Math.max(0, (displayedHeight - metrics.height) / 2);

    currentX = clamp(currentX, -maxOffsetX, maxOffsetX);
    currentY = clamp(currentY, -maxOffsetY, maxOffsetY);
  }

  function applyTransform() {
    var displayedWidth;
    var displayedHeight;

    if (!lightboxImage || !baseWidth || !baseHeight) {
      return;
    }

    displayedWidth = getDisplayedWidth(currentScale);
    displayedHeight = getDisplayedHeight(currentScale);

    lightboxImage.style.width = displayedWidth + "px";
    lightboxImage.style.height = displayedHeight + "px";
    lightboxImage.style.transform = "translate3d(" + currentX + "px, " + currentY + "px, 0)";
    lightbox.classList.toggle("is-zoomed", currentScale > 1.01);
  }

  function updateLightboxImageSize(preservePosition) {
    var metrics = getStageMetrics();
    var previousWidth = getDisplayedWidth(currentScale);
    var previousHeight = getDisplayedHeight(currentScale);
    var centerRatioX = previousWidth ? -currentX / previousWidth : 0;
    var centerRatioY = previousHeight ? -currentY / previousHeight : 0;
    var widthRatio;
    var heightRatio;
    var fitRatio;

    if (!metrics || !lightboxImage || !lightboxImage.naturalWidth || !lightboxImage.naturalHeight) {
      return;
    }

    widthRatio = metrics.width / lightboxImage.naturalWidth;
    heightRatio = metrics.height / lightboxImage.naturalHeight;
    fitRatio = Math.min(widthRatio, heightRatio, 1);

    baseWidth = lightboxImage.naturalWidth * fitRatio;
    baseHeight = lightboxImage.naturalHeight * fitRatio;
    maxScale = Math.max(4, 1 / fitRatio);
    currentScale = clamp(currentScale, 1, maxScale);

    if (preservePosition && previousWidth && previousHeight) {
      currentX = -centerRatioX * getDisplayedWidth(currentScale);
      currentY = -centerRatioY * getDisplayedHeight(currentScale);
    } else if (currentScale <= 1.01) {
      currentX = 0;
      currentY = 0;
    }

    clampOffsets();
    applyTransform();
  }

  function parseCloudflareImageUrl(url) {
    var absoluteUrl;
    var match;

    if (!url) {
      return null;
    }

    try {
      absoluteUrl = new URL(url, window.location.href).href;
    } catch (error) {
      return null;
    }

    match = absoluteUrl.match(/^(https?:\/\/[^/]+)\/cdn-cgi\/image\/[^/]+(\/.+)$/);

    if (!match) {
      return null;
    }

    return {
      origin: match[1],
      assetPath: match[2]
    };
  }

  function extractAssetUrl(url) {
    var transformed = parseCloudflareImageUrl(url);
    var parsedUrl;

    if (transformed) {
      return transformed.origin + transformed.assetPath;
    }

    try {
      parsedUrl = new URL(url, window.location.href);
    } catch (error) {
      return "";
    }

    return parsedUrl.origin + parsedUrl.pathname;
  }

  function buildCloudflareImageUrl(assetUrl, width, quality) {
    var parsedUrl;

    if (!assetUrl) {
      return "";
    }

    try {
      parsedUrl = new URL(assetUrl, window.location.href);
    } catch (error) {
      return "";
    }

    if (parsedUrl.hostname !== "img.tsuikaii.com") {
      return "";
    }

    return parsedUrl.origin + "/cdn-cgi/image/width=" + width + ",quality=" + quality + ",format=auto" + parsedUrl.pathname;
  }

  function prepareEntryImages() {
    var inlineWidths = [800, 1200];
    var inlineSizes = "(min-width: 48em) min(84rem, calc(100vw - 6rem)), calc(100vw - 3.2rem)";
    var images = document.querySelectorAll(".post .entry-content img");

    images.forEach(function (image, index) {
      var imageSrc = image.getAttribute("src") || image.currentSrc || "";
      var assetUrl = image.getAttribute("data-full-src") || extractAssetUrl(imageSrc);
      var transformed = parseCloudflareImageUrl(imageSrc);
      if (!image.hasAttribute("loading")) {
        image.loading = index < 2 ? "eager" : "lazy";
      }

      if (!image.hasAttribute("decoding")) {
        image.decoding = "async";
      }

      if (!transformed || image.getAttribute("srcset")) {
        return;
      }

      image.setAttribute("sizes", inlineSizes);
      image.setAttribute("srcset", inlineWidths.map(function (width) {
        return buildCloudflareImageUrl(assetUrl, width, 75) + " " + width + "w";
      }).join(", "));
    });
  }

  function resetTransform() {
    currentScale = 1;
    currentX = 0;
    currentY = 0;
    dragOrigin = null;
    pinchState = null;
    baseWidth = 0;
    baseHeight = 0;
    maxScale = 4;
    activePointers.clear();
    if (lightbox) {
      lightbox.classList.remove("is-panning", "is-zoomed");
    }
  }

  function getDistance(first, second) {
    var dx = second.x - first.x;
    var dy = second.y - first.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getCenter(first, second) {
    return {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2
    };
  }

  function getStagePoint(event) {
    var rect = lightboxStage.getBoundingClientRect();

    return {
      x: event.clientX - rect.left - rect.width / 2,
      y: event.clientY - rect.top - rect.height / 2
    };
  }

  function getPointerCenterAndDistance() {
    var pointers = Array.from(activePointers.values());

    if (pointers.length < 2) {
      return null;
    }

    return {
      center: getCenter(pointers[0], pointers[1]),
      distance: getDistance(pointers[0], pointers[1])
    };
  }

  function setScaleAroundPoint(nextScale, point, sourceState) {
    var originScale = sourceState ? sourceState.scale : currentScale;
    var originX = sourceState ? sourceState.x : currentX;
    var originY = sourceState ? sourceState.y : currentY;
    var originWidth = baseWidth * originScale;
    var originHeight = baseHeight * originScale;
    var relativeX = originWidth ? (point.x - originX) / originWidth : 0;
    var relativeY = originHeight ? (point.y - originY) / originHeight : 0;

    currentScale = clamp(nextScale, 1, maxScale);
    currentX = point.x - relativeX * getDisplayedWidth(currentScale);
    currentY = point.y - relativeY * getDisplayedHeight(currentScale);

    clampOffsets();
    applyTransform();
  }

  function syncDragOrigin() {
    var remainingPointer;

    if (activePointers.size !== 1) {
      dragOrigin = null;
      return;
    }

    remainingPointer = Array.from(activePointers.values())[0];
    dragOrigin = {
      x: remainingPointer.x - currentX,
      y: remainingPointer.y - currentY
    };
  }

  function ensureLightbox() {
    if (lightbox) {
      return;
    }

    lightbox = document.createElement("div");
    lightbox.className = "image-lightbox";
    lightbox.setAttribute("aria-hidden", "true");

    closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "image-lightbox-close";
    closeButton.dataset.i18n = 'close';
    closeButton.textContent = blogT('close');

    originalLink = document.createElement("a");
    originalLink.className = "image-lightbox-original";
    originalLink.dataset.i18n = 'original';
    originalLink.textContent = blogT('original');
    originalLink.target = "_blank";
    originalLink.rel = "noopener";
    originalLink.hidden = true;

    lightboxStage = document.createElement("div");
    lightboxStage.className = "image-lightbox-stage";

    lightboxImage = document.createElement("img");
    lightboxImage.alt = "";
    lightboxImage.decoding = "async";
    lightboxImage.draggable = false;
    lightboxImage.addEventListener("load", function () {
      updateLightboxImageSize(false);
    });

    lightboxStage.appendChild(lightboxImage);
    lightbox.appendChild(closeButton);
    lightbox.appendChild(originalLink);
    lightbox.appendChild(lightboxStage);
    document.body.appendChild(lightbox);

    closeButton.addEventListener("click", function () {
      closeLightbox();
    });

    lightbox.addEventListener("click", function (event) {
      if (event.target === lightbox) {
        closeLightbox();
      }
    });

    lightboxStage.addEventListener("dblclick", function (event) {
      var point;

      event.preventDefault();
      point = getStagePoint(event);

      if (currentScale > 1.01) {
        currentScale = 1;
        currentX = 0;
        currentY = 0;
        dragOrigin = null;
        pinchState = null;
        lightbox.classList.remove("is-panning");
        clampOffsets();
        applyTransform();
        return;
      }

      setScaleAroundPoint(Math.min(maxScale, 2), point);
    });

    lightboxStage.addEventListener("pointerdown", function (event) {
      var pinchSnapshot;

      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      lightboxStage.setPointerCapture(event.pointerId);
      activePointers.set(event.pointerId, getStagePoint(event));

      if (activePointers.size === 1) {
        syncDragOrigin();
        lightbox.classList.add("is-panning");
      }

      if (activePointers.size === 2) {
        pinchSnapshot = getPointerCenterAndDistance();
        pinchState = {
          center: pinchSnapshot.center,
          distance: pinchSnapshot.distance,
          scale: currentScale,
          x: currentX,
          y: currentY
        };
        dragOrigin = null;
        lightbox.classList.remove("is-panning");
      }
    });

    lightboxStage.addEventListener("pointermove", function (event) {
      var pinchSnapshot;
      var nextScale;

      if (!activePointers.has(event.pointerId)) {
        return;
      }

      activePointers.set(event.pointerId, getStagePoint(event));

      if (activePointers.size === 2 && pinchState) {
        pinchSnapshot = getPointerCenterAndDistance();
        nextScale = pinchState.distance ? pinchState.scale * (pinchSnapshot.distance / pinchState.distance) : pinchState.scale;

        setScaleAroundPoint(nextScale, pinchSnapshot.center, pinchState);
        return;
      }

      if (activePointers.size === 1 && dragOrigin && currentScale > 1.01) {
        currentX = activePointers.get(event.pointerId).x - dragOrigin.x;
        currentY = activePointers.get(event.pointerId).y - dragOrigin.y;
        clampOffsets();
        applyTransform();
      }
    });

    function releasePointer(event) {
      activePointers.delete(event.pointerId);
      if (lightboxStage.hasPointerCapture(event.pointerId)) {
        lightboxStage.releasePointerCapture(event.pointerId);
      }

      pinchState = null;

      if (activePointers.size === 0) {
        dragOrigin = null;
        lightbox.classList.remove("is-panning");
      } else if (activePointers.size === 1) {
        syncDragOrigin();
        lightbox.classList.add("is-panning");
      }

      if (currentScale <= 1.01) {
        currentScale = 1;
        currentX = 0;
        currentY = 0;
      }

      clampOffsets();
      applyTransform();
    }

    lightboxStage.addEventListener("pointerup", releasePointer);
    lightboxStage.addEventListener("pointercancel", releasePointer);

    lightboxStage.addEventListener("wheel", function (event) {
      var point = getStagePoint(event);
      var nextScale = currentScale + (event.deltaY < 0 ? 0.2 : -0.2);

      event.preventDefault();
      setScaleAroundPoint(nextScale, point);
    });

    window.addEventListener("resize", function () {
      updateLightboxImageSize(true);
    });
  }

  function openLightbox(image) {
    var fullSrc;
    var assetUrl;
    var displaySrc;
    var previewSrc;
    var displayImage;
    var loadToken;

    ensureLightbox();
    resetTransform();
    lightboxImage.style.width = "";
    lightboxImage.style.height = "";
    lightboxImage.style.transform = "";

    fullSrc = image.getAttribute("data-full-src") || image.currentSrc || image.getAttribute("src") || "";
    assetUrl = extractAssetUrl(fullSrc);
    displaySrc = buildCloudflareImageUrl(assetUrl, 2560, 90) || fullSrc;
    previewSrc = image.currentSrc || image.getAttribute("src") || displaySrc;
    loadToken = ++lightboxLoadToken;
    lightboxImage.src = previewSrc;
    lightboxImage.alt = image.alt || "";
    originalLink.href = fullSrc;
    originalLink.hidden = !assetUrl || displaySrc === fullSrc;
    lightbox.classList.add("is-visible");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    if (displaySrc !== previewSrc) {
      displayImage = new Image();
      displayImage.decoding = "async";
      displayImage.addEventListener("load", function () {
        if (loadToken !== lightboxLoadToken || !lightbox.classList.contains("is-visible")) {
          return;
        }

        lightboxImage.src = displaySrc;
      });
      displayImage.src = displaySrc;
    }
  }

  function closeLightbox() {
    if (!lightbox) {
      return;
    }

    lightbox.classList.remove("is-visible");
    lightbox.setAttribute("aria-hidden", "true");
    lightboxLoadToken += 1;
    lightboxImage.removeAttribute("src");
    originalLink.removeAttribute("href");
    originalLink.hidden = true;
    lightboxImage.style.width = "";
    lightboxImage.style.height = "";
    lightboxImage.style.transform = "";
    document.body.style.overflow = "";
    resetTransform();
  }

  prepareEntryImages();

  document.addEventListener("click", function (event) {
    var image = event.target.closest(".zoomable-image");

    if (!image) {
      return;
    }

    event.preventDefault();
    openLightbox(image);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeLightbox();
    }
  });
})();

(function () {
  var roots = document.querySelectorAll("[data-randomize-items]");

  function shuffle(items) {
    var index = items.length - 1;
    var swapIndex;
    var temp;

    for (; index > 0; index -= 1) {
      swapIndex = Math.floor(Math.random() * (index + 1));
      temp = items[index];
      items[index] = items[swapIndex];
      items[swapIndex] = temp;
    }

    return items;
  }

  roots.forEach(function (root) {
    var selector = root.getAttribute("data-randomize-selector") || "";
    var items = Array.prototype.slice.call(root.querySelectorAll(selector));
    var parent;

    if (!selector || items.length <= 1) {
      return;
    }

    parent = items[0].parentNode;
    shuffle(items).forEach(function (item) {
      parent.appendChild(item);
    });
  });
})();

(function () {
  var SCROLL_STATE_PREFIX = "page-scroll-state:";
  var SCROLL_STATE_MAX_AGE = 1000 * 60 * 60 * 12;
  var restoreState = null;
  var restoreAttempts = 0;
  var maxRestoreAttempts = 8;
  var userInteracted = false;

  function canUseSessionStorage() {
    try {
      return Boolean(window.sessionStorage);
    } catch (error) {
      return false;
    }
  }

  function getPageKey(url) {
    return url.pathname + url.search;
  }

  function getCurrentPageKey() {
    return getPageKey(new URL(window.location.href));
  }

  function getStorageKey(pageKey) {
    return SCROLL_STATE_PREFIX + pageKey;
  }

  function getNavigationType() {
    var navigationEntries;

    if (window.performance && typeof window.performance.getEntriesByType === "function") {
      navigationEntries = window.performance.getEntriesByType("navigation");

      if (navigationEntries && navigationEntries[0] && navigationEntries[0].type) {
        return navigationEntries[0].type;
      }
    }

    if (window.performance && window.performance.navigation && window.performance.navigation.type === 2) {
      return "back_forward";
    }

    return "";
  }

  function isRestorableHistoryNavigation(pageShowEvent) {
    return Boolean(pageShowEvent && pageShowEvent.persisted) || getNavigationType() === "back_forward";
  }

  function readState() {
    var rawState;
    var state;

    if (!canUseSessionStorage()) {
      return null;
    }

    rawState = window.sessionStorage.getItem(getStorageKey(getCurrentPageKey()));

    if (!rawState) {
      return null;
    }

    try {
      state = JSON.parse(rawState);
    } catch (error) {
      return null;
    }

    if (!state || !state.time || Date.now() - state.time > SCROLL_STATE_MAX_AGE) {
      window.sessionStorage.removeItem(getStorageKey(getCurrentPageKey()));
      return null;
    }

    return state;
  }

  function writeState(nextState) {
    var currentState = readState() || {};
    var state;

    if (!canUseSessionStorage()) {
      return;
    }

    state = {
      x: typeof nextState.x === "number" ? nextState.x : window.scrollX,
      y: typeof nextState.y === "number" ? nextState.y : window.scrollY,
      target: nextState.target || currentState.target || "",
      time: Date.now()
    };

    window.sessionStorage.setItem(getStorageKey(getCurrentPageKey()), JSON.stringify(state));
  }

  function getInternalLinkUrl(link) {
    var url;

    if (!link || !link.href) {
      return null;
    }

    try {
      url = new URL(link.href, window.location.href);
    } catch (error) {
      return null;
    }

    if (url.origin !== window.location.origin || url.href === window.location.href) {
      return null;
    }

    return url;
  }

  function isPostListLink(link) {
    return Boolean(link.closest(".home-posts .hentry, .archive-posts .hentry, .gallery-map-post-link"));
  }

  function findTargetArticle(target) {
    var links;
    var index;
    var linkUrl;

    if (!target) {
      return null;
    }

    links = document.querySelectorAll(".home-posts .hentry a[href], .archive-posts .hentry a[href], .gallery-map-post-link[href]");

    for (index = 0; index < links.length; index += 1) {
      linkUrl = getInternalLinkUrl(links[index]);

      if (linkUrl && getPageKey(linkUrl) === target) {
        return links[index].closest(".hentry") || links[index];
      }
    }

    return null;
  }

  function restoreScrollPosition() {
    var targetArticle;
    var top;

    if (!restoreState || userInteracted) {
      return;
    }

    targetArticle = findTargetArticle(restoreState.target);

    if (targetArticle) {
      top = targetArticle.getBoundingClientRect().top + window.scrollY - Math.max(12, window.innerHeight * 0.12);
      window.scrollTo(restoreState.x || 0, Math.max(0, top));
    } else if (typeof restoreState.y === "number") {
      window.scrollTo(restoreState.x || 0, restoreState.y);
    }

    restoreAttempts += 1;

    if (restoreAttempts < maxRestoreAttempts) {
      window.setTimeout(restoreScrollPosition, 180);
    }
  }

  function beginRestore(pageShowEvent) {
    if (!isRestorableHistoryNavigation(pageShowEvent)) {
      return;
    }

    restoreState = readState();

    if (!restoreState) {
      return;
    }

    restoreAttempts = 0;
    window.requestAnimationFrame(restoreScrollPosition);
    window.addEventListener("load", restoreScrollPosition, { once: true });
  }

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  if (window.sessionStorage && window.sessionStorage.getItem("gallery-refresh-top") === "1") {
    window.sessionStorage.removeItem("gallery-refresh-top");
    window.scrollTo(0, 0);
  }

  document.querySelectorAll("[data-gallery-refresh]").forEach(function (button) {
    button.addEventListener("click", function () {
      var url = new URL(window.location.href);

      if (window.sessionStorage) {
        window.sessionStorage.setItem("gallery-refresh-top", "1");
      }

      url.searchParams.delete("page");
      window.location.href = url.pathname + url.search + url.hash;
    });
  });

  ["touchstart", "wheel", "keydown"].forEach(function (eventName) {
    window.addEventListener(eventName, function () {
      userInteracted = true;
    }, { passive: true, once: true });
  });

  document.addEventListener("click", function (event) {
    var link = event.target.closest("a[href]");
    var linkUrl = getInternalLinkUrl(link);

    if (!linkUrl || !isPostListLink(link)) {
      return;
    }

    writeState({
      target: getPageKey(linkUrl)
    });
  });

  window.addEventListener("pagehide", function () {
    writeState({});
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      writeState({});
    }
  });

  beginRestore();
  window.addEventListener("pageshow", beginRestore);
})();


(function () {
  var roots = document.querySelectorAll("[data-pagination-root], [data-category-pagination]");

  function getPageUrl(pageNumber) {
    var url = new URL(window.location.href);

    if (pageNumber <= 1) {
      url.searchParams.delete("page");
    } else {
      url.searchParams.set("page", pageNumber);
    }

    return url.pathname + url.search + url.hash;
  }

  function createPaginationItem(pageNumber, currentPage) {
    var item = document.createElement("li");
    var link = document.createElement("a");

    link.className = "home-pagination-link" + (pageNumber === currentPage ? " is-current" : "");
    link.href = getPageUrl(pageNumber);
    link.textContent = pageNumber;

    if (pageNumber === currentPage) {
      link.setAttribute("aria-current", "page");
    }

    item.appendChild(link);
    return item;
  }

  function createArrow(label, pageNumber, className) {
    var element;

    if (pageNumber) {
      element = document.createElement("a");
      element.href = getPageUrl(pageNumber);
    } else {
      element = document.createElement("span");
      element.setAttribute("aria-disabled", "true");
      className += " is-disabled";
    }

    element.className = className;
    element.textContent = label;

    return element;
  }

  function resolveConfig(root) {
    if (root.hasAttribute("data-pagination-root")) {
      return {
        items: Array.prototype.slice.call(root.querySelectorAll(root.getAttribute("data-item-selector") || ".archive-post")),
        nav: root.querySelector(root.getAttribute("data-nav-selector") || "[data-category-pagination-nav]"),
        pageSize: parseInt(root.getAttribute("data-page-size"), 10) || 5
      };
    }

    return {
      items: Array.prototype.slice.call(root.querySelectorAll(".archive-post")),
      nav: root.parentNode.querySelector("[data-category-pagination-nav]"),
      pageSize: parseInt(root.getAttribute("data-page-size"), 10) || 5
    };
  }

  function renderPagination(root) {
    var config = resolveConfig(root);
    var items = config.items;
    var nav = config.nav;
    var pageSize = config.pageSize;
    var totalPages = Math.ceil(items.length / pageSize);
    var url = new URL(window.location.href);
    var currentPage = parseInt(url.searchParams.get("page"), 10) || 1;
    var start;
    var end;
    var list;
    var pageNumber;
    var firstPage;
    var lastPage;
    var previousActions;
    var nextActions;

    if (!nav) {
      return;
    }

    if (!Number.isFinite(currentPage) || currentPage < 1) {
      currentPage = 1;
    }

    currentPage = Math.min(currentPage, totalPages || 1);
    start = (currentPage - 1) * pageSize;
    end = start + pageSize;

    items.forEach(function (item, index) {
      var visible = index >= start && index < end;

      item.hidden = !visible;
      item.setAttribute("aria-hidden", visible ? "false" : "true");
    });

    if (totalPages <= 1) {
      nav.hidden = true;
      nav.innerHTML = "";
      return;
    }

    nav.hidden = false;
    nav.innerHTML = "";
    previousActions = document.createElement("div");
    previousActions.className = "home-pagination-actions";
    if (currentPage === totalPages) {
      previousActions.appendChild(createArrow(blogT('first'), 1, "home-pagination-link"));
    }
    if (currentPage > 1) {
      previousActions.appendChild(createArrow(blogT('previous'), currentPage - 1, "home-pagination-link home-pagination-arrow"));
    }
    nav.appendChild(previousActions);

    list = document.createElement("ol");
    list.className = "home-pagination-list";
    firstPage = Math.max(1, Math.min(currentPage - 1, totalPages - 2));
    lastPage = Math.min(totalPages, firstPage + 2);
    for (pageNumber = firstPage; pageNumber <= lastPage; pageNumber += 1) {
      list.appendChild(createPaginationItem(pageNumber, currentPage));
    }
    nav.appendChild(list);

    nextActions = document.createElement("div");
    nextActions.className = "home-pagination-actions";
    if (currentPage < totalPages) {
      nextActions.appendChild(createArrow(blogT('next'), currentPage + 1, "home-pagination-link home-pagination-arrow"));
    }
    if (currentPage === 1) {
      nextActions.appendChild(createArrow(blogT('last'), totalPages, "home-pagination-link"));
    }
    nav.appendChild(nextActions);
  }

  roots.forEach(function (root) {
    renderPagination(root);
  });
  document.addEventListener('blog:languagechange', function () {
    roots.forEach(function (root) { renderPagination(root); });
  });
})();

(function () {
  function fallbackCopy(text) {
    var textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }

  document.querySelectorAll(".entry-content pre > code").forEach(function (codeBlock) {
    var pre = codeBlock.parentNode;
    var button;

    if (!pre || pre.querySelector(".code-copy-button")) {
      return;
    }

    button = document.createElement("button");
    button.type = "button";
    button.className = "code-copy-button";
    button.dataset.i18n = 'copy';
    button.textContent = blogT('copy');

    button.addEventListener("click", function () {
      var text = codeBlock.textContent;
      var resetTimer;

      function markCopied() {
        button.dataset.i18n = 'copied';
        button.textContent = blogT('copied');
        window.clearTimeout(resetTimer);
        resetTimer = window.setTimeout(function () {
          button.dataset.i18n = 'copy';
          button.textContent = blogT('copy');
        }, 1600);
      }

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(markCopied).catch(function () {
          fallbackCopy(text);
          markCopied();
        });
        return;
      }

      fallbackCopy(text);
      markCopied();
    });

    pre.appendChild(button);
  });
})();
