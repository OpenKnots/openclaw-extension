import { describe, it, expect } from 'vitest';
import {
    SLASH_COMMANDS,
    findCommand,
    filterCommands,
    buildSlashPrompt,
} from '../chat/slashCommands';

describe('SLASH_COMMANDS', () => {
    it('has at least 5 commands', () => {
        expect(SLASH_COMMANDS.length).toBeGreaterThanOrEqual(5);
    });

    it('every command has required fields', () => {
        for (const cmd of SLASH_COMMANDS) {
            expect(cmd.name).toBeTruthy();
            expect(cmd.description).toBeTruthy();
            expect(cmd.icon).toBeTruthy();
            expect(cmd.contextType).toBeTruthy();
            expect(cmd.placeholder).toBeTruthy();
        }
    });

    it('command names are unique', () => {
        const names = SLASH_COMMANDS.map(c => c.name);
        expect(new Set(names).size).toBe(names.length);
    });
});

describe('findCommand', () => {
    it('returns matching command', () => {
        const cmd = findCommand('explain');
        expect(cmd).toBeDefined();
        expect(cmd!.name).toBe('explain');
    });

    it('returns undefined for unknown command', () => {
        expect(findCommand('nonexistent')).toBeUndefined();
    });
});

describe('filterCommands', () => {
    it('returns all commands for empty query', () => {
        expect(filterCommands('').length).toBe(SLASH_COMMANDS.length);
    });

    it('filters by prefix', () => {
        const results = filterCommands('ex');
        expect(results.length).toBe(1);
        expect(results[0].name).toBe('explain');
    });

    it('returns empty for no match', () => {
        expect(filterCommands('zzz')).toEqual([]);
    });
});

describe('buildSlashPrompt', () => {
    it('returns userText for unknown command', () => {
        expect(buildSlashPrompt('unknown', 'hello', {})).toBe('hello');
    });

    it('includes instruction for known command', () => {
        const prompt = buildSlashPrompt('explain', '', {});
        expect(prompt).toContain('Explain');
    });

    it('includes file context when provided', () => {
        const prompt = buildSlashPrompt('explain', '', {
            filePath: 'src/foo.ts',
            languageId: 'typescript',
            selection: 'const x = 1;',
        });
        expect(prompt).toContain('src/foo.ts');
        expect(prompt).toContain('const x = 1;');
    });

    it('includes user text when provided', () => {
        const prompt = buildSlashPrompt('fix', 'fix the null check', {});
        expect(prompt).toContain('fix the null check');
    });

    it('includes diagnostics for /fix context', () => {
        const prompt = buildSlashPrompt('fix', '', {
            filePath: 'app.ts',
            diagnostics: '[Error] Line 5: missing semicolon',
        });
        expect(prompt).toContain('missing semicolon');
    });

    it('includes git diff for /review context', () => {
        const prompt = buildSlashPrompt('review', '', {
            gitDiff: '+const a = 1;\n-const b = 2;',
        });
        expect(prompt).toContain('+const a = 1;');
    });
});
