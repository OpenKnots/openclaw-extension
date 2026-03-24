import { describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import { getWebviewContent } from '../chat/getWebviewContent';

function renderHTML(): string {
    return getWebviewContent(
        { cspSource: 'vscode-webview:' } as vscode.Webview,
        vscode.Uri.file('/tmp/test-ext'),
        true,
    );
}

describe('getWebviewContent', () => {
    it('renders per-pane composers and explicit completion copy', () => {
        const html = renderHTML();

        expect(html).toContain('function renderComposer(thread)');
        expect(html).toContain('Each panel keeps its own composer and completion state');
        expect(html).toContain("return 'Complete';");
        expect(html).toContain('Ask this thread anything...  / commands  @ files');
        expect(html).toContain('function renderComposerRecommendations(thread)');
        expect(html).not.toContain('id="inputWrapper"');
        expect(html).not.toContain("var recHtml = '';");
    });
});

describe('CSP', () => {
    it('includes img-src directive for webview image previews', () => {
        const html = renderHTML();
        expect(html).toContain('img-src vscode-webview:');
    });

    it('still blocks default-src and requires nonce for scripts/styles', () => {
        const html = renderHTML();
        expect(html).toContain("default-src 'none'");
        expect(html).toMatch(/script-src 'nonce-[a-zA-Z0-9]+'/);
        expect(html).toMatch(/style-src vscode-webview: 'nonce-[a-zA-Z0-9]+'/);
    });
});

describe('drop overlay', () => {
    it('renders icon and label as separate elements', () => {
        const html = renderHTML();
        expect(html).toContain('drop-overlay-icon');
        expect(html).toContain('drop-overlay-label');
        expect(html).toContain('Drop files or images to attach');
    });

    it('has dashed border and backdrop blur styling', () => {
        const html = renderHTML();
        expect(html).toContain('border: 2px dashed');
        expect(html).toContain('backdrop-filter: blur');
    });

    it('uses drag-active class on composer-card during drag', () => {
        const html = renderHTML();
        expect(html).toContain("composerUi.dragThreadId === thread.id ? ' drag-active' : ''");
    });
});

describe('attachment pills', () => {
    it('defines getFileIcon function with type-specific icons', () => {
        const html = renderHTML();
        expect(html).toContain('function getFileIcon(name, type)');
        expect(html).toContain("type === 'image'");
    });

    it('renders image thumbnail when previewUri is available', () => {
        const html = renderHTML();
        expect(html).toContain('att-pill-thumb');
        expect(html).toContain("file.type === 'image' && file.previewUri");
    });

    it('falls back to icon span for non-image files', () => {
        const html = renderHTML();
        expect(html).toContain('att-pill-icon');
    });

    it('applies att-image class to image attachment pills', () => {
        const html = renderHTML();
        expect(html).toContain("file.type === 'image' ? ' att-image' : ''");
    });

    it('includes summary count for files and images', () => {
        const html = renderHTML();
        expect(html).toContain('att-count');
        expect(html).toContain("a.type === 'image'");
    });

    it('has CSS for thumbnail sizing and pill hover state', () => {
        const html = renderHTML();
        expect(html).toContain('.att-pill-thumb');
        expect(html).toContain('.att-pill:hover');
    });
});

describe('settings dropdown', () => {
    it('renders thinking, temperature, and max-tokens controls', () => {
        const html = renderHTML();
        expect(html).toContain('function renderSettingsDropdown(thread)');
        expect(html).toContain("data-setting=\"thinking\"");
        expect(html).toContain("data-setting=\"temperature\"");
        expect(html).toContain("data-setting=\"maxTokens\"");
    });

    it('has a settings dropdown trigger button', () => {
        const html = renderHTML();
        expect(html).toContain("data-action=\"toggle-settings\"");
    });
});

describe('streaming and text updates', () => {
    it('handles textUpdate messages for lightweight streaming', () => {
        const html = renderHTML();
        expect(html).toContain("message.type === 'textUpdate'");
        expect(html).toContain('message-pending');
    });

    it('applies blinking cursor to pending assistant messages', () => {
        const html = renderHTML();
        expect(html).toContain('.message-pending::after');
        expect(html).toContain('animation: blink');
    });

    it('queues messages when thread is streaming', () => {
        const html = renderHTML();
        expect(html).toContain('messageQueue[threadId] = raw');
        expect(html).toContain('messageQueue[t.id]');
    });
});

describe('pane collapse', () => {
    it('defines shouldCollapseThread function', () => {
        const html = renderHTML();
        expect(html).toContain('function shouldCollapseThread(thread)');
    });

    it('renders collapse toggle button in 1x1 mode', () => {
        const html = renderHTML();
        expect(html).toContain("data-action=\"toggleCollapse\"");
    });

    it('has CSS for collapsed pane state', () => {
        const html = renderHTML();
        expect(html).toContain('.pane.collapsed');
    });
});

describe('file links in assistant messages', () => {
    it('defines linkifyFilePaths function', () => {
        const html = renderHTML();
        expect(html).toContain('function linkifyFilePaths(html)');
    });

    it('applies linkifyFilePaths to rendered assistant messages', () => {
        const html = renderHTML();
        expect(html).toContain('linkifyFilePaths(message.html');
    });

    it('has CSS for file-link hover styling', () => {
        const html = renderHTML();
        expect(html).toContain('.file-link');
        expect(html).toContain('.file-link:hover');
    });

    it('posts openFile message when file-link is clicked', () => {
        const html = renderHTML();
        expect(html).toContain("type: 'openFile'");
        expect(html).toContain('data-file-path');
    });
});

describe('paste handler', () => {
    it('attaches files pasted from clipboard', () => {
        const html = renderHTML();
        expect(html).toContain("'paste'");
        expect(html).toContain('clipboardData');
    });
});

describe('error handling and fallback', () => {
    it('defines _showCrash for visible error reporting', () => {
        const html = renderHTML();
        expect(html).toContain('function _showCrash(label, err)');
    });

    it('installs global error and unhandledrejection handlers', () => {
        const html = renderHTML();
        expect(html).toContain("addEventListener('error'");
        expect(html).toContain("addEventListener('unhandledrejection'");
    });

    it('has CSS for the crash report UI', () => {
        const html = renderHTML();
        expect(html).toContain('.openclaw-crash');
        expect(html).toContain('.openclaw-crash summary');
        expect(html).toContain('.openclaw-crash pre');
    });

    it('wraps renderState in try/catch', () => {
        const html = renderHTML();
        expect(html).toContain("_showCrash('Render failed for thread");
    });

    it('wraps message handler in try/catch', () => {
        const html = renderHTML();
        expect(html).toContain("_showCrash('Message handler crashed");
    });

    it('wraps initial render and state request in try/catch', () => {
        const html = renderHTML();
        expect(html).toContain("_showCrash('Initial render failed");
        expect(html).toContain("_showCrash('Failed to request initial state");
    });
});

describe('initialization', () => {
    it('requests state on startup', () => {
        const html = renderHTML();
        expect(html).toContain("type: 'requestState'");
    });

    it('renders state before data arrives', () => {
        const html = renderHTML();
        const requestStateIdx = html.indexOf("type: 'requestState'");
        const renderStateIdx = html.lastIndexOf('renderState()');
        expect(renderStateIdx).toBeLessThan(requestStateIdx);
    });

    it('builds dimension options from thread count', () => {
        const html = renderHTML();
        expect(html).toContain('function rebuildDimensionOptions(threadCount)');
    });
});
