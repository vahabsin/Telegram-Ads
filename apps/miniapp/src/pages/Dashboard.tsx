import { useAuth } from "../AuthContext";

export function Dashboard({
  onGoToWallet,
  onCreateAd,
}: {
  onGoToWallet: () => void;
  onCreateAd: () => void;
}) {
  const { user } = useAuth();

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-10 text-center">
      <div className="text-5xl">📢</div>
      <h1 className="text-lg font-semibold">هنوز تبلیغی ندارید</h1>
      <p className="text-sm opacity-70">
        سلام {user?.firstName ?? ""}! اولین تبلیغ خودتون رو بسازید تا اینجا آمار اونو ببینید.
      </p>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <button
          type="button"
          onClick={onCreateAd}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white"
        >
          یکی بسازید
        </button>
        <button
          type="button"
          onClick={onGoToWallet}
          className="w-full rounded-lg border border-white/20 px-4 py-3 font-medium"
        >
          شارژ حساب
        </button>
      </div>
    </div>
  );
}
