import {
  adSchema,
  adStatsResponseSchema,
  createStarsInvoiceResponseSchema,
  listAdsResponseSchema,
  listCategoriesResponseSchema,
  meResponseSchema,
  telegramWebAppAuthResponseSchema,
  uploadResponseSchema,
  walletTransactionsResponseSchema,
  type AdDto,
  type AdStatsResponse,
  type CreateAdRequest,
  type CreateStarsInvoiceResponse,
  type ListAdsResponse,
  type ListCategoriesResponse,
  type MeResponse,
  type UpdateAdRequest,
  type UploadResponse,
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

export function listCategories(): Promise<ListCategoriesResponse> {
  return request("/categories", listCategoriesResponseSchema);
}

export function createAd(dto: CreateAdRequest): Promise<AdDto> {
  return request("/ads", adSchema, { method: "POST", body: JSON.stringify(dto) });
}

export function updateAd(id: string, dto: UpdateAdRequest): Promise<AdDto> {
  return request(`/ads/${id}`, adSchema, { method: "PATCH", body: JSON.stringify(dto) });
}

export function submitAd(id: string): Promise<AdDto> {
  return request(`/ads/${id}/submit`, adSchema, { method: "POST" });
}

export function listAds(): Promise<ListAdsResponse> {
  return request("/ads", listAdsResponseSchema);
}

export function getAdStats(id: string): Promise<AdStatsResponse> {
  return request(`/ads/${id}/stats`, adStatsResponseSchema);
}

export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_URL}/uploads`, {
    method: "POST",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: formData,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed: ${response.status} ${text}`);
  }
  return uploadResponseSchema.parse(await response.json());
}
