-- Migration: Link Goals to Wallets (specifically Savings wallets) with auto-sync balance support
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "wallet_id" uuid REFERENCES "wallets"("id") ON DELETE SET NULL;
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "auto_sync_balance" boolean DEFAULT false NOT NULL;
