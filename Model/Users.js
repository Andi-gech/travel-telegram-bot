const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true },
  name: { type: String, required: true },
  travelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Travel' },
  paymentStatus: { type: String, enum: ['pending', 'verified', 'denied'], default: 'pending' },
  screenshot: { type: String },  // File ID of the screenshot (Telegram file ID)
  phoneNumber: { type: String, required: true },
  pickupLocation: { type: String, required: true },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

module.exports = User;
