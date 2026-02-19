const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestUsers() {
  const testUsers = [
    { id: 'test-user-1', email: 'test1@vergesci.com', passwordHash: 'hashed_password_1' },
    { id: 'test-user-2', email: 'test2@vergesci.com', passwordHash: 'hashed_password_2' },
    { id: 'test-user-3', email: 'test3@vergesci.com', passwordHash: 'hashed_password_3' },
    { id: 'test-user-4', email: 'test4@vergesci.com', passwordHash: 'hashed_password_4' },
    { id: 'test-user-5', email: 'test5@vergesci.com', passwordHash: 'hashed_password_5' },
    { id: 'verge-staff', email: 'staff@vergesci.com', passwordHash: 'hashed_password_staff' },
  ];

  console.log('Creating test users...');

  for (const user of testUsers) {
    try {
      const existingUser = await prisma.user.findUnique({
        where: { id: user.id }
      });

      if (existingUser) {
        console.log(`User ${user.id} already exists, skipping...`);
      } else {
        await prisma.user.create({
          data: user
        });
        console.log(`Created user: ${user.id}`);
      }
    } catch (error) {
      console.error(`Error creating user ${user.id}:`, error.message);
    }
  }

  console.log('Test users creation completed!');
  
  // List all users
  const allUsers = await prisma.user.findMany();
  console.log('\nAll users in database:');
  allUsers.forEach(user => {
    console.log(`- ${user.id}`);
  });
}

createTestUsers()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 