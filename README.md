# Tracking Obra

Controle familiar de reformas, feito com Vue 3, JavaScript, HTML/CSS, Firebase e Vercel.

## Começar agora, sem Firebase

Requisito: Node.js 22.12 ou superior da linha 22 e npm. O projeto foi verificado com Node 22.23.2.

```sh
cd /Users/pedrosegantini/Desktop/Pessoal/tracking-obra
npm ci
cp .env.example .env.local
npm run dev
```

Abra o endereço mostrado pelo Vite, normalmente http://127.0.0.1:5173. Clique em **Continuar** para explorar a prévia local. A interface não exibe avisos de demonstração; os dados continuam locais até configurar o Firebase.

O `.env.local` de demonstração já foi preparado na entrega; o comando de cópia é útil em um novo checkout. Não substitua um arquivo que você já configurou com Firebase.

A demonstração usa dados fictícios, guardados no `localStorage` deste navegador. Não compartilha dados entre pessoas, não realiza autenticação e não guarda senhas. Para apagar seus dados fictícios, remova a chave `tracking-obra-demo-v1` nas ferramentas do navegador. Não use esse modo para gastos reais. O tema é salvo separadamente em `obra-theme`.

## Implementado

- Login por Google e e-mail/senha, recuperação e vinculação dos métodos.
- Alteração de senha com validação da senha atual e aviso por e-mail via SMTP configurável.
- Seleção de reformas da família por dropdown, com dados separados; criação exclusiva para admin.
- Usuários comuns acessam somente reformas vinculadas; administradores gerenciam todas.
- Perfis `admin` e `user`, criação/edição/remoção de contas via API protegida.
- Associação de membros com busca, edição de nome e membros das reformas e exclusão lógica com histórico preservado.
- Despesas com edição, exclusão, filtros e paginação.
- Crédito com parcelas totais e quantidade já paga.
- Orçamento compartilhado, indicadores total/parcial e gráficos por categoria e mês de compra.
- Categorias iniciais e criação/desativação/reativação de categorias.
- Layout responsivo, tema claro/escuro e botões principais verde-escuros.
- Excel: exportação, modelo, validação, prévia e indicação de duplicidades.
- Regras de segurança Firestore, bootstrap e testes automatizados.

## Comandos

```sh
npm run dev       # Apenas interface Vite
npm test          # Cálculos, importação e provisionamento administrativo
npm run build     # Gera dist/
npm run preview   # Serve dist/; não disponibiliza a API de administração
```

Para interface **e API** com credenciais reais, depois de configurar os serviços, use `npx vercel dev`. O `npm run dev` não executa as funções `/api/admin/users`, `/api/admin/manage` e `/api/account/password`. A demonstração permite exercitar a tela administrativa sem servidor.

Testes das regras (Java 17 e Firebase CLI 14 no ambiente verificado):

```sh
npx firebase-tools@14.0.0 emulators:exec --only firestore --project demo-tracking-obra 'npm run test:rules'
```

O comando utiliza um projeto de demonstração, não sua base de produção. As versões foram fixadas para reproduzir os testes com Java 17; ao atualizar a CLI, confira os requisitos de Java.

## Organização

```text
api/                      Endpoints da Vercel: administração e senha
server/                   Firebase Admin, operações privilegiadas e e-mail
public/                   Arquivos estáticos (ícone do site)
scripts/                  Bootstrap, autorização e migração de vínculos
src/components/           Componentes, modal e lista de despesas
src/views/                Telas
src/lib/                  Cálculos, Excel, Firebase e mensagens de erro
src/store.js              Sessão, sincronização e operações de dados
firestore.rules           Autorização e validação no banco
tests/                    Verificações automatizadas
```

## Atualização das regras

Se o Firebase já estava configurado, execute `scripts/migrate-memberships.mjs` com suas credenciais administrativas e publique regras e índices antes de usar os vínculos individuais. Os dados da reforma original `main` são preservados. A migração preenche somente campos de vínculo/exclusão ausentes, sem sobrescrever listas existentes:

```sh
node --env-file=.env.admin scripts/migrate-memberships.mjs
npx firebase-tools@14.0.0 deploy --only firestore:rules,firestore:indexes --project SEU_PROJECT_ID
```

Aguarde a criação do índice antes de testar contas `user`. Em um projeto novo, o bootstrap já cria os campos necessários.

## Antes do GitHub

O `.gitignore` exclui `.env.local`, `.env.admin`, arquivos de credenciais conhecidos, `node_modules`, build e logs. Nunca coloque a chave privada em arquivos de exemplo, no código ou em variáveis `VITE_`. Revise `git status` antes do primeiro commit. Nenhum repositório remoto foi criado ou publicação realizada nesta entrega.

O `package-lock.json` deve ser versionado. Use `npm ci` para reproduzir a instalação. Os overrides em `package.json` mantêm compatibilidade e corrigem dependências transitivas.


## Configurar Firebase e Vercel

1. Crie um projeto Firebase e um aplicativo Web. Crie o Firestore em modo de produção e habilite os provedores Google e E-mail/senha no Authentication.
2. Em `.env.local`, preencha as variáveis Web de `.env.example`, defina `VITE_APP_MODE=firebase` e mantenha `VITE_USE_EMULATORS=false`. Reinicie o Vite após alterar variáveis.
3. Gere uma chave de conta de serviço nas configurações do Firebase. Guarde o JSON fora do repositório. Copie `.env.admin.example` para `.env.admin` e preencha `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY` com os campos desse JSON. Nunca use prefixo `VITE_` para credenciais administrativas ou SMTP.
4. Crie sua conta manualmente em Authentication e informe seu e-mail em `BOOTSTRAP_ADMIN_EMAIL`. Execute `npm run bootstrap` para criar o primeiro administrador, a reforma inicial e as categorias.
5. Publique as regras e índices com os comandos abaixo. Se já houver dados de uma versão anterior, siga primeiro a migração descrita acima.

```sh
npx firebase-tools@14.0.0 login
npx firebase-tools@14.0.0 deploy --only firestore:rules,firestore:indexes --project SEU_PROJECT_ID
```

6. Importe o repositório na Vercel: framework Vite, Node 22.x, instalação `npm ci`, build `npm run build` e saída `dist`. Cadastre as variáveis Web de `.env.example` e as credenciais administrativas no ambiente da Vercel. As variáveis `BOOTSTRAP_*` e `INITIAL_BUDGET_CENTS` são usadas somente na preparação local.
7. Para avisos de alteração de senha, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_FROM`, conforme `.env.admin.example`. `ADMIN_CONTACT_EMAIL` é opcional. `FIREBASE_WEB_API_KEY` pode ser configurada para o servidor; se ausente, usa `VITE_FIREBASE_API_KEY`. Sem SMTP, a troca de senha funciona, mas o aviso não é enviado. Esse aviso cobre apenas a troca feita no aplicativo, não pelo link de recuperação.
8. Publique e adicione o domínio da Vercel aos domínios autorizados do Firebase Authentication. Para testes locais, autorize também `localhost` e `127.0.0.1`. Use `npx vercel dev` para testar as funções locais, com as variáveis do servidor configuradas no ambiente Development.
9. Entre como administrador, crie os familiares e atrele cada um às reformas. Para autorizar uma conta Google já existente, execute `node --env-file=.env.admin scripts/authorize-member.mjs familiar@example.com user` e depois faça o vínculo pela administração.

As contas podem vincular Google e e-mail/senha em **Minha conta**, mantendo o mesmo UID. O campo de senha do aplicativo não altera a senha do Google. A exclusão de uma reforma é lógica: remove os vínculos e preserva o histórico, sem restauração pela interface.

Firebase e Vercel ainda precisam ser configurados por você; nenhuma publicação é executada pelos comandos de build. Não inclua arquivos de credenciais no Git.
