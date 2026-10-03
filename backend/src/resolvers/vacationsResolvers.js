const Vacations = require("../models/Vacations");
const vacationsResolvers = {
  Query: {
    vacations: () => Vacations.find(),
    vacation: (_, { id }) => Vacations.findById(id),
  },
  Mutation: {
    createVacations: (_, { input }) => Vacations.create(input),
    updateVacations: (_, { id, input }) =>
      Vacations.findByIdAndUpdate(id, input, { new: true }),
    deleteVacations: (_, { id }) => Vacations.findByIdAndRemove(id),
  },
};

module.exports = vacationsResolvers;
