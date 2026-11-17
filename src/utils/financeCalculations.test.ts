import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeFirstCreditInstallmentDate,
  computeGoalProjection,
  computeHomeRealizedAndDailyMetrics,
  computeInstallmentSummary,
  computeMemberIncomeAndSpendingBreakdown,
  computeMonthCalendarData,
  computeMonthlyPanel,
  computePlannedPurchaseMetrics,
  computeQuickInterest,
  computeScenarioAnalysis,
  computeShortHorizon,
  computeSpendingHorizon,
  computeWeeklyRollupFromShortHorizon,
  formatDeviceBalanceTimestamp,
  getCardInvoiceInMonth,
  getHouseholdPeople,
  getInstallmentAmountInMonth,
  getMonthKeysFromStart,
  getMonthKeysRange,
  getRecurringItemAmountInMonth,
} from './financeCalculations.ts';
import type {
  BankAccount,
  CreditCard,
  Goal,
  Household,
  Income,
  Installment,
  PlannedPurchase,
  RecurringItem,
  SimulatedPurchase,
  Transaction,
} from '../types/finance.ts';

const audit = {
  createdByUid: 'u1',
  createdByName: 'Ana',
  updatedByUid: 'u1',
  updatedByName: 'Ana',
};

describe('Finance Calculations Engine', () => {
  it('computes installment distribution across months accurately', () => {
    const inst: Installment = {
      id: 'i1',
      description: 'Notebook',
      cardId: 'c1',
      cardName: 'Cartão A',
      person: 'Ana',
      category: 'Educação',
      totalAmount: 3600,
      installmentsCount: 12,
      firstChargeDate: '2026-09-10',
      notes: '',
      ...audit,
    };

    const summary = computeInstallmentSummary(inst, '2026-11');
    assert.equal(summary.installmentValue, 300);
    assert.equal(summary.paidInstallments, 3);
    assert.equal(summary.remainingInstallments, 9);
    assert.equal(summary.remainingAmount, 2700);
    assert.equal(getInstallmentAmountInMonth(inst, '2026-08'), 0);
    assert.equal(getInstallmentAmountInMonth(inst, '2026-09'), 300);
    assert.equal(getInstallmentAmountInMonth(inst, '2027-08'), 300);
    assert.equal(getInstallmentAmountInMonth(inst, '2027-09'), 0);
  });

  it('routes credit card purchases past closingDay to next month invoice', () => {
    const card: CreditCard = {
      id: 'c1',
      name: 'Nubank',
      holder: 'Ana',
      limit: 5000,
      closingDay: 10,
      dueDay: 17,
      color: '#0F172A',
      active: true,
      ...audit,
    };

    const txBeforeClose: Transaction = {
      id: 't1',
      type: 'Saída',
      description: 'Mercado',
      plannedAmount: 200,
      actualAmount: 200,
      category: 'Mercado',
      person: 'Ana',
      date: '2026-11-05',
      monthKey: '2026-11',
      paymentMethod: 'Crédito',
      accountOrCard: 'Nubank',
      cardId: 'c1',
      status: 'Pago',
      dueDate: '',
      notes: '',
      ...audit,
    };

    const txAfterClose: Transaction = {
      ...txBeforeClose,
      id: 't2',
      description: 'Jantar',
      actualAmount: 150,
      plannedAmount: 150,
      date: '2026-11-12',
    };

    const invNov = getCardInvoiceInMonth(card, '2026-11', [txBeforeClose, txAfterClose], []);
    const invDec = getCardInvoiceInMonth(card, '2026-12', [txBeforeClose, txAfterClose], []);

    assert.equal(invNov.total, 200);
    assert.equal(invDec.total, 150);
  });

  it('projects fixed recurring expenses and gains across future months without double counting settled months', () => {
    const recurring: RecurringItem[] = [
      {
        id: 'rec-exp-1',
        type: 'Saída',
        description: 'Aluguel',
        amount: 2200,
        category: 'Moradia',
        person: 'Casal',
        frequency: 'Mensal',
        dayOfMonth: 5,
        startMonthKey: '2026-10',
        endMonthKey: '',
        paymentMethod: 'Pix',
        accountOrCard: 'Conta corrente',
        cardId: '',
        active: true,
        notes: '',
        ...audit,
      },
      {
        id: 'rec-inc-1',
        type: 'Entrada',
        description: 'Salário Fixo',
        amount: 6000,
        category: 'Outros',
        person: 'Ana',
        frequency: 'Mensal',
        dayOfMonth: 5,
        startMonthKey: '2026-10',
        endMonthKey: '',
        paymentMethod: 'Transferência',
        accountOrCard: 'Conta corrente',
        cardId: '',
        active: true,
        notes: '',
        ...audit,
      },
      {
        id: 'rec-card-1',
        type: 'Saída',
        description: 'Internet Fibra',
        amount: 120,
        category: 'Assinaturas',
        person: 'Casal',
        frequency: 'Mensal',
        dayOfMonth: 15,
        startMonthKey: '2026-11',
        endMonthKey: '',
        paymentMethod: 'Crédito',
        accountOrCard: 'Nubank',
        cardId: 'c1',
        active: true,
        notes: '',
        ...audit,
      },
    ];

    const settledOctRent: Transaction = {
      id: 'tx-oct-rent',
      type: 'Saída',
      description: 'Aluguel',
      plannedAmount: 2200,
      actualAmount: 2250, // actual amount adjusted in October
      category: 'Moradia',
      person: 'Casal',
      date: '2026-10-05',
      monthKey: '2026-10',
      paymentMethod: 'Pix',
      accountOrCard: 'Conta corrente',
      cardId: '',
      status: 'Pago',
      dueDate: '',
      notes: '',
      recurringId: 'rec-exp-1',
      recurringMonthKey: '2026-10',
      ...audit,
    };

    // Settled in October -> template yields 0, concrete tx provides 2250
    assert.equal(getRecurringItemAmountInMonth(recurring[0], '2026-10', [settledOctRent]), 0);
    assert.equal(getRecurringItemAmountInMonth(recurring[0], '2026-11', [settledOctRent]), 2200);
    assert.equal(getRecurringItemAmountInMonth(recurring[0], '2026-09', [settledOctRent]), 0);

    const monthKeys = ['2026-09', '2026-10', '2026-11', '2026-12'];
    const panel = computeMonthlyPanel(monthKeys, [], [settledOctRent], [], recurring);
    assert.equal(panel[0].totalEntries, 0);
    assert.equal(panel[0].totalExpenses, 0);

    assert.equal(panel[1].totalEntries, 6000);
    assert.equal(panel[1].launchedExpenses, 2250);
    assert.equal(panel[1].recurringExpenses, 0);
    assert.equal(panel[1].totalExpenses, 2250);

    assert.equal(panel[2].totalEntries, 6000);
    assert.equal(panel[2].recurringExpenses, 2320); // 2200 + 120
    assert.equal(panel[2].totalExpenses, 2320);

    // Card invoice shifts dayOfMonth 15 past closingDay 10 into Dec invoice
    const card: CreditCard = {
      id: 'c1',
      name: 'Nubank',
      holder: 'Ana',
      limit: 5000,
      closingDay: 10,
      dueDay: 17,
      color: '#0F172A',
      active: true,
      ...audit,
    };
    const invNov = getCardInvoiceInMonth(card, '2026-11', [settledOctRent], [], recurring);
    const invDec = getCardInvoiceInMonth(card, '2026-12', [settledOctRent], [], recurring);
    assert.equal(invNov.total, 0);
    assert.equal(invDec.total, 120);
  });

  it('computes goal FV and months-to-goal accurately', () => {
    const goal: Goal = {
      id: 'g1',
      name: 'Reserva',
      targetAmount: 12000,
      currentAmount: 2000,
      monthlyContribution: 1000,
      annualYieldRate: 0,
      notes: '',
      ...audit,
    };

    const proj = computeGoalProjection(goal, '2026-11');
    assert.equal(proj.monthsToGoal, 10);
    assert.equal(proj.balanceIn12Months, 14000);
    assert.equal(proj.completionMonthKey, '2027-09');
  });

  it('computes planned purchase price comparison correctly', () => {
    const item: PlannedPurchase = {
      id: 'p1',
      priority: 9,
      room: 'Cozinha',
      product: 'Geladeira',
      brandModel: '',
      specs: '',
      quantity: 2,
      estimatedUnitPrice: 1000,
      actualUnitPrice: 900,
      hasActualPrice: true,
      targetDate: '',
      purchaseDate: '2026-11-01',
      paymentMethod: 'Pix',
      status: 'Comprado',
      notes: '',
      ...audit,
    };
    const m = computePlannedPurchaseMetrics(item);
    assert.equal(m.totalEstimated, 2000);
    assert.equal(m.totalPaid, 1800);
    assert.equal(m.difference, 200);
    assert.equal(m.comparison, 'Abaixo do planejado');
  });

  it('computes monthly panel and 12-month scenario projection accurately', () => {
    const incomes: Income[] = [
      {
        id: 'inc1',
        person: 'Ana',
        source: 'Salário',
        amount: 5000,
        frequency: 'Mensal',
        receiptDay: 5,
        receiptDate: '',
        active: true,
        notes: '',
        ...audit,
      },
    ];
    const txs: Transaction[] = [
      {
        id: 't1',
        type: 'Saída',
        description: 'Aluguel',
        plannedAmount: 2000,
        actualAmount: 2000,
        category: 'Moradia',
        person: 'Ana',
        date: '2026-11-05',
        monthKey: '2026-11',
        paymentMethod: 'Pix',
        accountOrCard: 'Conta corrente',
        cardId: '',
        status: 'Pago',
        dueDate: '',
        notes: '',
        ...audit,
      },
    ];

    const monthKeys = getMonthKeysFromStart('2026-01-01', 12);
    const panel = computeMonthlyPanel(monthKeys, incomes, txs, []);
    const nov = panel.find((r) => r.monthKey === '2026-11');
    assert.ok(nov);
    assert.equal(nov.totalEntries, 5000);
    assert.equal(nov.totalExpenses, 2000);
    assert.equal(nov.monthlySurplus, 3000);

    const scenario = computeScenarioAnalysis({
      panelRows: panel,
      incomes,
      goals: [],
      expenseChangePct: 0.2,
      incomeChangePct: 0,
      mode: 'De uma vez',
      useCustomBaseExpense: false,
      customBaseExpense: 0,
      refMonthKey: '2026-11',
    });
    assert.equal(scenario.todayExpense, 2000);
    assert.equal(scenario.scenarioExpense, 2400);
    assert.equal(scenario.scenarioSurplus, 2600);
  });

  it('computes Horizonte de Gastos across free multi-year range (Dec/2026+) and purchase simulations', () => {
    const keys = getMonthKeysRange('2026-12', '2029-11'); // 36 months
    assert.equal(keys.length, 36);
    assert.equal(keys[0], '2026-12');
    assert.equal(keys[35], '2029-11');

    const incomes: Income[] = [
      {
        id: 'inc1',
        person: 'Ana',
        source: 'Salário',
        amount: 8000,
        frequency: 'Mensal',
        receiptDay: 5,
        receiptDate: '',
        active: true,
        notes: '',
        ...audit,
      },
    ];

    const recurring: RecurringItem[] = [
      {
        id: 'rec1',
        type: 'Saída',
        description: 'Aluguel',
        amount: 2500,
        category: 'Moradia',
        person: 'Casal',
        frequency: 'Mensal',
        dayOfMonth: 5,
        startMonthKey: '2026-01',
        endMonthKey: '',
        paymentMethod: 'Pix',
        accountOrCard: 'Conta corrente',
        cardId: '',
        active: true,
        notes: '',
        ...audit,
      },
    ];

    const card: CreditCard = {
      id: 'c1',
      name: 'Nubank',
      holder: 'Ana',
      limit: 10000,
      closingDay: 10,
      dueDay: 17,
      color: '#0F172A',
      active: true,
      ...audit,
    };

    // Simulated 6x purchase bought on day 15 of 2026-12 -> closingDay 10 shifts 1st charge to 2027-01
    const sims: SimulatedPurchase[] = [
      {
        id: 's1',
        description: 'Geladeira',
        totalAmount: 3600,
        mode: 'parcelado',
        installmentsCount: 6,
        startMonthKey: '2026-12',
        endMonthKey: '',
        purchaseDay: 15,
        cardId: 'c1',
        enabled: true,
      },
      {
        id: 's2',
        description: 'Academia Fixa',
        totalAmount: 300,
        mode: 'fixo',
        installmentsCount: 1,
        startMonthKey: '2027-01',
        endMonthKey: '',
        purchaseDay: 5,
        cardId: '',
        enabled: true,
      },
    ];

    const horizon = computeSpendingHorizon({
      monthKeys: keys,
      incomes,
      transactions: [],
      installments: [],
      recurringItems: recurring,
      cards: [card],
      simulatedPurchases: sims,
    });

    assert.equal(horizon.rows[0].monthKey, '2026-12');
    assert.equal(horizon.rows[0].simulatedPurchaseImpact, 0);
    assert.equal(horizon.rows[1].monthKey, '2027-01');
    assert.equal(horizon.rows[1].simulatedPurchaseImpact, 900); // 600 parcela + 300 fixo
    assert.equal(horizon.rows[6].monthKey, '2027-06');
    assert.equal(horizon.rows[6].simulatedPurchaseImpact, 900);
    assert.equal(horizon.rows[7].monthKey, '2027-07');
    assert.equal(horizon.rows[7].simulatedPurchaseImpact, 300); // parcela terminou!
    assert.equal(horizon.summary.lastInstallmentMonth, '2027-06');
    // Equilíbrio ao infinito = 8000 - (2500 + 300) = 5200
    assert.equal(horizon.summary.perpetualMonthlySurplus, 5200);
  });

  it('computes Home account balances, realized vs pending flows, and daily safe spend', () => {
    const bankAccounts: BankAccount[] = [
      {
        id: 'ba1',
        name: 'Nubank Conta',
        institution: 'Nubank',
        type: 'Corrente',
        balance: 3200,
        currency: 'BRL',
        lastSyncedAt: '',
        active: true,
        ...audit,
      },
      {
        id: 'ba2',
        name: 'Reserva',
        institution: 'Inter',
        type: 'Poupança',
        balance: 1800,
        currency: 'BRL',
        lastSyncedAt: '',
        active: true,
        ...audit,
      },
      {
        id: 'ba-inactive',
        name: 'Encerrada',
        institution: 'Outro',
        type: 'Corrente',
        balance: 9999,
        currency: 'BRL',
        lastSyncedAt: '',
        active: false,
        ...audit,
      },
    ];

    const incomes: Income[] = [
      {
        id: 'inc1',
        person: 'Ana',
        source: 'Salário',
        amount: 6000,
        frequency: 'Mensal',
        receiptDay: 5,
        receiptDate: '',
        active: true,
        notes: '',
        ...audit,
      },
    ];

    const transactions: Transaction[] = [
      {
        id: 'tx-in-paid',
        type: 'Entrada',
        description: 'Freela recebido',
        plannedAmount: 1000,
        actualAmount: 1000,
        category: 'Outros',
        person: 'Ana',
        date: '2026-11-05',
        monthKey: '2026-11',
        paymentMethod: 'Pix',
        accountOrCard: 'Nubank Conta',
        cardId: '',
        status: 'Pago',
        dueDate: '',
        notes: '',
        ...audit,
      },
      {
        id: 'tx-out-paid',
        type: 'Saída',
        description: 'Mercado pago',
        plannedAmount: 1500,
        actualAmount: 1500,
        category: 'Mercado',
        person: 'Casal',
        date: '2026-11-10',
        monthKey: '2026-11',
        paymentMethod: 'Débito',
        accountOrCard: 'Nubank Conta',
        cardId: '',
        status: 'Pago',
        dueDate: '',
        notes: '',
        ...audit,
      },
      {
        id: 'tx-out-pending',
        type: 'Saída',
        description: 'Energia pendente',
        plannedAmount: 500,
        actualAmount: 500,
        category: 'Contas da casa',
        person: 'Casal',
        date: '2026-11-25',
        monthKey: '2026-11',
        paymentMethod: 'Boleto',
        accountOrCard: 'Nubank Conta',
        cardId: '',
        status: 'Pendente',
        dueDate: '2026-11-25',
        notes: '',
        ...audit,
      },
    ];

    // Nov/2026 has 30 days; today = 2026-11-21 -> 10 days remaining (21..30)
    const metrics = computeHomeRealizedAndDailyMetrics({
      monthKey: '2026-11',
      todayISO: '2026-11-21',
      bankAccounts,
      incomes,
      transactions,
      installments: [],
      recurringItems: [],
    });

    assert.equal(metrics.totalAccountsBalance, 5000);
    assert.equal(metrics.activeAccountsCount, 2);
    assert.equal(metrics.realizedEntries, 1000);
    assert.equal(metrics.expectedEntriesTotal, 7000); // 6000 income + 1000 tx
    assert.equal(metrics.pendingEntries, 6000);
    assert.equal(metrics.realizedExpenses, 1500);
    assert.equal(metrics.expectedExpensesTotal, 2000); // 1500 + 500
    assert.equal(metrics.pendingExpenses, 500);
    assert.equal(metrics.monthlySurplus, 5000);
    assert.equal(metrics.daysRemainingInMonth, 10);
    assert.equal(metrics.dailyBudgetSource, 'orcamento');
    assert.equal(metrics.dailySafeSpend, 500); // 5000 / 10 dias

    // Fallback to bank accounts balance minus pending expenses when no income/entries exist
    const balanceOnly = computeHomeRealizedAndDailyMetrics({
      monthKey: '2026-11',
      todayISO: '2026-11-21',
      bankAccounts,
      incomes: [],
      transactions: [transactions[2]], // 500 pending
      installments: [],
      recurringItems: [],
    });
    assert.equal(balanceOnly.dailyBudgetSource, 'saldo_contas');
    assert.equal(balanceOnly.dailyBudgetBase, 4500); // 5000 - 500
    assert.equal(balanceOnly.dailySafeSpend, 450);
  });

  it('computes Short Horizon for 7 dias, 1 mês (30 dias), and Trimestre (3 meses)', () => {
    const trimestreKeys = getMonthKeysFromStart('2026-12-01', 3);
    assert.deepEqual(trimestreKeys, ['2026-12', '2027-01', '2027-02']);

    const bankAccounts: BankAccount[] = [
      {
        id: 'ba1',
        name: 'Conta Principal',
        institution: 'Itaú',
        type: 'Corrente',
        balance: 2000,
        currency: 'BRL',
        lastSyncedAt: '',
        active: true,
        ...audit,
      },
    ];

    const incomes: Income[] = [
      {
        id: 'inc1',
        person: 'Ana',
        source: 'Salário',
        amount: 3000,
        frequency: 'Mensal',
        receiptDay: 5,
        receiptDate: '',
        active: true,
        notes: '',
        ...audit,
      },
    ];

    const card: CreditCard = {
      id: 'c1',
      name: 'Nubank',
      holder: 'Ana',
      limit: 5000,
      closingDay: 10,
      dueDay: 20,
      color: '#0F172A',
      active: true,
      ...audit,
    };

    const cardTx: Transaction = {
      id: 't-card',
      type: 'Saída',
      description: 'Supermercado',
      plannedAmount: 800,
      actualAmount: 800,
      category: 'Mercado',
      person: 'Casal',
      date: '2026-12-05',
      monthKey: '2026-12',
      paymentMethod: 'Crédito',
      accountOrCard: 'Nubank',
      cardId: 'c1',
      status: 'Pendente',
      dueDate: '',
      notes: '',
      ...audit,
    };

    const pendingPix: Transaction = {
      id: 't-pix',
      type: 'Saída',
      description: 'Internet',
      plannedAmount: 2500,
      actualAmount: 2500,
      category: 'Contas da casa',
      person: 'Casal',
      date: '2026-12-03',
      monthKey: '2026-12',
      paymentMethod: 'Pix',
      accountOrCard: 'Conta Principal',
      cardId: '',
      status: 'Pendente',
      dueDate: '2026-12-03',
      notes: '',
      ...audit,
    };

    const sevenDays = computeShortHorizon({
      daysCount: 7,
      startDateISO: '2026-12-01',
      bankAccounts,
      incomes,
      transactions: [cardTx, pendingPix],
      installments: [],
      recurringItems: [],
      cards: [card],
      simulatedPurchases: [],
    });

    assert.equal(sevenDays.rows.length, 7);
    assert.equal(sevenDays.startDateISO, '2026-12-01');
    assert.equal(sevenDays.endDateISO, '2026-12-07');
    assert.equal(sevenDays.summary.startBalance, 2000);
    // Day 2026-12-03: 2000 - 2500 = -500 (firstNegativeDay)
    assert.equal(sevenDays.summary.firstNegativeDay?.dateISO, '2026-12-03');
    assert.equal(sevenDays.summary.firstNegativeDay?.projectedBalance, -500);
    // Day 2026-12-05: -500 + 3000 = 2500
    assert.equal(sevenDays.summary.endBalance, 2500);

    const thirtyDays = computeShortHorizon({
      daysCount: 30,
      startDateISO: '2026-12-01',
      bankAccounts,
      incomes,
      transactions: [cardTx, pendingPix],
      installments: [],
      recurringItems: [],
      cards: [card],
      simulatedPurchases: [],
    });

    assert.equal(thirtyDays.rows.length, 30);
    // On 2026-12-20 (card dueDay = 20), invoice of 800 is subtracted: 2500 - 800 = 1700
    const dueRow = thirtyDays.rows.find((r) => r.dateISO === '2026-12-20');
    assert.ok(dueRow);
    assert.equal(dueRow.cardInvoicesTotal, 800);
    assert.equal(thirtyDays.summary.endBalance, 1700);
  });

  it('computes first charge date for credit installments respecting card closingDay', () => {
    // Before closingDay (day 5 < 10) -> stays in 2026-11
    assert.equal(computeFirstCreditInstallmentDate('2026-11-05', 10), '2026-11-05');
    // On or after closingDay (day 15 >= 10) -> shifts to 2026-12
    assert.equal(computeFirstCreditInstallmentDate('2026-11-15', 10), '2026-12-15');
    // Day 31 shifting into February clamps cleanly to Feb 28
    assert.equal(computeFirstCreditInstallmentDate('2027-01-31', 25), '2027-02-28');
    // Without card closingDay -> keeps same month
    assert.equal(computeFirstCreditInstallmentDate('2026-11-20', undefined), '2026-11-20');
  });

  it('supports up to 7 household members and computes contribution % and individual spending accurately', () => {
    const household: Household = {
      id: 'h1',
      name: 'Família Silva',
      ownerUid: 'u1',
      memberUids: ['u1', 'u2', 'u3', 'u4'],
      memberNames: {
        u1: 'Ana',
        u2: 'Bruno',
        u3: 'Carla',
        u4: 'Diego',
      },
      partner1Uid: 'u1',
      partner2Uid: 'u2',
      partner1Name: 'Ana',
      partner2Name: 'Bruno',
      periodStart: '2026-01-01',
      categories: ['Moradia'],
      paymentMethods: ['Pix'],
      rooms: ['Sala'],
      accounts: ['Conta corrente'],
      lastInviteCode: '',
    };

    const people = getHouseholdPeople(household);
    assert.deepEqual(people, ['Ana', 'Bruno', 'Carla', 'Diego', 'Grupo']);

    const incomes: Income[] = [
      {
        id: 'i1',
        person: 'Ana',
        source: 'Salário Ana',
        amount: 6000,
        frequency: 'Mensal',
        receiptDay: 5,
        receiptDate: '',
        active: true,
        notes: '',
        ...audit,
      },
      {
        id: 'i2',
        person: 'Bruno',
        source: 'Salário Bruno',
        amount: 3000,
        frequency: 'Mensal',
        receiptDay: 5,
        receiptDate: '',
        active: true,
        notes: '',
        ...audit,
      },
      {
        id: 'i3',
        person: 'Carla',
        source: 'Bolsa Carla',
        amount: 1000,
        frequency: 'Mensal',
        receiptDay: 10,
        receiptDate: '',
        active: true,
        notes: '',
        ...audit,
      },
    ];

    const transactions: Transaction[] = [
      {
        id: 't1',
        type: 'Saída',
        description: 'Mercado Ana',
        plannedAmount: 1200,
        actualAmount: 1200,
        category: 'Mercado',
        person: 'Ana',
        date: '2026-11-08',
        monthKey: '2026-11',
        paymentMethod: 'Pix',
        accountOrCard: 'Conta',
        cardId: '',
        status: 'Pago',
        dueDate: '',
        notes: '',
        ...audit,
      },
      {
        id: 't2',
        type: 'Saída',
        description: 'Curso Carla',
        plannedAmount: 1500,
        actualAmount: 1500,
        category: 'Educação',
        person: 'Carla',
        date: '2026-11-12',
        monthKey: '2026-11',
        paymentMethod: 'Pix',
        accountOrCard: 'Conta',
        cardId: '',
        status: 'Pago',
        dueDate: '',
        notes: '',
        ...audit,
      },
    ];

    const breakdown = computeMemberIncomeAndSpendingBreakdown({
      monthKey: '2026-11',
      household,
      incomes,
      transactions,
      installments: [],
      recurringItems: [],
    });

    assert.equal(breakdown.totalIncome, 10000);
    assert.equal(breakdown.totalSpending, 2700);
    assert.equal(breakdown.totalBalance, 7300);

    const ana = breakdown.rows.find((r) => r.person === 'Ana');
    const bruno = breakdown.rows.find((r) => r.person === 'Bruno');
    const carla = breakdown.rows.find((r) => r.person === 'Carla');
    const diego = breakdown.rows.find((r) => r.person === 'Diego');
    assert.ok(ana && bruno && carla && diego);
    assert.equal(ana.incomeSharePct, 0.6);
    assert.equal(ana.individualSpending, 1200);
    assert.equal(ana.individualBalance, 4800);
    assert.equal(bruno.incomeSharePct, 0.3);
    assert.equal(bruno.individualSpending, 0);
    assert.equal(carla.incomeSharePct, 0.1);
    assert.equal(carla.individualBalance, -500);
    assert.equal(diego.monthlyIncome, 0);
  });

  it('rolls up 28-day short horizon into 4 weekly buckets cleanly', () => {
    const shortRes = computeShortHorizon({
      daysCount: 28,
      startDateISO: '2026-12-01',
      bankAccounts: [],
      incomes: [],
      transactions: [],
      installments: [],
      recurringItems: [],
      cards: [],
      simulatedPurchases: [],
    });
    const weeks = computeWeeklyRollupFromShortHorizon(shortRes);
    assert.equal(weeks.length, 4);
    assert.equal(weeks[0].label, 'Sem 1');
    assert.equal(weeks[3].label, 'Sem 4');
  });

  it('computes simple and compound interest accurately for quick economic calculator', () => {
    const compound = computeQuickInterest({
      principal: 1000,
      ratePct: 10,
      rateUnit: 'mensal',
      months: 2,
      regime: 'composto',
    });
    assert.ok(Math.abs(compound.totalAmount - 1210) < 1e-6);
    assert.ok(Math.abs(compound.totalInterest - 210) < 1e-6);
    assert.ok(Math.abs(compound.increasePct - 21) < 1e-6);

    const simple = computeQuickInterest({
      principal: 1000,
      ratePct: 10,
      rateUnit: 'mensal',
      months: 2,
      regime: 'simples',
    });
    assert.ok(Math.abs(simple.totalAmount - 1200) < 1e-6);
    assert.ok(Math.abs(simple.totalInterest - 200) < 1e-6);

    const annualCompound = computeQuickInterest({
      principal: 2000,
      ratePct: 12,
      rateUnit: 'anual',
      months: 12,
      regime: 'composto',
    });
    assert.ok(Math.abs(annualCompound.totalAmount - 2240) < 1e-4);
  });

  it('builds month calendar data with semantic day tones, agenda groups, and next-month preview', () => {
    const incomes: Income[] = [
      {
        id: 'inc-cal',
        person: 'Ana',
        source: 'Salário',
        amount: 5000,
        frequency: 'Mensal',
        receiptDay: 5,
        receiptDate: '',
        active: true,
        notes: '',
        ...audit,
      },
    ];
    const cards: CreditCard[] = [
      {
        id: 'c-cal',
        name: 'Inter',
        holder: 'Ana',
        limit: 4000,
        closingDay: 10,
        dueDay: 18,
        color: '#0F172A',
        active: true,
        ...audit,
      },
    ];
    const txs: Transaction[] = [
      {
        id: 'tx-pending-exp',
        type: 'Saída',
        description: 'Luz',
        plannedAmount: 250,
        actualAmount: 250,
        category: 'Contas da casa',
        person: 'Casal',
        date: '2026-11-12',
        monthKey: '2026-11',
        paymentMethod: 'Boleto',
        accountOrCard: 'Conta',
        cardId: '',
        status: 'Pendente',
        dueDate: '2026-11-12',
        notes: '',
        ...audit,
      },
      {
        id: 'tx-card-exp',
        type: 'Saída',
        description: 'Supermercado',
        plannedAmount: 400,
        actualAmount: 400,
        category: 'Mercado',
        person: 'Casal',
        date: '2026-11-08',
        monthKey: '2026-11',
        paymentMethod: 'Crédito',
        accountOrCard: 'Inter',
        cardId: 'c-cal',
        status: 'Pago',
        dueDate: '',
        notes: '',
        ...audit,
      },
    ];

    const cal = computeMonthCalendarData({
      monthKey: '2026-11',
      transactions: txs,
      recurringItems: [],
      incomes,
      cards,
      installments: [],
    });

    assert.equal(cal.daysInMonth, 30);
    // 2026-11-01 is Sunday -> leadingEmptyDays = 0
    assert.equal(cal.leadingEmptyDays, 0);
    assert.equal(cal.daySummaries['2026-11-05']?.tone, 'positive');
    assert.equal(cal.daySummaries['2026-11-12']?.tone, 'negative');
    assert.equal(cal.daySummaries['2026-11-18']?.tone, 'warning');
    assert.equal(cal.daySummaries['2026-11-10']?.events[0]?.kind, 'card_close');
    assert.equal(cal.nextMonthPreview.monthKey, '2026-12');
    assert.equal(cal.nextMonthPreview.dayTones[5], 'positive');
  });

  it('formats device system date, time, and author name for Home balance consultation', () => {
    const sampleDate = new Date(2026, 10, 11, 9, 5, 0); // 11/11 09:05 local device time
    assert.equal(
      formatDeviceBalanceTimestamp(sampleDate, 'Vinicius'),
      'Última atualização 09:05 11/11 Vinicius'
    );
    assert.equal(
      formatDeviceBalanceTimestamp(sampleDate, ''),
      'Última atualização 09:05 11/11'
    );
  });
});



