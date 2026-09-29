import { Debt, KPI } from '../types';

// ==========================================
// 1. PURCHASE AFFORDABILITY & TCO CALCULATOR
// ==========================================
export interface AffordabilityInput {
  itemPrice: number;
  paymentMethod: 'cash' | 'installment';
  downPayment: number;
  monthlyPayment: number;
  installmentMonths: number;
  monthlyOngoingCosts: number; // maintenance, insurance, subscriptions, etc.
  yearsOfOwnership: number;
}

export interface AffordabilityResult {
  totalInitialOutlay: number;
  totalPurchaseCost: number;
  totalOngoingCost: number;
  trueCostOfOwnership: number;
  monthlyBurden: number;
  safeToSpendImpact: {
    currentSafeToSpend: number;
    newSafeToSpend: number;
    isSafe: boolean;
  };
  emergencyMoatPreserved: boolean;
  lifeHoursDemanded: number;
  verdict: 'Excellent & Safe' | 'Manageable with Caution' | 'High Financial Strain' | 'Critical Risk';
  verdictColor: string;
  advice: string[];
}

export function calculateAffordability(
  input: AffordabilityInput,
  kpis: KPI | null,
  realHourlyWage: number
): AffordabilityResult {
  const {
    itemPrice,
    paymentMethod,
    downPayment,
    monthlyPayment,
    installmentMonths,
    monthlyOngoingCosts,
    yearsOfOwnership,
  } = input;

  const totalOngoingCost = monthlyOngoingCosts * 12 * yearsOfOwnership;
  let totalPurchaseCost = itemPrice;
  let totalInitialOutlay = itemPrice;
  let monthlyBurden = monthlyOngoingCosts;

  if (paymentMethod === 'installment') {
    totalPurchaseCost = downPayment + monthlyPayment * installmentMonths;
    totalInitialOutlay = downPayment;
    monthlyBurden = monthlyPayment + monthlyOngoingCosts;
  }

  const trueCostOfOwnership = totalPurchaseCost + totalOngoingCost;

  const currentSafeToSpend = kpis?.safeToSpend || 0;
  const newSafeToSpend = currentSafeToSpend - totalInitialOutlay;
  const isSafe = newSafeToSpend >= 0;

  const totalLiquidity = kpis?.totalLiquidity || 0;
  const emergencyBuffer = kpis?.emergencyBuffer || 10000;
  const postPurchaseLiquidity = totalLiquidity - totalInitialOutlay;
  const emergencyMoatPreserved = postPurchaseLiquidity >= emergencyBuffer;

  const safeWage = Math.max(1, realHourlyWage);
  const lifeHoursDemanded = parseFloat((trueCostOfOwnership / safeWage).toFixed(1));

  let verdict: AffordabilityResult['verdict'] = 'Manageable with Caution';
  let verdictColor = 'text-indigo-500';
  const advice: string[] = [];

  if (newSafeToSpend > 2000 && emergencyMoatPreserved) {
    verdict = 'Excellent & Safe';
    verdictColor = 'text-emerald-500';
    advice.push('Your safe-to-spend and emergency buffer remain solidly intact.');
    advice.push(`Total cost over ${yearsOfOwnership} years is ${Math.round(trueCostOfOwnership).toLocaleString()} MAD.`);
  } else if (newSafeToSpend >= 0 && emergencyMoatPreserved) {
    verdict = 'Manageable with Caution';
    verdictColor = 'text-blue-500';
    advice.push('Affordable within current liquidity, but reduces your monthly buffer.');
    if (monthlyBurden > 0) {
      advice.push(`Ongoing monthly drain will be ${Math.round(monthlyBurden).toLocaleString()} MAD/mo.`);
    }
  } else if (!emergencyMoatPreserved && postPurchaseLiquidity > 0) {
    verdict = 'High Financial Strain';
    verdictColor = 'text-amber-500';
    advice.push('Warning: This purchase eats into your non-negotiable emergency buffer.');
    advice.push('Consider saving up a sinking fund or delaying 30–60 days.');
  } else {
    verdict = 'Critical Risk';
    verdictColor = 'text-rose-500';
    advice.push('Danger: Exceeds your available liquid reserves. Causes immediate financial deficit.');
    advice.push('Strongly advise declining or downscaling this purchase.');
  }

  return {
    totalInitialOutlay: Math.round(totalInitialOutlay),
    totalPurchaseCost: Math.round(totalPurchaseCost),
    totalOngoingCost: Math.round(totalOngoingCost),
    trueCostOfOwnership: Math.round(trueCostOfOwnership),
    monthlyBurden: Math.round(monthlyBurden),
    safeToSpendImpact: {
      currentSafeToSpend: Math.round(currentSafeToSpend),
      newSafeToSpend: Math.round(newSafeToSpend),
      isSafe,
    },
    emergencyMoatPreserved,
    lifeHoursDemanded,
    verdict,
    verdictColor,
    advice,
  };
}

// ==========================================
// 2. LOAN & DEBT AMORTIZATION CALCULATOR
// ==========================================
export interface AmortizationScheduleItem {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  remainingBalance: number;
}

export interface LoanCalculationResult {
  principal: number;
  annualInterestRate: number;
  termMonths: number;
  baseMonthlyPayment: number;
  acceleratedMonthlyPayment: number;
  totalInterestStandard: number;
  totalInterestAccelerated: number;
  interestSaved: number;
  monthsSaved: number;
  payoffMonthsAccelerated: number;
  schedule: AmortizationScheduleItem[];
}

export function calculateLoanAmortization(
  principal: number,
  annualInterestRate: number,
  termMonths: number,
  extraMonthlyPayment = 0
): LoanCalculationResult {
  if (principal <= 0 || termMonths <= 0) {
    return {
      principal: 0,
      annualInterestRate,
      termMonths,
      baseMonthlyPayment: 0,
      acceleratedMonthlyPayment: 0,
      totalInterestStandard: 0,
      totalInterestAccelerated: 0,
      interestSaved: 0,
      monthsSaved: 0,
      payoffMonthsAccelerated: termMonths,
      schedule: [],
    };
  }

  const monthlyRate = annualInterestRate > 0 ? annualInterestRate / 100 / 12 : 0;

  // Base payment formula
  let baseMonthlyPayment = 0;
  if (monthlyRate === 0) {
    baseMonthlyPayment = principal / termMonths;
  } else {
    baseMonthlyPayment =
      (principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths))) /
      (Math.pow(1 + monthlyRate, termMonths) - 1);
  }

  const acceleratedMonthlyPayment = baseMonthlyPayment + extraMonthlyPayment;

  // Compute standard schedule
  let balanceStandard = principal;
  let totalInterestStandard = 0;
  for (let m = 1; m <= termMonths; m++) {
    const interest = balanceStandard * monthlyRate;
    const principalPaid = Math.min(balanceStandard, baseMonthlyPayment - interest);
    totalInterestStandard += interest;
    balanceStandard -= principalPaid;
    if (balanceStandard <= 0) break;
  }

  // Compute accelerated schedule
  let balanceAccelerated = principal;
  let totalInterestAccelerated = 0;
  let payoffMonthsAccelerated = 0;
  const schedule: AmortizationScheduleItem[] = [];

  for (let m = 1; m <= termMonths; m++) {
    if (balanceAccelerated <= 0.01) break;
    const interest = balanceAccelerated * monthlyRate;
    const principalPaid = Math.min(balanceAccelerated, acceleratedMonthlyPayment - interest);
    const payment = principalPaid + interest;

    totalInterestAccelerated += interest;
    balanceAccelerated = Math.max(0, balanceAccelerated - principalPaid);
    payoffMonthsAccelerated = m;

    if (m <= 36 || m % 12 === 0 || balanceAccelerated === 0) {
      schedule.push({
        month: m,
        payment: Math.round(payment),
        principal: Math.round(principalPaid),
        interest: Math.round(interest),
        remainingBalance: Math.round(balanceAccelerated),
      });
    }
  }

  const interestSaved = Math.max(0, Math.round(totalInterestStandard - totalInterestAccelerated));
  const monthsSaved = Math.max(0, termMonths - payoffMonthsAccelerated);

  return {
    principal: Math.round(principal),
    annualInterestRate,
    termMonths,
    baseMonthlyPayment: Math.round(baseMonthlyPayment),
    acceleratedMonthlyPayment: Math.round(acceleratedMonthlyPayment),
    totalInterestStandard: Math.round(totalInterestStandard),
    totalInterestAccelerated: Math.round(totalInterestAccelerated),
    interestSaved,
    monthsSaved,
    payoffMonthsAccelerated,
    schedule,
  };
}

// ==========================================
// 3. MOROCCAN & UNIVERSAL SALARY & WATERFALL
// ==========================================
export interface SalaryTaxResult {
  grossMonthlySalary: number;
  cnssContribution: number; // 4.48% (cap at 6000 = max 268.8)
  amoContribution: number;  // 2.26%
  professionalDeduction: number; // 20% or 35%
  taxableNetIncome: number;
  incomeTaxIR: number;
  netMonthlySalary: number;
  effectiveTaxRatePercent: number;
  waterfallBuckets: {
    essentials50: number;
    compounding20: number;
    goals20: number;
    guiltFree10: number;
  };
}

export function calculateMoroccanSalaryTax(grossMonthlySalary: number): SalaryTaxResult {
  const gross = Math.max(0, grossMonthlySalary);

  // 1. CNSS (4.48%, capped at base of 6,000 MAD)
  const cnssBase = Math.min(6000, gross);
  const cnssContribution = parseFloat((cnssBase * 0.0448).toFixed(2));

  // 2. AMO (2.26% uncapped)
  const amoContribution = parseFloat((gross * 0.0226).toFixed(2));

  // 3. Professional expenses deduction (35% up to 35,000 MAD/year = ~2,916.67 MAD/mo)
  const grossTaxableBase = Math.max(0, gross - cnssContribution - amoContribution);
  const rawProfDeduction = grossTaxableBase * 0.35;
  const professionalDeduction = Math.min(2916.67, rawProfDeduction);

  // 4. Net Taxable Income
  const taxableNetIncome = Math.max(0, grossTaxableBase - professionalDeduction);

  // 5. Moroccan Progressive IR Brackets (Monthly)
  // 0 to 2,500 MAD: 0%
  // 2,501 to 4,166.67 MAD: 10% (deduction 250)
  // 4,166.68 to 5,000 MAD: 20% (deduction 666.67)
  // 5,000.01 to 6,666.67 MAD: 30% (deduction 1,166.67)
  // 6,666.68 to 15,000 MAD: 34% (deduction 1,433.33)
  // > 15,000 MAD: 38% (deduction 2,033.33)
  let incomeTaxIR = 0;
  if (taxableNetIncome <= 2500) {
    incomeTaxIR = 0;
  } else if (taxableNetIncome <= 4166.67) {
    incomeTaxIR = taxableNetIncome * 0.10 - 250;
  } else if (taxableNetIncome <= 5000) {
    incomeTaxIR = taxableNetIncome * 0.20 - 666.67;
  } else if (taxableNetIncome <= 6666.67) {
    incomeTaxIR = taxableNetIncome * 0.30 - 1166.67;
  } else if (taxableNetIncome <= 15000) {
    incomeTaxIR = taxableNetIncome * 0.34 - 1433.33;
  } else {
    incomeTaxIR = taxableNetIncome * 0.38 - 2033.33;
  }
  incomeTaxIR = Math.max(0, parseFloat(incomeTaxIR.toFixed(2)));

  const netMonthlySalary = Math.max(0, gross - cnssContribution - amoContribution - incomeTaxIR);
  const effectiveTaxRatePercent = gross > 0 ? parseFloat(((gross - netMonthlySalary) / gross * 100).toFixed(1)) : 0;

  // 4-Bucket Waterfall Distribution
  const essentials50 = Math.round(netMonthlySalary * 0.50);
  const compounding20 = Math.round(netMonthlySalary * 0.20);
  const goals20 = Math.round(netMonthlySalary * 0.20);
  const guiltFree10 = Math.round(netMonthlySalary * 0.10);

  return {
    grossMonthlySalary: Math.round(gross),
    cnssContribution: Math.round(cnssContribution),
    amoContribution: Math.round(amoContribution),
    professionalDeduction: Math.round(professionalDeduction),
    taxableNetIncome: Math.round(taxableNetIncome),
    incomeTaxIR: Math.round(incomeTaxIR),
    netMonthlySalary: Math.round(netMonthlySalary),
    effectiveTaxRatePercent,
    waterfallBuckets: {
      essentials50,
      compounding20,
      goals20,
      guiltFree10,
    },
  };
}

// ==========================================
// 4. INFLATION & PURCHASING POWER CALCULATOR
// ==========================================
export interface InflationDecayResult {
  initialAmount: number;
  inflationRatePercent: number;
  years: number;
  purchasingPowerRemaining: number;
  purchasingPowerLostPercent: number;
  nominalNeededToMatch: number;
  trajectory: {
    year: number;
    realValue: number;
    purchasingPowerLostPercent: number;
  }[];
}

export function calculateInflationDecay(
  initialAmount: number,
  inflationRatePercent: number,
  years = 10
): InflationDecayResult {
  const i = inflationRatePercent / 100;
  const trajectory: InflationDecayResult['trajectory'] = [];

  for (let y = 1; y <= years; y++) {
    const realValue = initialAmount / Math.pow(1 + i, y);
    const lostPercent = ((initialAmount - realValue) / initialAmount) * 100;
    trajectory.push({
      year: y,
      realValue: Math.round(realValue),
      purchasingPowerLostPercent: parseFloat(lostPercent.toFixed(1)),
    });
  }

  const purchasingPowerRemaining = Math.round(initialAmount / Math.pow(1 + i, years));
  const lostPercent = ((initialAmount - purchasingPowerRemaining) / initialAmount) * 100;
  const nominalNeededToMatch = Math.round(initialAmount * Math.pow(1 + i, years));

  return {
    initialAmount: Math.round(initialAmount),
    inflationRatePercent,
    years,
    purchasingPowerRemaining,
    purchasingPowerLostPercent: parseFloat(lostPercent.toFixed(1)),
    nominalNeededToMatch,
    trajectory,
  };
}

// ==========================================
// 5. FAIR-SHARE BILL SPLITTER & TIP
// ==========================================
export interface BillSplitResult {
  subtotal: number;
  tipPercent: number;
  tipAmount: number;
  totalWithTip: number;
  numberOfPeople: number;
  amountPerPerson: number;
}

export function calculateBillSplit(
  subtotal: number,
  tipPercent = 10,
  numberOfPeople = 2
): BillSplitResult {
  const safePeople = Math.max(1, numberOfPeople);
  const tipAmount = (subtotal * tipPercent) / 100;
  const totalWithTip = subtotal + tipAmount;
  const amountPerPerson = totalWithTip / safePeople;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tipPercent,
    tipAmount: Math.round(tipAmount * 100) / 100,
    totalWithTip: Math.round(totalWithTip * 100) / 100,
    numberOfPeople: safePeople,
    amountPerPerson: Math.round(amountPerPerson * 100) / 100,
  };
}
