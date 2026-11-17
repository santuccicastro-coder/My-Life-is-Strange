import React, { useState } from 'react';
import { AppShell } from './components/AppShell';
import { AuthGate } from './components/AuthGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { QuickTransactionModal } from './components/QuickTransactionModal';
import { AuthHouseholdProvider, useFinance } from './context/AuthHouseholdContext';
import { ThemeProvider } from './context/ThemeContext';
import { AssistantPage } from './pages/AssistantPage';
import { CardsPage } from './pages/CardsPage';
import { GoalsPage } from './pages/GoalsPage';
import { HomePage } from './pages/HomePage';
import { HorizonPage, type HorizonHubTab } from './pages/HorizonPage';
import { IncomesPage } from './pages/IncomesPage';
import { RecurringPage } from './pages/RecurringPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import type { AppRoute, Transaction } from './types/finance';

function getHorizonInitialTab(route: AppRoute): HorizonHubTab {
  if (route === 'parcelamentos') return 'parcelamentos';
  if (route === 'compras') return 'compras';
  if (route === 'cenarios') return 'cenarios';
  return 'projecao';
}

function AuthenticatedApp() {
  const { dataLoading } = useFinance();
  const [route, setRoute] = useState<AppRoute>('inicio');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const openNewTransaction = () => {
    setEditingTransaction(null);
    setQuickAddOpen(true);
  };

  const openEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setQuickAddOpen(true);
  };

  const handleNavigate = (nextRoute: AppRoute) => {
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isHorizonHub =
    route === 'horizonte' || route === 'parcelamentos' || route === 'compras' || route === 'cenarios';

  return (
    <AppShell route={route} onNavigate={handleNavigate} onQuickAdd={openNewTransaction}>
      {dataLoading ? (
        <div className="py-16 text-center text-sm text-slate-500">Carregando dados sincronizados...</div>
      ) : (
        <>
          {route === 'inicio' && (
            <HomePage
              onNavigate={handleNavigate}
              onQuickAdd={openNewTransaction}
              onEditTransaction={openEditTransaction}
            />
          )}
          {route === 'lancamentos' && (
            <TransactionsPage onQuickAdd={openNewTransaction} onEditTransaction={openEditTransaction} />
          )}
          {isHorizonHub && (
            <HorizonPage onNavigate={handleNavigate} initialTab={getHorizonInitialTab(route)} />
          )}
          {route === 'ia' && <AssistantPage onNavigate={handleNavigate} />}
          {route === 'fixos' && <RecurringPage onNavigate={handleNavigate} />}
          {route === 'renda' && <IncomesPage />}
          {route === 'cartoes' && <CardsPage />}
          {route === 'economias' && <GoalsPage />}
          {route === 'relatorios' && <ReportsPage />}
          {route === 'config' && <SettingsPage />}
        </>
      )}

      <QuickTransactionModal
        open={quickAddOpen}
        onClose={() => {
          setQuickAddOpen(false);
          setEditingTransaction(null);
        }}
        editingTransaction={editingTransaction}
      />
    </AppShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthHouseholdProvider>
          <AuthGate>
            <AuthenticatedApp />
          </AuthGate>
        </AuthHouseholdProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
