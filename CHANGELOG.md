# Changelog

All notable changes to this project are documented in this file.
The format is based on Keep a Changelog, and this project adheres to
Semantic Versioning.

## Unreleased

### Added

- Add drag-and-drop file and image attachments onto the composer with a dashed blue drop overlay and type-aware attachment pills.
- Add file-type icons on attachment pills (language-specific icons for TS, JS, Python, etc. and a framed-picture icon for images).
- Add image vs file distinction in attachments — images are referenced by path instead of being read as binary text.
- Add clipboard paste support for file attachments in the composer.
- Add attachment summary count (`2 files, 1 image`) alongside pills.
- Add per-thread message queuing so messages sent while a thread is streaming are held and automatically dispatched once the stream completes, with a "queued" indicator in the composer.
- Add configurable chat generation controls for thinking level, temperature, max tokens, and a custom system prompt.
- Add per-thread chat settings controls in the composer for adjusting thinking level, temperature, and max tokens from the UI.
- Add automatic collapsing for completed chats in `1x1` multichat view, with a setting to disable it.

### Changed

- Stream assistant text into the active thread incrementally so responses render live before completion.
- Webview now explicitly requests initial state on load instead of relying on a timed bootstrap, fixing a race condition that could leave the chat panel blank.

### Fixed

- Fix blank chat panel on load caused by the webview not receiving the initial state message from the extension.

### Removed

- Remove the per-pane "Focus" button from thread actions.

## 0.2.0

### Added

- Add threading support with per-thread composers, state tracking, and bento-grid layout (`1x1`, `2x1`, `2x2`, etc.) controlled by a configurable dimension setting.
- Add token usage tracking with a context-window progress bar, model-aware context limits, and per-thread usage metadata.
- Add model source detection (API, Local, Gateway) with a configurable `openclaw.chat.source` override and color-coded source pills in the pane header.
- Add thread status indicators (idle, running, complete, error, cancelled) with distinct styling per state.
- Add thread export to Markdown or JSON via the `exportThread` command.
- Add dynamic thread subject renaming based on slash commands, attached files, and conversation content.
- Add grouped tool-call messages that collapse consecutive tool events into a single expandable entry with JSON details.
- Add per-pane composers with independent completion state and recommendation chips scoped to each thread.
- Add unit tests for `ChatService.getPermissionsForChatType` and `getWebviewContent` using Vitest.
- Add a project roadmap (`ROADMAP.md`) covering planned features: voice chat, enhanced planning, DnD threads, bento threads, subagent selection, ephemeral messages, persistent memory, inline editing, terminal integration, git workflows, and more.
- Add slash commands (`/explain`, `/fix`, `/review`, `/test`, `/refactor`, `/doc`, `/commit`, `/harden`, `/search`) with autocomplete dropdown and keyboard navigation.
- Add context-aware recommendation chips that replace the static onboarding card and update based on the active editor, selection, and diagnostics.
- Add a multi-step onboarding carousel with three slides: "Chat with your codebase", "Security-first hardening", and key setup tips, with smooth transitions, dot indicators, and Back/Next navigation.
- Add Cursor-style `@`-mention file attachment so typing `@` in the chat input searches and attaches workspace files, with autocomplete dropdown, keyboard navigation, and mouse support.
- Add in-chat dropdown selectors for chat type (Chat, Code, Review, Plan) and model/agent, replacing settings-only configuration with direct UI controls in the composer.
- Add the `openclaw.chat.models` setting to customize which models appear in the model picker.

### Changed

- Refactor pane grid to use CSS custom properties (`--grid-cols`, `--grid-rows`) for the bento layout instead of `auto-fit`, enabling explicit dimension control.
- Upgrade pane styling with pill-shaped metadata badges, improved spacing, and a dedicated context-bar progress indicator.
- Refactor tool-call message model from single entries to grouped `entries` arrays, reducing message noise during multi-tool sequences.
- Move composer and recommendation rendering into per-thread functions (`renderComposer`, `renderComposerRecommendations`) for the threading model.
- Inject command-specific editor context automatically into prompts, including active selection, file content, diagnostics, git diff, and staged changes.
- Build augmented prompts in the extension so `acpx` receives richer, instruction-wrapped requests without backend changes.
- Prepend chat-type-specific system instructions for Code, Review, and Plan modes so `acpx` receives role-appropriate context.
- Persist onboarding completion in `globalState` so the carousel only appears on first use.
- Keep plain Chat mode read-only by forcing `approve-reads` permissions even when the global chat permission setting is more permissive.

### Thanks

- Thanks @BunsDev <3

## 0.1.0

- Add a Chat panel in the OpenClaw sidebar for ephemeral gateway subagent conversations.
- Spawn `acpx exec` with NDJSON streaming to chat with any codebase in the current workspace.
- Support pop-out from sidebar to a standalone editor panel with full conversation transfer.
- Stream assistant responses incrementally with tool-call badges shown inline.
- Add `openclaw.chat.agent` and `openclaw.chat.permissions` settings for agent and permission configuration.
- Register `OpenClaw: Open Chat`, `OpenClaw: Pop Out Chat`, and `OpenClaw: New Chat Session` commands.
- Add `.env.example` for `VSCE_PAT` and `OVSX_TOKEN` and update publish script to pass PAT explicitly.

## 0.0.9

- Patch release.

## 0.0.8

- Replace the Hardening activity view with a nested Overview view that groups onboarding, operations, hardening, tools, and help.
- Add a Tools section that reads `~/.openclaw/openclaw.json` and lists tools from `tools`, `mcp.tools`, and `capabilities.tools`.
- Support per-tool enable/disable by updating `enabled` in config entries.
- Add uninstall for tools by removing their config entries with confirmation.
- Surface tool descriptions and source location in the tree item tooltips.
- Add quick access to docs, dashboard, config, and hardening actions within the Overview view.

## 0.0.7

- Add a single publish script that runs prepublish plus VS Code Marketplace and Open VSX publishes.
- Consolidate publishing into one command for repeatable release flow.

## 0.0.6

- Add the Model Setup Wizard command to run onboarding, pick providers, and open config/auth profiles.
- Introduce the Security Hardening command with audit, fix, deep, and access summary workflows.
- Add the OpenClaw activity bar container and Hardening view entry.
- Add hardening configuration settings for mode and command prefix.
- Update the README with model setup, security hardening, and WSL hardening guidance.
- Add an Open VSX publish script with .env token loading and prepublish build.

## 0.0.5

- Add status bar accessibility metadata for screen readers.
- Reuse shared label formatting to keep status bar updates consistent.
- Consolidate install and migration prompts into a "More options" quick pick.
- Offer install, docs, or settings shortcuts from error prompts.

## 0.0.4

- Add the beginner-friendly setup command and guided install actions when the CLI is missing.
- Improve missing-CLI error handling with direct install, copy, docs, and settings actions.
- Add legacy CLI migration prompts for the OpenClaw rename.
- Include Node.js detection with guidance for installs when required.
- Refresh README with guided setup and troubleshooting steps.

## 0.0.3

Whoopsies, did not publish.

## 0.0.2

- Update the extension icon with a circular mask for the marketplace.
- Align visual branding with the OpenClaw assets.

## 0.0.1

- Initial release with status bar connect workflow.
