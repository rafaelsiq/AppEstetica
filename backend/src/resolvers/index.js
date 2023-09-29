const atendimentoResolvers = require("./atendimentoResolvers");
const clienteResolvers = require("./clienteResolvers");
const feriasResolvers = require("./feriasResolvers");
const servicoResolvers = require("./servicoResolvers");

const resolvers = [atendimentoResolvers, feriasResolvers, clienteResolvers, servicoResolvers];

module.exports = resolvers;