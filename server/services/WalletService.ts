import { walletRepository } from '../repositories/WalletRepository.js';
import { transactionRepository } from '../repositories/TransactionRepository.js';

export interface CreateWalletDTO {
  name: string;
  type: 'Bank' | 'Cash' | 'Savings';
  isMain?: boolean;
  initialBalance?: number;
}

export interface UpdateWalletDTO {
  name?: string;
  type?: 'Bank' | 'Cash' | 'Savings';
  isMain?: boolean;
  initialBalance?: number;
}

export class WalletService {
  async getWallets(userId: string) {
    let userWallets = await walletRepository.findAllByUserId(userId);
    if (userWallets.length === 0) {
      await walletRepository.create({ userId, name: 'Bank Account', type: 'Bank', isMain: true });
      await walletRepository.create({ userId, name: 'Cash Wallet', type: 'Cash', isMain: false });
      userWallets = await walletRepository.findAllByUserId(userId);
    }
    return userWallets;
  }

  async createWallet(userId: string, dto: CreateWalletDTO) {
    const name = dto.name?.trim();
    if (!name) {
      throw new Error('Wallet name is required');
    }

    const type = dto.type || 'Bank';
    if (!['Bank', 'Cash', 'Savings'].includes(type)) {
      throw new Error('Invalid wallet type. Allowed types: Bank, Cash, Savings');
    }

    const existingWallets = await walletRepository.findAllByUserId(userId);
    const isFirst = existingWallets.length === 0;
    const isMain = isFirst ? true : Boolean(dto.isMain);
    const initialBalance = String(dto.initialBalance ?? 0);

    const created = await walletRepository.create({
      userId,
      name,
      type,
      isMain,
      initialBalance,
    });

    return created;
  }

  async updateWallet(userId: string, walletId: string, dto: UpdateWalletDTO) {
    const wallet = await walletRepository.findById(walletId, userId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const updateData: any = {};
    if (dto.name !== undefined) {
      const trimmed = dto.name.trim();
      if (!trimmed) throw new Error('Wallet name cannot be empty');
      updateData.name = trimmed;
    }

    if (dto.type !== undefined) {
      if (!['Bank', 'Cash', 'Savings'].includes(dto.type)) {
        throw new Error('Invalid wallet type');
      }
      updateData.type = dto.type;
    }

    if (dto.isMain !== undefined) {
      updateData.isMain = Boolean(dto.isMain);
    }

    if (dto.initialBalance !== undefined) {
      updateData.initialBalance = String(dto.initialBalance);
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

    const remainingWallets = allWallets.filter(w => w.id !== walletId);
    let targetWallet = remainingWallets.find(w => w.id === reassignToWalletId);
    if (!targetWallet) {
      // Pick main wallet or first remaining
      targetWallet = remainingWallets.find(w => w.isMain) || remainingWallets[0];
    }

    // Reassign transactions
    await walletRepository.reassignTransactions(userId, walletId, targetWallet.id);

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
