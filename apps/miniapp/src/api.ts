import {
  createStarsInvoiceResponseSchema,
  meResponseSchema,
  telegramWebAppAuthResponseSchema,
  walletTransactionsResponseSchema,
  type CreateStarsInvoiceResponse,
  type MeResponse,
  type WalletTransactionsResponse,
} from "@telegram-ads/shared-types";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000";

let accessToken: string | null = null;

export function setAccessToken(token: string): void {
  accessToken = token;
}

async function request<T>(
  path: string,
  schema: { parse: (value: unknown) => T },
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${path} failed: ${response.status} ${text}`);
  }
  return schema.parse(await response.json());
}

export async function authenticateWithTelegram(initData: string) {
  const result = await request("/auth/telegram-webapp", telegramWebAppAuthResponseSchema, {
    method: "POST",
    body: JSON.stringify({ initData }),
  });
  setAccessToken(result.accessToken);
  return result;
}

export function getMe(): Promise<MeResponse> {
  return request("/me", meResponseSchema);
}

export function createStarsInvoice(amountCoins: number): Promise<CreateStarsInvoiceResponse> {
  return request("/wallet/deposit/stars/invoice", createStarsInvoiceResponseSchema, {
    method: "POST",
    body: JSON.stringify({ amountCoins }),
  });
}

export function listWalletTransactions(): Promise<WalletTransactionsResponse> {
  return request("/wallet/transactions", walletTransactionsResponseSchema);
}
