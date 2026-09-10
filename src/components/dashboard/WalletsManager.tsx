import React, { useState } from 'react';
import { Landmark, Banknote, Wallet as WalletIcon, Plus, Edit2, Trash2, Star, Check, AlertCircle, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Wallet } from '../../types';

interface WalletsManagerProps {
  wallets: Wallet[];
  onCreateWallet: (payload: { name: string; type: 'Bank' | 'Cash' | 'Savings'; isMain?: boolean; initialBalance?: number }) => Promise<any>;
  onUpdateWallet: (id: string, payload: { name?: string; type?: 'Bank' | 'Cash' | 'Savings'; isMain?: boolean; initialBalance?: number }) => Promise<any>;
  onDeleteWallet: (id: string, reassignToWalletId?: string) => Promise<any>;
  onClose?: () => void;
  isModal?: boolean;
}

export const WalletsManager: React.FC<WalletsManagerProps> = ({
  wallets,
  onCreateWallet,
  onUpdateWallet,
  onDeleteWallet,
  onClose,
  isModal = false,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [deletingWallet, setDeletingWallet] = useState<Wallet | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>('');

  // Form states for create/edit
  const [formData, setFormData] = useState({
    name: '',
    type: 'Bank' as 'Bank' | 'Cash' | 'Savings',
    initialBalance: '',
    isMain: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openAddForm = () => {
    setEditingWallet(null);
    setFormData({
      name: '',
      type: 'Bank',
      initialBalance: '0',
      isMain: wallets.length === 0,
    });
    setError(null);
    setShowAddForm(true);
  };

  const openEditForm = (wallet: Wallet) => {
    setShowAddForm(false);
    setEditingWallet(wallet);
    setFormData({
      name: wallet.name,
      type: wallet.type,
      initialBalance: wallet.initialBalance || '0',
      isMain: wallet.isMain,
    });
    setError(null);
  };

  const closeForm = () => {
    setShowAddForm(false);
    setEditingWallet(null);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setError('Please enter a wallet name');
      return;
    }

    setLoading(true);
    try {
      if (editingWallet) {
        await onUpdateWallet(editingWallet.id, {
          name: trimmedName,
          type: formData.type,
          initialBalance: parseFloat(formData.initialBalance) || 0,
          isMain: formData.isMain,
        });
      } else {
        await onCreateWallet({
          name: trimmedName,
          type: formData.type,
          initialBalance: parseFloat(formData.initialBalance) || 0,
          isMain: formData.isMain,
        });
      }
      closeForm();
    } catch (err: any) {
      setError(err.message || 'Failed to save wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleMakeMain = async (wallet: Wallet) => {
    if (wallet.isMain) return;
    setLoading(true);
    try {
      await onUpdateWallet(wallet.id, { isMain: true });
    } catch (err: any) {
      alert(err.message || 'Failed to update primary wallet');
    } finally {
      setLoading(false);
    }
  };

  const openDeleteModal = (wallet: Wallet) => {
    if (wallets.length <= 1) {
      alert('You must have at least one wallet. Cannot delete your only wallet.');
      return;
    }
    const otherWallets = wallets.filter(w => w.id !== wallet.id);
    setDeletingWallet(wallet);
    setReassignTargetId(otherWallets[0]?.id || '');
    setError(null);
  };

  const confirmDelete = async () => {
    if (!deletingWallet) return;
    setLoading(true);
    setError(null);
    try {
      await onDeleteWallet(deletingWallet.id, reassignTargetId);
      setDeletingWallet(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete wallet');
    } finally {
      setLoading(false);
    }
  };

  const getWalletIcon = (type: string) => {
    switch (type) {
      case 'Bank':
        return <Landmark className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
      case 'Cash':
        return <Banknote className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case 'Savings':
        return <WalletIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />;
      default:
        return <WalletIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  const content = (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <WalletIcon className="h-5 w-5 text-indigo-500" />
            Manage Wallets & Accounts
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create and customize your bank accounts, physical cash reserves, and savings pockets.
          </p>
        </div>
        {!showAddForm && !editingWallet && (
          <Button
            type="button"
            onClick={openAddForm}
            className="flex items-center gap-2 shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Add Wallet
          </Button>
        )}
      </div>

      {/* Add / Edit Form */}
      {(showAddForm || editingWallet) && (
        <form onSubmit={handleSave} className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {editingWallet ? `Edit Wallet: ${editingWallet.name}` : 'Create New Wallet'}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Wallet Name</label>
              <Input
                required
                type="text"
                placeholder="e.g. BMCE Checking, Pocket Cash, Safe Box"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-white dark:bg-gray-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Wallet Type</label>
              <Select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="bg-white dark:bg-gray-800"
              >
                <option value="Bank">Bank Account</option>
                <option value="Cash">Physical Cash</option>
                <option value="Savings">Savings / Emergency</option>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Starting / Initial Balance (MAD)
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.initialBalance}
                onChange={(e) => setFormData({ ...formData, initialBalance: e.target.value })}
                className="bg-white dark:bg-gray-800"
              />
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                The baseline balance before recorded transactions.
              </p>
            </div>

            <div className="flex items-center sm:pt-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={formData.isMain}
                  onChange={(e) => setFormData({ ...formData, isMain: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium">Set as primary default wallet</span>
              </label>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="bg-blue-600 text-white hover:bg-blue-700">
              {loading ? 'Saving...' : editingWallet ? 'Update Wallet' : 'Create Wallet'}
            </Button>
          </div>
        </form>
      )}

      {/* Wallets Grid / List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {wallets.map((wallet) => (
          <div
            key={wallet.id}
            className={`relative rounded-xl border p-4 transition-all flex flex-col justify-between ${
              wallet.isMain
                ? 'border-indigo-200 dark:border-indigo-800/60 bg-gradient-to-br from-indigo-50/40 via-white to-white dark:from-indigo-950/20 dark:via-gray-900 dark:to-gray-900 shadow-sm'
                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800">
                    {getWalletIcon(wallet.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate max-w-[150px]">
                        {wallet.name}
                      </h4>
                      {wallet.isMain && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                          <Star className="h-2.5 w-2.5 fill-current" /> Primary
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                      {wallet.type} Account
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditForm(wallet)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="Edit Wallet"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={wallets.length <= 1}
                    onClick={() => openDeleteModal(wallet)}
                    className={`p-1.5 rounded-md transition-colors ${
                      wallets.length <= 1
                        ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                        : 'text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                    title={wallets.length <= 1 ? 'Cannot delete the only wallet' : 'Delete Wallet'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Balance figures */}
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800/80">
                <p className="text-xs text-gray-500 dark:text-gray-400">Current Balance</p>
                <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {(wallet.balance ?? 0).toFixed(2)}{' '}
                  <span className="text-xs font-medium text-gray-500">MAD</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-gray-400">
                  <span>Starting: {(parseFloat(wallet.initialBalance) || 0).toFixed(2)} MAD</span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            {!wallet.isMain && (
              <div className="mt-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleMakeMain(wallet)}
                  disabled={loading}
                  className="w-full text-center text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors flex items-center justify-center gap-1"
                >
                  <Star className="h-3 w-3" /> Make Primary
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-800 space-y-4 animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Delete Wallet: {deletingWallet.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Transactions linked to this wallet need to be safely transferred to another active wallet.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Reassign all existing transactions to:
              </label>
              <Select
                value={reassignTargetId}
                onChange={(e) => setReassignTargetId(e.target.value)}
                className="w-full"
              >
                {wallets
                  .filter((w) => w.id !== deletingWallet.id)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.type})
                    </option>
                  ))}
              </Select>
            </div>

            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeletingWallet(null)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={confirmDelete}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {loading ? 'Deleting...' : 'Delete & Reassign'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
        <div className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6 my-8 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-end pb-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {content}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {content}
      </CardContent>
    </Card>
  );
};
