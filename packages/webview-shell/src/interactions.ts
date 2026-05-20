/**
 * Shared lightweight browser helpers for PSPF webview interaction feedback.
 *
 * The snippet is intentionally plain JavaScript so extension webviews can
 * inline it beside their local `vscode.postMessage` bridge without relaxing
 * CSP or loading extra scripts.
 */
export const commandButtonAcknowledgementScript = String.raw`
function pspfAcknowledgeCommandButton(button) {
  button.setAttribute("aria-busy", "true");
  button.dataset.state = "saving";
  window.setTimeout(() => {
    if (!button.isConnected) {
      return;
    }
    button.removeAttribute("aria-busy");
    delete button.dataset.state;
  }, 900);
}
`;
