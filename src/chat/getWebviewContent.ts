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

        /* --- Header --- */
        .header {
            display: flex;
            align-items: center;
            padding: 10px 14px;
            flex-shrink: 0;
        }

        .header-title {
            font-weight: 700;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            opacity: 0.85;
        }

        .header-actions {
            margin-left: auto;
            display: flex;
            gap: 2px;
        }

        .header-actions button {
            background: none;
            border: none;
            color: var(--vscode-foreground);
            cursor: pointer;
            width: 26px;
            height: 26px;
            border-radius: 6px;
            font-size: 14px;
            opacity: 0;
            transition: opacity 0.15s, background 0.15s;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .header:hover .header-actions button,
        body.has-messages .header-actions button {
            opacity: 0.6;
        }

        .header-actions button:hover {
            background: var(--vscode-toolbar-hoverBackground);
            opacity: 1 !important;
        }

        /* --- Main area --- */
        .main {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: relative;
        }

        .main.empty {
            justify-content: center;
        }

        /* --- Messages --- */
        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 8px 14px;
            display: none;
            flex-direction: column;
            gap: 6px;
        }

        body.has-messages .messages {
            display: flex;
        }

        .message {
            max-width: 100%;
            padding: 8px 0;
            line-height: 1.55;
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
            font-size: 13px;
        }

        .message-user {
            color: var(--vscode-foreground);
            opacity: 0.7;
            padding-left: 10px;
            border-left: 2px solid var(--vscode-focusBorder, #007acc);
        }

        .message-assistant {
            color: var(--vscode-foreground);
        }

        .message-error {
            color: var(--vscode-errorForeground, #f48771);
            font-size: 12px;
        }

        .tool-badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 3px 10px;
            margin: 3px 0;
            border-radius: 12px;
            font-size: 11px;
            background: rgba(255,255,255,0.06);
            color: var(--vscode-foreground);
            opacity: 0.6;
        }

        .tool-badge::before { content: '\\2699'; }
        .tool-badge.done { opacity: 0.4; }
        .tool-badge.done::before { content: '\\2713'; }

        .streaming-indicator {
            display: none;
            padding: 2px 14px 8px;
            font-size: 12px;
            opacity: 0.45;
        }

        .streaming-indicator.active { display: block; }

        .streaming-indicator::after {
            content: '';
            animation: dots 1.4s steps(4, end) infinite;
        }

        @keyframes dots {
            0%  { content: ''; }
            25% { content: '.'; }
            50% { content: '..'; }
            75% { content: '...'; }
        }

        /* --- Input card --- */
        .input-wrapper {
            flex-shrink: 0;
            padding: 0 14px 12px;
            position: relative;
        }

        .main.empty .input-wrapper {
            padding-bottom: 0;
        }

        .input-card {
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border, rgba(255,255,255,0.1));
            border-radius: 14px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transition: border-color 0.15s;
        }

        .input-card:focus-within {
            border-color: var(--vscode-focusBorder, #007acc);
        }

        .input-card textarea {
            flex: 1;
            resize: none;
            border: none;
            background: transparent;
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            padding: 12px 14px 4px;
            outline: none;
            min-height: 24px;
            max-height: 150px;
            line-height: 1.5;
        }

        .input-card textarea::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }

        .input-bottom-row {
            display: flex;
            align-items: center;
            padding: 4px 6px 6px;
        }

        .btn-attach {
            width: 28px;
            height: 28px;
            border-radius: 8px;
            border: none;
            background: none;
            color: var(--vscode-foreground);
            font-size: 18px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.5;
            transition: opacity 0.15s, background 0.15s;
        }

        .btn-attach:hover {
            opacity: 0.85;
            background: rgba(255,255,255,0.06);
        }

        .btn-send {
            margin-left: auto;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: none;
            background: var(--vscode-button-background, #007acc);
            color: var(--vscode-button-foreground, #fff);
            font-size: 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: opacity 0.15s, background 0.15s;
        }

        .btn-send:hover {
            background: var(--vscode-button-hoverBackground, #0062a3);
        }

        .btn-send:disabled {
            opacity: 0.35;
            cursor: default;
        }

        .btn-send.streaming {
            background: var(--vscode-errorForeground, #f48771);
        }

        /* --- Slash command dropdown --- */
        .slash-dropdown {
            position: absolute;
            bottom: 100%;
            left: 14px;
            right: 14px;
            margin-bottom: 4px;
            background: var(--vscode-editorWidget-background, var(--vscode-dropdown-background, #252526));
            border: 1px solid var(--vscode-editorWidget-border, var(--vscode-dropdown-border, rgba(255,255,255,0.1)));
            border-radius: 10px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.35);
            max-height: 260px;
            overflow-y: auto;
            z-index: 100;
            padding: 4px;
            display: none;
            animation: slideUp 0.12s ease-out;
        }

        .slash-dropdown.visible {
            display: block;
        }

        @keyframes slideUp {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0); }
        }

        .slash-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 7px 10px;
            border-radius: 7px;
            cursor: pointer;
            transition: background 0.1s;
        }

        .slash-item:hover,
        .slash-item.active {
            background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.06));
        }

        .slash-item.active {
            background: var(--vscode-list-activeSelectionBackground, rgba(255,255,255,0.1));
            color: var(--vscode-list-activeSelectionForeground, inherit);
        }

        .slash-icon {
            font-size: 16px;
            width: 24px;
            text-align: center;
            flex-shrink: 0;
        }

        .slash-info {
            display: flex;
            flex-direction: column;
            min-width: 0;
        }

        .slash-name {
            font-size: 13px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }

        .slash-desc {
            font-size: 11px;
            opacity: 0.55;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .slash-hint {
            display: none;
            padding: 0 14px 4px;
            font-size: 11px;
            opacity: 0.5;
        }

        .slash-hint.visible {
            display: block;
        }

        /* --- Recommendations --- */
        .recommendations {
            flex-shrink: 0;
            padding: 12px 14px 14px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            animation: fadeIn 0.25s ease-out;
        }

        body.has-messages .recommendations { display: none; }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
        }

        .rec-tagline {
            font-size: 12px;
            opacity: 0.45;
            text-align: center;
            line-height: 1.4;
            padding-bottom: 2px;
        }

        .rec-grid {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 6px;
            max-width: 360px;
        }

        .rec-chip {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 5px 12px;
            border-radius: 20px;
            border: 1px solid var(--vscode-input-border, rgba(255,255,255,0.1));
            background: transparent;
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
            font-size: 12px;
            cursor: pointer;
            transition: background 0.15s, border-color 0.15s, transform 0.1s;
            white-space: nowrap;
        }

        .rec-chip:hover {
            background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.06));
            border-color: var(--vscode-focusBorder, #007acc);
            transform: translateY(-1px);
        }

        .rec-chip:active {
            transform: translateY(0);
        }

        .rec-chip-icon {
            font-size: 13px;
        }

        /* --- Attachment pills --- */
        .attachments {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            padding: 0 10px;
        }

        .attachments:empty { display: none; }

        .att-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            border-radius: 8px;
            font-size: 11px;
            background: rgba(255,255,255,0.08);
            color: var(--vscode-foreground);
            max-width: 180px;
        }

        .att-pill-name {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .att-pill-remove {
            background: none;
            border: none;
            color: var(--vscode-foreground);
            cursor: pointer;
            font-size: 11px;
            opacity: 0.5;
            padding: 0 2px;
            line-height: 1;
        }

        .att-pill-remove:hover { opacity: 1; }

        /* --- File mention dropdown --- */
        .file-dropdown {
            position: absolute;
            bottom: 100%;
            left: 14px;
            right: 14px;
            margin-bottom: 4px;
            background: var(--vscode-editorWidget-background, var(--vscode-dropdown-background, #252526));
            border: 1px solid var(--vscode-editorWidget-border, var(--vscode-dropdown-border, rgba(255,255,255,0.1)));
            border-radius: 10px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.35);
            max-height: 240px;
            overflow-y: auto;
            z-index: 101;
            padding: 4px;
            display: none;
            animation: slideUp 0.12s ease-out;
        }

        .file-dropdown.visible {
            display: block;
        }

        .file-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 10px;
            border-radius: 7px;
            cursor: pointer;
            font-size: 12px;
            transition: background 0.1s;
        }

        .file-item:hover,
        .file-item.active {
            background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.06));
        }

        .file-item.active {
            background: var(--vscode-list-activeSelectionBackground, rgba(255,255,255,0.1));
            color: var(--vscode-list-activeSelectionForeground, inherit);
        }

        .file-item-name {
            font-weight: 500;
            white-space: nowrap;
        }

        .file-item-path {
            opacity: 0.45;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-size: 11px;
            margin-left: auto;
        }

        /* --- Onboarding carousel --- */
        .onboarding {
            flex-shrink: 0;
            padding: 12px 14px 14px;
        }

        body.has-messages .onboarding { display: none; }

        .onboarding-slides {
            position: relative;
            overflow: hidden;
        }

        .onboarding-slide {
            display: none;
            opacity: 0;
            transform: translateY(6px);
            transition: opacity 0.25s ease, transform 0.25s ease;
        }

        .onboarding-slide.active {
            display: block;
            opacity: 1;
            transform: translateY(0);
        }

        .onboarding-card {
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px;
            padding: 20px 16px 16px;
            text-align: center;
        }

        .onboarding-icon {
            font-size: 28px;
            margin-bottom: 14px;
            opacity: 0.85;
            line-height: 1;
        }

        .onboarding h3 {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 6px;
            color: var(--vscode-foreground);
            text-align: center;
        }

        .onboarding-subtitle {
            font-size: 12px;
            line-height: 1.5;
            opacity: 0.55;
            margin-bottom: 0;
            text-align: center;
        }

        .onboarding-tasks {
            margin: 14px 0 4px;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .onboarding-task {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 7px 12px;
            border-radius: 8px;
            font-size: 12px;
            text-align: left;
        }

        .onboarding-task-icon {
            flex-shrink: 0;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
        }

        .onboarding-task-icon.check {
            color: var(--vscode-testing-iconPassed, #73c991);
            opacity: 0.9;
        }

        .onboarding-task-icon.pending {
            color: var(--vscode-foreground);
            opacity: 0.35;
        }

        .onboarding-task-body {
            flex: 1;
            min-width: 0;
        }

        .onboarding-task-title {
            font-weight: 500;
            color: var(--vscode-foreground);
        }

        .onboarding-task-meta {
            font-size: 11px;
            opacity: 0.4;
            margin-top: 1px;
        }

        .onboarding-task-diff {
            flex-shrink: 0;
            font-size: 11px;
            font-family: var(--vscode-editor-font-family);
        }

        .diff-add { color: var(--vscode-testing-iconPassed, #73c991); }
        .diff-del { color: var(--vscode-errorForeground, #f48771); margin-left: 4px; }

        .onboarding-code {
            margin: 14px 0 4px;
            background: rgba(128,128,128,0.10);
            border: 1px solid rgba(128,128,128,0.12);
            border-radius: 8px;
            padding: 12px 14px;
            text-align: left;
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            line-height: 1.65;
            overflow-x: auto;
            white-space: pre;
        }

        .onboarding-code .kw { color: var(--vscode-symbolIcon-keywordForeground, #c586c0); }
        .onboarding-code .fn { color: var(--vscode-symbolIcon-functionForeground, #dcdcaa); }
        .onboarding-code .str { color: var(--vscode-symbolIcon-stringForeground, #ce9178); }
        .onboarding-code .cmt { opacity: 0.45; font-style: italic; }
        .onboarding-code .dim { opacity: 0.35; }

        .onboarding-info {
            margin: 4px 0 0;
            display: flex;
            flex-direction: column;
            gap: 4px;
            text-align: left;
        }

        .onboarding-info-row {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 10px 12px;
            border-radius: 8px;
        }

        .onboarding-info-icon {
            flex-shrink: 0;
            width: 22px;
            height: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            opacity: 0.7;
            margin-top: 1px;
        }

        .onboarding-info-text {
            flex: 1;
            min-width: 0;
        }

        .onboarding-info-title {
            font-size: 12.5px;
            font-weight: 600;
            color: var(--vscode-foreground);
            margin-bottom: 2px;
        }

        .onboarding-info-desc {
            font-size: 11.5px;
            opacity: 0.5;
            line-height: 1.45;
        }

        .onboarding-dots {
            display: flex;
            justify-content: center;
            gap: 6px;
            margin: 14px 0 12px;
        }

        .onboarding-dots .dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: rgba(255,255,255,0.18);
            transition: background 0.2s, transform 0.2s;
        }

        .onboarding-dots .dot.active {
            background: var(--vscode-button-background, #007acc);
            transform: scale(1.25);
        }

        .onboarding-nav {
            display: flex;
            justify-content: space-between;
            padding: 0 2px;
        }

        .onboarding-nav button {
            font-family: var(--vscode-font-family);
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            border-radius: 8px;
            padding: 6px 20px;
            transition: background 0.15s, opacity 0.15s;
        }

        .btn-back {
            background: rgba(255,255,255,0.08);
            border: none;
            color: var(--vscode-foreground);
            opacity: 0.7;
        }

        .btn-back:hover { opacity: 1; background: rgba(255,255,255,0.12); }
        .btn-back.hidden-vis { visibility: hidden; }

        .btn-next {
            background: var(--vscode-button-background, #007acc);
            border: none;
            color: var(--vscode-button-foreground, #fff);
        }

        .btn-next:hover {
            background: var(--vscode-button-hoverBackground, #0062a3);
        }

        /* --- Utility --- */
        .hidden { display: none !important; }

        code {
            font-family: var(--vscode-editor-font-family);
            font-size: 0.9em;
            background: rgba(128,128,128,0.15);
            padding: 1px 4px;
            border-radius: 3px;
        }

        pre {
            background: rgba(128,128,128,0.15);
            padding: 8px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 4px 0;
        }

        pre code {
            background: none;
            padding: 0;
        }

        /* --- Dropdown selectors --- */
        .dropdown-trigger {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 3px 8px;
            border-radius: 6px;
            border: none;
            background: none;
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
            font-size: 12px;
            cursor: pointer;
            opacity: 0.65;
            transition: opacity 0.15s, background 0.15s;
            white-space: nowrap;
        }

        .dropdown-trigger:hover {
            opacity: 1;
            background: rgba(255,255,255,0.06);
        }

        .dropdown-trigger-icon {
            font-size: 14px;
        }

        .dropdown-chevron {
            font-size: 10px;
            opacity: 0.5;
            margin-left: 1px;
        }

        .selector-dropdown {
            position: absolute;
            bottom: 100%;
            left: 14px;
            right: 14px;
            margin-bottom: 4px;
            background: var(--vscode-editorWidget-background, var(--vscode-dropdown-background, #252526));
            border: 1px solid var(--vscode-editorWidget-border, var(--vscode-dropdown-border, rgba(255,255,255,0.1)));
            border-radius: 10px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.35);
            max-height: 300px;
            overflow-y: auto;
            z-index: 150;
            padding: 4px;
            display: none;
            animation: slideUp 0.12s ease-out;
        }

        .selector-dropdown.visible {
            display: block;
        }

        .selector-search {
            display: block;
            width: calc(100% - 8px);
            margin: 4px;
            padding: 6px 8px;
            border: 1px solid var(--vscode-input-border, rgba(255,255,255,0.1));
            border-radius: 6px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-font-family);
            font-size: 12px;
            outline: none;
        }

        .selector-search::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }

        .selector-search:focus {
            border-color: var(--vscode-focusBorder, #007acc);
        }

        .selector-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 10px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            color: var(--vscode-foreground);
            transition: background 0.1s;
        }

        .selector-item:hover {
            background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.06));
        }

        .selector-item-icon {
            width: 20px;
            text-align: center;
            font-size: 14px;
            flex-shrink: 0;
        }

        .selector-item-label {
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .selector-item-check {
            font-size: 12px;
            opacity: 0;
            flex-shrink: 0;
            width: 16px;
            text-align: center;
        }

        .selector-item.selected .selector-item-check {
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="header">
        <span class="header-title">OpenClaw</span>
        <div class="header-actions">
            <button id="btn-new" title="New Session">&#x2715;</button>
            ${isSidebar ? '<button id="btn-popout" title="Open in Editor">&#x2197;</button>' : ''}
        </div>
    </div>

    <div class="main empty" id="main">
        <div class="messages" id="messages"></div>
        <div class="streaming-indicator" id="streaming">Thinking</div>

        <div class="input-wrapper" id="inputWrapper">
            <div class="file-dropdown" id="fileDropdown"></div>
            <div class="slash-dropdown" id="slashDropdown"></div>
            <div class="selector-dropdown" id="chatTypeDropdown"></div>
            <div class="selector-dropdown" id="modelDropdown"></div>
            <div class="input-card">
                <textarea id="input"
                          rows="1"
                          placeholder="Ask anything\u2026  / commands  @ files"
                          autofocus></textarea>
                <div class="slash-hint" id="slashHint"></div>
                <div class="attachments" id="attachments"></div>
                <div class="input-bottom-row">
                    <button class="dropdown-trigger" id="btn-chat-type" title="Chat type">
                        <span class="dropdown-trigger-icon" id="chatTypeIcon">&#x221E;</span>
                        <span id="chatTypeLabel">Chat</span>
                        <span class="dropdown-chevron">&#x25BE;</span>
                    </button>
                    <button class="dropdown-trigger" id="btn-model" title="Model">
                        <span id="modelLabel">codex</span>
                        <span class="dropdown-chevron">&#x25BE;</span>
                    </button>
                    <button class="btn-attach" id="btn-attach" title="Attach file">+</button>
                    <button class="btn-send" id="btn-send" title="Send (Ctrl+Enter)">&#x2191;</button>
                </div>
            </div>
        </div>

        <div class="onboarding" id="onboarding">
            <div class="onboarding-slides" id="onboarding-slides">

                <div class="onboarding-slide active" data-step="0">
                    <div class="onboarding-card">
                        <div class="onboarding-icon">&#x2601;</div>
                        <div class="onboarding-tasks">
                            <div class="onboarding-task">
                                <span class="onboarding-task-icon pending">&#x25CB;</span>
                                <div class="onboarding-task-body">
                                    <div class="onboarding-task-title">Navigate and edit files</div>
                                    <div class="onboarding-task-meta">openclaw/agent</div>
                                </div>
                            </div>
                            <div class="onboarding-task">
                                <span class="onboarding-task-icon check">&#x2713;</span>
                                <div class="onboarding-task-body">
                                    <div class="onboarding-task-title">Run commands and tests</div>
                                    <div class="onboarding-task-meta">openclaw/agent</div>
                                </div>
                                <span class="onboarding-task-diff"><span class="diff-add">+12</span><span class="diff-del">-3</span></span>
                            </div>
                            <div class="onboarding-task">
                                <span class="onboarding-task-icon check">&#x2713;</span>
                                <div class="onboarding-task-body">
                                    <div class="onboarding-task-title">Review and harden code</div>
                                    <div class="onboarding-task-meta">openclaw/harden</div>
                                </div>
                                <span class="onboarding-task-diff"><span class="diff-add">+48</span><span class="diff-del">-17</span></span>
                            </div>
                        </div>
                    </div>
                    <h3 style="margin-top:16px;">Chat with your codebase</h3>
                    <p class="onboarding-subtitle">Ask OpenClaw to do anything in your repo &mdash; it navigates, edits, and runs commands autonomously.</p>
                </div>

                <div class="onboarding-slide" data-step="1">
                    <div class="onboarding-card">
                        <div class="onboarding-icon">&#x1F6E1;</div>
                        <div class="onboarding-code"><span class="dim">$</span> <span class="fn">openclaw</span> <span class="str">harden</span>

<span class="cmt">&#x2713; Audit &#xB7; scanning dependencies&#x2026;</span>
<span class="cmt">&#x2713; Fix &#xB7; patching 3 vulnerabilities&#x2026;</span>
<span class="cmt">&#x2713; Deep &#xB7; multi-agent analysis&#x2026;</span>

<span class="kw">Summary:</span> <span class="str">3 fixed</span>, 0 remaining</div>
                    </div>
                    <h3 style="margin-top:16px;">Security-first hardening</h3>
                    <p class="onboarding-subtitle">Run multi-agent security audits, auto-fix vulnerabilities, and get a hardening summary with a single command.</p>
                </div>

                <div class="onboarding-slide" data-step="2">
                    <div class="onboarding-info">
                        <div class="onboarding-info-row">
                            <span class="onboarding-info-icon">&#x2699;</span>
                            <div class="onboarding-info-text">
                                <div class="onboarding-info-title">Choose your AI provider</div>
                                <div class="onboarding-info-desc">Configure your preferred model and provider in settings.</div>
                            </div>
                        </div>
                        <div class="onboarding-info-row">
                            <span class="onboarding-info-icon">&#x26A0;</span>
                            <div class="onboarding-info-text">
                                <div class="onboarding-info-title">Always review agent output</div>
                                <div class="onboarding-info-desc">OpenClaw can make mistakes. Review the code it writes and commands it runs.</div>
                            </div>
                        </div>
                        <div class="onboarding-info-row">
                            <span class="onboarding-info-icon">&#x26A1;</span>
                            <div class="onboarding-info-text">
                                <div class="onboarding-info-title">Powered by your AI account</div>
                                <div class="onboarding-info-desc">Uses your provider's API keys and rate limits.</div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            <div class="onboarding-dots" id="onboarding-dots">
                <span class="dot active"></span>
                <span class="dot"></span>
                <span class="dot"></span>
            </div>

            <div class="onboarding-nav">
                <button class="btn-back hidden-vis" id="btn-onboard-back">Back</button>
                <button class="btn-next" id="btn-onboard-next">Next</button>
            </div>
        </div>

        <div class="recommendations" id="recommendations">
            <div class="rec-tagline">Try a quick action</div>
            <div class="rec-grid" id="recGrid"></div>
        </div>
    </div>

    <script nonce="${nonce}">
        (function() {
            var vscode = acquireVsCodeApi();
            var body = document.body;
            var mainEl = document.getElementById('main');
            var messagesEl = document.getElementById('messages');
            var inputEl = document.getElementById('input');
            var btnSend = document.getElementById('btn-send');
            var btnNew = document.getElementById('btn-new');
            var btnPopout = document.getElementById('btn-popout');
            var btnAttach = document.getElementById('btn-attach');
            var streamingEl = document.getElementById('streaming');
            var slashDropdown = document.getElementById('slashDropdown');
            var slashHint = document.getElementById('slashHint');
            var recsEl = document.getElementById('recommendations');
            var recGrid = document.getElementById('recGrid');
            var attachmentsEl = document.getElementById('attachments');
            var btnChatType = document.getElementById('btn-chat-type');
            var chatTypeIconEl = document.getElementById('chatTypeIcon');
            var chatTypeLabelEl = document.getElementById('chatTypeLabel');
            var btnModelEl = document.getElementById('btn-model');
            var modelLabelEl = document.getElementById('modelLabel');
            var chatTypeDropdown = document.getElementById('chatTypeDropdown');
            var modelDropdown = document.getElementById('modelDropdown');

            var onboardingEl = document.getElementById('onboarding');
            var btnOnboardBack = document.getElementById('btn-onboard-back');
            var btnOnboardNext = document.getElementById('btn-onboard-next');

            var currentAssistantEl = null;
            var currentAssistantText = '';
            var isStreaming = false;
            var hasMessages = false;
            var onboardingStep = 0;
            var onboardingTotal = 3;

            var slashCommands = [];
            var activeSlashIndex = -1;
            var selectedCommand = null;

            var currentChatType = 'chat';
            var currentModel = 'codex';
            var availableModels = [];
            var chatTypes = [
                { id: 'chat', label: 'Chat', icon: '\\u221E' },
                { id: 'code', label: 'Code', icon: '{}' },
                { id: 'review', label: 'Review', icon: '\\u25CE' },
                { id: 'plan', label: 'Plan', icon: '\\u2261' }
            ];

            var fileDropdownEl = document.getElementById('fileDropdown');
            var atMentionActive = false;
            var atMentionStart = -1;
            var activeFileIndex = 0;
            var fileSearchDebounce = null;

            function setHasMessages(val) {
                hasMessages = val;
                if (val) {
                    body.classList.add('has-messages');
                    mainEl.classList.remove('empty');
                } else {
                    body.classList.remove('has-messages');
                    mainEl.classList.add('empty');
                }
            }

            /* ---------- Slash command dropdown ---------- */

            function getSlashQuery() {
                var val = inputEl.value;
                if (val.charAt(0) !== '/') return null;
                var spaceIdx = val.indexOf(' ');
                if (spaceIdx === -1) return val.substring(1);
                return null;
            }

            function filterSlashCommands(query) {
                var q = query.toLowerCase();
                return slashCommands.filter(function(c) {
                    return c.name.startsWith(q);
                });
            }

            function renderDropdown(commands) {
                if (commands.length === 0) {
                    hideDropdown();
                    return;
                }
                slashDropdown.innerHTML = '';
                commands.forEach(function(cmd, i) {
                    var el = document.createElement('div');
                    el.className = 'slash-item' + (i === activeSlashIndex ? ' active' : '');
                    el.innerHTML =
                        '<span class="slash-icon">' + cmd.icon + '</span>' +
                        '<div class="slash-info">' +
                            '<span class="slash-name">/' + cmd.name + '</span>' +
                            '<span class="slash-desc">' + cmd.description + '</span>' +
                        '</div>';
                    el.addEventListener('mousedown', function(e) {
                        e.preventDefault();
                        selectSlashCommand(cmd);
                    });
                    el.addEventListener('mouseenter', function() {
                        activeSlashIndex = i;
                        updateActiveItem();
                    });
                    slashDropdown.appendChild(el);
                });
                slashDropdown.classList.add('visible');
            }

            function updateActiveItem() {
                var items = slashDropdown.querySelectorAll('.slash-item');
                items.forEach(function(el, i) {
                    el.classList.toggle('active', i === activeSlashIndex);
                });
                if (activeSlashIndex >= 0 && items[activeSlashIndex]) {
                    items[activeSlashIndex].scrollIntoView({ block: 'nearest' });
                }
            }

            function selectSlashCommand(cmd) {
                selectedCommand = cmd;
                inputEl.value = '/' + cmd.name + ' ';
                inputEl.placeholder = cmd.placeholder || 'Ask anything...';
                slashHint.textContent = '/' + cmd.name + ' \u2014 ' + cmd.description;
                slashHint.classList.add('visible');
                hideDropdown();
                inputEl.focus();
                autoResizeInput();
            }

            function hideDropdown() {
                slashDropdown.classList.remove('visible');
                slashDropdown.innerHTML = '';
                activeSlashIndex = 0;
            }

            function checkSlashInput() {
                var query = getSlashQuery();
                if (query !== null) {
                    var filtered = filterSlashCommands(query);
                    activeSlashIndex = Math.min(activeSlashIndex, filtered.length - 1);
                    if (activeSlashIndex < 0) activeSlashIndex = 0;
                    renderDropdown(filtered);
                } else {
                    hideDropdown();
                    if (inputEl.value.charAt(0) !== '/') {
                        clearSlashState();
                    }
                }
            }

            function clearSlashState() {
                selectedCommand = null;
                slashHint.classList.remove('visible');
                slashHint.textContent = '';
                inputEl.placeholder = 'Ask anything\u2026  / commands  @ files';
            }

            /* ---------- Sending ---------- */

            function send() {
                if (atMentionActive) hideFileDropdown();
                var raw = inputEl.value.trim();
                if (!raw || isStreaming) return;

                var cmdMatch = raw.match(/^\\/([a-zA-Z]+)\\s*(.*)/);
                if (cmdMatch) {
                    var cmdName = cmdMatch[1].toLowerCase();
                    var userText = cmdMatch[2] || '';
                    var cmd = slashCommands.find(function(c) { return c.name === cmdName; });
                    if (cmd) {
                        addMessage('user', raw);
                        vscode.postMessage({ type: 'slashCommand', command: cmdName, text: userText });
                        inputEl.value = '';
                        autoResizeInput();
                        clearSlashState();
                        setStreaming(true);
                        return;
                    }
                }

                addMessage('user', raw);
                vscode.postMessage({ type: 'send', text: raw });
                inputEl.value = '';
                autoResizeInput();
                clearSlashState();
                setStreaming(true);
            }

            function addMessage(role, content) {
                setHasMessages(true);
                var el = document.createElement('div');
                el.className = 'message message-' + role;
                el.textContent = content;
                messagesEl.appendChild(el);
                scrollToBottom();
                return el;
            }

            function addToolBadge(title, status) {
                setHasMessages(true);
                var el = document.createElement('div');
                el.className = 'tool-badge' + (status === 'done' ? ' done' : '');
                el.textContent = title;
                messagesEl.appendChild(el);
                scrollToBottom();
            }

            function appendAssistantText(text) {
                setHasMessages(true);
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
                btnSend.disabled = false;
                if (val) {
                    btnSend.classList.add('streaming');
                    btnSend.innerHTML = '&#x25A0;';
                    btnSend.title = 'Stop';
                    btnSend.onclick = function() {
                        vscode.postMessage({ type: 'cancel' });
                        setStreaming(false);
                    };
                } else {
                    btnSend.classList.remove('streaming');
                    btnSend.innerHTML = '&#x2191;';
                    btnSend.title = 'Send (Ctrl+Enter)';
                    btnSend.onclick = send;
                }
            }

            function scrollToBottom() {
                messagesEl.scrollTop = messagesEl.scrollHeight;
            }

            function clearMessages() {
                messagesEl.innerHTML = '';
                currentAssistantEl = null;
                currentAssistantText = '';
                setHasMessages(false);
                setStreaming(false);
                clearSlashState();
                vscode.postMessage({ type: 'newSession' });
                vscode.postMessage({ type: 'requestRecommendations' });
            }

            function renderMarkdown(text) {
                var html = escapeHtml(text);
                html = html.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>');
                html = html.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
                html = html.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
                return html;
            }

            function escapeHtml(text) {
                var el = document.createElement('span');
                el.textContent = text;
                return el.innerHTML;
            }

            function autoResizeInput() {
                inputEl.style.height = 'auto';
                inputEl.style.height = Math.min(inputEl.scrollHeight, 150) + 'px';
            }

            /* ---------- Recommendations ---------- */

            function renderRecommendations(items) {
                recGrid.innerHTML = '';
                if (!items || items.length === 0) return;
                items.forEach(function(rec) {
                    var chip = document.createElement('button');
                    chip.className = 'rec-chip';
                    chip.innerHTML = '<span class="rec-chip-icon">' + rec.icon + '</span>' + escapeHtml(rec.label);
                    chip.addEventListener('click', function() {
                        inputEl.value = rec.command + ' ';
                        inputEl.focus();
                        autoResizeInput();
                        var cmd = slashCommands.find(function(c) { return '/' + c.name === rec.command; });
                        if (cmd) {
                            selectSlashCommand(cmd);
                        }
                    });
                    recGrid.appendChild(chip);
                });
            }

            /* ---------- Onboarding carousel ---------- */

            function updateOnboarding(step) {
                onboardingStep = step;
                var slides = onboardingEl.querySelectorAll('.onboarding-slide');
                var dots = onboardingEl.querySelectorAll('.dot');
                slides.forEach(function(s, i) {
                    s.classList.toggle('active', i === step);
                });
                dots.forEach(function(d, i) {
                    d.classList.toggle('active', i === step);
                });
                btnOnboardBack.classList.toggle('hidden-vis', step === 0);
                btnOnboardNext.textContent = step === onboardingTotal - 1 ? 'Get Started' : 'Next';
            }

            function completeOnboarding() {
                onboardingEl.style.display = 'none';
                vscode.postMessage({ type: 'onboardingComplete' });
            }

            if (btnOnboardBack) {
                btnOnboardBack.addEventListener('click', function() {
                    if (onboardingStep > 0) {
                        updateOnboarding(onboardingStep - 1);
                    }
                });
            }

            if (btnOnboardNext) {
                btnOnboardNext.addEventListener('click', function() {
                    if (onboardingStep < onboardingTotal - 1) {
                        updateOnboarding(onboardingStep + 1);
                    } else {
                        completeOnboarding();
                    }
                });
            }

            /* ---------- Attachments ---------- */

            function renderAttachments(files) {
                attachmentsEl.innerHTML = '';
                files.forEach(function(f, i) {
                    var pill = document.createElement('span');
                    pill.className = 'att-pill';
                    var name = document.createElement('span');
                    name.className = 'att-pill-name';
                    name.textContent = f.name;
                    name.title = f.path;
                    var rm = document.createElement('button');
                    rm.className = 'att-pill-remove';
                    rm.textContent = '\\u00d7';
                    rm.title = 'Remove';
                    rm.addEventListener('click', function() {
                        vscode.postMessage({ type: 'removeAttachment', index: i });
                    });
                    pill.appendChild(name);
                    pill.appendChild(rm);
                    attachmentsEl.appendChild(pill);
                });
            }

            /* ---------- Chat type & model dropdowns ---------- */

            function closeAllSelectors() {
                chatTypeDropdown.classList.remove('visible');
                modelDropdown.classList.remove('visible');
            }

            function renderChatTypeDropdown() {
                chatTypeDropdown.innerHTML = '';
                chatTypes.forEach(function(ct) {
                    var item = document.createElement('div');
                    item.className = 'selector-item' + (ct.id === currentChatType ? ' selected' : '');
                    item.innerHTML =
                        '<span class="selector-item-icon">' + ct.icon + '</span>' +
                        '<span class="selector-item-label">' + ct.label + '</span>' +
                        '<span class="selector-item-check">\\u2713</span>';
                    item.addEventListener('mousedown', function(e) {
                        e.preventDefault();
                        selectChatType(ct.id);
                    });
                    chatTypeDropdown.appendChild(item);
                });
                chatTypeDropdown.classList.add('visible');
            }

            function renderModelDropdown(filter) {
                modelDropdown.innerHTML = '';
                var searchInput = document.createElement('input');
                searchInput.className = 'selector-search';
                searchInput.type = 'text';
                searchInput.placeholder = 'Search models';
                if (filter) searchInput.value = filter;
                searchInput.addEventListener('input', function() {
                    renderModelList(modelDropdown, searchInput.value.toLowerCase());
                });
                searchInput.addEventListener('mousedown', function(e) {
                    e.stopPropagation();
                });
                modelDropdown.appendChild(searchInput);
                renderModelList(modelDropdown, (filter || '').toLowerCase());
                modelDropdown.classList.add('visible');
                setTimeout(function() { searchInput.focus(); }, 0);
            }

            function renderModelList(container, query) {
                var existing = container.querySelectorAll('.selector-item');
                existing.forEach(function(el) { el.remove(); });

                var models = availableModels;
                if (query) {
                    models = models.filter(function(m) {
                        return m.toLowerCase().indexOf(query) !== -1;
                    });
                }
                models.forEach(function(m) {
                    var item = document.createElement('div');
                    item.className = 'selector-item' + (m === currentModel ? ' selected' : '');
                    item.innerHTML =
                        '<span class="selector-item-label">' + escapeHtml(m) + '</span>' +
                        '<span class="selector-item-check">\\u2713</span>';
                    item.addEventListener('mousedown', function(e) {
                        e.preventDefault();
                        selectModel(m);
                    });
                    container.appendChild(item);
                });
            }

            function selectChatType(id) {
                currentChatType = id;
                var ct = chatTypes.find(function(c) { return c.id === id; });
                if (ct) {
                    chatTypeIconEl.textContent = ct.icon;
                    chatTypeLabelEl.textContent = ct.label;
                }
                closeAllSelectors();
                vscode.postMessage({ type: 'setChatType', chatType: id });
            }

            function selectModel(model) {
                currentModel = model;
                modelLabelEl.textContent = model;
                closeAllSelectors();
                vscode.postMessage({ type: 'setModel', model: model });
            }

            btnChatType.addEventListener('click', function(e) {
                e.stopPropagation();
                var wasVisible = chatTypeDropdown.classList.contains('visible');
                closeAllSelectors();
                if (!wasVisible) renderChatTypeDropdown();
            });

            btnModelEl.addEventListener('click', function(e) {
                e.stopPropagation();
                var wasVisible = modelDropdown.classList.contains('visible');
                closeAllSelectors();
                if (!wasVisible) renderModelDropdown();
            });

            document.addEventListener('click', function(e) {
                if (!chatTypeDropdown.contains(e.target) && !btnChatType.contains(e.target) &&
                    !modelDropdown.contains(e.target) && !btnModelEl.contains(e.target)) {
                    closeAllSelectors();
                }
            });

            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    var anyOpen = chatTypeDropdown.classList.contains('visible') ||
                                  modelDropdown.classList.contains('visible');
                    if (anyOpen) {
                        closeAllSelectors();
                        e.stopPropagation();
                    }
                }
            });

            /* ---------- @-mention file picker ---------- */

            function checkAtMention() {
                var cursorPos = inputEl.selectionStart;
                var text = inputEl.value;
                var atPos = -1;

                for (var i = cursorPos - 1; i >= 0; i--) {
                    if (text[i] === '@') {
                        if (i === 0 || /\\s/.test(text[i - 1])) {
                            atPos = i;
                        }
                        break;
                    }
                    if (/\\s/.test(text[i])) break;
                }

                if (atPos >= 0) {
                    var query = text.substring(atPos + 1, cursorPos);
                    atMentionActive = true;
                    atMentionStart = atPos;
                    activeFileIndex = 0;
                    if (fileSearchDebounce) clearTimeout(fileSearchDebounce);
                    fileSearchDebounce = setTimeout(function() {
                        vscode.postMessage({ type: 'fileSearch', query: query });
                    }, 120);
                } else {
                    if (atMentionActive) hideFileDropdown();
                }
            }

            function hideFileDropdown() {
                atMentionActive = false;
                atMentionStart = -1;
                activeFileIndex = 0;
                fileDropdownEl.classList.remove('visible');
                fileDropdownEl.innerHTML = '';
                if (fileSearchDebounce) { clearTimeout(fileSearchDebounce); fileSearchDebounce = null; }
            }

            function renderFileResults(files) {
                if (!files || files.length === 0) {
                    if (atMentionActive) fileDropdownEl.classList.remove('visible');
                    return;
                }

                fileDropdownEl.innerHTML = '';
                files.forEach(function(f, i) {
                    var item = document.createElement('div');
                    item.className = 'file-item' + (i === activeFileIndex ? ' active' : '');
                    item.dataset.path = f.path;
                    item.dataset.name = f.name;

                    var nameSpan = document.createElement('span');
                    nameSpan.className = 'file-item-name';
                    nameSpan.textContent = f.name;

                    var pathSpan = document.createElement('span');
                    pathSpan.className = 'file-item-path';
                    pathSpan.textContent = f.relativePath;

                    item.appendChild(nameSpan);
                    item.appendChild(pathSpan);

                    item.addEventListener('mousedown', function(e) {
                        e.preventDefault();
                        selectFileFromDropdown(f.path, f.name);
                    });
                    item.addEventListener('mouseenter', function() {
                        activeFileIndex = i;
                        updateFileActiveItem();
                    });

                    fileDropdownEl.appendChild(item);
                });
                fileDropdownEl.classList.add('visible');
            }

            function updateFileActiveItem() {
                var items = fileDropdownEl.querySelectorAll('.file-item');
                items.forEach(function(el, i) {
                    el.classList.toggle('active', i === activeFileIndex);
                });
                if (activeFileIndex >= 0 && items[activeFileIndex]) {
                    items[activeFileIndex].scrollIntoView({ block: 'nearest' });
                }
            }

            function selectFileFromDropdown(filePath, fileName) {
                var text = inputEl.value;
                var cursorPos = inputEl.selectionStart;
                var before = text.substring(0, atMentionStart);
                var after = text.substring(cursorPos);
                inputEl.value = before + after;
                inputEl.selectionStart = inputEl.selectionEnd = before.length;

                vscode.postMessage({ type: 'attachFile', filePath: filePath });
                hideFileDropdown();
                inputEl.focus();
                autoResizeInput();
            }

            /* ---------- Keyboard handling ---------- */

            inputEl.addEventListener('keydown', function(e) {
                var fileVisible = fileDropdownEl.classList.contains('visible');

                if (fileVisible && atMentionActive) {
                    var fileItems = fileDropdownEl.querySelectorAll('.file-item');
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        activeFileIndex = Math.min(activeFileIndex + 1, fileItems.length - 1);
                        updateFileActiveItem();
                        return;
                    }
                    if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        activeFileIndex = Math.max(activeFileIndex - 1, 0);
                        updateFileActiveItem();
                        return;
                    }
                    if (e.key === 'Enter' || e.key === 'Tab') {
                        if (fileItems.length > 0 && activeFileIndex >= 0 && activeFileIndex < fileItems.length) {
                            e.preventDefault();
                            var sel = fileItems[activeFileIndex];
                            selectFileFromDropdown(sel.dataset.path, sel.dataset.name);
                            return;
                        }
                    }
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        hideFileDropdown();
                        return;
                    }
                }

                var dropdownVisible = slashDropdown.classList.contains('visible');

                if (dropdownVisible) {
                    var items = slashDropdown.querySelectorAll('.slash-item');
                    var filtered = [];
                    var query = getSlashQuery();
                    if (query !== null) {
                        filtered = filterSlashCommands(query);
                    }

                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        activeSlashIndex = Math.min(activeSlashIndex + 1, filtered.length - 1);
                        updateActiveItem();
                        return;
                    }
                    if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        activeSlashIndex = Math.max(activeSlashIndex - 1, 0);
                        updateActiveItem();
                        return;
                    }
                    if (e.key === 'Tab' || e.key === 'Enter') {
                        if (filtered.length > 0 && activeSlashIndex >= 0 && activeSlashIndex < filtered.length) {
                            e.preventDefault();
                            selectSlashCommand(filtered[activeSlashIndex]);
                            return;
                        }
                    }
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        hideDropdown();
                        return;
                    }
                }

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
                autoResizeInput();
                checkSlashInput();
                checkAtMention();

                if (inputEl.value === '' || inputEl.value.charAt(0) !== '/') {
                    clearSlashState();
                }
            });

            btnSend.addEventListener('click', send);
            btnNew.addEventListener('click', clearMessages);

            if (btnPopout) {
                btnPopout.addEventListener('click', function() {
                    vscode.postMessage({ type: 'popOut' });
                });
            }

            if (btnAttach) {
                btnAttach.addEventListener('click', function() {
                    vscode.postMessage({ type: 'attach' });
                });
            }

            inputEl.addEventListener('click', checkAtMention);

            inputEl.addEventListener('blur', function() {
                setTimeout(function() {
                    if (atMentionActive) hideFileDropdown();
                }, 150);
            });

            /* ---------- Messages from extension ---------- */

            window.addEventListener('message', function(event) {
                var msg = event.data;
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
                    case 'attachments':
                        renderAttachments(msg.files || []);
                        break;
                    case 'fileSearchResults':
                        if (atMentionActive) {
                            renderFileResults(msg.files || []);
                        }
                        break;
                    case 'slashCommands':
                        slashCommands = msg.commands || [];
                        break;
                    case 'recommendations':
                        renderRecommendations(msg.items || []);
                        break;
                    case 'models':
                        availableModels = msg.models || [];
                        break;
                    case 'config':
                        if (msg.chatType) selectChatType(msg.chatType);
                        if (msg.model) {
                            currentModel = msg.model;
                            modelLabelEl.textContent = msg.model;
                        }
                        break;
                    case 'onboardingDone':
                        if (onboardingEl) {
                            onboardingEl.style.display = 'none';
                        }
                        break;
                    case 'state':
                        messagesEl.innerHTML = '';
                        if (msg.messages && msg.messages.length > 0) {
                            msg.messages.forEach(function(m) {
                                addMessage(m.role, m.content);
                            });
                        } else {
                            setHasMessages(false);
                        }
                        break;
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
