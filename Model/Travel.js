const mongoose = require('mongoose');

const travelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  AccountNo: { type: String, required: true },
  AccountName: { type: String, required: true },
  Price: { type: Number, required: true },
  isActive: { type: Boolean, default: false },
}, { timestamps: true });

const Travel = mongoose.model('Travel', travelSchema);

module.exports = Travel;
