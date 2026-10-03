# AppEstetica (frontend + backend)

Monorepo com:

- `frontend/`: aplicativo **Expo / React Native** (telas e componentes de UI).
- `backend/`: **Apollo Server (GraphQL)** + **MongoDB (Mongoose)** para CRUD.

## Features atuais

### Frontend (Expo)

- **Login / Cadastro**: alternância entre formulário de login e cadastro (fluxo ainda sem autenticação real; apenas navega para a Home).
- **Home**: carrossel de banners + atalhos para módulos:
  - **Agenda** (implementado): abre a tela de agenda.
  - **Receber** (implementado): abre a tela de pagamento via QR Code.
  - **Clientes / Serviços / Colaboradores** (placeholders): botões ainda sem navegação.
- **Agenda**: calendário diário com indicador de “horário atual” e eventos do dia (por enquanto via `src/mock/calendarMock.js`).
- **Receber**: tela de métodos de pagamento mostrando um QR Code e ação para finalizar/voltar.

### Backend (GraphQL + MongoDB)

API GraphQL com operações de CRUD para:

- **Clients**
- **Services**
- **Workers**
- **Treatments**
- **Vacations**
- **Events**

## Como rodar

### Backend

1. Configure variáveis de ambiente:

```bash
cd backend
cp .env.example .env
```

2. Ajuste `DB_URI` no `.env` para seu MongoDB (local ou Atlas).

3. Instale e rode:

```bash
npm install
npm start
```

Por padrão o servidor sobe em `PORT=4000`.

### Frontend

```bash
cd frontend
npm install
npx expo start
```

## Exemplos de queries/mutations (GraphQL)

### Listar clients

```graphql
query {
  clients {
    id
    name
    phone
    address
  }
}
```

### Criar service

```graphql
mutation {
  createService(input: { title: "Limpeza de Pele", description: "Facial", price: 120.0 }) {
    id
    title
    price
  }
}
```

