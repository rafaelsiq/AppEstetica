const mongoose = require('mongoose');

const treatmentSchema = new mongoose.Schema({
  clientId: mongoose.Types.ObjectId,
  serviceId: mongoose.Types.ObjectId,
  date: String,
  conter: Number,
});

module.exports = mongoose.model('Treatment', treatmentSchema);
