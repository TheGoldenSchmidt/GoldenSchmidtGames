// Messages between the app (parent window, same origin) and a Unity build in its iframe.
// App → Unity: { source: "gsg-app", payload } → SendMessage("Bridge", "OnMessage", json).
// Unity → App: GSG_Post(json) → { source: "gsg-unity", payload }.
mergeInto(LibraryManager.library, {
  GSG_BridgeStart: function () {
    var deliver = function (json) {
      if (typeof SendMessage === "function") SendMessage("Bridge", "OnMessage", json);
      else if (window.gsgUnity) window.gsgUnity.SendMessage("Bridge", "OnMessage", json);
    };
    window.addEventListener("message", function (event) {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      var data = event.data;
      if (!data || data.source !== "gsg-app" || !data.payload) return;
      deliver(JSON.stringify(data.payload));
    });
  },
  GSG_Post: function (json) {
    var text = UTF8ToString(json);
    if (window.parent && window.parent !== window) window.parent.postMessage({ source: "gsg-unity", payload: JSON.parse(text) }, window.location.origin);
  }
});
