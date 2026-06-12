# Invoice Tracker Dashboard

Internal invoice tracking system for a marketing agency — GST-compliant, three billing flows, automated reminders.

## Stack

| Layer | Choice |
|-------|--------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| State | Zustand (auth/filters) + TanStack Query (server state) |
| Backend | Node.js 20 + Express + TypeScript |
| Database | PostgreSQL via Prisma ORM |
| Auth | JWT (access + refresh tokens) |

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Backend setup
```bash
cd backend
cp .env.example .env          # fill in DATABASE_URL and JWT secrets
npm run db:generate            # generate Prisma client
npm run db:migrate             # run migrations
npm run dev                    # starts on :3001
```

### 3. Frontend setup
```bash
cd frontend
cp .env.example .env
npm run dev                    # starts on :5173
```

### 4. Run both together (from root)
```bash
npm run dev
```

## Build Phases

| Phase | Scope | Duration |
|-------|-------|----------|
| 1 | Core invoice CRUD + PDF + status machine | ✅ Done |
| 2 | Estimate flow + PO attachment + payments + reminders | Next |
| 3 | Credit notes + reports + GST compliance | Planned |
| 4 | Approvals + KPI dashboard + integrations | Planned |

## Billing Flows

- **Flow 1** — Direct: Work confirmed → Invoice → Send → Payment → Paid
- **Flow 2** — Estimate → PO → Invoice (auto-converted)
- **Flow 3** — Cancellation via credit note (GST compliant)

## Key Rules

- Invoices are never deleted — cancelled via credit note only
- Sequential, unbroken invoice numbering (`INV/2526/0001`)
- GST auto-calculated: CGST+SGST (intra-state) or IGST (inter-state)
- Approval workflow for invoices above configurable threshold
