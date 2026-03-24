#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

X_CMD="npx --yes"
if command -v bun >/dev/null 2>&1; then
  X_CMD="bunx"
fi

echo "Compiling..."
pnpm run compile

VERSION="$(node -p "require('./package.json').version")"
VSIX="openclaw-extension-${VERSION}.vsix"

echo "Packaging ${VSIX}..."
${X_CMD} @vscode/vsce package --no-dependencies -o "${VSIX}"

IDE="cursor"
if ! command -v cursor >/dev/null 2>&1; then
  if command -v code >/dev/null 2>&1; then
    IDE="code"
  else
    echo "Neither 'cursor' nor 'code' CLI found in PATH." >&2
    echo "Install manually: Extensions sidebar → ... → Install from VSIX → ${ROOT_DIR}/${VSIX}" >&2
    exit 1
  fi
fi

echo "Installing into ${IDE}..."
"${IDE}" --install-extension "${VSIX}" --force

echo "Cleaning up VSIX..."
rm -f "${VSIX}"

echo ""
echo "Done. Reload the window (Cmd+Shift+P → Reload Window) to pick up changes."
