const Vacations = require('../models/Vacations'); 
const vacationsResolvers = {
  Query: {
    vacations: () => Vacations.find(),
    vacationsWorker: (_, { atendenteID }) => Vacations.find({ atendenteID }),
  },
  Mutation: {
    createVacations: (_, { input }) => Vacations.create(input),
    updateVacations: (_, { id, input }) => Vacations.findByIdAndUpdate(id, input, { new: true }),
    deleteVacations: (_, { id }) => Vacations.findByIdAndRemove(id),
  },
};

module.exports = vacationsResolvers;
