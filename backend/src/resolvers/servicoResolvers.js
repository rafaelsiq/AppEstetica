const Servico = require('../models/Servico'); 

const servicoResolvers = {
  Query: {
    servico: () => Servico.find(),
    servico: (_, { id }) => Servico.findById(id),
  },
  Mutation: {
    criarServico: (_, { input }) => Servico.create(input),
    atualizarServico: (_, { id, input }) => Servico.findByIdAndUpdate(id, input, { new: true }),
    excluirServico: (_, { id }) => Servico.findByIdAndRemove(id),
  },
};

module.exports = servicoResolvers;
