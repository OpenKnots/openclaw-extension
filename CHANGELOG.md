# Changelog

All notable changes to this project are documented in this file.
The format is based on Keep a Changelog, and this project adheres to
Semantic Versioning.

## Unreleased

- Add slash commands (`/explain`, `/fix`, `/review`, `/test`, `/refactor`, `/doc`, `/commit`, `/harden`, `/search`) with autocomplete dropdown and keyboard navigation.
- Inject editor context automatically per command: active selection, file content, diagnostics, git diff, or staged changes.
- Replace the static onboarding card with context-aware recommendation chips that update as the active editor, selection, and diagnostics change.
- Build augmented prompts on the extension side so `acpx` receives rich, instruction-wrapped requests without backend changes.
- Add a multi-step onboarding carousel with three slides: "Chat with your codebase", "Security-first hardening", and key setup tips. Includes smooth transitions, dot indicators, and Back/Next navigation.
- Persist onboarding completion in `globalState` so the carousel only shows on first use.
- Add Cursor-style `@`-mention file attachment: type `@` in the chat input to search and attach workspace files as context, with autocomplete dropdown, keyboard navigation, and mouse support.
- Add in-chat dropdown selectors for chat type (Chat, Code, Review, Plan) and model/agent, replacing settings-only configuration with direct UI controls in the input area.
- Add `openclaw.chat.models` setting to customize the list of available models shown in the model picker.
- Prepend chat-type-specific system instructions (code, review, plan) to prompts so `acpx` receives role-appropriate context.
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
