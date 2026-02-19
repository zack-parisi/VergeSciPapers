const { MongoClient } = require('mongodb');
require('dotenv').config();

const mongoUri = process.env.MONGO_URI;
const papersDbName = 'verge_neuro_lit_topics';
const userDataDbName = 'user_data';

let mongoClient;

async function connectToMongo() {
  try {
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    console.log('Connected to MongoDB');
    return {
      userDataDb: mongoClient.db(userDataDbName),
      papersDb: mongoClient.db(papersDbName)
    };
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

async function createCollections(dbs) {
  console.log('Creating collections...');

  // User Data Database Collections
  const userDataCollections = [
    'users',
    'staff_posts',
    'likes',
    'bookmarks',
    'comments',
    'reposts',
    'saved_categories',
    'saved_notes',
    'connections',
    'connection_requests',
    'grants',
    'subfields'
  ];

  // Papers Database Collections (already exist, just verify)
  const papersCollections = [
    'papers_staging',
    'topics'
  ];

  console.log(`Creating collections in ${userDataDbName} database...`);
  for (const collectionName of userDataCollections) {
    try {
      await dbs.userDataDb.createCollection(collectionName);
      console.log(`Created collection: ${collectionName}`);
    } catch (error) {
      if (error.code === 48) { // Collection already exists
        console.log(`Collection already exists: ${collectionName}`);
      } else {
        console.error(`Error creating collection ${collectionName}:`, error);
      }
    }
  }

  console.log(`Verifying collections in ${papersDbName} database...`);
  for (const collectionName of papersCollections) {
    try {
      const collections = await dbs.papersDb.listCollections({ name: collectionName }).toArray();
      if (collections.length > 0) {
        console.log(`Collection exists: ${collectionName}`);
      } else {
        console.log(`Collection not found: ${collectionName} (this is expected if papers data hasn't been migrated yet)`);
      }
    } catch (error) {
      console.error(`Error checking collection ${collectionName}:`, error);
    }
  }
}

async function createIndexes(dbs) {
  console.log('Creating indexes...');

  try {
    // User Data Database Indexes
    const usersCollection = dbs.userDataDb.collection('users');
    const likesCollection = dbs.userDataDb.collection('likes');
    const bookmarksCollection = dbs.userDataDb.collection('bookmarks');
    const commentsCollection = dbs.userDataDb.collection('comments');
    const repostsCollection = dbs.userDataDb.collection('reposts');
    const savedCategoriesCollection = dbs.userDataDb.collection('saved_categories');
    const savedNotesCollection = dbs.userDataDb.collection('saved_notes');
    const connectionsCollection = dbs.userDataDb.collection('connections');
    const connectionRequestsCollection = dbs.userDataDb.collection('connection_requests');
    const grantsCollection = dbs.userDataDb.collection('grants');
    const subfieldsCollection = dbs.userDataDb.collection('subfields');
    const staffPostsCollection = dbs.userDataDb.collection('staff_posts');

    // Users indexes
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await usersCollection.createIndex({ id: 1 }, { unique: true });
    console.log('Users indexes created');

    // Likes indexes
    await likesCollection.createIndex({ userId: 1, targetId: 1, targetType: 1 }, { unique: true });
    await likesCollection.createIndex({ targetId: 1, targetType: 1 });
    await likesCollection.createIndex({ createdAt: -1 });
    console.log('Likes indexes created');

    // Bookmarks indexes
    await bookmarksCollection.createIndex({ userId: 1, targetId: 1, targetType: 1 }, { unique: true });
    await bookmarksCollection.createIndex({ targetId: 1, targetType: 1 });
    await bookmarksCollection.createIndex({ createdAt: -1 });
    console.log('Bookmarks indexes created');

    // Comments indexes
    await commentsCollection.createIndex({ userId: 1 });
    await commentsCollection.createIndex({ targetId: 1, targetType: 1 });
    await commentsCollection.createIndex({ parentId: 1 });
    await commentsCollection.createIndex({ createdAt: -1 });
    console.log('Comments indexes created');

    // Reposts indexes
    await repostsCollection.createIndex({ userId: 1 });
    await repostsCollection.createIndex({ targetId: 1, targetType: 1 });
    await repostsCollection.createIndex({ createdAt: -1 });
    console.log('Reposts indexes created');

    // Saved categories indexes
    await savedCategoriesCollection.createIndex({ userId: 1 });
    await savedCategoriesCollection.createIndex({ name: 1 });
    console.log('Saved categories indexes created');

    // Saved notes indexes
    await savedNotesCollection.createIndex({ userId: 1, targetId: 1, targetType: 1 }, { unique: true });
    await savedNotesCollection.createIndex({ targetId: 1, targetType: 1 });
    console.log('Saved notes indexes created');

    // Connections indexes
    await connectionsCollection.createIndex({ userId: 1, connectionId: 1 }, { unique: true });
    await connectionsCollection.createIndex({ userId: 1 });
    await connectionsCollection.createIndex({ connectionId: 1 });
    console.log('Connections indexes created');

    // Connection requests indexes
    await connectionRequestsCollection.createIndex({ fromUserId: 1, toUserId: 1 }, { unique: true });
    await connectionRequestsCollection.createIndex({ toUserId: 1 });
    await connectionRequestsCollection.createIndex({ fromUserId: 1 });
    console.log('Connection requests indexes created');

    // Staff posts indexes
    await staffPostsCollection.createIndex({ userId: 1 });
    await staffPostsCollection.createIndex({ createdAt: -1 });
    await staffPostsCollection.createIndex({ id: 1 }, { unique: true });
    console.log('Staff posts indexes created');

    // Grants indexes
    await grantsCollection.createIndex({ userId: 1 });
    await grantsCollection.createIndex({ createdAt: -1 });
    await grantsCollection.createIndex({ id: 1 }, { unique: true });
    console.log('Grants indexes created');

    // Subfields indexes
    await subfieldsCollection.createIndex({ name: 1 }, { unique: true });
    await subfieldsCollection.createIndex({ id: 1 }, { unique: true });
    console.log('Subfields indexes created');

    console.log('All indexes created successfully!');
  } catch (error) {
    console.error('Error creating indexes:', error);
    throw error;
  }
}

async function validateSetup(dbs) {
  console.log('Validating setup...');

  // User Data Database Collections
  const userDataCollections = [
    'users', 'staff_posts', 'likes', 'bookmarks', 'comments',
    'reposts', 'saved_categories', 'saved_notes', 'connections',
    'connection_requests', 'grants', 'subfields'
  ];

  console.log(`\n${userDataDbName} Database:`);
  for (const collectionName of userDataCollections) {
    try {
      const collection = dbs.userDataDb.collection(collectionName);
      const count = await collection.countDocuments();
      const indexes = await collection.indexes();
      console.log(`${collectionName}: ${count} documents, ${indexes.length} indexes`);
    } catch (error) {
      console.error(`Error validating ${collectionName}:`, error);
    }
  }

  console.log(`\n${papersDbName} Database:`);
  const papersCollections = ['papers_staging', 'topics'];
  for (const collectionName of papersCollections) {
    try {
      const collection = dbs.papersDb.collection(collectionName);
      const count = await collection.countDocuments();
      const indexes = await collection.indexes();
      console.log(`${collectionName}: ${count} documents, ${indexes.length} indexes`);
    } catch (error) {
      console.error(`Error validating ${collectionName}:`, error);
    }
  }
}

async function main() {
  console.log('Setting up MongoDB for migration...');
  console.log(`User Data Database: ${userDataDbName}`);
  console.log(`Papers Database: ${papersDbName}`);

  try {
    const dbs = await connectToMongo();

    // Create collections
    await createCollections(dbs);

    // Create indexes
    await createIndexes(dbs);

    // Validate setup
    await validateSetup(dbs);

    console.log('\nMongoDB setup completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run the migration script: node scripts/migrate-to-mongodb.js');
    console.log('2. Update your API routes to use MongoDB');
    console.log('3. Test the new functionality');
    console.log('4. Remove Prisma dependencies when ready');
    console.log('');
    console.log('Database Architecture:');
    console.log(`   - ${userDataDbName}: User accounts, interactions, and user-generated content`);
    console.log(`   - ${papersDbName}: Research papers and topics data`);

  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
  }
}

// Run setup
if (require.main === module) {
  main();
}

module.exports = { main };
