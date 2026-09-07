// Minimal `vscode` module stub so scripts/check-risk-workbench.mjs can bundle and
// call the real Workshop render/save functions outside an extension host.
const noop = () => undefined;
const asyncNoop = async () => undefined;

export const window = {
  showWarningMessage: async (message) => {
    lastWarning = message;
    return undefined;
  },
  showErrorMessage: asyncNoop,
  showInformationMessage: asyncNoop,
  showInputBox: asyncNoop,
  showQuickPick: asyncNoop,
  showOpenDialog: asyncNoop,
  showSaveDialog: asyncNoop,
  createWebviewPanel: () => ({ webview: { html: "", onDidReceiveMessage: noop }, onDidDispose: noop, dispose: noop }),
  createOutputChannel: () => ({ appendLine: noop, show: noop, dispose: noop }),
  createTreeView: () => ({ dispose: noop }),
  registerWebviewViewProvider: () => ({ dispose: noop }),
  withProgress: async (_options, task) => task({ report: noop }, { isCancellationRequested: false })
};

export const commands = { registerCommand: () => ({ dispose: noop }), executeCommand: asyncNoop };
export const workspace = {
  workspaceFolders: undefined,
  getConfiguration: () => ({ get: () => undefined, update: asyncNoop }),
  fs: { readFile: asyncNoop, writeFile: asyncNoop },
  onDidChangeConfiguration: () => ({ dispose: noop })
};
export const env = { clipboard: { writeText: asyncNoop, readText: asyncNoop }, openExternal: asyncNoop };
export const Uri = {
  file: (value) => ({ fsPath: value, path: value, toString: () => value }),
  joinPath: (base) => base
};
export const ViewColumn = { One: 1, Two: 2, Beside: -2 };
export const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 };
export const ThemeIcon = class {};
export const EventEmitter = class {
  constructor() {
    this.event = noop;
  }
  fire() {}
  dispose() {}
};
export const TreeItem = class {
  constructor(label, collapsibleState) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
};
export const MarkdownString = class {
  constructor(value) {
    this.value = value;
  }
};
export const ProgressLocation = { Notification: 15, Window: 10 };
export const QuickPickItemKind = { Separator: -1, Default: 0 };

let lastWarning;
export const __lastWarning = () => lastWarning;
export const __resetWarning = () => {
  lastWarning = undefined;
};

export default {
  window,
  commands,
  workspace,
  env,
  Uri,
  ViewColumn,
  TreeItemCollapsibleState,
  ThemeIcon,
  EventEmitter,
  TreeItem,
  MarkdownString,
  ProgressLocation,
  QuickPickItemKind
};
