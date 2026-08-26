import { useEffect, useState } from "react";
import type { WalletTransactionDto } from "@telegram-ads/shared-types";
import { createStarsInvoice, listWalletTransactions } from "../api";
import { useAuth } from "../AuthContext";
import { getTelegramWebApp } from "../telegram";

const QUICK_AMOUNTS = [20000, 50000, 100000, 300000];

export function Wallet() {
  const { user, refresh } = useAuth();
  const [amount, setAmount] = useState<number>(QUICK_AMOUNTS[0] as number);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionDto[]>([]);

  async function loadTransactions() {
    const result = await listWalletTransactions();
    setTransactions(result.transactions);
  }

  useEffect(() => {
    void loadTransactions();
  }, []);

  async function handleDeposit() {
    setBusy(true);
    setMessage(null);
    try {
      const invoice = await createStarsInvoice(amount);
      const webApp = getTelegramWebApp();
      if (!webApp) {
        setMessage("این عملیات فقط داخل تلگرام کار می‌کنه.");
        return;
      }
      webApp.openInvoiceLink(invoice.invoiceLink, (status) => {
        if (status === "paid") {
          setMessage("✅ پرداخت موفق بود، در حال به‌روزرسانی موجودی...");
          setTimeout(() => {
            void refresh();
            void loadTransactions();
          }, 1500);
        } else if (status === "failed") {
          setMessage("پرداخت ناموفق بود.");
        }
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "خطا در ایجاد فاکتور پرداخت");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <section>
        <p className="text-sm opacity-70">موجودی فعلی</p>
        <p className="text-3xl font-bold">🪙 {user?.wallet.balanceCoins ?? "0"}</p>
      </section>

      <section className="flex flex-col gap-3">
        <p className="text-sm opacity-70">مبلغ شارژ (سکه)</p>
        <div className="grid grid-cols-4 gap-2">
          {QUICK_AMOUNTS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setAmount(value)}
              className={`rounded-lg px-2 py-2 text-xs font-medium ${
                amount === value ? "bg-blue-600 text-white" : "border border-white/20"
              }`}
            >
              {value.toLocaleString("fa-IR")}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(event) => setAmount(Number(event.target.value))}
          className="rounded-lg border border-white/20 bg-transparent px-3 py-2"
        />
        <button
          type="button"
          disabled={busy || amount <= 0}
          onClick={() => void handleDeposit()}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          ⭐ شارژ با Telegram Stars
        </button>
        {message && <p className="text-sm opacity-80">{message}</p>}
      </section>

      <section>
        <p className="mb-2 text-sm opacity-70">تراکنش‌های اخیر</p>
        {transactions.length === 0 ? (
          <p className="text-sm opacity-50">هنوز تراکنشی ثبت نشده.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {transactions.map((transaction) => (
              <li
                key={transaction.id}
                className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm"
              >
                <span>{transaction.type}</span>
                <span>{transaction.amountCoins}</span>
                <span className="opacity-60">{transaction.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
