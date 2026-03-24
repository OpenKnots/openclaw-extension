import * as vscode from 'vscode';

export function getWebviewContent(
    webview: vscode.Webview,
    _extensionUri: vscode.Uri,
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
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-sideBar-background, var(--vscode-editor-background));
            height: 100vh;
            overflow: hidden;
        }

        button, textarea, input {
            font: inherit;
        }

        button {
            color: inherit;
        }

        .app {
            height: 100vh;
            display: grid;
            grid-template-rows: auto 1fr auto;
        }

        .header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 12px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            background:
                linear-gradient(135deg, rgba(0, 122, 204, 0.12), transparent 58%),
                var(--vscode-sideBar-background, var(--vscode-editor-background));
        }

        .header-title {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            opacity: 0.78;
        }

        .header-subtitle {
            font-size: 12px;
            opacity: 0.55;
        }

        .header-actions {
            margin-left: auto;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .icon-btn {
            width: 28px;
            height: 28px;
            border-radius: 8px;
            border: 1px solid transparent;
            background: transparent;
            cursor: pointer;
            opacity: 0.72;
            transition: opacity 0.15s, background 0.15s, border-color 0.15s;
        }

        .icon-btn:hover {
            opacity: 1;
            background: rgba(255, 255, 255, 0.06);
            border-color: rgba(255, 255, 255, 0.08);
        }

        .workspace {
            min-height: 0;
            display: flex;
            flex-direction: column;
        }

        .pane-grid {
            flex: 1;
            min-height: 0;
            padding: 10px 12px 0;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 10px;
            align-content: start;
            overflow: auto;
        }

        .pane {
            min-height: 230px;
            display: flex;
            flex-direction: column;
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background:
                linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01)),
                var(--vscode-editor-background);
            overflow: hidden;
        }

        .pane.active {
            border-color: var(--vscode-focusBorder, #007acc);
            box-shadow: inset 0 0 0 1px rgba(0, 122, 204, 0.25);
        }

        .pane-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 10px 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .pane-header-main {
            min-width: 0;
            flex: 1;
        }

        .pane-title {
            font-size: 12px;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .pane-meta {
            margin-top: 2px;
            display: flex;
            gap: 8px;
            font-size: 11px;
            opacity: 0.5;
            white-space: nowrap;
            overflow: hidden;
        }

        .pane-status {
            color: var(--vscode-textLink-foreground, var(--vscode-foreground));
        }

        .pane-actions {
            display: flex;
            gap: 4px;
        }

        .pane-btn {
            min-width: 0;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.04);
            color: inherit;
            border-radius: 8px;
            padding: 4px 8px;
            font-size: 11px;
            cursor: pointer;
            transition: background 0.15s, border-color 0.15s;
        }

        .pane-btn:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 255, 255, 0.14);
        }

        .pane-body {
            flex: 1;
            min-height: 0;
            overflow: auto;
            padding: 8px 10px 10px;
            display: flex;
            flex-direction: column;
            gap: 7px;
        }

        .pane-empty {
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 18px;
            border: 1px dashed rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            color: var(--vscode-descriptionForeground, var(--vscode-foreground));
            opacity: 0.62;
            line-height: 1.5;
        }

        .message {
            line-height: 1.55;
            white-space: pre-wrap;
            word-break: break-word;
            font-size: 13px;
        }

        .message-user {
            padding-left: 10px;
            border-left: 2px solid var(--vscode-focusBorder, #007acc);
            opacity: 0.78;
        }

        .message-assistant {
            color: var(--vscode-foreground);
        }

        .message-error {
            color: var(--vscode-errorForeground, #f48771);
            font-size: 12px;
        }

        .message-tool {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            align-self: flex-start;
            padding: 3px 10px;
            border-radius: 999px;
            font-size: 11px;
            opacity: 0.72;
            background: rgba(255, 255, 255, 0.06);
        }

        .message-tool.done {
            opacity: 0.48;
        }

        .message-tool::before {
            content: '\\2699';
        }

        .message-tool.done::before {
            content: '\\2713';
        }

        .pane-streaming {
            font-size: 11px;
            opacity: 0.48;
            padding: 0 10px 10px;
        }

        .pane-streaming::after {
            content: '';
            animation: dots 1.4s steps(4, end) infinite;
        }

        @keyframes dots {
            0% { content: ''; }
            25% { content: '.'; }
            50% { content: '..'; }
            75% { content: '...'; }
        }

        .composer-shell {
            position: relative;
            padding: 10px 12px 12px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            background:
                linear-gradient(180deg, rgba(0, 0, 0, 0.04), transparent),
                var(--vscode-sideBar-background, var(--vscode-editor-background));
        }

        .file-dropdown,
        .slash-dropdown,
        .selector-dropdown {
            position: absolute;
            left: 12px;
            right: 12px;
            bottom: calc(100% - 4px);
            display: none;
            max-height: 260px;
            overflow: auto;
            border-radius: 12px;
            border: 1px solid var(--vscode-editorWidget-border, rgba(255, 255, 255, 0.08));
            background: var(--vscode-editorWidget-background, var(--vscode-dropdown-background, #252526));
            box-shadow: 0 10px 28px rgba(0, 0, 0, 0.32);
            padding: 4px;
            z-index: 10;
        }

        .file-dropdown.visible,
        .slash-dropdown.visible,
        .selector-dropdown.visible {
            display: block;
        }

        .composer-card {
            position: relative;
            border-radius: 16px;
            border: 1px solid var(--vscode-input-border, rgba(255, 255, 255, 0.08));
            background: var(--vscode-input-background);
            overflow: hidden;
            transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
        }

        .composer-card:focus-within {
            border-color: var(--vscode-focusBorder, #007acc);
        }

        .composer-card.drag-active {
            border-color: var(--vscode-focusBorder, #007acc);
            box-shadow: 0 0 0 1px rgba(0, 122, 204, 0.22);
        }

        .drop-overlay {
            position: absolute;
            inset: 0;
            display: none;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.16);
            font-size: 13px;
            font-weight: 600;
            z-index: 2;
            pointer-events: none;
        }

        .drop-overlay.visible {
            display: flex;
        }

        .composer-top {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 10px 0;
        }

        .composer-target {
            min-width: 0;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 4px 8px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.06);
            font-size: 11px;
            opacity: 0.8;
        }

        .composer-target strong {
            font-size: 11px;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 180px;
        }

        .composer-top-spacer {
            flex: 1;
        }

        .dropdown-trigger {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            border: none;
            background: none;
            color: inherit;
            cursor: pointer;
            font-size: 12px;
            opacity: 0.68;
            padding: 4px 6px;
            border-radius: 8px;
        }

        .dropdown-trigger:hover {
            opacity: 1;
            background: rgba(255, 255, 255, 0.05);
        }

        .composer-input {
            width: 100%;
            resize: none;
            border: none;
            background: transparent;
            color: var(--vscode-input-foreground);
            outline: none;
            min-height: 64px;
            max-height: 180px;
            padding: 10px 12px 4px;
            line-height: 1.5;
        }

        .composer-input::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }

        .slash-hint {
            display: none;
            padding: 0 12px 4px;
            font-size: 11px;
            opacity: 0.52;
        }

        .slash-hint.visible {
            display: block;
        }

        .attachments {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            padding: 0 10px 6px;
        }

        .attachments:empty {
            display: none;
        }

        .att-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            max-width: 220px;
            border-radius: 999px;
            padding: 3px 8px;
            background: rgba(255, 255, 255, 0.07);
            font-size: 11px;
        }

        .att-pill-name {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .att-pill-remove {
            border: none;
            background: none;
            cursor: pointer;
            opacity: 0.58;
        }

        .att-pill-remove:hover {
            opacity: 1;
        }

        .composer-footer {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 0 8px 8px;
        }

        .btn-attach,
        .btn-send {
            width: 30px;
            height: 30px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }

        .btn-attach {
            background: transparent;
            opacity: 0.75;
        }

        .btn-attach:hover {
            background: rgba(255, 255, 255, 0.06);
            opacity: 1;
        }

        .btn-send {
            margin-left: auto;
            border-radius: 999px;
            background: var(--vscode-button-background, #007acc);
            color: var(--vscode-button-foreground, #fff);
        }

        .btn-send:hover {
            background: var(--vscode-button-hoverBackground, #0062a3);
        }

        .btn-send.streaming {
            background: var(--vscode-errorForeground, #f48771);
        }

        .selector-search {
            width: calc(100% - 8px);
            margin: 4px;
            border: 1px solid var(--vscode-input-border, rgba(255, 255, 255, 0.08));
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 8px;
            padding: 6px 8px;
            outline: none;
        }

        .selector-item,
        .slash-item,
        .file-item {
            display: flex;
            align-items: center;
            gap: 8px;
            border-radius: 8px;
            padding: 7px 9px;
            cursor: pointer;
        }

        .selector-item:hover,
        .selector-item.selected,
        .slash-item:hover,
        .slash-item.active,
        .file-item:hover,
        .file-item.active {
            background: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.06));
        }

        .selector-item-label,
        .slash-info,
        .file-item-name {
            min-width: 0;
            flex: 1;
        }

        .selector-item-check {
            opacity: 0;
            font-size: 11px;
        }

        .selector-item.selected .selector-item-check {
            opacity: 0.7;
        }

        .slash-info {
            display: flex;
            flex-direction: column;
        }

        .slash-name {
            font-weight: 600;
            font-size: 12px;
        }

        .slash-desc,
        .file-item-path {
            font-size: 11px;
            opacity: 0.55;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .recommendations {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 10px;
        }

        .rec-chip {
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.04);
            border-radius: 999px;
            padding: 6px 10px;
            cursor: pointer;
            font-size: 11px;
        }

        .rec-chip:hover {
            border-color: rgba(255, 255, 255, 0.14);
            background: rgba(255, 255, 255, 0.08);
        }

        .empty-detail {
            max-width: 280px;
        }

        pre {
            overflow: auto;
            background: rgba(128, 128, 128, 0.14);
            border-radius: 8px;
            padding: 10px;
            margin: 4px 0;
        }

        code {
            font-family: var(--vscode-editor-font-family);
            background: rgba(128, 128, 128, 0.14);
            padding: 1px 4px;
            border-radius: 4px;
        }

        pre code {
            background: none;
            padding: 0;
        }

        @media (max-width: 780px) {
            .pane-grid {
                grid-template-columns: 1fr;
            }

            .header-subtitle {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="app">
        <div class="header">
            <div>
                <div class="header-title">OpenClaw</div>
                <div class="header-subtitle">Parallel thread panes with an active tmux-style composer</div>
            </div>
            <div class="header-actions">
                <button class="icon-btn" id="btn-new" title="New thread">+</button>
                <button class="icon-btn" id="btn-split" title="Split from active thread">&#x2398;</button>
                ${isSidebar ? '<button class="icon-btn" id="btn-popout" title="Open in editor">&#x2197;</button>' : ''}
            </div>
        </div>

        <div class="workspace">
            <div class="pane-grid" id="paneGrid"></div>
        </div>

        <div class="composer-shell" id="inputWrapper">
            <div class="file-dropdown" id="fileDropdown"></div>
            <div class="slash-dropdown" id="slashDropdown"></div>
            <div class="selector-dropdown" id="chatTypeDropdown"></div>
            <div class="selector-dropdown" id="modelDropdown"></div>

            <div class="composer-card" id="inputCard">
                <div class="drop-overlay" id="dropOverlay">Drop files to attach to the active thread</div>
                <div class="composer-top">
                    <div class="composer-target" id="composerTarget">No active thread</div>
                    <div class="composer-top-spacer"></div>
                    <button class="dropdown-trigger" id="btn-chat-type" title="Chat type">
                        <span id="chatTypeLabel">Chat</span>
                        <span>&#x25BE;</span>
                    </button>
                    <button class="dropdown-trigger" id="btn-model" title="Model">
                        <span id="modelLabel">codex</span>
                        <span>&#x25BE;</span>
                    </button>
                </div>
                <textarea id="input" class="composer-input" rows="1" placeholder="Ask the active thread anything...  / commands  @ files"></textarea>
                <div class="slash-hint" id="slashHint"></div>
                <div class="attachments" id="attachments"></div>
                <div class="composer-footer">
                    <button class="btn-attach" id="btn-attach" title="Attach file">+</button>
                    <span style="font-size:11px; opacity:0.48;">Ctrl+Enter to send to the active pane</span>
                    <button class="btn-send" id="btn-send" title="Send">&#x2191;</button>
                </div>
            </div>
        </div>
    </div>

    <script nonce="${nonce}">
        (function() {
            var vscode = acquireVsCodeApi();
            var paneGrid = document.getElementById('paneGrid');
            var inputWrapper = document.getElementById('inputWrapper');
            var inputCard = document.getElementById('inputCard');
            var inputEl = document.getElementById('input');
            var btnSend = document.getElementById('btn-send');
            var btnAttach = document.getElementById('btn-attach');
            var btnNew = document.getElementById('btn-new');
            var btnSplit = document.getElementById('btn-split');
            var btnPopout = document.getElementById('btn-popout');
            var dropOverlay = document.getElementById('dropOverlay');
            var slashDropdown = document.getElementById('slashDropdown');
            var slashHint = document.getElementById('slashHint');
            var attachmentsEl = document.getElementById('attachments');
            var fileDropdownEl = document.getElementById('fileDropdown');
            var composerTargetEl = document.getElementById('composerTarget');
            var btnChatType = document.getElementById('btn-chat-type');
            var btnModelEl = document.getElementById('btn-model');
            var chatTypeDropdown = document.getElementById('chatTypeDropdown');
            var modelDropdown = document.getElementById('modelDropdown');
            var chatTypeLabelEl = document.getElementById('chatTypeLabel');
            var modelLabelEl = document.getElementById('modelLabel');

            var slashCommands = [];
            var availableModels = [];
            var recommendations = [];
            var activeSlashIndex = 0;
            var activeFileIndex = 0;
            var atMentionActive = false;
            var atMentionStart = -1;
            var fileSearchDebounce = null;
            var dragDepth = 0;

            var chatTypes = [
                { id: 'chat', label: 'Chat' },
                { id: 'code', label: 'Code' },
                { id: 'review', label: 'Review' },
                { id: 'plan', label: 'Plan' }
            ];

            var state = {
                activeThreadId: '',
                visibleThreadIds: [],
                threads: []
            };

            function getActiveThread() {
                for (var i = 0; i < state.threads.length; i++) {
                    if (state.threads[i].id === state.activeThreadId) {
                        return state.threads[i];
                    }
                }
                return state.threads[0] || null;
            }

            function escapeHtml(text) {
                var el = document.createElement('span');
                el.textContent = text || '';
                return el.innerHTML;
            }

            function autoResizeInput() {
                inputEl.style.height = 'auto';
                inputEl.style.height = Math.min(inputEl.scrollHeight, 180) + 'px';
            }

            function scrollPaneToBottom(paneBody) {
                if (paneBody) {
                    paneBody.scrollTop = paneBody.scrollHeight;
                }
            }

            function setComposerThread(thread) {
                if (!thread) {
                    composerTargetEl.innerHTML = 'No active thread';
                    attachmentsEl.innerHTML = '';
                    chatTypeLabelEl.textContent = 'Chat';
                    modelLabelEl.textContent = 'codex';
                    return;
                }

                composerTargetEl.innerHTML =
                    '<span>Active</span><strong>' + escapeHtml(thread.title) + '</strong><span>#' + thread.index + '</span>';
                renderAttachments(thread.pendingAttachments || []);

                var chatType = chatTypes.find(function(item) { return item.id === thread.currentChatType; });
                chatTypeLabelEl.textContent = chatType ? chatType.label : 'Chat';
                modelLabelEl.textContent = thread.currentModel || 'codex';
            }

            function renderPane(thread) {
                var pane = document.createElement('section');
                pane.className = 'pane' + (thread.id === state.activeThreadId ? ' active' : '');
                pane.dataset.threadId = thread.id;

                var statusText = thread.isStreaming ? 'running' : 'idle';
                pane.innerHTML =
                    '<div class="pane-header">' +
                        '<div class="pane-header-main">' +
                            '<div class="pane-title">' + escapeHtml(thread.title) + '</div>' +
                            '<div class="pane-meta">' +
                                '<span>#' + thread.index + '</span>' +
                                '<span>' + escapeHtml(thread.currentModel || 'codex') + '</span>' +
                                '<span>' + escapeHtml(thread.currentChatType || 'chat') + '</span>' +
                                '<span class="pane-status">' + statusText + '</span>' +
                            '</div>' +
                        '</div>' +
                        '<div class="pane-actions">' +
                            '<button class="pane-btn" data-action="focus">Focus</button>' +
                            '<button class="pane-btn" data-action="clear">Clear</button>' +
                            '<button class="pane-btn" data-action="close">Close</button>' +
                        '</div>' +
                    '</div>';

                var body = document.createElement('div');
                body.className = 'pane-body';

                var messages = thread.messages || [];
                if (messages.length === 0 && !thread.pendingAssistantText) {
                    var empty = document.createElement('div');
                    empty.className = 'pane-empty';

                    var recHtml = '';
                    if (thread.id === state.activeThreadId && recommendations.length > 0) {
                        recHtml = '<div class="recommendations">' + recommendations.map(function(rec) {
                            return '<button class="rec-chip" data-command="' + escapeHtml(rec.command) + '">' +
                                escapeHtml(rec.icon + ' ' + rec.label) +
                            '</button>';
                        }).join('') + '</div>';
                    }

                    empty.innerHTML =
                        '<div class="empty-detail">' +
                            '<div>Empty thread. Focus this pane and start a new conversation.</div>' +
                            recHtml +
                        '</div>';
                    body.appendChild(empty);
                } else {
                    messages.forEach(function(message) {
                        var node = document.createElement('div');
                        if (message.role === 'tool') {
                            node.className = 'message-tool' + (message.status === 'done' ? ' done' : '');
                            node.textContent = message.title;
                        } else if (message.role === 'assistant') {
                            node.className = 'message message-assistant';
                            node.innerHTML = message.html || escapeHtml(message.content || '');
                        } else if (message.role === 'error') {
                            node.className = 'message message-error';
                            node.textContent = message.content || '';
                        } else {
                            node.className = 'message message-user';
                            node.textContent = message.content || '';
                        }
                        body.appendChild(node);
                    });

                    if (thread.pendingAssistantText) {
                        var pending = document.createElement('div');
                        pending.className = 'message message-assistant';
                        pending.textContent = thread.pendingAssistantText;
                        body.appendChild(pending);
                    }
                }

                pane.appendChild(body);

                if (thread.isStreaming) {
                    var streaming = document.createElement('div');
                    streaming.className = 'pane-streaming';
                    streaming.textContent = 'Thinking';
                    pane.appendChild(streaming);
                }

                setTimeout(function() {
                    scrollPaneToBottom(body);
                }, 0);

                pane.addEventListener('click', function(event) {
                    var actionEl = event.target.closest('[data-action]');
                    if (actionEl) {
                        var action = actionEl.getAttribute('data-action');
                        if (action === 'focus') {
                            vscode.postMessage({ type: 'focusThread', threadId: thread.id });
                            inputEl.focus();
                        } else if (action === 'clear') {
                            vscode.postMessage({ type: 'clearThread', threadId: thread.id });
                        } else if (action === 'close') {
                            vscode.postMessage({ type: 'closeThread', threadId: thread.id });
                        }
                        return;
                    }

                    if (thread.id !== state.activeThreadId) {
                        vscode.postMessage({ type: 'focusThread', threadId: thread.id });
                    }
                });

                body.addEventListener('click', function(event) {
                    var rec = event.target.closest('.rec-chip');
                    if (!rec) return;
                    var command = rec.getAttribute('data-command');
                    if (command) {
                        inputEl.value = command + ' ';
                        inputEl.focus();
                        autoResizeInput();
                        checkSlashInput();
                    }
                });

                return pane;
            }

            function renderState() {
                paneGrid.innerHTML = '';

                if (!state.threads || state.threads.length === 0) {
                    paneGrid.innerHTML = '<div class="pane-empty"><div class="empty-detail">No threads available.</div></div>';
                    setComposerThread(null);
                    return;
                }

                state.threads.forEach(function(thread) {
                    paneGrid.appendChild(renderPane(thread));
                });

                setComposerThread(getActiveThread());
            }

            function renderAttachments(files) {
                attachmentsEl.innerHTML = '';
                (files || []).forEach(function(file, index) {
                    var pill = document.createElement('span');
                    pill.className = 'att-pill';
                    pill.innerHTML =
                        '<span class="att-pill-name" title="' + escapeHtml(file.path) + '">' + escapeHtml(file.name) + '</span>' +
                        '<button class="att-pill-remove" data-index="' + index + '">&#x00d7;</button>';
                    attachmentsEl.appendChild(pill);
                });
            }

            attachmentsEl.addEventListener('click', function(event) {
                var button = event.target.closest('[data-index]');
                var activeThread = getActiveThread();
                if (!button || !activeThread) return;
                vscode.postMessage({
                    type: 'removeAttachment',
                    threadId: activeThread.id,
                    index: Number(button.getAttribute('data-index'))
                });
            });

            function getSlashQuery() {
                var value = inputEl.value;
                if (value.charAt(0) !== '/') return null;
                var spaceIndex = value.indexOf(' ');
                if (spaceIndex === -1) return value.substring(1);
                return null;
            }

            function filterSlashCommands(query) {
                var lower = query.toLowerCase();
                return slashCommands.filter(function(command) {
                    return command.name.indexOf(lower) === 0;
                });
            }

            function hideDropdown() {
                slashDropdown.classList.remove('visible');
                slashDropdown.innerHTML = '';
            }

            function clearSlashState() {
                slashHint.classList.remove('visible');
                slashHint.textContent = '';
                inputEl.placeholder = 'Ask the active thread anything...  / commands  @ files';
            }

            function selectSlashCommand(command) {
                inputEl.value = '/' + command.name + ' ';
                inputEl.placeholder = command.placeholder || inputEl.placeholder;
                slashHint.textContent = '/' + command.name + ' - ' + command.description;
                slashHint.classList.add('visible');
                hideDropdown();
                inputEl.focus();
                autoResizeInput();
            }

            function renderDropdown(commands) {
                if (!commands.length) {
                    hideDropdown();
                    return;
                }

                slashDropdown.innerHTML = '';
                commands.forEach(function(command, index) {
                    var item = document.createElement('div');
                    item.className = 'slash-item' + (index === activeSlashIndex ? ' active' : '');
                    item.innerHTML =
                        '<div>' + escapeHtml(command.icon) + '</div>' +
                        '<div class="slash-info">' +
                            '<div class="slash-name">/' + escapeHtml(command.name) + '</div>' +
                            '<div class="slash-desc">' + escapeHtml(command.description) + '</div>' +
                        '</div>';
                    item.addEventListener('mousedown', function(event) {
                        event.preventDefault();
                        selectSlashCommand(command);
                    });
                    item.addEventListener('mouseenter', function() {
                        activeSlashIndex = index;
                        updateSlashActiveItem();
                    });
                    slashDropdown.appendChild(item);
                });
                slashDropdown.classList.add('visible');
            }

            function updateSlashActiveItem() {
                var items = slashDropdown.querySelectorAll('.slash-item');
                items.forEach(function(item, index) {
                    item.classList.toggle('active', index === activeSlashIndex);
                });
            }

            function checkSlashInput() {
                var query = getSlashQuery();
                if (query === null) {
                    hideDropdown();
                    if (inputEl.value.charAt(0) !== '/') clearSlashState();
                    return;
                }

                var filtered = filterSlashCommands(query);
                activeSlashIndex = Math.max(0, Math.min(activeSlashIndex, filtered.length - 1));
                renderDropdown(filtered);
            }

            function closeAllSelectors() {
                chatTypeDropdown.classList.remove('visible');
                modelDropdown.classList.remove('visible');
            }

            function selectChatType(id) {
                var activeThread = getActiveThread();
                if (!activeThread) return;
                closeAllSelectors();
                vscode.postMessage({ type: 'setChatType', threadId: activeThread.id, chatType: id });
            }

            function renderChatTypeDropdown() {
                var activeThread = getActiveThread();
                if (!activeThread) return;

                chatTypeDropdown.innerHTML = '';
                chatTypes.forEach(function(chatType) {
                    var item = document.createElement('div');
                    item.className = 'selector-item' + (chatType.id === activeThread.currentChatType ? ' selected' : '');
                    item.innerHTML =
                        '<span class="selector-item-label">' + escapeHtml(chatType.label) + '</span>' +
                        '<span class="selector-item-check">&#x2713;</span>';
                    item.addEventListener('mousedown', function(event) {
                        event.preventDefault();
                        selectChatType(chatType.id);
                    });
                    chatTypeDropdown.appendChild(item);
                });
                chatTypeDropdown.classList.add('visible');
            }

            function selectModel(model) {
                var activeThread = getActiveThread();
                if (!activeThread) return;
                closeAllSelectors();
                vscode.postMessage({ type: 'setModel', threadId: activeThread.id, model: model });
            }

            function renderModelList(query) {
                var activeThread = getActiveThread();
                if (!activeThread) return;

                var existingItems = modelDropdown.querySelectorAll('.selector-item');
                existingItems.forEach(function(item) { item.remove(); });

                var models = availableModels.slice();
                if (query) {
                    models = models.filter(function(model) {
                        return model.toLowerCase().indexOf(query.toLowerCase()) !== -1;
                    });
                }

                models.forEach(function(model) {
                    var item = document.createElement('div');
                    item.className = 'selector-item' + (model === activeThread.currentModel ? ' selected' : '');
                    item.innerHTML =
                        '<span class="selector-item-label">' + escapeHtml(model) + '</span>' +
                        '<span class="selector-item-check">&#x2713;</span>';
                    item.addEventListener('mousedown', function(event) {
                        event.preventDefault();
                        selectModel(model);
                    });
                    modelDropdown.appendChild(item);
                });
            }

            function renderModelDropdown() {
                modelDropdown.innerHTML = '';
                var search = document.createElement('input');
                search.className = 'selector-search';
                search.placeholder = 'Search models';
                search.addEventListener('input', function() {
                    renderModelList(search.value);
                });
                search.addEventListener('mousedown', function(event) {
                    event.stopPropagation();
                });
                modelDropdown.appendChild(search);
                renderModelList('');
                modelDropdown.classList.add('visible');
                setTimeout(function() { search.focus(); }, 0);
            }

            function hideFileDropdown() {
                atMentionActive = false;
                atMentionStart = -1;
                activeFileIndex = 0;
                fileDropdownEl.classList.remove('visible');
                fileDropdownEl.innerHTML = '';
                if (fileSearchDebounce) {
                    clearTimeout(fileSearchDebounce);
                    fileSearchDebounce = null;
                }
            }

            function selectFileFromDropdown(filePath) {
                var activeThread = getActiveThread();
                if (!activeThread) return;

                var text = inputEl.value;
                var cursor = inputEl.selectionStart;
                var before = text.substring(0, atMentionStart);
                var after = text.substring(cursor);
                inputEl.value = before + after;
                inputEl.selectionStart = inputEl.selectionEnd = before.length;
                hideFileDropdown();
                autoResizeInput();
                vscode.postMessage({ type: 'attachFile', threadId: activeThread.id, filePath: filePath });
                inputEl.focus();
            }

            function updateFileActiveItem() {
                var items = fileDropdownEl.querySelectorAll('.file-item');
                items.forEach(function(item, index) {
                    item.classList.toggle('active', index === activeFileIndex);
                });
            }

            function renderFileResults(files) {
                if (!files || !files.length || !atMentionActive) {
                    fileDropdownEl.classList.remove('visible');
                    return;
                }

                fileDropdownEl.innerHTML = '';
                files.forEach(function(file, index) {
                    var item = document.createElement('div');
                    item.className = 'file-item' + (index === activeFileIndex ? ' active' : '');
                    item.dataset.path = file.path;
                    item.innerHTML =
                        '<span class="file-item-name">' + escapeHtml(file.name) + '</span>' +
                        '<span class="file-item-path">' + escapeHtml(file.relativePath) + '</span>';
                    item.addEventListener('mousedown', function(event) {
                        event.preventDefault();
                        selectFileFromDropdown(file.path);
                    });
                    item.addEventListener('mouseenter', function() {
                        activeFileIndex = index;
                        updateFileActiveItem();
                    });
                    fileDropdownEl.appendChild(item);
                });
                fileDropdownEl.classList.add('visible');
            }

            function checkAtMention() {
                var cursor = inputEl.selectionStart;
                var text = inputEl.value;
                var atPos = -1;

                for (var i = cursor - 1; i >= 0; i--) {
                    if (text[i] === '@') {
                        if (i === 0 || /\\s/.test(text[i - 1])) {
                            atPos = i;
                        }
                        break;
                    }
                    if (/\\s/.test(text[i])) {
                        break;
                    }
                }

                if (atPos < 0) {
                    if (atMentionActive) hideFileDropdown();
                    return;
                }

                atMentionActive = true;
                atMentionStart = atPos;
                activeFileIndex = 0;

                if (fileSearchDebounce) clearTimeout(fileSearchDebounce);
                fileSearchDebounce = setTimeout(function() {
                    vscode.postMessage({
                        type: 'fileSearch',
                        query: text.substring(atPos + 1, cursor)
                    });
                }, 120);
            }

            function hasFileDrag(dataTransfer) {
                if (!dataTransfer || !dataTransfer.types) return false;
                if (typeof dataTransfer.types.indexOf === 'function') {
                    return dataTransfer.types.indexOf('Files') !== -1;
                }
                return Array.prototype.indexOf.call(dataTransfer.types, 'Files') !== -1;
            }

            function setDragActive(active) {
                inputCard.classList.toggle('drag-active', active);
                dropOverlay.classList.toggle('visible', active);
            }

            function extractDroppedPaths(dataTransfer) {
                var paths = [];

                function pushPath(file) {
                    if (file && file.path && paths.indexOf(file.path) === -1) {
                        paths.push(file.path);
                    }
                }

                if (dataTransfer.items) {
                    for (var i = 0; i < dataTransfer.items.length; i++) {
                        var item = dataTransfer.items[i];
                        if (item.kind === 'file') {
                            pushPath(item.getAsFile());
                        }
                    }
                }

                if (!paths.length && dataTransfer.files) {
                    for (var j = 0; j < dataTransfer.files.length; j++) {
                        pushPath(dataTransfer.files[j]);
                    }
                }

                return paths;
            }

            function send() {
                var activeThread = getActiveThread();
                var raw = inputEl.value.trim();
                if (!activeThread || !raw || activeThread.isStreaming) {
                    return;
                }

                var match = raw.match(/^\\/([a-zA-Z]+)\\s*(.*)/);
                if (match) {
                    var commandName = match[1].toLowerCase();
                    var userText = match[2] || '';
                    var command = slashCommands.find(function(item) { return item.name === commandName; });
                    if (command) {
                        vscode.postMessage({
                            type: 'slashCommand',
                            threadId: activeThread.id,
                            command: commandName,
                            text: userText
                        });
                        inputEl.value = '';
                        autoResizeInput();
                        clearSlashState();
                        hideDropdown();
                        return;
                    }
                }

                vscode.postMessage({ type: 'send', threadId: activeThread.id, text: raw });
                inputEl.value = '';
                autoResizeInput();
                clearSlashState();
                hideDropdown();
            }

            function cancelActiveThread() {
                var activeThread = getActiveThread();
                if (!activeThread) return;
                vscode.postMessage({ type: 'cancel', threadId: activeThread.id });
            }

            btnSend.addEventListener('click', function() {
                var activeThread = getActiveThread();
                if (activeThread && activeThread.isStreaming) {
                    cancelActiveThread();
                    return;
                }
                send();
            });

            btnNew.addEventListener('click', function() {
                vscode.postMessage({ type: 'newSession' });
                inputEl.focus();
            });

            btnSplit.addEventListener('click', function() {
                vscode.postMessage({ type: 'splitThread' });
                inputEl.focus();
            });

            if (btnPopout) {
                btnPopout.addEventListener('click', function() {
                    vscode.postMessage({ type: 'popOut' });
                });
            }

            btnAttach.addEventListener('click', function() {
                var activeThread = getActiveThread();
                if (!activeThread) return;
                vscode.postMessage({ type: 'attach', threadId: activeThread.id });
            });

            btnChatType.addEventListener('click', function(event) {
                event.stopPropagation();
                var open = chatTypeDropdown.classList.contains('visible');
                closeAllSelectors();
                if (!open) renderChatTypeDropdown();
            });

            btnModelEl.addEventListener('click', function(event) {
                event.stopPropagation();
                var open = modelDropdown.classList.contains('visible');
                closeAllSelectors();
                if (!open) renderModelDropdown();
            });

            document.addEventListener('click', function(event) {
                if (!chatTypeDropdown.contains(event.target) && !btnChatType.contains(event.target) &&
                    !modelDropdown.contains(event.target) && !btnModelEl.contains(event.target)) {
                    closeAllSelectors();
                }
            });

            inputEl.addEventListener('keydown', function(event) {
                var fileVisible = fileDropdownEl.classList.contains('visible');
                if (fileVisible && atMentionActive) {
                    var fileItems = fileDropdownEl.querySelectorAll('.file-item');
                    if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        activeFileIndex = Math.min(activeFileIndex + 1, fileItems.length - 1);
                        updateFileActiveItem();
                        return;
                    }
                    if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        activeFileIndex = Math.max(activeFileIndex - 1, 0);
                        updateFileActiveItem();
                        return;
                    }
                    if ((event.key === 'Enter' || event.key === 'Tab') && fileItems.length) {
                        event.preventDefault();
                        selectFileFromDropdown(fileItems[activeFileIndex].dataset.path);
                        return;
                    }
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        hideFileDropdown();
                        return;
                    }
                }

                var slashVisible = slashDropdown.classList.contains('visible');
                if (slashVisible) {
                    var filtered = filterSlashCommands(getSlashQuery() || '');
                    if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        activeSlashIndex = Math.min(activeSlashIndex + 1, filtered.length - 1);
                        updateSlashActiveItem();
                        return;
                    }
                    if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        activeSlashIndex = Math.max(activeSlashIndex - 1, 0);
                        updateSlashActiveItem();
                        return;
                    }
                    if ((event.key === 'Enter' || event.key === 'Tab') && filtered.length) {
                        event.preventDefault();
                        selectSlashCommand(filtered[activeSlashIndex]);
                        return;
                    }
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        hideDropdown();
                        return;
                    }
                }

                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                    event.preventDefault();
                    var activeThread = getActiveThread();
                    if (activeThread && activeThread.isStreaming) {
                        cancelActiveThread();
                    } else {
                        send();
                    }
                }
            });

            inputEl.addEventListener('input', function() {
                autoResizeInput();
                checkSlashInput();
                checkAtMention();
                if (!inputEl.value || inputEl.value.charAt(0) !== '/') {
                    clearSlashState();
                }
            });

            inputEl.addEventListener('click', checkAtMention);

            inputEl.addEventListener('blur', function() {
                setTimeout(function() {
                    if (atMentionActive) {
                        hideFileDropdown();
                    }
                }, 150);
            });

            inputWrapper.addEventListener('dragenter', function(event) {
                if (!hasFileDrag(event.dataTransfer)) return;
                dragDepth += 1;
                event.preventDefault();
                setDragActive(true);
            });

            inputWrapper.addEventListener('dragover', function(event) {
                if (!hasFileDrag(event.dataTransfer)) return;
                event.preventDefault();
                if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
                setDragActive(true);
            });

            inputWrapper.addEventListener('dragleave', function(event) {
                if (!hasFileDrag(event.dataTransfer)) return;
                dragDepth = Math.max(0, dragDepth - 1);
                if (dragDepth === 0 && !inputWrapper.contains(event.relatedTarget)) {
                    setDragActive(false);
                }
            });

            inputWrapper.addEventListener('drop', function(event) {
                var activeThread = getActiveThread();
                if (!activeThread || !hasFileDrag(event.dataTransfer)) return;
                event.preventDefault();
                dragDepth = 0;
                setDragActive(false);
                var filePaths = extractDroppedPaths(event.dataTransfer);
                if (filePaths.length) {
                    vscode.postMessage({
                        type: 'attachFiles',
                        threadId: activeThread.id,
                        filePaths: filePaths
                    });
                }
            });

            window.addEventListener('dragend', function() {
                dragDepth = 0;
                setDragActive(false);
            });

            window.addEventListener('message', function(event) {
                var message = event.data;
                if (message.type === 'slashCommands') {
                    slashCommands = message.commands || [];
                    return;
                }
                if (message.type === 'recommendations') {
                    recommendations = message.items || [];
                    renderState();
                    return;
                }
                if (message.type === 'fileSearchResults') {
                    renderFileResults(message.files || []);
                    return;
                }
                if (message.type === 'onboardingDone') {
                    return;
                }
                if (message.type === 'state') {
                    state.activeThreadId = message.activeThreadId || '';
                    state.visibleThreadIds = message.visibleThreadIds || [];
                    state.threads = message.threads || [];
                    availableModels = message.models || [];
                    renderState();

                    var activeThread = getActiveThread();
                    if (activeThread && activeThread.isStreaming) {
                        btnSend.classList.add('streaming');
                        btnSend.innerHTML = '&#x25A0;';
                        btnSend.title = 'Stop';
                    } else {
                        btnSend.classList.remove('streaming');
                        btnSend.innerHTML = '&#x2191;';
                        btnSend.title = 'Send';
                    }
                }
            });

            vscode.postMessage({ type: 'requestRecommendations' });
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
