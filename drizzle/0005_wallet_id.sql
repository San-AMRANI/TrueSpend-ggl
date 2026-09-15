ALTER TABLE "transactions" ADD COLUMN "wallet_id" uuid REFERENCES "public"."wallets"("id");
