import { z } from "zod";

// POST /wallet/deposit/stars/invoice
export const createStarsInvoiceRequestSchema = z.object({
  amountCoins: z.coerce.number().int().positive(),
});
export type CreateStarsInvoiceRequest = z.infer<typeof createStarsInvoiceRequestSchema>;

export const createStarsInvoiceResponseSchema = z.object({
  invoiceLink: z.string(),
  amountCoins: z.string(),
  starsAmount: z.number(),
});
export type CreateStarsInvoiceResponse = z.infer<typeof createStarsInvoiceResponseSchema>;

// GET /wallet/transactions
export const walletTransactionSchema = z.object({
  id: z.string(),
  type: z.enum(["DEPOSIT", "WITHDRAW", "AD_SPEND", "PUBLISHER_EARNING", "REFUND"]),
  amountCoins: z.string(),
  status: z.enum(["PENDING", "COMPLETED", "FAILED"]),
  paymentMethod: z.enum(["RIAL", "STARS", "CRYPTO_TRC20", "INTERNAL"]),
  createdAt: z.string(),
});
export type WalletTransactionDto = z.infer<typeof walletTransactionSchema>;

export const walletTransactionsResponseSchema = z.object({
  transactions: z.array(walletTransactionSchema),
});
export type WalletTransactionsResponse = z.infer<typeof walletTransactionsResponseSchema>;
