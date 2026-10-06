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
  - Ficha única por cliente (sem histórico/versionamento de anamnese)
  - Visualização por padrão em modo somente leitura com botão para editar quando necessário
  - Mapa de dores interativo (frente e costas com seleção por imagem e lateralidade: esquerdo/direito/ambos)
  - Perguntas-chave com opções de múltipla escolha (quando aplicável) + campo complementar
  - Condições de saúde
  - Bloco "Para mulheres" exibido de forma condicional conforme sexo da cliente
- Tela separada por cliente para:
  - Anamnese
  - Acompanhamento
- Cadastro de cliente com edição (atualização de dados sem recriar registro)
  - Lista de clientes exibida antes do formulário
  - Formulário exibido somente em ações de "Nova cliente" ou "Editar"
- Gráficos de evolução por cliente:
  - Dor x estresse
  - Sono por sessão
  - Índice de bem-estar por sessão
  - Distribuição por tipo de atendimento
  - Comparativo inicial x atual
- Histórico mantido somente para acompanhamento/atendimentos (registro independente por sessão)
  - Número de sessão preenchido automaticamente no formulário de acompanhamento
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
VITE_FIREBASE_VAPID_KEY=
```

A chave `VITE_FIREBASE_VAPID_KEY` fica em Firebase Console → Project settings → Cloud Messaging → Web Push certificates.

Na aba **Avisos**, a seção **Testar no dispositivo** mostra o ID de instalação e o token FCM para colar no Console.

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
