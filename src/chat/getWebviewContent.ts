import * as vscode from 'vscode';

export function getWebviewContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    isSidebar: boolean
): string {
    const nonce = getNonce();
    const cspSource = webview.cspSource;

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
    <style nonce="${nonce}">
        :root {
            --chat-spacing: 12px;
            --bubble-radius: 8px;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-sideBar-background, var(--vscode-editor-background));
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
        }

        .toolbar {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 6px var(--chat-spacing);
            border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border));
            flex-shrink: 0;
        }

        .toolbar-title {
            flex: 1;
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            opacity: 0.8;
        }

        .toolbar button {
            background: none;
            border: none;
            color: var(--vscode-foreground);
            cursor: pointer;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 12px;
            opacity: 0.7;
        }

        .toolbar button:hover {
            background: var(--vscode-toolbar-hoverBackground);
            opacity: 1;
        }

        .messages {
            flex: 1;
            overflow-y: auto;
            padding: var(--chat-spacing);
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .message {
            max-width: 95%;
            padding: 8px 12px;
            border-radius: var(--bubble-radius);
            line-height: 1.5;
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }

        .message-user {
            align-self: flex-end;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .message-assistant {
            align-self: flex-start;
            background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
            border: 1px solid var(--vscode-panel-border, var(--vscode-widget-border));
        }

        .message-error {
            align-self: flex-start;
            background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
            border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
            color: var(--vscode-errorForeground, #f48771);
        }

        .tool-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            margin: 2px 0;
            border-radius: 10px;
            font-size: 11px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            opacity: 0.85;
        }

        .tool-badge.done {
            opacity: 0.6;
        }

        .tool-badge::before {
            content: '⚙';
        }

        .tool-badge.done::before {
            content: '✓';
        }

        .streaming-indicator {
            display: none;
            align-self: flex-start;
            padding: 4px 12px;
            font-size: 12px;
            opacity: 0.6;
        }

        .streaming-indicator.active {
            display: block;
        }

        .streaming-indicator::after {
            content: '';
            animation: dots 1.4s steps(4, end) infinite;
        }

        @keyframes dots {
            0% { content: ''; }
            25% { content: '.'; }
            50% { content: '..'; }
            75% { content: '...'; }
        }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex: 1;
            gap: 8px;
            opacity: 0.5;
            text-align: center;
            padding: 20px;
        }

        .empty-state-icon {
            font-size: 32px;
        }

        .empty-state-text {
            font-size: 13px;
        }

        .input-area {
            flex-shrink: 0;
            padding: var(--chat-spacing);
            border-top: 1px solid var(--vscode-panel-border, var(--vscode-widget-border));
            display: flex;
            gap: 6px;
        }

        .input-area textarea {
            flex: 1;
            resize: none;
            border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            padding: 6px 8px;
            border-radius: 4px;
            outline: none;
            min-height: 36px;
            max-height: 120px;
        }

        .input-area textarea:focus {
            border-color: var(--vscode-focusBorder);
        }

        .input-area textarea::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }

        .input-area button {
            align-self: flex-end;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            white-space: nowrap;
        }

        .input-area button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .input-area button:disabled {
            opacity: 0.5;
            cursor: default;
        }

        .hidden {
            display: none !important;
        }

        code {
            font-family: var(--vscode-editor-font-family);
            font-size: 0.9em;
            background: var(--vscode-textCodeBlock-background, rgba(128,128,128,0.15));
            padding: 1px 4px;
            border-radius: 3px;
        }

        pre {
            background: var(--vscode-textCodeBlock-background, rgba(128,128,128,0.15));
            padding: 8px;
            border-radius: 4px;
            overflow-x: auto;
            margin: 4px 0;
        }

        pre code {
            background: none;
            padding: 0;
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <span class="toolbar-title">OpenClaw Chat</span>
        <button id="btn-new" title="New Session">✕ Clear</button>
        ${isSidebar ? '<button id="btn-popout" title="Open in Editor">⬈ Pop Out</button>' : ''}
    </div>

    <div class="messages" id="messages">
        <div class="empty-state" id="empty-state">
            <div class="empty-state-icon">💬</div>
            <div class="empty-state-text">Ask anything about your codebase</div>
        </div>
    </div>

    <div class="streaming-indicator" id="streaming">Thinking</div>

    <div class="input-area">
        <textarea id="input"
                  rows="1"
                  placeholder="Ask a question… (Ctrl+Enter to send)"
                  autofocus></textarea>
        <button id="btn-send">Send</button>
    </div>

    <script nonce="${nonce}">
        (function() {
            const vscode = acquireVsCodeApi();
            const messagesEl = document.getElementById('messages');
            const emptyState = document.getElementById('empty-state');
            const inputEl = document.getElementById('input');
            const btnSend = document.getElementById('btn-send');
            const btnNew = document.getElementById('btn-new');
            const btnPopout = document.getElementById('btn-popout');
            const streamingEl = document.getElementById('streaming');

            let currentAssistantEl = null;
            let currentAssistantText = '';
            let isStreaming = false;

            function send() {
                const text = inputEl.value.trim();
                if (!text || isStreaming) return;
                addMessage('user', text);
                vscode.postMessage({ type: 'send', text: text });
                inputEl.value = '';
                inputEl.style.height = 'auto';
                setStreaming(true);
            }

            function addMessage(role, content) {
                emptyState.classList.add('hidden');
                const el = document.createElement('div');
                el.className = 'message message-' + role;
                el.textContent = content;
                messagesEl.appendChild(el);
                scrollToBottom();
                return el;
            }

            function addToolBadge(title, status) {
                emptyState.classList.add('hidden');
                const el = document.createElement('div');
                el.className = 'tool-badge' + (status === 'done' ? ' done' : '');
                el.textContent = title;
                messagesEl.appendChild(el);
                scrollToBottom();
            }

            function appendAssistantText(text) {
                emptyState.classList.add('hidden');
                if (!currentAssistantEl) {
                    currentAssistantEl = document.createElement('div');
                    currentAssistantEl.className = 'message message-assistant';
                    currentAssistantText = '';
                    messagesEl.appendChild(currentAssistantEl);
                }
                currentAssistantText += text;
                currentAssistantEl.textContent = currentAssistantText;
                scrollToBottom();
            }

            function finishAssistant() {
                if (currentAssistantEl && currentAssistantText) {
                    currentAssistantEl.innerHTML = renderMarkdown(currentAssistantText);
                }
                currentAssistantEl = null;
                currentAssistantText = '';
                setStreaming(false);
            }

            function setStreaming(val) {
                isStreaming = val;
                streamingEl.className = 'streaming-indicator' + (val ? ' active' : '');
                btnSend.disabled = val;
                btnSend.textContent = val ? 'Stop' : 'Send';
                if (val) {
                    btnSend.disabled = false;
                    btnSend.onclick = function() {
                        vscode.postMessage({ type: 'cancel' });
                        setStreaming(false);
                    };
                } else {
                    btnSend.onclick = send;
                }
            }

            function scrollToBottom() {
                messagesEl.scrollTop = messagesEl.scrollHeight;
            }

            function clearMessages() {
                messagesEl.innerHTML = '';
                emptyState.classList.remove('hidden');
                messagesEl.appendChild(emptyState);
                currentAssistantEl = null;
                currentAssistantText = '';
                setStreaming(false);
                vscode.postMessage({ type: 'newSession' });
            }

            function renderMarkdown(text) {
                let html = escapeHtml(text);
                html = html.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>');
                html = html.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
                html = html.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
                return html;
            }

            function escapeHtml(text) {
                const el = document.createElement('span');
                el.textContent = text;
                return el.innerHTML;
            }

            inputEl.addEventListener('keydown', function(e) {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    if (isStreaming) {
                        vscode.postMessage({ type: 'cancel' });
                        setStreaming(false);
                    } else {
                        send();
                    }
                }
            });

            inputEl.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 120) + 'px';
            });

            btnSend.addEventListener('click', send);
            btnNew.addEventListener('click', clearMessages);

            if (btnPopout) {
                btnPopout.addEventListener('click', function() {
                    vscode.postMessage({ type: 'popOut' });
                });
            }

            window.addEventListener('message', function(event) {
                const msg = event.data;
                switch (msg.type) {
                    case 'streamChunk':
                        appendAssistantText(msg.text);
                        break;
                    case 'toolCall':
                        addToolBadge(msg.title, msg.status);
                        break;
                    case 'done':
                        finishAssistant();
                        break;
                    case 'error':
                        finishAssistant();
                        addMessage('error', msg.message);
                        break;
                    case 'state':
                        messagesEl.innerHTML = '';
                        if (msg.messages && msg.messages.length > 0) {
                            emptyState.classList.add('hidden');
                            msg.messages.forEach(function(m) {
                                addMessage(m.role, m.content);
                            });
                        } else {
                            emptyState.classList.remove('hidden');
                            messagesEl.appendChild(emptyState);
                        }
                        break;
                }
            });
        })();
    </script>
</body>
</html>`;
}

function getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
