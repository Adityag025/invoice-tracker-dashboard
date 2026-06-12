-- Migrate existing roles to new 5-level hierarchy
UPDATE "users" SET "role" = 'CEO'             WHERE "role" = 'ADMIN';
UPDATE "users" SET "role" = 'ACCOUNT_MANAGER' WHERE "role" = 'MANAGER';