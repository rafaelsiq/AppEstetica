const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: String,
  phone: String,
  address: String,
});

module.exports = mongoose.model('Client', clientSchema);
