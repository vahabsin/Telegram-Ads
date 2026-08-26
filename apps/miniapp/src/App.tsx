import { useState } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { Dashboard } from "./pages/Dashboard";
import { Wallet } from "./pages/Wallet";

type View = "dashboard" | "wallet";

function Shell() {
  const { status, user, error } = useAuth();
  const [view, setView] = useState<View>("dashboard");

  if (status === "loading") {
    return <div className="p-6 text-center opacity-70">در حال ورود...</div>;
  }

  if (status === "error") {
    return <div className="p-6 text-center text-red-400">{error}</div>;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="font-semibold">پلتفرم تبلیغات تلگرام</span>
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm">
          🪙 {user?.wallet.balanceCoins ?? "0"}
        </span>
      </header>

      <main className="flex-1">
        {view === "dashboard" ? <Dashboard onGoToWallet={() => setView("wallet")} /> : <Wallet />}
      </main>

      <nav className="flex border-t border-white/10">
        <button
          type="button"
          onClick={() => setView("dashboard")}
          className={`flex-1 py-3 text-sm ${view === "dashboard" ? "font-semibold" : "opacity-60"}`}
        >
          داشبورد
        </button>
        <button
          type="button"
          onClick={() => setView("wallet")}
          className={`flex-1 py-3 text-sm ${view === "wallet" ? "font-semibold" : "opacity-60"}`}
        >
          کیف پول
        </button>
      </nav>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
