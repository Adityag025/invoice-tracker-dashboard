import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database…');

  const adminHash = await bcrypt.hash('admin123', 12);
  const managerHash = await bcrypt.hash('manager123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@agency.com' },
    update: {},
    create: { name: 'Admin User', email: 'admin@agency.com', passwordHash: adminHash, role: 'ADMIN' },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@agency.com' },
    update: {},
    create: { name: 'Account Manager', email: 'manager@agency.com', passwordHash: managerHash, role: 'MANAGER' },
  });

  const client1 = await prisma.client.upsert({
    where: { id: 'seed-client-1' },
    update: {},
    create: {
      id: 'seed-client-1',
      name: 'Acme Technologies Pvt. Ltd.',
      gstin: '27AABCA1234A1Z5',
      stateCode: '27',
      billingTerms: 'NET_30',
      contactName: 'Rahul Sharma',
      contactEmail: 'rahul@acme.com',
      contactPhone: '+91 98765 43210',
      address: '101, Nariman Point, Mumbai 400021',
    },
  });

  const client2 = await prisma.client.upsert({
    where: { id: 'seed-client-2' },
    update: {},
    create: {
      id: 'seed-client-2',
      name: 'Delhi Digital Solutions',
      gstin: '07AABCD5678B1Z2',
      stateCode: '07',
      billingTerms: 'NET_45',
      contactName: 'Priya Gupta',
      contactEmail: 'priya@delhidigital.in',
      address: '22, Connaught Place, New Delhi 110001',
    },
  });

  const project1 = await prisma.project.upsert({
    where: { id: 'seed-project-1' },
    update: {},
    create: {
      id: 'seed-project-1',
      clientId: client1.id,
      name: 'Brand Identity Redesign',
      type: 'ONE_OFF',
      budget: 250000,
    },
  });

  const project2 = await prisma.project.upsert({
    where: { id: 'seed-project-2' },
    update: {},
    create: {
      id: 'seed-project-2',
      clientId: client1.id,
      name: 'Monthly Social Media Management',
      type: 'RETAINER',
      budget: 50000,
    },
  });

  console.log(`
✅ Seed complete!

Users:
  admin@agency.com    / admin123    (ADMIN)
  manager@agency.com  / manager123  (MANAGER)

Clients:
  ${client1.name} (intra-state: CGST+SGST)
  ${client2.name} (inter-state: IGST)

Projects:
  ${project1.name}
  ${project2.name}
`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
