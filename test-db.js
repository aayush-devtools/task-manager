const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const users = await prisma.user.findMany({take: 5});
  const tasks = await prisma.task.findMany({take: 5, orderBy: {createdAt: 'desc'}});
  console.log("USERS:", users);
  console.log("TASKS:", tasks);
}
run().catch(console.error).finally(()=>prisma.$disconnect());
