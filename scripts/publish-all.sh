#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG_CMD="npm"
X_CMD="npx --yes"

if command -v bun >/dev/null 2>&1; then
  PKG_CMD="bun"
  X_CMD="bunx"
fi

if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env"
  set +a
fi

if [[ -z "${VSCE_PAT:-}" ]]; then
  echo "VSCE_PAT is not set. Add it to .env or export it." >&2
  exit 1
fi

if [[ -z "${OVSX_TOKEN:-}" ]]; then
  echo "OVSX_TOKEN is not set. Add it to .env or export it." >&2
  exit 1
fi

cd "${ROOT_DIR}"
echo "Running prepublish build..."
"${PKG_CMD}" run vscode:prepublish

VERSION="$(node -p "require('./package.json').version")"
VSIX_PATH="out/openclaw-extension-${VERSION}.vsix"

echo "Packaging VSIX to ${VSIX_PATH}..."
${X_CMD} vsce package -o "${VSIX_PATH}"

echo "Publishing to VS Code Marketplace (vsce)..."
${X_CMD} vsce publish -p "${VSCE_PAT}"

echo "Publishing to Open VSX (ovsx)..."
${X_CMD} ovsx publish -p "${OVSX_TOKEN}"

EXT_NAME="$(node -p "require('./package.json').name")"
PUBLISHER="$(node -p "require('./package.json').publisher")"

echo "Publish complete."
echo "Summary:"
echo "VS Code Marketplace: https://marketplace.visualstudio.com/items?itemName=${PUBLISHER}.${EXT_NAME}"
echo "Open VSX: https://open-vsx.org/extension/${PUBLISHER}/${EXT_NAME}"
