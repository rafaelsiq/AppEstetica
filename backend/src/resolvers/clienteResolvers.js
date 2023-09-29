const Cliente = require('../models/Cliente'); // Importe o modelo Cliente aqui

const clienteResolvers = {
  Query: {
    cliente: () => Cliente.find(),
    cliente: (_, { id }) => Cliente.findById(id),
  },
  Mutation: {
    criarCliente: (_, { input }) => Cliente.create(input),
    atualizarCliente: (_, { id, input }) => Cliente.findByIdAndUpdate(id, input, { new: true }),
    excluirCliente: (_, { id }) => Cliente.findByIdAndRemove(id),
  },
};

module.exports = clienteResolvers;
