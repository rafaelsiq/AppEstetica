const Worker = require('../models/Worker'); // Importe o modelo Cliente aqui

const workerResolvers = {
  Query: {
    worker: () => Worker.find(),
    worker: (_, { id }) => Worker.findById(id),
  },
  Mutation: {
    createWorker: (_, { input }) => Worker.create(input),
    updateWorker: (_, { id, input }) => Worker.findByIdAndUpdate(id, input, { new: true }),
    deleteWorker: (_, { id }) => Worker.findByIdAndRemove(id),
  },
};

module.exports = workerResolvers;
