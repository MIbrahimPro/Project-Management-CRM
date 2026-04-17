const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const rows = await prisma.message.findMany({
    where: { content: { contains: 'invited you to join meeting' } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      content: true,
      mediaType: true,
      mediaUrl: true,
      roomId: true,
      createdAt: true
    }
  });

  const out = rows.map((r) => ({
    ...r,
    mediaTypeIsNull: r.mediaType === null,
    mediaUrlIsNull: r.mediaUrl === null
  }));

  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});
