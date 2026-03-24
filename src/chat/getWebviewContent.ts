import * as vscode from 'vscode';
import { SLASH_COMMANDS } from './slashCommands';

export interface SlashCommandEntry {
    name: string;
    description: string;
    icon: string;
    placeholder: string;
}

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
          content="default-src 'none'; img-src ${cspSource}; font-src ${cspSource}; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
    <style nonce="${nonce}">
        :root {
            --openclaw-brand-red: #F80615;
            --openclaw-brand-red-hover: #CF0511;
            --openclaw-brand-red-soft: rgba(248, 6, 21, 0.12);
            --openclaw-brand-red-strong: rgba(248, 6, 21, 0.22);
            --openclaw-brand-red-border: rgba(248, 6, 21, 0.32);
        }

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
            grid-template-rows: auto 1fr;
        }

        .header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 12px;
            border-bottom: 1px solid var(--openclaw-brand-red-border);
            background:
                linear-gradient(135deg, rgba(248, 6, 21, 0.16), transparent 58%),
                var(--vscode-sideBar-background, var(--vscode-editor-background));
        }

        .header-title {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--openclaw-brand-red);
            opacity: 0.94;
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
            background: var(--openclaw-brand-red-soft);
            border-color: var(--openclaw-brand-red-border);
        }

        .workspace {
            min-height: 0;
            display: flex;
            flex-direction: column;
        }

        .pane-grid {
            flex: 1;
            min-height: 0;
            padding: 10px 12px 12px;
            display: grid;
            grid-template-columns: repeat(var(--grid-cols, 1), minmax(280px, 1fr));
            grid-template-rows: repeat(var(--grid-rows, 1), 1fr);
            gap: 10px;
            overflow: auto;
        }

        .pane {
            min-height: 0;
            display: grid;
            grid-template-rows: auto minmax(160px, 1fr) auto;
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background:
                linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01)),
                var(--vscode-editor-background);
            overflow: hidden;
        }

        .pane.active {
            border-color: var(--openclaw-brand-red);
            box-shadow: inset 0 0 0 1px var(--openclaw-brand-red-strong);
        }

        .pane.collapsed {
            grid-template-rows: auto;
            min-height: 0;
            cursor: pointer;
            opacity: 0.75;
            transition: opacity 0.15s ease;
        }

        .pane.collapsed:hover {
            opacity: 1;
        }

        .pane.collapsed .pane-body,
        .pane.collapsed .composer-shell {
            display: none;
        }

        .pane.collapsed .pane-header {
            border-bottom: none;
            padding: 8px 10px;
        }

        .pane-collapse-btn {
            background: none;
            border: none;
            color: var(--vscode-descriptionForeground, #888);
            cursor: pointer;
            font-size: 11px;
            padding: 2px 6px;
            border-radius: 4px;
            opacity: 0.7;
            transition: opacity 0.15s ease;
        }

        .pane-collapse-btn:hover {
            opacity: 1;
            background: rgba(255, 255, 255, 0.06);
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
            margin-top: 4px;
            display: flex;
            gap: 6px;
            align-items: center;
            flex-wrap: wrap;
            font-size: 11px;
            opacity: 0.75;
        }

        .pane-pill {
            display: inline-flex;
            align-items: center;
            padding: 2px 7px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.06);
        }

        .pane-status {
            font-weight: 600;
            border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .pane-status.complete {
            color: var(--vscode-testing-iconPassed, var(--vscode-textLink-foreground, var(--vscode-foreground)));
        }

        .pane-status.running {
            color: var(--vscode-textLink-foreground, var(--vscode-foreground));
        }

        .pane-status.error,
        .pane-status.cancelled {
            color: var(--vscode-errorForeground, #f48771);
        }

        .pane-source {
            font-weight: 600;
            letter-spacing: 0.03em;
            border: 1px solid rgba(255, 255, 255, 0.10);
        }

        .pane-source.api { color: var(--vscode-textLink-foreground, #3794ff); }
        .pane-source.oauth { color: #c678dd; }
        .pane-source.gateway { color: #e5c07b; }
        .pane-source.local { color: #98c379; }

        .pane-context {
            display: inline-flex;
            align-items: center;
            gap: 5px;
        }

        .context-bar {
            width: 48px;
            height: 5px;
            border-radius: 3px;
            background: rgba(255, 255, 255, 0.08);
            overflow: hidden;
        }

        .context-bar-fill {
            height: 100%;
            border-radius: 3px;
            background: var(--openclaw-brand-red);
            transition: width 0.3s ease;
        }

        .context-bar-fill.warn {
            background: #e5c07b;
        }

        .context-bar-fill.critical {
            background: var(--vscode-errorForeground, #f48771);
        }

        .context-label {
            white-space: nowrap;
        }

        .composer-token-est {
            font-size: 10px;
            opacity: 0.5;
            white-space: nowrap;
            transition: opacity 0.15s;
        }

        .composer-token-est.has-value {
            opacity: 0.68;
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
            min-height: 0;
            overflow-y: auto;
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
            border-left: 2px solid var(--openclaw-brand-red);
            opacity: 0.78;
        }

        .message-assistant {
            color: var(--vscode-foreground);
        }

        .file-link {
            color: var(--vscode-textLink-foreground, #3794ff);
            cursor: pointer;
            text-decoration: none;
            border-bottom: 1px solid transparent;
        }
        .file-link:hover {
            border-bottom-color: var(--vscode-textLink-foreground, #3794ff);
        }
        .file-link:focus-visible {
            outline: 1px solid var(--vscode-focusBorder, #007acc);
            outline-offset: 2px;
            border-bottom-color: var(--vscode-textLink-foreground, #3794ff);
        }

        .message-pending::after {
            content: '';
            display: inline-block;
            width: 6px;
            height: 14px;
            margin-left: 2px;
            background: var(--openclaw-brand-red);
            border-radius: 1px;
            vertical-align: text-bottom;
            animation: blink 0.8s step-end infinite;
        }

        @keyframes blink {
            50% { opacity: 0; }
        }

        .message-error {
            color: var(--vscode-errorForeground, #f48771);
            font-size: 12px;
        }

        .message-tool {
            align-self: stretch;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.03);
            overflow: hidden;
            margin: 2px 0;
        }

        .message-tool summary {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 6px 10px;
            cursor: pointer;
            list-style: none;
            font-size: 11px;
            user-select: none;
            transition: background 0.15s;
        }

        .message-tool summary:hover {
            background: rgba(255, 255, 255, 0.04);
        }

        .message-tool summary::-webkit-details-marker {
            display: none;
        }

        .message-tool-summary {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            min-width: 0;
        }

        .message-tool-chevron {
            display: inline-block;
            width: 12px;
            height: 12px;
            opacity: 0.6;
            transition: transform 0.15s ease;
            flex-shrink: 0;
        }

        .message-tool[open] .message-tool-chevron {
            transform: rotate(90deg);
        }

        .message-tool-icon {
            opacity: 0.65;
            font-size: 12px;
        }

        .message-tool-label {
            opacity: 0.85;
        }

        .message-tool-count {
            opacity: 0.5;
            font-size: 10px;
        }

        .message-tool-status {
            opacity: 0.5;
            text-transform: lowercase;
            font-size: 10px;
        }

        .message-tool-body {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 0 10px 8px;
        }

        .message-tool-entry {
            padding-top: 6px;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .message-tool-entry:first-child {
            padding-top: 0;
            border-top: 0;
        }

        .message-tool-entry-header {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 3px;
            font-size: 11px;
        }

        .message-tool-entry-title {
            font-weight: 600;
            word-break: break-word;
            opacity: 0.85;
        }

        .message-tool-entry-status {
            opacity: 0.5;
            text-transform: lowercase;
            white-space: nowrap;
            font-size: 10px;
        }

        .message-tool-details {
            margin: 0;
            padding: 6px 8px;
            border-radius: 6px;
            background: rgba(0, 0, 0, 0.18);
            font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
            font-size: 11px;
            line-height: 1.45;
            white-space: pre-wrap;
            word-break: break-word;
            max-height: 200px;
            overflow-y: auto;
        }

        .composer-shell {
            position: relative;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            background:
                linear-gradient(180deg, rgba(0, 0, 0, 0.04), transparent),
                var(--vscode-sideBar-background, var(--vscode-editor-background));
        }

        .file-dropdown,
        .slash-dropdown,
        .selector-dropdown {
            position: absolute;
            left: 10px;
            right: 10px;
            bottom: calc(100% - 2px);
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
            margin: 10px;
            border-radius: 16px;
            border: 1px solid var(--vscode-input-border, rgba(128, 128, 128, 0.3));
            background: var(--vscode-input-background);
            overflow: hidden;
            transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
        }

        .composer-card:focus-within {
            border-color: var(--openclaw-brand-red);
        }

        .composer-card.drag-active {
            border-color: var(--openclaw-brand-red);
            box-shadow: 0 0 0 1px var(--openclaw-brand-red-strong);
        }

        .drop-overlay {
            position: absolute;
            inset: 0;
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            background: var(--openclaw-brand-red-soft);
            backdrop-filter: blur(2px);
            border: 2px dashed var(--openclaw-brand-red);
            border-radius: 14px;
            z-index: 2;
            pointer-events: none;
        }

        .drop-overlay-icon {
            font-size: 24px;
            line-height: 1;
        }

        .drop-overlay-label {
            font-size: 12px;
            font-weight: 600;
            color: var(--openclaw-brand-red);
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

        .composer-recommendations {
            padding: 0 10px 4px;
        }

        .composer-recommendations.hidden {
            display: none;
        }

        .rec-toggle {
            border: none;
            background: transparent;
            cursor: pointer;
            font-size: 11px;
            color: var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.34));
            padding: 2px 4px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            transition: color 0.15s;
        }

        .rec-toggle:hover {
            color: var(--vscode-foreground, rgba(255, 255, 255, 0.6));
        }

        .rec-toggle .rec-caret {
            font-size: 8px;
            transition: transform 0.15s;
        }

        .rec-toggle.open .rec-caret {
            transform: rotate(90deg);
        }

        .att-pill {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            max-width: 240px;
            border-radius: 8px;
            padding: 4px 8px 4px 6px;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.1);
            font-size: 11px;
            transition: background 0.15s, border-color 0.15s;
        }

        .att-pill:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.16);
        }

        .att-pill-icon {
            font-size: 12px;
            flex-shrink: 0;
            opacity: 0.8;
        }

        .att-pill.att-image {
            border-color: var(--openclaw-brand-red-border);
        }

        .att-pill.att-image .att-pill-icon {
            color: var(--openclaw-brand-red);
        }

        .att-pill-thumb {
            width: 28px;
            height: 28px;
            border-radius: 4px;
            object-fit: cover;
            flex-shrink: 0;
        }

        .att-pill.att-image {
            padding-left: 3px;
        }

        .att-pill-name {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .att-pill-remove {
            border: none;
            background: none;
            color: inherit;
            cursor: pointer;
            opacity: 0.45;
            font-size: 13px;
            line-height: 1;
            padding: 0 1px;
            transition: opacity 0.15s;
        }

        .att-pill-remove:hover {
            opacity: 1;
        }

        .att-count {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.1);
            font-size: 11px;
            opacity: 0.72;
        }

        .composer-footer {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 0 8px 8px;
        }

        .composer-status {
            font-size: 11px;
            opacity: 0.58;
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
            background: var(--openclaw-brand-red);
            color: var(--vscode-button-foreground, #fff);
        }

        .btn-send:hover {
            background: var(--openclaw-brand-red-hover);
        }

        .btn-send.streaming {
            background: var(--vscode-errorForeground, #f48771);
        }

        .queued-indicator {
            font-size: 11px;
            color: var(--vscode-descriptionForeground, #888);
            margin-right: 6px;
            font-style: italic;
        }

        .selector-search {
            width: calc(100% - 8px);
            margin: 4px;
            border: 1px solid var(--vscode-input-border, rgba(128, 128, 128, 0.3));
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

        .settings-dropdown {
            position: absolute;
            left: 10px;
            right: 10px;
            bottom: calc(100% - 2px);
            display: none;
            max-height: 320px;
            overflow: auto;
            border-radius: 12px;
            border: 1px solid var(--vscode-editorWidget-border, rgba(255, 255, 255, 0.08));
            background: var(--vscode-editorWidget-background, var(--vscode-dropdown-background, #252526));
            box-shadow: 0 10px 28px rgba(0, 0, 0, 0.32);
            padding: 10px;
            z-index: 10;
        }

        .settings-dropdown.visible {
            display: block;
        }

        .settings-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 6px 4px;
        }

        .settings-row + .settings-row {
            border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .settings-label {
            font-size: 11px;
            font-weight: 600;
            opacity: 0.85;
            white-space: nowrap;
        }

        .settings-control select,
        .settings-control input[type="range"] {
            font: inherit;
            font-size: 11px;
            height: 24px;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            background: rgba(255, 255, 255, 0.06);
            color: inherit;
            cursor: pointer;
            padding: 0 6px;
        }

        .settings-control input[type="range"] {
            width: 80px;
            padding: 0;
        }

        .settings-value {
            font-size: 10px;
            opacity: 0.6;
            min-width: 28px;
            text-align: right;
        }

        .recommendations {
            display: none;
            flex-direction: column;
            gap: 0;
            padding: 2px 0 0;
        }

        .recommendations.open {
            display: flex;
        }

        .rec-chip {
            border: none;
            background: transparent;
            border-radius: 3px;
            padding: 2px 6px;
            cursor: pointer;
            font-size: 11px;
            text-align: left;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.38));
            transition: color 0.12s, background 0.12s;
        }

        .rec-chip:hover {
            color: var(--vscode-foreground, rgba(255, 255, 255, 0.7));
            background: rgba(255, 255, 255, 0.05);
        }

        .empty-detail {
            max-width: 280px;
        }

        .openclaw-crash {
            padding: 16px;
            margin: 10px;
            border-radius: 10px;
            background: rgba(244, 135, 113, 0.08);
            border: 1px solid var(--vscode-errorForeground, #f48771);
            font-size: 12px;
            line-height: 1.6;
        }

        .openclaw-crash summary {
            cursor: pointer;
            font-weight: 600;
            color: var(--vscode-errorForeground, #f48771);
            list-style: none;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .openclaw-crash summary::before {
            content: '\\26A0';
        }

        .openclaw-crash pre {
            margin-top: 8px;
            padding: 8px;
            border-radius: 6px;
            background: rgba(0, 0, 0, 0.2);
            font-size: 11px;
            white-space: pre-wrap;
            word-break: break-word;
            max-height: 200px;
            overflow-y: auto;
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

        .dimension-select {
            height: 24px;
            min-width: 56px;
            padding: 0 6px;
            font-size: 11px;
            border-radius: 6px;
            border: 1px solid var(--openclaw-brand-red-border);
            background: rgba(248, 6, 21, 0.08);
            color: inherit;
            cursor: pointer;
        }

        .dimension-select:hover {
            background: rgba(248, 6, 21, 0.14);
            border-color: rgba(248, 6, 21, 0.42);
        }

        .dimension-select:focus-visible {
            outline: 1px solid var(--openclaw-brand-red);
            outline-offset: 1px;
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
                <div class="header-subtitle">Each panel keeps its own composer and completion state</div>
            </div>
            <div class="header-actions">
                <select class="dimension-select" id="dimensionSelect" title="Grid dimension">
                    <option value="1x1">1x1</option>
                </select>
                <button class="icon-btn" id="btn-flip" title="Flip layout orientation">&#x21C4;</button>
                <button class="icon-btn" id="btn-new" title="New thread">+</button>
                <button class="icon-btn" id="btn-split" title="Split from active thread">&#x2398;</button>
                ${isSidebar ? '<button class="icon-btn" id="btn-popout" title="Open in editor">&#x2197;</button>' : ''}
            </div>
        </div>

        <div class="workspace">
            <div class="pane-grid" id="paneGrid"></div>
        </div>
    </div>

    <script nonce="${nonce}">
        (function() {
            var _crashLog = [];

            function _showCrash(label, err) {
                var msg = (err && err.stack) ? err.stack : String(err);
                _crashLog.push({ label: label, msg: msg, ts: new Date().toISOString() });
                console.error('[OpenClaw] ' + label + ':', err);
                var target = document.getElementById('paneGrid') || document.body;
                var box = document.createElement('details');
                box.className = 'openclaw-crash';
                box.open = true;
                box.innerHTML =
                    '<summary>' + escapeHtml(label) + '</summary>' +
                    '<pre>' + linkifyFilePaths(escapeHtml(msg)) + '</pre>' +
                    '<div style="margin-top:6px;opacity:0.6;font-size:11px">' +
                        'State: threads=' + (typeof state !== 'undefined' ? (state.threads || []).length : '?') +
                        ', dim=' + (typeof currentDimension !== 'undefined' ? currentDimension : '?') +
                    '</div>';
                target.appendChild(box);
            }

            window.addEventListener('error', function(event) {
                _showCrash('Uncaught error: ' + (event.message || 'unknown'), event.error || event.message);
            });

            window.addEventListener('unhandledrejection', function(event) {
                _showCrash('Unhandled promise rejection', event.reason);
            });

            var vscode = acquireVsCodeApi();
            var paneGrid = document.getElementById('paneGrid');
            var dimensionSelect = document.getElementById('dimensionSelect');
            var btnNew = document.getElementById('btn-new');
            var btnFlip = document.getElementById('btn-flip');
            var btnSplit = document.getElementById('btn-split');
            var btnPopout = document.getElementById('btn-popout');

            var slashCommands = ${JSON.stringify(SLASH_COMMANDS.map(c => ({
                name: c.name,
                description: c.description,
                icon: c.icon,
                placeholder: c.placeholder,
            })))};
            var availableModels = [];
            var recommendations = [];
            var drafts = Object.create(null);
            var messageQueue = Object.create(null);
            var currentDimension = '1x1';

            var chatTypes = [
                { id: 'chat', label: 'Chat' },
                { id: 'code', label: 'Code' },
                { id: 'review', label: 'Review' },
                { id: 'plan', label: 'Plan' }
            ];

            var composerUi = {
                threadId: '',
                dropdown: '',
                activeSlashIndex: 0,
                activeFileIndex: 0,
                atMentionThreadId: '',
                atMentionStart: -1,
                fileSearchDebounce: null,
                fileResults: [],
                modelQuery: '',
                dragThreadId: '',
                settingsThinking: 'medium',
                settingsTemp: 0.7,
                settingsMaxTokens: 0
            };

            var state = {
                activeThreadId: '',
                visibleThreadIds: [],
                threads: []
            };

            var collapseCompleted = true;
            var collapseOverrides = Object.create(null); // threadId -> true/false manual override

            function isValidDimension(value) {
                return /^\\d+x\\d+$/.test(value || '');
            }

            function getThreadById(threadId) {
                for (var i = 0; i < state.threads.length; i++) {
                    if (state.threads[i].id === threadId) {
                        return state.threads[i];
                    }
                }
                return null;
            }

            function getActiveThread() {
                return getThreadById(state.activeThreadId) || state.threads[0] || null;
            }

            function getDraft(threadId) {
                return drafts[threadId] || '';
            }

            function setDraft(threadId, value) {
                drafts[threadId] = value;
            }

            function escapeHtml(text) {
                var el = document.createElement('span');
                el.textContent = text || '';
                return el.innerHTML;
            }

            function escapeAttr(text) {
                return escapeHtml(text).replace(/"/g, '&quot;');
            }

            function linkifyFilePaths(html) {
                if (!html || (html.indexOf('/') === -1 && html.indexOf('\\\\') === -1)) {
                    return html || '';
                }

                var template = document.createElement('template');
                template.innerHTML = html;

                var filePathRegex = /((?:[a-zA-Z]:[\\\\/]|\\/|\\.{1,2}[\\\\/])?(?:[\\w .@()-]+[\\\\/])+[\\w .@()-]+\\.[a-zA-Z0-9]{1,10}(?::(\\d+)(?::\\d+)?)?)/g;
                var walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
                var textNodes = [];

                while (walker.nextNode()) {
                    var textNode = walker.currentNode;
                    var parent = textNode.parentElement;
                    var value = textNode.nodeValue || '';
                    if (!parent || !value) {
                        continue;
                    }
                    if (parent.closest('a, .file-link, script, style')) {
                        continue;
                    }
                    if (value.indexOf('/') === -1 && value.indexOf('\\\\') === -1) {
                        continue;
                    }
                    textNodes.push(textNode);
                }

                textNodes.forEach(function(textNode) {
                    var text = textNode.nodeValue || '';
                    filePathRegex.lastIndex = 0;
                    if (!filePathRegex.test(text)) {
                        return;
                    }

                    var frag = document.createDocumentFragment();
                    var lastIndex = 0;
                    var match;
                    filePathRegex.lastIndex = 0;

                    while ((match = filePathRegex.exec(text))) {
                        var fullText = match[1];
                        var lineNum = match[2] || '';
                        var filePath = lineNum
                            ? fullText.slice(0, fullText.lastIndexOf(':' + lineNum))
                            : fullText;

                        if (match.index > lastIndex) {
                            frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
                        }

                        var link = document.createElement('span');
                        link.className = 'file-link';
                        link.setAttribute('data-file-path', filePath);
                        if (lineNum) {
                            link.setAttribute('data-line', lineNum);
                        }
                        link.setAttribute('role', 'link');
                        link.setAttribute('tabindex', '0');
                        link.textContent = fullText;
                        frag.appendChild(link);

                        lastIndex = match.index + fullText.length;
                    }

                    if (lastIndex < text.length) {
                        frag.appendChild(document.createTextNode(text.slice(lastIndex)));
                    }

                    if (textNode.parentNode) {
                        textNode.parentNode.replaceChild(frag, textNode);
                    }
                });

                return template.innerHTML;
            }

            function autoResizeTextarea(textarea) {
                if (!textarea) {
                    return;
                }
                textarea.style.height = 'auto';
                textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';
            }

            var userScrolledUp = Object.create(null);

            function isNearBottom(el) {
                if (!el) { return true; }
                return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }

            function scrollPaneToBottom(paneBody, threadId) {
                if (paneBody && (!threadId || !userScrolledUp[threadId])) {
                    paneBody.scrollTop = paneBody.scrollHeight;
                }
            }

            function getThreadStatusLabel(thread) {
                switch (thread.status) {
                    case 'running':
                        return 'Running';
                    case 'complete':
                        return 'Complete';
                    case 'error':
                        return 'Error';
                    case 'cancelled':
                        return 'Stopped';
                    default:
                        return 'Ready';
                }
            }

            function getThreadStatusDetail(thread) {
                switch (thread.status) {
                    case 'running':
                        return 'Generating response';
                    case 'complete':
                        return 'Response complete';
                    case 'error':
                        return 'Last run returned an error';
                    case 'cancelled':
                        return 'Generation stopped';
                    default:
                        return 'Enter sends, Shift+Enter new line';
                }
            }

            function formatTokenCount(n) {
                if (n >= 1000000) { return (n / 1000000).toFixed(1) + 'M'; }
                if (n >= 1000) { return (n / 1000).toFixed(1) + 'k'; }
                return String(n);
            }

            function formatContextGauge(used, max) {
                var pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
                var level = pct >= 90 ? 'critical' : pct >= 70 ? 'warn' : '';
                return {
                    pct: pct,
                    level: level,
                    label: formatTokenCount(used) + ' / ' + formatTokenCount(max)
                };
            }

            function estimateTokens(text) {
                if (!text) { return 0; }
                return Math.ceil(text.length / 4);
            }

            function getThreadSpaceUsage(thread) {
                if (!thread) {
                    return 0;
                }

                var estimatedTokens = 0;
                var messages = Array.isArray(thread.messages) ? thread.messages : [];
                for (var i = 0; i < messages.length; i++) {
                    var message = messages[i];
                    if (!message || message.role === 'tool') {
                        continue;
                    }
                    estimatedTokens += estimateTokens(message.content || '');
                }

                estimatedTokens += estimateTokens(thread.pendingAssistantText || '');
                return Math.max(thread.contextTokens || 0, estimatedTokens);
            }

            function updatePaneContextUsage(paneEl, thread) {
                if (!paneEl || !thread) {
                    return;
                }

                var ctxInfo = formatContextGauge(getThreadSpaceUsage(thread), thread.contextMax || 128000);
                var fill = paneEl.querySelector('.context-bar-fill');
                if (fill) {
                    fill.className = 'context-bar-fill' + (ctxInfo.level ? ' ' + ctxInfo.level : '');
                    fill.style.width = ctxInfo.pct + '%';
                }

                var label = paneEl.querySelector('.context-label');
                if (label) {
                    label.textContent = ctxInfo.label;
                }

                var pill = paneEl.querySelector('.pane-context');
                if (pill) {
                    pill.setAttribute('title', 'Context: ' + ctxInfo.label);
                }
            }

            function getToolGroupStatus(entries) {
                return entries.some(function(entry) {
                    return entry.status !== 'done';
                }) ? 'running' : 'done';
            }

            function renderToolMessage(message) {
                var node = document.createElement('details');
                var entries = Array.isArray(message.entries) ? message.entries : [];
                var status = getToolGroupStatus(entries);
                node.className = 'message-tool';
                if (status === 'running') {
                    node.open = true;
                }

                var summary = document.createElement('summary');
                summary.innerHTML =
                    '<span class="message-tool-summary">' +
                        '<svg class="message-tool-chevron" viewBox="0 0 16 16" fill="currentColor"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                        '<span class="message-tool-icon">&#9881;</span>' +
                        '<span class="message-tool-label">Tools</span>' +
                        '<span class="message-tool-count">(' + entries.length + ')</span>' +
                    '</span>' +
                    '<span class="message-tool-status">' + escapeHtml(status) + '</span>';
                node.appendChild(summary);

                var toolBody = document.createElement('div');
                toolBody.className = 'message-tool-body';

                entries.forEach(function(entry) {
                    var item = document.createElement('div');
                    item.className = 'message-tool-entry';
                    item.innerHTML =
                        '<div class="message-tool-entry-header">' +
                            '<span class="message-tool-entry-title">' + escapeHtml(entry.title || 'tool') + '</span>' +
                            '<span class="message-tool-entry-status">' + escapeHtml(entry.status || '') + '</span>' +
                        '</div>' +
                        '<pre class="message-tool-details">' + linkifyFilePaths(escapeHtml(entry.details || '')) + '</pre>';
                    toolBody.appendChild(item);
                });

                node.appendChild(toolBody);
                return node;
            }

            function getSlashQuery(value) {
                if (!value || value.charAt(0) !== '/') {
                    return null;
                }
                var spaceIndex = value.indexOf(' ');
                if (spaceIndex === -1) {
                    return value.substring(1);
                }
                return null;
            }

            function filterSlashCommands(query) {
                var lower = (query || '').toLowerCase();
                return slashCommands.filter(function(command) {
                    return command.name.indexOf(lower) === 0;
                });
            }

            function getActiveSlashCommands(threadId) {
                if (composerUi.threadId !== threadId || composerUi.dropdown !== 'slash') {
                    return [];
                }
                var query = getSlashQuery(getDraft(threadId));
                if (query === null) {
                    return [];
                }
                return filterSlashCommands(query);
            }

            function renderSlashHint(threadId) {
                var commands = getActiveSlashCommands(threadId);
                if (!commands.length) {
                    return '';
                }
                var activeIndex = Math.max(0, Math.min(composerUi.activeSlashIndex, commands.length - 1));
                var command = commands[activeIndex];
                return '<div class="slash-hint visible">/' + escapeHtml(command.name) + ' - ' +
                    escapeHtml(command.description) + '</div>';
            }

            function renderSlashDropdown(threadId) {
                var commands = getActiveSlashCommands(threadId);
                var visible = commands.length > 0;
                var activeIndex = Math.max(0, Math.min(composerUi.activeSlashIndex, commands.length - 1));
                var html = commands.map(function(command, index) {
                    return '<div class="slash-item' + (index === activeIndex ? ' active' : '') + '"' +
                        ' data-action="pick-slash" data-thread-id="' + threadId + '"' +
                        ' data-command="' + escapeAttr(command.name) + '">' +
                        '<div>' + escapeHtml(command.icon) + '</div>' +
                        '<div class="slash-info">' +
                            '<div class="slash-name">/' + escapeHtml(command.name) + '</div>' +
                            '<div class="slash-desc">' + escapeHtml(command.description) + '</div>' +
                        '</div>' +
                    '</div>';
                }).join('');
                return '<div class="slash-dropdown' + (visible ? ' visible' : '') + '">' + html + '</div>';
            }

            function renderFileDropdown(threadId) {
                var visible = composerUi.threadId === threadId &&
                    composerUi.dropdown === 'file' &&
                    composerUi.fileResults.length > 0;
                var activeIndex = Math.max(0, Math.min(composerUi.activeFileIndex, composerUi.fileResults.length - 1));
                var html = composerUi.fileResults.map(function(file, index) {
                    return '<div class="file-item' + (index === activeIndex ? ' active' : '') + '"' +
                        ' data-action="pick-file" data-thread-id="' + threadId + '"' +
                        ' data-path="' + escapeAttr(file.path) + '">' +
                        '<span class="file-item-name">' + escapeHtml(file.name) + '</span>' +
                        '<span class="file-item-path">' + escapeHtml(file.relativePath) + '</span>' +
                    '</div>';
                }).join('');
                return '<div class="file-dropdown' + (visible ? ' visible' : '') + '">' + html + '</div>';
            }

            function renderChatTypeDropdown(thread) {
                var visible = composerUi.threadId === thread.id && composerUi.dropdown === 'chatType';
                var html = chatTypes.map(function(chatType) {
                    return '<div class="selector-item' +
                        (chatType.id === thread.currentChatType ? ' selected' : '') + '"' +
                        ' data-action="select-chat-type" data-thread-id="' + thread.id + '"' +
                        ' data-value="' + escapeAttr(chatType.id) + '">' +
                        '<span class="selector-item-label">' + escapeHtml(chatType.label) + '</span>' +
                        '<span class="selector-item-check">&#x2713;</span>' +
                    '</div>';
                }).join('');
                return '<div class="selector-dropdown' + (visible ? ' visible' : '') + '">' + html + '</div>';
            }

            function renderModelDropdown(thread) {
                var visible = composerUi.threadId === thread.id && composerUi.dropdown === 'model';
                var models = availableModels.slice();
                if (composerUi.modelQuery) {
                    models = models.filter(function(model) {
                        return model.toLowerCase().indexOf(composerUi.modelQuery.toLowerCase()) !== -1;
                    });
                }
                var items = models.map(function(model) {
                    return '<div class="selector-item' + (model === thread.currentModel ? ' selected' : '') + '"' +
                        ' data-action="select-model" data-thread-id="' + thread.id + '"' +
                        ' data-value="' + escapeAttr(model) + '">' +
                        '<span class="selector-item-label">' + escapeHtml(model) + '</span>' +
                        '<span class="selector-item-check">&#x2713;</span>' +
                    '</div>';
                }).join('');
                return '<div class="selector-dropdown' + (visible ? ' visible' : '') + '">' +
                    '<input class="selector-search" data-thread-id="' + thread.id + '"' +
                        ' placeholder="Search models" value="' + escapeAttr(composerUi.modelQuery) + '">' +
                    items +
                '</div>';
            }

            function renderSettingsDropdown(thread) {
                var visible = composerUi.threadId === thread.id && composerUi.dropdown === 'settings';
                var thinkingLevels = ['none', 'low', 'medium', 'high'];
                var thinkingOptions = thinkingLevels.map(function(level) {
                    return '<option value="' + level + '"' +
                        (composerUi.settingsThinking === level ? ' selected' : '') + '>' +
                        level.charAt(0).toUpperCase() + level.slice(1) + '</option>';
                }).join('');

                return '<div class="settings-dropdown' + (visible ? ' visible' : '') + '">' +
                    '<div class="settings-row">' +
                        '<span class="settings-label">Thinking</span>' +
                        '<div class="settings-control">' +
                            '<select data-setting="thinking" data-thread-id="' + thread.id + '">' +
                                thinkingOptions +
                            '</select>' +
                        '</div>' +
                    '</div>' +
                    '<div class="settings-row">' +
                        '<span class="settings-label">Temperature</span>' +
                        '<div class="settings-control" style="display:flex;align-items:center;gap:6px">' +
                            '<input type="range" min="0" max="2" step="0.1"' +
                                ' value="' + composerUi.settingsTemp + '"' +
                                ' data-setting="temperature" data-thread-id="' + thread.id + '">' +
                            '<span class="settings-value">' + composerUi.settingsTemp.toFixed(1) + '</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="settings-row">' +
                        '<span class="settings-label">Max Tokens</span>' +
                        '<div class="settings-control" style="display:flex;align-items:center;gap:6px">' +
                            '<input type="range" min="0" max="16384" step="256"' +
                                ' value="' + composerUi.settingsMaxTokens + '"' +
                                ' data-setting="maxTokens" data-thread-id="' + thread.id + '">' +
                            '<span class="settings-value">' +
                                (composerUi.settingsMaxTokens > 0 ? formatTokenCount(composerUi.settingsMaxTokens) : 'auto') +
                            '</span>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            }

            function getFileIcon(name, type) {
                if (type === 'image') { return '\u{1F5BC}\uFE0F'; }
                var ext = (name.split('.').pop() || '').toLowerCase();
                switch (ext) {
                    case 'ts': case 'tsx': return '\u{1F4D8}';
                    case 'js': case 'jsx': case 'mjs': case 'cjs': return '\u{1F4D2}';
                    case 'py': return '\u{1F40D}';
                    case 'md': case 'mdx': return '\u{1F4DD}';
                    case 'json': case 'yaml': case 'yml': case 'toml': return '\u{1F4CB}';
                    case 'css': case 'scss': case 'less': return '\u{1F3A8}';
                    case 'html': case 'htm': case 'vue': case 'svelte': return '\u{1F310}';
                    case 'sh': case 'bash': case 'zsh': return '\u{1F4DF}';
                    case 'sql': return '\u{1F5C3}\uFE0F';
                    case 'rs': return '\u{2699}\uFE0F';
                    case 'go': return '\u{1F439}';
                    default: return '\u{1F4C4}';
                }
            }

            function renderAttachments(thread) {
                var atts = thread.pendingAttachments || [];
                if (!atts.length) { return ''; }
                var pills = atts.map(function(file, index) {
                    var icon = getFileIcon(file.name, file.type);
                    var visual = (file.type === 'image' && file.previewUri)
                        ? '<img class="att-pill-thumb" src="' + escapeAttr(file.previewUri) + '" alt="' + escapeAttr(file.name) + '">'
                        : '<span class="att-pill-icon">' + icon + '</span>';
                    return '<span class="att-pill' + (file.type === 'image' ? ' att-image' : '') + '">' +
                        visual +
                        '<span class="att-pill-name" title="' + escapeAttr(file.path) + '">' +
                            escapeHtml(file.name) +
                        '</span>' +
                        '<button class="att-pill-remove" data-action="remove-attachment"' +
                            ' data-thread-id="' + thread.id + '" data-index="' + index + '">&#x00d7;</button>' +
                    '</span>';
                }).join('');
                var imageCount = atts.filter(function(a) { return a.type === 'image'; }).length;
                var fileCount = atts.length - imageCount;
                var summary = '<span class="att-count">';
                if (fileCount > 0) { summary += fileCount + ' file' + (fileCount > 1 ? 's' : ''); }
                if (fileCount > 0 && imageCount > 0) { summary += ', '; }
                if (imageCount > 0) { summary += imageCount + ' image' + (imageCount > 1 ? 's' : ''); }
                summary += '</span>';
                return pills + summary;
            }

            var recOpen = Object.create(null);

            function renderComposerRecommendations(thread) {
                var showRecommendations = Boolean(
                    thread &&
                    recommendations.length > 0 &&
                    (thread.messages || []).length === 0 &&
                    !thread.pendingAssistantText
                );

                if (!showRecommendations) {
                    return '<div class="composer-recommendations hidden"></div>';
                }

                var isOpen = !!recOpen[thread.id];
                return '<div class="composer-recommendations">' +
                    '<button class="rec-toggle' + (isOpen ? ' open' : '') + '" data-action="toggle-recs" data-thread-id="' + thread.id + '">' +
                        '<span class="rec-caret">&#x25B6;</span> suggestions' +
                    '</button>' +
                    '<div class="recommendations' + (isOpen ? ' open' : '') + '">' +
                        recommendations.map(function(rec) {
                            return '<button class="rec-chip" data-action="use-recommendation"' +
                                ' data-thread-id="' + thread.id + '" data-command="' + escapeAttr(rec.command) + '">' +
                                escapeHtml(rec.icon + ' ' + rec.label) +
                            '</button>';
                        }).join('') +
                    '</div>' +
                '</div>';
            }

            function renderComposer(thread) {
                var chatType = chatTypes.find(function(item) { return item.id === thread.currentChatType; });
                var draft = getDraft(thread.id);
                var placeholder = 'Ask this thread anything...  / commands  @ files';

                return '<div class="composer-shell" data-thread-id="' + thread.id + '">' +
                    renderFileDropdown(thread.id) +
                    renderSlashDropdown(thread.id) +
                    renderChatTypeDropdown(thread) +
                    renderModelDropdown(thread) +
                    renderSettingsDropdown(thread) +
                    '<div class="composer-card' + (composerUi.dragThreadId === thread.id ? ' drag-active' : '') + '" data-thread-id="' + thread.id + '">' +
                        '<div class="drop-overlay' + (composerUi.dragThreadId === thread.id ? ' visible' : '') + '">' +
                            '<span class="drop-overlay-icon">\u{1F4CE}</span>' +
                            '<span class="drop-overlay-label">Drop files or images to attach</span>' +
                        '</div>' +
                        '<div class="composer-top">' +
                            '<div class="composer-target"><span>Thread</span><strong>' +
                                escapeHtml(thread.title) +
                            '</strong><span>#' + thread.index + '</span></div>' +
                            '<div class="composer-top-spacer"></div>' +
                            '<button class="dropdown-trigger" data-action="toggle-chat-type" data-thread-id="' +
                                thread.id + '" title="Chat type">' +
                                '<span>' + escapeHtml(chatType ? chatType.label : 'Chat') + '</span>' +
                                '<span>&#x25BE;</span>' +
                            '</button>' +
                            '<button class="dropdown-trigger" data-action="toggle-model" data-thread-id="' +
                                thread.id + '" title="Model">' +
                                '<span>' + escapeHtml(thread.currentModel || 'codex') + '</span>' +
                                '<span>&#x25BE;</span>' +
                            '</button>' +
                            '<button class="dropdown-trigger" data-action="toggle-settings" data-thread-id="' +
                                thread.id + '" title="Settings">' +
                                '<span>&#x2699;</span>' +
                            '</button>' +
                        '</div>' +
                        '<textarea class="composer-input" data-thread-id="' + thread.id + '"' +
                            ' rows="1" placeholder="' + escapeAttr(placeholder) + '">' +
                            escapeHtml(draft) +
                        '</textarea>' +
                        renderSlashHint(thread.id) +
                        '<div class="attachments">' + renderAttachments(thread) + '</div>' +
                        renderComposerRecommendations(thread) +
                        '<div class="composer-footer">' +
                            '<button class="btn-attach" data-action="attach" data-thread-id="' + thread.id +
                                '" title="Attach file">+</button>' +
                            '<span class="composer-status">' + escapeHtml(getThreadStatusDetail(thread)) + '</span>' +
                            (function() {
                                var est = estimateTokens(draft);
                                var hasVal = est > 0;
                                return '<span class="composer-token-est' + (hasVal ? ' has-value' : '') +
                                    '" data-token-est="' + thread.id + '">' +
                                    (hasVal ? '~' + formatTokenCount(est) + ' tokens' : '') +
                                '</span>';
                            })() +
                            (messageQueue[thread.id] ? '<span class="queued-indicator" title="Message queued">queued</span>' : '') +
                            '<button class="btn-send' + (thread.isStreaming ? ' streaming' : '') + '"' +
                                ' data-action="' + (thread.isStreaming ? 'cancel' : 'send') + '"' +
                                ' data-thread-id="' + thread.id + '"' +
                                ' title="' + (thread.isStreaming ? 'Stop' : 'Send') + '">' +
                                (thread.isStreaming ? '&#x25A0;' : '&#x2191;') +
                            '</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            }

            function shouldCollapseThread(thread) {
                // Only collapse in 1x1 with multiple threads
                if (currentDimension !== '1x1' || state.threads.length <= 1) {
                    return false;
                }
                // Manual override takes precedence
                if (thread.id in collapseOverrides) {
                    return collapseOverrides[thread.id];
                }
                // Active thread is never auto-collapsed
                if (thread.id === state.activeThreadId) {
                    return false;
                }
                // Auto-collapse if setting enabled and thread is completed/idle (not running)
                if (collapseCompleted && !thread.isStreaming && (thread.status === 'complete' || thread.status === 'error' || thread.status === 'cancelled')) {
                    return true;
                }
                return false;
            }

            function getOrderedThreads() {
                var threads = Array.isArray(state.threads) ? state.threads : [];
                if (threads.length <= 1) {
                    return threads;
                }

                var expandedThreads = [];
                var collapsedThreads = [];
                threads.forEach(function(thread) {
                    if (shouldCollapseThread(thread)) {
                        collapsedThreads.push(thread);
                    } else {
                        expandedThreads.push(thread);
                    }
                });

                return expandedThreads.concat(collapsedThreads);
            }

            function renderPane(thread) {
                var pane = document.createElement('section');
                var statusClass = (thread.status || 'idle').toLowerCase();
                var isCollapsed = shouldCollapseThread(thread);
                pane.className = 'pane' +
                    (thread.id === state.activeThreadId ? ' active' : '') +
                    (isCollapsed ? ' collapsed' : '');
                pane.dataset.threadId = thread.id;

                var sourceClass = (thread.source || 'API').toLowerCase().replace(/[^a-z]/g, '');
                var ctxInfo = formatContextGauge(getThreadSpaceUsage(thread), thread.contextMax || 128000);

                pane.innerHTML =
                    '<div class="pane-header">' +
                        '<div class="pane-header-main">' +
                            '<div class="pane-title">' + escapeHtml(thread.title) + '</div>' +
                            '<div class="pane-meta">' +
                                '<span class="pane-pill">#' + thread.index + '</span>' +
                                '<span class="pane-pill pane-source ' + sourceClass + '">' +
                                    escapeHtml(thread.source || 'API') +
                                '</span>' +
                                '<span class="pane-pill">' + escapeHtml(thread.currentModel || 'codex') + '</span>' +
                                '<span class="pane-pill">' + escapeHtml(thread.currentChatType || 'chat') + '</span>' +
                                '<span class="pane-pill pane-context" title="Context: ' + ctxInfo.label + '">' +
                                    '<span class="context-bar">' +
                                        '<span class="context-bar-fill ' + ctxInfo.level + '"' +
                                            ' style="width:' + ctxInfo.pct + '%"></span>' +
                                    '</span>' +
                                    '<span class="context-label">' + ctxInfo.label + '</span>' +
                                '</span>' +
                                '<span class="pane-pill pane-status ' + escapeHtml(statusClass) + '">' +
                                    escapeHtml(getThreadStatusLabel(thread)) +
                                '</span>' +
                            '</div>' +
                        '</div>' +
                        '<div class="pane-actions">' +
                            (currentDimension === '1x1' && state.threads.length > 1
                                ? '<button class="pane-collapse-btn" data-action="toggleCollapse" data-thread-id="' + thread.id + '" title="' + (isCollapsed ? 'Expand' : 'Collapse') + '">' + (isCollapsed ? '&#x25B6;' : '&#x25BC;') + '</button>'
                                : '') +
                            '<button class="pane-btn" data-action="export" data-thread-id="' + thread.id + '">Export</button>' +
                            '<button class="pane-btn" data-action="clear" data-thread-id="' + thread.id + '">Clear</button>' +
                            (state.threads.length > 1
                                ? '<button class="pane-btn" data-action="close" data-thread-id="' + thread.id + '">Close</button>'
                                : '') +
                        '</div>' +
                    '</div>';

                var body = document.createElement('div');
                body.className = 'pane-body';

                var messages = thread.messages || [];
                if (messages.length === 0 && !thread.pendingAssistantText) {
                    var empty = document.createElement('div');
                    empty.className = 'pane-empty';
                    empty.innerHTML =
                        '<div class="empty-detail">' +
                            '<div>Empty thread. Start from the composer in this panel.</div>' +
                        '</div>';
                    body.appendChild(empty);
                } else {
                    messages.forEach(function(message) {
                        var node = document.createElement('div');
                        if (message.role === 'tool') {
                            node = renderToolMessage(message);
                        } else if (message.role === 'assistant') {
                            node.className = 'message message-assistant';
                            node.innerHTML = linkifyFilePaths(message.html || escapeHtml(message.content || ''));
                        } else if (message.role === 'error') {
                            node.className = 'message message-error';
                            node.innerHTML = linkifyFilePaths(escapeHtml(message.content || ''));
                        } else {
                            node.className = 'message message-user';
                            node.textContent = message.content || '';
                        }
                        body.appendChild(node);
                    });

                    if (thread.pendingAssistantText) {
                        var pending = document.createElement('div');
                        pending.className = 'message message-assistant message-pending';
                        pending.setAttribute('data-thread-id', thread.id);
                        pending.innerHTML = linkifyFilePaths(escapeHtml(thread.pendingAssistantText));
                        body.appendChild(pending);
                    }
                }

                (function(tid) {
                    body.addEventListener('scroll', function() {
                        userScrolledUp[tid] = !isNearBottom(body);
                    });
                })(thread.id);

                pane.appendChild(body);

                var composerWrap = document.createElement('div');
                composerWrap.innerHTML = renderComposer(thread);
                pane.appendChild(composerWrap.firstChild);

                setTimeout(function() {
                    scrollPaneToBottom(body, thread.id);
                    autoResizeTextarea(pane.querySelector('.composer-input'));
                }, 0);

                return pane;
            }

            function cleanupDrafts() {
                var valid = Object.create(null);
                state.threads.forEach(function(thread) {
                    valid[thread.id] = true;
                    if (typeof drafts[thread.id] !== 'string') {
                        drafts[thread.id] = '';
                    }
                });
                Object.keys(drafts).forEach(function(threadId) {
                    if (!valid[threadId]) {
                        delete drafts[threadId];
                    }
                });
                Object.keys(collapseOverrides).forEach(function(threadId) {
                    if (!valid[threadId]) {
                        delete collapseOverrides[threadId];
                    }
                });
            }

            function renderState(preserve) {
                try {
                    cleanupDrafts();
                } catch (e) {
                    console.warn('[OpenClaw] cleanupDrafts failed:', e);
                }

                var savedScrolls = Object.create(null);
                try {
                    var oldBodies = paneGrid.querySelectorAll('.pane-body');
                    for (var i = 0; i < oldBodies.length; i++) {
                        var paneEl = oldBodies[i].closest('.pane');
                        if (paneEl && paneEl.dataset.threadId) {
                            savedScrolls[paneEl.dataset.threadId] = oldBodies[i].scrollTop;
                        }
                    }
                } catch (e) {
                    console.warn('[OpenClaw] scroll save failed:', e);
                }

                var orderedThreads = getOrderedThreads();
                paneGrid.innerHTML = '';

                if (orderedThreads.length === 0) {
                    paneGrid.innerHTML = '<div class="pane-empty"><div class="empty-detail">No threads available.</div></div>';
                    return;
                }

                orderedThreads.forEach(function(thread) {
                    try {
                        paneGrid.appendChild(renderPane(thread));
                    } catch (e) {
                        _showCrash('Render failed for thread #' + (thread.index || '?') + ' (' + thread.id + ')', e);
                    }
                });

                orderedThreads.forEach(function(thread) {
                    try {
                        if (userScrolledUp[thread.id] && savedScrolls[thread.id] != null) {
                            var paneEl = paneGrid.querySelector('.pane[data-thread-id="' + thread.id + '"] .pane-body');
                            if (paneEl) {
                                paneEl.scrollTop = savedScrolls[thread.id];
                            }
                        }
                    } catch (e) {
                        console.warn('[OpenClaw] scroll restore failed:', e);
                    }
                });

                var restore = preserve || {};
                if (restore.threadId) {
                    try {
                        var textarea = paneGrid.querySelector('.composer-input[data-thread-id="' + restore.threadId + '"]');
                        if (textarea) {
                            textarea.focus();
                            if (typeof restore.selectionStart === 'number' && typeof restore.selectionEnd === 'number') {
                                textarea.setSelectionRange(restore.selectionStart, restore.selectionEnd);
                            }
                            autoResizeTextarea(textarea);
                        }
                    } catch (e) {
                        console.warn('[OpenClaw] focus restore failed:', e);
                    }
                }

                try {
                    scrollActiveComposerOptionIntoView();
                } catch (e) {
                    console.warn('[OpenClaw] dropdown scroll sync failed:', e);
                }
            }

            function scrollActiveComposerOptionIntoView() {
                if (!composerUi.threadId || !composerUi.dropdown) {
                    return;
                }

                var shell = paneGrid.querySelector('.composer-shell[data-thread-id="' + composerUi.threadId + '"]');
                if (!shell) {
                    return;
                }

                var dropdownSelector = '';
                var activeSelector = '';
                if (composerUi.dropdown === 'slash') {
                    dropdownSelector = '.slash-dropdown.visible';
                    activeSelector = '.slash-item.active';
                } else if (composerUi.dropdown === 'file') {
                    dropdownSelector = '.file-dropdown.visible';
                    activeSelector = '.file-item.active';
                } else {
                    return;
                }

                var dropdown = shell.querySelector(dropdownSelector);
                var activeItem = dropdown ? dropdown.querySelector(activeSelector) : null;
                if (activeItem && typeof activeItem.scrollIntoView === 'function') {
                    activeItem.scrollIntoView({ block: 'nearest' });
                }
            }

            function captureComposerFocus() {
                var active = document.activeElement;
                if (!active || !active.classList || !active.classList.contains('composer-input')) {
                    return null;
                }
                return {
                    threadId: active.getAttribute('data-thread-id'),
                    selectionStart: active.selectionStart,
                    selectionEnd: active.selectionEnd
                };
            }

            function setActiveThread(threadId) {
                if (!threadId || state.activeThreadId === threadId) {
                    return;
                }
                var focus = captureComposerFocus();
                state.activeThreadId = threadId;
                vscode.postMessage({ type: 'focusThread', threadId: threadId });
                renderState(focus);
            }

            function closeComposerDropdowns() {
                composerUi.dropdown = '';
                composerUi.threadId = '';
                composerUi.activeSlashIndex = 0;
                composerUi.activeFileIndex = 0;
                composerUi.modelQuery = '';
            }

            function clearAtMention() {
                composerUi.atMentionThreadId = '';
                composerUi.atMentionStart = -1;
                composerUi.fileResults = [];
                if (composerUi.fileSearchDebounce) {
                    clearTimeout(composerUi.fileSearchDebounce);
                    composerUi.fileSearchDebounce = null;
                }
                if (composerUi.dropdown === 'file') {
                    closeComposerDropdowns();
                }
            }

            function queueFileSearch(threadId, query) {
                if (composerUi.fileSearchDebounce) {
                    clearTimeout(composerUi.fileSearchDebounce);
                }
                composerUi.fileSearchDebounce = setTimeout(function() {
                    vscode.postMessage({ type: 'fileSearch', query: query, threadId: threadId });
                }, 120);
            }

            function checkAtMention(threadId, textarea) {
                var cursor = textarea.selectionStart;
                var text = textarea.value;
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
                    clearAtMention();
                    return;
                }

                composerUi.threadId = threadId;
                composerUi.dropdown = 'file';
                composerUi.activeFileIndex = 0;
                composerUi.atMentionThreadId = threadId;
                composerUi.atMentionStart = atPos;
                queueFileSearch(threadId, text.substring(atPos + 1, cursor));
            }

            function updateSlashState(threadId) {
                var query = getSlashQuery(getDraft(threadId));
                if (query === null) {
                    if (composerUi.dropdown === 'slash' && composerUi.threadId === threadId) {
                        closeComposerDropdowns();
                    }
                    return;
                }

                var commands = filterSlashCommands(query);
                if (!commands.length) {
                    if (composerUi.dropdown === 'slash' && composerUi.threadId === threadId) {
                        closeComposerDropdowns();
                    }
                    return;
                }

                composerUi.threadId = threadId;
                composerUi.dropdown = 'slash';
                composerUi.activeSlashIndex = Math.max(0, Math.min(composerUi.activeSlashIndex, commands.length - 1));
            }

            function selectSlashCommand(threadId, commandName) {
                setDraft(threadId, '/' + commandName + ' ');
                composerUi.threadId = threadId;
                composerUi.dropdown = 'slash';
                composerUi.activeSlashIndex = 0;
                renderState({
                    threadId: threadId,
                    selectionStart: getDraft(threadId).length,
                    selectionEnd: getDraft(threadId).length
                });
            }

            function selectFileFromDropdown(threadId, filePath, textarea) {
                var text = getDraft(threadId);
                var cursor = textarea ? textarea.selectionStart : text.length;
                var before = text.substring(0, composerUi.atMentionStart);
                var after = text.substring(cursor);
                var nextValue = before + after;
                setDraft(threadId, nextValue);
                clearAtMention();
                vscode.postMessage({ type: 'attachFile', threadId: threadId, filePath: filePath });
                renderState({
                    threadId: threadId,
                    selectionStart: before.length,
                    selectionEnd: before.length
                });
            }

            function sendThread(threadId) {
                var thread = getThreadById(threadId);
                var raw = getDraft(threadId).trim();
                if (!thread || !raw) {
                    return;
                }
                if (thread.isStreaming) {
                    messageQueue[threadId] = raw;
                    setDraft(threadId, '');
                    clearAtMention();
                    closeComposerDropdowns();
                    renderState({ threadId: threadId, selectionStart: 0, selectionEnd: 0 });
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
                            threadId: thread.id,
                            command: commandName,
                            text: userText
                        });
                        setDraft(threadId, '');
                        clearAtMention();
                        closeComposerDropdowns();
                        renderState({ threadId: threadId, selectionStart: 0, selectionEnd: 0 });
                        return;
                    }
                }

                vscode.postMessage({ type: 'send', threadId: thread.id, text: raw });
                userScrolledUp[thread.id] = false;
                setDraft(threadId, '');
                clearAtMention();
                closeComposerDropdowns();
                renderState({ threadId: threadId, selectionStart: 0, selectionEnd: 0 });
            }

            function toggleDropdown(threadId, kind) {
                if (composerUi.threadId === threadId && composerUi.dropdown === kind) {
                    closeComposerDropdowns();
                } else {
                    composerUi.threadId = threadId;
                    composerUi.dropdown = kind;
                    composerUi.modelQuery = '';
                    composerUi.activeSlashIndex = 0;
                    composerUi.activeFileIndex = 0;
                }
                renderState();
            }

            btnNew.addEventListener('click', function() {
                vscode.postMessage({ type: 'newSession' });
            });

            btnSplit.addEventListener('click', function() {
                vscode.postMessage({ type: 'splitThread' });
            });

            if (btnPopout) {
                btnPopout.addEventListener('click', function() {
                    vscode.postMessage({ type: 'popOut' });
                });
            }

            function rebuildDimensionOptions(threadCount, preferredDimension) {
                var current = isValidDimension(preferredDimension)
                    ? preferredDimension
                    : (isValidDimension(dimensionSelect.value) ? dimensionSelect.value : currentDimension);
                var count = Math.max(1, threadCount || 1);
                var seen = Object.create(null);
                var options = [];

                function addOption(value) {
                    if (!isValidDimension(value) || seen[value]) {
                        return;
                    }
                    seen[value] = true;
                    options.push(value);
                }

                addOption('1x1');
                addOption(current);
                for (var c = 1; c <= count; c++) {
                    if (count % c === 0) {
                        addOption(c + 'x' + (count / c));
                    }
                }

                dimensionSelect.innerHTML = '';
                for (var i = 0; i < options.length; i++) {
                    var opt = document.createElement('option');
                    opt.value = options[i];
                    opt.textContent = options[i];
                    dimensionSelect.appendChild(opt);
                }
                if (isValidDimension(current) && dimensionSelect.querySelector('option[value="' + current + '"]')) {
                    dimensionSelect.value = current;
                } else {
                    dimensionSelect.value = '1x1';
                }
            }

            function updateGridDimension(dimension) {
                var parts = dimension.split('x');
                var cols = parseInt(parts[0], 10) || 1;
                var rows = parseInt(parts[1], 10) || 1;
                paneGrid.style.setProperty('--grid-cols', cols);
                paneGrid.style.setProperty('--grid-rows', rows);
            }

            dimensionSelect.addEventListener('change', function() {
                currentDimension = dimensionSelect.value;
                updateGridDimension(currentDimension);
                vscode.postMessage({ type: 'setDimension', dimension: currentDimension });
            });

            btnFlip.addEventListener('click', function() {
                var parts = currentDimension.split('x');
                var flipped = parts[1] + 'x' + parts[0];
                if (dimensionSelect.querySelector('option[value="' + flipped + '"]')) {
                    dimensionSelect.value = flipped;
                    currentDimension = flipped;
                    updateGridDimension(currentDimension);
                    vscode.postMessage({ type: 'setDimension', dimension: currentDimension });
                }
            });

            function openFileFromLink(fileLink) {
                if (!fileLink) {
                    return;
                }
                vscode.postMessage({
                    type: 'openFile',
                    filePath: fileLink.getAttribute('data-file-path'),
                    line: fileLink.getAttribute('data-line') || ''
                });
            }

            paneGrid.addEventListener('click', function(event) {
                var fileLink = event.target.closest('.file-link');
                if (fileLink) {
                    event.preventDefault();
                    event.stopPropagation();
                    openFileFromLink(fileLink);
                    return;
                }
            });

            paneGrid.addEventListener('keydown', function(event) {
                if (event.key !== 'Enter' && event.key !== ' ') {
                    return;
                }

                var fileLink = event.target.closest('.file-link');
                if (fileLink) {
                    event.preventDefault();
                    event.stopPropagation();
                    openFileFromLink(fileLink);
                }
            });

            paneGrid.addEventListener('click', function(event) {
                var actionEl = event.target.closest('[data-action]');
                var pane = event.target.closest('.pane');
                if (pane && !actionEl) {
                    var clickedId = pane.getAttribute('data-thread-id');
                    if (pane.classList.contains('collapsed')) {
                        collapseOverrides[clickedId] = false;
                    }
                    setActiveThread(clickedId);
                    return;
                }

                if (!actionEl) {
                    return;
                }

                var action = actionEl.getAttribute('data-action');
                var threadId = actionEl.getAttribute('data-thread-id');
                if (threadId) {
                    setActiveThread(threadId);
                }

                if (action === 'toggleCollapse') {
                    var wasCollapsed = shouldCollapseThread(getThreadById(threadId) || {});
                    collapseOverrides[threadId] = !wasCollapsed;
                    renderState(captureComposerFocus());
                    return;
                }
                if (action === 'clear') {
                    vscode.postMessage({ type: 'clearThread', threadId: threadId });
                    return;
                }
                if (action === 'close') {
                    vscode.postMessage({ type: 'closeThread', threadId: threadId });
                    return;
                }
                if (action === 'export') {
                    vscode.postMessage({ type: 'exportThread', threadId: threadId });
                    return;
                }
                if (action === 'attach') {
                    vscode.postMessage({ type: 'attach', threadId: threadId });
                    return;
                }
                if (action === 'send') {
                    sendThread(threadId);
                    return;
                }
                if (action === 'cancel') {
                    vscode.postMessage({ type: 'cancel', threadId: threadId });
                    return;
                }
                if (action === 'remove-attachment') {
                    vscode.postMessage({
                        type: 'removeAttachment',
                        threadId: threadId,
                        index: Number(actionEl.getAttribute('data-index'))
                    });
                    return;
                }
                if (action === 'toggle-chat-type') {
                    toggleDropdown(threadId, 'chatType');
                    return;
                }
                if (action === 'toggle-model') {
                    toggleDropdown(threadId, 'model');
                    return;
                }
                if (action === 'toggle-settings') {
                    toggleDropdown(threadId, 'settings');
                    return;
                }
                if (action === 'select-chat-type') {
                    closeComposerDropdowns();
                    vscode.postMessage({
                        type: 'setChatType',
                        threadId: threadId,
                        chatType: actionEl.getAttribute('data-value')
                    });
                    return;
                }
                if (action === 'select-model') {
                    closeComposerDropdowns();
                    vscode.postMessage({
                        type: 'setModel',
                        threadId: threadId,
                        model: actionEl.getAttribute('data-value')
                    });
                    return;
                }
                if (action === 'pick-slash') {
                    selectSlashCommand(threadId, actionEl.getAttribute('data-command'));
                    return;
                }
                if (action === 'pick-file') {
                    var textarea = paneGrid.querySelector('.composer-input[data-thread-id="' + threadId + '"]');
                    selectFileFromDropdown(threadId, actionEl.getAttribute('data-path'), textarea);
                    return;
                }
                if (action === 'toggle-recs') {
                    recOpen[threadId] = !recOpen[threadId];
                    var wrap = actionEl.closest('.composer-recommendations');
                    if (wrap) {
                        var list = wrap.querySelector('.recommendations');
                        var togBtn = wrap.querySelector('.rec-toggle');
                        if (list) { list.classList.toggle('open', !!recOpen[threadId]); }
                        if (togBtn) { togBtn.classList.toggle('open', !!recOpen[threadId]); }
                    }
                    return;
                }
                if (action === 'use-recommendation') {
                    var command = actionEl.getAttribute('data-command') || '';
                    setDraft(threadId, command + ' ');
                    composerUi.threadId = threadId;
                    composerUi.dropdown = '';
                    renderState({
                        threadId: threadId,
                        selectionStart: getDraft(threadId).length,
                        selectionEnd: getDraft(threadId).length
                    });
                }
            });

            paneGrid.addEventListener('input', function(event) {
                var textarea = event.target.closest('.composer-input');
                if (textarea) {
                    var threadId = textarea.getAttribute('data-thread-id');
                    setDraft(threadId, textarea.value);
                    composerUi.threadId = threadId;
                    updateSlashState(threadId);
                    checkAtMention(threadId, textarea);
                    renderState({
                        threadId: threadId,
                        selectionStart: textarea.selectionStart,
                        selectionEnd: textarea.selectionEnd
                    });
                    return;
                }

                var search = event.target.closest('.selector-search');
                if (search) {
                    composerUi.threadId = search.getAttribute('data-thread-id');
                    composerUi.dropdown = 'model';
                    composerUi.modelQuery = search.value;
                    renderState({
                        threadId: composerUi.threadId,
                        selectionStart: search.selectionStart,
                        selectionEnd: search.selectionEnd
                    });
                }
            });

            paneGrid.addEventListener('change', function(event) {
                var el = event.target;
                var setting = el.getAttribute('data-setting');
                if (!setting) { return; }
                if (setting === 'thinking') {
                    composerUi.settingsThinking = el.value;
                    vscode.postMessage({ type: 'setSetting', key: 'chat.thinkingLevel', value: el.value });
                    renderState(captureComposerFocus());
                } else if (setting === 'temperature') {
                    composerUi.settingsTemp = parseFloat(el.value);
                    vscode.postMessage({ type: 'setSetting', key: 'chat.temperature', value: parseFloat(el.value) });
                    renderState(captureComposerFocus());
                } else if (setting === 'maxTokens') {
                    composerUi.settingsMaxTokens = parseInt(el.value, 10);
                    vscode.postMessage({ type: 'setSetting', key: 'chat.maxTokens', value: parseInt(el.value, 10) });
                    renderState(captureComposerFocus());
                }
            });

            paneGrid.addEventListener('keydown', function(event) {
                var textarea = event.target.closest('.composer-input');
                if (!textarea) {
                    return;
                }

                var threadId = textarea.getAttribute('data-thread-id');
                var fileVisible = composerUi.threadId === threadId && composerUi.dropdown === 'file' && composerUi.fileResults.length > 0;
                if (fileVisible) {
                    if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        composerUi.activeFileIndex = Math.min(composerUi.activeFileIndex + 1, composerUi.fileResults.length - 1);
                        renderState({
                            threadId: threadId,
                            selectionStart: textarea.selectionStart,
                            selectionEnd: textarea.selectionEnd
                        });
                        return;
                    }
                    if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        composerUi.activeFileIndex = Math.max(composerUi.activeFileIndex - 1, 0);
                        renderState({
                            threadId: threadId,
                            selectionStart: textarea.selectionStart,
                            selectionEnd: textarea.selectionEnd
                        });
                        return;
                    }
                    if ((event.key === 'Enter' || event.key === 'Tab') && composerUi.fileResults.length) {
                        event.preventDefault();
                        selectFileFromDropdown(threadId, composerUi.fileResults[composerUi.activeFileIndex].path, textarea);
                        return;
                    }
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        clearAtMention();
                        renderState({
                            threadId: threadId,
                            selectionStart: textarea.selectionStart,
                            selectionEnd: textarea.selectionEnd
                        });
                        return;
                    }
                }

                var slashCommandsForThread = getActiveSlashCommands(threadId);
                if (slashCommandsForThread.length) {
                    if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        composerUi.activeSlashIndex = Math.min(composerUi.activeSlashIndex + 1, slashCommandsForThread.length - 1);
                        renderState({
                            threadId: threadId,
                            selectionStart: textarea.selectionStart,
                            selectionEnd: textarea.selectionEnd
                        });
                        return;
                    }
                    if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        composerUi.activeSlashIndex = Math.max(composerUi.activeSlashIndex - 1, 0);
                        renderState({
                            threadId: threadId,
                            selectionStart: textarea.selectionStart,
                            selectionEnd: textarea.selectionEnd
                        });
                        return;
                    }
                    if ((event.key === 'Enter' || event.key === 'Tab') && slashCommandsForThread.length) {
                        event.preventDefault();
                        selectSlashCommand(threadId, slashCommandsForThread[composerUi.activeSlashIndex].name);
                        return;
                    }
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        closeComposerDropdowns();
                        renderState({
                            threadId: threadId,
                            selectionStart: textarea.selectionStart,
                            selectionEnd: textarea.selectionEnd
                        });
                        return;
                    }
                }

                if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
                    if (composerUi.dropdown === 'file' && composerUi.fileResults.length) {
                        event.preventDefault();
                        selectFileFromDropdown(threadId, composerUi.fileResults[composerUi.activeFileIndex].path, textarea);
                        return;
                    }
                    if (composerUi.dropdown === 'slash' && slashCommandsForThread.length) {
                        event.preventDefault();
                        selectSlashCommand(threadId, slashCommandsForThread[composerUi.activeSlashIndex].name);
                        return;
                    }
                    event.preventDefault();
                    var thread = getThreadById(threadId);
                    if (thread && thread.isStreaming) {
                        vscode.postMessage({ type: 'cancel', threadId: threadId });
                    } else {
                        sendThread(threadId);
                    }
                    return;
                }
            });

            paneGrid.addEventListener('focusin', function(event) {
                var textarea = event.target.closest('.composer-input');
                if (textarea) {
                    setActiveThread(textarea.getAttribute('data-thread-id'));
                }
            });

            paneGrid.addEventListener('dragenter', function(event) {
                var shell = event.target.closest('.composer-shell');
                if (!shell || !hasFileDrag(event.dataTransfer)) {
                    return;
                }
                event.preventDefault();
                composerUi.dragThreadId = shell.getAttribute('data-thread-id');
                renderState();
            });

            paneGrid.addEventListener('dragover', function(event) {
                var shell = event.target.closest('.composer-shell');
                if (!shell || !hasFileDrag(event.dataTransfer)) {
                    return;
                }
                event.preventDefault();
                if (event.dataTransfer) {
                    event.dataTransfer.dropEffect = 'copy';
                }
                var tid = shell.getAttribute('data-thread-id');
                if (composerUi.dragThreadId !== tid) {
                    composerUi.dragThreadId = tid;
                    renderState();
                }
            });

            paneGrid.addEventListener('dragleave', function(event) {
                var shell = event.target.closest('.composer-shell');
                if (!shell || !hasFileDrag(event.dataTransfer)) {
                    return;
                }
                if (!shell.contains(event.relatedTarget)) {
                    composerUi.dragThreadId = '';
                    renderState();
                }
            });

            paneGrid.addEventListener('drop', function(event) {
                var shell = event.target.closest('.composer-shell');
                if (!shell || !hasFileDrag(event.dataTransfer)) {
                    return;
                }
                event.preventDefault();
                var threadId = shell.getAttribute('data-thread-id');
                composerUi.dragThreadId = '';
                var filePaths = extractDroppedPaths(event.dataTransfer);
                if (filePaths.length) {
                    vscode.postMessage({
                        type: 'attachFiles',
                        threadId: threadId,
                        filePaths: filePaths
                    });
                }
                renderState();
            });

            paneGrid.addEventListener('paste', function(event) {
                var textarea = event.target.closest('.composer-input');
                if (!textarea || !event.clipboardData) { return; }
                var threadId = textarea.getAttribute('data-thread-id');
                var items = event.clipboardData.items;
                var filePaths = [];
                for (var pi = 0; pi < items.length; pi++) {
                    if (items[pi].kind === 'file') {
                        var file = items[pi].getAsFile();
                        if (file && file.path) {
                            filePaths.push(file.path);
                        }
                    }
                }
                if (filePaths.length > 0) {
                    event.preventDefault();
                    vscode.postMessage({
                        type: 'attachFiles',
                        threadId: threadId,
                        filePaths: filePaths
                    });
                }
            });

            document.addEventListener('click', function(event) {
                if (!event.target.closest('.composer-shell')) {
                    closeComposerDropdowns();
                    clearAtMention();
                    renderState(captureComposerFocus());
                }
            });

            window.addEventListener('dragend', function() {
                if (composerUi.dragThreadId) {
                    composerUi.dragThreadId = '';
                    renderState();
                }
            });

            window.addEventListener('message', function(event) {
                var message;
                try { message = event.data; } catch (e) {
                    _showCrash('Failed to read message data', e);
                    return;
                }
                try { _handleMessage(message); } catch (e) {
                    _showCrash('Message handler crashed (type=' + (message && message.type) + ')', e);
                }
            });

            function _handleMessage(message) {
                if (message.type === 'slashCommands') {
                    slashCommands = message.commands || [];
                    return;
                }
                if (message.type === 'recommendations') {
                    recommendations = message.items || [];
                    renderState(captureComposerFocus());
                    return;
                }
                if (message.type === 'fileSearchResults') {
                    composerUi.fileResults = message.files || [];
                    renderState(captureComposerFocus());
                    return;
                }
                if (message.type === 'onboardingDone') {
                    return;
                }
                if (message.type === 'textUpdate') {
                    // Lightweight incremental update — only touch the pending element
                    var tid = message.threadId;
                    var liveThread = null;
                    var pendingEl = paneGrid.querySelector('.message-pending[data-thread-id="' + tid + '"]');
                    if (pendingEl) {
                        pendingEl.innerHTML = linkifyFilePaths(escapeHtml(message.text));
                    } else {
                        // First chunk — create the pending element inside the body
                        var paneBody = paneGrid.querySelector('.pane[data-thread-id="' + tid + '"] .pane-body');
                        if (paneBody) {
                            // Remove empty placeholder if present
                            var emptyEl = paneBody.querySelector('.pane-empty');
                            if (emptyEl) { emptyEl.remove(); }
                            var newPending = document.createElement('div');
                            newPending.className = 'message message-assistant message-pending';
                            newPending.setAttribute('data-thread-id', tid);
                            newPending.innerHTML = linkifyFilePaths(escapeHtml(message.text));
                            paneBody.appendChild(newPending);
                        }
                    }
                    // Update the thread state in memory so full renders stay in sync
                    for (var si = 0; si < state.threads.length; si++) {
                        if (state.threads[si].id === tid) {
                            state.threads[si].pendingAssistantText = message.text;
                            state.threads[si].isStreaming = true;
                            state.threads[si].status = 'running';
                            liveThread = state.threads[si];
                            break;
                        }
                    }
                    // Auto-scroll if user hasn't scrolled up
                    var scrollBody = paneGrid.querySelector('.pane[data-thread-id="' + tid + '"] .pane-body');
                    if (scrollBody) { scrollPaneToBottom(scrollBody, tid); }
                    // Update status pill and send button without full rebuild
                    var paneEl = paneGrid.querySelector('.pane[data-thread-id="' + tid + '"]');
                    if (paneEl) {
                        var statusPill = paneEl.querySelector('.pane-status');
                        if (statusPill && !statusPill.classList.contains('running')) {
                            statusPill.className = 'pane-pill pane-status running';
                            statusPill.textContent = 'Running';
                        }
                        var sendBtn = paneEl.querySelector('.btn-send');
                        if (sendBtn && !sendBtn.classList.contains('streaming')) {
                            sendBtn.classList.add('streaming');
                            sendBtn.setAttribute('data-action', 'cancel');
                            sendBtn.setAttribute('title', 'Stop');
                            sendBtn.innerHTML = '&#x25A0;';
                        }
                        var statusSpan = paneEl.querySelector('.composer-status');
                        if (statusSpan) { statusSpan.textContent = 'Generating response'; }
                        updatePaneContextUsage(paneEl, liveThread);
                    }
                    return;
                }
                if (message.type === 'state') {
                    var focus = captureComposerFocus();
                    state.activeThreadId = message.activeThreadId || '';
                    state.visibleThreadIds = message.visibleThreadIds || [];
                    state.threads = message.threads || [];
                    availableModels = message.models || [];
                    if (typeof message.collapseCompleted === 'boolean') {
                        collapseCompleted = message.collapseCompleted;
                    }
                    if (isValidDimension(message.dimension)) {
                        currentDimension = message.dimension;
                    }
                    rebuildDimensionOptions(state.threads.length || 1, currentDimension);
                    dimensionSelect.value = currentDimension;
                    currentDimension = dimensionSelect.value || '1x1';
                    updateGridDimension(currentDimension);
                    renderState(focus);

                    // Drain queued messages for threads that finished streaming
                    for (var qi = 0; qi < state.threads.length; qi++) {
                        var t = state.threads[qi];
                        if (!t.isStreaming && messageQueue[t.id]) {
                            var queued = messageQueue[t.id];
                            delete messageQueue[t.id];
                            setDraft(t.id, queued);
                            sendThread(t.id);
                        }
                    }
                }
            }

            function hasFileDrag(dataTransfer) {
                if (!dataTransfer || !dataTransfer.types) {
                    return false;
                }
                var types = dataTransfer.types;
                var hasType = typeof types.indexOf === 'function'
                    ? function(t) { return types.indexOf(t) !== -1; }
                    : function(t) { return Array.prototype.indexOf.call(types, t) !== -1; };
                return hasType('Files') || hasType('text/uri-list');
            }

            function extractDroppedPaths(dataTransfer) {
                var paths = [];

                function pushUnique(p) {
                    if (p && paths.indexOf(p) === -1) {
                        paths.push(p);
                    }
                }

                // 1. Parse text/uri-list (VS Code explorer drags provide file:// URIs here)
                try {
                    var uriList = dataTransfer.getData('text/uri-list');
                    if (uriList) {
                        var lines = uriList.split(/\\r?\\n/);
                        for (var u = 0; u < lines.length; u++) {
                            var line = lines[u].trim();
                            if (!line || line.charAt(0) === '#') { continue; }
                            if (line.indexOf('file://') === 0) {
                                // Decode the file URI to a local path
                                var decoded = decodeURIComponent(line.replace(/^file:\\/\\//, ''));
                                // On Windows, strip leading slash from /C:/...
                                if (/^\\/[A-Za-z]:/.test(decoded)) {
                                    decoded = decoded.substring(1);
                                }
                                pushUnique(decoded);
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[OpenClaw DnD] Could not read text/uri-list:', e);
                }

                // 2. Try File objects (File.path works in Electron but is empty in webview sandbox)
                if (!paths.length && dataTransfer.items) {
                    for (var i = 0; i < dataTransfer.items.length; i++) {
                        var item = dataTransfer.items[i];
                        if (item.kind === 'file') {
                            var file = item.getAsFile();
                            if (file && file.path) {
                                pushUnique(file.path);
                            }
                        }
                    }
                }

                if (!paths.length && dataTransfer.files) {
                    for (var j = 0; j < dataTransfer.files.length; j++) {
                        var f = dataTransfer.files[j];
                        if (f && f.path) {
                            pushUnique(f.path);
                        }
                    }
                }

                if (!paths.length) {
                    console.warn('[OpenClaw DnD] Could not extract file paths from drop. dataTransfer.types:', Array.from(dataTransfer.types));
                }

                return paths;
            }

            rebuildDimensionOptions(1, currentDimension);
            updateGridDimension(currentDimension);
            try {
                renderState();
            } catch (e) {
                _showCrash('Initial render failed', e);
            }
            try {
                vscode.postMessage({ type: 'requestState' });
                vscode.postMessage({ type: 'requestRecommendations' });
            } catch (e) {
                _showCrash('Failed to request initial state from extension host', e);
            }
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
