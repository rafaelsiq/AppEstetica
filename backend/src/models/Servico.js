const mongoose = require('mongoose');

const servicoSchema = new mongoose.Schema({
  titulo: String,
  descricao: String,
  valor: Number,
});

module.exports = mongoose.model('Servico', servicoSchema);
