import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'out', 'extension.js');

describe('bundled output', () => {
    beforeAll(() => {
        execSync('node esbuild.mjs --production', { cwd: ROOT, stdio: 'pipe' });
    });

    it('produces out/extension.js', () => {
        expect(fs.existsSync(OUT)).toBe(true);
    });

    it('bundle is a reasonable size (50KB–500KB)', () => {
        const stats = fs.statSync(OUT);
        expect(stats.size).toBeGreaterThan(50_000);
        expect(stats.size).toBeLessThan(500_000);
    });

    it('contains the HTMLElement polyfill banner', () => {
        const head = fs.readFileSync(OUT, 'utf8').slice(0, 200);
        expect(head).toContain('HTMLElement');
    });

    it('does not require @create-markdown at runtime (bundled inline)', () => {
        const src = fs.readFileSync(OUT, 'utf8');
        expect(src).not.toMatch(/require\(["']@create-markdown/);
    });

    it('marks vscode as external', () => {
        const src = fs.readFileSync(OUT, 'utf8');
        expect(src).toMatch(/require\(["']vscode["']\)/);
    });

    it('exports activate and deactivate symbols', () => {
        const src = fs.readFileSync(OUT, 'utf8');
        expect(src).toContain('activate');
        expect(src).toContain('deactivate');
    });
});
