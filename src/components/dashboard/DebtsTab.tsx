import React, { useState } from 'react';
import { Debt } from '../../types';
import DebtForm from '../DebtForm';
import { SettleDebtModal } from '../SettleDebtModal';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { CheckCircle2, ArrowDownRight, ArrowUpRight, Edit2, Trash2, History } from 'lucide-react';
import { format } from 'date-fns';

interface DebtsTabProps {
  debts: Debt[];
  fetchData: () => void;
  handleSettle: (debtId: string, amount: number) => Promise<void> | void;
  handleEditDebt: (debtId: string, currentAmount: string, currentContact: string, currentType: string) => void;
  handleDeleteDebt: (debtId: string) => void;
}

export const DebtsTab: React.FC<DebtsTabProps> = ({
  debts,
  fetchData,
  handleSettle,
  handleEditDebt,
  handleDeleteDebt,
}) => {
  const [settlingDebt, setSettlingDebt] = useState<Debt | null>(null);

  return (
    <>
      <DebtForm onSuccess={fetchData} />
      <Card>
        <CardHeader>
          <CardTitle>Debts & Splits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {debts.map((debt) => (
              <div key={debt.id} className="flex flex-col border-b border-gray-100 pb-4 sm:pb-3 pt-2 sm:pt-0 last:border-0 last:pb-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        debt.status === 'Cleared'
                          ? 'bg-gray-100 text-gray-400'
                          : debt.type === 'Receivable'
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-orange-100 text-orange-600'
                      }`}
                    >
                      {debt.status === 'Cleared' ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : debt.type === 'Receivable' ? (
                        <ArrowDownRight className="h-5 w-5" />
                      ) : (
                        <ArrowUpRight className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{debt.contactName}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{format(new Date(debt.createdAt), 'MMM d, yyyy')}</span>
                        <span>•</span>
                        <span>{debt.type === 'Receivable' ? 'Owes you' : 'You owe'}</span>
                        <span>•</span>
                        <span className={debt.status === 'Pending' ? 'text-amber-600 font-medium' : 'text-green-600 font-medium'}>
                          {debt.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pl-12 sm:pl-0">
                    <div className="text-right">
                      <div className={`font-semibold ${debt.status === 'Cleared' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        {parseFloat(debt.remainingBalance).toFixed(2)} MAD
                      </div>
                      <div className="text-xs text-gray-500">of {parseFloat(debt.originalAmount).toFixed(2)} MAD</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {debt.status === 'Pending' && (
                        <Button size="sm" variant="outline" onClick={() => setSettlingDebt(debt)}>
                          Settle
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-gray-400 hover:text-blue-600"
                        onClick={() => handleEditDebt(debt.id, debt.originalAmount, debt.contactName, debt.type)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-gray-400 hover:text-red-600"
                        onClick={() => handleDeleteDebt(debt.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                {debt.settlements && debt.settlements.length > 0 && (
                  <div className="mt-4 pl-12 sm:pl-12">
                    <div className="text-xs font-semibold text-gray-500 flex items-center gap-1 mb-2">
                      <History className="h-3 w-3" /> Settlement History
                    </div>
                    <div className="space-y-1">
                      {debt.settlements.map((s) => (
                        <div key={s.id} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                          <span>{format(new Date(s.createdAt), 'MMM d, yyyy - h:mm a')}</span>
                          <span className="font-medium text-gray-900">{parseFloat(s.amount).toFixed(2)} MAD</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {debts.length === 0 && <p className="py-4 text-center text-sm text-gray-500">No debts or splits recorded.</p>}
          </div>
        </CardContent>
      </Card>
      <SettleDebtModal
        debt={settlingDebt}
        onClose={() => setSettlingDebt(null)}
        onConfirm={handleSettle}
      />
    </>
  );
};
