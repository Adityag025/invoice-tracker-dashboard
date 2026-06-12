-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoice_id" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "tds_amount" REAL NOT NULL DEFAULT 0,
    "tds_cert_number" TEXT,
    "payment_date" DATETIME NOT NULL,
    "method" TEXT NOT NULL,
    "reference_number" TEXT,
    "notes" TEXT,
    "recorded_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_payments" ("amount", "created_at", "id", "invoice_id", "method", "notes", "payment_date", "recorded_by", "reference_number") SELECT "amount", "created_at", "id", "invoice_id", "method", "notes", "payment_date", "recorded_by", "reference_number" FROM "payments";
DROP TABLE "payments";
ALTER TABLE "new_payments" RENAME TO "payments";
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
