const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const result = await prisma.$executeRawUnsafe(`UPDATE "Candidate" SET status = 'UNDER_REVIEW' WHERE status IN ('HR_RECOMMENDED', 'AI_RECOMMENDED')`);
  console.log(`Updated ${result} candidates`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
