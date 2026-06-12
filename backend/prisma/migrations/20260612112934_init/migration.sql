-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MANAGER',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "gstin" TEXT,
    "state_code" TEXT NOT NULL,
    "billing_terms" TEXT NOT NULL DEFAULT 'NET_30',
    "credit_limit" REAL,
    "contact_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT,
    "address" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ONE_OFF',
    "budget" REAL,
    "start_date" DATETIME,
    "end_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoice_number" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "project_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "issue_date" DATETIME NOT NULL,
    "due_date" DATETIME NOT NULL,
    "subtotal" REAL NOT NULL,
    "tax_total" REAL NOT NULL,
    "total" REAL NOT NULL,
    "notes" TEXT,
    "po_number" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoice_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hsn_sac" TEXT,
    "quantity" REAL NOT NULL,
    "unit_rate" REAL NOT NULL,
    "tax_rate" REAL NOT NULL,
    "tax_type" TEXT NOT NULL,
    "line_total" REAL NOT NULL,
    CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoice_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoice_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoice_events_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "invoice_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "estimate_number" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "project_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "revision_of" TEXT,
    "valid_until" DATETIME,
    "subtotal" REAL NOT NULL,
    "tax_total" REAL NOT NULL,
    "total" REAL NOT NULL,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "estimates_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "estimates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "estimates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "estimates_revision_of_fkey" FOREIGN KEY ("revision_of") REFERENCES "estimates" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "estimate_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "estimate_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hsn_sac" TEXT,
    "quantity" REAL NOT NULL,
    "unit_rate" REAL NOT NULL,
    "tax_rate" REAL NOT NULL,
    "tax_type" TEXT NOT NULL,
    "line_total" REAL NOT NULL,
    CONSTRAINT "estimate_items_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "estimates" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "estimate_id" TEXT,
    "invoice_id" TEXT,
    "po_number" TEXT NOT NULL,
    "po_date" DATETIME NOT NULL,
    "po_value" REAL NOT NULL,
    "document_url" TEXT,
    "received_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_orders_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "estimates" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoice_id" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "payment_date" DATETIME NOT NULL,
    "method" TEXT NOT NULL,
    "reference_number" TEXT,
    "notes" TEXT,
    "recorded_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cn_number" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "refund_amount" REAL,
    "refund_date" DATETIME,
    "replacement_invoice_id" TEXT,
    "issued_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "credit_notes_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "credit_notes_replacement_invoice_id_fkey" FOREIGN KEY ("replacement_invoice_id") REFERENCES "invoices" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "credit_notes_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "client_credits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "credit_note_id" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "used_amount" REAL NOT NULL DEFAULT 0,
    "remaining_amount" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "client_credits_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "client_credits_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "credit_notes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reminder_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoice_id" TEXT NOT NULL,
    "reminder_type" TEXT NOT NULL,
    "sent_at" DATETIME NOT NULL,
    "email_to" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "reminder_logs_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_client_id_status_idx" ON "invoices"("client_id", "status");

-- CreateIndex
CREATE INDEX "invoices_due_date_status_idx" ON "invoices"("due_date", "status");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_events_invoice_id_created_at_idx" ON "invoice_events"("invoice_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_estimate_number_key" ON "estimates"("estimate_number");

-- CreateIndex
CREATE INDEX "estimates_client_id_status_idx" ON "estimates"("client_id", "status");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_cn_number_key" ON "credit_notes"("cn_number");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_replacement_invoice_id_key" ON "credit_notes"("replacement_invoice_id");
