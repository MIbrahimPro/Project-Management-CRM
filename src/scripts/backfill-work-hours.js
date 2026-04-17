const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function backfillWorkHours() {
  console.log("Starting work hours backfill...");
  
  const users = await prisma.user.findMany({
    where: {
      role: { notIn: ["SUPER_ADMIN", "CLIENT"] },
      OR: [
        { workHoursStart: null },
        { workHoursEnd: null }
      ]
    }
  });

  console.log(`Found ${users.length} users to update.`);

  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        workHoursStart: user.workHoursStart || "19:00",
        workHoursEnd: user.workHoursEnd || "03:00"
      }
    });
    console.log(`Updated ${user.name} (${user.email})`);
  }

  console.log("Backfill complete.");
}

backfillWorkHours()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
