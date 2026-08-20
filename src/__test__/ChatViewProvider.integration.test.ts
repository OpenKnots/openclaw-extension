import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';

vi.mock('@create-markdown/preview', () => ({
    markdownToHTML: vi.fn(async (text: string) => text),
}));

import { ChatViewProvider } from '../chat/ChatViewProvider';

function makeContext(): vscode.ExtensionContext {
    return {
        extensionUri: vscode.Uri.file('/tmp/test-ext'),
        globalState: { get: vi.fn(), update: vi.fn() },
        subscriptions: [],
    } as unknown as vscode.ExtensionContext;
}

function makeWebviewView() {
    let onMessage: ((msg: { type: string; threadId?: string; text?: string }) => Promise<void> | void) | undefined;

    const webview = {
        options: {},
        html: '',
        postMessage: vi.fn(),
        asWebviewUri: vi.fn((uri: vscode.Uri) => uri),
        onDidReceiveMessage: vi.fn((cb: (msg: { type: string; threadId?: string; text?: string }) => Promise<void> | void) => {
            onMessage = cb;
            return { dispose: vi.fn() };
        }),
    } as unknown as vscode.Webview;

    const view = {
        webview,
        onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
    } as unknown as vscode.WebviewView;

    return { view, getOnMessage: () => onMessage };
}

describe('ChatViewProvider integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (vscode.workspace.workspaceFolders as unknown) = [
            { uri: vscode.Uri.file('/tmp/workspace') },
        ];
    });

    it('includes prior messages in later prompts and rotates session after clearThread', async () => {
        const provider = new ChatViewProvider(vscode.Uri.file('/tmp/test-ext'), makeContext());
        const { view, getOnMessage } = makeWebviewView();
        provider.resolveWebviewView(view, {} as vscode.WebviewViewResolveContext, {} as vscode.CancellationToken);

        const onMessage = getOnMessage();
        expect(onMessage).toBeTypeOf('function');

        const activeThreadId = (provider as unknown as { activeThreadId: string }).activeThreadId;
        const threads = (provider as unknown as { threads: Map<string, { service: { sendMessage: (...args: unknown[]) => void } }> }).threads;
        const thread = threads.get(activeThreadId);
        expect(thread).toBeDefined();

        const sendMessageSpy = vi.spyOn(thread!.service, 'sendMessage').mockImplementation((prompt, _cwd, _model, _chatType, _sessionName, onEvent) => {
            if (typeof onEvent === 'function') {
                onEvent({ type: 'text', text: 'assistant response' });
                onEvent({ type: 'done' });
            }
            return undefined;
        });

        await onMessage!({ type: 'send', threadId: activeThreadId, text: 'Premier message' });

        expect(sendMessageSpy).toHaveBeenCalledTimes(1);
        const firstCall = sendMessageSpy.mock.calls[0];
        const firstPrompt = firstCall[0] as string;
        expect(firstPrompt).toContain('Premier message');
        expect(firstPrompt).not.toContain('Conversation history:');
        const firstSessionName = firstCall[4] as string;
        expect(firstSessionName).toBe('openclaw-thread-1-v0');

        await onMessage!({ type: 'send', threadId: activeThreadId, text: 'Deuxieme message' });

        expect(sendMessageSpy).toHaveBeenCalledTimes(2);
        const secondCall = sendMessageSpy.mock.calls[1];
        const secondPrompt = secondCall[0] as string;
        expect(secondPrompt).toContain('Use the conversation history below as the source of truth.');
        expect(secondPrompt).toContain('Do not use external memory files, repo search, or tools for in-thread recall questions.');
        expect(secondPrompt).toContain('Thread memory facts:');
        expect(secondPrompt).toContain('First user message in this thread: Premier message');
        expect(secondPrompt).toContain('<message role="user">');
        expect(secondPrompt).toContain('--- Conversation history ---');
        expect(secondPrompt).toContain('Premier message');
        expect(secondPrompt).toContain('assistant response');
        expect(secondPrompt).toContain('Deuxieme message');
        const secondSessionName = secondCall[4] as string;
        expect(secondSessionName).toBe('openclaw-thread-1-v0');

        await onMessage!({ type: 'clearThread', threadId: activeThreadId });
        await onMessage!({ type: 'send', threadId: activeThreadId, text: 'Troisieme message' });

        expect(sendMessageSpy).toHaveBeenCalledTimes(3);
        const thirdCall = sendMessageSpy.mock.calls[2];
        const thirdPrompt = thirdCall[0] as string;
        expect(thirdPrompt).not.toContain('Conversation history:');
        expect(thirdPrompt).toContain('Troisieme message');
        const thirdSessionName = thirdCall[4] as string;
        expect(thirdSessionName).toBe('openclaw-thread-1-v1');
    });

    it('answers thread recall questions locally without calling the agent', async () => {
        const provider = new ChatViewProvider(vscode.Uri.file('/tmp/test-ext'), makeContext());
        const { view, getOnMessage } = makeWebviewView();
        provider.resolveWebviewView(view, {} as vscode.WebviewViewResolveContext, {} as vscode.CancellationToken);

        const onMessage = getOnMessage();
        expect(onMessage).toBeTypeOf('function');

        const activeThreadId = (provider as unknown as { activeThreadId: string }).activeThreadId;
        const threads = (provider as unknown as {
            threads: Map<string, {
                messages: Array<{ role: string; content: string }>;
                service: { sendMessage: (...args: unknown[]) => void }
            }>
        }).threads;
        const thread = threads.get(activeThreadId);
        expect(thread).toBeDefined();

        const sendMessageSpy = vi.spyOn(thread!.service, 'sendMessage').mockImplementation(() => undefined);

        await onMessage!({ type: 'send', threadId: activeThreadId, text: 'pingtest857' });
        expect(sendMessageSpy).toHaveBeenCalledTimes(1);

        await onMessage!({ type: 'send', threadId: activeThreadId, text: 'te souviens-tu de pingtest857 ?' });
        expect(sendMessageSpy).toHaveBeenCalledTimes(1);

        const latestThread = threads.get(activeThreadId);
        const assistantMessages = (latestThread?.messages || []).filter(m => m.role === 'assistant');
        const lastAssistant = assistantMessages[assistantMessages.length - 1];

        expect(lastAssistant).toBeDefined();
        expect(lastAssistant.content).toContain('Tu as envoyé');
        expect(lastAssistant.content).toContain('pingtest857');
    });
});
