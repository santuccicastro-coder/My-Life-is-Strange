import type {
  BankAccount,
  CreditCard,
  Goal,
  Household,
  Income,
  Installment,
  PlannedPurchase,
  RecurringItem,
  ScenarioMode,
  SimulatedPurchase,
  Transaction,
} from '../types/finance';

export const MAX_HORIZON_MONTHS = 600;

const MONTH_NAMES_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTH_NAMES_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export function formatBRL(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatBRL0(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPct(ratio: number, decimals = 1): string {
  const n = Number.isFinite(ratio) ? ratio * 100 : 0;
  return `${n.toFixed(decimals).replace('.', ',')}%`;
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentMonthKey(): string {
  return getTodayISO().slice(0, 7);
}

export function formatDateBR(iso: string): string {
  if (!iso || iso.length < 10) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function buildDateInMonth(monthKey: string, dayOfMonth: number): string {
  const [yStr, mStr] = monthKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const maxDay = new Date(y, m, 0).getDate();
  const clamped = Math.min(maxDay, Math.max(1, Math.round(dayOfMonth)));
  return `${monthKey}-${String(clamped).padStart(2, '0')}`;
}

export function formatMonthShort(monthKey: string): string {
  if (!monthKey || monthKey.length < 7) return monthKey;
  const [y, m] = monthKey.split('-');
  const idx = Number(m) - 1;
  return `${MONTH_NAMES_SHORT[idx] ?? m}/${y.slice(2)}`;
}

export function getMonthAbbr(monthKey: string): string {
  if (!monthKey || monthKey.length < 7) return monthKey;
  const [, m] = monthKey.split('-');
  const idx = Number(m) - 1;
  const name = MONTH_NAMES_FULL[idx] ?? m;
  return idx === 4 ? 'Maio' : name.slice(0, 3);
}

export function formatShortDayMonth(iso: string): string {
  if (!iso || iso.length < 10) return '—';
  const mIdx = Number(iso.slice(5, 7)) - 1;
  const day = iso.slice(8, 10);
  return `${day}/${MONTH_NAMES_SHORT[mIdx] ?? iso.slice(5, 7)}`;
}

export function formatMonthFull(monthKey: string): string {
  if (!monthKey || monthKey.length < 7) return monthKey;
  const [y, m] = monthKey.split('-');
  const idx = Number(m) - 1;
  return `${MONTH_NAMES_FULL[idx] ?? m} de ${y}`;
}

export function addMonthsToKey(monthKey: string, offset: number): string {
  const [yStr, mStr] = monthKey.split('-');
  const totalMonths = Number(yStr) * 12 + (Number(mStr) - 1) + offset;
  const y = Math.floor(totalMonths / 12);
  const m = (totalMonths % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function monthDiff(fromKey: string, toKey: string): number {
  const [fy, fm] = fromKey.split('-').map(Number);
  const [ty, tm] = toKey.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

export function getMonthKeysFromStart(periodStart: string, count = 12): string[] {
  const startKey = periodStart && periodStart.length >= 7 ? periodStart.slice(0, 7) : getCurrentMonthKey();
  const safeCount = Math.min(MAX_HORIZON_MONTHS, Math.max(1, Math.round(count)));
  return Array.from({ length: safeCount }, (_, i) => addMonthsToKey(startKey, i));
}

export function getMonthKeysRange(startMonthKey: string, endMonthKey: string): string[] {
  const start = startMonthKey && startMonthKey.length >= 7 ? startMonthKey.slice(0, 7) : getCurrentMonthKey();
  const end = endMonthKey && endMonthKey.length >= 7 ? endMonthKey.slice(0, 7) : start;
  const diff = monthDiff(start, end);
  if (diff < 0) return [start];
  const count = Math.min(MAX_HORIZON_MONTHS, diff + 1);
  return Array.from({ length: count }, (_, i) => addMonthsToKey(start, i));
}

// ============================================================================
// RENDAS
// ============================================================================
export function getIncomeAmountInMonth(inc: Income, monthKey: string): number {
  if (!inc.active) return 0;
  switch (inc.frequency) {
    case 'Mensal':
      return inc.amount;
    case 'Quinzenal':
      return inc.amount * 2;
    case 'Semanal':
      return inc.amount * 4;
    case 'Única': {
      const targetKey = inc.receiptDate ? inc.receiptDate.slice(0, 7) : '';
      return targetKey === monthKey ? inc.amount : 0;
    }
    case 'Anual': {
      if (!inc.receiptDate) return inc.amount / 12;
      return inc.receiptDate.slice(5, 7) === monthKey.slice(5, 7) ? inc.amount : 0;
    }
    default:
      return inc.amount;
  }
}

export function getMonthlyCoupleIncome(incomes: Income[], monthKey: string): number {
  return incomes.reduce((sum, inc) => sum + getIncomeAmountInMonth(inc, monthKey), 0);
}

// ============================================================================
// PESSOAS DO ESPAÇO COMPARTILHADO (ATÉ 7 MEMBROS) & CONTRIBUIÇÃO / GASTOS
// ============================================================================
export interface HouseholdMemberEntry {
  uid: string;
  name: string;
  isOwner: boolean;
}

export function getHouseholdMembersList(household: Household | null | undefined): HouseholdMemberEntry[] {
  if (!household) return [];
  return household.memberUids.map((uid, idx) => {
    const mapped = household.memberNames?.[uid]?.trim();
    const fallback =
      uid === household.partner1Uid
        ? household.partner1Name
        : uid === household.partner2Uid
          ? household.partner2Name
          : idx === 0
            ? household.partner1Name
            : `Membro ${idx + 1}`;
    return {
      uid,
      name: mapped || fallback || `Membro ${idx + 1}`,
      isOwner: uid === household.ownerUid,
    };
  });
}

export function getHouseholdPeople(household: Household | null | undefined): string[] {
  if (!household) return ['Casal'];
  const connectedNames = getHouseholdMembersList(household).map((m) => m.name);
  const base =
    household.memberUids.length <= 1
      ? [household.partner1Name, household.partner2Name, ...connectedNames]
      : [...connectedNames, household.partner1Name];
  const sharedLabel = household.memberUids.length > 2 ? 'Grupo' : 'Casal';
  return Array.from(new Set([...base.filter((n) => Boolean(n && n.trim())), sharedLabel]));
}

export interface MemberIncomeSpendingRow {
  person: string;
  isShared: boolean;
  monthlyIncome: number;
  incomeSharePct: number;
  individualSpending: number;
  spendingSharePct: number;
  individualCommittedPct: number;
  individualBalance: number;
}

export interface MemberIncomeSpendingBreakdown {
  monthKey: string;
  totalIncome: number;
  totalSpending: number;
  totalBalance: number;
  rows: MemberIncomeSpendingRow[];
}

export function computeMemberIncomeAndSpendingBreakdown(params: {
  monthKey: string;
  household?: Household | null;
  incomes: Income[];
  transactions: Transaction[];
  installments: Installment[];
  recurringItems: RecurringItem[];
}): MemberIncomeSpendingBreakdown {
  const { monthKey, household, incomes, transactions, installments, recurringItems } = params;
  const incomeByPerson = new Map<string, number>();
  const spendingByPerson = new Map<string, number>();

  const addIncome = (person: string, amt: number) => {
    if (!amt || amt <= 0) return;
    const key = person.trim() || 'Não informado';
    incomeByPerson.set(key, (incomeByPerson.get(key) ?? 0) + amt);
  };

  const addSpending = (person: string, amt: number) => {
    if (!amt || amt <= 0) return;
    const key = person.trim() || 'Não informado';
    spendingByPerson.set(key, (spendingByPerson.get(key) ?? 0) + amt);
  };

  for (const inc of incomes) {
    addIncome(inc.person, getIncomeAmountInMonth(inc, monthKey));
  }

  for (const rec of recurringItems) {
    const amt = getRecurringItemAmountInMonth(rec, monthKey, transactions);
    if (amt <= 0) continue;
    if (rec.type === 'Entrada') {
      addIncome(rec.person, amt);
    } else {
      addSpending(rec.person, amt);
    }
  }

  for (const tx of transactions) {
    if (tx.monthKey !== monthKey) continue;
    if (tx.type === 'Entrada') {
      addIncome(tx.person, tx.actualAmount);
    } else if (tx.type === 'Saída') {
      addSpending(tx.person, tx.actualAmount);
    }
  }

  for (const inst of installments) {
    const amt = getInstallmentAmountInMonth(inst, monthKey);
    if (amt > 0) {
      addSpending(inst.person, amt);
    }
  }

  const basePeople = household ? getHouseholdPeople(household) : [];
  const allNames = Array.from(
    new Set([
      ...basePeople,
      ...Array.from(incomeByPerson.keys()),
      ...Array.from(spendingByPerson.keys()),
    ])
  );

  const totalIncome = Array.from(incomeByPerson.values()).reduce((s, v) => s + v, 0);
  const totalSpending = Array.from(spendingByPerson.values()).reduce((s, v) => s + v, 0);

  const rows: MemberIncomeSpendingRow[] = allNames
    .map((person) => {
      const isShared = person === 'Casal' || person === 'Grupo' || person === 'Compartilhado';
      const monthlyIncome = incomeByPerson.get(person) ?? 0;
      const individualSpending = spendingByPerson.get(person) ?? 0;
      const incomeSharePct = totalIncome > 0 ? monthlyIncome / totalIncome : 0;
      const spendingSharePct = totalSpending > 0 ? individualSpending / totalSpending : 0;
      const individualCommittedPct = monthlyIncome > 0 ? individualSpending / monthlyIncome : 0;
      const individualBalance = monthlyIncome - individualSpending;
      return {
        person,
        isShared,
        monthlyIncome,
        incomeSharePct,
        individualSpending,
        spendingSharePct,
        individualCommittedPct,
        individualBalance,
      };
    })
    .filter((r) => !r.isShared || r.monthlyIncome > 0 || r.individualSpending > 0);

  return {
    monthKey,
    totalIncome,
    totalSpending,
    totalBalance: totalIncome - totalSpending,
    rows,
  };
}

// ============================================================================
// GANHOS E DESPESAS FIXAS (PROJEÇÃO AUTOMÁTICA NOS MESES FUTUROS)
// ============================================================================
export function isRecurringItemSettledInMonth(
  itemId: string,
  monthKey: string,
  transactions: Transaction[]
): boolean {
  return transactions.some((tx) => tx.recurringId === itemId && tx.recurringMonthKey === monthKey);
}

export function getRecurringItemRawAmountInMonth(item: RecurringItem, monthKey: string): number {
  if (!item.active) return 0;
  if (item.startMonthKey && monthKey < item.startMonthKey) return 0;
  if (item.endMonthKey && monthKey > item.endMonthKey) return 0;

  switch (item.frequency) {
    case 'Mensal':
      return item.amount;
    case 'Quinzenal':
      return item.amount * 2;
    case 'Semanal':
      return item.amount * 4;
    case 'Anual':
      return item.startMonthKey.slice(5, 7) === monthKey.slice(5, 7) ? item.amount : 0;
    default:
      return item.amount;
  }
}

export function getRecurringItemAmountInMonth(
  item: RecurringItem,
  monthKey: string,
  transactions: Transaction[] = [],
  ignoreSettlement = false
): number {
  const raw = getRecurringItemRawAmountInMonth(item, monthKey);
  if (raw <= 0) return 0;
  if (!ignoreSettlement && isRecurringItemSettledInMonth(item.id, monthKey, transactions)) {
    return 0;
  }
  return raw;
}

// ============================================================================
// PARCELAMENTOS (regras exatas do script Python)
// ============================================================================
export interface InstallmentSummary {
  installmentValue: number;
  paidInstallments: number;
  remainingInstallments: number;
  remainingAmount: number;
  firstMonthKey: string;
  lastMonthKey: string;
}

export function computeInstallmentSummary(inst: Installment, refMonthKey = getCurrentMonthKey()): InstallmentSummary {
  const count = Math.max(1, inst.installmentsCount);
  const installmentValue = inst.totalAmount / count;
  const firstMonthKey = inst.firstChargeDate.slice(0, 7);
  const paidRaw = monthDiff(firstMonthKey, refMonthKey) + 1;
  const paidInstallments = Math.max(0, Math.min(count, paidRaw));
  const remainingInstallments = count - paidInstallments;
  const remainingAmount = installmentValue * remainingInstallments;
  const lastMonthKey = addMonthsToKey(firstMonthKey, count - 1);

  return {
    installmentValue,
    paidInstallments,
    remainingInstallments,
    remainingAmount,
    firstMonthKey,
    lastMonthKey,
  };
}

export function getInstallmentAmountInMonth(inst: Installment, monthKey: string): number {
  const count = Math.max(1, inst.installmentsCount);
  const firstMonthKey = inst.firstChargeDate.slice(0, 7);
  const diff = monthDiff(firstMonthKey, monthKey);
  if (diff >= 0 && diff < count) {
    return inst.totalAmount / count;
  }
  return 0;
}

export function getInstallmentSchedule(inst: Installment, refMonthKey = getCurrentMonthKey()) {
  const count = Math.max(1, inst.installmentsCount);
  const installmentValue = inst.totalAmount / count;
  const firstMonthKey = inst.firstChargeDate.slice(0, 7);
  return Array.from({ length: count }, (_, idx) => {
    const monthKey = addMonthsToKey(firstMonthKey, idx);
    return {
      number: idx + 1,
      monthKey,
      amount: installmentValue,
      isPaid: monthKey <= refMonthKey,
      isCurrent: monthKey === refMonthKey,
    };
  });
}

export function computeFirstCreditInstallmentDate(purchaseDateISO: string, closingDay?: number): string {
  const safeISO = purchaseDateISO && purchaseDateISO.length >= 10 ? purchaseDateISO.slice(0, 10) : getTodayISO();
  const monthKey = safeISO.slice(0, 7);
  const day = Number(safeISO.slice(8, 10)) || 1;
  const firstMonthKey =
    typeof closingDay === 'number' && closingDay >= 1 && day >= closingDay
      ? addMonthsToKey(monthKey, 1)
      : monthKey;
  return buildDateInMonth(firstMonthKey, day);
}

// ============================================================================
// CARTÕES E FATURAS
// ============================================================================
export function getInvoiceMonthKeyForTransaction(tx: Transaction, cards: CreditCard[]): string {
  if (tx.paymentMethod !== 'Crédito') return tx.monthKey;
  const card = cards.find((c) => c.id === tx.cardId || c.name === tx.accountOrCard);
  if (!card) return tx.monthKey;
  const day = Number(tx.date.slice(8, 10));
  if (day >= card.closingDay) {
    return addMonthsToKey(tx.monthKey, 1);
  }
  return tx.monthKey;
}

export function getInvoiceMonthKeyForRecurringCharge(
  item: RecurringItem,
  occurrenceMonthKey: string,
  card: CreditCard
): string {
  if (item.dayOfMonth >= card.closingDay) {
    return addMonthsToKey(occurrenceMonthKey, 1);
  }
  return occurrenceMonthKey;
}

export function getCardInvoiceInMonth(
  card: CreditCard,
  monthKey: string,
  transactions: Transaction[],
  installments: Installment[],
  recurringItems: RecurringItem[] = []
): {
  installmentsTotal: number;
  creditPurchasesTotal: number;
  recurringTotal: number;
  total: number;
  matchingInstallments: Array<Installment & { monthAmount: number; installmentIndex: number }>;
  matchingTransactions: Transaction[];
  matchingRecurring: Array<RecurringItem & { monthAmount: number; occurrenceMonthKey: string }>;
} {
  const matchingInstallments: Array<Installment & { monthAmount: number; installmentIndex: number }> = [];
  let installmentsTotal = 0;

  for (const inst of installments) {
    if (inst.cardId === card.id || inst.cardName === card.name) {
      const amt = getInstallmentAmountInMonth(inst, monthKey);
      if (amt > 0) {
        const idx = monthDiff(inst.firstChargeDate.slice(0, 7), monthKey) + 1;
        installmentsTotal += amt;
        matchingInstallments.push({ ...inst, monthAmount: amt, installmentIndex: idx });
      }
    }
  }

  const matchingTransactions = transactions.filter((tx) => {
    if (tx.type !== 'Saída' || tx.paymentMethod !== 'Crédito') return false;
    const belongsToCard = tx.cardId ? tx.cardId === card.id : tx.accountOrCard === card.name;
    if (!belongsToCard) return false;
    return getInvoiceMonthKeyForTransaction(tx, [card]) === monthKey;
  });

  const creditPurchasesTotal = matchingTransactions.reduce((s, tx) => s + tx.actualAmount, 0);

  const matchingRecurring: Array<RecurringItem & { monthAmount: number; occurrenceMonthKey: string }> = [];
  let recurringTotal = 0;
  const candidateOccMonths = [monthKey, addMonthsToKey(monthKey, -1)];

  for (const item of recurringItems) {
    if (item.type !== 'Saída' || item.paymentMethod !== 'Crédito') continue;
    const belongsToCard = item.cardId ? item.cardId === card.id : item.accountOrCard === card.name;
    if (!belongsToCard) continue;

    for (const occMk of candidateOccMonths) {
      if (getInvoiceMonthKeyForRecurringCharge(item, occMk, card) === monthKey) {
        const amt = getRecurringItemAmountInMonth(item, occMk, transactions);
        if (amt > 0) {
          recurringTotal += amt;
          matchingRecurring.push({ ...item, monthAmount: amt, occurrenceMonthKey: occMk });
        }
      }
    }
  }

  return {
    installmentsTotal,
    creditPurchasesTotal,
    recurringTotal,
    total: installmentsTotal + creditPurchasesTotal + recurringTotal,
    matchingInstallments,
    matchingTransactions,
    matchingRecurring,
  };
}

// ============================================================================
// ECONOMIAS E METAS (regras FV e NPER do script Python)
// ============================================================================
export interface GoalProjection {
  progressPct: number;
  monthlyRate: number;
  balanceIn12Months: number;
  estimated12MonthYield: number;
  monthsToGoal: number | null;
  completionMonthKey: string | null;
}

export function computeGoalProjection(goal: Goal, refMonthKey = getCurrentMonthKey()): GoalProjection {
  const { targetAmount, currentAmount, monthlyContribution, annualYieldRate } = goal;
  const progressPct = targetAmount > 0 ? Math.min(100, (currentAmount / targetAmount) * 100) : 0;
  const monthlyRate = annualYieldRate > 0 ? Math.pow(1 + annualYieldRate, 1 / 12) - 1 : 0;

  let balanceIn12Months = currentAmount + monthlyContribution * 12;
  if (monthlyRate > 0) {
    const factor = Math.pow(1 + monthlyRate, 12);
    balanceIn12Months = currentAmount * factor + monthlyContribution * ((factor - 1) / monthlyRate);
  }
  const estimated12MonthYield = balanceIn12Months - currentAmount - 12 * monthlyContribution;

  let monthsToGoal: number | null = null;
  if (currentAmount >= targetAmount) {
    monthsToGoal = 0;
  } else if (monthlyRate === 0) {
    monthsToGoal = monthlyContribution > 0 ? Math.ceil((targetAmount - currentAmount) / monthlyContribution) : null;
  } else {
    const numerator = monthlyContribution + targetAmount * monthlyRate;
    const denominator = monthlyContribution + currentAmount * monthlyRate;
    if (denominator > 0 && numerator / denominator > 0) {
      monthsToGoal = Math.ceil(Math.log(numerator / denominator) / Math.log(1 + monthlyRate));
    }
  }

  const completionMonthKey = monthsToGoal !== null ? addMonthsToKey(refMonthKey, monthsToGoal) : null;

  return {
    progressPct,
    monthlyRate,
    balanceIn12Months,
    estimated12MonthYield,
    monthsToGoal,
    completionMonthKey,
  };
}

// ============================================================================
// COMPRAS PLANEJADAS (regras exatas do script Python)
// ============================================================================
export type PriceComparison = 'Pendente' | 'Abaixo do planejado' | 'No planejado' | 'Acima do planejado';

export function computePlannedPurchaseMetrics(item: PlannedPurchase) {
  const totalEstimated = item.quantity * item.estimatedUnitPrice;
  const totalPaid = item.hasActualPrice ? item.quantity * item.actualUnitPrice : null;
  const difference = totalPaid !== null ? totalEstimated - totalPaid : null;
  let comparison: PriceComparison = 'Pendente';
  if (totalPaid !== null) {
    if (difference !== null && difference > 0.005) comparison = 'Abaixo do planejado';
    else if (difference !== null && difference < -0.005) comparison = 'Acima do planejado';
    else comparison = 'No planejado';
  }
  return { totalEstimated, totalPaid, difference, comparison };
}

// ============================================================================
// PAINEL MENSAL (regras exatas do script Python + ganhos/despesas fixas)
// ============================================================================
export interface MonthlyPanelRow {
  monthKey: string;
  label: string;
  recurringIncome: number;
  extraEntries: number;
  totalEntries: number;
  launchedExpenses: number;
  recurringExpenses: number;
  installmentsTotal: number;
  totalExpenses: number;
  savingsTotal: number;
  monthlySurplus: number;
  cumulativeBalance: number;
  dailyExpenses: number;
  committedPct: number;
}

export function computeMonthlyPanel(
  monthKeys: string[],
  incomes: Income[],
  transactions: Transaction[],
  installments: Installment[],
  recurringItems: RecurringItem[] = []
): MonthlyPanelRow[] {
  let cumulativeBalance = 0;

  return monthKeys.map((monthKey) => {
    const baseIncomes = getMonthlyCoupleIncome(incomes, monthKey);
    const recurringFixedEntries = recurringItems
      .filter((item) => item.type === 'Entrada')
      .reduce((s, item) => s + getRecurringItemAmountInMonth(item, monthKey, transactions), 0);

    const recurringIncome = baseIncomes + recurringFixedEntries;
    const monthTxs = transactions.filter((tx) => tx.monthKey === monthKey);

    const extraEntries = monthTxs
      .filter((tx) => tx.type === 'Entrada')
      .reduce((s, tx) => s + tx.actualAmount, 0);

    const totalEntries = recurringIncome + extraEntries;

    const launchedExpenses = monthTxs
      .filter((tx) => tx.type === 'Saída')
      .reduce((s, tx) => s + tx.actualAmount, 0);

    const recurringExpenses = recurringItems
      .filter((item) => item.type === 'Saída')
      .reduce((s, item) => s + getRecurringItemAmountInMonth(item, monthKey, transactions), 0);

    const installmentsTotal = installments.reduce((s, inst) => s + getInstallmentAmountInMonth(inst, monthKey), 0);

    const totalExpenses = launchedExpenses + recurringExpenses + installmentsTotal;

    const savingsTotal = monthTxs
      .filter((tx) => tx.type === 'Economia')
      .reduce((s, tx) => s + tx.actualAmount, 0);

    const monthlySurplus = totalEntries - totalExpenses - savingsTotal;
    cumulativeBalance += monthlySurplus;

    const dailyExpenses =
      monthTxs
        .filter((tx) => tx.type === 'Saída' && tx.category === 'Diárias')
        .reduce((s, tx) => s + tx.actualAmount, 0) +
      recurringItems
        .filter((item) => item.type === 'Saída' && item.category === 'Diárias')
        .reduce((s, item) => s + getRecurringItemAmountInMonth(item, monthKey, transactions), 0);

    const committedPct = totalEntries > 0 ? totalExpenses / totalEntries : 0;

    return {
      monthKey,
      label: formatMonthShort(monthKey),
      recurringIncome,
      extraEntries,
      totalEntries,
      launchedExpenses,
      recurringExpenses,
      installmentsTotal,
      totalExpenses,
      savingsTotal,
      monthlySurplus,
      cumulativeBalance,
      dailyExpenses,
      committedPct,
    };
  });
}

// ============================================================================
// CENÁRIOS FINANCEIROS (regras exatas do script Python)
// ============================================================================
export interface ScenarioProjectionMonth {
  monthKey: string;
  label: string;
  todayIncome: number;
  todayExpense: number;
  todayCumulativeBalance: number;
  scenarioIncome: number;
  scenarioExpense: number;
  scenarioCumulativeBalance: number;
}

export function computeScenarioAnalysis(params: {
  panelRows: MonthlyPanelRow[];
  incomes: Income[];
  recurringItems?: RecurringItem[];
  goals: Goal[];
  expenseChangePct: number;
  incomeChangePct: number;
  mode: ScenarioMode;
  useCustomBaseExpense: boolean;
  customBaseExpense: number;
  refMonthKey?: string;
}) {
  const refMonthKey = params.refMonthKey ?? getCurrentMonthKey();
  const monthsWithSpend = params.panelRows.filter(
    (r) => r.launchedExpenses > 0 || r.recurringExpenses > 0 || r.installmentsTotal > 0
  );
  const autoBaseExpense =
    monthsWithSpend.length > 0
      ? monthsWithSpend.reduce((s, r) => s + r.totalExpenses, 0) / monthsWithSpend.length
      : 0;

  const baseExpense = params.useCustomBaseExpense ? params.customBaseExpense : autoBaseExpense;
  const fixedRecurringIncome = (params.recurringItems ?? [])
    .filter((item) => item.type === 'Entrada')
    .reduce((s, item) => s + getRecurringItemAmountInMonth(item, refMonthKey, [], true), 0);
  const baseIncome = getMonthlyCoupleIncome(params.incomes, refMonthKey) + fixedRecurringIncome;
  const currentReserve = params.goals.reduce((s, g) => s + g.currentAmount, 0);

  const todayIncome = baseIncome;
  const todayExpense = baseExpense;
  const todaySurplus = todayIncome - todayExpense;
  const todayCommittedPct = todayIncome > 0 ? todayExpense / todayIncome : 0;

  const scenarioIncome = baseIncome * (1 + params.incomeChangePct);
  const scenarioExpense = baseExpense * (1 + params.expenseChangePct);
  const scenarioSurplus = scenarioIncome - scenarioExpense;
  const scenarioCommittedPct = scenarioIncome > 0 ? scenarioExpense / scenarioIncome : 0;

  let prevToday = currentReserve;
  let prevScenario = currentReserve;

  const projection: ScenarioProjectionMonth[] = Array.from({ length: 12 }, (_, idx) => {
    const m = idx + 1;
    const monthKey = addMonthsToKey(refMonthKey, m);
    const factor = params.mode === 'De uma vez' ? 1 : m / 12;
    const scInc = baseIncome * (1 + params.incomeChangePct * factor);
    const scExp = baseExpense * (1 + params.expenseChangePct * factor);

    prevToday = prevToday + (todayIncome - todayExpense);
    prevScenario = prevScenario + (scInc - scExp);

    return {
      monthKey,
      label: formatMonthShort(monthKey),
      todayIncome,
      todayExpense,
      todayCumulativeBalance: prevToday,
      scenarioIncome: scInc,
      scenarioExpense: scExp,
      scenarioCumulativeBalance: prevScenario,
    };
  });

  const lastMonth = projection[projection.length - 1];
  const today12mSurplus = (lastMonth?.todayCumulativeBalance ?? currentReserve) - currentReserve;
  const scenario12mSurplus = (lastMonth?.scenarioCumulativeBalance ?? currentReserve) - currentReserve;

  const todayFinal12m = lastMonth?.todayCumulativeBalance ?? currentReserve;
  const scenarioFinal12m = lastMonth?.scenarioCumulativeBalance ?? currentReserve;

  const todayReserveDuration = todaySurplus < 0 ? currentReserve / -todaySurplus : null;
  const scenarioReserveDuration = scenarioSurplus < 0 ? currentReserve / -scenarioSurplus : null;

  let verdict: { level: 'neutral' | 'danger' | 'warning' | 'ok'; text: string };
  if (baseIncome === 0) {
    verdict = { level: 'neutral', text: 'Cadastre as rendas ou ganhos fixos para ver o impacto completo na sobra mensal.' };
  } else if (scenarioSurplus < 0) {
    verdict = {
      level: 'danger',
      text: 'ATENÇÃO: neste cenário os gastos superam a renda — a reserva financeira começa a ser consumida.',
    };
  } else if (todaySurplus > 0 && scenarioSurplus < todaySurplus * 0.5) {
    verdict = {
      level: 'warning',
      text: 'CUIDADO: a sobra mensal cai mais da metade, mas ainda permanece positiva.',
    };
  } else {
    verdict = {
      level: 'ok',
      text: 'OK: o cenário simulado cabe no orçamento do casal com folga.',
    };
  }

  return {
    autoBaseExpense,
    baseIncome,
    baseExpense,
    currentReserve,
    todayIncome,
    todayExpense,
    todaySurplus,
    todayCommittedPct,
    today12mSurplus,
    todayFinal12m,
    todayReserveDuration,
    scenarioIncome,
    scenarioExpense,
    scenarioSurplus,
    scenarioCommittedPct,
    scenario12mSurplus,
    scenarioFinal12m,
    scenarioReserveDuration,
    projection,
    verdict,
  };
}

// ============================================================================
// HORIZONTE DE GASTOS (DE DEZ/2026 ATÉ O INFINITO + SIMULAÇÃO DE COMPRAS)
// ============================================================================
export interface HorizonMonthRow extends MonthlyPanelRow {
  simulatedPurchaseImpact: number;
  simulatedExpenses: number;
  simulatedSurplus: number;
  simulatedCumulativeBalance: number;
  simulatedCommittedPct: number;
}

export function getSimulatedPurchaseAmountInMonth(
  item: SimulatedPurchase,
  monthKey: string,
  cards: CreditCard[] = []
): number {
  if (!item.enabled || item.totalAmount <= 0) return 0;
  let effectiveStart = item.startMonthKey;

  if (item.cardId && item.mode !== 'fixo') {
    const card = cards.find((c) => c.id === item.cardId);
    if (card && item.purchaseDay >= card.closingDay) {
      effectiveStart = addMonthsToKey(item.startMonthKey, 1);
    }
  }

  if (monthKey < effectiveStart) return 0;

  if (item.mode === 'avista') {
    return monthKey === effectiveStart ? item.totalAmount : 0;
  }

  if (item.mode === 'parcelado') {
    const count = Math.max(1, Math.round(item.installmentsCount || 1));
    const diff = monthDiff(effectiveStart, monthKey);
    if (diff >= 0 && diff < count) {
      return item.totalAmount / count;
    }
    return 0;
  }

  // 'fixo' (recorrente mensal contínuo ou até endMonthKey)
  if (item.endMonthKey && monthKey > item.endMonthKey) return 0;
  return item.totalAmount;
}

export function computeSpendingHorizon(params: {
  monthKeys: string[];
  incomes: Income[];
  transactions: Transaction[];
  installments: Installment[];
  recurringItems: RecurringItem[];
  cards: CreditCard[];
  simulatedPurchases: SimulatedPurchase[];
}) {
  const baseRows = computeMonthlyPanel(
    params.monthKeys,
    params.incomes,
    params.transactions,
    params.installments,
    params.recurringItems
  );

  let simulatedCumulativeBalance = 0;
  const rows: HorizonMonthRow[] = baseRows.map((row) => {
    const simulatedPurchaseImpact = params.simulatedPurchases.reduce(
      (sum, sim) => sum + getSimulatedPurchaseAmountInMonth(sim, row.monthKey, params.cards),
      0
    );
    const simulatedExpenses = row.totalExpenses + simulatedPurchaseImpact;
    const simulatedSurplus = row.monthlySurplus - simulatedPurchaseImpact;
    simulatedCumulativeBalance += simulatedSurplus;
    const simulatedCommittedPct = row.totalEntries > 0 ? simulatedExpenses / row.totalEntries : 0;

    return {
      ...row,
      simulatedPurchaseImpact,
      simulatedExpenses,
      simulatedSurplus,
      simulatedCumulativeBalance,
      simulatedCommittedPct,
    };
  });

  const totalBaseEntries = rows.reduce((s, r) => s + r.totalEntries, 0);
  const totalBaseExpenses = rows.reduce((s, r) => s + r.totalExpenses, 0);
  const totalSimulatedAdded = rows.reduce((s, r) => s + r.simulatedPurchaseImpact, 0);
  const totalSimulatedExpenses = totalBaseExpenses + totalSimulatedAdded;
  const totalSimulatedSurplus = rows.reduce((s, r) => s + r.simulatedSurplus, 0);

  let peakExpenseRow: HorizonMonthRow | null = null;
  let lowestSurplusRow: HorizonMonthRow | null = null;
  let firstNegativeRow: HorizonMonthRow | null = null;

  for (const r of rows) {
    if (!peakExpenseRow || r.simulatedExpenses > peakExpenseRow.simulatedExpenses) {
      peakExpenseRow = r;
    }
    if (!lowestSurplusRow || r.simulatedSurplus < lowestSurplusRow.simulatedSurplus) {
      lowestSurplusRow = r;
    }
    if (!firstNegativeRow && r.simulatedSurplus < 0) {
      firstNegativeRow = r;
    }
  }

  // Último mês com parcela existente ou simulada ativa
  let lastInstallmentMonth: string | null = null;
  for (const inst of params.installments) {
    const lastMk = addMonthsToKey(inst.firstChargeDate.slice(0, 7), Math.max(1, inst.installmentsCount) - 1);
    if (!lastInstallmentMonth || lastMk > lastInstallmentMonth) {
      lastInstallmentMonth = lastMk;
    }
  }
  for (const sim of params.simulatedPurchases) {
    if (!sim.enabled) continue;
    if (sim.mode === 'parcelado') {
      const card = params.cards.find((c) => c.id === sim.cardId);
      const effStart =
        card && sim.purchaseDay >= card.closingDay ? addMonthsToKey(sim.startMonthKey, 1) : sim.startMonthKey;
      const lastMk = addMonthsToKey(effStart, Math.max(1, sim.installmentsCount) - 1);
      if (!lastInstallmentMonth || lastMk > lastInstallmentMonth) {
        lastInstallmentMonth = lastMk;
      }
    }
  }

  // Equilíbrio perpétuo ("ao infinito"): rendas mensais/quinzenais/semanais contínuas menos fixos sem término
  const perpetualIncome =
    params.incomes
      .filter((i) => i.active && (i.frequency === 'Mensal' || i.frequency === 'Quinzenal' || i.frequency === 'Semanal'))
      .reduce((s, i) => s + getIncomeAmountInMonth(i, params.monthKeys[0] ?? getCurrentMonthKey()), 0) +
    params.recurringItems
      .filter((r) => r.active && r.type === 'Entrada' && !r.endMonthKey && r.frequency !== 'Anual')
      .reduce((s, r) => s + getRecurringItemRawAmountInMonth(r, '2099-01'), 0);

  const perpetualFixedExpense =
    params.recurringItems
      .filter((r) => r.active && r.type === 'Saída' && !r.endMonthKey && r.frequency !== 'Anual')
      .reduce((s, r) => s + getRecurringItemRawAmountInMonth(r, '2099-01'), 0) +
    params.simulatedPurchases
      .filter((s) => s.enabled && s.mode === 'fixo' && !s.endMonthKey)
      .reduce((s, item) => s + item.totalAmount, 0);

  const perpetualMonthlySurplus = perpetualIncome - perpetualFixedExpense;

  return {
    rows,
    summary: {
      monthsCount: rows.length,
      horizonStart: params.monthKeys[0] ?? getCurrentMonthKey(),
      horizonEnd: params.monthKeys[params.monthKeys.length - 1] ?? getCurrentMonthKey(),
      totalBaseEntries,
      totalBaseExpenses,
      totalSimulatedAdded,
      totalSimulatedExpenses,
      totalSimulatedSurplus,
      peakExpenseRow,
      lowestSurplusRow,
      firstNegativeRow,
      lastInstallmentMonth,
      perpetualIncome,
      perpetualFixedExpense,
      perpetualMonthlySurplus,
    },
  };
}

export function buildCoupleFinancialContextSummary(params: {
  householdName?: string;
  partner1Name?: string;
  partner2Name?: string;
  memberNames?: string[];
  incomes: Income[];
  transactions: Transaction[];
  recurringItems: RecurringItem[];
  cards: CreditCard[];
  installments: Installment[];
  goals: Goal[];
  plannedPurchases: PlannedPurchase[];
  horizonStartMonth?: string;
  horizonMonthsCount?: number;
}): string {
  const refMonth = getCurrentMonthKey();
  const horizonKeys = getMonthKeysFromStart(params.horizonStartMonth || '2026-12', Math.min(36, params.horizonMonthsCount || 24));
  const [nowRow] = computeMonthlyPanel([refMonth], params.incomes, params.transactions, params.installments, params.recurringItems);
  const horizonRows = computeMonthlyPanel(horizonKeys, params.incomes, params.transactions, params.installments, params.recurringItems);

  const totalSaved = params.goals.reduce((s, g) => s + g.currentAmount, 0);
  const activeCardsText = params.cards
    .filter((c) => c.active)
    .map((c) => {
      const inv = getCardInvoiceInMonth(c, refMonth, params.transactions, params.installments, params.recurringItems);
      return `${c.name} (${c.holder}): fatura atual ${formatBRL(inv.total)}, limite ${formatBRL(c.limit)}, fecha dia ${c.closingDay}, vence dia ${c.dueDay}`;
    })
    .join('; ');

  const recurringExpText = params.recurringItems
    .filter((r) => r.active && r.type === 'Saída')
    .slice(0, 12)
    .map((r) => `${r.description} (${formatBRL(r.amount)}/${r.frequency}, início ${r.startMonthKey}${r.endMonthKey ? `, fim ${r.endMonthKey}` : ', contínuo'})`)
    .join('; ');

  const recurringIncText = [
    ...params.incomes.filter((i) => i.active).map((i) => `${i.source} (${i.person}: ${formatBRL(i.amount)}/${i.frequency})`),
    ...params.recurringItems
      .filter((r) => r.active && r.type === 'Entrada')
      .map((r) => `${r.description} (${r.person}: ${formatBRL(r.amount)}/${r.frequency})`),
  ].join('; ');

  const activeInstText = params.installments
    .map((inst) => {
      const s = computeInstallmentSummary(inst, refMonth);
      if (s.remainingInstallments <= 0) return null;
      return `${inst.description} (${s.remainingInstallments}/${inst.installmentsCount}x de ${formatBRL(s.installmentValue)}, termina ${formatMonthShort(s.lastMonthKey)})`;
    })
    .filter(Boolean)
    .slice(0, 12)
    .join('; ');

  const plannedPendingText = params.plannedPurchases
    .filter((p) => p.status === 'Pendente' || p.status === 'Pesquisando')
    .slice(0, 8)
    .map((p) => `${p.product} (${formatBRL(p.estimatedUnitPrice * p.quantity)}, prioridade ${p.priority}/10)`)
    .join('; ');

  const horizonSampleText = horizonRows
    .slice(0, 12)
    .map((r) => `${formatMonthShort(r.monthKey)}: ent ${formatBRL0(r.totalEntries)}, gast ${formatBRL0(r.totalExpenses)}, sobra ${formatBRL0(r.monthlySurplus)}`)
    .join(' | ');

  const membersLabel =
    params.memberNames && params.memberNames.length > 0
      ? params.memberNames.join(', ')
      : `${params.partner1Name || 'Pessoa 1'} & ${params.partner2Name || 'Pessoa 2'}`;

  return [
    `Espaço: ${params.householdName || 'Espaço Compartilhado'} (${membersLabel}).`,
    `Mês atual (${formatMonthShort(refMonth)}): Entradas ${formatBRL(nowRow.totalEntries)} | Gastos ${formatBRL(nowRow.totalExpenses)} (Lançados ${formatBRL(nowRow.launchedExpenses)}, Fixos ${formatBRL(nowRow.recurringExpenses)}, Parcelas ${formatBRL(nowRow.installmentsTotal)}) | Sobra ${formatBRL(nowRow.monthlySurplus)}.`,
    `Reserva acumulada em metas: ${formatBRL(totalSaved)} (${params.goals.length} metas).`,
    `Rendas ativas: ${recurringIncText || 'Nenhuma cadastrada'}.`,
    `Despesas fixas ativas: ${recurringExpText || 'Nenhuma cadastrada'}.`,
    `Cartões ativos: ${activeCardsText || 'Nenhum cadastrado'}.`,
    `Parcelamentos ativos: ${activeInstText || 'Nenhum ativo'}.`,
    `Compras planejadas pendentes: ${plannedPendingText || 'Nenhuma pendente'}.`,
    `Horizonte próximo (${horizonKeys.length}m a partir de ${formatMonthShort(horizonKeys[0])}): ${horizonSampleText}.`,
  ].join('\n');
}

// ============================================================================
// RESUMO DIÁRIO, SALDO NAS CONTAS E REALIZADO VS PREVISTO NO MÊS
// ============================================================================
export interface HomeRealizedAndDailyMetrics {
  totalAccountsBalance: number;
  activeAccountsCount: number;
  realizedEntries: number;
  expectedEntriesTotal: number;
  pendingEntries: number;
  realizedExpenses: number;
  expectedExpensesTotal: number;
  pendingExpenses: number;
  savingsTotal: number;
  monthlySurplus: number;
  daysRemainingInMonth: number;
  dailySafeSpend: number;
  dailyBudgetBase: number;
  dailyBudgetSource: 'orcamento' | 'saldo_contas' | 'zerado';
}

export function computeHomeRealizedAndDailyMetrics(params: {
  monthKey: string;
  todayISO?: string;
  bankAccounts: BankAccount[];
  incomes: Income[];
  transactions: Transaction[];
  installments: Installment[];
  recurringItems: RecurringItem[];
}): HomeRealizedAndDailyMetrics {
  const todayISO = params.todayISO ?? getTodayISO();
  const activeAccounts = params.bankAccounts.filter((a) => a.active);
  const totalAccountsBalance = activeAccounts.reduce((s, a) => s + a.balance, 0);

  const [panelRow] = computeMonthlyPanel(
    [params.monthKey],
    params.incomes,
    params.transactions,
    params.installments,
    params.recurringItems
  );

  const monthTxs = params.transactions.filter((tx) => tx.monthKey === params.monthKey);
  const realizedEntries = monthTxs
    .filter((tx) => tx.type === 'Entrada' && tx.status === 'Pago')
    .reduce((s, tx) => s + tx.actualAmount, 0);

  const realizedExpenses = monthTxs
    .filter((tx) => tx.type === 'Saída' && tx.status === 'Pago')
    .reduce((s, tx) => s + tx.actualAmount, 0);

  const expectedEntriesTotal = panelRow?.totalEntries ?? 0;
  const expectedExpensesTotal = panelRow?.totalExpenses ?? 0;
  const savingsTotal = panelRow?.savingsTotal ?? 0;
  const monthlySurplus = panelRow?.monthlySurplus ?? 0;

  const pendingEntries = Math.max(0, expectedEntriesTotal - realizedEntries);
  const pendingExpenses = Math.max(0, expectedExpensesTotal - realizedExpenses);

  const [yStr, mStr] = params.monthKey.split('-');
  const daysInMonth = new Date(Number(yStr), Number(mStr), 0).getDate();
  const isCurrentMonth = todayISO.slice(0, 7) === params.monthKey;
  const currentDay = isCurrentMonth ? Number(todayISO.slice(8, 10)) || 1 : 1;
  const daysRemainingInMonth = Math.max(1, daysInMonth - currentDay + 1);

  let dailyBudgetBase = 0;
  let dailyBudgetSource: 'orcamento' | 'saldo_contas' | 'zerado' = 'zerado';

  if (expectedEntriesTotal > 0) {
    dailyBudgetBase = Math.max(0, monthlySurplus);
    dailyBudgetSource = monthlySurplus > 0 ? 'orcamento' : 'zerado';
  } else if (activeAccounts.length > 0 && totalAccountsBalance > 0) {
    dailyBudgetBase = Math.max(0, totalAccountsBalance - pendingExpenses);
    dailyBudgetSource = dailyBudgetBase > 0 ? 'saldo_contas' : 'zerado';
  }

  const dailySafeSpend = daysRemainingInMonth > 0 ? dailyBudgetBase / daysRemainingInMonth : 0;

  return {
    totalAccountsBalance,
    activeAccountsCount: activeAccounts.length,
    realizedEntries,
    expectedEntriesTotal,
    pendingEntries,
    realizedExpenses,
    expectedExpensesTotal,
    pendingExpenses,
    savingsTotal,
    monthlySurplus,
    daysRemainingInMonth,
    dailySafeSpend,
    dailyBudgetBase,
    dailyBudgetSource,
  };
}

// ============================================================================
// HORIZONTE CURTO (7 DIAS E 1 MÊS / 30 DIAS — PROJEÇÃO DIA A DIA)
// ============================================================================
export interface HorizonDayRow {
  dateISO: string;
  label: string;
  weekday: string;
  entries: number;
  expenses: number;
  cardInvoicesTotal: number;
  simulatedImpact: number;
  netDay: number;
  projectedBalance: number;
  events: string[];
}

export interface ShortHorizonResult {
  daysCount: number;
  startDateISO: string;
  endDateISO: string;
  hasAccountBalances: boolean;
  startBalance: number;
  rows: HorizonDayRow[];
  summary: {
    startBalance: number;
    endBalance: number;
    totalEntries: number;
    totalExpenses: number;
    totalSimulatedImpact: number;
    lowestBalance: number;
    lowestDay: HorizonDayRow | null;
    firstNegativeDay: HorizonDayRow | null;
  };
}

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function addDaysISO(baseISO: string, offsetDays: number): string {
  const [y, m, d] = baseISO.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + offsetDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function getDaysInYearMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function matchesRecurringDay(dayInMonth: number, targetDay: number, frequency: string, maxDay: number, occDateISO: string, startMonthKey: string): boolean {
  const clampedTarget = Math.min(maxDay, Math.max(1, Math.round(targetDay)));
  if (frequency === 'Mensal') {
    return dayInMonth === clampedTarget;
  }
  if (frequency === 'Quinzenal') {
    const secondDay = clampedTarget <= 15 ? Math.min(maxDay, clampedTarget + 15) : Math.max(1, clampedTarget - 15);
    return dayInMonth === clampedTarget || dayInMonth === secondDay;
  }
  if (frequency === 'Semanal') {
    return (dayInMonth - clampedTarget) % 7 === 0 && dayInMonth >= clampedTarget
      ? true
      : (clampedTarget - dayInMonth) % 7 === 0;
  }
  if (frequency === 'Anual') {
    return occDateISO.slice(5, 7) === startMonthKey.slice(5, 7) && dayInMonth === clampedTarget;
  }
  return dayInMonth === clampedTarget;
}

export interface HorizonWeekRow {
  weekIndex: number;
  label: string;
  rangeLabel: string;
  entries: number;
  expenses: number;
  cardInvoicesTotal: number;
  simulatedImpact: number;
  netWeek: number;
  projectedBalance: number;
  events: string[];
}

export function computeWeeklyRollupFromShortHorizon(shortHorizon: ShortHorizonResult): HorizonWeekRow[] {
  const weeks: HorizonWeekRow[] = [];
  for (let i = 0; i < shortHorizon.rows.length; i += 7) {
    const chunk = shortHorizon.rows.slice(i, i + 7);
    if (chunk.length === 0) continue;
    const weekIndex = weeks.length + 1;
    const entries = chunk.reduce((s, r) => s + r.entries, 0);
    const expenses = chunk.reduce((s, r) => s + r.expenses, 0);
    const cardInvoicesTotal = chunk.reduce((s, r) => s + r.cardInvoicesTotal, 0);
    const simulatedImpact = chunk.reduce((s, r) => s + r.simulatedImpact, 0);
    const netWeek = entries - expenses;
    const projectedBalance = chunk[chunk.length - 1].projectedBalance;
    const events = chunk.flatMap((r) => r.events);
    weeks.push({
      weekIndex,
      label: `Sem ${weekIndex}`,
      rangeLabel: `${chunk[0].label}–${chunk[chunk.length - 1].label}`,
      entries,
      expenses,
      cardInvoicesTotal,
      simulatedImpact,
      netWeek,
      projectedBalance,
      events,
    });
  }
  return weeks;
}

export function computeShortHorizon(params: {
  daysCount: 7 | 28 | 30;
  startDateISO?: string;
  bankAccounts: BankAccount[];
  incomes: Income[];
  transactions: Transaction[];
  installments: Installment[];
  recurringItems: RecurringItem[];
  cards: CreditCard[];
  simulatedPurchases: SimulatedPurchase[];
}): ShortHorizonResult {
  const startDateISO = params.startDateISO ?? getTodayISO();
  const activeAccounts = params.bankAccounts.filter((a) => a.active);
  const hasAccountBalances = activeAccounts.length > 0;
  const startBalance = activeAccounts.reduce((s, a) => s + a.balance, 0);

  let runningBalance = startBalance;
  const rows: HorizonDayRow[] = [];

  for (let i = 0; i < params.daysCount; i++) {
    const dateISO = addDaysISO(startDateISO, i);
    const monthKey = dateISO.slice(0, 7);
    const dayOfMonth = Number(dateISO.slice(8, 10));
    const maxDay = getDaysInYearMonth(monthKey);
    const [yy, mm, dd] = dateISO.split('-').map(Number);
    const weekday = WEEKDAY_SHORT[new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay()] ?? '';
    const label = `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}`;

    let entries = 0;
    let expenses = 0;
    let cardInvoicesTotal = 0;
    let simulatedImpact = 0;
    const events: string[] = [];

    // 1. Pendente concrete transactions scheduled for this date (non-credit-card; credit card flows via card invoice on dueDay)
    for (const tx of params.transactions) {
      const effectiveDate = (tx.dueDate && tx.dueDate.length >= 10 ? tx.dueDate : tx.date).slice(0, 10);
      if (effectiveDate !== dateISO) continue;
      if (tx.paymentMethod === 'Crédito') continue;
      // If date is today and already Pago with bank balances present, it is already reflected in startBalance
      if (tx.status === 'Pago' && (hasAccountBalances || i === 0)) continue;
      if (tx.status === 'Pendente' || (!hasAccountBalances && i > 0)) {
        if (tx.type === 'Entrada') {
          entries += tx.actualAmount;
          events.push(`+ ${tx.description}`);
        } else if (tx.type === 'Saída') {
          expenses += tx.actualAmount;
          events.push(`- ${tx.description}`);
        }
      }
    }

    // 2. Active Incomes falling on this day
    for (const inc of params.incomes) {
      if (!inc.active) continue;
      let matches = false;
      if (inc.frequency === 'Única') {
        matches = inc.receiptDate?.slice(0, 10) === dateISO;
      } else if (inc.frequency === 'Anual') {
        matches =
          Boolean(inc.receiptDate) &&
          inc.receiptDate.slice(5, 10) === dateISO.slice(5, 10);
      } else {
        matches = matchesRecurringDay(dayOfMonth, inc.receiptDay || 5, inc.frequency, maxDay, dateISO, monthKey);
      }
      if (matches) {
        entries += inc.amount;
        events.push(`+ ${inc.source}`);
      }
    }

    // 3. Active non-card recurring items falling on this day (if not already settled in this month)
    for (const rec of params.recurringItems) {
      if (!rec.active) continue;
      if (rec.paymentMethod === 'Crédito') continue;
      if (rec.startMonthKey && monthKey < rec.startMonthKey) continue;
      if (rec.endMonthKey && monthKey > rec.endMonthKey) continue;
      if (isRecurringItemSettledInMonth(rec.id, monthKey, params.transactions)) continue;

      if (matchesRecurringDay(dayOfMonth, rec.dayOfMonth, rec.frequency, maxDay, dateISO, rec.startMonthKey)) {
        if (rec.type === 'Entrada') {
          entries += rec.amount;
          events.push(`+ ${rec.description}`);
        } else {
          expenses += rec.amount;
          events.push(`- ${rec.description}`);
        }
      }
    }

    // 4. Credit Card Invoices due on this day + simulated card purchases due on this day
    for (const card of params.cards) {
      if (!card.active) continue;
      const clampedDue = Math.min(maxDay, Math.max(1, card.dueDay));
      if (dayOfMonth !== clampedDue) continue;

      const inv = getCardInvoiceInMonth(card, monthKey, params.transactions, params.installments, params.recurringItems);
      const simCardAmount = params.simulatedPurchases
        .filter((s) => s.enabled && s.cardId === card.id)
        .reduce((sum, s) => sum + getSimulatedPurchaseAmountInMonth(s, monthKey, params.cards), 0);

      if (inv.total > 0 || simCardAmount > 0) {
        cardInvoicesTotal += inv.total;
        expenses += inv.total + simCardAmount;
        simulatedImpact += simCardAmount;
        events.push(`Fatura ${card.name}`);
      }
    }

    // 5. Simulated non-card purchases (or without cardId) falling on their purchaseDay
    for (const sim of params.simulatedPurchases) {
      if (!sim.enabled || sim.cardId) continue;
      const clampedDay = Math.min(maxDay, Math.max(1, sim.purchaseDay || 1));
      if (dayOfMonth !== clampedDay) continue;
      const amt = getSimulatedPurchaseAmountInMonth(sim, monthKey, params.cards);
      if (amt > 0) {
        expenses += amt;
        simulatedImpact += amt;
        events.push(`Sim: ${sim.description}`);
      }
    }

    const netDay = entries - expenses;
    runningBalance += netDay;

    rows.push({
      dateISO,
      label,
      weekday,
      entries,
      expenses,
      cardInvoicesTotal,
      simulatedImpact,
      netDay,
      projectedBalance: runningBalance,
      events,
    });
  }

  let lowestDay: HorizonDayRow | null = null;
  let firstNegativeDay: HorizonDayRow | null = null;
  for (const r of rows) {
    if (!lowestDay || r.projectedBalance < lowestDay.projectedBalance) lowestDay = r;
    if (!firstNegativeDay && r.projectedBalance < 0) firstNegativeDay = r;
  }

  return {
    daysCount: params.daysCount,
    startDateISO,
    endDateISO: rows[rows.length - 1]?.dateISO ?? startDateISO,
    hasAccountBalances,
    startBalance,
    rows,
    summary: {
      startBalance,
      endBalance: rows[rows.length - 1]?.projectedBalance ?? startBalance,
      totalEntries: rows.reduce((s, r) => s + r.entries, 0),
      totalExpenses: rows.reduce((s, r) => s + r.expenses, 0),
      totalSimulatedImpact: rows.reduce((s, r) => s + r.simulatedImpact, 0),
      lowestBalance: lowestDay?.projectedBalance ?? startBalance,
      lowestDay,
      firstNegativeDay,
    },
  };
}

// ============================================================================
// CALCULADORA ECONÔMICA RÁPIDA (JUROS SIMPLES / COMPOSTOS E PORCENTAGEM)
// ============================================================================
export interface QuickInterestInput {
  principal: number;
  ratePct: number;
  rateUnit: 'mensal' | 'anual';
  months: number;
  regime: 'composto' | 'simples';
}

export interface QuickInterestResult {
  totalAmount: number;
  totalInterest: number;
  monthlyRatePct: number;
  increasePct: number;
  monthlyEquivalent: number;
}

export function computeQuickInterest(input: QuickInterestInput): QuickInterestResult {
  const principal = Number.isFinite(input.principal) ? Math.max(0, input.principal) : 0;
  const ratePct = Number.isFinite(input.ratePct) ? Math.max(0, input.ratePct) : 0;
  const months = Number.isFinite(input.months) ? Math.max(1, Math.round(input.months)) : 1;

  const rawRate = ratePct / 100;
  const monthlyRate =
    input.rateUnit === 'mensal'
      ? rawRate
      : input.regime === 'composto'
        ? Math.pow(1 + rawRate, 1 / 12) - 1
        : rawRate / 12;

  const totalAmount =
    input.regime === 'composto'
      ? principal * Math.pow(1 + monthlyRate, months)
      : principal * (1 + monthlyRate * months);

  const totalInterest = Math.max(0, totalAmount - principal);
  const increasePct = principal > 0 ? (totalInterest / principal) * 100 : 0;
  const monthlyEquivalent = months > 0 ? totalAmount / months : totalAmount;

  return {
    totalAmount,
    totalInterest,
    monthlyRatePct: monthlyRate * 100,
    increasePct,
    monthlyEquivalent,
  };
}

// ============================================================================
// CALENDÁRIO VISUAL E AGENDA FINANCEIRA DO MÊS
// ============================================================================
export type CalendarEventTone = 'positive' | 'negative' | 'warning' | 'neutral';

export interface CalendarDayEvent {
  id: string;
  dateISO: string;
  title: string;
  subtitle: string;
  amount: number | null;
  tone: CalendarEventTone;
  isPrimary: boolean;
  kind: 'tx' | 'income' | 'recurring' | 'card_due' | 'card_close';
  tx?: Transaction;
  recurringItem?: RecurringItem;
  route?: 'cartoes' | 'fixos' | 'renda' | 'lancamentos';
}

export interface CalendarDaySummary {
  dateISO: string;
  day: number;
  weekdayShort: string;
  tone: CalendarEventTone | null;
  entriesTotal: number;
  expensesTotal: number;
  events: CalendarDayEvent[];
}

export interface MonthCalendarData {
  monthKey: string;
  daysInMonth: number;
  leadingEmptyDays: number;
  daySummaries: Record<string, CalendarDaySummary>;
  agendaGroups: CalendarDaySummary[];
  nextMonthPreview: {
    monthKey: string;
    daysInMonth: number;
    leadingEmptyDays: number;
    dayTones: Record<number, CalendarEventTone>;
  };
}

const WEEKDAY_LOWER = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function resolveDayTone(events: CalendarDayEvent[]): CalendarEventTone | null {
  if (events.length === 0) return null;
  const hasCardDue = events.some((e) => e.kind === 'card_due');
  const hasNegativePrimary = events.some((e) => e.isPrimary && e.tone === 'negative');
  const hasPositivePrimary = events.some((e) => e.isPrimary && e.tone === 'positive');

  if (hasNegativePrimary && !hasCardDue && !hasPositivePrimary) return 'negative';
  if (hasCardDue || (hasNegativePrimary && hasPositivePrimary)) return 'warning';
  if (hasPositivePrimary) return 'positive';
  if (events.some((e) => e.tone === 'negative')) return 'negative';
  if (events.some((e) => e.tone === 'warning')) return 'warning';
  return 'neutral';
}

function buildEventsForMonth(params: {
  monthKey: string;
  transactions: Transaction[];
  recurringItems: RecurringItem[];
  incomes: Income[];
  cards: CreditCard[];
  installments: Installment[];
}): Record<number, CalendarDayEvent[]> {
  const { monthKey, transactions, recurringItems, incomes, cards, installments } = params;
  const maxDay = getDaysInYearMonth(monthKey);
  const byDay: Record<number, CalendarDayEvent[]> = {};
  const push = (day: number, ev: CalendarDayEvent) => {
    const clamped = Math.min(maxDay, Math.max(1, Math.round(day)));
    if (!byDay[clamped]) byDay[clamped] = [];
    byDay[clamped].push(ev);
  };

  // 1. Concretes / pending transactions falling in this month
  for (const tx of transactions) {
    const effectiveDate = (tx.dueDate && tx.dueDate.length >= 10 ? tx.dueDate : tx.date).slice(0, 10);
    if (effectiveDate.slice(0, 7) !== monthKey) continue;
    const day = Number(effectiveDate.slice(8, 10)) || 1;
    const isEntry = tx.type === 'Entrada';
    const isExpense = tx.type === 'Saída';
    const isPending = tx.status === 'Pendente';

    const tone: CalendarEventTone = isEntry
      ? 'positive'
      : isExpense
        ? isPending
          ? 'negative'
          : 'neutral'
        : 'neutral';

    push(day, {
      id: `tx-${tx.id}`,
      dateISO: effectiveDate,
      title: tx.description,
      subtitle: `${tx.category} · ${tx.paymentMethod}${isPending ? ' · Pendente' : ''}`,
      amount: tx.actualAmount,
      tone,
      isPrimary: isEntry || (isExpense && isPending),
      kind: 'tx',
      tx,
      route: 'lancamentos',
    });
  }

  // 2. Active Incomes falling in this month
  for (const inc of incomes) {
    if (!inc.active) continue;
    for (let d = 1; d <= maxDay; d++) {
      const dateISO = buildDateInMonth(monthKey, d);
      let matches = false;
      if (inc.frequency === 'Única') {
        matches = inc.receiptDate?.slice(0, 10) === dateISO;
      } else if (inc.frequency === 'Anual') {
        matches = Boolean(inc.receiptDate) && inc.receiptDate.slice(5, 10) === dateISO.slice(5, 10);
      } else {
        matches = matchesRecurringDay(d, inc.receiptDay || 5, inc.frequency, maxDay, dateISO, monthKey);
      }
      if (matches) {
        push(d, {
          id: `inc-${inc.id}-${d}`,
          dateISO,
          title: inc.source,
          subtitle: `Renda · ${inc.person}`,
          amount: inc.amount,
          tone: 'positive',
          isPrimary: true,
          kind: 'income',
          route: 'renda',
        });
      }
    }
  }

  // 3. Unsettled active recurring items (non-credit-card)
  for (const rec of recurringItems) {
    if (!rec.active) continue;
    if (rec.paymentMethod === 'Crédito') continue;
    if (rec.startMonthKey && monthKey < rec.startMonthKey) continue;
    if (rec.endMonthKey && monthKey > rec.endMonthKey) continue;
    if (isRecurringItemSettledInMonth(rec.id, monthKey, transactions)) continue;

    for (let d = 1; d <= maxDay; d++) {
      const dateISO = buildDateInMonth(monthKey, d);
      if (matchesRecurringDay(d, rec.dayOfMonth, rec.frequency, maxDay, dateISO, rec.startMonthKey)) {
        const isEntry = rec.type === 'Entrada';
        push(d, {
          id: `rec-${rec.id}-${d}`,
          dateISO,
          title: rec.description,
          subtitle: `${rec.category} · Fixo (${rec.frequency})`,
          amount: rec.amount,
          tone: isEntry ? 'positive' : 'negative',
          isPrimary: true,
          kind: 'recurring',
          recurringItem: rec,
          route: 'fixos',
        });
      }
    }
  }

  // 4. Active Credit Card due dates and closing dates
  for (const card of cards) {
    if (!card.active) continue;
    const dueDay = Math.min(maxDay, Math.max(1, card.dueDay));
    const inv = getCardInvoiceInMonth(card, monthKey, transactions, installments, recurringItems);
    if (inv.total > 0) {
      push(dueDay, {
        id: `card-due-${card.id}`,
        dateISO: buildDateInMonth(monthKey, dueDay),
        title: `Fatura ${card.name}`,
        subtitle: `Vencimento dia ${dueDay} · ${card.holder}`,
        amount: inv.total,
        tone: 'warning',
        isPrimary: true,
        kind: 'card_due',
        route: 'cartoes',
      });
    }

    const closingDay = Math.min(maxDay, Math.max(1, card.closingDay));
    push(closingDay, {
      id: `card-close-${card.id}`,
      dateISO: buildDateInMonth(monthKey, closingDay),
      title: `Fechamento ${card.name}`,
      subtitle: `Melhor dia de compra após fechamento`,
      amount: null,
      tone: 'neutral',
      isPrimary: false,
      kind: 'card_close',
      route: 'cartoes',
    });
  }

  return byDay;
}

export function computeMonthCalendarData(params: {
  monthKey: string;
  transactions: Transaction[];
  recurringItems: RecurringItem[];
  incomes: Income[];
  cards: CreditCard[];
  installments: Installment[];
}): MonthCalendarData {
  const { monthKey, transactions, recurringItems, incomes, cards, installments } = params;
  const [y, m] = monthKey.split('-').map(Number);
  const daysInMonth = getDaysInYearMonth(monthKey);
  const leadingEmptyDays = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();

  const eventsByDay = buildEventsForMonth({
    monthKey,
    transactions,
    recurringItems,
    incomes,
    cards,
    installments,
  });

  const daySummaries: Record<string, CalendarDaySummary> = {};
  const agendaGroups: CalendarDaySummary[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateISO = buildDateInMonth(monthKey, day);
    const weekdayIdx = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
    const rawEvents = eventsByDay[day] ?? [];
    const sortedEvents = [...rawEvents].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

    const entriesTotal = sortedEvents
      .filter((e) => e.tone === 'positive' && e.amount !== null)
      .reduce((s, e) => s + (e.amount ?? 0), 0);

    const expensesTotal = sortedEvents
      .filter((e) => (e.tone === 'negative' || e.tone === 'warning' || (e.kind === 'tx' && e.tx?.type === 'Saída')) && e.amount !== null)
      .reduce((s, e) => s + (e.amount ?? 0), 0);

    const summary: CalendarDaySummary = {
      dateISO,
      day,
      weekdayShort: WEEKDAY_LOWER[weekdayIdx] ?? '',
      tone: resolveDayTone(sortedEvents),
      entriesTotal,
      expensesTotal,
      events: sortedEvents,
    };

    daySummaries[dateISO] = summary;
    if (sortedEvents.length > 0) {
      agendaGroups.push(summary);
    }
  }

  // Next month mini preview
  const nextMonthKey = addMonthsToKey(monthKey, 1);
  const [ny, nm] = nextMonthKey.split('-').map(Number);
  const nextDaysInMonth = getDaysInYearMonth(nextMonthKey);
  const nextLeadingEmptyDays = new Date(Date.UTC(ny, nm - 1, 1)).getUTCDay();
  const nextEventsByDay = buildEventsForMonth({
    monthKey: nextMonthKey,
    transactions,
    recurringItems,
    incomes,
    cards,
    installments,
  });

  const dayTones: Record<number, CalendarEventTone> = {};
  for (let d = 1; d <= nextDaysInMonth; d++) {
    const t = resolveDayTone(nextEventsByDay[d] ?? []);
    if (t) dayTones[d] = t;
  }

  return {
    monthKey,
    daysInMonth,
    leadingEmptyDays,
    daySummaries,
    agendaGroups,
    nextMonthPreview: {
      monthKey: nextMonthKey,
      daysInMonth: nextDaysInMonth,
      leadingEmptyDays: nextLeadingEmptyDays,
      dayTones,
    },
  };
}

export function formatDeviceBalanceTimestamp(date: Date = new Date(), authorName?: string): string {
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const hh = String(validDate.getHours()).padStart(2, '0');
  const mm = String(validDate.getMinutes()).padStart(2, '0');
  const dd = String(validDate.getDate()).padStart(2, '0');
  const mo = String(validDate.getMonth() + 1).padStart(2, '0');
  const cleanAuthor = authorName?.trim();
  return cleanAuthor
    ? `Última atualização ${hh}:${mm} ${dd}/${mo} ${cleanAuthor}`
    : `Última atualização ${hh}:${mm} ${dd}/${mo}`;
}


