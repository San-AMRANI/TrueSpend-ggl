import { subscriptionRepository, CreateSubscriptionParams } from '../repositories/SubscriptionRepository.js';
import { transactionService } from './TransactionService.js';
import { walletRepository } from '../repositories/WalletRepository.js';
import { transactionRepository } from '../repositories/TransactionRepository.js';

export interface CreateSubscriptionDTO {
  name: string;
  amount: number;
  currency?: string;
  billingCycle?: string;
  category?: string;
  walletId?: string | null;
  nextBillingDate?: string | null;
  status?: 'active' | 'planned' | 'paused' | 'reviewing' | 'cancelled';
  notes?: string;
  icon?: string;
  websiteUrl?: string;
  recordInitialPayment?: boolean;
  initialPaymentDate?: string;
}

export interface UpdateSubscriptionDTO {
  name?: string;
  amount?: number;
  currency?: string;
  billingCycle?: string;
  category?: string;
  walletId?: string | null;
  nextBillingDate?: string | null;
  status?: 'active' | 'planned' | 'paused' | 'reviewing' | 'cancelled';
  notes?: string;
  icon?: string;
  websiteUrl?: string;
}

export interface ChangeSubscriptionPlanDTO {
  newName?: string;
  newAmount: number;
  newCurrency?: string;
  newBillingCycle: string;
  effectiveDate?: string;
  nextBillingDate?: string | null;
  recalculateNextDate?: boolean;
  walletId?: string | null;
  paymentMode?: 'none' | 'difference' | 'full';
  paymentAmount?: number;
  status?: 'active' | 'planned' | 'paused' | 'reviewing' | 'cancelled';
  notes?: string;
}

function getCycleMonths(cycleRaw?: string | null): number {
  const raw = (cycleRaw || 'monthly').trim().toLowerCase();
  if (raw === 'weekly') return 12 / 52;
  if (raw === 'biweekly') return 24 / 52;
  if (raw === 'yearly') return 12;
  if (raw === 'quarterly' || raw === 'every_3_months') return 3;
  if (raw === 'every_2_months') return 2;
  if (raw === 'every_6_months') return 6;
  if (raw === 'every_10_months') return 10;

  const customMonthsMatch = raw.match(/^every_(\d+)_months?$/);
  if (customMonthsMatch) return Math.max(1, parseInt(customMonthsMatch[1], 10));

  const customDaysMatch = raw.match(/^every_(\d+)_days?$/);
  if (customDaysMatch) return Math.max(1, parseInt(customDaysMatch[1], 10)) / 30.4375;

  return 1;
}

function getNormalizedMonthlyCost(amount: number, cycleRaw?: string | null): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const months = getCycleMonths(cycleRaw);
  return months > 0 ? amount / months : amount;
}

function advanceDateByCycle(baseDate: Date, cycleRaw?: string | null): Date {
  const result = new Date(baseDate.getTime());
  const raw = (cycleRaw || 'monthly').trim().toLowerCase();

  if (raw === 'weekly') {
    result.setDate(result.getDate() + 7);
    return result;
  }
  if (raw === 'biweekly') {
    result.setDate(result.getDate() + 14);
    return result;
  }
  if (raw === 'yearly') {
    result.setFullYear(result.getFullYear() + 1);
    return result;
  }
  if (raw === 'quarterly' || raw === 'every_3_months') {
    result.setMonth(result.getMonth() + 3);
    return result;
  }
  if (raw === 'every_2_months') {
    result.setMonth(result.getMonth() + 2);
    return result;
  }
  if (raw === 'every_6_months') {
    result.setMonth(result.getMonth() + 6);
    return result;
  }
  if (raw === 'every_10_months') {
    result.setMonth(result.getMonth() + 10);
    return result;
  }

  const customMonthsMatch = raw.match(/^every_(\d+)_months?$/);
  if (customMonthsMatch) {
    const n = Math.max(1, parseInt(customMonthsMatch[1], 10));
    result.setMonth(result.getMonth() + n);
    return result;
  }

  const customDaysMatch = raw.match(/^every_(\d+)_days?$/);
  if (customDaysMatch) {
    const d = Math.max(1, parseInt(customDaysMatch[1], 10));
    result.setDate(result.getDate() + d);
    return result;
  }

  result.setMonth(result.getMonth() + 1);
  return result;
}

export class SubscriptionService {
  async getSubscriptionsForUser(userId: string) {
    const subs = await subscriptionRepository.findAllByUserId(userId);
    const wallets = await walletRepository.findAllByUserId(userId);
    const walletMap = new Map<string, string>();
    wallets.forEach((w) => walletMap.set(w.id, w.name));

    return subs.map((s) => ({
      ...s,
      walletName: s.walletId ? walletMap.get(s.walletId) || null : null,
    }));
  }

  async getSubscriptionById(id: string, userId: string) {
    const sub = await subscriptionRepository.findByIdAndUserId(id, userId);
    if (!sub) throw new Error('Subscription not found');
    return sub;
  }

  async createSubscription(userId: string, dto: CreateSubscriptionDTO) {
    const name = dto.name?.trim();
    if (!name) throw new Error('Subscription name is required');
    const amountNum = Number(dto.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      throw new Error('Subscription amount must be greater than zero');
    }

    let walletId = dto.walletId?.trim() || null;
    if (walletId) {
      const wallet = await walletRepository.findById(walletId, userId);
      if (!wallet) walletId = null;
    }

    const nextBillingDate = dto.nextBillingDate ? new Date(dto.nextBillingDate) : null;

    const createdSub = await subscriptionRepository.create({
      userId,
      name,
      amount: amountNum.toFixed(2),
      currency: dto.currency || 'MAD',
      billingCycle: dto.billingCycle || 'monthly',
      category: dto.category?.trim() || 'Subscriptions & Streaming',
      walletId,
      nextBillingDate,
      status: dto.status || 'active',
      notes: dto.notes?.trim() || '',
      icon: dto.icon || '📱',
      websiteUrl: dto.websiteUrl?.trim() || '',
    });

    if (dto.recordInitialPayment) {
      let targetWalletId = walletId;
      if (!targetWalletId) {
        const wallets = await walletRepository.findAllByUserId(userId);
        const mainWallet =
          wallets.find((w) => w.type === 'Bank' && w.isMain) ||
          wallets.find((w) => w.type === 'Bank') ||
          wallets[0];
        if (mainWallet) targetWalletId = mainWallet.id;
      }
      if (targetWalletId) {
        const payDateStr = (dto.initialPaymentDate ? new Date(dto.initialPaymentDate) : new Date())
          .toISOString()
          .slice(0, 10);
        await transactionService.createTransaction(userId, {
          amount: amountNum,
          type: 'Expense',
          category: dto.category?.trim() || 'Subscriptions & Streaming',
          notes: `Subscription: ${name}`,
          walletId: targetWalletId,
          transaction_date: payDateStr,
        });
      }
    }

    return createdSub;
  }

  async updateSubscription(userId: string, id: string, dto: UpdateSubscriptionDTO) {
    await this.getSubscriptionById(id, userId);

    const updateData: Partial<CreateSubscriptionParams> = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new Error('Subscription name cannot be empty');
      updateData.name = name;
    }

    if (dto.amount !== undefined) {
      const amountNum = Number(dto.amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        throw new Error('Subscription amount must be greater than zero');
      }
      updateData.amount = amountNum.toFixed(2);
    }

    if (dto.currency !== undefined) updateData.currency = dto.currency;
    if (dto.billingCycle !== undefined) updateData.billingCycle = dto.billingCycle;
    if (dto.category !== undefined) updateData.category = dto.category.trim();
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.icon !== undefined) updateData.icon = dto.icon;
    if (dto.websiteUrl !== undefined) updateData.websiteUrl = dto.websiteUrl;

    if (dto.walletId !== undefined) {
      const walletId = dto.walletId?.trim() || null;
      if (walletId) {
        const wallet = await walletRepository.findById(walletId, userId);
        updateData.walletId = wallet ? walletId : null;
      } else {
        updateData.walletId = null;
      }
    }

    if (dto.nextBillingDate !== undefined) {
      updateData.nextBillingDate = dto.nextBillingDate ? new Date(dto.nextBillingDate) : null;
    }

    return await subscriptionRepository.update(id, userId, updateData);
  }

  async deleteSubscription(userId: string, id: string) {
    await this.getSubscriptionById(id, userId);
    await subscriptionRepository.deleteByIdAndUserId(id, userId);
    return { success: true };
  }

  async logSubscriptionPayment(userId: string, id: string, overrideWalletId?: string, paymentDate?: string) {
    const sub = await this.getSubscriptionById(id, userId);
    const amountNum = parseFloat(sub.amount as string) || 0;

    // Determine target wallet
    let walletId = overrideWalletId || sub.walletId;
    if (!walletId) {
      const wallets = await walletRepository.findAllByUserId(userId);
      const mainWallet = wallets.find((w) => w.type === 'Bank' && w.isMain) || wallets.find((w) => w.type === 'Bank') || wallets[0];
      if (!mainWallet) throw new Error('No wallet available to record subscription payment');
      walletId = mainWallet.id;
    }

    // 1. Record the transaction
    const dateToUse = (paymentDate ? new Date(paymentDate) : new Date()).toISOString().slice(0, 10);
    const createdTx = await transactionService.createTransaction(userId, {
      amount: amountNum,
      type: 'Expense',
      category: sub.category || 'Subscriptions & Streaming',
      notes: `Subscription: ${sub.name}`,
      walletId,
      transaction_date: dateToUse,
    });

    // 2. Roll next billing date forward by 1 cycle (or from paymentDate if planned/overdue)
    let baseDate = sub.nextBillingDate ? new Date(sub.nextBillingDate) : new Date(dateToUse);
    if (isNaN(baseDate.getTime()) || sub.status === 'planned') {
      baseDate = new Date(dateToUse);
    }

    const rolledDate = advanceDateByCycle(baseDate, sub.billingCycle);

    const updatedSub = await subscriptionRepository.update(id, userId, {
      nextBillingDate: rolledDate,
      status: sub.status === 'planned' ? 'active' : sub.status,
    });

    return {
      subscription: updatedSub,
      transaction: createdTx,
    };
  }

  async changeSubscriptionPlan(userId: string, id: string, dto: ChangeSubscriptionPlanDTO) {
    const sub = await this.getSubscriptionById(id, userId);

    const newAmountNum = Number(dto.newAmount);
    if (!Number.isFinite(newAmountNum) || newAmountNum <= 0) {
      throw new Error('New plan amount must be greater than zero');
    }

    const oldAmountNum = parseFloat(sub.amount as string) || 0;
    const oldCycle = sub.billingCycle || 'monthly';
    const newCycle = (dto.newBillingCycle || oldCycle).trim().toLowerCase();
    const oldName = sub.name;
    const finalName = dto.newName?.trim() ? dto.newName.trim() : oldName;
    const finalCurrency = dto.newCurrency?.trim() || sub.currency || 'MAD';

    const oldMonthly = getNormalizedMonthlyCost(oldAmountNum, oldCycle);
    const newMonthly = getNormalizedMonthlyCost(newAmountNum, newCycle);
    const oldMonths = getCycleMonths(oldCycle);
    const newMonths = getCycleMonths(newCycle);

    let direction: 'upgrade' | 'downgrade' | 'switch' = 'switch';
    if (newAmountNum > oldAmountNum && newMonths >= oldMonths) {
      direction = 'upgrade';
    } else if (newAmountNum < oldAmountNum && newMonths <= oldMonths) {
      direction = 'downgrade';
    } else if (Math.abs(newMonthly - oldMonthly) >= 0.01) {
      direction = newMonthly > oldMonthly ? 'upgrade' : 'downgrade';
    } else if (Math.abs(newAmountNum - oldAmountNum) >= 0.01) {
      direction = newAmountNum > oldAmountNum ? 'upgrade' : 'downgrade';
    }

    let walletId = dto.walletId !== undefined ? dto.walletId?.trim() || null : sub.walletId || null;
    if (walletId) {
      const wallet = await walletRepository.findById(walletId, userId);
      if (!wallet) walletId = null;
    }

    const effectiveDateObj = dto.effectiveDate ? new Date(dto.effectiveDate) : new Date();
    const effectiveIso = !isNaN(effectiveDateObj.getTime())
      ? effectiveDateObj.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    let nextBillingDateValue: Date | null = sub.nextBillingDate ? new Date(sub.nextBillingDate) : null;
    if (dto.nextBillingDate !== undefined) {
      nextBillingDateValue = dto.nextBillingDate ? new Date(dto.nextBillingDate) : null;
    } else if (dto.recalculateNextDate !== false) {
      nextBillingDateValue = advanceDateByCycle(new Date(`${effectiveIso}T00:00:00`), newCycle);
    }

    const paymentMode = dto.paymentMode || 'none';
    let chargedAmount = 0;
    if (paymentMode === 'full') {
      chargedAmount =
        dto.paymentAmount !== undefined && Number(dto.paymentAmount) > 0
          ? Number(dto.paymentAmount)
          : newAmountNum;
    } else if (paymentMode === 'difference') {
      const diffDefault = Math.max(0, newAmountNum - oldAmountNum);
      chargedAmount =
        dto.paymentAmount !== undefined && Number(dto.paymentAmount) > 0
          ? Number(dto.paymentAmount)
          : diffDefault;
    }

    let createdTx: any = null;
    if (chargedAmount > 0) {
      let targetWalletId = walletId;
      if (!targetWalletId) {
        const wallets = await walletRepository.findAllByUserId(userId);
        const mainWallet =
          wallets.find((w) => w.type === 'Bank' && w.isMain) ||
          wallets.find((w) => w.type === 'Bank') ||
          wallets[0];
        if (!mainWallet) throw new Error('No wallet available to record plan payment');
        targetWalletId = mainWallet.id;
      }

      const labelTag = direction === 'downgrade' ? 'Downgrade' : direction === 'upgrade' ? 'Upgrade' : 'Plan Switch';
      const noteText =
        oldName === finalName
          ? `Subscription ${labelTag}: ${finalName} (${oldAmountNum.toFixed(0)} ${oldCycle} → ${newAmountNum.toFixed(0)} ${newCycle})`
          : `Subscription ${labelTag}: ${oldName} → ${finalName} (${newAmountNum.toFixed(0)} ${newCycle})`;

      createdTx = await transactionService.createTransaction(userId, {
        amount: Math.round(chargedAmount * 100) / 100,
        type: 'Expense',
        category: sub.category || 'Subscriptions & Streaming',
        notes: noteText,
        walletId: targetWalletId,
        transaction_date: effectiveIso,
      });
    }

    const changeNoteLine = `[${effectiveIso}] Plan ${direction}: ${oldAmountNum.toFixed(0)} ${sub.currency || 'MAD'}/${oldCycle} → ${newAmountNum.toFixed(0)} ${finalCurrency}/${newCycle}`;
    const finalNotes =
      dto.notes !== undefined
        ? dto.notes.trim()
        : sub.notes
        ? `${sub.notes} · ${changeNoteLine}`
        : changeNoteLine;

    const updatedSub = await subscriptionRepository.update(id, userId, {
      name: finalName,
      amount: newAmountNum.toFixed(2),
      currency: finalCurrency,
      billingCycle: newCycle,
      walletId,
      nextBillingDate: nextBillingDateValue,
      status: dto.status || (sub.status === 'planned' && chargedAmount > 0 ? 'active' : sub.status),
      notes: finalNotes,
    });

    const monthlyDelta = Math.round((newMonthly - oldMonthly) * 100) / 100;
    return {
      subscription: updatedSub,
      transaction: createdTx,
      summary: {
        direction,
        oldName,
        newName: finalName,
        oldAmount: oldAmountNum,
        newAmount: newAmountNum,
        oldBillingCycle: oldCycle,
        newBillingCycle: newCycle,
        oldMonthlyEquivalent: Math.round(oldMonthly * 100) / 100,
        newMonthlyEquivalent: Math.round(newMonthly * 100) / 100,
        monthlyDelta,
        annualizedDelta: Math.round(monthlyDelta * 12 * 100) / 100,
        chargedAmount: Math.round(chargedAmount * 100) / 100,
        nextBillingDate: nextBillingDateValue ? nextBillingDateValue.toISOString() : null,
      },
    };
  }

  async detectSubscriptions(userId: string) {
    const [txs, existingSubs] = await Promise.all([
      transactionRepository.findAllByUserId(userId),
      subscriptionRepository.findAllByUserId(userId),
    ]);

    const existingNames = new Set(existingSubs.map((s) => s.name.toLowerCase().trim()));

    // Keywords to recognize subscription services
    const knownPatterns = [
      { name: 'Netflix', category: 'Streaming & Media', icon: '🎬', defaultCycle: 'monthly' },
      { name: 'Spotify', category: 'Streaming & Media', icon: '🎵', defaultCycle: 'monthly' },
      { name: 'YouTube', category: 'Streaming & Media', icon: '▶️', defaultCycle: 'monthly' },
      { name: 'Apple', category: 'Digital Services', icon: '🍏', defaultCycle: 'monthly' },
      { name: 'iCloud', category: 'Cloud Storage', icon: '☁️', defaultCycle: 'monthly' },
      { name: 'Google', category: 'Digital Services', icon: '🌐', defaultCycle: 'monthly' },
      { name: 'Amazon Prime', category: 'Subscriptions & Streaming', icon: '📦', defaultCycle: 'monthly' },
      { name: 'ChatGPT / OpenAI', category: 'AI & Software', icon: '🤖', defaultCycle: 'monthly' },
      { name: 'Claude / Anthropic', category: 'AI & Software', icon: '🧠', defaultCycle: 'monthly' },
      { name: 'GitHub', category: 'Software & Dev', icon: '💻', defaultCycle: 'monthly' },
      { name: 'Gym / Fitness', category: 'Health & Fitness', icon: '💪', defaultCycle: 'every_3_months' },
      { name: 'Maroc Telecom', category: 'Internet & Telecom', icon: '📶', defaultCycle: 'monthly' },
      { name: 'Orange', category: 'Internet & Telecom', icon: '📱', defaultCycle: 'monthly' },
      { name: 'Inwi', category: 'Internet & Telecom', icon: '📡', defaultCycle: 'monthly' },
      { name: 'Fiber / Internet', category: 'Bills & Utilities', icon: '🌐', defaultCycle: 'monthly' },
      { name: 'Rent / Loyer', category: 'Housing & Rent', icon: '🏠', defaultCycle: 'monthly' },
      { name: 'Lydec / Redal / Amendis', category: 'Bills & Utilities', icon: '💡', defaultCycle: 'monthly' },
      { name: 'Assurance / Insurance', category: 'Insurance', icon: '🛡️', defaultCycle: 'every_3_months' },
      { name: 'Adobe', category: 'Software & Dev', icon: '🎨', defaultCycle: 'monthly' },
      { name: 'Notion', category: 'Software & Dev', icon: '📝', defaultCycle: 'monthly' },
      { name: 'Canva', category: 'Software & Dev', icon: '✨', defaultCycle: 'monthly' },
      { name: 'Disney+', category: 'Streaming & Media', icon: '🏰', defaultCycle: 'monthly' },
    ];

    const detected: Array<{
      name: string;
      suggestedAmount: number;
      suggestedCycle: string;
      suggestedCategory: string;
      frequencyCount: number;
      lastSeenDate: string;
      sampleTransactionNotes?: string;
      confidence: 'high' | 'medium';
      icon: string;
    }> = [];

    // Filter expense transactions
    const expenses = txs.filter((t) => t.type === 'Expense');

    // 1. Scan for known keywords
    for (const pattern of knownPatterns) {
      if (existingNames.has(pattern.name.toLowerCase())) continue;

      const matchedTxs = expenses.filter((t) => {
        const textToSearch = `${t.notes || ''} ${t.category || ''}`.toLowerCase();
        const searchTerms = pattern.name.toLowerCase().split(' / ');
        return searchTerms.some((term) => textToSearch.includes(term.trim()));
      });

      if (matchedTxs.length >= 1) {
        const amounts = matchedTxs.map((t) => parseFloat(t.amount as string) || 0).filter((a) => a > 0);
        if (amounts.length === 0) continue;

        const latestTx = matchedTxs[0];
        const suggestedAmount = parseFloat(latestTx.amount as string) || amounts[0];

        // Infer cycle from gap between recent transactions if >= 2 occurrences
        let inferredCycle = pattern.defaultCycle || 'monthly';
        if (matchedTxs.length >= 2 && matchedTxs[0].createdAt && matchedTxs[1].createdAt) {
          const gapDays = Math.abs(
            (new Date(matchedTxs[0].createdAt).getTime() - new Date(matchedTxs[1].createdAt).getTime()) /
              86400000
          );
          if (gapDays >= 75 && gapDays <= 110) inferredCycle = 'every_3_months';
          else if (gapDays >= 50 && gapDays < 75) inferredCycle = 'every_2_months';
          else if (gapDays >= 160 && gapDays <= 210) inferredCycle = 'every_6_months';
          else if (gapDays >= 330) inferredCycle = 'yearly';
        }

        detected.push({
          name: pattern.name,
          suggestedAmount: Math.round(suggestedAmount * 100) / 100,
          suggestedCycle: inferredCycle,
          suggestedCategory: pattern.category,
          frequencyCount: matchedTxs.length,
          lastSeenDate: latestTx.createdAt ? new Date(latestTx.createdAt).toISOString() : new Date().toISOString(),
          sampleTransactionNotes: latestTx.notes || `${pattern.name} transaction`,
          confidence: matchedTxs.length >= 2 ? 'high' : 'medium',
          icon: pattern.icon,
        });
      }
    }

    // 2. Scan for repeating exact amounts with identical category or notes across different months
    const amountGroups = new Map<string, typeof expenses>();
    for (const tx of expenses) {
      const amt = parseFloat(tx.amount as string) || 0;
      if (amt < 20) continue; // ignore tiny micro charges
      const key = `${amt.toFixed(2)}_${(tx.category || '').toLowerCase()}`;
      if (!amountGroups.has(key)) amountGroups.set(key, []);
      amountGroups.get(key)!.push(tx);
    }

    for (const [key, group] of amountGroups.entries()) {
      if (group.length >= 2) {
        const [amtStr, cat] = key.split('_');
        const amt = parseFloat(amtStr);
        const nameGuess = group[0].notes?.trim() || `${group[0].category || 'Recurring'} Bill`;

        // Check if not already added
        if (
          !existingNames.has(nameGuess.toLowerCase()) &&
          !detected.some((d) => d.name.toLowerCase() === nameGuess.toLowerCase())
        ) {
          detected.push({
            name: nameGuess.slice(0, 35),
            suggestedAmount: amt,
            suggestedCycle: 'monthly',
            suggestedCategory: group[0].category || 'Bills & Utilities',
            frequencyCount: group.length,
            lastSeenDate: group[0].createdAt ? new Date(group[0].createdAt).toISOString() : new Date().toISOString(),
            sampleTransactionNotes: group[0].notes || `${amt} MAD charge`,
            confidence: group.length >= 3 ? 'high' : 'medium',
            icon: '🔄',
          });
        }
      }
    }

    return detected.slice(0, 8); // limit top suggestions
  }
}

export const subscriptionService = new SubscriptionService();
