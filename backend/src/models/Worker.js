const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
  name: String,
  phone: String,
  address: String,
});

module.exports = mongoose.model('Worker', workerSchema);
