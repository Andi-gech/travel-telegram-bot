// db.js
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;
console.error('Mongo URI:', MONGO_URI); // Log the Mongo URI for debugging
console.error('BOT_TOKEN:', process.env.BOT_TOKEN);
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
