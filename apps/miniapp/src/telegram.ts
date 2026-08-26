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
  return webApp?.initData || null;
}
