const Atendimento = require('../models/Atendimento');

const atendimentoResolvers = {
  Query: {
    atendimento: () => Atendimento.find(),
    atendimento: (_, { id }) => Atendimento.findById(id),
  },
  Mutation: {
    criarAtendimento: (_, { input }) => Atendimento.create(input),
    atualizarAtendimento: (_, { id, input }) => Atendimento.findByIdAndUpdate(id, input, { new: true }),
    excluirAtendimento: (_, { id }) => Atendimento.findByIdAndRemove(id),
  },
};

module.exports = atendimentoResolvers;
