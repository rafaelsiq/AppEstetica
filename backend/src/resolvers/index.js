const treatmentResolvers = require("./treatmentResolvers");
const clientResolvers = require("./clientResolvers");
const eventsResolvers = require("./eventsResolvers");
const vacationsResolvers = require("./vacationsResolvers");
const serviceResolvers = require("./serviceResolvers");
const workerResolvers = require("./workerResolvers");

const resolvers = [treatmentResolvers, vacationsResolvers, clientResolvers, serviceResolvers, workerResolvers, eventsResolvers];


module.exports = resolvers;