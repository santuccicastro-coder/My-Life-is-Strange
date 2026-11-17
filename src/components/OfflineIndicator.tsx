import { RefreshCw, WifiOff } from 'lucide-react';
import { useFinance } from '../context/AuthHouseholdContext';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const { hasPendingSync } = useFinance();

  if (isOnline && !hasPendingSync) return null;

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-5 left-3 right-3 sm:left-auto sm:right-4 z-50 flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2.5 text-xs font-medium text-white shadow-lg border border-slate-700 max-w-full"
      >
        <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="min-w-0">Modo offline — alterações salvas no aparelho e sincronizam ao reconectar</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-5 left-3 right-3 sm:left-auto sm:right-4 z-50 flex items-center gap-2 rounded-lg bg-emerald-950 px-3.5 py-2.5 text-xs font-medium text-emerald-100 shadow-lg border border-emerald-700 max-w-full"
    >
      <RefreshCw className="w-4 h-4 text-emerald-400 shrink-0 animate-spin" />
      <span className="min-w-0">Conectado — sincronizando alterações offline...</span>
    </div>
  );
}
