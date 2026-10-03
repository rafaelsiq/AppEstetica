const Events = require("../models/Events");

const eventsResolvers = {
  Query: {
    events: () => Events.find(),
    event: (_, { id }) => Events.findById(id),
  },
  Mutation: {
    createEvent: (_, { input }) => Events.create(input),
    updateEvent: (_, { id, input }) =>
      Events.findByIdAndUpdate(id, input, { new: true }),
    deleteEvent: (_, { id }) => Events.findByIdAndRemove(id),
  },
};

module.exports = eventsResolvers;
