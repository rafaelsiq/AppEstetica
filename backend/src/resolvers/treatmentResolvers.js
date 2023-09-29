const Treatment = require('../models/Treatment');

const treatmentResolvers = {
  Query: {
    treatment: () => Treatment.find(),
    treatment: (_, { id }) => Treatment.findById(id),
  },
  Mutation: {
    createTreatment: (_, { input }) => Treatment.create(input),
    updateTreatment: (_, { id, input }) => Treatment.findByIdAndUpdate(id, input, { new: true }),
    deleteTreatment: (_, { id }) => Treatment.findByIdAndRemove(id),
  },
};

module.exports = treatmentResolvers;
