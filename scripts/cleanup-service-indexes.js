const mongoose = require('mongoose');
require('dotenv').config();

async function cleanupIndexes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hospitalmanagement');
    console.log('Connected to MongoDB');

    // Get the services collection
    const db = mongoose.connection.db;
    const collection = db.collection('services');

    // Drop problematic indexes
    try {
      await collection.dropIndex('serviceId_1');
      console.log('Dropped serviceId_1 index');
    } catch (error) {
      console.log('serviceId_1 index not found or already dropped');
    }

    try {
      await collection.dropIndex('serviceCode_1');
      console.log('Dropped serviceCode_1 index');
    } catch (error) {
      console.log('serviceCode_1 index not found or already dropped');
    }

    // List remaining indexes
    const indexes = await collection.listIndexes().toArray();
    console.log('Remaining indexes:', indexes.map(idx => idx.name));

    console.log('Index cleanup completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during index cleanup:', error);
    process.exit(1);
  }
}

cleanupIndexes();