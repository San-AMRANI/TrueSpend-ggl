import { eq } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { wallets } from '../../src/db/schema.js';
import { walletRepository } from '../repositories/WalletRepository.js';

export interface CreateWalletDTO {
  name: string;
  type: 'Bank' | 'Cash' | 'Savings' | 'Investment';
  accountSubtype?: 'Checking' | 'Savings' | 'Cash' | 'Brokerage' | 'CreditCard' | 'Overdraft';
  institutionName?: string;
  accountReference?: string;
  currency?: string;
  isMain?: boolean;
  initialBalance?: number;
  creditLimit?: number;
  liabilityBalance?: number;
  statementClosingDay?: number;
  paymentDueDay?: number;
  minimumPayment?: number;
  valuationStatus?: 'verified' | 'manual' | 'synced' | 'stale';
}

export interface UpdateWalletDTO {
  name?: string;
  type?: 'Bank' | 'Cash' | 'Savings' | 'Investment';
  accountSubtype?: 'Checking' | 'Savings' | 'Cash' | 'Brokerage' | 'CreditCard' | 'Overdraft';
  institutionName?: string;
  accountReference?: string;
  currency?: string;
  isMain?: boolean;
  initialBalance?: number;
  creditLimit?: number;
  liabilityBalance?: number;
  statementClosingDay?: number;
  paymentDueDay?: number;
  minimumPayment?: number;
  valuationStatus?: 'verified' | 'manual' | 'synced' | 'stale';
}

export class WalletService {
  async getWallets(userId: string) {
    let userWallets = await walletRepository.findAllByUserId(userId);
    if (userWallets.length === 0) {
      await walletRepository.create({ userId, name: 'Bank Account', type: 'Bank', isMain: true });
      await walletRepository.create({ userId, name: 'Cash Wallet', type: 'Cash', isMain: false });
      userWallets = await walletRepository.findAllByUserId(userId);
    }

    // Ensure at least one wallet is marked isMain
    if (userWallets.length > 0 && !userWallets.some((w) => w.isMain)) {
      const candidate =
        userWallets.find((w) => w.type === 'Bank') ||
        userWallets.find((w) => w.type === 'Cash') ||
        userWallets[0];
      if (candidate) {
        await walletRepository.update(candidate.id, userId, { isMain: true });
        userWallets = await walletRepository.findAllByUserId(userId);
      }
    }

    return userWallets;
  }

  async createWallet(userId: string, dto: CreateWalletDTO) {
    const name = dto.name?.trim();
    if (!name) {
      throw new Error('Wallet name is required');
    }

    const type = dto.type || 'Bank';
    if (!['Bank', 'Cash', 'Savings', 'Investment'].includes(type)) {
      throw new Error('Invalid wallet type. Allowed types: Bank, Cash, Savings, Investment');
    }

    const existingWallets = await walletRepository.findAllByUserId(userId);
    const isFirst = existingWallets.length === 0;
    const isCredit = dto.accountSubtype === 'CreditCard' || dto.accountSubtype === 'Overdraft';
    const isMain = isCredit ? false : isFirst ? true : Boolean(dto.isMain);
    const initialBalance = String(dto.initialBalance ?? 0);

    const created = await walletRepository.create({
      userId,
      name,
      type,
      isMain,
      initialBalance,
    });

    const extraPatch: Record<string, any> = {
      accountSubtype:
        dto.accountSubtype ||
        (type === 'Savings'
          ? 'Savings'
          : type === 'Cash'
          ? 'Cash'
          : type === 'Investment'
          ? 'Brokerage'
          : 'Checking'),
      institutionName: dto.institutionName?.trim() || null,
      accountReference: dto.accountReference?.trim() || null,
      currency: (dto.currency || 'MAD').toUpperCase().trim(),
      creditLimit: String(dto.creditLimit ?? 0),
      liabilityBalance: String(dto.liabilityBalance ?? 0),
      statementClosingDay: dto.statementClosingDay ?? null,
      paymentDueDay: dto.paymentDueDay ?? null,
      minimumPayment: String(dto.minimumPayment ?? 0),
      valuationStatus: dto.valuationStatus || 'verified',
    };

    const [enriched] = await db
      .update(wallets)
      .set(extraPatch)
      .where(eq(wallets.id, created.id))
      .returning();

    return enriched || created;
  }

  async updateWallet(userId: string, walletId: string, dto: UpdateWalletDTO) {
    const wallet = await walletRepository.findById(walletId, userId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const allWallets = await walletRepository.findAllByUserId(userId);
    const previousMain = allWallets.find((w) => w.isMain && w.id !== walletId);

    const updateData: any = {};
    if (dto.name !== undefined) {
      const trimmed = dto.name.trim();
      if (!trimmed) throw new Error('Wallet name cannot be empty');
      updateData.name = trimmed;
    }

    if (dto.type !== undefined) {
      if (!['Bank', 'Cash', 'Savings', 'Investment'].includes(dto.type)) {
        throw new Error('Invalid wallet type');
      }
      updateData.type = dto.type;
    }

    if (dto.isMain !== undefined) {
      updateData.isMain = Boolean(dto.isMain);
    }

    if (dto.initialBalance !== undefined) {
      updateData.initialBalance = String(dto.initialBalance);
      updateData.lastReconciledAt = new Date();
    }
    if (dto.accountSubtype !== undefined) updateData.accountSubtype = dto.accountSubtype;
    if (dto.institutionName !== undefined) updateData.institutionName = dto.institutionName?.trim() || null;
    if (dto.accountReference !== undefined) updateData.accountReference = dto.accountReference?.trim() || null;
    if (dto.currency !== undefined) updateData.currency = dto.currency.toUpperCase().trim();
    if (dto.creditLimit !== undefined) updateData.creditLimit = String(dto.creditLimit);
    if (dto.liabilityBalance !== undefined) updateData.liabilityBalance = String(dto.liabilityBalance);
    if (dto.statementClosingDay !== undefined) updateData.statementClosingDay = dto.statementClosingDay;
    if (dto.paymentDueDay !== undefined) updateData.paymentDueDay = dto.paymentDueDay;
    if (dto.minimumPayment !== undefined) updateData.minimumPayment = String(dto.minimumPayment);
    if (dto.valuationStatus !== undefined) updateData.valuationStatus = dto.valuationStatus;

    // Smart Primary Wallet Switching:
    // When promoting a non-main wallet to Primary (isMain: true):
    const isPromotingToMain = Boolean(dto.isMain) && !wallet.isMain;
    if (isPromotingToMain) {
      // If a Savings wallet is promoted to Primary without an explicit type override,
      // promote it to a liquid 'Bank' spending account and swap the previous Primary 'Bank' wallet to 'Savings'.
      if (wallet.type === 'Savings' && (dto.type === undefined || dto.type === 'Bank')) {
        updateData.type = 'Bank';
        if (previousMain && previousMain.type === 'Bank') {
          await walletRepository.update(previousMain.id, userId, {
            type: 'Savings',
            isMain: false,
          });
          // Keep auto-synced savings goals attached to the new Savings wallet
          await walletRepository.reassignAutoSyncGoals(userId, walletId, previousMain.id);
        }
      }

      // Move active recurring subscriptions from the old primary wallet to the new primary wallet
      if (previousMain) {
        await walletRepository.reassignSubscriptions(userId, previousMain.id, walletId);
      }
    } else if (wallet.isMain && updateData.type === 'Savings' && updateData.isMain !== true) {
      // If user manually changes the current Primary wallet's type to 'Savings',
      // promote another Bank wallet (or the first Savings wallet) to Primary so the app always has a liquid Primary wallet.
      const nextPrimary =
        allWallets.find((w) => w.id !== walletId && w.type === 'Bank') ||
        allWallets.find((w) => w.id !== walletId && w.type === 'Savings') ||
        allWallets.find((w) => w.id !== walletId && w.type === 'Cash');
      if (nextPrimary) {
        updateData.isMain = false;
        await walletRepository.update(nextPrimary.id, userId, {
          isMain: true,
          type: nextPrimary.type === 'Savings' ? 'Bank' : nextPrimary.type,
        });
        await walletRepository.reassignSubscriptions(userId, walletId, nextPrimary.id);
        await walletRepository.reassignAutoSyncGoals(userId, nextPrimary.id, walletId);
      }
    }

    const updated = await walletRepository.update(walletId, userId, updateData);
    return updated;
  }

  async deleteWallet(userId: string, walletId: string, reassignToWalletId?: string) {
    const wallet = await walletRepository.findById(walletId, userId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const allWallets = await walletRepository.findAllByUserId(userId);
    if (allWallets.length <= 1) {
      throw new Error('Cannot delete your only wallet. You must keep at least one wallet.');
    }

    const remainingWallets = allWallets.filter((w) => w.id !== walletId);
    let targetWallet = remainingWallets.find((w) => w.id === reassignToWalletId);
    if (!targetWallet) {
      // Pick main wallet or first remaining
      targetWallet = remainingWallets.find((w) => w.isMain) || remainingWallets[0];
    }

    // Reassign transactions and subscriptions
    await walletRepository.reassignTransactions(userId, walletId, targetWallet.id);
    await walletRepository.reassignSubscriptions(userId, walletId, targetWallet.id);

    // If deleted wallet was main, promote the target wallet to main
    if (wallet.isMain) {
      await walletRepository.update(targetWallet.id, userId, { isMain: true });
    }

    await walletRepository.delete(walletId, userId);

    return {
      success: true,
      message: `Wallet deleted. Transactions were reassigned to ${targetWallet.name}.`,
      reassignedTo: targetWallet.id,
    };
  }
}

export const walletService = new WalletService();
