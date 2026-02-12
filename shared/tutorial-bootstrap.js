import { bindShortcutHandler } from "./tutorial-core.js";

export function setupRunnerControls({
  elements,
  runAnimated,
  runStep,
  runInstant,
  runFinish,
  getSpeedMs,
  setSpeedMs,
  clearLog,
  extraShortcuts = {},
}) {
  elements.animateBtn.addEventListener("click", runAnimated);
  elements.stepBtn.addEventListener("click", runStep);
  elements.instantBtn.addEventListener("click", runInstant);
  elements.finishBtn.addEventListener("click", runFinish);

  elements.speedRange.addEventListener("input", () => {
    const speedMs = Number(elements.speedRange.value);
    setSpeedMs(speedMs);
    elements.speedLabel.textContent = `${speedMs} ms`;
  });

  elements.speedLabel.textContent = `${getSpeedMs()} ms`;
  elements.clearLogBtn.addEventListener("click", () => {
    clearLog();
  });

  const shortcuts = {
    a: () => runAnimated(),
    s: () => runStep(),
    i: () => runInstant(),
    f: () => runFinish(),
    ...extraShortcuts,
  };
  return bindShortcutHandler({ actions: shortcuts });
}

export function bindDebouncedResize({
  onResize,
  delayMs = 120,
  target = window,
}) {
  let timer = null;

  const handler = () => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      onResize();
    }, delayMs);
  };

  target.addEventListener("resize", handler);
  return () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    target.removeEventListener("resize", handler);
  };
}
