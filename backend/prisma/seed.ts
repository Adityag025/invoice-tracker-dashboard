import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const AGENCY_STATE = '27';

const gst = (
  items: { desc: string; hsn?: string; qty: number; rate: number; tax: number }[],
  clientState: string,
) => {
  const inter = clientState !== AGENCY_STATE;
  const taxType = inter ? 'IGST' : 'CGST_SGST';
  const calced = items.map(i => {
    const base = i.qty * i.rate;
    const taxAmt = (base * i.tax) / 100;
    return { description: i.desc, hsnSac: i.hsn ?? '998313', quantity: i.qty, unitRate: i.rate, taxRate: i.tax, taxType, lineTotal: base + taxAmt };
  });
  const subtotal = calced.reduce((s, i) => s + i.quantity * i.unitRate, 0);
  const taxTotal = calced.reduce((s, i) => s + (i.quantity * i.unitRate * i.taxRate) / 100, 0);
  return { items: calced, subtotal, taxTotal, total: subtotal + taxTotal };
};

const d = (s: string) => new Date(s);

async function main() {
  console.log('🌱 Seeding database with comprehensive dummy data…\n');

  // ── 1. USERS ────────────────────────────────────────────────────────────────
  const pw = await bcrypt.hash('Agency@123', 12);

  const [ceo, director, podHead, manager, subMgr] = await Promise.all([
    prisma.user.upsert({ where: { email: 'ceo@agency.com' },        update: { role: 'CEO' },              create: { name: 'Rahul Sharma',  email: 'ceo@agency.com',        passwordHash: pw, role: 'CEO' } }),
    prisma.user.upsert({ where: { email: 'director@agency.com' },   update: { role: 'ACCOUNT_DIRECTOR' }, create: { name: 'Priya Nair',    email: 'director@agency.com',   passwordHash: pw, role: 'ACCOUNT_DIRECTOR' } }),
    prisma.user.upsert({ where: { email: 'podhead@agency.com' },    update: { role: 'POD_HEAD' },         create: { name: 'Arjun Mehta',   email: 'podhead@agency.com',    passwordHash: pw, role: 'POD_HEAD' } }),
    prisma.user.upsert({ where: { email: 'manager@agency.com' },    update: { role: 'ACCOUNT_MANAGER' },  create: { name: 'Sneha Kapoor',  email: 'manager@agency.com',    passwordHash: pw, role: 'ACCOUNT_MANAGER' } }),
    prisma.user.upsert({ where: { email: 'submanager@agency.com' }, update: { role: 'SUB_MANAGER' },      create: { name: 'Rohan Verma',   email: 'submanager@agency.com', passwordHash: pw, role: 'SUB_MANAGER' } }),
  ]);

  console.log('✅ Users seeded');

  // ── 2. PODS ─────────────────────────────────────────────────────────────────
  const [podCreative, podTech, podInfluencer] = await Promise.all([
    prisma.pod.upsert({ where: { id: 'pod-creative' }, update: {}, create: { id: 'pod-creative',    name: 'Creative Digital',  podHeadId: podHead.id, accountDirectorId: director.id } }),
    prisma.pod.upsert({ where: { id: 'pod-tech' },     update: {}, create: { id: 'pod-tech',        name: 'Tech & SEO',        podHeadId: manager.id, accountDirectorId: director.id } }),
    prisma.pod.upsert({ where: { id: 'pod-influencer'},update: {}, create: { id: 'pod-influencer',  name: 'Influencer Ops',    podHeadId: podHead.id, accountDirectorId: director.id } }),
  ]);

  console.log('✅ PODs seeded');

  // ── 3. CLIENTS ──────────────────────────────────────────────────────────────
  const clients = await Promise.all([
    prisma.client.upsert({ where: { id: 'cl-technova' },   update: {}, create: { id: 'cl-technova',   name: 'TechNova Solutions',       gstin: '27AABCT1234A1Z5', stateCode: '27', billingTerms: 'NET_30', creditLimit: 500000, contactName: 'Vikram Patel',    contactEmail: 'vikram@technova.in',    contactPhone: '+91 98765 11111', address: '401, Bandra Kurla Complex, Mumbai 400051', podId: podCreative.id } }),
    prisma.client.upsert({ where: { id: 'cl-bluehorizon' },update: {}, create: { id: 'cl-bluehorizon', name: 'BlueHorizon Media',         gstin: '07AABCB5678B1Z2', stateCode: '07', billingTerms: 'NET_45', creditLimit: 300000, contactName: 'Neha Sharma',     contactEmail: 'neha@bluehorizon.in',   contactPhone: '+91 98765 22222', address: '22, Connaught Place, New Delhi 110001',     podId: podInfluencer.id } }),
    prisma.client.upsert({ where: { id: 'cl-stellar' },    update: {}, create: { id: 'cl-stellar',    name: 'Stellar Apps Inc.',          gstin: '29AABCS9012C1Z3', stateCode: '29', billingTerms: 'NET_30', creditLimit: 400000, contactName: 'Kiran Reddy',     contactEmail: 'kiran@stellarapps.io',  contactPhone: '+91 98765 33333', address: '5th Floor, Prestige Tower, Bangalore 560001', podId: podTech.id } }),
    prisma.client.upsert({ where: { id: 'cl-greenleaf' },  update: {}, create: { id: 'cl-greenleaf',  name: 'GreenLeaf Retail Ltd.',      gstin: '24AABCG3456D1Z4', stateCode: '24', billingTerms: 'NET_45', creditLimit: 250000, contactName: 'Amit Desai',      contactEmail: 'amit@greenleaf.in',     contactPhone: '+91 98765 44444', address: '12, CG Road, Ahmedabad 380009',              podId: podCreative.id } }),
    prisma.client.upsert({ where: { id: 'cl-apex' },       update: {}, create: { id: 'cl-apex',       name: 'Apex Financials Pvt. Ltd.',  gstin: '07AABCA7890E1Z5', stateCode: '07', billingTerms: 'NET_60', creditLimit: 600000, contactName: 'Rajesh Khanna',   contactEmail: 'rajesh@apexfinance.in', contactPhone: '+91 98765 55555', address: '15, Barakhamba Road, New Delhi 110001',     podId: podInfluencer.id } }),
    prisma.client.upsert({ where: { id: 'cl-mumbaic' },    update: {}, create: { id: 'cl-mumbaic',    name: 'Mumbai Creatives Studio',    gstin: '27AABCM2345F1Z6', stateCode: '27', billingTerms: 'NET_30', creditLimit: 200000, contactName: 'Ananya Joshi',    contactEmail: 'ananya@mumbaicreatives.com', contactPhone: '+91 98765 66666', address: '3, Linking Road, Bandra West, Mumbai 400050', podId: podCreative.id } }),
    prisma.client.upsert({ where: { id: 'cl-blrtech' },    update: {}, create: { id: 'cl-blrtech',    name: 'Bangalore Tech Hub',         gstin: '29AABCB6789G1Z7', stateCode: '29', billingTerms: 'NET_30', creditLimit: 350000, contactName: 'Suresh Kumar',    contactEmail: 'suresh@bltechhub.io',   contactPhone: '+91 98765 77777', address: '100 Feet Road, Indiranagar, Bangalore 560038', podId: podTech.id } }),
    prisma.client.upsert({ where: { id: 'cl-sunrise' },    update: {}, create: { id: 'cl-sunrise',    name: 'Sunrise Brands Pvt. Ltd.',   gstin: '27AABCS1122H1Z8', stateCode: '27', billingTerms: 'NET_45', creditLimit: 300000, contactName: 'Pooja Malhotra',  contactEmail: 'pooja@sunrisebrands.in', contactPhone: '+91 98765 88888', address: '7, Juhu Scheme, Andheri West, Mumbai 400058', podId: podInfluencer.id } }),
  ]);

  const [cTechNova, cBlueHorizon, cStellar, cGreenLeaf, cApex, cMumbaiC, cBlrTech, cSunrise] = clients;
  console.log('✅ Clients seeded');

  // ── 4. PROJECTS ─────────────────────────────────────────────────────────────
  const [
    pBrandIdentity, pSocialRetainer, pInfluencerQ1, pDigitalRetainer,
    pAppMarketing, pSeoRetainer, pWebsiteRedesign, pContentRetainer,
    pFinanceCampaign, pCreativeRetainer, pTechCampaign, pBrandLaunch,
  ] = await Promise.all([
    prisma.project.upsert({ where: { id: 'proj-1' }, update: {}, create: { id: 'proj-1', clientId: cTechNova.id,    name: 'Brand Identity Redesign',         type: 'ONE_OFF',  budget: 350000,  startDate: d('2025-04-01'), endDate: d('2025-09-30') } }),
    prisma.project.upsert({ where: { id: 'proj-2' }, update: {}, create: { id: 'proj-2', clientId: cTechNova.id,    name: 'Monthly Social Media Management',  type: 'RETAINER', budget: 75000,   startDate: d('2025-04-01') } }),
    prisma.project.upsert({ where: { id: 'proj-3' }, update: {}, create: { id: 'proj-3', clientId: cBlueHorizon.id, name: 'Influencer Campaign Q1 FY26',      type: 'ONE_OFF',  budget: 280000,  startDate: d('2025-04-01'), endDate: d('2025-06-30') } }),
    prisma.project.upsert({ where: { id: 'proj-4' }, update: {}, create: { id: 'proj-4', clientId: cBlueHorizon.id, name: 'Digital Marketing Retainer',        type: 'RETAINER', budget: 60000,   startDate: d('2025-07-01') } }),
    prisma.project.upsert({ where: { id: 'proj-5' }, update: {}, create: { id: 'proj-5', clientId: cStellar.id,     name: 'App Marketing Campaign FY26',       type: 'ONE_OFF',  budget: 220000,  startDate: d('2025-05-01'), endDate: d('2025-10-31') } }),
    prisma.project.upsert({ where: { id: 'proj-6' }, update: {}, create: { id: 'proj-6', clientId: cStellar.id,     name: 'SEO & Performance Retainer',        type: 'RETAINER', budget: 45000,   startDate: d('2025-06-01') } }),
    prisma.project.upsert({ where: { id: 'proj-7' }, update: {}, create: { id: 'proj-7', clientId: cGreenLeaf.id,   name: 'E-Commerce Website Redesign',       type: 'ONE_OFF',  budget: 190000,  startDate: d('2025-08-01'), endDate: d('2025-12-31') } }),
    prisma.project.upsert({ where: { id: 'proj-8' }, update: {}, create: { id: 'proj-8', clientId: cGreenLeaf.id,   name: 'Content Marketing Retainer',        type: 'RETAINER', budget: 40000,   startDate: d('2025-09-01') } }),
    prisma.project.upsert({ where: { id: 'proj-9' }, update: {}, create: { id: 'proj-9', clientId: cApex.id,        name: 'Financial Services Brand Campaign', type: 'ONE_OFF',  budget: 450000,  startDate: d('2025-06-01'), endDate: d('2026-03-31') } }),
    prisma.project.upsert({ where: { id: 'proj-10'},  update: {}, create: { id: 'proj-10', clientId: cMumbaiC.id,   name: 'Creative Services Retainer',        type: 'RETAINER', budget: 55000,   startDate: d('2025-10-01') } }),
    prisma.project.upsert({ where: { id: 'proj-11'},  update: {}, create: { id: 'proj-11', clientId: cBlrTech.id,   name: 'Tech Startup Marketing Campaign',   type: 'ONE_OFF',  budget: 160000,  startDate: d('2026-01-01'), endDate: d('2026-06-30') } }),
    prisma.project.upsert({ where: { id: 'proj-12'},  update: {}, create: { id: 'proj-12', clientId: cSunrise.id,   name: 'Brand Launch & Awareness Campaign', type: 'ONE_OFF',  budget: 320000,  startDate: d('2026-03-01'), endDate: d('2026-09-30') } }),
  ]);

  console.log('✅ Projects seeded');

  // ── 5. INVOICES ─────────────────────────────────────────────────────────────
  // Helper: upsert invoice + items + event in one shot
  async function upsertInvoice(
    id: string,
    num: string,
    clientId: string,
    projectId: string,
    status: string,
    issue: string,
    due: string,
    lineItems: { desc: string; hsn?: string; qty: number; rate: number; tax: number }[],
    clientStateCode: string,
    notes?: string,
    poNumber?: string,
  ) {
    const calc = gst(lineItems, clientStateCode);
    return prisma.invoice.upsert({
      where: { invoiceNumber: num },
      update: { status, clientId, projectId, issueDate: d(issue), dueDate: d(due), subtotal: calc.subtotal, taxTotal: calc.taxTotal, total: calc.total, notes, poNumber },
      create: {
        id,
        invoiceNumber: num,
        clientId,
        projectId,
        status,
        issueDate: d(issue),
        dueDate: d(due),
        subtotal: calc.subtotal,
        taxTotal: calc.taxTotal,
        total: calc.total,
        notes,
        poNumber,
        createdById: manager.id,
        items: { create: calc.items },
        events: { create: { eventType: 'CREATED', actorId: manager.id } },
      },
    });
  }

  // ── FY 2025-26 Invoices ──────────────────────────────────────────────────────

  const inv2526_01 = await upsertInvoice('inv-2526-01', 'INV/2526/0001', cTechNova.id, pBrandIdentity.id, 'PAID',     '2025-04-05', '2025-05-05',
    [{ desc: 'Brand Strategy & Research',       qty: 1, rate: 80000, tax: 18 },
     { desc: 'Logo & Visual Identity Design',   qty: 1, rate: 45000, tax: 18 }], '27', 'Phase 1 — Brand Foundation', 'PO-TN-2025-001');

  const inv2526_02 = await upsertInvoice('inv-2526-02', 'INV/2526/0002', cBlueHorizon.id, pInfluencerQ1.id, 'PAID',   '2025-05-01', '2025-06-15',
    [{ desc: 'Influencer Identification & Outreach', qty: 1,  rate: 50000, tax: 18 },
     { desc: 'Campaign Management & Reporting',      qty: 1,  rate: 40000, tax: 18 }], '07', 'Q1 Influencer Campaign — Phase 1');

  const inv2526_03 = await upsertInvoice('inv-2526-03', 'INV/2526/0003', cStellar.id, pAppMarketing.id, 'PAID',       '2025-06-01', '2025-07-01',
    [{ desc: 'App Store Optimisation (ASO)',    qty: 1,  rate: 35000, tax: 18 },
     { desc: 'Performance Marketing Setup',     qty: 1,  rate: 55000, tax: 18 }], '29', 'ASO + PPC Setup');

  const inv2526_04 = await upsertInvoice('inv-2526-04', 'INV/2526/0004', cTechNova.id, pSocialRetainer.id, 'PAID',    '2025-07-01', '2025-07-31',
    [{ desc: 'Social Media Management — July 2025', qty: 1, rate: 75000, tax: 18 }], '27', 'Monthly retainer — July 2025');

  const inv2526_05 = await upsertInvoice('inv-2526-05', 'INV/2526/0005', cGreenLeaf.id, pWebsiteRedesign.id, 'PAID',  '2025-08-10', '2025-09-10',
    [{ desc: 'UX Research & Wireframing',       qty: 1,  rate: 40000, tax: 18 },
     { desc: 'UI Design — Homepage & Category', qty: 1,  rate: 60000, tax: 18 }], '24', 'Website Phase 1 — Design');

  const inv2526_06 = await upsertInvoice('inv-2526-06', 'INV/2526/0006', cApex.id, pFinanceCampaign.id, 'PAID',       '2025-09-01', '2025-10-31',
    [{ desc: 'Campaign Strategy & Positioning', qty: 1,  rate: 90000, tax: 18 },
     { desc: 'Creative Production — 3 Videos',  qty: 3,  rate: 25000, tax: 18 }], '07', 'Brand Campaign — Phase 1 Strategy');

  const inv2526_07 = await upsertInvoice('inv-2526-07', 'INV/2526/0007', cBlueHorizon.id, pDigitalRetainer.id, 'PAID','2025-10-01', '2025-11-15',
    [{ desc: 'Digital Marketing Retainer — Oct 2025', qty: 1, rate: 60000, tax: 18 }], '07', 'Monthly retainer — October 2025');

  const inv2526_08 = await upsertInvoice('inv-2526-08', 'INV/2526/0008', cStellar.id, pSeoRetainer.id, 'OVERDUE',     '2025-11-01', '2025-12-01',
    [{ desc: 'SEO Audit & Strategy Report',    qty: 1,  rate: 28000, tax: 18 },
     { desc: 'On-Page Optimisation — 20 pages', qty: 20, rate: 800,  tax: 18 }], '29');

  const inv2526_09 = await upsertInvoice('inv-2526-09', 'INV/2526/0009', cGreenLeaf.id, pContentRetainer.id, 'PART_PAID','2025-12-01', '2026-01-15',
    [{ desc: 'Content Marketing Retainer — Dec 2025', qty: 1, rate: 40000, tax: 18 },
     { desc: 'Blog Posts — 8 Articles',               qty: 8, rate: 3500,  tax: 18 }], '24');

  const inv2526_10 = await upsertInvoice('inv-2526-10', 'INV/2526/0010', cApex.id, pFinanceCampaign.id, 'OVERDUE',    '2026-01-05', '2026-02-05',
    [{ desc: 'Media Buying & Ad Management — Jan',    qty: 1, rate: 120000, tax: 18 },
     { desc: 'Performance Report & Insights Deck',    qty: 1, rate: 15000,  tax: 18 }], '07');

  const inv2526_11 = await upsertInvoice('inv-2526-11', 'INV/2526/0011', cMumbaiC.id, pCreativeRetainer.id, 'PAID',   '2026-02-01', '2026-03-03',
    [{ desc: 'Creative Services Retainer — Feb 2026', qty: 1, rate: 55000, tax: 18 }], '27', 'Monthly retainer — February 2026');

  const inv2526_12 = await upsertInvoice('inv-2526-12', 'INV/2526/0012', cBlrTech.id, pTechCampaign.id, 'OVERDUE',   '2026-03-01', '2026-04-01',
    [{ desc: 'Go-To-Market Strategy',             qty: 1, rate: 45000, tax: 18 },
     { desc: 'Digital Campaign Setup & Launch',   qty: 1, rate: 35000, tax: 18 }], '29');

  const inv2526_13 = await upsertInvoice('inv-2526-13', 'INV/2526/0013', cBlueHorizon.id, pInfluencerQ1.id, 'WRITTEN_OFF', '2025-07-01', '2025-08-01',
    [{ desc: 'Influencer Campaign — Phase 2',     qty: 1, rate: 70000, tax: 18 }], '07', 'Written off — client dispute resolved');

  console.log('✅ FY 2526 invoices seeded');

  // ── FY 2026-27 Invoices ──────────────────────────────────────────────────────

  const inv2627_01 = await upsertInvoice('inv-2627-01', 'INV/2627/0001', cTechNova.id, pSocialRetainer.id, 'PAID',    '2026-04-01', '2026-05-01',
    [{ desc: 'Social Media Management — Apr 2026', qty: 1, rate: 75000, tax: 18 }], '27', 'Monthly retainer — April 2026');

  const inv2627_02 = await upsertInvoice('inv-2627-02', 'INV/2627/0002', cBlueHorizon.id, pDigitalRetainer.id, 'OVERDUE','2026-04-10', '2026-05-10',
    [{ desc: 'Digital Marketing Retainer — Apr 2026', qty: 1, rate: 60000, tax: 18 },
     { desc: 'Monthly Performance Report',            qty: 1, rate: 8000,  tax: 18 }], '07');

  const inv2627_03 = await upsertInvoice('inv-2627-03', 'INV/2627/0003', cStellar.id, pSeoRetainer.id, 'PART_PAID',  '2026-05-01', '2026-06-01',
    [{ desc: 'SEO Retainer — May 2026',           qty: 1, rate: 45000, tax: 18 },
     { desc: 'Link Building — 10 High-DA Links',  qty: 10, rate: 2000, tax: 18 }], '29');

  const inv2627_04 = await upsertInvoice('inv-2627-04', 'INV/2627/0004', cGreenLeaf.id, pContentRetainer.id, 'OVERDUE','2026-05-05', '2026-06-05',
    [{ desc: 'Content Marketing Retainer — May',  qty: 1, rate: 40000, tax: 18 },
     { desc: 'Social Media Graphics — 20 posts',  qty: 20, rate: 1200, tax: 18 }], '24');

  const inv2627_05 = await upsertInvoice('inv-2627-05', 'INV/2627/0005', cApex.id, pFinanceCampaign.id, 'SENT',       '2026-05-15', '2026-07-15',
    [{ desc: 'Media Buying — May-Jun 2026',       qty: 1, rate: 150000, tax: 18 },
     { desc: 'Creative Refresh — 5 Assets',       qty: 5, rate: 12000,  tax: 18 }], '07', 'Q1 FY27 Campaign Execution');

  const inv2627_06 = await upsertInvoice('inv-2627-06', 'INV/2627/0006', cTechNova.id, pSocialRetainer.id, 'SENT',    '2026-06-01', '2026-07-01',
    [{ desc: 'Social Media Management — Jun 2026', qty: 1, rate: 75000, tax: 18 }], '27', 'Monthly retainer — June 2026');

  const inv2627_07 = await upsertInvoice('inv-2627-07', 'INV/2627/0007', cSunrise.id, pBrandLaunch.id, 'SENT',        '2026-06-05', '2026-07-05',
    [{ desc: 'Brand Launch Strategy & Positioning', qty: 1, rate: 85000, tax: 18 },
     { desc: 'Launch Event Creative Assets',        qty: 1, rate: 40000, tax: 18 }], '27', 'Brand Launch — Phase 1');

  const inv2627_08 = await upsertInvoice('inv-2627-08', 'INV/2627/0008', cMumbaiC.id, pCreativeRetainer.id, 'READY_TO_SEND', '2026-06-01', '2026-07-01',
    [{ desc: 'Creative Services Retainer — Jun 2026', qty: 1, rate: 55000, tax: 18 }], '27', 'Monthly retainer — June 2026');

  const inv2627_09 = await upsertInvoice('inv-2627-09', 'INV/2627/0009', cGreenLeaf.id, pWebsiteRedesign.id, 'PENDING_APPROVAL','2026-06-08', '2026-07-08',
    [{ desc: 'Website Development — Frontend Build', qty: 1, rate: 90000, tax: 18 },
     { desc: 'CMS Integration & Testing',            qty: 1, rate: 25000, tax: 18 }], '24', 'Website Phase 2 — Development');

  const inv2627_10 = await upsertInvoice('inv-2627-10', 'INV/2627/0010', cBlrTech.id, pTechCampaign.id, 'PENDING_APPROVAL','2026-06-08', '2026-07-08',
    [{ desc: 'Performance Marketing — Google & Meta', qty: 1, rate: 65000, tax: 18 },
     { desc: 'A/B Testing & Optimisation',            qty: 1, rate: 20000, tax: 18 }], '29');

  const inv2627_11 = await upsertInvoice('inv-2627-11', 'INV/2627/0011', cSunrise.id, pBrandLaunch.id, 'PENDING_APPROVAL', '2026-06-10', '2026-07-10',
    [{ desc: 'Influencer Partnership Management',  qty: 1, rate: 55000, tax: 18 },
     { desc: 'Social Media Launch Campaign',       qty: 1, rate: 45000, tax: 18 }], '27');

  const inv2627_12 = await upsertInvoice('inv-2627-12', 'INV/2627/0012', cBlrTech.id, pTechCampaign.id, 'DRAFT',      '2026-06-12', '2026-07-12',
    [{ desc: 'Programmatic Advertising Setup',    qty: 1, rate: 40000, tax: 18 },
     { desc: 'Audience Research & Segmentation',  qty: 1, rate: 18000, tax: 18 }], '29');

  const inv2627_13 = await upsertInvoice('inv-2627-13', 'INV/2627/0013', cStellar.id, pAppMarketing.id, 'DRAFT',      '2026-06-12', '2026-07-12',
    [{ desc: 'App Retargeting Campaign Design',   qty: 1, rate: 32000, tax: 18 },
     { desc: 'Push Notification Strategy',        qty: 1, rate: 15000, tax: 18 }], '29');

  const inv2627_14 = await upsertInvoice('inv-2627-14', 'INV/2627/0014', cTechNova.id, pBrandIdentity.id, 'CANCELLED','2026-04-15', '2026-05-15',
    [{ desc: 'Brand Collateral Design — Print Kit', qty: 1, rate: 35000, tax: 18 }], '27');

  const inv2627_15 = await upsertInvoice('inv-2627-15', 'INV/2627/0015', cApex.id, pFinanceCampaign.id, 'PART_PAID', '2026-04-20', '2026-06-01',
    [{ desc: 'Q4 FY26 Campaign — Final Settlement', qty: 1, rate: 130000, tax: 18 },
     { desc: 'Analytics & Attribution Report',      qty: 1, rate: 20000,  tax: 18 }], '07', 'Final campaign billing');

  console.log('✅ FY 2627 invoices seeded');

  // ── 6. STATUS EVENTS for non-DRAFT invoices ──────────────────────────────────
  // Resolve actual IDs from DB (upsert by invoiceNumber may use existing IDs)
  const invByNum = async (num: string) => {
    const inv = await prisma.invoice.findUnique({ where: { invoiceNumber: num } });
    return inv?.id ?? null;
  };

  const statusEvents: { num: string; events: { type: string; actor: string }[] }[] = [
    { num: 'INV/2526/0001', events: [{ type: 'SENT', actor: manager.id }, { type: 'PAID', actor: director.id }] },
    { num: 'INV/2526/0002', events: [{ type: 'SENT', actor: manager.id }, { type: 'PAID', actor: director.id }] },
    { num: 'INV/2526/0003', events: [{ type: 'SENT', actor: manager.id }, { type: 'PAID', actor: manager.id }] },
    { num: 'INV/2526/0004', events: [{ type: 'SENT', actor: manager.id }, { type: 'PAID', actor: manager.id }] },
    { num: 'INV/2526/0005', events: [{ type: 'SENT', actor: manager.id }, { type: 'PAID', actor: director.id }] },
    { num: 'INV/2526/0006', events: [{ type: 'SUBMITTED_FOR_APPROVAL', actor: manager.id }, { type: 'APPROVED', actor: director.id }, { type: 'SENT', actor: manager.id }, { type: 'PAID', actor: director.id }] },
    { num: 'INV/2526/0007', events: [{ type: 'SENT', actor: manager.id }, { type: 'PAID', actor: manager.id }] },
    { num: 'INV/2526/0008', events: [{ type: 'SUBMITTED_FOR_APPROVAL', actor: subMgr.id }, { type: 'APPROVED', actor: director.id }, { type: 'SENT', actor: manager.id }] },
    { num: 'INV/2526/0009', events: [{ type: 'SENT', actor: manager.id }, { type: 'PAYMENT_RECORDED', actor: manager.id }] },
    { num: 'INV/2526/0010', events: [{ type: 'SUBMITTED_FOR_APPROVAL', actor: manager.id }, { type: 'APPROVED', actor: director.id }, { type: 'SENT', actor: manager.id }] },
    { num: 'INV/2526/0011', events: [{ type: 'SENT', actor: manager.id }, { type: 'PAID', actor: manager.id }] },
    { num: 'INV/2526/0012', events: [{ type: 'SENT', actor: subMgr.id }] },
    { num: 'INV/2526/0013', events: [{ type: 'SENT', actor: manager.id }, { type: 'WRITTEN_OFF', actor: director.id }] },
    { num: 'INV/2627/0001', events: [{ type: 'SENT', actor: manager.id }, { type: 'PAID', actor: manager.id }] },
    { num: 'INV/2627/0002', events: [{ type: 'SENT', actor: manager.id }] },
    { num: 'INV/2627/0003', events: [{ type: 'SENT', actor: subMgr.id }, { type: 'PAYMENT_RECORDED', actor: manager.id }] },
    { num: 'INV/2627/0004', events: [{ type: 'SENT', actor: manager.id }] },
    { num: 'INV/2627/0005', events: [{ type: 'SUBMITTED_FOR_APPROVAL', actor: manager.id }, { type: 'APPROVED', actor: director.id }, { type: 'SENT', actor: manager.id }] },
    { num: 'INV/2627/0006', events: [{ type: 'SENT', actor: manager.id }] },
    { num: 'INV/2627/0007', events: [{ type: 'SUBMITTED_FOR_APPROVAL', actor: subMgr.id }, { type: 'APPROVED', actor: director.id }, { type: 'SENT', actor: manager.id }] },
    { num: 'INV/2627/0008', events: [{ type: 'SUBMITTED_FOR_APPROVAL', actor: manager.id }, { type: 'APPROVED', actor: director.id }] },
    { num: 'INV/2627/0009', events: [{ type: 'SUBMITTED_FOR_APPROVAL', actor: subMgr.id }] },
    { num: 'INV/2627/0010', events: [{ type: 'SUBMITTED_FOR_APPROVAL', actor: manager.id }] },
    { num: 'INV/2627/0011', events: [{ type: 'SUBMITTED_FOR_APPROVAL', actor: subMgr.id }] },
    { num: 'INV/2627/0014', events: [{ type: 'CANCELLED', actor: manager.id }] },
    { num: 'INV/2627/0015', events: [{ type: 'SUBMITTED_FOR_APPROVAL', actor: manager.id }, { type: 'APPROVED', actor: director.id }, { type: 'SENT', actor: manager.id }, { type: 'PAYMENT_RECORDED', actor: manager.id }] },
  ];

  for (const { num, events } of statusEvents) {
    const invoiceId = await invByNum(num);
    if (!invoiceId) continue;
    for (const ev of events) {
      const exists = await prisma.invoiceEvent.findFirst({ where: { invoiceId, eventType: ev.type } });
      if (!exists) {
        await prisma.invoiceEvent.create({ data: { invoiceId, eventType: ev.type, actorId: ev.actor } });
      }
    }
  }

  console.log('✅ Invoice events seeded');

  // ── 7. PAYMENTS ──────────────────────────────────────────────────────────────
  const paymentsData = [
    // Full payments (PAID invoices)
    { ref: 'NEFT/2025/05/001', invNum: 'INV/2526/0001', amount: inv2526_01.total,  tds: 0,     cert: null,       date: '2025-05-03', method: 'BANK_TRANSFER' },
    { ref: 'NEFT/2025/06/042', invNum: 'INV/2526/0002', amount: inv2526_02.total,  tds: 0,     cert: null,       date: '2025-06-10', method: 'BANK_TRANSFER' },
    { ref: 'RTGS/2025/06/091', invNum: 'INV/2526/0003', amount: inv2526_03.total - 10620, tds: 10620, cert: 'TDS/2526/STE/001', date: '2025-06-28', method: 'BANK_TRANSFER' },
    { ref: 'UPI/TN/202507/1',  invNum: 'INV/2526/0004', amount: inv2526_04.total,  tds: 0,     cert: null,       date: '2025-07-28', method: 'UPI' },
    { ref: 'NEFT/2025/09/015', invNum: 'INV/2526/0005', amount: inv2526_05.total,  tds: 0,     cert: null,       date: '2025-09-08', method: 'BANK_TRANSFER' },
    { ref: 'RTGS/2025/10/033', invNum: 'INV/2526/0006', amount: inv2526_06.total - 25920, tds: 25920, cert: 'TDS/2526/APEX/001', date: '2025-10-25', method: 'RTGS' },
    { ref: 'CHQ/BH/2025/441',  invNum: 'INV/2526/0007', amount: inv2526_07.total,  tds: 0,     cert: null,       date: '2025-11-12', method: 'CHEQUE' },
    { ref: 'NEFT/2026/02/077', invNum: 'INV/2526/0011', amount: inv2526_11.total,  tds: 0,     cert: null,       date: '2026-02-28', method: 'BANK_TRANSFER' },
    { ref: 'UPI/TN/202604/2',  invNum: 'INV/2627/0001', amount: inv2627_01.total,  tds: 0,     cert: null,       date: '2026-04-29', method: 'UPI' },
    // Partial payments (PART_PAID)
    { ref: 'NEFT/2026/01/003', invNum: 'INV/2526/0009', amount: 35400,             tds: 0,     cert: null,       date: '2026-01-20', method: 'BANK_TRANSFER' },
    { ref: 'UPI/ST/202606/1',  invNum: 'INV/2627/0003', amount: 30000,             tds: 0,     cert: null,       date: '2026-06-05', method: 'UPI' },
    { ref: 'RTGS/2026/05/011', invNum: 'INV/2627/0015', amount: 94400,             tds: 17700, cert: 'TDS/2627/APEX/001', date: '2026-05-10', method: 'RTGS' },
  ];

  for (const p of paymentsData) {
    const invoiceId = await invByNum(p.invNum);
    if (!invoiceId) continue;
    const exists = await prisma.payment.findFirst({ where: { invoiceId, referenceNumber: p.ref } });
    if (!exists) {
      await prisma.payment.create({
        data: {
          invoiceId,
          amount: p.amount,
          tdsAmount: p.tds,
          tdsCertNumber: p.cert ?? undefined,
          paymentDate: d(p.date),
          method: p.method,
          referenceNumber: p.ref,
          recordedById: manager.id,
        },
      });
    }
  }

  console.log('✅ Payments seeded');

  // ── 8. PURCHASE ORDERS ───────────────────────────────────────────────────────
  const pos = [
    { invNum: 'INV/2526/0001', poNum: 'PO-TN-2025-001',   poDate: '2025-04-02', poVal: 147200 },
    { invNum: 'INV/2526/0006', poNum: 'PO-APEX-2025-001', poDate: '2025-08-25', poVal: 460260 },
    { invNum: 'INV/2627/0005', poNum: 'PO-APEX-2026-001', poDate: '2026-05-10', poVal: 248640 },
    { invNum: 'INV/2627/0009', poNum: 'PO-GL-2026-001',   poDate: '2026-06-05', poVal: 135980 },
  ];

  for (const po of pos) {
    const invoiceId = await invByNum(po.invNum);
    if (!invoiceId) continue;
    const exists = await prisma.purchaseOrder.findFirst({ where: { invoiceId, poNumber: po.poNum } });
    if (!exists) {
      await prisma.purchaseOrder.create({
        data: { invoiceId, poNumber: po.poNum, poDate: d(po.poDate), poValue: po.poVal },
      });
    }
  }

  console.log('✅ Purchase orders seeded');

  // ── 9. ESTIMATES ─────────────────────────────────────────────────────────────
  async function upsertEstimate(
    id: string, num: string, clientId: string, projectId: string, status: string,
    validUntil: string,
    lineItems: { desc: string; qty: number; rate: number; tax: number }[],
    clientState: string, notes?: string,
  ) {
    const calc = gst(lineItems, clientState);
    return prisma.estimate.upsert({
      where: { estimateNumber: num },
      update: { status },
      create: {
        id,
        estimateNumber: num,
        clientId,
        projectId,
        status,
        validUntil: d(validUntil),
        subtotal: calc.subtotal,
        taxTotal: calc.taxTotal,
        total: calc.total,
        notes,
        createdById: manager.id,
        items: { create: calc.items },
      },
    });
  }

  await upsertEstimate('est-01', 'EST/2526/0001', cTechNova.id, pBrandIdentity.id, 'ACCEPTED', '2025-04-01',
    [{ desc: 'Brand Strategy Consulting', qty: 1, rate: 80000, tax: 18 },
     { desc: 'Logo & Identity Design',    qty: 1, rate: 45000, tax: 18 },
     { desc: 'Brand Guidelines Document', qty: 1, rate: 25000, tax: 18 }], '27', 'Phase 1 estimate — approved');

  await upsertEstimate('est-02', 'EST/2526/0002', cBlueHorizon.id, pInfluencerQ1.id, 'ACCEPTED', '2025-04-15',
    [{ desc: 'Influencer Campaign Strategy', qty: 1, rate: 50000, tax: 18 },
     { desc: 'Campaign Management',          qty: 1, rate: 40000, tax: 18 }], '07');

  await upsertEstimate('est-03', 'EST/2526/0003', cStellar.id, pAppMarketing.id, 'ACCEPTED', '2025-05-20',
    [{ desc: 'App Store Optimisation',       qty: 1, rate: 35000, tax: 18 },
     { desc: 'Performance Marketing Setup',  qty: 1, rate: 55000, tax: 18 }], '29');

  await upsertEstimate('est-04', 'EST/2526/0004', cGreenLeaf.id, pWebsiteRedesign.id, 'ACCEPTED', '2025-07-30',
    [{ desc: 'UX Research & Wireframing',    qty: 1, rate: 40000, tax: 18 },
     { desc: 'UI Design — Full Website',     qty: 1, rate: 85000, tax: 18 },
     { desc: 'Frontend Development',         qty: 1, rate: 90000, tax: 18 }], '24');

  await upsertEstimate('est-05', 'EST/2526/0005', cApex.id, pFinanceCampaign.id, 'SENT', '2026-06-30',
    [{ desc: 'Q2 FY27 Campaign Planning',    qty: 1, rate: 95000,  tax: 18 },
     { desc: 'Creative Asset Production',    qty: 5, rate: 20000,  tax: 18 },
     { desc: 'Media Planning & Buying',      qty: 1, rate: 200000, tax: 18 }], '07', 'Q2 campaign proposal');

  await upsertEstimate('est-06', 'EST/2627/0001', cSunrise.id, pBrandLaunch.id, 'SENT', '2026-07-15',
    [{ desc: 'Brand Launch Event Management', qty: 1, rate: 120000, tax: 18 },
     { desc: 'PR & Media Coverage Package',   qty: 1, rate: 80000,  tax: 18 }], '27');

  await upsertEstimate('est-07', 'EST/2627/0002', cBlrTech.id, pTechCampaign.id, 'DRAFT', '2026-07-30',
    [{ desc: 'Q2 Performance Marketing Plan', qty: 1, rate: 70000, tax: 18 },
     { desc: 'Landing Page Optimisation',     qty: 3, rate: 15000, tax: 18 }], '29');

  await upsertEstimate('est-08', 'EST/2526/0006', cMumbaiC.id, pCreativeRetainer.id, 'EXPIRED', '2025-09-30',
    [{ desc: 'Annual Creative Retainer Plan', qty: 1, rate: 600000, tax: 18 }], '27', 'Annual retainer proposal — not accepted');

  console.log('✅ Estimates seeded');

  // ── 10. CREDIT NOTES ─────────────────────────────────────────────────────────
  const cns = [
    { num: 'CN/2526/0001', invNum: 'INV/2526/0003', type: 'PARTIAL_CREDIT', reason: 'Client reported duplicate charge on performance marketing setup — agreed to waive ₹5,000.', amount: 5900,  status: 'ISSUED', refAmt: 5900,  refDate: '2025-07-15' },
    { num: 'CN/2526/0002', invNum: 'INV/2526/0013', type: 'FULL_REVERSAL',  reason: 'Invoice written off after client dispute — full reversal issued.',                           amount: 82600, status: 'ISSUED', refAmt: null,  refDate: null },
    { num: 'CN/2627/0001', invNum: 'INV/2627/0014', type: 'FULL_REVERSAL',  reason: 'Project cancelled by client before commencement — full credit note issued.',               amount: 41300, status: 'ISSUED', refAmt: 41300, refDate: '2026-05-01' },
  ];

  for (const cn of cns) {
    const invoiceId = await invByNum(cn.invNum);
    if (!invoiceId) continue;
    const exists = await prisma.creditNote.findFirst({ where: { cnNumber: cn.num } });
    if (!exists) {
      await prisma.creditNote.create({
        data: {
          cnNumber: cn.num,
          invoiceId,
          type: cn.type,
          reason: cn.reason,
          amount: cn.amount,
          status: cn.status,
          refundAmount: cn.refAmt ?? undefined,
          refundDate: cn.refDate ? d(cn.refDate) : undefined,
          issuedById: director.id,
        },
      });
    }
  }

  console.log('✅ Credit notes seeded');

  // ── 11. REMINDER LOGS ────────────────────────────────────────────────────────
  const reminderData = [
    { invNum: 'INV/2526/0008', type: 'OVERDUE_3',  date: '2025-12-04', email: cStellar.contactEmail },
    { invNum: 'INV/2526/0008', type: 'OVERDUE_7',  date: '2025-12-08', email: cStellar.contactEmail },
    { invNum: 'INV/2526/0008', type: 'OVERDUE_14', date: '2025-12-15', email: cStellar.contactEmail },
    { invNum: 'INV/2526/0009', type: 'OVERDUE_3',  date: '2026-01-18', email: cGreenLeaf.contactEmail },
    { invNum: 'INV/2526/0010', type: 'OVERDUE_3',  date: '2026-02-08', email: cApex.contactEmail },
    { invNum: 'INV/2526/0010', type: 'OVERDUE_7',  date: '2026-02-12', email: cApex.contactEmail },
    { invNum: 'INV/2526/0012', type: 'OVERDUE_3',  date: '2026-04-04', email: cBlrTech.contactEmail },
    { invNum: 'INV/2627/0002', type: 'OVERDUE_3',  date: '2026-05-13', email: cBlueHorizon.contactEmail },
    { invNum: 'INV/2627/0002', type: 'OVERDUE_7',  date: '2026-05-17', email: cBlueHorizon.contactEmail },
    { invNum: 'INV/2627/0004', type: 'OVERDUE_3',  date: '2026-06-08', email: cGreenLeaf.contactEmail },
  ];

  for (const r of reminderData) {
    const invoiceId = await invByNum(r.invNum);
    if (!invoiceId) continue;
    const exists = await prisma.reminderLog.findFirst({ where: { invoiceId, reminderType: r.type, sentAt: d(r.date) } });
    if (!exists) {
      await prisma.reminderLog.create({
        data: { invoiceId, reminderType: r.type, sentAt: d(r.date), emailTo: r.email, status: 'SENT' },
      });
    }
  }

  console.log('✅ Reminder logs seeded');

  // ── 12. SYSTEM SETTINGS ──────────────────────────────────────────────────────
  await prisma.systemSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      data: JSON.stringify({
        agency: {
          name: 'Nexus Marketing Agency Pvt. Ltd.',
          gstin: '27AABCN5678Z1Z9',
          address: '801, Lotus Corporate Park, Western Express Highway',
          city: 'Goregaon East, Mumbai — 400063',
          email: 'billing@nexusmarketing.in',
          phone: '+91 22 4567 8900',
        },
        defaults: {
          paymentTerms: '30',
          gstType: 'IGST',
          notes: 'Payment due within {terms} days. Please quote the invoice number in your bank transfer reference. GST registered agency — GSTIN: 27AABCN5678Z1Z9.',
        },
        notifs: {
          autoReminders: true,
          emailOnSend: true,
          firstReminderDays: 3,
          followUpDays: 7,
        },
      }),
    },
  });

  console.log('✅ System settings seeded');

  // ── SUMMARY ──────────────────────────────────────────────────────────────────
  const counts = await Promise.all([
    prisma.invoice.count(),
    prisma.estimate.count(),
    prisma.payment.count(),
    prisma.creditNote.count(),
    prisma.client.count(),
    prisma.project.count(),
  ]);

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  Seed complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Database:
   ${counts[4]} clients   •  ${counts[5]} projects
   ${counts[0]} invoices  •  ${counts[1]} estimates
   ${counts[2]} payments  •  ${counts[3]} credit notes

👤 Login credentials  (password: Agency@123 for all):
   ceo@agency.com          →  CEO
   director@agency.com     →  Account Director
   podhead@agency.com      →  POD Head
   manager@agency.com      →  Account Manager
   submanager@agency.com   →  Sub Manager

📋 Invoice statuses seeded:
   PAID (9)  •  PART_PAID (3)  •  OVERDUE (5)
   SENT (3)  •  READY_TO_SEND (1)  •  PENDING_APPROVAL (3)
   DRAFT (2)  •  CANCELLED (1)  •  WRITTEN_OFF (1)

💡 Try these flows:
   1. Login as director@agency.com → approve pending invoices in /approvals
   2. Login as manager@agency.com  → create & submit a new invoice for approval
   3. Dashboard → check 5 KPI cards, AR aging bar, Top Overdue Clients
   4. Reports   → AR Aging, Revenue chart, Monthly AR Summary
   5. Settings  → update agency profile (director+ only)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
