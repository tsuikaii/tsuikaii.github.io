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
  var activePointers = new Map();
  var currentScale = 1;
  var currentX = 0;
  var currentY = 0;
  var startScale = 1;
  var startX = 0;
  var startY = 0;
  var pinchDistance = 0;
  var pinchCenter = null;
  var dragOrigin = null;

  function applyTransform() {
    if (!lightboxImage) {
      return;
    }

    lightboxImage.style.transform = "translate3d(" + currentX + "px, " + currentY + "px, 0) scale(" + currentScale + ")";
    lightbox.classList.toggle("is-zoomed", currentScale > 1.01);
  }

  function resetTransform() {
    currentScale = 1;
    currentX = 0;
    currentY = 0;
    startScale = 1;
    startX = 0;
    startY = 0;
    pinchDistance = 0;
    pinchCenter = null;
    dragOrigin = null;
    activePointers.clear();
    if (lightbox) {
      lightbox.classList.remove("is-panning", "is-zoomed");
    }
    applyTransform();
  }

  function getDistance(first, second) {
    var dx = second.clientX - first.clientX;
    var dy = second.clientY - first.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getCenter(first, second) {
    return {
      x: (first.clientX + second.clientX) / 2,
      y: (first.clientY + second.clientY) / 2
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
    closeButton.textContent = "关闭";

    lightboxStage = document.createElement("div");
    lightboxStage.className = "image-lightbox-stage";

    lightboxImage = document.createElement("img");
    lightboxImage.alt = "";
    lightboxImage.draggable = false;

    lightboxStage.appendChild(lightboxImage);
    lightbox.appendChild(closeButton);
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
      event.preventDefault();

      if (currentScale > 1.01) {
        resetTransform();
        return;
      }

      currentScale = 2;
      currentX = 0;
      currentY = 0;
      applyTransform();
    });

    lightboxStage.addEventListener("pointerdown", function (event) {
      lightboxStage.setPointerCapture(event.pointerId);
      activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

      if (activePointers.size === 1) {
        dragOrigin = {
          x: event.clientX - currentX,
          y: event.clientY - currentY
        };
        lightbox.classList.add("is-panning");
      }

      if (activePointers.size === 2) {
        var pointers = Array.from(activePointers.values());
        pinchDistance = getDistance(pointers[0], pointers[1]);
        pinchCenter = getCenter(pointers[0], pointers[1]);
        startScale = currentScale;
        startX = currentX;
        startY = currentY;
      }
    });

    lightboxStage.addEventListener("pointermove", function (event) {
      if (!activePointers.has(event.pointerId)) {
        return;
      }

      activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

      if (activePointers.size === 2) {
        var pointers = Array.from(activePointers.values());
        var center = getCenter(pointers[0], pointers[1]);
        var nextDistance = getDistance(pointers[0], pointers[1]);
        var scaleRatio = pinchDistance ? nextDistance / pinchDistance : 1;

        currentScale = Math.min(4, Math.max(1, startScale * scaleRatio));
        currentX = startX + (center.x - pinchCenter.x);
        currentY = startY + (center.y - pinchCenter.y);
        applyTransform();
        return;
      }

      if (activePointers.size === 1 && dragOrigin && currentScale > 1.01) {
        currentX = event.clientX - dragOrigin.x;
        currentY = event.clientY - dragOrigin.y;
        applyTransform();
      }
    });

    function releasePointer(event) {
      activePointers.delete(event.pointerId);
      if (lightboxStage.hasPointerCapture(event.pointerId)) {
        lightboxStage.releasePointerCapture(event.pointerId);
      }

      if (activePointers.size === 0) {
        dragOrigin = null;
        lightbox.classList.remove("is-panning");
      } else if (activePointers.size === 1) {
        var remainingPointer = Array.from(activePointers.values())[0];
        dragOrigin = {
          x: remainingPointer.clientX - currentX,
          y: remainingPointer.clientY - currentY
        };
      }

      if (currentScale <= 1.01) {
        resetTransform();
      }
    }

    lightboxStage.addEventListener("pointerup", releasePointer);
    lightboxStage.addEventListener("pointercancel", releasePointer);
    lightboxStage.addEventListener("pointerleave", releasePointer);

    lightboxStage.addEventListener("wheel", function (event) {
      var nextScale;

      event.preventDefault();
      nextScale = currentScale + (event.deltaY < 0 ? 0.2 : -0.2);
      currentScale = Math.min(4, Math.max(1, nextScale));
      applyTransform();

      if (currentScale <= 1.01) {
        resetTransform();
      }
    });
  }

  function openLightbox(image) {
    ensureLightbox();
    resetTransform();
    lightboxImage.src = image.getAttribute("data-full-src") || image.currentSrc || image.src;
    lightboxImage.alt = image.alt || "";
    lightbox.classList.add("is-visible");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    if (!lightbox) {
      return;
    }

    lightbox.classList.remove("is-visible");
    lightbox.setAttribute("aria-hidden", "true");
    lightboxImage.removeAttribute("src");
    document.body.style.overflow = "";
    resetTransform();
  }

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
    nav.appendChild(
      createArrow(
        "上一页",
        currentPage > 1 ? currentPage - 1 : null,
        "home-pagination-link home-pagination-arrow"
      )
    );

    list = document.createElement("ol");
    list.className = "home-pagination-list";

    firstPage = Math.max(1, currentPage - 1);
    lastPage = Math.min(totalPages, currentPage + 1);

    for (pageNumber = firstPage; pageNumber <= lastPage; pageNumber += 1) {
      list.appendChild(createPaginationItem(pageNumber, currentPage));
    }

    nav.appendChild(list);
    nav.appendChild(
      createArrow(
        "下一页",
        currentPage < totalPages ? currentPage + 1 : null,
        "home-pagination-link home-pagination-arrow"
      )
    );
  }

  roots.forEach(function (root) {
    renderPagination(root);
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
    button.textContent = "复制";

    button.addEventListener("click", function () {
      var text = codeBlock.textContent;
      var resetTimer;

      function markCopied() {
        button.textContent = "已复制";
        window.clearTimeout(resetTimer);
        resetTimer = window.setTimeout(function () {
          button.textContent = "复制";
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
