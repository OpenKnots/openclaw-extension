import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify, TextDecoder, TextEncoder } from 'util';
import { ChatViewProvider } from './chat/ChatViewProvider';

let statusBarItem: vscode.StatusBarItem;
let terminal: vscode.Terminal | undefined;
let setupTerminal: vscode.Terminal | undefined;
let hardeningTerminal: vscode.Terminal | undefined;
let isConnecting = false;
let overviewProvider: OverviewTreeProvider | undefined;
let chatViewProvider: ChatViewProvider | undefined;

const log = vscode.window.createOutputChannel('OpenClaw', { log: true });

const execAsync = promisify(exec);
const OPENCLAW_DOCS_URL = 'https://docs.openclaw.ai/';
const OPENCLAW_ONBOARD_DOCS_URL = 'https://docs.openclaw.ai/start/wizard';
const OPENCLAW_DASHBOARD_URL = 'http://127.0.0.1:18789/';
const OPENCLAW_UPDATE_DOCS_URL = 'https://docs.openclaw.ai/install/updating';
const OPENCLAW_SECURITY_DOCS_URL = 'https://docs.openclaw.ai/gateway/security';
const OPENCLAW_INSTALL_SCRIPT = 'curl -fsSL https://openclaw.ai/install.sh | bash';
const OPENCLAW_INSTALL_PS1 = 'iwr -useb https://openclaw.ai/install.ps1 | iex';
const OPENCLAW_NPM_INSTALL = 'npm install -g openclaw@latest';
const OPENCLAW_PROVIDERS_DOCS_URL = 'https://docs.openclaw.ai/providers';
const PROVIDER_DOCS: Record<string, string> = {
    openai: 'https://docs.openclaw.ai/providers/openai',
    anthropic: 'https://docs.openclaw.ai/providers/anthropic',
    google: 'https://docs.openclaw.ai/providers/google',
    ollama: 'https://docs.openclaw.ai/providers/ollama',
    local: 'https://docs.openclaw.ai/pi'
};
const LEGACY_CLI_ALIASES = new Set(['molt', 'molt.exe', 'clawdbot', 'clawdbot.exe']);
const STATUS_LABEL = 'OpenClaw';
type QuickPickOption<T extends string> = vscode.QuickPickItem & { value: T };
type HardeningMode = 'full' | 'audit' | 'auditFix';
type AccessSummary = {
    short: string;
    markdown: string;
    generatedAt: Date;
};

type AccessInfo = {
    mcpServers: string[];
    tools: string[];
    keySources: string[];
    networkEndpoints: string[];
    localFiles: string[];
    notes: string[];
};

type ToolEntry = {
    id: string;
    label: string;
    enabled: boolean;
    path: Array<string | number>;
    source: string;
    description?: string;
};

export function activate(context: vscode.ExtensionContext) {
    log.info('activate() start');

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'openclaw.connect';
    statusBarItem.name = STATUS_LABEL;
    statusBarItem.accessibilityInformation = {
        label: STATUS_LABEL,
        role: 'button'
    };
    setStatus('idle');
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    log.info('status bar created');

    // Register connect command
    let connectCommand = vscode.commands.registerCommand('openclaw.connect', async () => {
        await connect();
    });
    context.subscriptions.push(connectCommand);

    // Register setup command
    let setupCommand = vscode.commands.registerCommand('openclaw.setup', async () => {
        await runSetupFlow();
    });
    context.subscriptions.push(setupCommand);

    let modelSetupCommand = vscode.commands.registerCommand('openclaw.modelSetup', async () => {
        await runModelSetupWizard();
    });
    context.subscriptions.push(modelSetupCommand);

    let openDocsCommand = vscode.commands.registerCommand('openclaw.openDocs', async () => {
        await openDocs();
    });
    context.subscriptions.push(openDocsCommand);

    let hardenCommand = vscode.commands.registerCommand('openclaw.harden', async () => {
        await runHardeningFlow();
    });
    context.subscriptions.push(hardenCommand);

    let hardeningRefreshCommand = vscode.commands.registerCommand('openclaw.hardening.refresh', async () => {
        await overviewProvider?.refreshTools();
    });
    context.subscriptions.push(hardeningRefreshCommand);

    let hardeningOpenConfigCommand = vscode.commands.registerCommand('openclaw.hardening.openConfig', async () => {
        await openOpenClawConfig(true);
    });
    context.subscriptions.push(hardeningOpenConfigCommand);

    let hardeningOpenDocsCommand = vscode.commands.registerCommand('openclaw.hardening.openDocs', async () => {
        await openSecurityDocs();
    });
    context.subscriptions.push(hardeningOpenDocsCommand);

    let hardeningOpenDashboardCommand = vscode.commands.registerCommand(
        'openclaw.hardening.openDashboard',
        async () => {
            await openDashboard();
        }
    );
    context.subscriptions.push(hardeningOpenDashboardCommand);

    let hardeningRunStatusCommand = vscode.commands.registerCommand('openclaw.hardening.runStatus', async () => {
        await runHardeningStatusCheck();
    });
    context.subscriptions.push(hardeningRunStatusCommand);

    let hardeningAccessSummaryCommand = vscode.commands.registerCommand(
        'openclaw.hardening.showAccessSummary',
        async () => {
            await showHardeningAccessSummary();
        }
    );
    context.subscriptions.push(hardeningAccessSummaryCommand);

    let doctorCommand = vscode.commands.registerCommand('openclaw.doctor', async () => {
        await runCliInTerminal('openclaw doctor', 'Running openclaw doctor.');
    });
    context.subscriptions.push(doctorCommand);

    let updateCommand = vscode.commands.registerCommand('openclaw.update', async () => {
        await runCliInTerminal('openclaw update', 'Running openclaw update.');
    });
    context.subscriptions.push(updateCommand);

    let configureCommand = vscode.commands.registerCommand('openclaw.configure', async () => {
        await runCliInTerminal('openclaw configure', 'Running openclaw configure.');
    });
    context.subscriptions.push(configureCommand);

    let toolsRefreshCommand = vscode.commands.registerCommand('openclaw.tools.refresh', async () => {
        await overviewProvider?.refreshTools();
    });
    context.subscriptions.push(toolsRefreshCommand);

    let toolsToggleCommand = vscode.commands.registerCommand(
        'openclaw.tools.toggle',
        async (tool: ToolEntry) => {
            await toggleToolEntry(tool);
        }
    );
    context.subscriptions.push(toolsToggleCommand);

    let toolsUninstallCommand = vscode.commands.registerCommand(
        'openclaw.tools.uninstall',
        async (tool: ToolEntry) => {
            await uninstallToolEntry(tool);
        }
    );
    context.subscriptions.push(toolsUninstallCommand);

    log.info('commands registered');

    overviewProvider = new OverviewTreeProvider();
    const overviewView = vscode.window.createTreeView('openclaw.overview', {
        treeDataProvider: overviewProvider
    });
    context.subscriptions.push(overviewView);
    void overviewProvider.refreshTools();
    log.info('overview tree view created');

    chatViewProvider = new ChatViewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatViewProvider)
    );
    log.info('chat view provider registered');

    context.subscriptions.push(
        vscode.commands.registerCommand('openclaw.chat.open', () => {
            vscode.commands.executeCommand(`${ChatViewProvider.viewType}.focus`);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('openclaw.chat.popOut', () => {
            chatViewProvider?.popOut();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('openclaw.chat.newSession', () => {
            chatViewProvider?.newSession();
        })
    );

    // Check auto-connect setting
    const config = vscode.workspace.getConfiguration('openclaw');
    const autoConnect = config.get<boolean>('autoConnect', false);

    if (autoConnect) {
        log.info('auto-connect enabled, scheduling connect');
        setTimeout(() => {
            connect();
        }, 1000);
    }

    const terminalClosedDisposable = vscode.window.onDidCloseTerminal((closedTerminal) => {
        if (terminal && closedTerminal === terminal) {
            terminal = undefined;
            setStatus('idle');
        }
        if (setupTerminal && closedTerminal === setupTerminal) {
            setupTerminal = undefined;
        }
        if (hardeningTerminal && closedTerminal === hardeningTerminal) {
            hardeningTerminal = undefined;
        }
    });
    context.subscriptions.push(terminalClosedDisposable);

    log.info(`activate() complete — ${context.subscriptions.length} subscriptions`);
}

async function connect() {
    if (isConnecting) {
        vscode.window.showInformationMessage('OpenClaw connection is already in progress.');
        return;
    }

    isConnecting = true;
    log.info('connect() start');
    try {
        setStatus('connecting');

        const platform = os.platform();
        const isWindows = platform === 'win32';

        const config = vscode.workspace.getConfiguration('openclaw');
        const configuredCommand = (config.get<string>('command') ?? '').trim();
        const defaultCommand = isWindows ? 'openclaw status' : 'openclaw status';
        let command = configuredCommand.length > 0 ? configuredCommand : defaultCommand;

        if (!command) {
            setStatus('idle');
            vscode.window.showErrorMessage('OpenClaw command is empty. Update OpenClaw: Command in settings.');
            return;
        }

        let executable = command.split(/\s+/)[0];
        const legacyExecutable = getLegacyExecutable(executable);
        if (legacyExecutable) {
            const updatedCommand = await handleLegacyMigration(command, legacyExecutable);
            if (!updatedCommand) {
                setStatus('idle');
                return;
            }
            command = updatedCommand;
            executable = command.split(/\s+/)[0];
        }
        const needsNode = executable === 'openclaw' || executable === 'openclaw.exe';
        if (needsNode) {
            const hasNode = await isCommandAvailable('node');
            if (!hasNode) {
                setStatus('idle');
                await showMissingNodeMessage();
                return;
            }
        }

        const available = await isCommandAvailable(executable);
        if (!available) {
            setStatus('idle');
            const legacyAvailable = await findAvailableLegacyCli();
            if (legacyAvailable) {
                await showLegacyMissingOpenClawMessage(legacyAvailable);
                return;
            }
            const action = await vscode.window.showErrorMessage(
                `Command not found: ${executable}. Install OpenClaw or update OpenClaw: Command in settings.`,
                'Install CLI',
                'More options...'
            );

            if (action === 'Install CLI') {
                await runSetupFlow();
            } else if (action === 'More options...') {
                const pick = await showInstallMoreOptions();
                if (pick === 'copy') {
                    await copyInstallCommand();
                } else if (pick === 'docs') {
                    await openDocs();
                } else if (pick === 'settings') {
                    await openSettings();
                }
            }
            return;
        }

        // Create or reuse terminal
        if (!terminal) {
            terminal = vscode.window.createTerminal('OpenClaw');
        }

        // Show terminal and send command
        terminal.show(true); // true = preserve focus
        terminal.sendText(command);

        // Update status to connected
        setStatus('connected');

        vscode.window.showInformationMessage('OpenClaw command sent.');
    } catch (error) {
        setStatus('error');
        log.error('connect() failed', error);
        vscode.window.showErrorMessage(`Failed to connect: ${error}`);
    } finally {
        isConnecting = false;
    }
}

async function runHardeningFlow() {
    const readiness = await ensureHardeningCommandReady();
    if (!readiness) {
        return;
    }

    const { prefix, mode } = readiness;
    const commands: string[] = [];

    commands.push(`${prefix} security audit`);
    if (mode === 'auditFix' || mode === 'full') {
        commands.push(`${prefix} security audit --fix`);
    }
    if (mode === 'full') {
        commands.push(`${prefix} security audit --deep`);
    }

    const terminalInstance = getHardeningTerminal();
    terminalInstance.show(true);
    for (const command of commands) {
        terminalInstance.sendText(command);
    }

    overviewProvider?.setLastRun(new Date());
    vscode.window.showInformationMessage('OpenClaw hardening commands sent. Review the terminal output.');
}

async function runHardeningStatusCheck() {
    const readiness = await ensureHardeningCommandReady();
    if (!readiness) {
        return;
    }
    const terminalInstance = getHardeningTerminal();
    terminalInstance.show(true);
    terminalInstance.sendText(`${readiness.prefix} status --all`);
    vscode.window.showInformationMessage('Running OpenClaw status --all.');
}

async function showHardeningAccessSummary() {
    const readiness = await ensureHardeningCommandReady();
    if (!readiness) {
        return;
    }

    const summary = await buildHardeningAccessSummary(readiness.prefix);
    overviewProvider?.setAccessSummary(summary);

    const document = await vscode.workspace.openTextDocument({
        content: summary.markdown,
        language: 'markdown'
    });
    await vscode.window.showTextDocument(document, { preview: true });
}

async function buildHardeningAccessSummary(prefix: string): Promise<AccessSummary> {
    const configPath = getOpenClawConfigPath();
    const configResult = await readOpenClawConfig(configPath);
    const configInfo = extractAccessInfoFromConfig(configResult.config, configPath);

    const cliResult = await runStatusAll(prefix);
    const cliInfo = extractAccessInfoFromCli(cliResult.output);

    const combined = mergeAccessInfo(configInfo, cliInfo);
    combined.networkEndpoints = uniqueList([...combined.networkEndpoints, OPENCLAW_DASHBOARD_URL]);

    const short = formatAccessSummaryShort(combined, configResult.error, cliResult.error);
    const markdown = formatAccessSummaryMarkdown(
        combined,
        configResult.error,
        cliResult.error,
        cliResult.output,
        configPath
    );

    return { short, markdown, generatedAt: new Date() };
}

async function runStatusAll(prefix: string): Promise<{ output?: string; error?: string }> {
    try {
        const { stdout, stderr } = await execAsync(`${prefix} status --all`, {
            maxBuffer: 1024 * 1024
        });
        const output = [stdout, stderr].filter(Boolean).join('\n').trim();
        return { output: output.length > 0 ? output : undefined };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { error: message };
    }
}

async function readOpenClawConfig(
    configPath: string
): Promise<{ config: unknown | null; error?: string }> {
    const uri = vscode.Uri.file(configPath);
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const decoder = new TextDecoder();
        const contents = decoder.decode(raw);
        if (!contents.trim()) {
            return { config: null, error: 'Config file is empty.' };
        }
        return { config: JSON.parse(contents) };
    } catch (error) {
        if (error instanceof Error && 'code' in error) {
            return { config: null, error: 'Config file not found.' };
        }
        return { config: null, error: 'Unable to read config file.' };
    }
}

function getOpenClawConfigPath() {
    return path.join(os.homedir(), '.openclaw', 'openclaw.json');
}

async function loadOpenClawConfigRecord(): Promise<{
    config: Record<string, unknown> | null;
    error?: string;
    path: string;
}> {
    const configPath = getOpenClawConfigPath();
    const result = await readOpenClawConfig(configPath);
    if (!result.config || !isRecord(result.config)) {
        return {
            config: null,
            error: result.error ?? 'Config file not found.',
            path: configPath
        };
    }
    return { config: result.config, error: result.error, path: configPath };
}

async function writeOpenClawConfigRecord(configPath: string, config: Record<string, unknown>) {
    const encoder = new TextEncoder();
    const contents = `${JSON.stringify(config, null, 2)}\n`;
    await vscode.workspace.fs.writeFile(vscode.Uri.file(configPath), encoder.encode(contents));
}

function getValueAtPath(root: unknown, pathSegments: Array<string | number>) {
    let current = root;
    for (const segment of pathSegments) {
        if (Array.isArray(current) && typeof segment === 'number') {
            if (segment < 0 || segment >= current.length) {
                return undefined;
            }
            current = current[segment];
            continue;
        }
        if (isRecord(current) && typeof segment === 'string') {
            if (!(segment in current)) {
                return undefined;
            }
            current = current[segment];
            continue;
        }
        return undefined;
    }
    return current;
}

function getParentAtPath(
    root: unknown,
    pathSegments: Array<string | number>
): { parent: Record<string, unknown> | unknown[]; key: string | number } | null {
    if (pathSegments.length === 0) {
        return null;
    }
    const parentPath = pathSegments.slice(0, -1);
    const key = pathSegments[pathSegments.length - 1];
    const parent = getValueAtPath(root, parentPath);
    if (Array.isArray(parent) && typeof key === 'number') {
        return { parent, key };
    }
    if (isRecord(parent) && typeof key === 'string') {
        return { parent, key };
    }
    return null;
}

function getToolEnabled(entry: unknown) {
    if (isRecord(entry) && typeof entry.enabled === 'boolean') {
        return entry.enabled;
    }
    return true;
}

function getToolDescription(entry: unknown) {
    if (!isRecord(entry)) {
        return undefined;
    }
    return (
        asString(entry.description) ??
        asString(entry.summary) ??
        asString(entry.purpose) ??
        asString(entry.details)
    );
}

function collectToolEntries(config: Record<string, unknown>): ToolEntry[] {
    const entries: ToolEntry[] = [];
    const sources: Array<{
        source: string;
        basePath: Array<string | number>;
        value: unknown;
    }> = [
        { source: 'tools', basePath: ['tools'], value: config.tools },
        {
            source: 'mcp.tools',
            basePath: ['mcp', 'tools'],
            value: isRecord(config.mcp) ? config.mcp.tools : undefined
        },
        {
            source: 'capabilities.tools',
            basePath: ['capabilities', 'tools'],
            value: isRecord(config.capabilities) ? config.capabilities.tools : undefined
        }
    ];

    for (const source of sources) {
        if (Array.isArray(source.value)) {
            source.value.forEach((entry, index) => {
                const label = formatNamedEntry(entry) || `Tool ${index + 1}`;
                entries.push({
                    id: `${source.source}:${source.basePath.join('.')}:${index}`,
                    label,
                    enabled: getToolEnabled(entry),
                    description: getToolDescription(entry),
                    path: [...source.basePath, index],
                    source: source.source
                });
            });
        } else if (isRecord(source.value)) {
            for (const [name, entry] of Object.entries(source.value)) {
                const label = formatNamedEntry(entry, name) || name;
                entries.push({
                    id: `${source.source}:${source.basePath.join('.')}:${name}`,
                    label,
                    enabled: getToolEnabled(entry),
                    description: getToolDescription(entry),
                    path: [...source.basePath, name],
                    source: source.source
                });
            }
        }
    }

    return entries.sort((a, b) => a.label.localeCompare(b.label));
}

async function loadToolsForOverview(): Promise<{ entries: ToolEntry[]; error?: string }> {
    const { config, error } = await loadOpenClawConfigRecord();
    if (!config) {
        return { entries: [], error };
    }
    return { entries: collectToolEntries(config), error };
}

async function toggleToolEntry(tool: ToolEntry) {
    const { config, error, path: configPath } = await loadOpenClawConfigRecord();
    if (!config) {
        vscode.window.showErrorMessage(error ?? 'OpenClaw config not found.');
        return;
    }
    const parentInfo = getParentAtPath(config, tool.path);
    if (!parentInfo) {
        vscode.window.showErrorMessage(`Unable to locate tool "${tool.label}" in config.`);
        return;
    }
    const { parent, key } = parentInfo;
    const current =
        Array.isArray(parent) && typeof key === 'number'
            ? parent[key]
            : isRecord(parent) && typeof key === 'string'
            ? parent[key]
            : undefined;
    if (typeof current === 'undefined') {
        vscode.window.showErrorMessage(`Unable to locate tool "${tool.label}" in config.`);
        return;
    }
    const currentlyEnabled = getToolEnabled(current);
    const nextEnabled = !currentlyEnabled;
    let nextEntry = current;

    if (typeof current === 'string') {
        if (!nextEnabled) {
            nextEntry = { name: current, enabled: false };
        }
    } else if (isRecord(current)) {
        nextEntry = { ...current, enabled: nextEnabled };
    } else {
        vscode.window.showErrorMessage(`Tool "${tool.label}" has an unsupported format.`);
        return;
    }

    if (Array.isArray(parent) && typeof key === 'number') {
        parent[key] = nextEntry as unknown;
    } else if (isRecord(parent) && typeof key === 'string') {
        parent[key] = nextEntry as unknown;
    }

    await writeOpenClawConfigRecord(configPath, config);
    overviewProvider?.refreshTools();
    vscode.window.showInformationMessage(
        `${nextEnabled ? 'Enabled' : 'Disabled'} tool "${tool.label}".`
    );
}

async function uninstallToolEntry(tool: ToolEntry) {
    const { config, error, path: configPath } = await loadOpenClawConfigRecord();
    if (!config) {
        vscode.window.showErrorMessage(error ?? 'OpenClaw config not found.');
        return;
    }
    const parentInfo = getParentAtPath(config, tool.path);
    if (!parentInfo) {
        vscode.window.showErrorMessage(`Unable to locate tool "${tool.label}" in config.`);
        return;
    }

    const action = await vscode.window.showWarningMessage(
        `Remove "${tool.label}" from OpenClaw tools?`,
        { modal: true },
        'Remove'
    );
    if (action !== 'Remove') {
        return;
    }

    const { parent, key } = parentInfo;
    if (Array.isArray(parent) && typeof key === 'number') {
        parent.splice(key, 1);
    } else if (isRecord(parent) && typeof key === 'string') {
        delete parent[key];
    }

    await writeOpenClawConfigRecord(configPath, config);
    overviewProvider?.refreshTools();
    vscode.window.showInformationMessage(`Removed tool "${tool.label}".`);
}

function extractAccessInfoFromConfig(config: unknown, configPath: string): AccessInfo {
    const info = createEmptyAccessInfo();
    info.localFiles.push(configPath);

    if (!isRecord(config)) {
        return info;
    }

    info.mcpServers = extractMcpServers(config);
    info.tools = extractTools(config);

    const keySources = new Set<string>();
    const localFiles = new Set<string>(info.localFiles);
    const endpoints = new Set<string>();
    const notes = new Set<string>();

    scanAccessInfo(config, [], keySources, localFiles, endpoints, notes);

    info.keySources = uniqueList([...keySources]);
    info.localFiles = uniqueList([...localFiles]);
    info.networkEndpoints = uniqueList([...endpoints]);
    info.notes = uniqueList([...notes]);

    return info;
}

function extractAccessInfoFromCli(output?: string): AccessInfo {
    const info = createEmptyAccessInfo();
    if (!output) {
        return info;
    }
    const urls = output.match(/https?:\/\/\S+/g) ?? [];
    info.networkEndpoints = uniqueList(urls);
    return info;
}

function mergeAccessInfo(base: AccessInfo, extra: AccessInfo): AccessInfo {
    return {
        mcpServers: uniqueList([...base.mcpServers, ...extra.mcpServers]),
        tools: uniqueList([...base.tools, ...extra.tools]),
        keySources: uniqueList([...base.keySources, ...extra.keySources]),
        networkEndpoints: uniqueList([...base.networkEndpoints, ...extra.networkEndpoints]),
        localFiles: uniqueList([...base.localFiles, ...extra.localFiles]),
        notes: uniqueList([...base.notes, ...extra.notes])
    };
}

function formatAccessSummaryShort(info: AccessInfo, configError?: string, cliError?: string) {
    const parts: string[] = [];
    if (info.mcpServers.length > 0) {
        parts.push(`MCP: ${info.mcpServers.length}`);
    }
    if (info.tools.length > 0) {
        parts.push(`Tools: ${info.tools.length}`);
    }
    if (info.keySources.length > 0) {
        const keyTypes = summarizeKeySources(info.keySources);
        parts.push(`Keys: ${keyTypes}`);
    }
    if (parts.length === 0) {
        parts.push('Not generated yet');
    }
    if (configError) {
        parts.push('Config unavailable');
    }
    if (cliError) {
        parts.push('CLI error');
    }
    return parts.join(' | ');
}

function formatAccessSummaryMarkdown(
    info: AccessInfo,
    configError?: string,
    cliError?: string,
    cliOutput?: string,
    configPath?: string
) {
    const lines: string[] = [];
    lines.push('# OpenClaw access summary');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('');

    if (configError) {
        lines.push(`Config issue: ${configError}`);
        lines.push('');
    }
    if (cliError) {
        lines.push(`CLI issue: ${cliError}`);
        lines.push('');
    }

    lines.push('## MCP servers');
    lines.push(formatList(info.mcpServers, 'No MCP servers detected in config or CLI output.'));
    lines.push('');

    lines.push('## Tools');
    lines.push(formatList(info.tools, 'No tools detected in config.'));
    lines.push('');

    lines.push('## Keys and credentials');
    lines.push(
        formatList(
            info.keySources,
            'No key sources detected. If you use environment variables, they may not appear in config.'
        )
    );
    lines.push('');

    lines.push('## Network endpoints');
    lines.push(formatList(info.networkEndpoints, 'No network endpoints detected.'));
    lines.push('');

    lines.push('## Local files');
    const files = configPath ? uniqueList([configPath, ...info.localFiles]) : info.localFiles;
    lines.push(formatList(files, 'No local files detected.'));
    lines.push('');

    if (info.notes.length > 0) {
        lines.push('## Notes');
        lines.push(formatList(info.notes, ''));
        lines.push('');
    }

    lines.push('## CLI status --all output');
    if (cliOutput) {
        lines.push('```');
        lines.push(cliOutput.trim());
        lines.push('```');
    } else {
        lines.push('No CLI output captured.');
    }

    return lines.join('\n');
}

function formatList(items: string[], emptyMessage: string) {
    if (items.length === 0) {
        return emptyMessage;
    }
    return items.map((item) => `- ${item}`).join('\n');
}

function createEmptyAccessInfo(): AccessInfo {
    return {
        mcpServers: [],
        tools: [],
        keySources: [],
        networkEndpoints: [],
        localFiles: [],
        notes: []
    };
}

function extractMcpServers(config: Record<string, unknown>): string[] {
    const results = new Set<string>();
    const mcp = config.mcp;
    if (Array.isArray(mcp)) {
        for (const entry of mcp) {
            const label = formatNamedEntry(entry);
            if (label) {
                results.add(label);
            }
        }
    }
    if (isRecord(mcp)) {
        const servers = mcp.servers;
        if (Array.isArray(servers)) {
            for (const entry of servers) {
                const label = formatNamedEntry(entry);
                if (label) {
                    results.add(label);
                }
            }
        } else if (isRecord(servers)) {
            for (const [name, entry] of Object.entries(servers)) {
                const label = formatNamedEntry(entry, name);
                if (label) {
                    results.add(label);
                }
            }
        }
    }
    if (Array.isArray(config.mcpServers)) {
        for (const entry of config.mcpServers) {
            const label = formatNamedEntry(entry);
            if (label) {
                results.add(label);
            }
        }
    }
    return uniqueList([...results]);
}

function extractTools(config: Record<string, unknown>): string[] {
    const results = new Set<string>();
    const sources = [config.tools];
    if (isRecord(config.mcp)) {
        sources.push(config.mcp.tools);
    }
    if (isRecord(config.capabilities)) {
        sources.push(config.capabilities.tools);
    }

    for (const source of sources) {
        if (Array.isArray(source)) {
            for (const entry of source) {
                const label = formatNamedEntry(entry);
                if (label) {
                    results.add(label);
                }
            }
        } else if (isRecord(source)) {
            for (const [name, entry] of Object.entries(source)) {
                const label = formatNamedEntry(entry, name);
                if (label) {
                    results.add(label);
                }
            }
        }
    }

    return uniqueList([...results]);
}

function formatNamedEntry(entry: unknown, fallbackName?: string) {
    if (typeof entry === 'string') {
        return entry;
    }
    if (!isRecord(entry)) {
        return fallbackName;
    }
    const name = asString(entry.name) ?? asString(entry.id) ?? fallbackName;
    const endpoint = asString(entry.url) ?? asString(entry.endpoint) ?? asString(entry.host);
    if (name && endpoint) {
        return `${name} (${endpoint})`;
    }
    return name ?? endpoint ?? fallbackName ?? '';
}

function scanAccessInfo(
    value: unknown,
    pathSegments: string[],
    keySources: Set<string>,
    localFiles: Set<string>,
    endpoints: Set<string>,
    notes: Set<string>,
    depth = 0
) {
    if (depth > 8) {
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((entry, index) =>
            scanAccessInfo(entry, [...pathSegments, String(index)], keySources, localFiles, endpoints, notes, depth + 1)
        );
        return;
    }
    if (isRecord(value)) {
        for (const [key, entry] of Object.entries(value)) {
            if (isKeyIndicator(key) && isRecord(entry)) {
                const envVar = getEnvVarFromRecord(entry);
                if (envVar) {
                    keySources.add(`Environment variable: ${envVar}`);
                }
                const filePath = getFilePathFromRecord(entry);
                if (filePath) {
                    keySources.add(`Key file: ${filePath}`);
                    localFiles.add(filePath);
                }
            }
            scanAccessInfo(entry, [...pathSegments, key], keySources, localFiles, endpoints, notes, depth + 1);
        }
        return;
    }
    if (typeof value === 'string') {
        if (isUrl(value)) {
            endpoints.add(value);
        } else if (looksLikePath(value)) {
            localFiles.add(value);
        }
        if (pathSegments.some(isKeyIndicator)) {
            const envVar = extractEnvVarName(value);
            if (envVar) {
                keySources.add(`Environment variable: ${envVar}`);
                return;
            }
            if (looksLikePath(value)) {
                keySources.add(`Key file: ${value}`);
                return;
            }
            const pathLabel = pathSegments.join('.');
            keySources.add(`Config value: ${pathLabel}`);
        }
    }
}

function summarizeKeySources(sources: string[]) {
    const categories = new Set<string>();
    for (const source of sources) {
        if (source.startsWith('Environment variable:')) {
            categories.add('env');
        } else if (source.startsWith('Key file:')) {
            categories.add('file');
        } else {
            categories.add('config');
        }
    }
    return categories.size > 0 ? [...categories].sort().join(', ') : 'none';
}

function getEnvVarFromRecord(entry: Record<string, unknown>) {
    const envValue = asString(entry.env) ?? asString(entry.envVar) ?? asString(entry.environment);
    if (!envValue) {
        return undefined;
    }
    return envValue;
}

function getFilePathFromRecord(entry: Record<string, unknown>) {
    const fileValue = asString(entry.path) ?? asString(entry.file) ?? asString(entry.filePath);
    if (!fileValue) {
        return undefined;
    }
    if (looksLikePath(fileValue)) {
        return fileValue;
    }
    return undefined;
}

function extractEnvVarName(value: string) {
    const match =
        value.match(/\$\{([A-Z0-9_]+)\}/) ||
        value.match(/\$([A-Z0-9_]+)/) ||
        value.match(/env:([A-Z0-9_]+)/i) ||
        value.match(/ENV:([A-Z0-9_]+)/);
    return match ? match[1] : undefined;
}

function isKeyIndicator(segment: string) {
    return /(key|token|secret|apikey|api_key|password|credential)/i.test(segment);
}

function isUrl(value: string) {
    return /^https?:\/\//i.test(value);
}

function looksLikePath(value: string) {
    return /[\\/]/.test(value) && !isUrl(value);
}

function uniqueList(items: string[]) {
    return [...new Set(items.filter((item) => item && item.trim().length > 0))].sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

async function ensureHardeningCommandReady(): Promise<{ prefix: string; mode: HardeningMode } | null> {
    const prefix = getHardeningCommandPrefix();
    if (!prefix) {
        vscode.window.showErrorMessage('OpenClaw hardening command is empty. Update OpenClaw: Hardening Command.');
        await openHardeningSettings();
        return null;
    }

    const executable = prefix.split(/\s+/)[0];
    if (!executable) {
        vscode.window.showErrorMessage('OpenClaw hardening command is invalid. Update OpenClaw: Hardening Command.');
        await openHardeningSettings();
        return null;
    }

    if (executable === 'openclaw' || executable === 'openclaw.exe') {
        const hasNode = await isCommandAvailable('node');
        if (!hasNode) {
            await showMissingNodeMessage();
            return null;
        }
    }

    const available = await isCommandAvailable(executable);
    if (!available) {
        const action = await vscode.window.showErrorMessage(
            `Command not found: ${executable}. Update OpenClaw: Hardening Command or install the OpenClaw CLI.`,
            'Install CLI',
            'Open settings'
        );
        if (action === 'Install CLI') {
            await runSetupFlow();
        } else if (action === 'Open settings') {
            await openHardeningSettings();
        }
        return null;
    }

    return { prefix, mode: getHardeningMode() };
}

function getHardeningCommandPrefix() {
    const config = vscode.workspace.getConfiguration('openclaw');
    const prefix = (config.get<string>('hardening.command') ?? 'openclaw').trim();
    return prefix;
}

function getHardeningMode(): HardeningMode {
    const config = vscode.workspace.getConfiguration('openclaw');
    const configured = (config.get<string>('hardening.mode') ?? 'full').trim();
    if (configured === 'audit' || configured === 'auditFix' || configured === 'full') {
        return configured;
    }
    return 'full';
}

export function deactivate() {
    log.info('deactivate()');
    if (terminal) {
        terminal.dispose();
    }
    if (setupTerminal) {
        setupTerminal.dispose();
    }
    if (hardeningTerminal) {
        hardeningTerminal.dispose();
    }
    chatViewProvider?.dispose();
}

function setStatus(state: 'idle' | 'connecting' | 'connected' | 'error') {
    switch (state) {
        case 'connecting':
            statusBarItem.text = formatStatusText('$(sync~spin)');
            statusBarItem.tooltip = 'Connection in progress';
            break;
        case 'connected':
            statusBarItem.text = formatStatusText('$(check)');
            statusBarItem.tooltip = 'OpenClaw command sent';
            break;
        case 'error':
            statusBarItem.text = formatStatusText('$(alert)');
            statusBarItem.tooltip = 'Connection failed. Click to retry.';
            break;
        case 'idle':
        default:
            statusBarItem.text = formatStatusText('$(plug)');
            statusBarItem.tooltip = 'Click to connect to OpenClaw';
            break;
    }
}

function formatStatusText(icon: string) {
    return `${icon} ${STATUS_LABEL}`;
}

async function isCommandAvailable(command: string) {
    const probe = process.platform === 'win32' ? `where ${command}` : `command -v ${command}`;
    try {
        await execAsync(probe);
        return true;
    } catch {
        return false;
    }
}

async function runSetupFlow() {
    const options = getInstallOptions();
    const pick = await vscode.window.showQuickPick(options, {
        placeHolder: 'Select an install method for the OpenClaw CLI'
    });

    if (!pick) {
        return;
    }

    if (pick.action === 'docs') {
        await openDocs();
        return;
    }

    if (pick.action === 'node') {
        await runNodeSetupFlow();
        return;
    }

    if (!pick.command) {
        return;
    }

    if (pick.command.includes('npm') && !(await isCommandAvailable('node'))) {
        await showMissingNodeMessage();
        return;
    }

    await runInstallCommand(pick.command);
}

async function runModelSetupWizard() {
    const hasOpenClaw = await isCommandAvailable('openclaw');
    if (!hasOpenClaw) {
        const action = await vscode.window.showErrorMessage(
            'OpenClaw CLI not found. Install it to run the Model Setup Wizard.',
            'Install CLI',
            'More options...',
            'Cancel'
        );

        if (action === 'Install CLI') {
            await runSetupFlow();
        } else if (action === 'More options...') {
            const pick = await showInstallMoreOptions();
            if (pick === 'copy') {
                await copyInstallCommand();
            } else if (pick === 'docs') {
                await openDocs();
            } else if (pick === 'settings') {
                await openSettings();
            }
        }
        return;
    }

    const hasNode = await isCommandAvailable('node');
    if (!hasNode) {
        await showMissingNodeMessage();
        return;
    }

    const onboardingPick = await showOnboardingOptions();
    if (!onboardingPick) {
        return;
    }
    if (onboardingPick === 'docs') {
        await openOnboardDocs();
        return;
    }
    if (onboardingPick === 'run' || onboardingPick === 'runNoDaemon') {
        const command = onboardingPick === 'run' ? 'openclaw onboard --install-daemon' : 'openclaw onboard';
        await runSetupCommand(command);
        const continueAction = await vscode.window.showInformationMessage(
            'Complete the OpenClaw onboarding in the terminal, then continue.',
            'Continue'
        );
        if (continueAction !== 'Continue') {
            return;
        }
    }

    const providerPick = await showProviderOptions();
    if (!providerPick) {
        return;
    }

    await handleProviderSelection(providerPick);
    await runPostSetupChecks();
}

function getInstallOptions(): Array<{
    label: string;
    description?: string;
    detail?: string;
    command?: string;
    action?: 'docs' | 'node' | 'nodeDocs';
}> {
    const platform = os.platform();
    const isWindows = platform === 'win32';
    const npmCommand = OPENCLAW_NPM_INSTALL;

    const options: Array<{
        label: string;
        description?: string;
        detail?: string;
        command?: string;
        action?: 'docs' | 'node' | 'nodeDocs';
    }> = [];

    if (isWindows) {
        options.push({
            label: 'Install via PowerShell script (recommended)',
            description: 'Detects OS, installs Node if needed, launches onboarding',
            detail: OPENCLAW_INSTALL_PS1,
            command: OPENCLAW_INSTALL_PS1
        });
    } else {
        options.push({
            label: 'Install via shell script (recommended)',
            description: 'Detects OS, installs Node if needed, launches onboarding',
            detail: OPENCLAW_INSTALL_SCRIPT,
            command: OPENCLAW_INSTALL_SCRIPT
        });
    }

    options.push(
        {
            label: 'Install Node.js (required for npm install)',
            description: isWindows ? 'Windows: recommended via winget' : 'macOS/Linux: install Node.js first',
            action: 'node'
        },
        {
            label: 'Install via npm',
            description: isWindows ? 'Works on Windows with Node.js' : 'Works on macOS and Linux with Node.js',
            detail: npmCommand,
            command: npmCommand
        },
        {
            label: 'Open installation docs',
            description: 'View all install options',
            action: 'docs'
        }
    );

    return options;
}

async function runNodeSetupFlow() {
    const options = getNodeInstallOptions();
    const pick = await vscode.window.showQuickPick(options, {
        placeHolder: 'Install Node.js (Node 24 recommended, 22.16+ supported)'
    });

    if (!pick) {
        return;
    }

    if (pick.action === 'nodeDocs') {
        await openNodeDocs();
        return;
    }

    if (!pick.command) {
        return;
    }

    await runInstallCommand(pick.command);
}

function getNodeInstallOptions(): Array<{
    label: string;
    description?: string;
    detail?: string;
    command?: string;
    action?: 'nodeDocs';
}> {
    const platform = os.platform();
    const isWindows = platform === 'win32';
    const isMac = platform === 'darwin';

    if (isWindows) {
        const command = 'winget install OpenJS.NodeJS.LTS';
        return [
            {
                label: 'Install Node.js (LTS) via winget',
                description: 'Windows',
                detail: command,
                command
            },
            {
                label: 'Open Node.js download page',
                description: 'Manual installer for Windows/macOS/Linux',
                action: 'nodeDocs'
            }
        ];
    }

    if (isMac) {
        const command = 'brew install node';
        return [
            {
                label: 'Install Node.js (LTS) via Homebrew',
                description: 'macOS (requires Homebrew)',
                detail: command,
                command
            },
            {
                label: 'Open Node.js download page',
                description: 'Manual installer for macOS/Linux',
                action: 'nodeDocs'
            }
        ];
    }

    const command = 'curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs';
    return [
        {
            label: 'Install Node.js (LTS) via apt',
            description: 'Ubuntu/Debian',
            detail: command,
            command
        },
        {
            label: 'Open Node.js download page',
            description: 'Manual installer for Linux',
            action: 'nodeDocs'
        }
    ];
}

async function runInstallCommand(command: string) {
    const decision = await vscode.window.showWarningMessage(
        `Run this command in a terminal?\n${command}`,
        { modal: true },
        'Run install',
        'Copy command',
        'Cancel'
    );

    if (decision === 'Copy command') {
        await vscode.env.clipboard.writeText(command);
        vscode.window.showInformationMessage('Install command copied to clipboard.');
        return;
    }

    if (decision !== 'Run install') {
        return;
    }

    if (!setupTerminal) {
        setupTerminal = vscode.window.createTerminal('OpenClaw Setup');
    }

    setupTerminal.show(true);
    setupTerminal.sendText(command);
}

async function runSetupCommand(command: string) {
    const terminalInstance = getSetupTerminal();
    terminalInstance.show(true);
    terminalInstance.sendText(command);
}

async function runCliInTerminal(command: string, message: string) {
    const executable = command.split(/\s+/)[0];
    if (executable === 'openclaw' || executable === 'openclaw.exe') {
        const hasNode = await isCommandAvailable('node');
        if (!hasNode) {
            await showMissingNodeMessage();
            return;
        }
        const available = await isCommandAvailable(executable);
        if (!available) {
            const action = await vscode.window.showErrorMessage(
                `Command not found: ${executable}. Install OpenClaw first.`,
                'Install CLI'
            );
            if (action === 'Install CLI') {
                await runSetupFlow();
            }
            return;
        }
    }
    const terminalInstance = getOpenClawTerminal();
    terminalInstance.show(true);
    terminalInstance.sendText(command);
    vscode.window.showInformationMessage(message);
}

async function showOnboardingOptions(): Promise<'run' | 'runNoDaemon' | 'docs' | 'skip' | undefined> {
    const items: QuickPickOption<'run' | 'runNoDaemon' | 'docs' | 'skip'>[] = [
        {
            label: 'Run onboarding wizard (recommended)',
            description: 'Installs service and sets up auth, channels, and defaults',
            detail: 'openclaw onboard --install-daemon',
            value: 'run'
        },
        {
            label: 'Run onboarding without daemon',
            description: 'Skip background service install',
            detail: 'openclaw onboard',
            value: 'runNoDaemon'
        },
        {
            label: 'Open onboarding docs',
            value: 'docs'
        },
        {
            label: 'Skip onboarding for now',
            value: 'skip'
        }
    ];
    const pick = await vscode.window.showQuickPick(items, {
        placeHolder: 'Start with onboarding (recommended)'
    });
    return pick?.value;
}

type ProviderKey = 'openai' | 'anthropic' | 'google' | 'ollama' | 'local' | 'other';

async function showProviderOptions(): Promise<ProviderKey | undefined> {
    const items: QuickPickOption<ProviderKey>[] = [
        {
            label: 'OpenAI',
            description: 'API key or OAuth-based setup',
            value: 'openai'
        },
        {
            label: 'Anthropic',
            description: 'API key or Claude token setup',
            value: 'anthropic'
        },
        {
            label: 'Google (Gemini)',
            description: 'API key or OAuth-based setup',
            value: 'google'
        },
        {
            label: 'Ollama (local models)',
            description: 'Run models locally with Ollama',
            value: 'ollama'
        },
        {
            label: 'Local Pi RPC (default)',
            description: 'Use bundled Pi binary in RPC mode',
            value: 'local'
        },
        {
            label: 'Other / Custom provider',
            description: 'OpenAI-compatible, Anthropic-compatible, or 30+ more',
            value: 'other'
        }
    ];
    const pick = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select your model provider'
    });
    return pick?.value;
}

async function handleProviderSelection(provider: ProviderKey) {
    if (provider === 'other') {
        await vscode.env.openExternal(vscode.Uri.parse(OPENCLAW_PROVIDERS_DOCS_URL));
        return;
    }

    const labels: Record<string, string> = {
        openai: 'OpenAI',
        anthropic: 'Anthropic',
        google: 'Google (Gemini)',
        ollama: 'Ollama',
        local: 'Local Pi RPC'
    };
    const label = labels[provider] ?? provider;
    const action = await vscode.window.showQuickPick(
        [
            { label: `Open ${label} setup docs`, value: 'docs' },
            { label: 'Open OpenClaw config file', value: 'config' },
            { label: 'Open auth profiles', value: 'auth' },
            { label: 'Skip provider setup', value: 'skip' }
        ] as QuickPickOption<'docs' | 'config' | 'auth' | 'skip'>[],
        { placeHolder: `Finish ${label} setup` }
    );

    if (!action) {
        return;
    }

    if (action.value === 'docs') {
        const url = PROVIDER_DOCS[provider] ?? OPENCLAW_PROVIDERS_DOCS_URL;
        await vscode.env.openExternal(vscode.Uri.parse(url));
        return;
    }

    if (action.value === 'config') {
        await openOpenClawConfig(true);
        return;
    }

    if (action.value === 'auth') {
        await openAuthProfiles();
    }
}

async function runPostSetupChecks() {
    const pick = await vscode.window.showQuickPick(
        [
            { label: 'Run doctor + status checks', value: 'run' },
            { label: 'Open dashboard', value: 'dashboard' },
            { label: 'Skip checks for now', value: 'skip' }
        ] as QuickPickOption<'run' | 'dashboard' | 'skip'>[],
        { placeHolder: 'Verify your OpenClaw setup' }
    );

    if (!pick || pick.value === 'skip') {
        return;
    }

    if (pick.value === 'dashboard') {
        await openDashboard();
        return;
    }

    const terminalInstance = getOpenClawTerminal();
    terminalInstance.show(true);
    terminalInstance.sendText('openclaw doctor');
    terminalInstance.sendText('openclaw gateway status');
    vscode.window.showInformationMessage('Running OpenClaw doctor and gateway status checks.');
}

async function copyInstallCommand() {
    await vscode.env.clipboard.writeText(OPENCLAW_NPM_INSTALL);
    vscode.window.showInformationMessage('Install command copied to clipboard.');
}

async function openDocs() {
    await vscode.env.openExternal(vscode.Uri.parse(OPENCLAW_DOCS_URL));
}

async function openOnboardDocs() {
    await vscode.env.openExternal(vscode.Uri.parse(OPENCLAW_ONBOARD_DOCS_URL));
}

async function openDashboard() {
    await vscode.env.openExternal(vscode.Uri.parse(OPENCLAW_DASHBOARD_URL));
}

async function openUpdateDocs() {
    await vscode.env.openExternal(vscode.Uri.parse(OPENCLAW_UPDATE_DOCS_URL));
}

async function openSecurityDocs() {
    await vscode.env.openExternal(vscode.Uri.parse(OPENCLAW_SECURITY_DOCS_URL));
}

async function openNodeDocs() {
    await vscode.env.openExternal(vscode.Uri.parse('https://nodejs.org/en/download'));
}

async function openSettings() {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'openclaw.command');
}

async function openHardeningSettings() {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'openclaw.hardening');
}

function getSetupTerminal() {
    if (!setupTerminal) {
        setupTerminal = vscode.window.createTerminal('OpenClaw Setup');
    }
    return setupTerminal;
}

function getOpenClawTerminal() {
    if (!terminal) {
        terminal = vscode.window.createTerminal('OpenClaw');
    }
    return terminal;
}

function getHardeningTerminal() {
    if (!hardeningTerminal) {
        hardeningTerminal = vscode.window.createTerminal('OpenClaw Hardening');
    }
    return hardeningTerminal;
}

async function openOpenClawConfig(createIfMissing: boolean) {
    const configPath = getOpenClawConfigPath();
    await openFileInEditor(configPath, createIfMissing, '{\n  \n}\n');
}

async function openAuthProfiles() {
    const agentId = await vscode.window.showInputBox({
        prompt: 'Enter the agent id (folder name under ~/.openclaw/agents)',
        placeHolder: 'main'
    });
    if (!agentId) {
        return;
    }
    const profilesPath = path.join(os.homedir(), '.openclaw', 'agents', agentId, 'agent', 'auth-profiles.json');
    await openFileInEditor(profilesPath, true, '{\n  \n}\n');
}

async function openFileInEditor(filePath: string, createIfMissing: boolean, initialContents: string) {
    const uri = vscode.Uri.file(filePath);
    const exists = await fileExists(uri);
    if (!exists && createIfMissing) {
        await ensureParentDirectory(uri);
        const encoder = new TextEncoder();
        await vscode.workspace.fs.writeFile(uri, encoder.encode(initialContents));
    }
    try {
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document, { preview: false });
    } catch (error) {
        vscode.window.showErrorMessage(`Unable to open file: ${filePath}`);
        console.error(error);
    }
}

async function fileExists(uri: vscode.Uri) {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}

async function ensureParentDirectory(uri: vscode.Uri) {
    const directory = vscode.Uri.file(path.dirname(uri.fsPath));
    try {
        await vscode.workspace.fs.stat(directory);
    } catch {
        await vscode.workspace.fs.createDirectory(directory);
    }
}

async function showMissingNodeMessage() {
    const installCommand = getNodeInstallCommandForPlatform();
    const action = await vscode.window.showErrorMessage(
        'Node.js is required to run the OpenClaw CLI. Node 24 recommended (Node 22.16+ also supported).',
        'Install Node.js',
        'More options...'
    );

    if (action === 'Install Node.js') {
        await runNodeSetupFlow();
        return;
    }

    if (action === 'More options...') {
        const pick = await showNodeMoreOptions(installCommand);
        if (pick === 'copy' && installCommand) {
            await vscode.env.clipboard.writeText(installCommand);
            vscode.window.showInformationMessage('Node.js install command copied to clipboard.');
        } else if (pick === 'docs') {
            await openNodeDocs();
        }
    }
}

function getNodeInstallCommandForPlatform(): string | undefined {
    const platform = os.platform();
    if (platform === 'win32') {
        return 'winget install OpenJS.NodeJS.LTS';
    }
    if (platform === 'darwin') {
        return 'brew install node';
    }
    return 'curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs';
}

function getLegacyExecutable(executable: string): string | undefined {
    const normalized = executable.toLowerCase();
    return LEGACY_CLI_ALIASES.has(normalized) ? executable : undefined;
}

function replaceExecutable(command: string, newExecutable: string): string {
    const parts = command.trim().split(/\s+/);
    if (parts.length === 0) {
        return command;
    }
    parts[0] = newExecutable;
    return parts.join(' ');
}

async function updateOpenClawCommandSetting(command: string) {
    const config = vscode.workspace.getConfiguration('openclaw');
    await config.update('command', command, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage('Updated OpenClaw: Command setting.');
}

async function handleLegacyMigration(command: string, legacyExecutable: string): Promise<string | null> {
    const hasOpenClaw = await isCommandAvailable('openclaw');
    const newCommand = replaceExecutable(command, 'openclaw');
    const action = await vscode.window.showWarningMessage(
        `This command uses legacy "${legacyExecutable}". OpenClaw is the new name. Update to OpenClaw for safe migrations.`,
        hasOpenClaw ? 'Use openclaw' : 'Install OpenClaw',
        'More options...'
    );

    if (action === 'Use openclaw') {
        await updateOpenClawCommandSetting(newCommand);
        return newCommand;
    }

    if (action === 'Install OpenClaw') {
        await runSetupFlow();
        return null;
    }

    if (action === 'More options...') {
        const pick = await showLegacyMoreOptions();
        if (pick === 'updateDocs') {
            await openUpdateDocs();
        } else if (pick === 'copyInstall') {
            await vscode.env.clipboard.writeText(OPENCLAW_INSTALL_SCRIPT);
            vscode.window.showInformationMessage('Installer command copied to clipboard.');
        } else if (pick === 'copyNpm') {
            await vscode.env.clipboard.writeText(OPENCLAW_NPM_INSTALL);
            vscode.window.showInformationMessage('npm update command copied to clipboard.');
        } else if (pick === 'settings') {
            await openSettings();
        }
        return null;
    }

    return null;
}

async function findAvailableLegacyCli(): Promise<string | undefined> {
    for (const legacy of LEGACY_CLI_ALIASES) {
        if (await isCommandAvailable(legacy)) {
            return legacy;
        }
    }
    return undefined;
}

async function showLegacyMissingOpenClawMessage(legacyExecutable: string) {
    const action = await vscode.window.showErrorMessage(
        `Found legacy CLI "${legacyExecutable}". OpenClaw is the new name. Update to OpenClaw to continue.`,
        'Install OpenClaw',
        'More options...'
    );

    if (action === 'Install OpenClaw') {
        await runSetupFlow();
        return;
    }

    if (action === 'More options...') {
        const pick = await showLegacyMoreOptions();
        if (pick === 'updateDocs') {
            await openUpdateDocs();
        } else if (pick === 'copyInstall') {
            await vscode.env.clipboard.writeText(OPENCLAW_INSTALL_SCRIPT);
            vscode.window.showInformationMessage('Installer command copied to clipboard.');
        } else if (pick === 'copyNpm') {
            await vscode.env.clipboard.writeText(OPENCLAW_NPM_INSTALL);
            vscode.window.showInformationMessage('npm update command copied to clipboard.');
        } else if (pick === 'settings') {
            await openSettings();
        }
    }
}

class OverviewItem extends vscode.TreeItem {
    readonly children?: OverviewItem[];

    constructor(
        label: string,
        options: {
            description?: string;
            tooltip?: string;
            icon?: vscode.ThemeIcon;
            command?: vscode.Command;
            children?: OverviewItem[];
            collapsibleState?: vscode.TreeItemCollapsibleState;
        } = {}
    ) {
        const collapsibleState =
            options.collapsibleState ??
            (options.children && options.children.length > 0
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None);
        super(label, collapsibleState);
        this.description = options.description;
        this.tooltip = options.tooltip;
        this.iconPath = options.icon;
        this.command = options.command;
        this.children = options.children;
    }
}

class OverviewTreeProvider implements vscode.TreeDataProvider<OverviewItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<OverviewItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private lastRun: Date | undefined;
    private accessSummary: AccessSummary | undefined;
    private toolEntries: ToolEntry[] = [];
    private toolsError: string | undefined;

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    async refreshTools() {
        const { entries, error } = await loadToolsForOverview();
        this.toolEntries = entries;
        this.toolsError = error;
        this.refresh();
    }

    setLastRun(date: Date) {
        this.lastRun = date;
        this.refresh();
    }

    setAccessSummary(summary: AccessSummary) {
        this.accessSummary = summary;
        this.refresh();
    }

    getTreeItem(element: OverviewItem) {
        return element;
    }

    getChildren(element?: OverviewItem) {
        if (element) {
            return element.children ?? [];
        }
        return [
            this.buildGettingStartedSection(),
            this.buildOperateSection(),
            this.buildHardeningSection(),
            this.buildToolsSection(),
            this.buildHelpSection()
        ];
    }

    private buildGettingStartedSection() {
        return new OverviewItem('Getting Started', {
            icon: new vscode.ThemeIcon('rocket'),
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            children: [
                new OverviewItem('Connect', {
                    description: 'Run your OpenClaw command',
                    icon: new vscode.ThemeIcon('plug'),
                    command: {
                        command: 'openclaw.connect',
                        title: 'OpenClaw Connect'
                    }
                }),
                new OverviewItem('Setup', {
                    description: 'Install Node + OpenClaw',
                    icon: new vscode.ThemeIcon('tools'),
                    command: {
                        command: 'openclaw.setup',
                        title: 'OpenClaw Setup'
                    }
                }),
                new OverviewItem('Model Setup Wizard', {
                    description: 'Onboard + choose provider',
                    icon: new vscode.ThemeIcon('settings-gear'),
                    command: {
                        command: 'openclaw.modelSetup',
                        title: 'OpenClaw Model Setup Wizard'
                    }
                })
            ]
        });
    }

    private buildOperateSection() {
        return new OverviewItem('Operate', {
            icon: new vscode.ThemeIcon('dashboard'),
            children: [
                new OverviewItem('Run status', {
                    description: 'Check gateway + agent status',
                    icon: new vscode.ThemeIcon('terminal'),
                    command: {
                        command: 'openclaw.hardening.runStatus',
                        title: 'Run OpenClaw status'
                    }
                }),
                new OverviewItem('Run doctor', {
                    description: 'Health checks + quick fixes',
                    icon: new vscode.ThemeIcon('stethoscope'),
                    command: {
                        command: 'openclaw.doctor',
                        title: 'Run OpenClaw doctor'
                    }
                }),
                new OverviewItem('Update OpenClaw', {
                    description: 'Fetch latest version + restart',
                    icon: new vscode.ThemeIcon('cloud-download'),
                    command: {
                        command: 'openclaw.update',
                        title: 'Update OpenClaw'
                    }
                }),
                new OverviewItem('Reconfigure', {
                    description: 'Re-run guided configuration',
                    icon: new vscode.ThemeIcon('settings-gear'),
                    command: {
                        command: 'openclaw.configure',
                        title: 'Reconfigure OpenClaw'
                    }
                }),
                new OverviewItem('Open dashboard', {
                    description: OPENCLAW_DASHBOARD_URL,
                    icon: new vscode.ThemeIcon('globe'),
                    command: {
                        command: 'openclaw.hardening.openDashboard',
                        title: 'Open OpenClaw dashboard'
                    }
                }),
                new OverviewItem('Open config', {
                    description: '~/.openclaw/openclaw.json',
                    icon: new vscode.ThemeIcon('file'),
                    command: {
                        command: 'openclaw.hardening.openConfig',
                        title: 'Open OpenClaw config'
                    }
                })
            ]
        });
    }

    private buildHardeningSection() {
        const accessSummaryTooltip = this.accessSummary
            ? `Generated ${this.accessSummary.generatedAt.toLocaleString()}`
            : 'Generate a plain-English access summary';
        const mode = getHardeningMode();
        const modeLabel = mode === 'full' ? 'Audit / Fix / Deep' : mode === 'auditFix' ? 'Audit / Fix' : 'Audit';
        const lastRunTooltip = this.lastRun ? `Last run ${this.lastRun.toLocaleString()}` : undefined;

        return new OverviewItem('Hardening', {
            icon: new vscode.ThemeIcon('shield'),
            children: [
                new OverviewItem('Run hardening', {
                    description: modeLabel,
                    tooltip: lastRunTooltip ?? 'Run the configured OpenClaw hardening workflow',
                    icon: new vscode.ThemeIcon('shield'),
                    command: {
                        command: 'openclaw.harden',
                        title: 'Run OpenClaw hardening'
                    }
                }),
                new OverviewItem('Access summary', {
                    description: 'Plain-English permissions',
                    tooltip: accessSummaryTooltip,
                    icon: new vscode.ThemeIcon('list-unordered'),
                    command: {
                        command: 'openclaw.hardening.showAccessSummary',
                        title: 'Show OpenClaw access summary'
                    }
                }),
                new OverviewItem('Open security docs', {
                    description: 'docs.openclaw.ai/gateway/security',
                    icon: new vscode.ThemeIcon('book'),
                    command: {
                        command: 'openclaw.hardening.openDocs',
                        title: 'Open OpenClaw security docs'
                    }
                })
            ]
        });
    }

    private buildToolsSection() {
        const children: OverviewItem[] = [];

        if (this.toolsError) {
            children.push(
                new OverviewItem('Config issue', {
                    description: this.toolsError,
                    icon: new vscode.ThemeIcon('warning')
                })
            );
        }

        if (this.toolEntries.length === 0) {
            children.push(
                new OverviewItem('No tools found', {
                    description: 'Add tools in ~/.openclaw/openclaw.json',
                    icon: new vscode.ThemeIcon('circle-slash')
                })
            );
        }

        for (const tool of this.toolEntries) {
            const toggleLabel = tool.enabled ? 'Disable' : 'Enable';
            const toggleIcon = tool.enabled ? new vscode.ThemeIcon('circle-slash') : new vscode.ThemeIcon('plug');
            const tooltipParts = [];
            if (tool.description) {
                tooltipParts.push(tool.description);
            }
            tooltipParts.push(`Source: ${tool.source}`);
            const toolItem = new OverviewItem(tool.label, {
                description: tool.enabled ? 'Enabled' : 'Disabled',
                tooltip: tooltipParts.join('\n'),
                icon: tool.enabled ? new vscode.ThemeIcon('plug') : new vscode.ThemeIcon('circle-slash'),
                children: [
                    new OverviewItem(toggleLabel, {
                        description: `${toggleLabel} this tool`,
                        icon: toggleIcon,
                        command: {
                            command: 'openclaw.tools.toggle',
                            title: `${toggleLabel} tool`,
                            arguments: [tool]
                        }
                    }),
                    new OverviewItem('Uninstall', {
                        description: 'Remove from config',
                        icon: new vscode.ThemeIcon('trash'),
                        command: {
                            command: 'openclaw.tools.uninstall',
                            title: 'Uninstall tool',
                            arguments: [tool]
                        }
                    })
                ]
            });
            children.push(toolItem);
        }

        children.push(
            new OverviewItem('Refresh tools', {
                description: 'Reload tools from config',
                icon: new vscode.ThemeIcon('refresh'),
                command: {
                    command: 'openclaw.tools.refresh',
                    title: 'Refresh tools'
                }
            })
        );

        return new OverviewItem('Tools', {
            icon: new vscode.ThemeIcon('wrench'),
            children
        });
    }

    private buildHelpSection() {
        return new OverviewItem('Help', {
            icon: new vscode.ThemeIcon('question'),
            children: [
                new OverviewItem('Open docs', {
                    description: 'docs.openclaw.ai',
                    icon: new vscode.ThemeIcon('book'),
                    command: {
                        command: 'openclaw.openDocs',
                        title: 'Open OpenClaw docs'
                    }
                }),
                new OverviewItem('Refresh view', {
                    description: 'Reload items',
                    icon: new vscode.ThemeIcon('refresh'),
                    command: {
                        command: 'openclaw.hardening.refresh',
                        title: 'Refresh OpenClaw view'
                    }
                })
            ]
        });
    }
}

async function showInstallMoreOptions(): Promise<'copy' | 'docs' | 'settings' | undefined> {
    const items: QuickPickOption<'copy' | 'docs' | 'settings'>[] = [
        { label: 'Copy install command', value: 'copy' },
        { label: 'Open docs', value: 'docs' },
        { label: 'Open settings', value: 'settings' }
    ];
    const pick = await vscode.window.showQuickPick(items, { placeHolder: 'More OpenClaw options' });
    return pick?.value;
}

async function showNodeMoreOptions(
    installCommand: string | undefined
): Promise<'copy' | 'docs' | undefined> {
    const items: QuickPickOption<'copy' | 'docs'>[] = [{ label: 'Open Node.js download page', value: 'docs' }];
    if (installCommand) {
        items.unshift({ label: 'Copy Node.js install command', value: 'copy' });
    }
    const pick = await vscode.window.showQuickPick(items, { placeHolder: 'More Node.js options' });
    return pick?.value;
}

async function showLegacyMoreOptions(): Promise<
    'updateDocs' | 'copyInstall' | 'copyNpm' | 'settings' | undefined
> {
    const items: QuickPickOption<'updateDocs' | 'copyInstall' | 'copyNpm' | 'settings'>[] = [
        { label: 'Open update docs', value: 'updateDocs' },
        { label: 'Copy installer command', value: 'copyInstall' },
        { label: 'Copy npm update command', value: 'copyNpm' },
        { label: 'Open settings', value: 'settings' }
    ];
    const pick = await vscode.window.showQuickPick(items, { placeHolder: 'More OpenClaw options' });
    return pick?.value;
}
