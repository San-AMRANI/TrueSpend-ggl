import { subscriptionRepository, CreateSubscriptionParams } from '../repositories/SubscriptionRepository.js';
import { transactionService } from './TransactionService.js';
import { walletRepository } from '../repositories/WalletRepository.js';
import { transactionRepository } from '../repositories/TransactionRepository.js';

export interface CreateSubscriptionDTO {
  name: string;
  amount: number;
  currency?: string;
  billingCycle?: 'monthly' | 'yearly' | 'quarterly' | 'weekly';
  category?: string;
  walletId?: string | null;
  nextBillingDate?: string | null;
  status?: 'active' | 'paused' | 'reviewing' | 'cancelled';
  notes?: string;
  icon?: string;
  websiteUrl?: string;
}

export interface UpdateSubscriptionDTO {
  name?: string;
  amount?: number;
  currency?: string;
  billingCycle?: 'monthly' | 'yearly' | 'quarterly' | 'weekly';
  category?: string;
  walletId?: string | null;
  nextBillingDate?: string | null;
  status?: 'active' | 'paused' | 'reviewing' | 'cancelled';
  notes?: string;
  icon?: string;
  websiteUrl?: string;
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

    return await subscriptionRepository.create({
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

    // 2. Roll next billing date forward by 1 cycle
    let nextDate = sub.nextBillingDate ? new Date(sub.nextBillingDate) : new Date(dateToUse);
    if (isNaN(nextDate.getTime())) nextDate = new Date();

    const cycle = sub.billingCycle || 'monthly';
    const rolledDate = new Date(nextDate.getTime());
    if (cycle === 'weekly') {
      rolledDate.setDate(rolledDate.getDate() + 7);
    } else if (cycle === 'quarterly') {
      rolledDate.setMonth(rolledDate.getMonth() + 3);
    } else if (cycle === 'yearly') {
      rolledDate.setFullYear(rolledDate.getFullYear() + 1);
    } else {
      // Monthly default
      rolledDate.setMonth(rolledDate.getMonth() + 1);
    }

    const updatedSub = await subscriptionRepository.update(id, userId, {
      nextBillingDate: rolledDate,
    });

    return {
      subscription: updatedSub,
      transaction: createdTx,
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
      { name: 'Netflix', category: 'Streaming & Media', icon: '🎬' },
      { name: 'Spotify', category: 'Streaming & Media', icon: '🎵' },
      { name: 'YouTube', category: 'Streaming & Media', icon: '▶️' },
      { name: 'Apple', category: 'Digital Services', icon: '🍏' },
      { name: 'iCloud', category: 'Cloud Storage', icon: '☁️' },
      { name: 'Google', category: 'Digital Services', icon: '🌐' },
      { name: 'Amazon Prime', category: 'Subscriptions & Streaming', icon: '📦' },
      { name: 'ChatGPT / OpenAI', category: 'AI & Software', icon: '🤖' },
      { name: 'Claude / Anthropic', category: 'AI & Software', icon: '🧠' },
      { name: 'GitHub', category: 'Software & Dev', icon: '💻' },
      { name: 'Gym / Fitness', category: 'Health & Fitness', icon: '💪' },
      { name: 'Maroc Telecom', category: 'Internet & Telecom', icon: '📶' },
      { name: 'Orange', category: 'Internet & Telecom', icon: '📱' },
      { name: 'Inwi', category: 'Internet & Telecom', icon: '📡' },
      { name: 'Fiber / Internet', category: 'Bills & Utilities', icon: '🌐' },
      { name: 'Rent / Loyer', category: 'Housing & Rent', icon: '🏠' },
      { name: 'Lydec / Redal / Amendis', category: 'Bills & Utilities', icon: '💡' },
      { name: 'Assurance / Insurance', category: 'Insurance', icon: '🛡️' },
      { name: 'Adobe', category: 'Software & Dev', icon: '🎨' },
      { name: 'Notion', category: 'Software & Dev', icon: '📝' },
      { name: 'Canva', category: 'Software & Dev', icon: '✨' },
      { name: 'Disney+', category: 'Streaming & Media', icon: '🏰' },
    ];

    const detected: Array<{
      name: string;
      suggestedAmount: number;
      suggestedCycle: 'monthly' | 'yearly' | 'quarterly' | 'weekly';
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

        // Take mode or most recent amount
        const latestTx = matchedTxs[0];
        const suggestedAmount = parseFloat(latestTx.amount as string) || amounts[0];

        detected.push({
          name: pattern.name,
          suggestedAmount: Math.round(suggestedAmount * 100) / 100,
          suggestedCycle: 'monthly',
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
