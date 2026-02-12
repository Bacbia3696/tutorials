export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function createLogger(logOutputElement) {
  return {
    append(message, tone = "") {
      const entry = document.createElement("div");
      entry.className = `log-entry ${tone}`.trim();
      entry.textContent = message;
      logOutputElement.appendChild(entry);
      logOutputElement.scrollTop = logOutputElement.scrollHeight;
    },
    clear() {
      logOutputElement.innerHTML = "";
    },
  };
}

export function createCodeHighlighter(panelSelector = ".code-panel") {
  const getPanels = () => document.querySelectorAll(panelSelector);

  return {
    focus(opType) {
      getPanels().forEach((panel) => {
        panel.classList.toggle("dimmed", panel.dataset.op !== opType);
      });
    },
    clear() {
      document.querySelectorAll(`${panelSelector} li.active`).forEach((line) => {
        line.classList.remove("active");
      });
    },
    highlight(opType, line) {
      this.focus(opType);
      this.clear();

      if (!line || line <= 0) {
        return;
      }

      const target = document.querySelector(
        `${panelSelector}[data-op="${opType}"] li[data-line="${line}"]`,
      );
      if (target) {
        target.classList.add("active");
      }
    },
  };
}

export function bindShortcutHandler({
  actions,
  target = window,
  ignoreWhen = (event) => isTypingTarget(event.target),
}) {
  const handler = (event) => {
    if (event.repeat) {
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    if (ignoreWhen(event)) {
      return;
    }

    const lower = event.key.toLowerCase();
    const action = actions[lower] ?? actions[event.key];
    if (!action) {
      return;
    }

    event.preventDefault();
    action(event);
  };

  target.addEventListener("keydown", handler);
  return () => target.removeEventListener("keydown", handler);
}

export function createOperationRunner({
  getSpeedMs,
  prepareOperation,
  applyEvent,
  updateMetrics,
  finalizeOperation,
  onPrepared,
  onNoPending,
}) {
  let pendingEvents = [];
  let pendingMeta = null;
  let eventIndex = 0;
  let playing = false;
  let playbackToken = 0;

  const notify = () => {
    updateMetrics?.();
  };

  const store = (operation) => {
    pendingEvents = operation.events ?? [];
    pendingMeta = operation;
    eventIndex = 0;
    onPrepared?.(operation);
    notify();
  };

  const stop = () => {
    playing = false;
    playbackToken += 1;
  };

  const finalize = () => {
    if (!pendingMeta) {
      return;
    }

    const meta = pendingMeta;
    pendingEvents = [];
    pendingMeta = null;
    eventIndex = 0;
    finalizeOperation?.(meta);
    notify();
  };

  const ensurePrepared = () => {
    if (pendingMeta) {
      return true;
    }

    const operation = prepareOperation();
    if (!operation) {
      return false;
    }

    store(operation);
    return true;
  };

  const animate = async () => {
    if (playing || !pendingMeta) {
      return;
    }

    playing = true;
    const token = playbackToken + 1;
    playbackToken = token;

    while (playbackToken === token && eventIndex < pendingEvents.length) {
      const event = pendingEvents[eventIndex];
      eventIndex += 1;
      applyEvent(event);
      notify();
      await sleep(getSpeedMs());
    }

    if (playbackToken !== token) {
      return;
    }

    playing = false;
    if (eventIndex >= pendingEvents.length) {
      finalize();
    }
  };

  /**
   * Skip to the last pending event and finalize immediately.
   *
   * IMPORTANT CONTRACT: This applies only the **last** event, skipping all
   * intermediate ones. Each event must therefore carry a complete, self-
   * contained snapshot of algorithm state — not an incremental delta — so
   * that jumping to the final event produces the correct end-state.
   */
  const finishCurrent = () => {
    if (!pendingMeta) {
      onNoPending?.();
      return;
    }

    stop();

    if (pendingEvents.length > 0) {
      const lastEvent = pendingEvents[pendingEvents.length - 1];
      eventIndex = pendingEvents.length;
      applyEvent(lastEvent);
      notify();
    }

    finalize();
  };

  const ensureNoPending = () => {
    if (!pendingMeta) {
      return;
    }
    finishCurrent();
  };

  const step = () => {
    stop();

    if (!ensurePrepared()) {
      return;
    }

    if (eventIndex >= pendingEvents.length) {
      finalize();
      return;
    }

    const event = pendingEvents[eventIndex];
    eventIndex += 1;
    applyEvent(event);
    notify();

    if (eventIndex >= pendingEvents.length) {
      finalize();
    }
  };

  const runInstant = () => {
    stop();
    ensureNoPending();

    const operation = prepareOperation();
    if (!operation) {
      return;
    }

    store(operation);
    finishCurrent();
  };

  const runAnimated = () => {
    stop();
    ensureNoPending();

    const operation = prepareOperation();
    if (!operation) {
      return;
    }

    store(operation);
    void animate();
  };

  return {
    stop,
    store,
    animate,
    step,
    runInstant,
    runAnimated,
    finishCurrent,
    ensureNoPending,
    get eventIndex() {
      return eventIndex;
    },
    get pendingLength() {
      return pendingEvents.length;
    },
    get hasPending() {
      return pendingMeta !== null;
    },
  };
}
