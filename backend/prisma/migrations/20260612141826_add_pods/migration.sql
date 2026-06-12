-- CreateTable
CREATE TABLE "pods" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "pod_head_id" TEXT,
    "account_director_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pods_pod_head_id_fkey" FOREIGN KEY ("pod_head_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pods_account_director_id_fkey" FOREIGN KEY ("account_director_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_clients" (
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
    "pod_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "clients_pod_id_fkey" FOREIGN KEY ("pod_id") REFERENCES "pods" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_clients" ("address", "billing_terms", "contact_email", "contact_name", "contact_phone", "created_at", "credit_limit", "gstin", "id", "name", "state_code", "updated_at") SELECT "address", "billing_terms", "contact_email", "contact_name", "contact_phone", "created_at", "credit_limit", "gstin", "id", "name", "state_code", "updated_at" FROM "clients";
DROP TABLE "clients";
ALTER TABLE "new_clients" RENAME TO "clients";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
