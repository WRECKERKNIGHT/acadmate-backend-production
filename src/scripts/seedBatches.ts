import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedBatches() {
  console.log('Seeding batches...');

  const batches = [
    { type: 'IN_CLASS_7', name: 'Class 7 In-Class' },
    { type: 'IN_CLASS_8', name: 'Class 8 In-Class' },
    { type: 'IN_CLASS_9', name: 'Class 9 In-Class' },
    { type: 'IN_CLASS_10', name: 'Class 10 In-Class' },
    { type: 'NEET_11', name: 'NEET Class 11' },
    { type: 'NEET_12', name: 'NEET Class 12' },
    { type: 'PCM_11', name: 'PCM Class 11' },
    { type: 'PCM_12', name: 'PCM Class 12' },
  ];

  for (const batch of batches) {
    await prisma.batch.upsert({
      where: { type: batch.type as any },
      update: { name: batch.name },
      create: {
        type: batch.type as any,
        name: batch.name,
      },
    });
    console.log(`✅ Created/Updated batch: ${batch.name}`);
  }

  console.log('✅ Batch seeding completed!');
}

seedBatches()
  .catch((e) => {
    console.error('❌ Error seeding batches:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
