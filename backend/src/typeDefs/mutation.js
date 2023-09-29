const { gql } = require("apollo-server");

const mutation = gql`
  type Mutation {
    createClient(input: ClientInput): Client
    updateClient(id: ID!, input: ClientInput): Client
    deleteClient(id: ID!): Client

    createWorker(input: WorkerInput): Worker
    updateWorker(id: ID!, input: WorkerInput): Worker
    deleteWorker(id: ID!): Worker

    createEvent(input: EventInput): Events
    updateEvent(id: ID!, input: EventInput): Events
    deleteEvent(id: ID!): Events

    createService(input: ServiceInput): Service
    updateService(id: ID!, input: ServiceInput): Service
    deleteService(id: ID!): Service

    createTreatment(input: TreatmentInput): Treatment
    updateTreatment(id: ID!, input: TreatmentInput): Treatment
    deleteTreatment(id: ID!): Treatment

    createVacations(input: VacationsInput): Vacations
    updateVacations(id: ID!, input: VacationsInput): Vacations
    deleteVacations(id: ID!): Vacations
  }
`;

module.exports = mutation;
