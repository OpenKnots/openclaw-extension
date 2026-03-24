import * as vscode from 'vscode';
import { ChatService, ChatEvent } from './ChatService';
import { getWebviewContent } from './getWebviewContent';

type ChatMessage = { role: 'user' | 'assistant' | 'error'; content: string };

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'openclaw.chat';

    private sidebarView: vscode.WebviewView | undefined;
    private popOutPanel: vscode.WebviewPanel | undefined;
    private chatService: ChatService;
    private messages: ChatMessage[] = [];
    private pendingAssistantText = '';

    constructor(private readonly extensionUri: vscode.Uri) {
        this.chatService = new ChatService();
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
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
            messages: this.messages
        });

        panel.onDidDispose(() => {
            this.popOutPanel = undefined;
        });
    }

    newSession(): void {
        this.chatService.abort();
        this.messages = [];
        this.pendingAssistantText = '';
        this.postToAll({ type: 'state', messages: [] });
    }

    dispose(): void {
        this.chatService.dispose();
        this.popOutPanel?.dispose();
    }

    private setupWebviewListeners(webview: vscode.Webview): void {
        webview.onDidReceiveMessage((msg: { type: string; text?: string }) => {
            switch (msg.type) {
                case 'send':
                    if (msg.text) {
                        this.handleSend(msg.text);
                    }
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
            }
        });
    }

    private handleSend(text: string): void {
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

        this.chatService.sendMessage(text, cwd, (event: ChatEvent) => {
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
                    this.messages.push({
                        role: 'assistant',
                        content: this.pendingAssistantText
                    });
                    this.pendingAssistantText = '';
                }
                this.postToAll({ type: 'done' });
                break;
            case 'error':
                this.messages.push({ role: 'error', content: event.message });
                this.postToAll({ type: 'error', message: event.message });
                break;
        }
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
