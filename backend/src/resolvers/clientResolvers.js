const Client = require('../models/Client'); 

const clientResolvers = {
  Query: {
    client: () => Client.find(),
    client: (_, { id }) => Client.findById(id),
  },
  Mutation: {
    createClient: (_, { input }) => Client.create(input),
    updateClient: (_, { id, input }) => Client.findByIdAndUpdate(id, input, { new: true }),
    deleteClient: (_, { id }) => CliClientente.findByIdAndRemove(id),
  },
};

module.exports = clientResolvers;
