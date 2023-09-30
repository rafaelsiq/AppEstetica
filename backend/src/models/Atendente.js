const mongoose = require('mongoose');

const atendenteSchema = new mongoose.Schema({
  nome: String,
  telefone: String,
  endereco: String,
});

module.exports = mongoose.model('Atendente', atendenteSchema);
