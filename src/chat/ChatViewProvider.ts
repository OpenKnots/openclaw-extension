import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { TextDecoder, TextEncoder } from 'util';
import { markdownToHTML } from '@create-markdown/preview';
import { ChatEvent, ChatService, UsageInfo } from './ChatService';
import { getWebviewContent } from './getWebviewContent';
import {
    SLASH_COMMANDS,
    buildSlashPrompt,
    findCommand,
    EditorContext,
    ContextType,
} from './slashCommands';

const log = vscode.window.createOutputChannel('OpenClaw Chat', { log: true });

type ChatMessage =
    | { role: 'user' | 'assistant' | 'error'; content: string; html?: string }
    | {
        role: 'tool';
        entries: Array<{ title: string; status: string; details: string }>;
    };

type Attachment = { name: string; path: string; type: 'file' | 'image'; previewUri?: string };

type ChatThreadState = {
    id: string;
    index: number;
    title: string;
    messages: ChatMessage[];
    pendingAssistantText: string;
    pendingAttachments: Attachment[];
    currentChatType: string;
    currentModel: string;
    permissionState: string;
    isStreaming: boolean;
    status: 'idle' | 'running' | 'complete' | 'error' | 'cancelled';
    source: string;
    contextTokens: number;
    contextMax: number;
    lastUsage: UsageInfo | null;
    service: ChatService;
};

type ThreadSnapshot = {
    id: string;
    index: number;
    title: string;
    messages: Array<Record<string, unknown>>;
    pendingAssistantText: string;
    pendingAttachments: Attachment[];
    currentChatType: string;
    currentModel: string;
    permissionState: string;
    isStreaming: boolean;
    status: 'idle' | 'running' | 'complete' | 'error' | 'cancelled';
    source: string;
    contextTokens: number;
    contextMax: number;
    lastUsage: UsageInfo | null;
};

export interface Recommendation {
    label: string;
    command: string;
    icon: string;
}

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'openclaw.chat';

    private sidebarView: vscode.WebviewView | undefined;
    private popOutPanel: vscode.WebviewPanel | undefined;
    private editorChangeDisposable: vscode.Disposable | undefined;
    private selectionChangeDisposable: vscode.Disposable | undefined;
    private diagnosticChangeDisposable: vscode.Disposable | undefined;
    private globalState: vscode.Memento;
    private threadCounter = 0;
    private readonly threads = new Map<string, ChatThreadState>();
    private visibleThreadIds: string[] = [];
    private activeThreadId = '';

    constructor(private readonly extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        this.globalState = context.globalState;
        const initialThread = this.createThreadState();
        this.threads.set(initialThread.id, initialThread);
        this.visibleThreadIds = [initialThread.id];
        this.activeThreadId = initialThread.id;

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
            localResourceRoots: [
                this.extensionUri,
                ...(vscode.workspace.workspaceFolders?.map(f => f.uri) || [])
            ]
        };

        webviewView.webview.html = getWebviewContent(
            webviewView.webview,
            this.extensionUri,
            true
        );

        this.setupWebviewListeners(webviewView.webview);
        this.bootstrapWebview();

        webviewView.onDidDispose(() => {
            this.sidebarView = undefined;
        });
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
                localResourceRoots: [
                    this.extensionUri,
                    ...(vscode.workspace.workspaceFolders?.map(f => f.uri) || [])
                ],
                retainContextWhenHidden: true
            }
        );

        this.popOutPanel = panel;
        panel.webview.html = getWebviewContent(panel.webview, this.extensionUri, false);
        this.setupWebviewListeners(panel.webview);
        this.bootstrapWebview();

        panel.onDidDispose(() => {
            this.popOutPanel = undefined;
        });
    }

    newSession(): void {
        this.createThread({ inheritFromActive: true, activate: true, insertAfterActive: true });
        this.emitState();
    }

    dispose(): void {
        for (const thread of this.threads.values()) {
            thread.service.dispose();
        }
        this.popOutPanel?.dispose();
        this.editorChangeDisposable?.dispose();
        this.selectionChangeDisposable?.dispose();
        this.diagnosticChangeDisposable?.dispose();
    }

    private setupWebviewListeners(webview: vscode.Webview): void {
        webview.onDidReceiveMessage(async (msg: {
            type: string;
            threadId?: string;
            text?: string;
            index?: number;
            command?: string;
            query?: string;
            filePath?: string;
            filePaths?: string[];
            line?: string;
            chatType?: string;
            model?: string;
            dimension?: string;
            key?: string;
            value?: string | number;
        }) => {
            const thread = this.getThread(msg.threadId);

            switch (msg.type) {
                case 'send':
                    if (thread && msg.text) {
                        await this.handleSend(thread, msg.text);
                    }
                    break;
                case 'setChatType':
                    if (thread && msg.chatType) {
                        thread.currentChatType = msg.chatType;
                        thread.permissionState = this.getPermissionState(msg.chatType);
                        this.emitState();
                    }
                    break;
                case 'setModel':
                    if (thread && msg.model) {
                        thread.currentModel = msg.model;
                        thread.source = ChatService.getSourceForModel(msg.model);
                        thread.contextMax = this.getContextMaxForModel(msg.model);
                        void vscode.workspace.getConfiguration('openclaw').update(
                            'chat.agent',
                            msg.model,
                            vscode.ConfigurationTarget.Global
                        );
                        this.emitState();
                    }
                    break;
                case 'slashCommand':
                    if (thread && msg.command) {
                        await this.handleSlashCommand(thread, msg.command, msg.text ?? '');
                    }
                    break;
                case 'requestRecommendations':
                    this.pushRecommendations();
                    break;
                case 'requestState':
                    this.emitState();
                    break;
                case 'cancel':
                    if (thread) {
                        thread.service.abort();
                        thread.isStreaming = false;
                        thread.status = 'cancelled';
                        this.emitState();
                    }
                    break;
                case 'newSession':
                case 'splitThread':
                    this.createThread({
                        inheritFromActive: true,
                        activate: true,
                        insertAfterActive: true
                    });
                    this.emitState();
                    break;
                case 'clearThread':
                    if (thread) {
                        this.resetThread(thread);
                        this.emitState();
                    }
                    break;
                case 'focusThread':
                    if (thread) {
                        this.activeThreadId = thread.id;
                        this.emitState();
                    }
                    break;
                case 'closeThread':
                    if (thread) {
                        this.closeThread(thread.id);
                    }
                    break;
                case 'popOut':
                    this.popOut();
                    break;
                case 'setDimension':
                    if (msg.dimension) {
                        void vscode.workspace.getConfiguration('openclaw').update(
                            'chat.dimension',
                            msg.dimension,
                            vscode.ConfigurationTarget.Global
                        );
                    }
                    break;
                case 'setSetting':
                    if (msg.key && msg.value !== undefined) {
                        void vscode.workspace.getConfiguration('openclaw').update(
                            msg.key,
                            msg.value,
                            vscode.ConfigurationTarget.Global
                        );
                    }
                    break;
                case 'attach':
                    if (thread) {
                        await this.handleAttach(thread);
                    }
                    break;
                case 'removeAttachment':
                    if (thread && typeof msg.index === 'number') {
                        thread.pendingAttachments.splice(msg.index, 1);
                        this.emitState();
                    }
                    break;
                case 'onboardingComplete':
                    void this.globalState.update('openclaw.onboardingComplete', true);
                    break;
                case 'exportThread':
                    if (thread) {
                        await this.handleExportThread(thread);
                    }
                    break;
                case 'fileSearch':
                    if (typeof msg.query === 'string') {
                        await this.handleFileSearch(msg.query, webview);
                    }
                    break;
                case 'attachFile':
                    if (thread && msg.filePath) {
                        await this.addAttachments(thread, [msg.filePath]);
                    }
                    break;
                case 'attachFiles':
                    if (thread && Array.isArray(msg.filePaths) && msg.filePaths.length > 0) {
                        await this.addAttachments(thread, msg.filePaths);
                    }
                    break;
                case 'openFile':
                    if (msg.filePath) {
                        await this.openFileInEditor(msg.filePath, msg.line);
                    }
                    break;
            }
        });
    }

    private createThread(options?: {
        inheritFromActive?: boolean;
        activate?: boolean;
        insertAfterActive?: boolean;
    }): ChatThreadState {
        const thread = this.createThreadState(options?.inheritFromActive ? this.getActiveThread() : undefined);
        this.threads.set(thread.id, thread);

        if (options?.insertAfterActive && this.activeThreadId) {
            const activeIndex = this.visibleThreadIds.indexOf(this.activeThreadId);
            if (activeIndex >= 0) {
                this.visibleThreadIds.splice(activeIndex + 1, 0, thread.id);
            } else {
                this.visibleThreadIds.push(thread.id);
            }
        } else {
            this.visibleThreadIds.push(thread.id);
        }

        if (options?.activate !== false) {
            this.activeThreadId = thread.id;
        }

        return thread;
    }

    private createThreadState(inheritFrom?: ChatThreadState): ChatThreadState {
        this.threadCounter += 1;
        const config = vscode.workspace.getConfiguration('openclaw');
        const baseModel = inheritFrom?.currentModel ?? config.get<string>('chat.agent', 'codex');
        const baseType = inheritFrom?.currentChatType ?? 'chat';
        const index = this.threadCounter;

        return {
            id: `thread-${index}`,
            index,
            title: `Thread ${index}`,
            messages: [],
            pendingAssistantText: '',
            pendingAttachments: [],
            currentChatType: baseType,
            currentModel: baseModel,
            permissionState: this.getPermissionState(baseType),
            isStreaming: false,
            status: 'idle',
            source: ChatService.getSourceForModel(baseModel),
            contextTokens: 0,
            contextMax: this.getContextMaxForModel(baseModel),
            lastUsage: null,
            service: new ChatService()
        };
    }

    private getContextMaxForModel(model: string): number {
        const defaults: Record<string, number> = {
            codex: 128_000,
            claude: 200_000,
            'gpt-4o': 128_000,
            gemini: 1_000_000,
            ollama: 32_000,
            opencode: 128_000,
        };
        const config = vscode.workspace.getConfiguration('openclaw');
        const override = config.get<number>('chat.contextMax');
        if (override && override > 0) {
            return override;
        }
        const lower = model.toLowerCase();
        for (const [key, max] of Object.entries(defaults)) {
            if (lower.includes(key)) {
                return max;
            }
        }
        return 128_000;
    }

    private getThread(threadId?: string): ChatThreadState | undefined {
        if (threadId && this.threads.has(threadId)) {
            return this.threads.get(threadId);
        }
        return this.getActiveThread();
    }

    private getActiveThread(): ChatThreadState | undefined {
        return this.threads.get(this.activeThreadId);
    }

    private resetThread(thread: ChatThreadState): void {
        thread.service.abort();
        thread.messages = [];
        thread.pendingAssistantText = '';
        thread.pendingAttachments = [];
        thread.isStreaming = false;
        thread.status = 'idle';
        thread.title = `Thread ${thread.index}`;
        thread.contextTokens = 0;
        thread.lastUsage = null;
    }

    private closeThread(threadId: string): void {
        if (this.threads.size === 1) {
            const thread = this.threads.get(threadId);
            if (thread) {
                this.resetThread(thread);
                this.activeThreadId = thread.id;
                this.visibleThreadIds = [thread.id];
                this.emitState();
            }
            return;
        }

        const thread = this.threads.get(threadId);
        if (!thread) {
            return;
        }

        thread.service.dispose();
        this.threads.delete(threadId);
        this.visibleThreadIds = this.visibleThreadIds.filter(id => id !== threadId);

        if (this.visibleThreadIds.length === 0) {
            const fallback = this.createThread({ activate: true });
            this.visibleThreadIds = [fallback.id];
            this.activeThreadId = fallback.id;
        } else if (this.activeThreadId === threadId) {
            this.activeThreadId = this.visibleThreadIds[Math.max(0, this.visibleThreadIds.length - 1)];
        }

        this.emitState();
    }

    private static readonly IMAGE_EXTENSIONS = new Set([
        '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff', '.tif',
    ]);

    private async addAttachments(thread: ChatThreadState, filePaths: string[]): Promise<void> {
        let changed = false;

        for (const filePath of filePaths) {
            if (!filePath || thread.pendingAttachments.some(a => a.path === filePath)) {
                continue;
            }

            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
                const ext = path.extname(filePath).toLowerCase();
                thread.pendingAttachments.push({
                    name: path.basename(filePath),
                    path: filePath,
                    type: ChatViewProvider.IMAGE_EXTENSIONS.has(ext) ? 'image' : 'file',
                });
                changed = true;
            } catch {
                // Ignore invalid or unreadable dropped paths.
            }
        }

        if (changed) {
            this.emitState();
        }
    }

    private async handleSlashCommand(
        thread: ChatThreadState,
        commandName: string,
        userText: string
    ): Promise<void> {
        const cmd = findCommand(commandName);
        if (!cmd) {
            await this.handleSend(thread, userText);
            return;
        }

        const context = await this.gatherEditorContext(cmd.contextType);
        const augmented = buildSlashPrompt(commandName, userText, context);
        const displayText = `/${commandName}${userText.trim() ? ' ' + userText.trim() : ''}`;
        const attachments = [...thread.pendingAttachments];

        thread.messages.push({ role: 'user', content: displayText });
        thread.pendingAssistantText = '';
        thread.pendingAttachments = [];
        thread.isStreaming = true;
        thread.status = 'running';
        this.maybeRenameThread(thread, displayText);
        this.emitState();

        let fullPrompt = augmented;
        if (attachments.length > 0) {
            fullPrompt = `${await this.readAttachments(attachments)}\n\n${fullPrompt}`;
        }

        await this.sendPrompt(thread, fullPrompt);
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

    private getPermissionState(chatType: string): string {
        const configuredPermissions = vscode.workspace
            .getConfiguration('openclaw')
            .get<string>('chat.permissions', 'approve-reads');
        return ChatService.getPermissionsForChatType(chatType, configuredPermissions);
    }

    private pushRecommendations(): void {
        this.postToAll({
            type: 'recommendations',
            items: this.buildRecommendations()
        });
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

    private async handleAttach(thread: ChatThreadState): Promise<void> {
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: true,
            openLabel: 'Attach',
            filters: { 'All Files': ['*'] }
        });
        if (!uris || uris.length === 0) {
            return;
        }
        await this.addAttachments(thread, uris.map(uri => uri.fsPath));
    }

    private async handleExportThread(thread: ChatThreadState): Promise<void> {
        if (thread.messages.length === 0) {
            void vscode.window.showInformationMessage('Nothing to export — thread is empty.');
            return;
        }

        const lines: string[] = [`# ${thread.title}`, ''];
        lines.push(`- **Model:** ${thread.currentModel}`);
        lines.push(`- **Mode:** ${thread.currentChatType}`);
        lines.push(`- **Source:** ${thread.source}`);
        lines.push('');

        for (const msg of thread.messages) {
            if (msg.role === 'tool') {
                lines.push('### Tool Calls');
                for (const entry of msg.entries) {
                    lines.push(`- **${entry.title}** (${entry.status})`);
                    if (entry.details) {
                        lines.push(`  \`\`\`\n  ${entry.details}\n  \`\`\``);
                    }
                }
                lines.push('');
            } else {
                const label = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'Error';
                lines.push(`### ${label}`);
                lines.push('');
                lines.push(msg.content);
                lines.push('');
            }
        }

        const markdown = lines.join('\n');
        const safeTitle = thread.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`${safeTitle}.md`),
            filters: { 'Markdown': ['md'], 'JSON': ['json'] },
        });

        if (!uri) {
            return;
        }

        let content: string;
        if (uri.fsPath.endsWith('.json')) {
            content = JSON.stringify({
                title: thread.title,
                model: thread.currentModel,
                chatType: thread.currentChatType,
                source: thread.source,
                messages: thread.messages.map(m => ({ ...m })),
            }, null, 2);
        } else {
            content = markdown;
        }

        await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
        void vscode.window.showInformationMessage(`Thread exported to ${path.basename(uri.fsPath)}`);
    }

    private async handleSend(thread: ChatThreadState, text: string): Promise<void> {
        const attachments = [...thread.pendingAttachments];

        thread.messages.push({ role: 'user', content: text });
        thread.pendingAssistantText = '';
        thread.pendingAttachments = [];
        thread.isStreaming = true;
        thread.status = 'running';
        this.maybeRenameThread(thread, text);
        this.emitState();

        let fullPrompt = text;
        if (attachments.length > 0) {
            fullPrompt = `${await this.readAttachments(attachments)}\n\n${text}`;
        }

        await this.sendPrompt(thread, fullPrompt);
    }

    private async readAttachments(attachments: Attachment[]): Promise<string> {
        const sections: string[] = [];

        for (const att of attachments) {
            if (att.type === 'image') {
                sections.push(`<image path="${att.path}" />`);
                continue;
            }
            try {
                const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(att.path));
                const content = new TextDecoder().decode(bytes);
                sections.push(`<file path="${att.path}">\n${content}\n</file>`);
            } catch {
                sections.push(`<file path="${att.path}">\n[Could not read file]\n</file>`);
            }
        }

        return sections.join('\n\n');
    }

    private async sendPrompt(thread: ChatThreadState, fullPrompt: string): Promise<void> {
        const cwd = this.getWorkspaceCwd();
        if (!cwd) {
            const errMsg = 'No workspace folder open. Open a folder to use chat.';
            thread.messages.push({ role: 'error', content: errMsg });
            thread.isStreaming = false;
            thread.status = 'error';
            this.emitState();
            return;
        }

        thread.service.sendMessage(
            fullPrompt,
            cwd,
            thread.currentModel,
            thread.currentChatType,
            (event: ChatEvent) => {
                void this.handleChatEvent(thread.id, event);
            }
        );
    }

    private async handleChatEvent(threadId: string, event: ChatEvent): Promise<void> {
        const thread = this.threads.get(threadId);
        if (!thread) {
            return;
        }

        switch (event.type) {
            case 'text':
                thread.pendingAssistantText += event.text;
                thread.isStreaming = true;
                thread.status = 'running';
                // Send lightweight update instead of full state rebuild
                this.postToAll({
                    type: 'textUpdate',
                    threadId: thread.id,
                    text: thread.pendingAssistantText,
                });
                break;
            case 'toolCall':
                this.appendToolMessage(thread, {
                    title: event.title,
                    status: event.status,
                    details: event.details
                });
                this.emitState();
                break;
            case 'done':
                if (thread.pendingAssistantText) {
                    const raw = thread.pendingAssistantText;
                    thread.pendingAssistantText = '';
                    const html = await this.renderMarkdown(raw);
                    thread.messages.push({ role: 'assistant', content: raw, html });
                }
                thread.isStreaming = false;
                if (thread.status !== 'error') {
                    thread.status = 'complete';
                }
                this.updateThreadSubjectFromContext(thread);
                this.emitState();
                break;
            case 'usage':
                thread.lastUsage = event.usage;
                thread.contextTokens = event.usage.totalTokens;
                this.emitState();
                break;
            case 'error':
                thread.messages.push({ role: 'error', content: event.message });
                thread.isStreaming = false;
                thread.status = 'error';
                this.emitState();
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

    private appendToolMessage(
        thread: ChatThreadState,
        entry: { title: string; status: string; details: string }
    ): void {
        const lastMessage = thread.messages[thread.messages.length - 1];
        if (lastMessage?.role === 'tool') {
            lastMessage.entries.push(entry);
            return;
        }

        thread.messages.push({
            role: 'tool',
            entries: [entry]
        });
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
            } catch {
                // tabGroups API unavailable
            }

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
            const lowerQuery = query.toLowerCase();
            files.sort((a, b) => {
                const aStarts = a.name.toLowerCase().startsWith(lowerQuery);
                const bStarts = b.name.toLowerCase().startsWith(lowerQuery);
                if (aStarts && !bStarts) {
                    return -1;
                }
                if (!aStarts && bStarts) {
                    return 1;
                }
                return a.relativePath.length - b.relativePath.length;
            });
        }

        webview.postMessage({ type: 'fileSearchResults', files: files.slice(0, 15) });
    }

    private escapeGlob(str: string): string {
        return str.replace(/[[\]{}()*?!\\]/g, '\\$&');
    }

    private maybeRenameThread(thread: ChatThreadState, rawText: string): void {
        const trimmed = rawText.replace(/^\/[a-zA-Z]+\s*/, '').replace(/\s+/g, ' ').trim();
        if (!trimmed) {
            return;
        }

        const baseTitle = `Thread ${thread.index}`;
        if (thread.title !== baseTitle && thread.messages.length > 1) {
            return;
        }

        thread.title = trimmed.length > 42 ? `${trimmed.slice(0, 39)}...` : trimmed;
    }

    private updateThreadSubjectFromContext(thread: ChatThreadState): void {
        const config = vscode.workspace.getConfiguration('openclaw');
        if (!config.get<boolean>('chat.dynamicSubject', true)) {
            return;
        }

        const baseTitle = `Thread ${thread.index}`;
        if (thread.title !== baseTitle) {
            return;
        }

        const userMessages = thread.messages.filter(
            (m): m is { role: 'user' | 'assistant'; content: string } =>
                m.role === 'user' || m.role === 'assistant'
        );
        if (userMessages.length < 2) {
            return;
        }

        const commandUsed = thread.messages.find(
            (m): m is { role: 'user'; content: string } => m.role === 'user' && 'content' in m && m.content.startsWith('/')
        );
        const attachments = thread.pendingAttachments;
        const allText = thread.messages
            .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
                m.role === 'user' || m.role === 'assistant'
            )
            .map(m => m.content)
            .join(' ');

        const fileNames = allText.match(/\/([^\/\s]+\.[a-zA-Z0-9]+)/g);
        const extractedFileName = fileNames?.[0]?.replace(/.*\//, '') || '';

        let subject = baseTitle;

        if (commandUsed) {
            const cmdName = commandUsed.content.match(/^\/(\w+)/)?.[1] || '';
            const commandLabel = cmdName.charAt(0).toUpperCase() + cmdName.slice(1);

            if (extractedFileName) {
                subject = `${commandLabel}: ${extractedFileName}`;
            } else {
                const contextSnippet = allText
                    .replace(/^\/[a-zA-Z]+\s*/, '')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 30);
                subject = contextSnippet ? `${commandLabel}: ${contextSnippet}...` : commandLabel;
            }
        } else if (attachments.length > 0) {
            const fileName = path.basename(attachments[0].path);
            subject = `File: ${fileName}`;
        } else {
            const topicMatch = allText.match(/([A-Z][a-z]+(?:[A-Z][a-z]+)+)|(\b(?:API|UI|HTML|CSS|JSON|REST|CLI)\b)/);
            if (topicMatch) {
                subject = topicMatch[0].slice(0, 42);
            }
        }

        if (subject !== baseTitle) {
            thread.title = subject.length > 50 ? `${subject.slice(0, 47)}...` : subject;
        }
    }

    private emitState(): void {
        const config = vscode.workspace.getConfiguration('openclaw');
        const dimension = config.get<string>('chat.dimension', '1x1');
        const collapseCompleted = config.get<boolean>('chat.collapseCompleted', true);
        const base = {
            type: 'state',
            activeThreadId: this.activeThreadId,
            visibleThreadIds: this.visibleThreadIds,
            models: this.getAvailableModels(),
            dimension,
            collapseCompleted
        };
        const threads = this.getThreadSnapshots();

        for (const webview of [this.sidebarView?.webview, this.popOutPanel?.webview]) {
            if (!webview) { continue; }
            const enriched = threads.map(t => ({
                ...t,
                pendingAttachments: t.pendingAttachments.map(att =>
                    att.type === 'image'
                        ? { ...att, previewUri: webview.asWebviewUri(vscode.Uri.file(att.path)).toString() }
                        : att
                )
            }));
            webview.postMessage({ ...base, threads: enriched });
        }
    }

    private getThreadSnapshots(): ThreadSnapshot[] {
        return this.visibleThreadIds
            .map(id => this.threads.get(id))
            .filter((thread): thread is ChatThreadState => Boolean(thread))
            .map(thread => ({
                id: thread.id,
                index: thread.index,
                title: thread.title,
                messages: thread.messages.map(message => ({ ...message })),
                pendingAssistantText: thread.pendingAssistantText,
                pendingAttachments: [...thread.pendingAttachments],
                currentChatType: thread.currentChatType,
                currentModel: thread.currentModel,
                permissionState: thread.permissionState,
                isStreaming: thread.isStreaming,
                status: thread.status,
                source: thread.source,
                contextTokens: thread.contextTokens,
                contextMax: thread.contextMax,
                lastUsage: thread.lastUsage ? { ...thread.lastUsage } : null
            }));
    }

    private bootstrapWebview(): void {
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
            this.emitState();

            if (this.globalState.get<boolean>('openclaw.onboardingComplete')) {
                this.postToAll({ type: 'onboardingDone' });
            }
        }, 100);
    }

    private postToAll(message: Record<string, unknown>): void {
        this.sidebarView?.webview.postMessage(message);
        this.popOutPanel?.webview.postMessage(message);
    }

    private async openFileInEditor(filePath: string, lineStr?: string): Promise<void> {
        const cwd = this.getWorkspaceCwd();
        const resolvedPath = path.isAbsolute(filePath) ? filePath : cwd ? path.join(cwd, filePath) : filePath;
        try {
            const uri = vscode.Uri.file(resolvedPath);
            const doc = await vscode.workspace.openTextDocument(uri);
            const lineNum = lineStr ? Math.max(0, parseInt(lineStr, 10) - 1) : 0;
            const selection = new vscode.Range(lineNum, 0, lineNum, 0);
            await vscode.window.showTextDocument(doc, { selection, preview: true });
        } catch (err) {
            log.warn('openFileInEditor failed', err);
            void vscode.window.showWarningMessage(`Could not open file: ${filePath}`);
        }
    }

    private getWorkspaceCwd(): string | undefined {
        const folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            return folders[0].uri.fsPath;
        }
        return undefined;
    }
}
