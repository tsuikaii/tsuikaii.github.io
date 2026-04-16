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
  var containers = document.querySelectorAll("[data-category-pagination]");

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

  function renderPagination(container) {
    var posts = Array.prototype.slice.call(container.querySelectorAll(".archive-post"));
    var nav = container.parentNode.querySelector("[data-category-pagination-nav]");
    var pageSize = parseInt(container.getAttribute("data-page-size"), 10) || 5;
    var totalPages = Math.ceil(posts.length / pageSize);
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

    posts.forEach(function (post, index) {
      var visible = index >= start && index < end;

      post.hidden = !visible;
      post.setAttribute("aria-hidden", visible ? "false" : "true");
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

  containers.forEach(function (container) {
    renderPagination(container);
  });
})();
