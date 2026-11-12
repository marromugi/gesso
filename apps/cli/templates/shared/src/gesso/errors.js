// Shows on the page every error the page reports: a file or library that won't load, a throw
// before the game starts, and the error that stops the game (the runtime reports it). A plain
// script that loads first and imports nothing, so it works even when the modules can't load.
// See CLAUDE.md.
(() => {
  /** @param {string} message */
  function show(message) {
    const box = document.createElement("pre");
    box.textContent = message;
    box.style.cssText =
      "position:fixed;inset:auto 0 0 0;margin:0;padding:12px;background:#400c;color:#fff;font:12px monospace;white-space:pre-wrap;z-index:1";
    (document.body ?? document.documentElement).append(box);
  }

  /** @param {unknown} error */
  function describe(error) {
    if (!(error instanceof Error)) return String(error);
    const text = error.stack ?? String(error);
    return error.cause === undefined ? text : `${text}\n原因: ${describe(error.cause)}`;
  }

  addEventListener(
    "error",
    (event) => {
      const { target } = event;
      if (target instanceof HTMLScriptElement && target.type === "module") {
        // A module fails when any file or library it imports, however deep, fails to load.
        show(`読み込めません: ${target.src} か、それが import するファイルかライブラリ`);
      } else if (target instanceof HTMLScriptElement || target instanceof HTMLLinkElement) {
        show(`読み込めません: ${target instanceof HTMLScriptElement ? target.src : target.href}`);
      } else if (target instanceof HTMLImageElement || target instanceof HTMLMediaElement) {
        show(`読み込めません: ${target.currentSrc || target.src}`);
      } else if (event instanceof ErrorEvent) {
        show(describe(event.error ?? event.message));
      }
    },
    // Load failures happen on elements and don't bubble; capturing sees them.
    true,
  );
  addEventListener("unhandledrejection", (event) => show(describe(event.reason)));
})();
