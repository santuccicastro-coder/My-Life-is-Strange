import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useFinance } from '../context/AuthHouseholdContext';
import { useTheme } from '../context/ThemeContext';
import type { Income, IncomeFrequency } from '../types/finance';
import { getChartTheme, SEMANTIC_COLORS } from '../utils/chartColors';
import {
  addMonthsToKey,
  computeMemberIncomeAndSpendingBreakdown,
  formatBRL,
  formatDateBR,
  formatMonthFull,
  formatPct,
  getCurrentMonthKey,
  getHouseholdPeople,
  getMonthKeysFromStart,
  getTodayISO,
} from '../utils/financeCalculations';

export function IncomesPage() {
  const {
    household,
    incomes,
    transactions,
    installments,
    recurringItems,
    currentPartnerName,
    saveIncome,
    deleteIncome,
  } = useFinance();
  const { isDark } = useTheme();
  const chartTheme = getChartTheme(isDark);

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Income | null>(null);
  const [person, setPerson] = useState(currentPartnerName);
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<IncomeFrequency>('Mensal');
  const [receiptDay, setReceiptDay] = useState('5');
  const [receiptDate, setReceiptDate] = useState(getTodayISO());
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const monthOptions = useMemo(() => {
    const start = household?.periodStart ?? `${new Date().getFullYear()}-01-01`;
    const base = getMonthKeysFromStart(start, 24);
    const cur = getCurrentMonthKey();
    return Array.from(new Set([...base, addMonthsToKey(cur, -1), cur, addMonthsToKey(cur, 1), selectedMonth])).sort();
  }, [household, selectedMonth]);

  const breakdown = useMemo(
    () =>
      computeMemberIncomeAndSpendingBreakdown({
        monthKey: selectedMonth,
        household,
        incomes,
        transactions,
        installments,
        recurringItems,
      }),
    [selectedMonth, household, incomes, transactions, installments, recurringItems]
  );

  const individualRows = useMemo(
    () =>
      breakdown.rows.filter(
        (r) => !r.isShared || r.monthlyIncome > 0 || r.individualSpending > 0
      ),
    [breakdown.rows]
  );

  const chartData = useMemo(
    () =>
      individualRows.map((r) => ({
        name: r.person,
        Renda: Math.round(r.monthlyIncome * 100) / 100,
        Gasto: Math.round(r.individualSpending * 100) / 100,
      })),
    [individualRows]
  );

  const incomeHistory = useMemo(() => {
    const extraEntries = transactions
      .filter((t) => t.type === 'Entrada')
      .map((t) => ({
        id: `tx-${t.id}`,
        date: t.date,
        source: t.description,
        person: t.person,
        amount: t.actualAmount,
        kind: 'Entrada avulsa',
        author: t.createdByName,
      }));

    const oneOffIncomes = incomes
      .filter((i) => i.frequency === 'Única' && i.receiptDate)
      .map((i) => ({
        id: `inc-${i.id}`,
        date: i.receiptDate,
        source: i.source,
        person: i.person,
        amount: i.amount,
        kind: 'Renda extra',
        author: i.createdByName,
      }));

    return [...extraEntries, ...oneOffIncomes].sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, incomes]);

  const openNew = () => {
    setEditing(null);
    setPerson(currentPartnerName);
    setSource('');
    setAmount('');
    setFrequency('Mensal');
    setReceiptDay('5');
    setReceiptDate(getTodayISO());
    setActive(true);
    setNotes('');
    setError('');
    setModalOpen(true);
  };

  const openEdit = (inc: Income) => {
    setEditing(inc);
    setPerson(inc.person);
    setSource(inc.source);
    setAmount(String(inc.amount));
    setFrequency(inc.frequency);
    setReceiptDay(String(inc.receiptDay));
    setReceiptDate(inc.receiptDate || getTodayISO());
    setActive(inc.active);
    setNotes(inc.notes);
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const num = Number(amount.replace(',', '.'));
    if (!Number.isFinite(num) || num <= 0) {
      setError('Informe um valor maior que zero.');
      return;
    }
    setSaving(true);
    try {
      await saveIncome(
        {
          person,
          source,
          amount: num,
          frequency,
          receiptDay: Number(receiptDay) || 5,
          receiptDate: frequency === 'Única' || frequency === 'Anual' ? receiptDate : '',
          active,
          notes,
        },
        editing?.id
      );
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar renda.');
    } finally {
      setSaving(false);
    }
  };

  if (!household) return null;
  const peopleOptions = getHouseholdPeople(household);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Renda e Contribuição</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Salários, extras, % de contribuição de cada pessoa na renda e quanto cada um está gastando no mês.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <select
            aria-label="Mês de referência"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-800"
          >
            {monthOptions.map((mk) => (
              <option key={mk} value={mk}>
                {formatMonthFull(mk)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Cadastrar renda
          </button>
        </div>
      </div>

      {/* KPIs Consolidados do Mês */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 text-white rounded-xl p-5 space-y-1.5">
          <span className="text-xs font-medium text-slate-300">Renda total ({formatMonthFull(selectedMonth)})</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-300">
            {formatBRL(breakdown.totalIncome)}
          </p>
          <p className="text-xs text-slate-300">Salários + entradas avulsas do mês</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <span className="text-xs font-medium text-slate-500">Total gasto no mês</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-red-600">
            {formatBRL(breakdown.totalSpending)}
          </p>
          <p className="text-xs text-slate-500">Saídas, contas fixas e parcelas atribuídas</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <span className="text-xs font-medium text-slate-500">Saldo líquido consolidado</span>
          <p
            className={`text-2xl font-bold font-mono tabular-nums ${
              breakdown.totalBalance >= 0 ? 'text-emerald-700' : 'text-red-600'
            }`}
          >
            {formatBRL(breakdown.totalBalance)}
          </p>
          <p className="text-xs text-slate-500">
            {household.memberUids.length}/7 pessoa(s) conectada(s) na nuvem
          </p>
        </div>
      </section>

      {/* % de Contribuição na Renda e Gasto Individual por Pessoa */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Contribuição na renda (%) e gasto individual
              </h2>
              <p className="text-xs text-slate-500">
                Participação de cada pessoa na renda total e quanto cada uma gastou individualmente em{' '}
                {formatMonthFull(selectedMonth)}.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {individualRows.map((row) => (
            <div
              key={row.person}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900 truncate">{row.person}</p>
                <span className="text-xs font-bold font-mono tabular-nums text-emerald-700 shrink-0">
                  {formatPct(row.incomeSharePct, 1)} da renda
                </span>
              </div>

              {/* Barra % de contribuição na renda */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Renda no mês</span>
                  <span className="font-mono tabular-nums font-semibold text-emerald-700">
                    {formatBRL(row.monthlyIncome)}
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all"
                    style={{ width: `${Math.min(100, row.incomeSharePct * 100)}%` }}
                  />
                </div>
              </div>

              {/* Gasto individual */}
              <div className="space-y-1 pt-2 border-t border-slate-200/80">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Gasto individual</span>
                  <span className="font-mono tabular-nums font-semibold text-red-600">
                    {formatBRL(row.individualSpending)}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-600 rounded-full transition-all"
                    style={{ width: `${Math.min(100, row.spendingSharePct * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                  <span>{formatPct(row.spendingSharePct, 1)} dos gastos totais</span>
                  {row.monthlyIncome > 0 && (
                    <span>{formatPct(row.individualCommittedPct, 0)} da própria renda</span>
                  )}
                </div>
              </div>

              {/* Saldo individual */}
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/80">
                <span className="text-slate-600 font-medium">Saldo individual</span>
                <span
                  className={`font-mono tabular-nums font-bold ${
                    row.individualBalance >= 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {formatBRL(row.individualBalance)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {chartData.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-700 mb-2">Comparativo: Renda × Gasto por pessoa</p>
            <div className="h-56 min-w-0 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: chartTheme.axisTick }} axisLine={false} tickLine={false} />
                  <YAxis
                    width={52}
                    tick={{ fontSize: 10, fill: chartTheme.axisTick }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `R$${Math.round(v)}`}
                  />
                  <Tooltip formatter={(val: unknown) => formatBRL(Number(val))} contentStyle={chartTheme.tooltipStyle} />
                  <Legend wrapperStyle={chartTheme.legendStyle} />
                  <Bar dataKey="Renda" name="Renda" fill={SEMANTIC_COLORS.positive} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Gasto" name="Gasto individual" fill={SEMANTIC_COLORS.negative} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      {/* Lista de Fontes de Renda */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Fontes cadastradas</h2>
          <span className="text-xs text-slate-500">{incomes.length} fontes</span>
        </div>

        {incomes.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-slate-500">Nenhuma fonte de renda cadastrada ainda.</p>
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar primeiro salário ou renda
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {incomes.map((inc) => (
              <div key={inc.id} className="p-4 sm:px-5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 hover:bg-slate-50/70">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 truncate">{inc.source}</p>
                    {!inc.active && <span className="text-xs text-slate-400">· Inativa</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {inc.person} · {inc.frequency} ·{' '}
                    {inc.frequency === 'Única' || inc.frequency === 'Anual'
                      ? `Data: ${formatDateBR(inc.receiptDate)}`
                      : `Recebimento dia ${inc.receiptDay}`}
                    {inc.notes ? ` · ${inc.notes}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-bold font-mono tabular-nums text-emerald-700">
                      {formatBRL(inc.amount)}
                    </p>
                    <p className="text-[11px] text-slate-400">Por {inc.createdByName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEdit(inc)}
                    className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteIncome(inc.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Histórico de Entradas */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Histórico de entradas extras</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Entradas avulsas registradas em Lançamentos e rendas únicas cadastradas acima.
          </p>
        </div>

        {incomeHistory.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Nenhuma entrada avulsa registrada até o momento.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {incomeHistory.map((item) => (
              <div key={item.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{item.source}</p>
                  <p className="text-xs text-slate-500">
                    {formatDateBR(item.date)} · {item.person} · {item.kind} · Por {item.author}
                  </p>
                </div>
                <span className="text-sm font-semibold font-mono tabular-nums text-emerald-700 shrink-0">
                  + {formatBRL(item.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-2xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">
                {editing ? 'Editar fonte de renda' : 'Nova fonte de renda'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Quem recebe</label>
                <select
                  value={person}
                  onChange={(e) => setPerson(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  {peopleOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Fonte de renda</label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Ex.: Salário, Pró-labore, Aluguel"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Frequência</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as IncomeFrequency)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Mensal">Mensal</option>
                    <option value="Quinzenal">Quinzenal</option>
                    <option value="Semanal">Semanal</option>
                    <option value="Única">Única (extra)</option>
                    <option value="Anual">Anual</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {frequency === 'Única' || frequency === 'Anual' ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Data de recebimento</label>
                    <input
                      type="date"
                      required
                      value={receiptDate}
                      onChange={(e) => setReceiptDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Dia do recebimento</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={receiptDay}
                      onChange={(e) => setReceiptDay(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg"
                    />
                  </div>
                )}
                <div className="flex items-end pb-2">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                    Renda ativa
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Observações</label>
                <input
                  type="text"
                  maxLength={300}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 cursor-pointer">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
