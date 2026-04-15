# Prisma Query Patterns

## Never Return Sensitive Fields
```typescript
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    name: true,
    email: true,
    role: true,
    profilePicUrl: true,
    // passwordHash: NEVER include this
  },
});
```

## Always Use Transactions for Multi-Table Writes
```typescript
const [project, member, chatRoom] = await prisma.$transaction([
  prisma.project.create({ data: projectData }),
  prisma.projectMember.create({ data: memberData }),
  prisma.chatRoom.create({ data: chatRoomData }),
]);
```

## Pagination Pattern (cursor-based)
```typescript
const items = await prisma.message.findMany({
  where: { roomId },
  take: limit,
  skip: cursor ? 1 : 0,
  cursor: cursor ? { id: cursor } : undefined,
  orderBy: { createdAt: "desc" },
});
```