/**
 * Tabs: smooth sliding pill (CSS transition)
 */
(function initTabs() {
  const tabList = document.querySelector(".tabs");
  const tabs = document.querySelectorAll(".tab");
  const pill = document.getElementById("tabPill");
  if (!tabList || !pill || tabs.length === 0) return;

  function positionPill() {
    const active = tabList.querySelector(".tab.active");
    if (!active) return;
    pill.style.left = active.offsetLeft + "px";
    pill.style.width = active.offsetWidth + "px";
  }

  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      if (tabList.querySelector(".tab.active") === t) return;
      tabs.forEach(function (x) {
        x.classList.remove("active");
        x.setAttribute("aria-selected", "false");
      });
      t.classList.add("active");
      t.setAttribute("aria-selected", "true");
      positionPill();
    });
  });

  pill.style.transition = "none";
  positionPill();
  requestAnimationFrame(function () {
    pill.style.transition = "";
  });
  window.addEventListener("resize", positionPill);
})();
