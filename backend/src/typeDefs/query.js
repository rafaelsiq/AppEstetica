const { gql } = require("apollo-server");

const query = gql`
  type Query {
    client: [Client]
    service: [Service]
    vacations: [Vacations]
    treatment: [Treatment]
    vacationsWorker: [Vacations]
    worker: [Worker]
    event: [Events]
    events: [Events]
  }

  input ClientInput {
    name: String
    phone: String
    address: String
    treatment: [TreatmentInput]
  }
  input EventInput {
    startTime: String,
    endTime: String,
    description: String,
    subdescription: String
  }

  input WorkerInput {
    eventId: ID
    name: String
    phone: String
    address: String
    treatment: [TreatmentInput]
  }

  input TreatmentInput {
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
