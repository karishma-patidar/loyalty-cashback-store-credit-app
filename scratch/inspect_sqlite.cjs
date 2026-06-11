const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const sessions = await prisma.session.findMany();
    console.log("Sessions:", sessions.map(s => ({ id: s.id, shop: s.shop })));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
