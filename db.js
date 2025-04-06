// db.js
const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://andifab23:tNgwwixDs0Bo5aUj@cluster0.xka9c.mongodb.net/travelBot?retryWrites=true&w=majority&appName=Cluster0';

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Successfully connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
