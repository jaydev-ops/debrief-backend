// prisma/seed.js
//
// This script fills the database with some starter data so you can
// test your API without manually creating everything through Postman.
//
// Run it with: npm run db:seed

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── 1. Create a demo user ──────────────────────────────────────────────────
  // We hash the password before saving. NEVER store plain text passwords.
  const hashedPassword = await bcrypt.hash('password123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'demo@debrief.com' },  // upsert = update if exists, create if not
    update: {},
    create: {
      name: 'Demo User',
      email: 'demo@debrief.com',
      password: hashedPassword,
    },
  });

  console.log(`✅ User created: ${user.email}`);

  // ── 2. Create a demo meeting ───────────────────────────────────────────────
  const meeting = await prisma.meeting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      title: 'Q4 Planning Meeting',
      createdById: user.id,
    },
  });

  console.log(`✅ Meeting created: "${meeting.title}"`);

  // ── 3. Create some demo notes ──────────────────────────────────────────────
  await prisma.note.createMany({
    data: [
      {
        content: 'We decided to use AWS for our cloud infrastructure.',
        type: 'decision',
        meetingId: meeting.id,
        authorId: user.id,
      },
      {
        content: 'John will complete the API integration by Friday.',
        type: 'action',
        meetingId: meeting.id,
        authorId: user.id,
      },
      {
        content: 'Production server is returning 500 errors on login.',
        type: 'problem',
        meetingId: meeting.id,
        authorId: user.id,
      },
      {
        content: 'Should we migrate the frontend to Next.js?',
        type: 'discussion',
        meetingId: meeting.id,
        authorId: user.id,
      },
    ],
  });

  console.log('✅ Sample notes created');

  // ── 4. Create some demo chat messages ─────────────────────────────────────
  await prisma.chatMessage.createMany({
    data: [
      {
        text: 'Hey team, let\'s get started!',
        meetingId: meeting.id,
        senderId: user.id,
      },
      {
        text: 'Should we cover the deployment issue first?',
        meetingId: meeting.id,
        senderId: user.id,
      },
    ],
  });

  console.log('✅ Sample chat messages created');
  console.log('\n🎉 Seed complete! Login with: demo@debrief.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
