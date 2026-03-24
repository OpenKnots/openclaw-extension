![OpenClaw hero](assets/images/readme.png)

# OpenClaw VS Code Extension

VS Code status bar shortcut for connecting to OpenClaw. It shows connection state and runs your configured OpenClaw CLI command in a terminal.

> Created by OpenKnot: https://openknot.ai

Quick, super-simple overview: see `SUMMARY.md`.

## Features

- **`Status Bar Indicator`:** Shows idle, connecting, connected, and error states at a glance.
- **`One-Click Connect`:** Runs your OpenClaw command in a dedicated terminal.
- **`Terminal Reuse`:** Keeps a single terminal session for quick reconnects.
- **`Auto-Connect`:** Optionally connect on startup.
- **`Custom Command`:** Configure the exact command for your environment.
- **`Guided Setup`:** Install Node.js and OpenClaw with prompts.
- **`Install Shortcuts`:** One-click install or copy commands when the CLI is missing.
- **`Legacy Migration`:** Prompts to upgrade from `molt`/`clawdbot` to `openclaw`.
- **`Node Check`:** Detects missing Node.js and offers installers.

## Quick Start (macOS + Windows)

### 1. Install Node.js (*required*)

- Download from https://nodejs.org — Node 24 recommended (Node 22.16+ also supported)
- **Verify**: `node -v` shows `v22.16` or newer

### 2. Install OpenClaw

```
npm install -g openclaw@latest
```

> **Verify**: `openclaw --help`

### 3. Onboard and start the Gateway

```
openclaw onboard --install-daemon
```

Verify the Gateway is running and open the dashboard:

```
openclaw gateway status
openclaw dashboard
```

### 4. Log in to a channel (*optional*)

```
openclaw channels login
```

Scan the QR (WhatsApp) or follow the prompt for your channel.

### 5. Connect from VS Code

Click the `OpenClaw` status bar item. The extension sends your configured command in the terminal.

## Beginner-Friendly Setup

If you see a "command not found: openclaw" error in VS Code, use the built-in helpers:

- Run `OpenClaw: Setup` from the Command Palette; OR
- Click the action buttons in the error message to install or copy the command

The setup flow can also detect missing Node.js, guide you to install the latest LTS, and then install OpenClaw.

## Model Setup Wizard (Powerful + Beginner-Friendly)

Run the command palette action **OpenClaw: Model Setup Wizard** to:

- Run the OpenClaw onboarding wizard in a terminal (`openclaw onboard`)
- Choose a provider (OpenAI, Anthropic, Google Gemini, Ollama, Local Pi RPC, or custom)
- Open your config and auth profile files for quick edits
- Verify health with `openclaw status` and `openclaw health`

This is the fastest path from zero to a working model configuration.

## Security Hardening (New)

Run **OpenClaw: Harden** from the Command Palette or open the **OpenClaw → Hardening** view in the Activity Bar to:

- Run `openclaw security audit`, `--fix`, and `--deep` in sequence
- Review status in the terminal and get quick links to config + docs
- Trigger `openclaw status --all` and open the local dashboard
- View a plain-English access summary (MCP, tools, key sources)

This is a guided path for locking down common attack surfaces and permissions.

## Configuration

- `openclaw.autoConnect`: Automatically connect on startup (default: false)
- `openclaw.command`: Command to run when connecting (default: `openclaw status`)
- `openclaw.hardening.mode`: Hardening workflow (`full`, `audit`, `auditFix`)
- `openclaw.hardening.command`: Command prefix for hardening (default: `openclaw`)

For Windows with WSL, set: `openclaw.command` = `wsl openclaw status`

## Model Setup (Beginner-Friendly)

By default, OpenClaw uses its bundled Pi binary in RPC mode. If you want a different provider or custom settings, update your config:

`~/.openclaw/openclaw.json`

> See the OpenClaw docs for configuration examples and provider setup: https://docs.openclaw.ai

## Troubleshooting

### "command not found: openclaw"

- Reinstall CLI: `npm install -g openclaw@latest`
- Restart your terminal or VS Code
- Or run `OpenClaw: Setup` in VS Code to use the guided installer

### Legacy CLI name (molt or clawdbot)

If you previously installed the legacy CLI, update to the new `openclaw` name using the installer or npm, then run `openclaw doctor`:

- Recommended (macOS/Linux): `curl -fsSL https://openclaw.ai/install.sh | bash`
- Global npm: `npm install -g openclaw@latest`

> *See https://docs.openclaw.ai/install/updating for full update guidance.*

### "node: command not found" or Node too old

- Install from https://nodejs.org/ — Node 24 recommended (Node 22.16+ also supported)
- Verify with `node -v` (needs v22.16+)

### Gateway not running

- **Check**: `openclaw gateway status`
- **Restart**: `openclaw gateway restart`
- **Dashboard**: `openclaw dashboard`

### No status bar item

- Ensure you are in the Extension Development Host when testing
- Check Output panel for extension logs

### Windows + WSL

- Set `openclaw.command` to `wsl openclaw status`
- Set `openclaw.hardening.command` to `wsl openclaw`

## Development

1. Install dependencies: `pnpm install`
2. Compile: `pnpm run compile`
3. Press F5 to launch the Extension Development Host
4. Publish (prepublish + VSCE + Open VSX): `pnpm run publish:all`

## License

[MIT](./LICENSE)
