const mongoose = require('mongoose');

const atendimentoSchema = new mongoose.Schema({
  clienteId: mongoose.Types.ObjectId,
  servicoId: mongoose.Types.ObjectId,
  data: String,
  avaliacao: Number,
});

module.exports = mongoose.model('Atendimento', atendimentoSchema);
    