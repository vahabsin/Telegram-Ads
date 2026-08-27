import { useState } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { AdWizard } from "./pages/AdWizard";
import { Dashboard } from "./pages/Dashboard";
import { MyAds } from "./pages/MyAds";
import { Wallet } from "./pages/Wallet";

type View = "dashboard" | "wallet" | "wizard" | "my-ads";

function Shell() {
  const { status, user, error } = useAuth();
  const [view, setView] = useState<View>("dashboard");

  if (status === "loading") {
    return <div className="p-6 text-center opacity-70">در حال ورود...</div>;
  }

  if (status === "error") {
    return <div className="p-6 text-center text-red-400">{error}</div>;
  }

  // The wizard gets the full screen, no header/bottom nav, so the advertiser stays focused
  // on the 5 steps (docs/PRD.md section 2.3).
  if (view === "wizard") {
    return (
      <div className="mx-auto min-h-screen max-w-md">
        <AdWizard onDone={() => setView("my-ads")} />
      </div>
    );
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
        {view === "dashboard" && (
          <Dashboard onGoToWallet={() => setView("wallet")} onCreateAd={() => setView("wizard")} />
        )}
        {view === "wallet" && <Wallet />}
        {view === "my-ads" && <MyAds onCreateNew={() => setView("wizard")} />}
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
          onClick={() => setView("my-ads")}
          className={`flex-1 py-3 text-sm ${view === "my-ads" ? "font-semibold" : "opacity-60"}`}
        >
          تبلیغ‌های من
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
