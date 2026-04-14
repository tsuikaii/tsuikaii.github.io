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
    lightboxImage.src = image.currentSrc || image.src;
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
