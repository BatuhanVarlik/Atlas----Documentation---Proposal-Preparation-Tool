import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEPARTMENTS = [
  { name: 'Yönetim', color: '#1E40AF' },
  { name: 'Otomasyon', color: '#0F766E' },
  { name: 'Satış', color: '#7C3AED' },
  { name: 'Mekanik', color: '#BE185D' },
  { name: 'Muhasebe', color: '#0369A1' },
  { name: 'Depo', color: '#4D7C0F' },
];

async function main() {
  console.log('Seed başlıyor...');

  // Önce varsa sil
  await prisma.moduleActivity.deleteMany();
  await prisma.aIReview.deleteMany();
  await prisma.generatedDocument.deleteMany();
  await prisma.documentTemplate.deleteMany();
  await prisma.tank.deleteMany();
  await prisma.dischargeLine.deleteMany();
  await prisma.fillingLine.deleteMany();
  await prisma.valveCluster.deleteMany();
  await prisma.module.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();

  // Departmanları oluştur
  const departments: Record<string, string> = {};
  for (const dept of DEPARTMENTS) {
    const created = await prisma.department.create({ data: dept });
    departments[dept.name] = created.id;
    console.log(`  Departman oluşturuldu: ${dept.name}`);
  }

  // Admin kullanıcı
  const adminPassword = await bcrypt.hash('Admin1234', 12);
  await prisma.user.create({
    data: {
      name: 'Sistem Yöneticisi',
      email: 'admin@apvhemisan.local',
      password: adminPassword,
      role: 'ADMIN',
      departmentId: departments['Yönetim'],
    },
  });
  console.log('  Admin kullanıcı oluşturuldu: admin@apvhemisan.local');

  // Satış müdürü
  const managerPassword = await bcrypt.hash('Manager1234', 12);
  await prisma.user.create({
    data: {
      name: 'Satış Müdürü',
      email: 'satis.mudur@apvhemisan.local',
      password: managerPassword,
      role: 'DEPARTMENT_MANAGER',
      departmentId: departments['Satış'],
    },
  });
  console.log('  Müdür kullanıcı oluşturuldu: satis.mudur@apvhemisan.local');

  // Satış mühendisi
  const memberPassword = await bcrypt.hash('Member1234', 12);
  await prisma.user.create({
    data: {
      name: 'Satış Mühendisi',
      email: 'satis.muhendis@apvhemisan.local',
      password: memberPassword,
      role: 'MEMBER',
      departmentId: departments['Satış'],
    },
  });
  console.log('  Üye kullanıcı oluşturuldu: satis.muhendis@apvhemisan.local');

  console.log('\nSeed tamamlandı!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
