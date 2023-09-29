const { gql } = require("apollo-server");

const types = gql`
type Cliente {
    atendimentos: [Atendimento!]!
    id: ID!
    nome: String!
    telefone: String
    endereco: String
  }
  
  type Atendente {
    id: ID!
    nome: String!
    ferias: [Ferias]
  }

  type Atendimento {
    id: ID!
    servico: Servico!
    data: String!
    atendente: Atendente
    avaliacao: Int
  }
  
  type Servico {
    id: ID!
    titulo: String!
    descricao: String
    valor: Float!
  }
  
  type Ferias {
    id: ID!
    dataInicio: String!
    dataFim: String!
  }  
`;
module.exports = types;
