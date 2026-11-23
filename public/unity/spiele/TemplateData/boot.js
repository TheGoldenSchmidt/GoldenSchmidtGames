// Starts the Unity build without inline scripts (the app's Content-Security-Policy allows only
// same-origin script files). Phones render at most at twice the CSS resolution to save battery.
(function () {
  "use strict";
  var boot = document.getElementById("gsg-boot");
  var d = boot.dataset;
  var canvas = document.getElementById("unity-canvas");
  var fill = document.getElementById("gsg-loading-fill");
  var overlay = document.getElementById("gsg-loading");
  var hint = document.getElementById("gsg-loading-hint");

  function fail(message) {
    overlay.classList.add("is-error");
    hint.textContent = "Unity konnte nicht starten: " + message + " – bitte die Seite neu laden.";
  }

  if (!window.WebGL2RenderingContext) {
    fail("Dieser Browser kann kein WebGL 2.");
    return;
  }

  var script = document.createElement("script");
  script.src = d.loader;
  script.onerror = function () { fail("Ladeprogramm nicht erreichbar."); };
  script.onload = function () {
    window.createUnityInstance(canvas, {
      dataUrl: d.data,
      frameworkUrl: d.framework,
      codeUrl: d.code,
      streamingAssetsUrl: "StreamingAssets",
      companyName: d.company,
      productName: d.product,
      productVersion: d.version,
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      showBanner: function (message, type) { if (type === "error") fail(message); }
    }, function (progress) {
      fill.style.width = Math.round(progress * 100) + "%";
    }).then(function (instance) {
      window.gsgUnity = instance;
      overlay.classList.add("is-done");
      setTimeout(function () { overlay.hidden = true; }, 400);
    }).catch(function (message) { fail(String(message)); });
  };
  document.body.appendChild(script);

  // Keep the page from scrolling or zooming under the fingers.
  document.addEventListener("touchmove", function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener("gesturestart", function (e) { e.preventDefault(); });
})();
