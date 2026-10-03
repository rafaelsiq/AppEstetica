# Frontend Web (PWA) - Clínica de Estética

Aplicação web em React + Vite com autenticação Firebase e persistência no Firestore.

## Funcionalidades do MVP

- Login e cadastro com e-mail/senha
- Área autenticada para gestão de:
  - Agenda
  - Clientes
  - Serviços
- Ficha de anamnese por cliente com:
  - Dados pessoais fixos no cadastro da cliente
  - Mapa de dores interativo (frente e costas com seleção por imagem e lateralidade: esquerdo/direito/ambos)
  - Perguntas-chave
  - Condições de saúde
  - Bloco "Para mulheres" exibido de forma condicional conforme sexo da cliente
  - Sessões de acompanhamento
- Cadastro de cliente com edição (atualização de dados sem recriar registro)
- Gráficos de evolução por cliente:
  - Dor x estresse
  - Sono por sessão
- PWA habilitada (instalável no navegador)

## Como rodar

1. Instale dependências:

```bash
npm install
```

2. Copie o arquivo de exemplo de ambiente:

```bash
cp .env.example .env
```

3. Preencha as variáveis com as credenciais do seu projeto Firebase:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

4. Rode em desenvolvimento:

```bash
npm run dev
```

5. Build de produção:

```bash
npm run build
```

## Estrutura de dados no Firestore

- `users/{uid}/clients`
- `users/{uid}/services`
- `users/{uid}/appointments`

Cada usuário acessa somente seus próprios documentos via subcoleções.
