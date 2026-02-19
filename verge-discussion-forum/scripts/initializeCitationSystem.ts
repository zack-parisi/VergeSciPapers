import { PrismaClient } from '@prisma/client';
import { citationScheduler } from '../utils/citationScheduler';

const prisma = new PrismaClient();

async function initializeCitationSystem() {
  console.log('Initializing Citation Update System...');

  try {
    // Step 1: Initialize metadata for existing papers
    console.log('Step 1: Creating metadata for existing staff posts...');
    await citationScheduler.initializeExistingPapers();

    // Step 2: Start the scheduler
    console.log('Step 2: Starting citation update scheduler...');
    await citationScheduler.startScheduler(60); // Run every 60 minutes

    // Step 3: Get initial statistics
    const stats = citationScheduler.getStats();
    console.log('Step 3: System statistics:', stats);

    // Step 4: Check database counts
    const staffPostCount = await (prisma as any).staffPost.count();
    const metadataCount = await (prisma as any).citationUpdateMetadata.count();

    console.log('Database Summary:');
    console.log(`  - Total Staff Posts: ${staffPostCount}`);
    console.log(`  - Papers with Metadata: ${metadataCount}`);
    console.log(`  - Papers needing metadata: ${staffPostCount - metadataCount}`);

    console.log('Citation Update System initialized successfully!');
    console.log('');
    console.log('System Features:');
    console.log('  - Activity-based citation updates');
    console.log('  - Priority-based scheduling');
    console.log('  - Rate-limited API calls');
    console.log('  - Automatic velocity calculation');
    console.log('');
    console.log('Next Steps:');
    console.log('  1. User interactions will automatically trigger updates');
    console.log('  2. Scheduler runs every 60 minutes');
    console.log('  3. Monitor logs for update activity');
    console.log('  4. Check /api/staff-posts/activity for activity stats');

  } catch (error) {
    console.error('Error initializing citation system:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the initialization
if (require.main === module) {
  initializeCitationSystem()
    .then(() => {
      console.log('Initialization complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Initialization failed:', error);
      process.exit(1);
    });
}

export { initializeCitationSystem }; 