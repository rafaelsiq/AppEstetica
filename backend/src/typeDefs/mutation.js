const { gql } = require("apollo-server");

const mutation = gql`
  type Mutation {
    criarCliente(input: ClienteInput): Cliente
    atualizarCliente(id: ID!, input: ClienteInput): Cliente
    excluirCliente(id: ID!): Cliente

    criarAtendente(input: AtendenteInput): Atendente
    atualizarAtendente(id: ID!, input: AtendenteInput): Atendente
    excluirAtendente(id: ID!): Atendente

    criarServico(input: ServicoInput): Servico
    atualizarServico(id: ID!, input: ServicoInput): Servico
    excluirServico(id: ID!): Servico

    criarAtendimento(input: AtendimentoInput): Atendimento
    atualizarAtendimento(id: ID!, input: AtendimentoInput): Atendimento
    excluirAtendimento(id: ID!): Atendimento

    criarFerias(input: FeriasInput): Ferias
    atualizarFerias(id: ID!, input: FeriasInput): Ferias
    excluirFerias(id: ID!): Ferias
  }

  input ClienteInput {
    nome: String
    telefone: String
    endereco: String
    atendimento: [AtendimentoInput]
  }

  input AtendenteInput {
    nome: String
    telefone: String
    endereco: String
    atendimento: [AtendimentoInput]
  }

  input AtendimentoInput {
    servicoId: ID
    data: String
    avaliacao: Int
  }

  input FeriasInput {
    atendenteId: ID
    dataInicio: String
    dataFim: String
  }
    
  input ServicoInput {
    titulo: String
    descricao: String
    valor: Float
  }
`;

module.exports = mutation;
