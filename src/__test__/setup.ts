// @ts-expect-error HTMLElement is a DOM type not in the Node libs; we shim it
// so @create-markdown/preview can define its web-component class at import time.
if (typeof HTMLElement === 'undefined') {
    (globalThis as any).HTMLElement = class HTMLElement {}; // eslint-disable-line @typescript-eslint/no-explicit-any
}
