const { gql } = require("apollo-server");

const query = gql`
  type Query {
    clients: [Client!]!
    client(id: ID!): Client

    services: [Service!]!
    service(id: ID!): Service

    workers: [Worker!]!
    worker(id: ID!): Worker

    treatments: [Treatment!]!
    treatment(id: ID!): Treatment

    vacations: [Vacations!]!
    vacation(id: ID!): Vacations

    events: [Events!]!
    event(id: ID!): Events
  }

  input ClientInput {
    name: String
    phone: String
    address: String
  }

  input EventInput {
    eventId: ID
    startTime: String
    endTime: String
    description: String
    subdescription: String
  }

  input WorkerInput {
    name: String
    phone: String
    address: String
  }

  input TreatmentInput {
    clientId: ID
    serviceId: ID
    date: String
    conter: Int
  } 

  input VacationsInput {
    workerId: ID
    startDate: String
    endDate: String
  }
    
  input ServiceInput {
    title: String
    description: String
    price: Float
  }
`;

module.exports = query;
