import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
    test: {
        include: ['src/__test__/**/*.test.ts'],
        setupFiles: ['src/__test__/setup.ts'],
        alias: {
            vscode: path.resolve(__dirname, 'src/__test__/vscode.mock.ts'),
        },
    },
});
