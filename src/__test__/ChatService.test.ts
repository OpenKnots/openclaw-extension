import { EventEmitter } from 'events';
import * as vscode from 'vscode';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { spawnMock, execFileMock } = vi.hoisted(() => ({
    spawnMock: vi.fn(),
    execFileMock: vi.fn(),
}));

vi.mock('child_process', () => ({
    spawn: spawnMock,
    execFile: execFileMock,
}));

import { ChatService } from '../chat/ChatService';

function createFakeChildProcess() {
    const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        kill: ReturnType<typeof vi.fn>;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = vi.fn();
    return child;
}

describe('ChatService.getPermissionsForChatType', () => {
    it('forces chat mode to stay read-only', () => {
        expect(ChatService.getPermissionsForChatType('chat', 'approve-all')).toBe('approve-reads');
        expect(ChatService.getPermissionsForChatType('chat', 'deny-all')).toBe('approve-reads');
    });

    it('preserves configured permissions for non-chat modes', () => {
        expect(ChatService.getPermissionsForChatType('code', 'approve-all')).toBe('approve-all');
        expect(ChatService.getPermissionsForChatType('review', 'deny-all')).toBe('deny-all');
    });
});

describe('ChatService acpx resolution', () => {
    beforeEach(() => {
        spawnMock.mockReset();
        execFileMock.mockReset();
    });

    it('falls back to login shell when PATH probe fails', async () => {
        const fakeChild = createFakeChildProcess();
        spawnMock.mockReturnValue(fakeChild);

        const loginShell = process.env.SHELL || '/bin/bash';

        execFileMock.mockImplementation(
            (
                file: string,
                _args: string[],
                _options: unknown,
                callback: (error: Error | null, stdout: string, stderr: string) => void
            ) => {
                if (file === 'sh') {
                    callback(new Error('not found'), '', '');
                    return;
                }
                if (file === loginShell) {
                    if (_args[0] === '-ic') {
                        callback(null, '/home/paul/.nvm/versions/node/v22.23.0/bin/acpx\n', '');
                        return;
                    }
                    callback(null, '/home/paul/.local/bin/acpx\n', '');
                    return;
                }
                callback(new Error('unexpected'), '', '');
            }
        );

        const configGet = vi.fn((key: string, defaultValue?: unknown) => {
            if (key === 'chat.acpxPath') {
                return '';
            }
            return defaultValue;
        });
        vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
            get: configGet,
            update: vi.fn(),
        } as unknown as vscode.WorkspaceConfiguration);

        const service = new ChatService();
        const onEvent = vi.fn();

        service.sendMessage('hello', process.cwd(), 'codex', 'chat', onEvent);
        await new Promise((resolve) => setImmediate(resolve));

        expect(spawnMock).toHaveBeenCalledTimes(1);
        expect(execFileMock).toHaveBeenCalledWith(
            'sh',
            expect.arrayContaining(['-c']),
            expect.any(Object),
            expect.any(Function)
        );
        expect(execFileMock).toHaveBeenCalledWith(
            loginShell,
            expect.arrayContaining(['-ic']),
            expect.any(Object),
            expect.any(Function)
        );
    });
});

describe('ChatService event parsing', () => {
    it('extracts text from nested content arrays', () => {
        const service = new ChatService() as unknown as {
            mapJsonEvent: (obj: Record<string, unknown>) => { type: string; text?: string } | null;
        };

        const event = service.mapJsonEvent({
            type: 'message',
            content: [
                { type: 'text', text: 'Hello' },
                { type: 'text', text: ' world' }
            ]
        });

        expect(event).toEqual({ type: 'text', text: 'Hello world' });
    });

    it('extracts text from wrapped event payloads', () => {
        const service = new ChatService() as unknown as {
            mapJsonEvent: (obj: Record<string, unknown>) => { type: string; text?: string } | null;
        };

        const event = service.mapJsonEvent({
            event: {
                type: 'response',
                message: {
                    content: [{ text: 'Wrapped response' }]
                }
            }
        });

        expect(event).toEqual({ type: 'text', text: 'Wrapped response' });
    });

    it('extracts text from ACP JSON-RPC chunk updates', () => {
        const service = new ChatService() as unknown as {
            parseLine: (line: string) => { type: string; text?: string } | null;
        };

        const event = service.parseLine(JSON.stringify({
            jsonrpc: '2.0',
            method: 'session/update',
            params: {
                update: {
                    sessionUpdate: 'agent_message_chunk',
                    content: { type: 'text', text: 'Hello from RPC' }
                }
            }
        }));

        expect(event).toEqual({ type: 'text', text: 'Hello from RPC' });
    });
});

describe('ChatService arg building', () => {
    it('normalizes uppercase CODEX to default codex agent command', () => {
        const service = new ChatService() as unknown as {
            buildArgs: (agent: string, permissions: string, prompt: string) => string[];
        };

        const args = service.buildArgs('CODEX', 'approve-reads', 'Hello');
        expect(args).not.toContain('CODEX');
        expect(args).toEqual(['--format', 'json', '--approve-reads', 'exec', 'Hello']);
    });

    it('routes ollama model through openclaw agent', () => {
        const service = new ChatService() as unknown as {
            buildArgs: (agent: string, permissions: string, prompt: string) => string[];
        };

        const args = service.buildArgs('ollama', 'approve-reads', 'Hello');
        expect(args).toContain('openclaw');
        expect(args).toContain('--model');
        expect(args).toContain('ollama');
    });
});

describe('ChatService error hints', () => {
    it('adds local-runtime hint on low-credit errors', () => {
        const service = new ChatService() as unknown as {
            withActionableErrorHint: (message: string, selectedModel: string) => string;
        };

        const message = service.withActionableErrorHint('Internal error: Credit balance is too low', 'codex');
        expect(message).toContain("switch OpenClaw Chat model to 'openclaw' or 'ollama'");
    });
});
