(function () {
  var submenuLinks = document.querySelectorAll(".menu-item-has-children > .submenu-link");

  function setSubmenuState(parent, link, isOpen) {
    if (!parent || !link) {
      return;
    }

    link.setAttribute("aria-expanded", isOpen ? "true" : "false");
    parent.classList.toggle("open", isOpen);
  }

  submenuLinks.forEach(function (link) {
    link.addEventListener("click", function (event) {
      var parent = link.closest(".menu-item-has-children");
      var expanded = link.getAttribute("aria-expanded") === "true";

      event.preventDefault();
      submenuLinks.forEach(function (otherLink) {
        if (otherLink !== link) {
          setSubmenuState(otherLink.closest(".menu-item-has-children"), otherLink, false);
        }
      });
      setSubmenuState(parent, link, !expanded);
    });
  });

  document.addEventListener("click", function (event) {
    submenuLinks.forEach(function (link) {
      var parent = link.closest(".menu-item-has-children");

      if (parent && !parent.contains(event.target)) {
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
})();

(function () {
  var lightbox;
  var lightboxImage;

  function ensureLightbox() {
    if (lightbox) {
      return;
    }

    lightbox = document.createElement("div");
    lightbox.className = "image-lightbox";
    lightbox.setAttribute("aria-hidden", "true");

    lightboxImage = document.createElement("img");
    lightboxImage.alt = "";

    lightbox.appendChild(lightboxImage);
    document.body.appendChild(lightbox);

    lightbox.addEventListener("click", function () {
      closeLightbox();
    });
  }

  function openLightbox(image) {
    ensureLightbox();
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

    for (pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
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
