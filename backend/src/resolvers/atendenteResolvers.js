const Atendente = require('../models/Atendente'); // Importe o modelo Cliente aqui

const atendenteResolvers = {
  Query: {
    atendente: () => Atendente.find(),
    atendente: (_, { id }) => Atendente.findById(id),
  },
  Mutation: {
    criarAtendente: (_, { input }) => Atendente.create(input),
    atualizarAtendente: (_, { id, input }) => Atendente.findByIdAndUpdate(id, input, { new: true }),
    excluirAtendente: (_, { id }) => Atendente.findByIdAndRemove(id),
  },
};

module.exports = atendenteResolvers;
