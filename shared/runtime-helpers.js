import { createCodeHighlighter, createLogger } from './tutorial-core.js';

/**
 * Creates a set of commonly-used runtime helper functions for tutorial apps.
 * Reduces boilerplate by bundling logger, code highlighter, and UI update functions.
 *
 * @param {Object} options
 * @param {HTMLElement} options.logOutput - The log output container element
 * @param {HTMLElement} options.statusMessage - The status message element
 * @param {string} [options.codePanelSelector=".code-panel"] - CSS selector for the code panel
 * @returns {Object} Helper functions and instances
 */
export function createRuntimeHelpers({
  logOutput,
  statusMessage,
  codePanelSelector = '.code-panel',
}) {
  const logger = createLogger(logOutput);
  const codeHighlighter = createCodeHighlighter(codePanelSelector);

  return {
    logger,
    codeHighlighter,

    /**
     * Update the status message display.
     * @param {string} message
     */
    updateStatus(message) {
      statusMessage.textContent = message;
    },

    /**
     * Append a message to the log output.
     * @param {string} message
     * @param {string} [tone=""] - Optional tone class (e.g., "ok", "error")
     */
    appendLog(message, tone = '') {
      logger.append(message, tone);
    },

    /**
     * Clear all log entries.
     */
    clearLog() {
      logger.clear();
    },

    /**
     * Clear all code highlights.
     */
    clearCodeHighlights() {
      codeHighlighter.clear();
    },

    /**
     * Focus the code panel on a specific operation type.
     * @param {string} opType
     */
    focusCodePanel(opType) {
      codeHighlighter.focus(opType);
    },

    /**
     * Highlight a specific line in the code panel.
     * @param {string} opType
     * @param {number} line
     */
    highlightCode(opType, line) {
      codeHighlighter.highlight(opType, line);
    },
  };
}
