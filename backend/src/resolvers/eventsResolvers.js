const Events = require('../models/Events'); 

const eventsResolvers = {
  Query: {
    event: () => Events.find(),
    events: (_, { atendenteID }) => Events.find({ atendenteID }),
  },
  Mutation: {
    createEvent: (_, { input }) => Events.create(input),
    updateEvent: (_, { id, input }) => Events.findByIdAndUpdate(id, input, { new: true }),
    deleteEvent: (_, { id }) => Events.findByIdAndRemove(id),
  },
};

module.exports = eventsResolvers;
