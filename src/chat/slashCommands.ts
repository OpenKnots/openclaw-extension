export type ContextType =
    | 'selection'
    | 'file'
    | 'diagnostics'
    | 'gitDiff'
    | 'gitStaged'
    | 'none';

export interface SlashCommand {
    name: string;
    description: string;
    icon: string;
    contextType: ContextType;
    placeholder: string;
}

export interface EditorContext {
    filePath?: string;
    fileName?: string;
    languageId?: string;
    selection?: string;
    fileContent?: string;
    diagnostics?: string;
    gitDiff?: string;
    gitStaged?: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
    {
        name: 'explain',
        description: 'Explain code or concept',
        icon: '\u{1F4A1}',
        contextType: 'selection',
        placeholder: 'What should I explain?',
    },
    {
        name: 'fix',
        description: 'Fix issues in code',
        icon: '\u{1F527}',
        contextType: 'diagnostics',
        placeholder: 'Describe the issue, or leave blank to fix diagnostics',
    },
    {
        name: 'review',
        description: 'Code review',
        icon: '\u{1F50D}',
        contextType: 'gitDiff',
        placeholder: 'Any review focus? Leave blank for general review',
    },
    {
        name: 'test',
        description: 'Generate tests',
        icon: '\u{2713}',
        contextType: 'selection',
        placeholder: 'What should I test?',
    },
    {
        name: 'refactor',
        description: 'Suggest improvements',
        icon: '\u{21BB}',
        contextType: 'selection',
        placeholder: 'What to refactor? Leave blank to analyze selection',
    },
    {
        name: 'doc',
        description: 'Generate documentation',
        icon: '\u{1F4DD}',
        contextType: 'selection',
        placeholder: 'What to document?',
    },
    {
        name: 'commit',
        description: 'Generate commit message',
        icon: '\u{1F4E6}',
        contextType: 'gitStaged',
        placeholder: 'Any commit guidelines?',
    },
    {
        name: 'harden',
        description: 'Security analysis',
        icon: '\u{1F6E1}',
        contextType: 'file',
        placeholder: 'Security focus? Leave blank for full analysis',
    },
    {
        name: 'search',
        description: 'Search codebase',
        icon: '\u{1F50E}',
        contextType: 'none',
        placeholder: 'What are you looking for?',
    },
];

const COMMAND_INSTRUCTIONS: Record<string, string> = {
    explain:
        'Explain the following code clearly and concisely. Cover what it does, how it works, and any notable patterns or potential issues.',
    fix:
        'Identify and fix the issues in the following code. Show the corrected code and explain each fix.',
    review:
        'Perform a thorough code review. Check for bugs, security issues, performance problems, and style. Provide actionable feedback.',
    test:
        'Generate comprehensive tests for the following code. Cover happy paths, edge cases, and error conditions. Use the project\'s existing test framework if detectable.',
    refactor:
        'Suggest refactoring improvements for the following code. Focus on readability, maintainability, and performance. Show the refactored code.',
    doc:
        'Generate clear, complete documentation for the following code. Include descriptions, parameter docs, return values, and usage examples where appropriate.',
    commit:
        'Generate a concise, conventional commit message for the following staged changes. Use the format: type(scope): description. Include a body if the changes are complex.',
    harden:
        'Perform a security analysis of the following code. Identify vulnerabilities, insecure patterns, and suggest hardening improvements with corrected code.',
    search:
        'Search the codebase to answer the following question.',
};

function formatContext(ctx: EditorContext, contextType: ContextType): string {
    const parts: string[] = [];

    if (ctx.filePath) {
        parts.push(`File: ${ctx.filePath}`);
    }
    if (ctx.languageId) {
        parts.push(`Language: ${ctx.languageId}`);
    }

    switch (contextType) {
        case 'selection':
            if (ctx.selection) {
                parts.push(`\n--- Selected Code ---\n${ctx.selection}\n---`);
            } else if (ctx.fileContent) {
                parts.push(`\n--- File Content ---\n${ctx.fileContent}\n---`);
            }
            break;
        case 'file':
            if (ctx.fileContent) {
                parts.push(`\n--- File Content ---\n${ctx.fileContent}\n---`);
            }
            break;
        case 'diagnostics':
            if (ctx.selection) {
                parts.push(`\n--- Code ---\n${ctx.selection}\n---`);
            } else if (ctx.fileContent) {
                parts.push(`\n--- File Content ---\n${ctx.fileContent}\n---`);
            }
            if (ctx.diagnostics) {
                parts.push(`\n--- Diagnostics ---\n${ctx.diagnostics}\n---`);
            }
            break;
        case 'gitDiff':
            if (ctx.gitDiff) {
                parts.push(`\n--- Git Diff ---\n${ctx.gitDiff}\n---`);
            } else if (ctx.fileContent) {
                parts.push(`\n--- File Content ---\n${ctx.fileContent}\n---`);
            }
            break;
        case 'gitStaged':
            if (ctx.gitStaged) {
                parts.push(`\n--- Staged Changes ---\n${ctx.gitStaged}\n---`);
            }
            break;
        case 'none':
            break;
    }

    return parts.join('\n');
}

export function buildSlashPrompt(
    commandName: string,
    userText: string,
    context: EditorContext
): string {
    const cmd = SLASH_COMMANDS.find(c => c.name === commandName);
    if (!cmd) {
        return userText;
    }

    const instruction = COMMAND_INSTRUCTIONS[commandName] ?? '';
    const contextBlock = formatContext(context, cmd.contextType);

    const sections: string[] = [];
    if (instruction) {
        sections.push(instruction);
    }
    if (contextBlock) {
        sections.push(contextBlock);
    }
    if (userText.trim()) {
        sections.push(`User request: ${userText.trim()}`);
    }

    return sections.join('\n\n');
}

export function findCommand(name: string): SlashCommand | undefined {
    return SLASH_COMMANDS.find(c => c.name === name);
}

export function filterCommands(query: string): SlashCommand[] {
    const q = query.toLowerCase();
    return SLASH_COMMANDS.filter(c => c.name.startsWith(q));
}
