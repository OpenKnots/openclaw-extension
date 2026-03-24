# OpenClaw Extension — Roadmap

Planned features and architectural directions for the OpenClaw VS Code extension.

---

## Voice Chat

Real-time voice input/output for the chat panel.

- **Speech-to-text input** — hold-to-talk or toggle mic to dictate messages instead of typing. Transcription runs locally (Whisper) or via a cloud STT provider.
- **Text-to-speech output** — stream assistant responses as audio. Configurable voice, speed, and auto-play behavior.
- **Inline voice notes** — attach short audio clips to messages as context (e.g., verbal bug descriptions).
- **Hands-free mode** — continuous listen → respond loop for pair-programming without touching the keyboard.
- **Wake word / hotkey activation** — trigger voice input from anywhere in VS Code via a keybinding or optional wake phrase.

---

## Enhanced Planning

Structured planning workflows that go beyond single-shot prompts.

- **Plan mode** — dedicated UI for multi-step implementation plans. The agent proposes a plan, the user reviews/edits steps, then the agent executes sequentially with checkpoints.
- **Plan persistence** — save and resume plans across sessions. Plans live as `.openclaw/plans/*.json` in the workspace.
- **Plan diffing** — when a plan changes mid-execution (new info, user feedback), show a diff of the old vs. revised plan.
- **Estimation signals** — each plan step includes a rough complexity signal (small / medium / large) so the user can gauge scope before approving.
- **Branch-per-plan** — optionally auto-create a git branch when a plan starts, with auto-commit at each completed step.

---

## DnD Threads (Drag-and-Drop Threads)

Drag-and-drop thread management for visual conversation organization.

- **Thread cards** — each conversation is a draggable card in a sidebar list. Drag to reorder, group, or archive.
- **Thread groups / folders** — drop threads into named groups (e.g., "Bug fixes", "Feature work", "Research").
- **Cross-thread context** — drag a thread onto another to merge context or create a follow-up that inherits the parent's history.
- **Pin & collapse** — pin important threads to the top; collapse stale ones to reduce clutter.
- **Thread snapshots** — drag a thread to the editor area to open a read-only snapshot as a document.

---

## Dynamic Bento Threads

A flexible, tiling layout for running multiple threads side-by-side.

- **Bento grid** — split the chat panel into a configurable grid of thread tiles (2×1, 2×2, 3×2, etc.).
- **Auto-layout** — the grid adjusts dynamically based on active thread count and viewport size.
- **Focus mode** — double-click a tile to expand it full-width; click again to return to the grid.
- **Cross-tile awareness** — threads in the same grid can reference each other's context (e.g., "use the output from the thread on the left").
- **Persistent layouts** — save bento configurations per workspace so each project can have its own preferred thread arrangement.
- **Drag to tile** — drag a thread from the sidebar into a specific grid cell to place it.

---

## Customizable Knots

Multipanel layouts that bundle a set of predefined subagents, each with preloaded skills, plugins, and tool configurations. A Knot is a saved workspace arrangement — think of it as a purpose-built workbench for a specific workflow.

- **Knot templates** — ship built-in templates for common workflows (e.g., "Code Review Knot" with reviewer + security + test agents tiled side-by-side, or "Feature Build Knot" with planner + implementer + reviewer).
- **Custom knot authoring** — users define their own knots as `.openclaw/knots/*.json` files specifying panel layout, agent profiles, preloaded skills, and default plugins for each tile.
- **Per-panel agent binding** — each panel in a knot is bound to a specific subagent with its own system prompt, model, tool permissions, and skill set. Panels operate independently but share workspace context.
- **Preloaded skills** — knots can declare skills that are automatically loaded into each panel's agent (e.g., the security panel always has `/harden` and `/review` available, the planning panel has `/plan` and `/estimate`).
- **Plugin slots** — each panel supports a plugin manifest that extends the agent's capabilities (custom MCP servers, external API integrations, workspace-specific tooling).
- **Knot launcher** — a `/knot <name>` slash command or sidebar action that tears down the current layout and spins up the selected knot configuration in one step.
- **Layout persistence** — knot layouts are saved per-workspace and restore on reopen, including each panel's scroll position and conversation state.
- **Knot sharing** — export a knot configuration as a portable JSON file that teammates can import into their own workspace.
- **Live rewiring** — swap an agent, skill, or plugin in any panel without restarting the knot. Changes take effect on the next message.
- **Cross-panel orchestration** — panels in a knot can reference each other's output (e.g., the implementer panel can pull the plan from the planner panel) via a shared knot context bus.

---

## Thread Optimization

Performance and UX improvements for long-running and high-volume threads.

- **Context compression** — automatically summarize older messages when a thread approaches the context window limit, keeping recent messages intact.
- **Lazy message rendering** — only render visible messages in the webview; virtualize the scroll list for threads with hundreds of messages.
- **Thread pruning** — suggest archiving or summarizing threads that haven't been touched in N days.
- **Parallel execution** — allow multiple threads to run agent sessions concurrently without blocking each other.
- **Token budget UI** — show a visual indicator of how much context window remains, with options to manually trim or summarize.
- **Smart caching** — cache tool call results (file reads, search results) across messages within a thread to avoid redundant work.

---

## Subagent Selection

User-facing controls for choosing and configuring which subagents handle specific tasks.

- **Agent picker** — a dropdown or modal that shows available agent types (general-purpose, code-review, security, planning, etc.) with descriptions of their capabilities.
- **Per-thread agent assignment** — assign a specific agent profile to a thread so all messages in that thread route to the same agent type.
- **Agent chaining** — define pipelines where one agent's output feeds into another (e.g., planner → implementer → reviewer).
- **Custom agent profiles** — users can define their own agent profiles with specific system prompts, tool permissions, and model preferences stored in `.openclaw/agents/`.
- **Agent status indicators** — show which agent is active in each thread, its current model, and tool access level.
- **Capability-based routing** — the system auto-selects the best agent based on the task (e.g., `/harden` routes to the security agent, `/test` routes to the testing agent).

---

## Ephemeral Messages (`/btw`)

A lightweight, off-the-record side-channel inspired by Claude Code's `/btw` command. Ephemeral messages let the user inject quick context, corrections, or asides without polluting the main conversation history or consuming context window budget.

- **`/btw` slash command** — type `/btw <message>` to send an ephemeral note to the active agent. The message is delivered as a transient system-level injection: the agent sees it for the current turn only, and it is never persisted to the thread's message history.
- **Visual distinction** — ephemeral messages render with a muted, translucent style (italic text, dimmed background, dashed border) so they are instantly recognizable as non-persistent asides.
- **No token carry-forward** — ephemeral content is stripped before the next turn's context is assembled. This keeps the context window clean for long-running threads.
- **Use cases** — quick corrections ("btw the function was renamed to `parseConfig`"), temporary instructions ("btw respond in bullet points for this next answer"), or nudges ("btw focus on the error handling path").
- **Keyboard shortcut** — `Cmd+Shift+B` (macOS) / `Ctrl+Shift+B` (Windows/Linux) opens a minimal inline input pre-filled with `/btw ` for fast fire-and-forget notes.
- **Agent acknowledgement** — the agent responds to `/btw` with a brief inline acknowledgement (e.g., "Got it.") styled as ephemeral so the conversation flow isn't interrupted.
- **Stacking** — multiple `/btw` messages sent before the agent's next response are merged into a single ephemeral block.
- **Claude parity** — behavior mirrors Claude Code's implementation: ephemeral messages influence the immediate response but leave no trace in conversation exports, thread snapshots, or plan history.

---

## Slash Command Expansion

Extend the existing slash command system with more Claude Code–aligned commands and capabilities.

- **`/compact`** — compress the current thread's context by summarizing older messages while preserving recent history. Useful for long sessions approaching the token limit.
- **`/clear`** — reset the current thread to a blank state without creating a new thread. Confirms before discarding.
- **`/model <name>`** — switch the active model mid-conversation without opening the model picker dropdown.
- **`/cost`** — display a running total of token usage and estimated cost for the current thread.
- **`/undo`** — remove the last assistant response and the user message that triggered it, effectively rewinding one turn.
- **`/retry`** — re-send the last user message to get a fresh response (optionally with a different model via `/retry --model <name>`).
- **`/diff`** — show a unified diff of all file changes the agent has made in the current thread.
- **`/snap`** — save a named snapshot of the current thread state that can be restored later.
- **`/export`** — export the current thread as Markdown, JSON, or a `.chat` file for sharing or archival.
- **`/agent <name>`** — switch the active agent profile mid-thread (ties into the Subagent Selection roadmap item).
- **Alias support** — users can define custom aliases in settings (e.g., `/r` → `/review`, `/e` → `/explain`) for faster access.
- **Composable commands** — chain commands with `|` (e.g., `/review | /harden`) to run multiple analyses in sequence on the same context.

---

## Persistent Memory

Workspace-scoped memory that persists across sessions and informs all threads, modeled after Claude Code's memory system.

- **Auto-save** — the agent automatically saves important project context, user preferences, and recurring instructions to `.openclaw/memory/`.
- **`/memory` command** — view, search, edit, and delete stored memories from within the chat panel.
- **Memory types** — support for user preferences, project context, feedback/corrections, and external references, each with structured frontmatter.
- **MEMORY.md index** — a concise index file that the agent loads at conversation start, with pointers to individual memory files.
- **Scoped recall** — memories are scoped to the workspace so each project has its own knowledge base. Global user-level memories are also supported.
- **Implicit learning** — the agent detects corrections, preferences, and recurring patterns during conversations and suggests saving them as memories.
- **Memory budget** — a configurable limit on how many tokens of memory are injected at conversation start, with priority-based selection.
- **Forget command** — `/forget <topic>` removes matching memories when they become stale or wrong.

---

## Inline Editing & Diff Preview

Bring the agent's code changes closer to the editor with inline diff and apply workflows.

- **In-thread diff rendering** — render file diffs directly inside the chat thread as collapsible, syntax-highlighted diff blocks so the user can review changes without leaving the conversation.
- **Inline diff view** — when the agent proposes code changes, show a VS Code–native inline diff (green/red) in the editor instead of a raw code block in chat.
- **Accept Changes button** — a per-hunk "Accept" button on each diff block in the thread that applies that single change to the file on disk with one click.
- **Accept All Changes** — a top-level "Accept All" button on agent responses containing multiple diffs that applies every proposed change across all files at once.
- **Reject / Dismiss** — per-hunk and batch "Reject" buttons to discard individual or all proposed changes without applying them.
- **Edit-in-place** — the user can edit the proposed code directly in the diff view before applying.
- **Undo integration** — applied changes are added to the editor's undo stack so `Cmd+Z` reverts them cleanly.
- **Multi-file diffs** — when the agent modifies multiple files, show a navigable list of affected files with per-file diffs, each with its own Accept / Reject controls.
- **Diff navigation** — keyboard shortcuts to jump between diff hunks within a thread (next diff / previous diff).
- **Ghost text preview** — optionally show proposed insertions as ghost text (like Copilot suggestions) that the user can accept with Tab.

---

## Terminal Integration

Let the agent interact with the integrated terminal for build, test, and debug workflows.

- **`/run <command>`** — execute a shell command in the integrated terminal and stream the output back to the agent for analysis.
- **Error capture** — automatically detect build/test failures in the terminal and offer to pipe the error output to the agent for diagnosis.
- **Background tasks** — run long-lived processes (dev servers, watchers) and let the agent monitor their output for errors or relevant events.
- **Terminal context** — the agent can read recent terminal history as context when the user asks about build failures or runtime errors.
- **Safe execution model** — commands require user approval before execution, with a configurable allowlist for trusted commands (e.g., `npm test`, `cargo build`).

---

## Comprehensive Git Management

End-to-end Git and GitHub integration covering branch management, pull requests, issues, and collaborative workflows — all from within the chat panel.

### Branch & Commit Management
- **Branch awareness** — the agent always knows the current branch, dirty state, and remote tracking status.
- **Branch-per-task** — when starting a new plan or feature, optionally auto-create and checkout a feature branch.
- **Commit splitting** — suggest splitting a large set of changes into logical atomic commits with appropriate messages.
- **`/changelog`** — auto-generate changelog entries from commits since the last tag, grouped by conventional commit type.
- **Conflict resolution** — when merge conflicts are detected, the agent can propose resolutions with inline diffs.

### Pull Request Workflows
- **`/pr`** — generate a pull request title, description, and test plan from the current branch's diff against main, then create it via `gh`.
- **PR review (`/pr-review`)** — fetch an open PR by number or URL, display the diff in-thread, and provide a structured code review with inline comments, severity levels, and suggested fixes.
- **PR submission (`/pr-submit`)** — stage changes, create a branch, push, and open a PR in one command with auto-generated title, description, and test plan. Supports draft PRs and reviewer assignment.
- **PR status dashboard** — list open PRs for the repo with status (review requested, approved, changes requested, CI passing/failing) and quick actions (merge, close, comment).
- **Review response** — reply to PR review comments directly from the chat panel, resolve conversations, and push follow-up commits.
- **Merge management** — merge PRs from chat with strategy selection (merge, squash, rebase) and automatic branch cleanup.

### Issue Management
- **`/issue`** — create, view, update, and close GitHub issues from chat. Supports labels, assignees, milestones, and templates.
- **Issue browser** — list and filter open issues by label, assignee, or milestone with quick-view summaries.
- **Issue triage** — the agent can suggest labels, priority, and assignees based on issue content and project history.
- **Issue templates** — auto-populate issue bodies using repo-defined templates with smart field filling based on conversation context.

### Issue–PR Matching
- **Auto-linking** — when creating a PR, the agent scans commit messages and branch names for issue references (`#123`, `fixes #456`) and adds closing keywords automatically.
- **Issue-to-PR (`/issue-pr <number>`)** — given an issue, the agent creates a feature branch, proposes an implementation plan, and opens a draft PR linked to the issue.
- **PR-to-issue backfill** — for PRs without linked issues, suggest creating a corresponding issue for traceability.
- **Cross-reference view** — show a thread-local summary of which issues are addressed by the current branch's changes and which remain open.

### Release & CI
- **Release drafting** — generate release notes from merged PRs and closed issues since the last tag, grouped by category.
- **CI status** — show GitHub Actions / CI pipeline status for the current branch or PR, with log tailing for failed jobs.
- **Check re-run** — re-trigger failed CI checks from chat without navigating to GitHub.

---

## Meaningful Chat Types

Make the chat type selector functional by giving each type a distinct system prompt, tool set, and UI behavior. The default type should enable all capabilities so new users get the full experience out of the box.

- **Code** — focused on writing, editing, and explaining code. System prompt emphasizes implementation. Tools include file read/write, terminal execution, and search. Responses default to code blocks with inline diffs.
- **Chat** — general-purpose conversational mode. No specialized system prompt constraints. All tools available but the agent favors natural-language answers over code generation. Good for brainstorming, Q&A, and exploration.
- **Review** — code review mode. The agent acts as a reviewer: it reads diffs/files, flags issues (bugs, style, security, performance), and suggests improvements. System prompt encourages critical analysis over implementation. Responses favor inline comments and structured feedback.
- **Plan** — planning and architecture mode. The agent produces structured, multi-step plans rather than jumping straight to code. System prompt emphasizes decomposition, estimation, and tradeoff analysis. Output format is numbered steps with complexity signals.
- **Default behavior** — the default chat type should be **Chat** (all capabilities enabled, no restrictive system prompt) so that users who never touch the type selector get the full experience. Switching types mid-thread is allowed and takes effect on the next message.

---

## Settings Slash Command (`/settings`)

Allow users to view and modify extension settings directly from the chat panel without opening VS Code's settings UI.

- **`/settings`** — with no arguments, display all current OpenClaw settings as a formatted list (model, endpoint, chat type defaults, keybindings, memory budget, etc.).
- **`/settings <key>`** — show the current value of a specific setting (e.g., `/settings model`).
- **`/settings <key> <value>`** — update a setting in place (e.g., `/settings model claude-sonnet-4-6`, `/settings chatType review`). Changes take effect immediately for the current session and persist to VS Code's settings store.
- **Validation** — reject invalid keys or values with a helpful error message listing valid options.
- **Scoped settings** — support workspace-level vs. global-level overrides (e.g., `/settings --workspace model claude-haiku-4-5-20251001`).
- **Reset** — `/settings reset <key>` restores a setting to its default value; `/settings reset --all` restores all settings.
- **Autocomplete** — the slash command input should offer autocomplete for setting keys and, where applicable, their valid values.

---

## Connection Method Selection

Make provider setup explicit by letting users choose how the extension connects and authenticates for each backend.

- **Connection method picker** — during onboarding and provider setup, let users choose a connection method such as API key, OAuth, local runtime, or custom endpoint.
- **Provider-specific auth flows** — show only the methods supported by the selected provider and guide the user through the right flow for that provider.
- **Per-provider saved profiles** — allow users to save multiple connection profiles per provider (for example personal API key, work OAuth account, local dev server).
- **Connection status & switching** — surface the active connection method in the UI and allow quick switching without re-running the full setup wizard.
- **Credential validation** — verify the selected method before saving and provide actionable errors for expired OAuth sessions, invalid API keys, or unreachable local endpoints.

---

## Future Considerations

Additional features under exploration (not yet scoped):

- **Collaborative threads** — share a thread with teammates for real-time multiplayer chat with the agent.
- **Plugin / extension API** — let third-party extensions register custom slash commands, agents, and UI panels.
- **Offline mode** — local model support for air-gapped environments.
- **Analytics dashboard** — usage stats, token consumption, and productivity metrics per workspace.
- **Multi-modal input** — support image and screenshot attachments for visual bug reports and UI review.
- **Notebook integration** — run agent-suggested code in Jupyter notebooks with inline output capture.
- **Test watcher** — continuous test-run mode where the agent monitors test results and auto-suggests fixes on failure.
- **Session handoff** — export a full session (thread + memory + plan) as a portable bundle that another user or machine can import and continue.
