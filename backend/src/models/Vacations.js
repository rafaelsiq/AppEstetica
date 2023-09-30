const mongoose = require('mongoose');

const vacationsSchema = new mongoose.Schema({
  clienteId: mongoose.Types.ObjectId,
  startDate: String,
  endDate: String,
});

module.exports = mongoose.model('Vacations', vacationsSchema);
