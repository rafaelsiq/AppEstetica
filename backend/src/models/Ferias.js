const mongoose = require('mongoose');

const feriasSchema = new mongoose.Schema({
  clienteId: mongoose.Types.ObjectId,
  dataInicio: String,
  dataFim: String,
});

module.exports = mongoose.model('Ferias', feriasSchema);
