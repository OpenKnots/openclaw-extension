import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { activate, deactivate } from '../extension';

function makeContext(): { context: vscode.ExtensionContext; subscriptions: vscode.Disposable[] } {
    const subscriptions: vscode.Disposable[] = [];
    const context = {
        extensionUri: vscode.Uri.file('/tmp/test-ext'),
        globalState: { get: vi.fn(), update: vi.fn() },
        subscriptions,
    } as unknown as vscode.ExtensionContext;
    return { context, subscriptions };
}

describe('extension activation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('exports activate and deactivate', () => {
        expect(typeof activate).toBe('function');
        expect(typeof deactivate).toBe('function');
    });

    it('activate registers commands and views without throwing', () => {
        const { context, subscriptions } = makeContext();
        expect(() => activate(context)).not.toThrow();
        expect(subscriptions.length).toBeGreaterThan(0);
    });

    it('creates a status bar item', () => {
        const { context } = makeContext();
        activate(context);
        expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(
            vscode.StatusBarAlignment.Right,
            100,
        );
    });

    it('registers the expected commands', () => {
        const { context } = makeContext();
        activate(context);
        const registered = (vscode.commands.registerCommand as ReturnType<typeof vi.fn>).mock.calls.map(
            (c: unknown[]) => c[0],
        );
        expect(registered).toContain('openclaw.connect');
        expect(registered).toContain('openclaw.setup');
        expect(registered).toContain('openclaw.harden');
        expect(registered).toContain('openclaw.chat.open');
        expect(registered).toContain('openclaw.chat.popOut');
        expect(registered).toContain('openclaw.chat.newSession');
    });

    it('registers the overview tree view', () => {
        const { context } = makeContext();
        activate(context);
        expect(vscode.window.createTreeView).toHaveBeenCalledWith(
            'openclaw.overview',
            expect.objectContaining({ treeDataProvider: expect.anything() }),
        );
    });

    it('registers the chat webview view provider', () => {
        const { context } = makeContext();
        activate(context);
        expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith(
            'openclaw.chat',
            expect.anything(),
        );
    });

    it('deactivate does not throw', () => {
        expect(() => deactivate()).not.toThrow();
    });

    it('does not auto-connect when autoConnect is false', () => {
        const { context } = makeContext();
        activate(context);
        expect(vscode.window.createTerminal).not.toHaveBeenCalled();
    });
});
