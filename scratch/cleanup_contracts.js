const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const dupes = await prisma.contract.groupBy({
    by: ['userId'],
    _count: {
      userId: true,
    },
    having: {
      userId: {
        _count: {
          gt: 1,
        },
      },
    },
  });

  if (dupes.length > 0) {
    console.log("Found duplicate contracts for users:", dupes.map(d => d.userId));
    console.log("Cleaning up... keeping only the latest one per user.");

    for (const dupe of dupes) {
      const allForUser = await prisma.contract.findMany({
        where: { userId: dupe.userId },
        orderBy: { updatedAt: 'desc' },
      });

      const toKeep = allForUser[0];
      const toDelete = allForUser.slice(1);

      for (const contract of toDelete) {
        console.log(`Deleting contract ${contract.id} for user ${contract.userId}`);
        // Move versions to the kept contract? No, usually duplicates are mistakes.
        // But let's move versions just in case.
        await prisma.contractVersion.updateMany({
          where: { contractId: contract.id },
          data: { contractId: toKeep.id },
        });
        await prisma.contract.delete({ where: { id: contract.id } });
      }
    }
  } else {
    console.log("No duplicate contracts found.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
