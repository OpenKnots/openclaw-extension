import { vi } from 'vitest';

const createDisposable = () => ({ dispose: vi.fn() });

const createOutputChannel = vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    appendLine: vi.fn(),
    append: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
}));

export const window = {
    createStatusBarItem: vi.fn(() => ({
        show: vi.fn(),
        hide: vi.fn(),
        dispose: vi.fn(),
        text: '',
        tooltip: '',
        command: '',
        name: '',
        accessibilityInformation: {},
    })),
    createTreeView: vi.fn(() => createDisposable()),
    registerWebviewViewProvider: vi.fn(() => createDisposable()),
    onDidCloseTerminal: vi.fn(() => createDisposable()),
    onDidChangeActiveTextEditor: vi.fn(() => createDisposable()),
    onDidChangeTextEditorSelection: vi.fn(() => createDisposable()),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showQuickPick: vi.fn(),
    showInputBox: vi.fn(),
    createTerminal: vi.fn(() => ({
        show: vi.fn(),
        sendText: vi.fn(),
        dispose: vi.fn(),
    })),
    activeTextEditor: undefined,
    createOutputChannel,
    tabGroups: { all: [] },
};

export const commands = {
    registerCommand: vi.fn(() => createDisposable()),
    executeCommand: vi.fn(),
};

export const workspace = {
    getConfiguration: vi.fn(() => ({
        get: vi.fn((_key: string, defaultValue?: unknown) => defaultValue),
        update: vi.fn(),
    })),
    workspaceFolders: undefined,
    fs: {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        stat: vi.fn(),
        createDirectory: vi.fn(),
    },
    openTextDocument: vi.fn(),
    findFiles: vi.fn(() => Promise.resolve([])),
    asRelativePath: vi.fn((p: string) => p),
};

export const languages = {
    onDidChangeDiagnostics: vi.fn(() => createDisposable()),
    getDiagnostics: vi.fn(() => []),
};

export const env = {
    clipboard: { writeText: vi.fn() },
    openExternal: vi.fn(),
};

export enum StatusBarAlignment {
    Left = 1,
    Right = 2,
}

export enum TreeItemCollapsibleState {
    None = 0,
    Collapsed = 1,
    Expanded = 2,
}

export enum DiagnosticSeverity {
    Error = 0,
    Warning = 1,
    Information = 2,
    Hint = 3,
}

export enum ConfigurationTarget {
    Global = 1,
    Workspace = 2,
    WorkspaceFolder = 3,
}

export enum ViewColumn {
    Beside = -2,
}

export class EventEmitter<T> {
    event = vi.fn();
    fire = vi.fn();
    dispose = vi.fn();
}

export class TreeItem {
    label: string;
    collapsibleState: TreeItemCollapsibleState;
    description?: string;
    tooltip?: string;
    iconPath?: unknown;
    command?: unknown;
    constructor(label: string, collapsibleState?: TreeItemCollapsibleState) {
        this.label = label;
        this.collapsibleState = collapsibleState ?? TreeItemCollapsibleState.None;
    }
}

export class ThemeIcon {
    id: string;
    constructor(id: string) {
        this.id = id;
    }
}

export class Uri {
    readonly fsPath: string;
    private constructor(fsPath: string) {
        this.fsPath = fsPath;
    }
    static file(p: string) {
        return new Uri(p);
    }
    static parse(s: string) {
        return new Uri(s);
    }
}

export class TabInputText {
    uri: Uri;
    constructor(uri: Uri) {
        this.uri = uri;
    }
}
