CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED');

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "engagementId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "termijnIndex" INTEGER NOT NULL,
  "termijnLabel" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "vatPercentage" INTEGER NOT NULL DEFAULT 21,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "sentAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "pdfUrl" TEXT,
  "notes" TEXT,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Invoice_invoiceNumber_key" UNIQUE ("invoiceNumber"),
  CONSTRAINT "Invoice_engagementId_termijnIndex_key" UNIQUE ("engagementId", "termijnIndex"),
  CONSTRAINT "Invoice_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Invoice_engagementId_idx" ON "Invoice"("engagementId");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

CREATE TABLE "InvoiceSequence" (
  "year" INTEGER NOT NULL,
  "lastSequence" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("year")
);
