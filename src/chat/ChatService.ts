import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';

const log = vscode.window.createOutputChannel('OpenClaw Agent', { log: true });

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

    private static readonly MODEL_SOURCE_MAP: Record<string, string> = {
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
        onEvent: (event: ChatEvent) => void
    ): void {
        this.abort();

        const config = vscode.workspace.getConfiguration('openclaw');
        const configuredPermissions = config.get<string>('chat.permissions', 'approve-reads');
        const permissions = ChatService.getPermissionsForChatType(chatType, configuredPermissions);

        const prefix = ChatService.CHAT_TYPE_PREFIXES[chatType] ?? '';
        const fullPrompt = prefix + prompt;

        const args = this.buildArgs(model, permissions, fullPrompt);

        log.info(`spawn acpx ${args.join(' ')} (cwd=${cwd})`);
        const child = spawn('acpx', args, {
            cwd,
            env: { ...process.env },
            stdio: ['ignore', 'pipe', 'pipe']
        });

        this.activeProcess = child;

        let stderrBuffer = '';
        let stdoutLineBuffer = '';

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
                    onEvent(event);
                }
            }

            if (this.activeProcess === child) {
                this.activeProcess = null;
            }

            if (code !== 0 && code !== null) {
                const errMsg = stderrBuffer.trim() || `acpx exited with code ${code}`;
                log.error(`acpx error: ${errMsg}`);
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
                    ? 'acpx not found. Install it with: npm i -g acpx'
                    : err.message
            });
            onEvent({ type: 'done' });
        });
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

    private buildArgs(agent: string, permissions: string, prompt: string): string[] {
        const args: string[] = [];

        args.push('--format', 'json');

        const permFlag = this.permissionFlag(permissions);
        if (permFlag) {
            args.push(permFlag);
        }

        if (agent && agent !== 'codex') {
            args.push(agent);
        }

        args.push('exec', prompt);
        return args;
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
            return this.mapJsonEvent(obj);
        } catch {
            if (line.length > 0) {
                return { type: 'text', text: line + '\n' };
            }
            return null;
        }
    }

    private mapJsonEvent(obj: Record<string, unknown>): ChatEvent | null {
        const eventType = obj.type as string | undefined;

        if (eventType === 'message' || eventType === 'content' || eventType === 'text') {
            const text = (obj.content ?? obj.text ?? obj.data ?? '') as string;
            if (text) {
                return { type: 'text', text };
            }
            return null;
        }

        if (eventType === 'content_block_delta' || eventType === 'delta') {
            const delta = obj.delta as Record<string, unknown> | undefined;
            const text = (delta?.text ?? delta?.content ?? obj.text ?? '') as string;
            if (text) {
                return { type: 'text', text };
            }
            return null;
        }

        if (eventType === 'tool_call' || eventType === 'tool_use') {
            const title = (obj.title ?? obj.name ?? obj.tool ?? 'tool') as string;
            const status = (obj.status ?? 'running') as string;
            return {
                type: 'toolCall',
                title,
                status,
                details: this.stringifyToolEvent(obj)
            };
        }

        if (eventType === 'tool_result') {
            const title = (obj.title ?? obj.name ?? obj.tool ?? 'tool') as string;
            return {
                type: 'toolCall',
                title,
                status: 'done',
                details: this.stringifyToolEvent(obj)
            };
        }

        if (eventType === 'error') {
            return { type: 'error', message: (obj.message ?? obj.error ?? 'Unknown error') as string };
        }

        if (eventType === 'done' || eventType === 'end' || eventType === 'complete') {
            return { type: 'done' };
        }

        if (eventType === 'assistant' || eventType === 'response') {
            const text = (obj.content ?? obj.text ?? obj.message ?? '') as string;
            if (text) {
                return { type: 'text', text };
            }
        }

        // Parse usage/token metadata from various event shapes
        if (eventType === 'usage' || eventType === 'message_stop' || obj.usage) {
            const usage = (obj.usage ?? obj) as Record<string, unknown>;
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

        if (typeof obj.text === 'string' && obj.text) {
            return { type: 'text', text: obj.text };
        }

        return null;
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
