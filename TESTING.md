# OpenClaw Extension — Testing Guide

## Prerequisites

- Node.js 22.16+ (24 recommended)
- OpenClaw CLI installed: `npm install -g openclaw@latest`
- acpx installed (for chat): `npm install -g acpx`
- For Windows + WSL, set `openclaw.command` to `wsl openclaw status`

## Running the Extension

1. Open this repo in VS Code
2. Run `pnpm install` if you haven't already
3. Press **F5** to launch the Extension Development Host
4. A new VS Code window opens with the extension loaded

## Test Cases

### 1. Status Bar — Initial State

- Status bar shows `$(plug) OpenClaw` on the right
- Tooltip says "Click to connect to OpenClaw"

### 2. Status Bar — Manual Connection

1. Click the status bar item
2. Status bar changes to `$(sync~spin) OpenClaw` (connecting)
3. A terminal named "OpenClaw" opens and runs the configured command
4. Status bar changes to `$(check) OpenClaw` (connected)

### 3. Status Bar — Auto-Connect

1. Set `openclaw.autoConnect` to `true` in Settings
2. Reload the window (Command Palette > "Developer: Reload Window")
3. Verify the command runs on startup without clicking

### 4. Status Bar — Terminal Reuse

1. Click the status bar item to connect
2. Click it again
3. Confirm the same "OpenClaw" terminal is reused (not a new one)

### 5. Status Bar — Missing Command

1. Set `openclaw.command` to a nonexistent command (e.g. `fakecli status`)
2. Click the status bar item
3. Confirm an error message appears with "Install CLI" and "More options..." actions
4. Status bar returns to idle

### 6. Chat — Basic Message

1. Open the OpenClaw sidebar
2. Type a question in the input and press **Ctrl+Enter**
3. Confirm the user message appears with a left border
4. Confirm the assistant response streams in incrementally
5. Confirm tool-call badges appear if the agent reads files

### 7. Chat — Slash Commands

1. Type `/` in the chat input
2. Confirm the autocomplete dropdown appears with all nine commands
3. Use arrow keys to navigate, press **Tab** or **Enter** to select
4. Confirm the input updates to `/<command> ` and the hint bar shows the description
5. Press **Ctrl+Enter** to send
6. Verify the augmented prompt includes the correct context (e.g. `/fix` includes diagnostics)

### 8. Chat — Slash Command Filtering

1. Type `/ex` in the input
2. Confirm only `/explain` appears in the dropdown
3. Type `/z` — confirm the dropdown hides (no match)

### 9. Chat — @-mention File Attachment

1. Type `@` in the input (preceded by a space or at the start)
2. Confirm the file dropdown appears showing open tabs or workspace files
3. Type a partial filename to filter
4. Select a file with arrow keys + Enter, or click it
5. Confirm the file appears as an attachment pill below the input
6. Confirm the `@query` text is removed from the input
7. Send a message — verify the attached file content is included in the prompt

### 10. Chat — File Attachment via Button

1. Click the `+` button in the input area
2. Select one or more files from the system file picker
3. Confirm attachment pills appear below the input
4. Click the `×` on a pill to remove it

### 11. Chat — Pop Out

1. Send at least one message in the sidebar chat
2. Click the pop-out button (top-right arrow icon) or run **OpenClaw: Pop Out Chat**
3. Confirm a new editor panel opens with the full conversation
4. Confirm sending a message in the pop-out panel works

### 12. Chat — New Session

1. Send a message so there is conversation history
2. Click the `×` button in the header or run **OpenClaw: New Chat Session**
3. Confirm all messages are cleared
4. Confirm recommendation chips reappear

### 13. Chat — Recommendation Chips

1. Open the sidebar chat with no conversation history
2. Confirm recommendation chips are displayed below the input
3. Open a file with errors — confirm a "Fix N issues" chip appears
4. Select some text — confirm "Explain selection" and "Refactor selection" chips appear
5. Click a chip — confirm the input populates with the corresponding slash command

### 14. Chat — Onboarding Carousel

1. Clear `openclaw.onboardingComplete` from globalState (reinstall the extension or reset state)
2. Open the sidebar chat
3. Confirm the three-slide carousel appears
4. Click **Next** to advance through all slides; confirm dot indicators update
5. Click **Back** to go backwards
6. On the last slide, click **Get Started**
7. Confirm the carousel hides and does not reappear on subsequent opens

### 15. Chat — Streaming Cancellation

1. Send a message that triggers a long response
2. While streaming, click the stop button (red square that replaces send)
3. Confirm the stream stops and the interface returns to the ready state

### 16. Overview Panel — Sections

1. Open the OpenClaw activity bar
2. Expand the Overview tree
3. Confirm five sections are present: Getting Started, Operate, Hardening, Tools, Help
4. Click items in each section and verify they trigger the correct action

### 17. Overview — Tools Management

1. Add a tool entry to `~/.openclaw/openclaw.json` under the `tools` key
2. Click **Refresh tools** in the Overview > Tools section
3. Confirm the tool appears with "Enabled" status
4. Click the tool, then click **Disable** — confirm it toggles to "Disabled"
5. Click **Enable** — confirm it toggles back
6. Click **Uninstall** — confirm the confirmation dialog appears and the tool is removed

### 18. Security Hardening — Run

1. Run **OpenClaw: Harden** from the Command Palette
2. Confirm a terminal named "OpenClaw Hardening" opens
3. Confirm the appropriate commands run based on the `openclaw.hardening.mode` setting:
   - `full`: audit, audit --fix, audit --deep
   - `auditFix`: audit, audit --fix
   - `audit`: audit only

### 19. Security Hardening — Access Summary

1. Run **OpenClaw: Hardening Access Summary**
2. Confirm a Markdown document opens in the editor
3. Verify it contains sections for MCP servers, Tools, Keys, Network endpoints, Local files, and CLI output

### 20. Model Setup Wizard

1. Run **OpenClaw: Model Setup Wizard** from the Command Palette
2. Confirm the onboarding quick pick appears (Run wizard / No daemon / Docs / Skip)
3. Select a provider
4. Confirm you can open docs, config, or auth profiles
5. Confirm post-setup checks are offered (doctor + status / dashboard / skip)

### 21. Setup Flow — Missing CLI

1. Uninstall or rename the `openclaw` binary so it's not on PATH
2. Click the status bar item
3. Confirm the error message offers "Install CLI" and "More options..."
4. Click "Install CLI" — confirm the setup quick pick appears with platform-appropriate options

### 22. Legacy Migration

1. Set `openclaw.command` to `molt status` (or `clawdbot status`)
2. Click the status bar item
3. Confirm a warning about the legacy name appears
4. Confirm the "Use openclaw" action updates the setting

## Tips

- Use the **Output** panel (select "OpenClaw") for extension debug logs.
- If the status bar item doesn't appear, confirm you're in the Extension Development Host window, not the main VS Code window.
- The Chat panel requires `acpx` on PATH. If you see "acpx not found", run `npm install -g acpx`.
