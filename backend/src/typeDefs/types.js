const { gql } = require("apollo-server");

const types = gql`
  type Client {
    id: ID!
    name: String!
    phone: String!
    address: String
  }

  type Worker {
    id: ID!
    name: String!
    phone: String
    address: String
  }

  type Service {
    id: ID!
    title: String!
    description: String
    price: Float!
  }

  type Treatment {
    id: ID!
    clientId: ID
    serviceId: ID
    date: String
    conter: Int
  }

  type Vacations {
    id: ID!
    workerId: ID
    startDate: String
    endDate: String
  }

  type Events {
    id: ID!
    eventId: ID
    startTime: String
    endTime: String
    description: String
    subdescription: String
  }
`;
module.exports = types;
