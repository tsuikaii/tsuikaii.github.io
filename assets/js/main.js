(function () {
  var menuToggle = document.querySelector(".secondary-toggle");
  var secondary = document.getElementById("secondary");
  var submenuToggles = document.querySelectorAll(".submenu-toggle");

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
      var expanded = toggle.getAttribute("aria-expanded") === "true";

      toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
      parent.classList.toggle("open");
    });
  });
})();
