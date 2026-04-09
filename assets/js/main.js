(function () {
  var body = document.body;
  var sidebarToggle = document.querySelector(".sidebar-toggle");
  var menuToggle = document.querySelector(".secondary-toggle");
  var secondary = document.getElementById("secondary");
  var submenuToggles = document.querySelectorAll(".submenu-toggle");

  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", function () {
      var collapsed = body.classList.toggle("sidebar-collapsed");
      sidebarToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      sidebarToggle.textContent = collapsed ? "展开侧栏" : "收起侧栏";
    });
  }

  if (menuToggle && secondary) {
    menuToggle.addEventListener("click", function () {
      var expanded = menuToggle.getAttribute("aria-expanded") === "true";
      menuToggle.setAttribute("aria-expanded", expanded ? "false" : "true");
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
