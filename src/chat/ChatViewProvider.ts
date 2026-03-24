import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { ChatService, ChatEvent } from './ChatService';
import { getWebviewContent } from './getWebviewContent';
import { markdownToHTML } from '@create-markdown/preview';
import {
    SLASH_COMMANDS,
    buildSlashPrompt,
    findCommand,
    EditorContext,
    ContextType,
} from './slashCommands';

const log = vscode.window.createOutputChannel('OpenClaw Chat', { log: true });

type ChatMessage = { role: 'user' | 'assistant' | 'error'; content: string; html?: string };
type Attachment = { name: string; path: string };

export interface Recommendation {
    label: string;
    command: string;
    icon: string;
}

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'openclaw.chat';

    private sidebarView: vscode.WebviewView | undefined;
    private popOutPanel: vscode.WebviewPanel | undefined;
    private chatService: ChatService;
    private messages: ChatMessage[] = [];
    private pendingAssistantText = '';
    private pendingAttachments: Attachment[] = [];
    private editorChangeDisposable: vscode.Disposable | undefined;
    private selectionChangeDisposable: vscode.Disposable | undefined;
    private diagnosticChangeDisposable: vscode.Disposable | undefined;
    private globalState: vscode.Memento;
    private currentChatType = 'chat';
    private currentModel: string;

    constructor(private readonly extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        this.chatService = new ChatService();
        this.globalState = context.globalState;
        const config = vscode.workspace.getConfiguration('openclaw');
        this.currentModel = config.get<string>('chat.agent', 'codex');

        this.editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(() => {
            this.pushRecommendations();
        });
        this.selectionChangeDisposable = vscode.window.onDidChangeTextEditorSelection(() => {
            this.pushRecommendations();
        });
        this.diagnosticChangeDisposable = vscode.languages.onDidChangeDiagnostics(() => {
            this.pushRecommendations();
        });
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        log.info('resolveWebviewView()');
        this.sidebarView = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        webviewView.webview.html = getWebviewContent(
            webviewView.webview,
            this.extensionUri,
            true
        );

        this.setupWebviewListeners(webviewView.webview);

        webviewView.onDidDispose(() => {
            this.sidebarView = undefined;
        });

        setTimeout(() => {
            this.postToAll({
                type: 'slashCommands',
                commands: SLASH_COMMANDS.map(c => ({
                    name: c.name,
                    description: c.description,
                    icon: c.icon,
                    placeholder: c.placeholder,
                })),
            });
            this.pushRecommendations();
            this.pushModelsAndConfig();

            if (this.globalState.get<boolean>('openclaw.onboardingComplete')) {
                this.postToAll({ type: 'onboardingDone' });
            }
        }, 100);
    }

    popOut(): void {
        if (this.popOutPanel) {
            this.popOutPanel.reveal();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'openclaw.chatPanel',
            'OpenClaw Chat',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [this.extensionUri],
                retainContextWhenHidden: true
            }
        );

        this.popOutPanel = panel;

        panel.webview.html = getWebviewContent(
            panel.webview,
            this.extensionUri,
            false
        );

        this.setupWebviewListeners(panel.webview);

        panel.webview.postMessage({
            type: 'state',
            messages: this.messages.map(m => ({
                role: m.role,
                content: m.content,
                html: m.html
            }))
        });

        setTimeout(() => {
            panel.webview.postMessage({
                type: 'slashCommands',
                commands: SLASH_COMMANDS.map(c => ({
                    name: c.name,
                    description: c.description,
                    icon: c.icon,
                    placeholder: c.placeholder,
                })),
            });
            this.pushRecommendations();
            this.pushModelsAndConfig();
        }, 100);

        panel.onDidDispose(() => {
            this.popOutPanel = undefined;
        });
    }

    newSession(): void {
        this.chatService.abort();
        this.messages = [];
        this.pendingAssistantText = '';
        this.pendingAttachments = [];
        this.postToAll({ type: 'state', messages: [] });
        this.postToAll({ type: 'attachments', files: [] });
    }

    dispose(): void {
        this.chatService.dispose();
        this.popOutPanel?.dispose();
        this.editorChangeDisposable?.dispose();
        this.selectionChangeDisposable?.dispose();
        this.diagnosticChangeDisposable?.dispose();
    }

    private setupWebviewListeners(webview: vscode.Webview): void {
        webview.onDidReceiveMessage(async (msg: {
            type: string;
            text?: string;
            index?: number;
            command?: string;
            query?: string;
            filePath?: string;
            chatType?: string;
            model?: string;
        }) => {
            switch (msg.type) {
                case 'send':
                    if (msg.text) {
                        this.handleSend(msg.text);
                    }
                    break;
                case 'setChatType':
                    if (msg.chatType) {
                        this.currentChatType = msg.chatType;
                    }
                    break;
                case 'setModel':
                    if (msg.model) {
                        this.currentModel = msg.model;
                        vscode.workspace.getConfiguration('openclaw').update(
                            'chat.agent', msg.model, vscode.ConfigurationTarget.Global
                        );
                    }
                    break;
                case 'slashCommand':
                    if (msg.command) {
                        await this.handleSlashCommand(msg.command, msg.text ?? '');
                    }
                    break;
                case 'requestRecommendations':
                    this.pushRecommendations();
                    break;
                case 'cancel':
                    this.chatService.abort();
                    break;
                case 'newSession':
                    this.newSession();
                    break;
                case 'popOut':
                    this.popOut();
                    break;
                case 'attach':
                    await this.handleAttach();
                    break;
                case 'removeAttachment':
                    if (typeof msg.index === 'number') {
                        this.pendingAttachments.splice(msg.index, 1);
                        this.postToAll({ type: 'attachments', files: this.pendingAttachments });
                    }
                    break;
                case 'onboardingComplete':
                    this.globalState.update('openclaw.onboardingComplete', true);
                    break;
                case 'fileSearch':
                    if (typeof msg.query === 'string') {
                        await this.handleFileSearch(msg.query, webview);
                    }
                    break;
                case 'attachFile':
                    if (msg.filePath && !this.pendingAttachments.some(a => a.path === msg.filePath)) {
                        this.pendingAttachments.push({
                            name: path.basename(msg.filePath),
                            path: msg.filePath
                        });
                        this.postToAll({ type: 'attachments', files: this.pendingAttachments });
                    }
                    break;
            }
        });
    }

    private async handleSlashCommand(commandName: string, userText: string): Promise<void> {
        const cmd = findCommand(commandName);
        if (!cmd) {
            this.handleSend(userText);
            return;
        }

        const context = await this.gatherEditorContext(cmd.contextType);
        const augmented = buildSlashPrompt(commandName, userText, context);

        const displayText = `/${commandName}${userText.trim() ? ' ' + userText.trim() : ''}`;
        this.messages.push({ role: 'user', content: displayText });
        this.pendingAssistantText = '';

        const attachments = [...this.pendingAttachments];
        this.pendingAttachments = [];
        this.postToAll({ type: 'attachments', files: [] });

        let fullPrompt = augmented;
        if (attachments.length > 0) {
            const sections: string[] = [];
            for (const att of attachments) {
                try {
                    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(att.path));
                    const content = new TextDecoder().decode(bytes);
                    sections.push(`<file path="${att.path}">\n${content}\n</file>`);
                } catch {
                    sections.push(`<file path="${att.path}">\n[Could not read file]\n</file>`);
                }
            }
            fullPrompt = sections.join('\n\n') + '\n\n' + fullPrompt;
        }

        const cwd = this.getWorkspaceCwd();
        if (!cwd) {
            const errMsg = 'No workspace folder open. Open a folder to use chat.';
            this.postToAll({ type: 'error', message: errMsg });
            this.messages.push({ role: 'error', content: errMsg });
            this.postToAll({ type: 'done' });
            return;
        }

        this.chatService.sendMessage(fullPrompt, cwd, this.currentModel, this.currentChatType, (event: ChatEvent) => {
            this.handleChatEvent(event);
        });
    }

    private async gatherEditorContext(contextType: ContextType): Promise<EditorContext> {
        const editor = vscode.window.activeTextEditor;
        const ctx: EditorContext = {};

        if (editor) {
            ctx.filePath = vscode.workspace.asRelativePath(editor.document.uri);
            ctx.fileName = path.basename(editor.document.uri.fsPath);
            ctx.languageId = editor.document.languageId;

            const sel = editor.selection;
            if (!sel.isEmpty) {
                ctx.selection = editor.document.getText(sel);
            }
        }

        switch (contextType) {
            case 'selection':
                if (!ctx.selection && editor) {
                    ctx.fileContent = editor.document.getText();
                }
                break;
            case 'file':
                if (editor) {
                    ctx.fileContent = editor.document.getText();
                }
                break;
            case 'diagnostics':
                if (!ctx.selection && editor) {
                    ctx.fileContent = editor.document.getText();
                }
                if (editor) {
                    const diags = vscode.languages.getDiagnostics(editor.document.uri);
                    if (diags.length > 0) {
                        ctx.diagnostics = diags
                            .map(d => {
                                const sev = vscode.DiagnosticSeverity[d.severity];
                                return `[${sev}] Line ${d.range.start.line + 1}: ${d.message}`;
                            })
                            .join('\n');
                    }
                }
                break;
            case 'gitDiff':
                ctx.gitDiff = await this.runGit('diff');
                if (!ctx.gitDiff && editor) {
                    ctx.fileContent = editor.document.getText();
                }
                break;
            case 'gitStaged':
                ctx.gitStaged = await this.runGit('diff --staged');
                break;
            case 'none':
                break;
        }

        return ctx;
    }

    private runGit(args: string): Promise<string> {
        const cwd = this.getWorkspaceCwd();
        if (!cwd) {
            return Promise.resolve('');
        }
        return new Promise(resolve => {
            exec(`git ${args}`, { cwd, maxBuffer: 1024 * 512 }, (err, stdout) => {
                resolve(err ? '' : stdout.trim());
            });
        });
    }

    private getAvailableModels(): string[] {
        const config = vscode.workspace.getConfiguration('openclaw');
        return config.get<string[]>('chat.models', [
            'codex', 'gemini', 'opencode', 'claude', 'gpt-4o', 'ollama'
        ]);
    }

    private pushModelsAndConfig(): void {
        this.postToAll({ type: 'models', models: this.getAvailableModels() });
        this.postToAll({ type: 'config', chatType: this.currentChatType, model: this.currentModel });
    }

    private pushRecommendations(): void {
        if (this.messages.length > 0) {
            return;
        }

        const recs = this.buildRecommendations();
        this.postToAll({ type: 'recommendations', items: recs });
    }

    private buildRecommendations(): Recommendation[] {
        const editor = vscode.window.activeTextEditor;
        const recs: Recommendation[] = [];

        if (editor) {
            const hasSelection = !editor.selection.isEmpty;
            const fileName = path.basename(editor.document.uri.fsPath);
            const diags = vscode.languages.getDiagnostics(editor.document.uri);
            const errorCount = diags.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;

            if (hasSelection) {
                recs.push(
                    { label: 'Explain selection', command: '/explain', icon: '\u{1F4A1}' },
                    { label: 'Refactor selection', command: '/refactor', icon: '\u{21BB}' },
                    { label: 'Write tests', command: '/test', icon: '\u2713' },
                );
            } else {
                recs.push(
                    { label: `Explain ${fileName}`, command: '/explain', icon: '\u{1F4A1}' },
                );
            }

            if (errorCount > 0) {
                recs.push({
                    label: `Fix ${errorCount} issue${errorCount > 1 ? 's' : ''}`,
                    command: '/fix',
                    icon: '\u{1F527}',
                });
            }

            recs.push(
                { label: `Review ${fileName}`, command: '/review', icon: '\u{1F50D}' },
                { label: 'Document code', command: '/doc', icon: '\u{1F4DD}' },
            );
        } else {
            recs.push(
                { label: 'Review changes', command: '/review', icon: '\u{1F50D}' },
                { label: 'Commit message', command: '/commit', icon: '\u{1F4E6}' },
                { label: 'Search codebase', command: '/search', icon: '\u{1F50E}' },
            );
        }

        recs.push(
            { label: 'Security analysis', command: '/harden', icon: '\u{1F6E1}' },
        );

        return recs;
    }

    private async handleAttach(): Promise<void> {
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: true,
            openLabel: 'Attach',
            filters: { 'All Files': ['*'] }
        });
        if (!uris || uris.length === 0) {
            return;
        }
        for (const uri of uris) {
            this.pendingAttachments.push({
                name: path.basename(uri.fsPath),
                path: uri.fsPath
            });
        }
        this.postToAll({ type: 'attachments', files: this.pendingAttachments });
    }

    private async handleSend(text: string): Promise<void> {
        const attachments = [...this.pendingAttachments];
        this.pendingAttachments = [];
        this.postToAll({ type: 'attachments', files: [] });

        let fullPrompt = text;
        if (attachments.length > 0) {
            const sections: string[] = [];
            for (const att of attachments) {
                try {
                    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(att.path));
                    const content = new TextDecoder().decode(bytes);
                    sections.push(`<file path="${att.path}">\n${content}\n</file>`);
                } catch {
                    sections.push(`<file path="${att.path}">\n[Could not read file]\n</file>`);
                }
            }
            fullPrompt = sections.join('\n\n') + '\n\n' + text;
        }

        this.messages.push({ role: 'user', content: text });
        this.pendingAssistantText = '';

        const cwd = this.getWorkspaceCwd();
        if (!cwd) {
            const errMsg = 'No workspace folder open. Open a folder to use chat.';
            this.postToAll({ type: 'error', message: errMsg });
            this.messages.push({ role: 'error', content: errMsg });
            this.postToAll({ type: 'done' });
            return;
        }

        this.chatService.sendMessage(fullPrompt, cwd, this.currentModel, this.currentChatType, (event: ChatEvent) => {
            this.handleChatEvent(event);
        });
    }

    private handleChatEvent(event: ChatEvent): void {
        switch (event.type) {
            case 'text':
                this.pendingAssistantText += event.text;
                this.postToAll({ type: 'streamChunk', text: event.text });
                break;
            case 'toolCall':
                this.postToAll({
                    type: 'toolCall',
                    title: event.title,
                    status: event.status
                });
                break;
            case 'done':
                if (this.pendingAssistantText) {
                    const raw = this.pendingAssistantText;
                    this.pendingAssistantText = '';
                    this.renderMarkdown(raw).then(html => {
                        this.messages.push({ role: 'assistant', content: raw, html });
                        this.postToAll({ type: 'done', html });
                    });
                } else {
                    this.postToAll({ type: 'done' });
                }
                break;
            case 'error':
                this.messages.push({ role: 'error', content: event.message });
                this.postToAll({ type: 'error', message: event.message });
                break;
        }
    }

    private async renderMarkdown(text: string): Promise<string> {
        try {
            return await markdownToHTML(text, { sanitize: true });
        } catch (err) {
            log.warn('markdownToHTML failed, using fallback', err);
            return this.escapeHtml(text);
        }
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    private async handleFileSearch(query: string, webview: vscode.Webview): Promise<void> {
        const cwd = this.getWorkspaceCwd() || '';

        if (!query) {
            const openFiles: Array<{name: string; path: string; relativePath: string}> = [];
            try {
                for (const group of vscode.window.tabGroups.all) {
                    for (const tab of group.tabs) {
                        if (tab.input instanceof vscode.TabInputText) {
                            const uri = tab.input.uri;
                            openFiles.push({
                                name: path.basename(uri.fsPath),
                                path: uri.fsPath,
                                relativePath: cwd ? path.relative(cwd, uri.fsPath) : uri.fsPath
                            });
                        }
                    }
                }
            } catch { /* tabGroups API unavailable */ }

            if (openFiles.length > 0) {
                webview.postMessage({ type: 'fileSearchResults', files: openFiles.slice(0, 15) });
                return;
            }
        }

        const exclude = '{**/node_modules/**,**/.git/**,**/dist/**,**/out/**}';
        const escaped = query ? this.escapeGlob(query) : '';
        const pattern = escaped ? `**/*${escaped}*` : '**/*';

        const uris = await vscode.workspace.findFiles(pattern, exclude, 30);

        const files = uris.map(uri => ({
            name: path.basename(uri.fsPath),
            path: uri.fsPath,
            relativePath: cwd ? path.relative(cwd, uri.fsPath) : uri.fsPath
        }));

        if (query) {
            const lq = query.toLowerCase();
            files.sort((a, b) => {
                const aStarts = a.name.toLowerCase().startsWith(lq);
                const bStarts = b.name.toLowerCase().startsWith(lq);
                if (aStarts && !bStarts) { return -1; }
                if (!aStarts && bStarts) { return 1; }
                return a.relativePath.length - b.relativePath.length;
            });
        }

        webview.postMessage({ type: 'fileSearchResults', files: files.slice(0, 15) });
    }

    private escapeGlob(str: string): string {
        return str.replace(/[[\]{}()*?!\\]/g, '\\$&');
    }

    private postToAll(message: Record<string, unknown>): void {
        this.sidebarView?.webview.postMessage(message);
        this.popOutPanel?.webview.postMessage(message);
    }

    private getWorkspaceCwd(): string | undefined {
        const folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            return folders[0].uri.fsPath;
        }
        return undefined;
    }
}
