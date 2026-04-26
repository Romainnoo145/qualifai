-- Migration: quote_payment_schedule
-- Adds a JSON payment schedule to quotes.
-- TypeScript shape: { label: string; percentage: number; dueOn: string }[]
-- Empty/null = default (100% post-delivery).

ALTER TABLE "Quote" ADD COLUMN "paymentSchedule" JSONB;
