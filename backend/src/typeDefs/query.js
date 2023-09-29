const { gql } = require("apollo-server");

const query = gql`
  type Query {
    cliente: [Cliente]
    servico: [Servico]
    ferias: [Ferias]
    atendimento: [Atendimento]
    feriasAtendente: [Ferias]
    atendente: [Atendente]
  }

  type Atendente {
    id: ID!
  }

  type Cliente {
    id: ID!
    atendimentos: [Atendimento!]!
  }

  type Atendimento {
    id: ID!
    servico: Servico
    data: String
  }
  type Atendente {
    id: ID!
    nome: String
  }

  type Servico {
    nome: String
  }

  type Ferias {
    atendente: Atendente
  }
`;

module.exports = query;
