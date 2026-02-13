/**
 * Main page init: format count with commas, etc.
 */
(function () {
  const el = document.getElementById("joinedCount");
  if (el) {
    el.textContent = Number(el.textContent.replace(/[^0-9]/g, "")).toLocaleString();
  }
})();
