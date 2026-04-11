(function () {
  var menuToggle = document.querySelector(".secondary-toggle");
  var secondary = document.getElementById("secondary");
  var submenuToggles = document.querySelectorAll(".submenu-toggle");
  var submenuLinks = document.querySelectorAll(".menu-item-has-children > .menu-item-row > a");

  function toggleSubmenu(parent, toggle) {
    var expanded = toggle.getAttribute("aria-expanded") === "true";

    toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
    parent.classList.toggle("open");
  }

  if (menuToggle && secondary) {
    menuToggle.addEventListener("click", function () {
      var expanded = menuToggle.getAttribute("aria-expanded") === "true";
      menuToggle.setAttribute("aria-expanded", expanded ? "false" : "true");
      menuToggle.classList.toggle("toggled-on");
      secondary.classList.toggle("toggled-on");
    });
  }

  submenuToggles.forEach(function (toggle) {
    toggle.addEventListener("click", function () {
      var parent = toggle.closest(".menu-item-has-children");
      toggleSubmenu(parent, toggle);
    });
  });

  submenuLinks.forEach(function (link) {
    link.addEventListener("click", function (event) {
      var parent = link.closest(".menu-item-has-children");
      var toggle = parent && parent.querySelector(".submenu-toggle");

      if (!toggle) {
        return;
      }

      event.preventDefault();
      toggleSubmenu(parent, toggle);
    });
  });
})();
