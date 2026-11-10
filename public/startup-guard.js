// A plain script, loaded before the app. If the app fails to start, a white
// window tells the student nothing, so this writes the error into the window.
// The app strings are not available here (they are part of the app that may
// have failed to load), so the message is in Polish and English.
(function () {
  var failures = [];

  function mounted() {
    var app = document.getElementById("app");
    return !!app && app.childElementCount > 0;
  }

  function describe(reason) {
    if (reason && reason.stack) return String(reason.stack);
    if (reason && reason.message) return String(reason.message);
    return String(reason);
  }

  function show(detail) {
    if (mounted()) return;
    var root = document.getElementById("app") || document.body;
    root.textContent = "";
    var box = document.createElement("div");
    box.setAttribute("role", "alert");
    box.style.cssText =
      "font:16px/1.5 system-ui,sans-serif;padding:32px;max-width:720px;color:#222;background:#fff;min-height:100vh;box-sizing:border-box";
    var title = document.createElement("h1");
    title.style.cssText = "font-size:20px;margin:0 0 8px";
    title.textContent = "WYSITyp nie uruchomił się / WYSITyp failed to start";
    var hint = document.createElement("p");
    hint.style.margin = "0 0 16px";
    hint.textContent =
      "Zamknij okno i uruchom aplikację ponownie. Twoje notatki są bezpieczne w plikach. / Close the window and start the app again. Your notes are safe in their files.";
    var pre = document.createElement("pre");
    pre.style.cssText =
      "white-space:pre-wrap;word-break:break-word;font:13px/1.4 ui-monospace,Consolas,monospace;background:#f3f3f3;padding:12px;border-radius:6px";
    pre.textContent = detail;
    box.appendChild(title);
    box.appendChild(hint);
    box.appendChild(pre);
    root.appendChild(box);
  }

  window.addEventListener("error", function (event) {
    failures.push(describe(event.error || event.message));
    show(failures.join("\n\n"));
  });
  window.addEventListener("unhandledrejection", function (event) {
    failures.push(describe(event.reason));
    show(failures.join("\n\n"));
  });
  window.setTimeout(function () {
    if (!mounted()) {
      show(
        failures.length > 0
          ? failures.join("\n\n")
          : "The page did not start within 10 seconds.",
      );
    }
  }, 10000);
})();
