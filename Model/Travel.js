const mongoose = require('mongoose');

const travelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  AccountNo: { type: String, required: true },
  AccountName: { type: String, required: true },
  Price: { type: Number, required: true },
  TripDate: { type: Date, required: true },
  isActive: { type: Boolean, default: false },
  registrationactive: { type: Boolean, default: true },
  


}, { timestamps: true });

const Travel = mongoose.model('Travel', travelSchema);

module.exports = Travel;
