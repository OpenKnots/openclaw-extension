import * as vscode from 'vscode';

const log = vscode.window.createOutputChannel('OpenClaw Debug', { log: true });

export function openDebugChatPanel(extensionUri: vscode.Uri): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
        'openclaw.debugChat',
        'OpenClaw Debug Chat',
        vscode.ViewColumn.One,
        { enableScripts: true, localResourceRoots: [extensionUri] }
    );

    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    const csp = panel.webview.cspSource;

    panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src ${csp} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 16px;
    height: 100vh;
    display: flex;
    flex-direction: column;
}
h2 { margin-bottom: 8px; font-size: 14px; }
#log {
    flex: 1;
    overflow-y: auto;
    background: var(--vscode-textCodeBlock-background, rgba(0,0,0,0.15));
    border-radius: 6px;
    padding: 10px;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-all;
    margin-bottom: 10px;
    border: 1px solid rgba(255,255,255,0.06);
}
.log-ok  { color: var(--vscode-testing-iconPassed, #73c991); }
.log-err { color: var(--vscode-errorForeground, #f48771); }
.log-warn { color: var(--vscode-editorWarning-foreground, #cca700); }
.log-info { color: var(--vscode-textLink-foreground, #3794ff); }
.compose {
    display: flex;
    gap: 6px;
}
textarea {
    flex: 1;
    resize: none;
    padding: 8px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.12);
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    font: inherit;
    font-size: 13px;
}
button {
    padding: 6px 14px;
    border: none;
    border-radius: 6px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    cursor: pointer;
    font-weight: 600;
    font-size: 13px;
}
button:hover { opacity: 0.9; }
</style>
</head>
<body>
<h2>OpenClaw Debug Chat</h2>
<div id="log"></div>
<div class="compose">
    <textarea id="input" rows="2" placeholder="Type a message..."></textarea>
    <button id="send">Send</button>
</div>
<script nonce="${nonce}">
(function() {
    var vscode = acquireVsCodeApi();
    var logEl = document.getElementById('log');
    var inputEl = document.getElementById('input');
    var sendBtn = document.getElementById('send');

    function addLog(level, text) {
        var line = document.createElement('div');
        line.className = 'log-' + level;
        var ts = new Date().toISOString().slice(11, 23);
        line.textContent = '[' + ts + '] ' + text;
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
    }

    addLog('ok', 'Webview script loaded');
    addLog('info', 'acquireVsCodeApi: ' + (typeof vscode));

    window.addEventListener('error', function(e) {
        addLog('err', 'GLOBAL ERROR: ' + (e.message || e) + ' @ ' + (e.filename || '') + ':' + (e.lineno || ''));
    });
    window.addEventListener('unhandledrejection', function(e) {
        addLog('err', 'UNHANDLED REJECTION: ' + (e.reason || e));
    });

    window.addEventListener('message', function(event) {
        try {
            var msg = event.data;
            var type = msg && msg.type;
            addLog('info', 'MSG IN: type=' + type);

            if (type === 'state') {
                addLog('ok', 'STATE: threads=' + (msg.threads ? msg.threads.length : '?')
                    + ' active=' + (msg.activeThreadId || '?')
                    + ' models=' + JSON.stringify(msg.models || [])
                    + ' dim=' + (msg.dimension || '?'));
                if (msg.threads) {
                    msg.threads.forEach(function(t) {
                        addLog('info', '  thread ' + t.id + ': msgs=' + (t.messages ? t.messages.length : 0)
                            + ' status=' + t.status + ' streaming=' + t.isStreaming
                            + ' model=' + t.currentModel
                            + ' attachments=' + (t.pendingAttachments ? t.pendingAttachments.length : 0));
                        if (t.messages && t.messages.length > 0) {
                            t.messages.forEach(function(m, i) {
                                if (m.role === 'error') {
                                    addLog('err', '    msg[' + i + '] role=error: ' + (m.content || '(empty)'));
                                } else if (m.role === 'tool') {
                                    (m.entries || []).forEach(function(e) {
                                        addLog('warn', '    msg[' + i + '] tool: ' + e.title + ' (' + e.status + ')');
                                    });
                                } else {
                                    var preview = (m.content || '').slice(0, 200);
                                    addLog('info', '    msg[' + i + '] role=' + m.role + ': ' + preview + (m.content && m.content.length > 200 ? '...' : ''));
                                }
                            });
                        }
                        if (t.pendingAssistantText) {
                            addLog('info', '    pendingText: ' + t.pendingAssistantText.slice(0, 200));
                        }
                    });
                }
            } else if (type === 'textUpdate') {
                var preview = (msg.text || '').slice(0, 120);
                addLog('info', 'TEXT UPDATE [' + msg.threadId + ']: ' + preview + (msg.text && msg.text.length > 120 ? '...' : ''));
            } else if (type === 'recommendations') {
                addLog('info', 'RECOMMENDATIONS: ' + JSON.stringify(msg.items || []));
            } else if (type === 'slashCommands') {
                addLog('info', 'SLASH CMDS: ' + (msg.commands ? msg.commands.length : 0) + ' commands');
            } else if (type === 'onboardingDone') {
                addLog('ok', 'ONBOARDING DONE');
            } else {
                addLog('warn', 'UNKNOWN MSG: ' + JSON.stringify(msg).slice(0, 200));
            }
        } catch (err) {
            addLog('err', 'MSG HANDLER ERROR: ' + err);
        }
    });

    sendBtn.addEventListener('click', function() {
        var text = inputEl.value.trim();
        if (!text) return;
        addLog('ok', 'SEND: ' + text);
        vscode.postMessage({ type: 'send', text: text });
        inputEl.value = '';
    });

    inputEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
        }
    });

    addLog('info', 'Requesting state...');
    try {
        vscode.postMessage({ type: 'requestState' });
        addLog('ok', 'requestState sent');
    } catch (err) {
        addLog('err', 'requestState FAILED: ' + err);
    }
    try {
        vscode.postMessage({ type: 'requestRecommendations' });
        addLog('ok', 'requestRecommendations sent');
    } catch (err) {
        addLog('err', 'requestRecommendations FAILED: ' + err);
    }

    addLog('ok', 'Init complete');
})();
</script>
</body>
</html>`;

    panel.webview.onDidReceiveMessage(msg => {
        log.info(`[DebugPanel] message from webview: ${JSON.stringify(msg)}`);
    });

    log.info('Debug chat panel opened');
    return panel;
}
