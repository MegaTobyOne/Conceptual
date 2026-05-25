import { PSPF_SLICE_VERSION } from "@pspf/contracts";
import {
  commandButtonAcknowledgementScript,
  homeActionButton,
  homePanelShellHtml,
  tokensCss
} from "@pspf/webview-shell";

/**
 * Workshop webview chrome wrappers.
 *
 * The home shell delegates to the shared `homePanelShellHtml` helper so the
 * Workshop, Shop, and Pub sidebars present the same chrome (header, banner,
 * anchor nav, footer) with a per-extension accent. The panel shell is kept
 * here as a bespoke template-string builder because Workshop's main-panel
 * surfaces are far richer than Shop/Pub equivalents.
 *
 * Note: a couple of strings here are surveyed by the release-candidate gate
 * (`scripts/check-release-candidate.mjs`) — "System of record",
 * "Workshop is the decision surface", and "Local workspace writes stay in
 * Workshop". If you change them, update the gate too.
 */

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function homeShellHtml(title: string, body: string): string {
  return homePanelShellHtml({
    extensionLabel: "PSPF Workshop",
    title,
    tagline: "System of record",
    version: PSPF_SLICE_VERSION,
    accent: "blue",
    sensitivityBanner: "OFFICIAL: Sensitive · Local workspace writes stay in Workshop",
    body
  });
}

export function homeButton(command: string, text: string, description?: string): string {
  return homeActionButton(command, text, description);
}

export function shellHtml(title: string, body: string): string {
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    /* Shared PSPF webview tokens + base rules (see @pspf/webview-shell). */
    ${tokensCss("extension")}
    /* Workshop main-panel surface tokens layered on top of the shared base. */
    :root {
      color-scheme: light dark;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --workshop-blue: var(--pspf-accent);
      --workshop-blue-soft: var(--pspf-accent-soft);
      --workshop-blue-strong: rgba(37, 99, 235, 0.28);
      --amber: var(--pspf-warn);
      --amber-soft: var(--pspf-warn-soft);
      --radius: var(--pspf-radius-lg);
      --radius-sm: var(--pspf-radius-sm);
      --gap: var(--pspf-gap-md);
      --gap-lg: var(--pspf-gap-lg);
      --pad: var(--pspf-pad);
      --pad-lg: var(--pspf-pad-lg);
      --text: var(--vscode-foreground);
      --muted: var(--vscode-descriptionForeground);
      --surface: var(--vscode-editor-background);
      --surface-strong: var(--vscode-input-background, var(--vscode-editor-background));
      --border: var(--vscode-panel-border, var(--vscode-input-border));
    }
    body { margin: 0; color: var(--text); background: radial-gradient(circle at top left, var(--workshop-blue-soft), transparent 28rem), var(--vscode-editor-background); font-feature-settings: "ss01", "cv01"; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: var(--pad) var(--pad-lg); border-bottom: 1px solid var(--border); background: linear-gradient(135deg, var(--workshop-blue-strong) 0%, transparent 72%); }
    header strong { display: block; font-size: 20px; letter-spacing: 0.005em; }
    header span { color: var(--muted); font-size: 12.5px; }
    main { max-width: 1180px; margin: 0 auto; padding: var(--pad-lg); }
    main:has(.pspf-connected-view) { max-width: min(1760px, calc(100vw - 24px)); }
    main:has(.requirement-browser) { max-width: 1320px; }
    main:has(.strategy-editor) { max-width: min(1680px, calc(100vw - 24px)); }
    section { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--gap); margin-bottom: var(--gap); }
    section > h2:first-child { margin-top: 0; }
    h1 { margin: 0 0 8px; font-size: 22px; letter-spacing: -0.005em; }
    h2 { font-size: 16px; margin-top: 0; margin-bottom: 10px; letter-spacing: 0.01em; }
    h3 { font-size: 14px; margin: 12px 0 6px; }
    p { line-height: 1.5; }
    .eyebrow { margin: 0 0 6px; color: var(--workshop-blue); font-size: var(--pspf-type-label); font-weight: 700; text-transform: uppercase; letter-spacing: var(--pspf-letter-label); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
    .metric { border: 1px solid var(--border); border-radius: var(--radius); padding: var(--pspf-gap-md); background: var(--surface-strong); }
    .metric span { color: var(--muted); display: block; font-size: var(--pspf-type-label); text-transform: uppercase; letter-spacing: var(--pspf-letter-label); }
    .metric strong { display: block; font-size: 28px; line-height: 1.1; margin-top: 6px; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
    .table-wrap { width: 100%; overflow-x: auto; margin-top: 10px; border-radius: var(--radius-sm); }
    table { width: 100%; min-width: min(760px, 100%); border-collapse: collapse; table-layout: auto; }
    th, td { text-align: left; padding: var(--pspf-table-cell-pad-y) var(--pspf-table-cell-pad-x); border-bottom: 1px solid var(--border); vertical-align: top; }
    td { overflow-wrap: anywhere; }
    th { color: var(--muted); font-weight: 600; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.04em; background: color-mix(in srgb, var(--surface-strong) 75%, transparent); position: sticky; top: 0; }
    tbody tr:hover { background: color-mix(in srgb, var(--workshop-blue) 6%, transparent); }
    tbody tr:last-child td { border-bottom: none; }
    th[data-field="title"], td[data-field="title"], th[data-field="requirement"], td[data-field="requirement"], th[data-field="hint"], td[data-field="hint"], th[data-field="target"], td[data-field="target"] { min-width: 18rem; max-width: 34rem; }
    th[data-field="explanation"], td[data-field="explanation"] { max-width: 22rem; }
    .cell-compact { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    th[data-field="controlId"], td[data-field="controlId"], th[data-field="coverage"], td[data-field="coverage"], th[data-field="profile"], td[data-field="profile"], th[data-field="confidence"], td[data-field="confidence"], th[data-field="reviewed"], td[data-field="reviewed"], th[data-field="drift"], td[data-field="drift"], th[data-field="release"], td[data-field="release"], th[data-field="status"], td[data-field="status"], th[data-field="freshness"], td[data-field="freshness"] { white-space: nowrap; width: 1%; font-variant-numeric: tabular-nums; }
    th[data-field="open"], td[data-field="open"] { white-space: nowrap; width: 1%; }
    button, input, select, textarea { font: inherit; }
    .form-grid { display: grid; gap: 12px; max-width: 640px; }
    label { display: grid; gap: 5px; color: var(--text); font-size: 13px; }
    input, select, textarea { width: 100%; }
    input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: -1px; border-color: transparent; }
    textarea { resize: vertical; min-height: 96px; line-height: 1.45; }
    input[readonly] { color: var(--muted); background: color-mix(in srgb, var(--surface-strong) 65%, transparent); }
    .form-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
    .strategy-editor__form { max-width: none; display: block; }
    .strategy-editor__form section { margin-bottom: var(--gap); }
    .strategy-editor__layout { width: min(100%, 1480px); display: grid; grid-template-columns: minmax(230px, 300px) minmax(0, 1fr); gap: var(--gap); align-items: start; }
    .strategy-editor__nav { position: sticky; top: var(--pad); max-height: calc(100vh - 150px); overflow: auto; display: grid; align-content: start; gap: 7px; }
    .strategy-editor__nav h2 { margin-bottom: 2px; }
    .strategy-editor__nav-item { width: 100%; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 10px; color: var(--text); background: var(--surface-strong); text-align: left; cursor: pointer; }
    .strategy-editor__nav-item:hover { border-color: var(--workshop-blue); background: color-mix(in srgb, var(--workshop-blue) 8%, var(--surface-strong)); }
    .strategy-editor__nav-item[aria-current="page"] { border-color: var(--workshop-blue); box-shadow: inset 3px 0 0 var(--workshop-blue); }
    .strategy-editor__nav-item--nested { margin-left: 12px; width: calc(100% - 12px); }
    .strategy-editor__nav-item strong { display: block; color: var(--workshop-blue); font-size: var(--pspf-type-label); font-weight: 700; text-transform: uppercase; letter-spacing: var(--pspf-letter-label); }
    .strategy-editor__nav-item span { display: block; margin-top: 3px; color: var(--muted); font-size: 12px; line-height: 1.3; }
    .strategy-editor__two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; align-items: start; }
    .strategy-editor__field { margin-top: 12px; }
    .strategy-editor__field textarea { min-height: 10rem; }
    .strategy-editor__nested { margin-top: 14px; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: color-mix(in srgb, var(--surface-strong) 78%, transparent); }
    .strategy-editor__measure { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); }
    .requirement-browser { width: min(100%, 1320px); display: grid; grid-template-columns: minmax(210px, 260px) minmax(0, 1fr); gap: var(--gap); align-items: start; }
    .requirement-browser__nav { position: sticky; top: var(--pad); max-height: calc(100vh - 150px); display: grid; grid-template-rows: auto auto minmax(0, 1fr); gap: 10px; }
    .requirement-browser__nav h2 { margin-bottom: 0; }
    .requirement-browser__filter { box-sizing: border-box; }
    .requirement-browser__list { overflow: auto; display: grid; gap: 6px; padding-right: 2px; }
    .requirement-browser__item { width: 100%; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 7px 9px; color: var(--text); background: var(--surface-strong); text-align: left; cursor: pointer; }
    .requirement-browser__item:hover { border-color: var(--workshop-blue); background: color-mix(in srgb, var(--workshop-blue) 8%, var(--surface-strong)); }
    .requirement-browser__item[aria-current="page"] { border-color: var(--workshop-blue); box-shadow: inset 3px 0 0 var(--workshop-blue); }
    .requirement-browser__number { display: block; color: var(--workshop-blue); font-size: var(--pspf-type-label); font-weight: 700; text-transform: uppercase; letter-spacing: var(--pspf-letter-label); }
    .requirement-browser__meta { display: block; margin-top: 3px; color: var(--muted); font-size: 12px; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .requirement-browser__content { min-width: 0; }
    .poa-board { display: grid; gap: 12px; overflow-x: auto; padding-bottom: 4px; }
    .poa-phase { min-width: max(760px, var(--poa-width)); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px; background: linear-gradient(180deg, color-mix(in srgb, var(--workshop-blue) 8%, var(--surface)), var(--surface)); }
    .poa-phase__header { display: grid; gap: 3px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
    .poa-phase__header strong { font-size: 13px; }
    .poa-phase__header span { color: var(--muted); font-size: 12px; line-height: 1.35; }
    .poa-phase__tasks { display: grid; gap: 7px; }
    .poa-task { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 10px; align-items: center; }
    .poa-task[hidden] { display: none; }
    .poa-task__label { display: grid; gap: 2px; min-height: 34px; padding: 6px 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); background: var(--surface-strong); text-align: left; }
    .poa-task__label strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .poa-task__label span { color: var(--muted); font-size: 11px; }
    .poa-timeline-legend { display: inline-flex; align-items: center; gap: 7px; margin-top: 6px; padding: 3px 8px; border: 1px solid color-mix(in srgb, var(--amber) 55%, var(--border)); border-radius: var(--radius-sm); color: var(--muted); background: color-mix(in srgb, var(--amber) 12%, var(--surface)); font-size: 11px; font-weight: 600; }
    .poa-today-legend-line { display: inline-block; width: 0; height: 16px; border-left: 2px solid var(--amber); }
    .poa-track { position: relative; min-height: 34px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: repeating-linear-gradient(90deg, color-mix(in srgb, var(--border) 45%, transparent) 0 1px, transparent 1px 28px), color-mix(in srgb, var(--surface-strong) 80%, transparent); overflow: hidden; }
    .poa-today-marker { position: absolute; top: 0; bottom: 0; width: 0; border-left: 2px solid var(--amber); z-index: 2; pointer-events: none; }
    .poa-bar { position: absolute; top: 5px; height: 22px; display: flex; align-items: center; min-width: 18px; max-width: calc(100% - 2px); border-radius: 999px; padding: 0 8px; color: #fff; font-size: 11px; font-weight: 700; line-height: 1; box-sizing: border-box; overflow: hidden; white-space: nowrap; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.24); }
    .poa-bar--blocked { background: #b42318; }
    .poa-bar--overdue { background: #b54708; }
    .poa-bar--due-soon { background: #1d4ed8; }
    .poa-bar--normal { background: #047857; }
    .poa-status-filters { margin: 8px 0 12px; }
    .poa-status-filter[aria-pressed="false"] { opacity: 0.55; }
    .workshop-sensitivity { margin: 0; padding: 8px var(--pad-lg); }
    .muted { color: var(--muted); }
    .version-strip { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    a { color: var(--vscode-textLink-foreground); }
    a:hover { color: var(--vscode-textLink-activeForeground); }
    @media (max-width: 720px) {
      main { padding: var(--pad); }
      header { padding: var(--pad); }
      .workshop-sensitivity { padding: 8px var(--pad); }
      .requirement-browser { grid-template-columns: 1fr; }
      .strategy-editor__two-col { grid-template-columns: 1fr; }
      .strategy-editor__layout { grid-template-columns: 1fr; }
      .strategy-editor__nav { position: static; max-height: none; }
      .requirement-browser__nav { position: static; max-height: none; }
      .requirement-browser__list { max-height: 320px; }
      .poa-task { grid-template-columns: 1fr; }
      .poa-task__label strong { white-space: normal; }
      table { min-width: 680px; }
      th[data-field="title"], td[data-field="title"], th[data-field="requirement"], td[data-field="requirement"], th[data-field="hint"], td[data-field="hint"] { min-width: 16rem; }
    }
  </style>
</head>
<body>
  <header><strong>PSPF Workshop</strong><span>System of record · v${PSPF_SLICE_VERSION}</span></header>
  <div class="pspf-sensitivity-banner workshop-sensitivity">OFFICIAL: Sensitive · Workshop is the decision surface</div>
  <main>
    ${body}
  </main>
  <script>
    const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : undefined;
    ${commandButtonAcknowledgementScript}
    function pspfFormFields(form) {
      const data = new FormData(form);
      const fields = {};
      for (const [key, value] of data.entries()) {
        fields[key] = String(value);
      }
      return fields;
    }
    function pspfSerialiseForm(form) {
      return JSON.stringify(pspfFormFields(form));
    }
    function pspfActiveEditorForm() {
      return document.querySelector('form.form-grid');
    }
    function pspfWebviewState() {
      return vscode?.getState?.() || {};
    }
    function pspfUpdateWebviewState(patch) {
      if (!vscode?.setState) {
        return;
      }
      vscode.setState({ ...pspfWebviewState(), ...patch });
    }
    function pspfBrowserListKey(list) {
      return list.getAttribute('aria-label') || 'workbench-list';
    }
    function pspfRestoreBrowserScroll() {
      const list = document.querySelector('.requirement-browser__list');
      if (!(list instanceof HTMLElement)) {
        return;
      }
      const state = pspfWebviewState();
      const scrollByKey = state.browserScrollByKey || {};
      const top = scrollByKey[pspfBrowserListKey(list)];
      if (typeof top === 'number') {
        list.scrollTop = top;
      }
    }
    function pspfIsDirtyForm(form) {
      return form && form.dataset.initialValue !== undefined && form.dataset.initialValue !== pspfSerialiseForm(form);
    }
    function pspfPendingCommandPayload(button, command, fields) {
      return {
        command: 'confirmDirtyNavigation',
        entityType: fields.entityType || '',
        entityId: fields.entityId || '',
        fields,
        pendingCommand: command,
        pendingEntityType: button.getAttribute('data-entity-type'),
        pendingEntityId: button.getAttribute('data-entity-id'),
        pendingRequirementId: button.getAttribute('data-requirement-id'),
        pendingDirectionId: button.getAttribute('data-direction-id'),
        pendingTagId: button.getAttribute('data-tag-id'),
        pendingSavedViewId: button.getAttribute('data-saved-view-id'),
        pendingSavedViewScope: button.getAttribute('data-saved-view-scope'),
        pendingDirection: button.getAttribute('data-direction'),
        pendingEvidenceReference: button.getAttribute('data-evidence-reference'),
        pendingStrategyArea: button.getAttribute('data-strategy-area'),
        pendingChoiceIndex: button.getAttribute('data-choice-index'),
        pendingOutcomeIndex: button.getAttribute('data-outcome-index'),
        pendingFilterText: document.querySelector('.requirement-browser__filter') instanceof HTMLInputElement ? document.querySelector('.requirement-browser__filter').value : ''
      };
    }
    function pspfPostDirtyState(form) {
      if (!vscode || !form) {
        return;
      }
      const fields = pspfFormFields(form);
      vscode.postMessage({
        command: 'editorDirtyState',
        entityType: fields.entityType || '',
        entityId: fields.entityId || '',
        isDirty: pspfIsDirtyForm(form),
        fields
      });
    }
    document.querySelectorAll('form.form-grid').forEach((form) => {
      form.dataset.initialValue = pspfSerialiseForm(form);
    });
    requestAnimationFrame(pspfRestoreBrowserScroll);
    document.querySelectorAll('.requirement-browser__list').forEach((list) => {
      if (!(list instanceof HTMLElement)) {
        return;
      }
      list.addEventListener('scroll', () => {
        const state = pspfWebviewState();
        const browserScrollByKey = { ...(state.browserScrollByKey || {}) };
        browserScrollByKey[pspfBrowserListKey(list)] = list.scrollTop;
        pspfUpdateWebviewState({ browserScrollByKey });
      }, { passive: true });
    });
    document.addEventListener('click', (event) => {
      const button = event.target instanceof HTMLElement ? event.target.closest('button[data-command]') : null;
      if (!button || !vscode) {
        return;
      }
      const command = button.getAttribute('data-command');
      const saveCommands = new Set(['saveEntity', 'saveAndCloseEntity', 'saveAndNextEntity']);
      const activeForm = pspfActiveEditorForm();
      if (command && !saveCommands.has(command) && pspfIsDirtyForm(activeForm)) {
        vscode.postMessage(pspfPendingCommandPayload(button, command, pspfFormFields(activeForm)));
        return;
      }
      pspfAcknowledgeCommandButton(button);
      if (command === 'openEntity') {
        vscode.postMessage({ command, entityType: button.getAttribute('data-entity-type'), entityId: button.getAttribute('data-entity-id') });
      }
      if (command === 'openEvidenceReference') {
        const form = button.closest('form');
        const fields = form ? pspfFormFields(form) : undefined;
        vscode.postMessage({ command, evidenceReference: fields?.reference || button.getAttribute('data-evidence-reference') });
      }
      if (command === 'copyEvidenceReviewSummary') {
        vscode.postMessage({ command });
      }
      if (command === 'copyRequirementBrief') {
        vscode.postMessage({ command, requirementId: button.getAttribute('data-requirement-id') });
      }
      if (command === 'copyEvidenceBrief' || command === 'linkEvidenceToRequirements') {
        vscode.postMessage({ command, entityId: button.getAttribute('data-entity-id') });
      }
      if (command === 'openRequirementInEditor') {
        const filterInput = document.querySelector('.requirement-browser__filter');
        const filterText = filterInput instanceof HTMLInputElement ? filterInput.value : '';
        vscode.postMessage({ command, requirementId: button.getAttribute('data-requirement-id'), filterText });
      }
      if (command === 'openRecordInEditor') {
        const filterInput = document.querySelector('.requirement-browser__filter');
        const filterText = filterInput instanceof HTMLInputElement ? filterInput.value : '';
        vscode.postMessage({
          command,
          entityType: button.getAttribute('data-entity-type'),
          entityId: button.getAttribute('data-entity-id'),
          filterText
        });
      }
      if (command === 'openAdjacentRequirement') {
        vscode.postMessage({ command, requirementId: button.getAttribute('data-requirement-id'), direction: button.getAttribute('data-direction') });
      }
      if (command === 'openAdjacentDirection') {
        vscode.postMessage({ command, directionId: button.getAttribute('data-direction-id'), direction: button.getAttribute('data-direction') });
      }
      if (command === 'recordChange') {
        vscode.postMessage({ command, entityType: button.getAttribute('data-entity-type'), entityId: button.getAttribute('data-entity-id') });
      }
      if (command === 'createTag' || command === 'editTag' || command === 'archiveTag' || command === 'applyTag' || command === 'removeTag') {
        vscode.postMessage({ command, tagId: button.getAttribute('data-tag-id'), requirementId: button.getAttribute('data-requirement-id') });
      }
      if (command === 'attachEvidenceToRequirement' || command === 'createActionForRequirement' || command === 'createRiskForRequirement' || command === 'mapRequirementToIsm') {
        vscode.postMessage({ command, requirementId: button.getAttribute('data-requirement-id') });
      }
      if (command === 'openIsmControlDetail' || command === 'attachEvidenceForIsmControl' || command === 'createActionForIsmControl' || command === 'createRiskForIsmControl') {
        vscode.postMessage({ command, sourceControlId: button.getAttribute('data-source-control-id') });
      }
      if (command === 'linkExistingEvidenceToRequirement' || command === 'linkExistingActionToRequirement' || command === 'linkExistingRiskToRequirement' || command === 'linkExistingDirectionToRequirement') {
        vscode.postMessage({ command, requirementId: button.getAttribute('data-requirement-id') });
      }
      if (command === 'createSavedView' || command === 'applySavedView' || command === 'editSavedView' || command === 'editSavedViewFilters' || command === 'archiveSavedView') {
        vscode.postMessage({ command, savedViewId: button.getAttribute('data-saved-view-id'), savedViewScope: button.getAttribute('data-saved-view-scope') });
      }
      if (command === 'createStrategyDraft') {
        vscode.postMessage({ command });
      }
      if (command === 'openStrategyArea') {
        vscode.postMessage({ command, strategyArea: button.getAttribute('data-strategy-area') });
      }
      if (command === 'addStrategyChoice' || command === 'addStrategyOutcome' || command === 'addStrategyMeasure' || command === 'linkStrategyRequirement' || command === 'mapStrategyRequirementToIsm') {
        vscode.postMessage({
          command,
          strategyArea: button.getAttribute('data-strategy-area'),
          choiceIndex: button.getAttribute('data-choice-index'),
          outcomeIndex: button.getAttribute('data-outcome-index')
        });
      }
      if (command === 'pspf.workshop.loadSampleWorkspace') {
        vscode.postMessage({ command });
      } else if (command && command.startsWith('pspf.')) {
        vscode.postMessage({ command });
      }
      if (command === 'refresh') {
        vscode.postMessage({ command });
      }
      if (command === 'saveEntity' || command === 'saveAndCloseEntity' || command === 'saveAndNextEntity') {
        const form = button.closest('form');
        if (!form) {
          return;
        }
        const fields = pspfFormFields(form);
        vscode.postMessage({
          command,
          entityType: String(fields.entityType || ''),
          entityId: String(fields.entityId || ''),
          strategyArea: String(fields.strategyArea || ''),
          fields
        });
      }
    });
    document.addEventListener('input', (event) => {
      const input = event.target instanceof HTMLInputElement ? event.target : null;
      const editedForm = event.target instanceof HTMLElement ? event.target.closest('form.form-grid') : null;
      if (editedForm) {
        editedForm.dataset.dirty = String(pspfIsDirtyForm(editedForm));
        pspfPostDirtyState(editedForm);
      }
      const targetSelector = input?.getAttribute('data-filter-target');
      if (!input || !targetSelector) {
        return;
      }
      const filterText = input.value.trim().toLocaleLowerCase('en-AU');
      document.querySelectorAll(targetSelector).forEach((item) => {
        if (!(item instanceof HTMLElement)) {
          return;
        }
        const searchable = (item.getAttribute('data-search') || item.textContent || '').toLocaleLowerCase('en-AU');
        item.hidden = filterText.length > 0 && !searchable.includes(filterText);
      });
    });
  </script>
</body>
</html>`;
}
