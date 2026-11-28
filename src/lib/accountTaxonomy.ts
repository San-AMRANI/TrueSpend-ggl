import type { Wallet, WalletAccountSubtype } from '../types/index.js';

export type AccountingClass =
  | 'Liquid Asset'
  | 'Reserve Asset'
  | 'Growth Asset'
  | 'Credit Liability';

export type SafeToSpendRole =
  | 'liquid_spendable'
  | 'protected_reserve'
  | 'investment_capital'
  | 'credit_liability';

export interface AccountSubtypeMeta {
  subtype: WalletAccountSubtype;
  label: string;
  shortLabel: string;
  parentType: 'Bank' | 'Cash' | 'Savings' | 'Investment';
  accountingClass: AccountingClass;
  glPrefix: string;
  glCategory: string;
  safeToSpendRole: SafeToSpendRole;
  safeToSpendNote: string;
  description: string;
  chartColor: string;
  isLiability: boolean;
}

export const ACCOUNT_SUBTYPE_CATALOG: readonly AccountSubtypeMeta[] = [
  // ── 10xx Liquid Operating Assets ────────────────────────────────────────────
  {
    subtype: 'Checking',
    label: 'Checking / Everyday Bank',
    shortLabel: 'Checking',
    parentType: 'Bank',
    accountingClass: 'Liquid Asset',
    glPrefix: '1010',
    glCategory: 'Operating Bank',
    safeToSpendRole: 'liquid_spendable',
    safeToSpendNote: 'Included in Liquid Safe-to-Spend',
    description: 'Primary bank account for everyday spending, bills, and card payments.',
    chartColor: '#4f46e5',
    isLiability: false,
  },
  {
    subtype: 'PayrollHub',
    label: 'Salary & Payroll Hub',
    shortLabel: 'Payroll Hub',
    parentType: 'Bank',
    accountingClass: 'Liquid Asset',
    glPrefix: '1020',
    glCategory: 'Payroll Settlement',
    safeToSpendRole: 'liquid_spendable',
    safeToSpendNote: 'Included in Liquid Safe-to-Spend',
    description: 'Dedicated salary-receiving bank account that anchors payday cycles and closeouts.',
    chartColor: '#2563eb',
    isLiability: false,
  },
  {
    subtype: 'DigitalWallet',
    label: 'Digital / Prepaid / Multi-FX Wallet',
    shortLabel: 'Digital / FX',
    parentType: 'Bank',
    accountingClass: 'Liquid Asset',
    glPrefix: '1030',
    glCategory: 'E-Money & FX',
    safeToSpendRole: 'liquid_spendable',
    safeToSpendNote: 'Included in Liquid Safe-to-Spend',
    description: 'Online prepaid cards, Wise, Revolut, PayPal, CashPlus, or e-shopping sub-accounts.',
    chartColor: '#06b6d4',
    isLiability: false,
  },
  {
    subtype: 'Cash',
    label: 'Physical Cash & Pocket',
    shortLabel: 'Cash',
    parentType: 'Cash',
    accountingClass: 'Liquid Asset',
    glPrefix: '1040',
    glCategory: 'Cash on Hand',
    safeToSpendRole: 'liquid_spendable',
    safeToSpendNote: 'Included in Liquid Safe-to-Spend',
    description: 'Bills and coins carried on hand or kept in a home cash envelope.',
    chartColor: '#10b981',
    isLiability: false,
  },

  // ── 11xx Protected Reserve & Vault Assets ───────────────────────────────────
  {
    subtype: 'Savings',
    label: 'General Savings Account',
    shortLabel: 'Savings',
    parentType: 'Savings',
    accountingClass: 'Reserve Asset',
    glPrefix: '1110',
    glCategory: 'Savings Reserve',
    safeToSpendRole: 'protected_reserve',
    safeToSpendNote: 'Ring-fenced as Protected Buffer (excluded from daily burn)',
    description: 'Interest-bearing or ring-fenced savings account separated from daily spending.',
    chartColor: '#8b5cf6',
    isLiability: false,
  },
  {
    subtype: 'EmergencyVault',
    label: 'Emergency Buffer Vault',
    shortLabel: 'Emergency Vault',
    parentType: 'Savings',
    accountingClass: 'Reserve Asset',
    glPrefix: '1120',
    glCategory: 'Emergency Reserve',
    safeToSpendRole: 'protected_reserve',
    safeToSpendNote: 'Ring-fenced as Emergency Safety Buffer',
    description: 'Dedicated 3–6 month safety cushion strictly protected from discretionary spending.',
    chartColor: '#059669',
    isLiability: false,
  },
  {
    subtype: 'GoalVault',
    label: 'Goal & Sinking Fund Pocket',
    shortLabel: 'Goal Pocket',
    parentType: 'Savings',
    accountingClass: 'Reserve Asset',
    glPrefix: '1130',
    glCategory: 'Sinking Fund',
    safeToSpendRole: 'protected_reserve',
    safeToSpendNote: 'Ring-fenced for Goals & Planned Projects',
    description: 'Dedicated pocket for annual costs, travel, home setup, or big milestones.',
    chartColor: '#14b8a6',
    isLiability: false,
  },

  // ── 12xx Growth & Investment Capital ────────────────────────────────────────
  {
    subtype: 'Brokerage',
    label: 'Stocks & ETF Brokerage',
    shortLabel: 'Brokerage',
    parentType: 'Investment',
    accountingClass: 'Growth Asset',
    glPrefix: '1210',
    glCategory: 'Equities Brokerage',
    safeToSpendRole: 'investment_capital',
    safeToSpendNote: 'Protected Investment Capital (excluded from Safe-to-Spend)',
    description: 'Cash reserve & equities account (IBKR, BVC, Trading 212, etc.).',
    chartColor: '#f59e0b',
    isLiability: false,
  },
  {
    subtype: 'CryptoExchange',
    label: 'Crypto Exchange / Digital Assets',
    shortLabel: 'Crypto Exchange',
    parentType: 'Investment',
    accountingClass: 'Growth Asset',
    glPrefix: '1220',
    glCategory: 'Crypto & Stablecoins',
    safeToSpendRole: 'investment_capital',
    safeToSpendNote: 'Protected Investment Capital (excluded from Safe-to-Spend)',
    description: 'Binance Spot/Funding, hardware wallets, or stablecoin reserve accounts.',
    chartColor: '#eab308',
    isLiability: false,
  },
  {
    subtype: 'Retirement',
    label: 'Long-Term / Retirement Fund',
    shortLabel: 'Retirement',
    parentType: 'Investment',
    accountingClass: 'Growth Asset',
    glPrefix: '1230',
    glCategory: 'Long-Term Wealth',
    safeToSpendRole: 'investment_capital',
    safeToSpendNote: 'Locked Long-Term Wealth (excluded from Safe-to-Spend)',
    description: 'Long-horizon compounding funds, pension plans, or locked term deposits.',
    chartColor: '#0284c7',
    isLiability: false,
  },

  // ── 20xx Credit & Short-Term Liabilities ────────────────────────────────────
  {
    subtype: 'CreditCard',
    label: 'Credit Card (Revolving Liability)',
    shortLabel: 'Credit Card',
    parentType: 'Bank',
    accountingClass: 'Credit Liability',
    glPrefix: '2010',
    glCategory: 'Credit Card Payable',
    safeToSpendRole: 'credit_liability',
    safeToSpendNote: 'Liability account · Credit limit never counted as liquid cash',
    description: 'Tracks statement balance owed, credit limit utilization, and closing/due dates.',
    chartColor: '#e11d48',
    isLiability: true,
  },
  {
    subtype: 'Overdraft',
    label: 'Bank Overdraft Line',
    shortLabel: 'Overdraft',
    parentType: 'Bank',
    accountingClass: 'Credit Liability',
    glPrefix: '2020',
    glCategory: 'Overdraft Facility',
    safeToSpendRole: 'credit_liability',
    safeToSpendNote: 'Liability account · Drawn balance reduces net worth',
    description: 'Authorized bank overdraft facility tracked strictly as short-term liability.',
    chartColor: '#f97316',
    isLiability: true,
  },
  {
    subtype: 'BNPL',
    label: 'BNPL / Installment Credit Line',
    shortLabel: 'BNPL / Split',
    parentType: 'Bank',
    accountingClass: 'Credit Liability',
    glPrefix: '2030',
    glCategory: 'Installment Payable',
    safeToSpendRole: 'credit_liability',
    safeToSpendNote: 'Liability account · Tracks unpaid split-payment obligations',
    description: 'Buy-Now-Pay-Later or 0% installment credit cards tracked separately from cash.',
    chartColor: '#dc2626',
    isLiability: true,
  },
] as const;

export const ACCOUNTING_CLASS_ORDER: readonly AccountingClass[] = [
  'Liquid Asset',
  'Reserve Asset',
  'Growth Asset',
  'Credit Liability',
];

const SUBTYPE_MAP = new Map<string, AccountSubtypeMeta>(
  ACCOUNT_SUBTYPE_CATALOG.map((item) => [item.subtype, item])
);

export const VALID_ACCOUNT_SUBTYPES = new Set<string>(
  ACCOUNT_SUBTYPE_CATALOG.map((item) => item.subtype)
);

export const isCreditLiabilitySubtype = (subtype?: string | null): boolean =>
  subtype === 'CreditCard' || subtype === 'Overdraft' || subtype === 'BNPL';

export const getAccountSubtypeMeta = (
  subtype?: string | null,
  fallbackType?: 'Bank' | 'Cash' | 'Savings' | 'Investment' | string
): AccountSubtypeMeta => {
  if (subtype && SUBTYPE_MAP.has(subtype)) {
    return SUBTYPE_MAP.get(subtype)!;
  }
  if (fallbackType === 'Cash') return SUBTYPE_MAP.get('Cash')!;
  if (fallbackType === 'Savings') return SUBTYPE_MAP.get('Savings')!;
  if (fallbackType === 'Investment') return SUBTYPE_MAP.get('Brokerage')!;
  return SUBTYPE_MAP.get('Checking')!;
};

export const getGlCodeForWallet = (wallet: {
  name?: string | null;
  type?: string | null;
  accountSubtype?: string | null;
}): { code: string; accountClass: 'Asset' | 'Liability'; glPrefix: string } => {
  const meta = getAccountSubtypeMeta(wallet.accountSubtype, wallet.type || 'Bank');
  const cleanName = (wallet.name || meta.shortLabel)
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 10) || 'ACCT';
  return {
    code: `${meta.glPrefix}-${meta.isLiability ? 'LIAB' : 'ASSET'}-${cleanName}`,
    accountClass: meta.isLiability ? 'Liability' : 'Asset',
    glPrefix: meta.glPrefix,
  };
};

export const SUBTYPES_BY_CLASS: Record<AccountingClass, AccountSubtypeMeta[]> = {
  'Liquid Asset': ACCOUNT_SUBTYPE_CATALOG.filter((s) => s.accountingClass === 'Liquid Asset'),
  'Reserve Asset': ACCOUNT_SUBTYPE_CATALOG.filter((s) => s.accountingClass === 'Reserve Asset'),
  'Growth Asset': ACCOUNT_SUBTYPE_CATALOG.filter((s) => s.accountingClass === 'Growth Asset'),
  'Credit Liability': ACCOUNT_SUBTYPE_CATALOG.filter((s) => s.accountingClass === 'Credit Liability'),
};

export interface BalanceSheetSummary {
  liquidAssetsMad: number;
  reserveAssetsMad: number;
  growthAssetsMad: number;
  receivablesMad: number;
  totalAssetsMad: number;
  creditLiabilitiesMad: number;
  debtPayablesMad: number;
  totalLiabilitiesMad: number;
  netEquityMad: number;
  liquidSharePct: number;
  reserveSharePct: number;
  growthSharePct: number;
  debtToAssetPct: number;
  accountsByClass: Record<AccountingClass, Wallet[]>;
}

export function computeBalanceSheetSummary(
  wallets: Wallet[],
  options?: {
    stockPortfolioMad?: number;
    activeReceivablesMad?: number;
    activePayablesMad?: number;
  }
): BalanceSheetSummary {
  const accountsByClass: Record<AccountingClass, Wallet[]> = {
    'Liquid Asset': [],
    'Reserve Asset': [],
    'Growth Asset': [],
    'Credit Liability': [],
  };

  let liquidAssetsMad = 0;
  let reserveAssetsMad = 0;
  let growthWalletCashMad = 0;
  let creditLiabilitiesMad = 0;

  for (const w of wallets) {
    const meta = getAccountSubtypeMeta(w.accountSubtype, w.type);
    accountsByClass[meta.accountingClass].push(w);
    const bal = Number(w.balance ?? 0) || 0;

    if (meta.isLiability) {
      const explicitLiab = Number(w.liabilityBalance ?? 0) || 0;
      creditLiabilitiesMad += bal < 0 ? Math.abs(bal) : Math.max(0, explicitLiab);
    } else if (meta.accountingClass === 'Liquid Asset') {
      liquidAssetsMad += bal;
    } else if (meta.accountingClass === 'Reserve Asset') {
      reserveAssetsMad += bal;
    } else if (meta.accountingClass === 'Growth Asset') {
      growthWalletCashMad += bal;
    }
  }

  const stockPortfolioMad = Math.max(0, options?.stockPortfolioMad ?? 0);
  const growthAssetsMad = stockPortfolioMad > 0 ? Math.max(growthWalletCashMad, stockPortfolioMad) : growthWalletCashMad;
  const receivablesMad = Math.max(0, options?.activeReceivablesMad ?? 0);
  const debtPayablesMad = Math.max(0, options?.activePayablesMad ?? 0);

  const totalAssetsMad = Math.max(0, liquidAssetsMad) + Math.max(0, reserveAssetsMad) + Math.max(0, growthAssetsMad) + receivablesMad;
  const totalLiabilitiesMad = creditLiabilitiesMad + debtPayablesMad;
  const netEquityMad = liquidAssetsMad + reserveAssetsMad + growthAssetsMad + receivablesMad - totalLiabilitiesMad;

  const positiveAssetBase = Math.max(1, Math.max(0, liquidAssetsMad) + Math.max(0, reserveAssetsMad) + Math.max(0, growthAssetsMad));

  return {
    liquidAssetsMad,
    reserveAssetsMad,
    growthAssetsMad,
    receivablesMad,
    totalAssetsMad,
    creditLiabilitiesMad,
    debtPayablesMad,
    totalLiabilitiesMad,
    netEquityMad,
    liquidSharePct: (Math.max(0, liquidAssetsMad) / positiveAssetBase) * 100,
    reserveSharePct: (Math.max(0, reserveAssetsMad) / positiveAssetBase) * 100,
    growthSharePct: (Math.max(0, growthAssetsMad) / positiveAssetBase) * 100,
    debtToAssetPct: totalAssetsMad > 0 ? (totalLiabilitiesMad / totalAssetsMad) * 100 : 0,
    accountsByClass,
  };
}
