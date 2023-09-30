const Service = require('../models/Service'); 

const serviceResolvers = {
  Query: {
    service: () => Service.find(),
    service: (_, { id }) => Service.findById(id),
  },
  Mutation: {
    createService: (_, { input }) => Service.create(input),
    updateService: (_, { id, input }) => Service.findByIdAndUpdate(id, input, { new: true }),
    deleteService: (_, { id }) => Service.findByIdAndRemove(id),
  },
};

module.exports = serviceResolvers;
