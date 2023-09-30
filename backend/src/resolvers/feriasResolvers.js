const Ferias = require('../models/Ferias'); // Importe o modelo Ferias aqui

const feriasResolvers = {
  Query: {
    ferias: () => Ferias.find(),
    feriasAtendente: (_, { atendenteID }) => Ferias.find({ atendenteID }),
  },
  Mutation: {
    criarFerias: (_, { input }) => Ferias.create(input),
    atualizarFerias: (_, { id, input }) => Ferias.findByIdAndUpdate(id, input, { new: true }),
    excluirFerias: (_, { id }) => Ferias.findByIdAndRemove(id),
  },
};

module.exports = feriasResolvers;
