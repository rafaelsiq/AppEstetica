const { gql } = require("apollo-server");

const types = gql`
  type Client {
    id: ID!
    name: String!
    phone: String!
    address: String
    treatments: [Treatment]
  }
  
  type Worker {
    id: ID!
    name: String!
    vacation: [Vacations]
  }
  
  type Events {
    eventId: ID!,
    startTime: String,
    endTime: String,
    description: String,
    subdescription: String
  }

  type Treatment {
    id: ID!
    service: Service!
    date: String!
    worker: Worker
    conter: Int
  }
  
  type Service {
    id: ID!
    title: String!
    description: String
    price: Float!
  }
  
  type Vacations {
    id: ID!
    startDate: String!
    endDate: String!
  }  
`;
module.exports = types;
