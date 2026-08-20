import * as vscode from 'vscode';
import { spawn, ChildProcess, execFile } from 'child_process';
import { dirname } from 'path';
import { promisify } from 'util';

const log = vscode.window.createOutputChannel('OpenClaw Agent', { log: true });
const execFileAsync = promisify(execFile);

export type UsageInfo = {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
};

export type ChatEvent =
    | { type: 'text'; text: string }
    | { type: 'toolCall'; title: string; status: string; details: string }
    | { type: 'usage'; usage: UsageInfo }
    | { type: 'done' }
    | { type: 'error'; message: string };

export class ChatService {
    private activeProcess: ChildProcess | null = null;
    private readonly ensuredSessions = new Set<string>();
    private static readonly KNOWN_ACPX_AGENTS = new Set([
        'pi',
        'openclaw',
        'codex',
        'claude',
        'gemini',
        'cursor',
        'copilot',
        'droid',
        'fast-agent',
        'grok-build',
        'iflow',
        'kilocode',
        'kimi',
        'kiro',
        'mux',
        'opencode',
        'pool',
        'qoder',
        'qwen',
        'trae',
        'zeroclaw'
    ]);

    private static readonly MODEL_SOURCE_MAP: Record<string, string> = {
        openclaw: 'Gateway',
        codex: 'API',
        claude: 'API',
        'gpt-4o': 'API',
        gemini: 'API',
        ollama: 'Local',
        opencode: 'Gateway',
    };

    static getSourceForModel(model: string): string {
        const config = vscode.workspace.getConfiguration('openclaw');
        const override = config.get<string>('chat.source');
        if (override) {
            return override;
        }
        const lower = model.toLowerCase();
        for (const [key, source] of Object.entries(ChatService.MODEL_SOURCE_MAP)) {
            if (lower.includes(key)) {
                return source;
            }
        }
        return 'API';
    }

    private static readonly CHAT_TYPE_PREFIXES: Record<string, string> = {
        code: 'You are a coding assistant. Focus on writing and explaining code.\n\n',
        review: 'You are a code reviewer. Analyze the provided code for bugs, improvements, and best practices.\n\n',
        plan: 'You are a planning assistant. Create structured plans and break down tasks. Do not write code unless asked.\n\n',
    };

    sendMessage(
        prompt: string,
        cwd: string,
        model: string,
        chatType: string,
        sessionName: string,
        onEvent: (event: ChatEvent) => void
    ): void {
        this.abort();

        void this.startMessage(prompt, cwd, model, chatType, sessionName, onEvent);
    }

    private async startMessage(
        prompt: string,
        cwd: string,
        model: string,
        chatType: string,
        sessionName: string,
        onEvent: (event: ChatEvent) => void
    ): Promise<void> {

        const config = vscode.workspace.getConfiguration('openclaw');
        const configuredPermissions = config.get<string>('chat.permissions', 'approve-reads');
        const permissions = ChatService.getPermissionsForChatType(chatType, configuredPermissions);

        const thinkingLevel = config.get<string>('chat.thinkingLevel', 'medium');
        const temperature = config.get<number>('chat.temperature', 0.7);
        const maxTokens = config.get<number>('chat.maxTokens', 0);
        const systemPrompt = config.get<string>('chat.systemPrompt', '');

        const prefix = ChatService.CHAT_TYPE_PREFIXES[chatType] ?? '';
        let fullPrompt = prefix + prompt;
        if (systemPrompt) {
            fullPrompt = systemPrompt + '\n\n' + fullPrompt;
        }

        const args = this.buildArgs(model, permissions, fullPrompt, sessionName, {
            thinkingLevel,
            temperature,
            maxTokens,
        });

        const spawnEnv = this.buildSpawnEnv();
        const acpxCommand = await this.resolveLaunchCommand(config, spawnEnv);
        await this.ensureSession(acpxCommand, spawnEnv, cwd, model, sessionName);

        log.info(`spawn ${acpxCommand} ${args.join(' ')} (cwd=${cwd})`);
        const child = spawn(acpxCommand, args, {
            cwd,
            env: spawnEnv,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        this.activeProcess = child;

        let stderrBuffer = '';
        let stdoutLineBuffer = '';
        let emittedEvent = false;

        child.stdout!.on('data', (chunk: Buffer) => {
            stdoutLineBuffer += chunk.toString();
            const lines = stdoutLineBuffer.split('\n');
            stdoutLineBuffer = lines.pop() ?? '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) {
                    continue;
                }
                const event = this.parseLine(trimmed);
                if (event) {
                    emittedEvent = true;
                    onEvent(event);
                }
            }
        });

        child.stderr!.on('data', (chunk: Buffer) => {
            stderrBuffer += chunk.toString();
        });

        child.on('close', (code) => {
            log.info(`acpx exited code=${code}`);
            if (stdoutLineBuffer.trim()) {
                const event = this.parseLine(stdoutLineBuffer.trim());
                if (event) {
                    emittedEvent = true;
                    onEvent(event);
                }
            }

            if (this.activeProcess === child) {
                this.activeProcess = null;
            }

            if (code !== 0 && code !== null) {
                const errMsg = this.withActionableErrorHint(
                    stderrBuffer.trim() || `acpx exited with code ${code}`,
                    model
                );
                log.error(`acpx error: ${errMsg}`);
                onEvent({ type: 'error', message: errMsg });
            } else if (!emittedEvent && stderrBuffer.trim()) {
                const errMsg = this.withActionableErrorHint(stderrBuffer.trim(), model);
                log.warn(`acpx produced no parseable stdout, stderr=${errMsg}`);
                onEvent({ type: 'error', message: errMsg });
            }

            onEvent({ type: 'done' });
        });

        child.on('error', (err) => {
            log.error('acpx spawn error', err);
            if (this.activeProcess === child) {
                this.activeProcess = null;
            }
            onEvent({
                type: 'error',
                message: err.message.includes('ENOENT')
                    ? `${acpxCommand} not found. Configure openclaw.chat.acpxPath or install acpx with: npm i -g acpx`
                    : err.message
            });
            onEvent({ type: 'done' });
        });
    }

    private async ensureSession(
        acpxCommand: string,
        env: NodeJS.ProcessEnv,
        cwd: string,
        agentOrModel: string,
        sessionName: string
    ): Promise<void> {
        const normalizedSession = sessionName.trim();
        if (!normalizedSession) {
            return;
        }

        const agentSelection = this.resolveAgentSelection(agentOrModel);
        const cacheKey = `${agentSelection.agent}::${normalizedSession}`;
        if (this.ensuredSessions.has(cacheKey)) {
            return;
        }

        try {
            await execFileAsync(
                acpxCommand,
                [agentSelection.agent, 'sessions', 'ensure', '--name', normalizedSession],
                { env, cwd }
            );
            this.ensuredSessions.add(cacheKey);
            log.info(`ensured acpx session ${normalizedSession} for agent=${agentSelection.agent}`);
        } catch (err) {
            // Best effort: prompt may still work if a session already exists.
            const message = err instanceof Error ? err.message : String(err);
            log.warn(`failed to ensure acpx session ${normalizedSession}: ${message}`);
        }
    }

    private async resolveLaunchCommand(
        config: vscode.WorkspaceConfiguration,
        env: NodeJS.ProcessEnv
    ): Promise<string> {
        const command = this.resolveAcpxCommand(config);
        if (!this.isDefaultAcpxCommand(command)) {
            return command;
        }

        const fromCurrentEnv = await this.probeCommand(command, env);
        if (fromCurrentEnv) {
            return fromCurrentEnv;
        }

        const fromInteractiveShell = await this.probeCommand(command, env, 'interactive');
        if (fromInteractiveShell) {
            log.info(`resolved ${command} via interactive shell: ${fromInteractiveShell}`);
            return fromInteractiveShell;
        }

        const fromLoginShell = await this.probeCommand(command, env, 'login');
        if (fromLoginShell) {
            log.info(`resolved ${command} via login shell: ${fromLoginShell}`);
            return fromLoginShell;
        }

        return command;
    }

    private resolveAcpxCommand(config: vscode.WorkspaceConfiguration): string {
        const configuredPath = (config.get<string>('chat.acpxPath', '') ?? '').trim();
        if (configuredPath.length > 0) {
            return configuredPath;
        }

        const envOverride = (process.env.ACPX_PATH ?? '').trim();
        if (envOverride.length > 0) {
            return envOverride;
        }

        return 'acpx';
    }

    private isDefaultAcpxCommand(command: string): boolean {
        const normalized = command.trim().toLowerCase();
        return normalized === 'acpx' || normalized === 'acpx.exe';
    }

    private async probeCommand(
        command: string,
        env: NodeJS.ProcessEnv,
        shellMode: 'current' | 'interactive' | 'login' = 'current'
    ): Promise<string | null> {
        const escapedCommand = this.escapeShellWord(command);
        if (!escapedCommand) {
            return null;
        }

        try {
            if (process.platform === 'win32') {
                const { stdout } = await execFileAsync('where', [command], { env });
                return this.firstOutputLine(stdout);
            }

            if (shellMode !== 'current') {
                const shell = process.env.SHELL || '/bin/bash';
                const shellArgs = shellMode === 'interactive'
                    ? ['-ic', `command -v ${escapedCommand}`]
                    : ['-ilc', `command -v ${escapedCommand}`];
                const { stdout } = await execFileAsync(shell, shellArgs, { env });
                return this.firstOutputLine(stdout);
            }

            const { stdout } = await execFileAsync('sh', ['-c', `command -v ${escapedCommand}`], { env });
            return this.firstOutputLine(stdout);
        } catch {
            return null;
        }
    }

    private firstOutputLine(value: string | Buffer): string | null {
        const text = value.toString().trim();
        if (!text) {
            return null;
        }
        return text.split(/\r?\n/)[0]?.trim() || null;
    }

    private escapeShellWord(value: string): string | null {
        if (!value) {
            return null;
        }
        return `'${value.replace(/'/g, `'\\''`)}'`;
    }

    private buildSpawnEnv(): NodeJS.ProcessEnv {
        const env: NodeJS.ProcessEnv = { ...process.env };
        const nodeBinDir = dirname(process.execPath);
        const separator = process.platform === 'win32' ? ';' : ':';
        const currentPath = env.PATH ?? '';
        const pathEntries = currentPath.length > 0 ? currentPath.split(separator) : [];

        // Extensions can start with a stripped PATH; include Node's bin dir so
        // globally installed npm CLIs (including acpx) stay discoverable.
        if (nodeBinDir && !pathEntries.includes(nodeBinDir)) {
            env.PATH = currentPath.length > 0
                ? `${nodeBinDir}${separator}${currentPath}`
                : nodeBinDir;
        }

        return env;
    }

    abort(): void {
        if (this.activeProcess) {
            this.activeProcess.kill('SIGTERM');
            this.activeProcess = null;
        }
    }

    get isRunning(): boolean {
        return this.activeProcess !== null;
    }

    static getPermissionsForChatType(chatType: string, configuredPermissions: string): string {
        // Plain chat mode is intentionally read-only even if the global chat
        // permission setting is more permissive.
        if (chatType === 'chat') {
            return 'approve-reads';
        }
        return configuredPermissions;
    }

    private buildArgs(
        agentOrModel: string,
        permissions: string,
        prompt: string,
        sessionName: string,
        _options?: { thinkingLevel?: string; temperature?: number; maxTokens?: number }
    ): string[] {
        const args: string[] = [];

        args.push('--format', 'json');

        const permFlag = this.permissionFlag(permissions);
        if (permFlag) {
            args.push(permFlag);
        }

        const agentSelection = this.resolveAgentSelection(agentOrModel);
        if (agentSelection.modelOverride) {
            args.push('--model', agentSelection.modelOverride);
        }

        // Use explicit agent command so agent-scoped flags like --session are always valid.
        args.push(agentSelection.agent);

        const normalizedSession = sessionName.trim();
        if (normalizedSession) {
            args.push('--session', normalizedSession);
        }

        args.push('prompt', prompt);
        return args;
    }

    private resolveAgentSelection(value: string): { agent: string; modelOverride?: string } {
        const normalized = value.trim();
        if (!normalized) {
            return { agent: 'codex' };
        }

        const lower = normalized.toLowerCase();
        if (lower === 'ollama' || lower.startsWith('ollama:') || lower.startsWith('ollama/')) {
            return { agent: 'openclaw', modelOverride: normalized };
        }
        if (ChatService.KNOWN_ACPX_AGENTS.has(lower)) {
            return { agent: lower };
        }

        return { agent: 'codex', modelOverride: normalized };
    }

    private withActionableErrorHint(message: string, selectedModel: string): string {
        const lower = message.toLowerCase();
        if (lower.includes('credit balance is too low') || lower.includes('insufficient credits')) {
            return `${message}\n\nTip: switch OpenClaw Chat model to 'openclaw' or 'ollama' to use your local gateway/runtime instead of cloud credits.`;
        }

        if (lower.includes('exited with code 1') && selectedModel.toLowerCase() === 'ollama') {
            return `${message}\n\nTip: 'ollama' is routed through the 'openclaw' agent. Ensure openclaw gateway is running and configured for ollama.`;
        }

        return message;
    }

    private permissionFlag(permissions: string): string | null {
        switch (permissions) {
            case 'approve-all':
                return '--approve-all';
            case 'deny-all':
                return '--deny-all';
            case 'approve-reads':
            default:
                return '--approve-reads';
        }
    }

    private parseLine(line: string): ChatEvent | null {
        try {
            const obj = JSON.parse(line);
            const rpcEvent = this.mapJsonRpcEvent(obj as Record<string, unknown>);
            if (rpcEvent) {
                return rpcEvent;
            }
            return this.mapJsonEvent(obj);
        } catch {
            if (line.length > 0) {
                return { type: 'text', text: line + '\n' };
            }
            return null;
        }
    }

    private mapJsonRpcEvent(obj: Record<string, unknown>): ChatEvent | null {
        if (obj.jsonrpc !== '2.0') {
            return null;
        }

        const error = obj.error as Record<string, unknown> | undefined;
        if (error) {
            const message = this.extractText(error.message ?? error.data ?? error.code) ?? 'Unknown ACP error';
            return { type: 'error', message };
        }

        const method = obj.method as string | undefined;
        if (method === 'session/update') {
            const params = obj.params as Record<string, unknown> | undefined;
            const update = params?.update as Record<string, unknown> | undefined;
            const kind = update?.sessionUpdate as string | undefined;

            if (kind === 'agent_message_chunk') {
                const text = this.extractText(update?.content);
                if (text) {
                    return { type: 'text', text };
                }
            }

            if (kind === 'usage_update') {
                const used = Number(update?.used ?? 0);
                if (used > 0) {
                    return {
                        type: 'usage',
                        usage: {
                            promptTokens: 0,
                            completionTokens: 0,
                            totalTokens: used
                        }
                    };
                }
            }

            return null;
        }

        const result = obj.result as Record<string, unknown> | undefined;
        if (result?.usage && typeof result.usage === 'object') {
            const usage = result.usage as Record<string, unknown>;
            const promptTokens = Number(usage.inputTokens ?? usage.input_tokens ?? 0);
            const completionTokens = Number(usage.outputTokens ?? usage.output_tokens ?? 0);
            const totalTokens = Number(usage.totalTokens ?? promptTokens + completionTokens);
            return {
                type: 'usage',
                usage: {
                    promptTokens,
                    completionTokens,
                    totalTokens
                }
            };
        }

        return null;
    }

    private mapJsonEvent(obj: Record<string, unknown>): ChatEvent | null {
        const payload = this.unwrapEventPayload(obj);
        const eventType = payload.type as string | undefined;

        if (eventType === 'message' || eventType === 'content' || eventType === 'text') {
            const text = this.extractText(payload.content ?? payload.text ?? payload.data);
            if (text) {
                return { type: 'text', text };
            }
            return null;
        }

        if (eventType === 'content_block_delta' || eventType === 'delta') {
            const delta = payload.delta as Record<string, unknown> | undefined;
            const text = this.extractText(delta?.text ?? delta?.content ?? payload.text);
            if (text) {
                return { type: 'text', text };
            }
            return null;
        }

        if (eventType === 'tool_call' || eventType === 'tool_use') {
            const title = (payload.title ?? payload.name ?? payload.tool ?? 'tool') as string;
            const status = (payload.status ?? 'running') as string;
            return {
                type: 'toolCall',
                title,
                status,
                details: this.stringifyToolEvent(payload)
            };
        }

        if (eventType === 'tool_result') {
            const title = (payload.title ?? payload.name ?? payload.tool ?? 'tool') as string;
            return {
                type: 'toolCall',
                title,
                status: 'done',
                details: this.stringifyToolEvent(payload)
            };
        }

        if (eventType === 'error') {
            const message = this.extractText(payload.message ?? payload.error) ?? 'Unknown error';
            return { type: 'error', message };
        }

        if (eventType === 'done' || eventType === 'end' || eventType === 'complete') {
            return { type: 'done' };
        }

        if (eventType === 'assistant' || eventType === 'response') {
            const text = this.extractText(payload.content ?? payload.text ?? payload.message);
            if (text) {
                return { type: 'text', text };
            }
        }

        // Parse usage/token metadata from various event shapes
        if (eventType === 'usage' || eventType === 'message_stop' || payload.usage) {
            const usage = (payload.usage ?? payload) as Record<string, unknown>;
            const promptTokens = Number(usage.input_tokens ?? usage.prompt_tokens ?? usage.promptTokens ?? 0);
            const completionTokens = Number(usage.output_tokens ?? usage.completion_tokens ?? usage.completionTokens ?? 0);
            if (promptTokens > 0 || completionTokens > 0) {
                return {
                    type: 'usage',
                    usage: {
                        promptTokens,
                        completionTokens,
                        totalTokens: promptTokens + completionTokens
                    }
                };
            }
        }

        const inferredText = this.extractText(payload.text ?? payload.content ?? payload.message ?? payload.data);
        if (inferredText) {
            return { type: 'text', text: inferredText };
        }

        if (eventType) {
            log.debug(`acpx unhandled event type: ${eventType}`);
        }
        return null;
    }

    private unwrapEventPayload(obj: Record<string, unknown>): Record<string, unknown> {
        const nested = obj.event;
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
            return nested as Record<string, unknown>;
        }
        return obj;
    }

    private extractText(value: unknown): string | null {
        if (typeof value === 'string') {
            return value;
        }

        if (Array.isArray(value)) {
            const chunks = value
                .map((item) => this.extractText(item))
                .filter((item): item is string => Boolean(item));
            return chunks.length > 0 ? chunks.join('') : null;
        }

        if (!value || typeof value !== 'object') {
            return null;
        }

        const record = value as Record<string, unknown>;
        return this.extractText(
            record.text
            ?? record.content
            ?? record.message
            ?? record.data
            ?? record.delta
            ?? record.output_text
            ?? record.value
        );
    }

    private stringifyToolEvent(obj: Record<string, unknown>): string {
        try {
            return JSON.stringify(obj, null, 2);
        } catch {
            return '[unserializable tool event]';
        }
    }

    dispose(): void {
        this.abort();
    }
}
