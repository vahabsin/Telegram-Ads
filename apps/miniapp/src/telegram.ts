// Minimal ambient typing for the subset of the Telegram WebApp JS SDK this app uses
// (loaded via the <script> tag in index.html, not an npm package - see docs/DECISIONS.md).
interface TelegramWebApp {
  initData: string;
  ready(): void;
  expand(): void;
  openInvoiceLink(url: string, callback?: (status: string) => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

export function getInitData(): string | null {
  const webApp = getTelegramWebApp();
  if (webApp?.initData) {
    return webApp.initData;
  }
  // Dev-only escape hatch for testing in a plain browser outside real Telegram
  // (docs/DECISIONS.md ADR-012). `import.meta.env.DEV` is statically false in a
  // production build, so Vite dead-code-eliminates this branch entirely - it cannot
  // reach a deployed build.
  if (import.meta.env.DEV) {
    const mock = new URLSearchParams(window.location.search).get("mockInitData");
    if (mock) return mock;
  }
  return null;
}
