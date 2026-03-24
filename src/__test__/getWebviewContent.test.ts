import { describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import { getWebviewContent } from '../chat/getWebviewContent';

describe('getWebviewContent', () => {
    it('renders per-pane composers and explicit completion copy', () => {
        const html = getWebviewContent(
            { cspSource: 'vscode-webview:' } as vscode.Webview,
            vscode.Uri.file('/tmp/test-ext'),
            true,
        );

        expect(html).toContain('function renderComposer(thread)');
        expect(html).toContain('Each panel keeps its own composer and completion state');
        expect(html).toContain("return 'Complete';");
        expect(html).toContain('Ask this thread anything...  / commands  @ files');
        expect(html).toContain('function renderComposerRecommendations(thread)');
        expect(html).not.toContain('id="inputWrapper"');
        expect(html).not.toContain("var recHtml = '';");
    });
});
