# Configurar Firebase e Vercel

Este guia conecta o código aos seus serviços. Não é necessário configurar nada para explorar a demonstração local. Nenhum recurso de produção, chave real, conta ou deploy foi criado automaticamente.

## 1. Preparar a máquina

Use Node.js 22.12+ da linha 22 e npm. Se usa nvm, execute `nvm use` na pasta do projeto.

```sh
cd /Users/pedrosegantini/Desktop/Pessoal/tracking-obra
npm ci
```

## 2. Criar o projeto Firebase

1. Acesse https://console.firebase.google.com/ e crie um projeto, por exemplo `tracking-obra-familia` (o ID global pode exigir outro nome).
2. Mantenha o plano **Spark**, sem ativar faturamento. Google Analytics é dispensável.
3. Adicione um aplicativo **Web** ao projeto. Não é necessário habilitar Firebase Hosting.
4. Em Configurações do projeto > Seus aplicativos, copie a configuração web.
5. Em Firestore Database, crie o banco padrão na edição **Standard**, em modo de produção. Escolha a região adequada à família; a localização precisa ser escolhida com cuidado porque não é uma configuração simples de trocar depois.
6. Não use regras de banco aberto. Publicaremos o arquivo restritivo na próxima etapa.

### Variáveis públicas do site

Crie/edite `.env.local` com os valores do seu aplicativo Web:

```dotenv
VITE_APP_MODE=firebase
VITE_FIREBASE_API_KEY=valor-do-apiKey
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto
VITE_FIREBASE_APP_ID=valor-do-appId
VITE_USE_EMULATORS=false
```

`VITE_` é incorporado ao JavaScript público durante o build. A configuração Web identifica o projeto; a proteção dos dados vem de Authentication + regras Firestore. **Nunca coloque uma chave privada/Admin SDK em variáveis VITE_.**

Pare e reinicie o Vite depois de alterar essas variáveis. Na Vercel, refaça o deploy após alterações.

## 3. Habilitar os métodos de login

Em Authentication > Sign-in method / Provedores:

1. Habilite **E-mail/senha** (não precisamos do login sem senha por link).
2. Habilite **Google**, selecionando o e-mail de suporte.
3. Configure a opção de uma conta por endereço de e-mail/vinculação de contas; não habilite múltiplas contas independentes com o mesmo e-mail.
4. Em Configurações > Domínios autorizados, cadastre `localhost` e `127.0.0.1` se for testar localmente. Projetos novos podem não incluir localhost automaticamente.
5. Depois da publicação, adicione o domínio exato da Vercel, sem `https://` nem caminhos. Autorize separadamente cada domínio de preview que você realmente utilizar.
6. Confira o modelo de e-mail de recuperação de senha e o nome exibido do projeto.
7. Se configurar política de senhas no Firebase, mantenha compatibilidade com o formulário: mínimo de 10 caracteres; caso adicione outras exigências, atualize a interface/validação também.

Não há cadastro público no aplicativo. A API administrativa cria os familiares. Um Google não autorizado pode criar uma identidade no Authentication, mas não ganha vínculo na reforma e não lê dados.

## 4. Publicar regras e índices

Opção pela CLI (sem necessidade de Firebase Hosting ou Cloud Functions):

```sh
npx firebase-tools@14.0.0 login
npx firebase-tools@14.0.0 deploy --only firestore:rules,firestore:indexes --project SEU_PROJECT_ID
```

Substitua `SEU_PROJECT_ID`. Confirme que está no projeto correto. Como o projeto é novo, os arquivos não têm índices compostos. As consultas da primeira versão não precisam deles.

Alternativa: cole `firestore.rules` na aba **Regras** do Firestore e publique. Não remova a restrição por vínculo de membro para fazer o login funcionar.

A CLI 14.0.0 foi a versão usada nos testes do emulador com Java 17. Você pode usar uma CLI atual compatível com seu ambiente para o deploy; revise os requisitos oficiais antes de atualizar.

## 5. Preparar credenciais administrativas

A função `/api/admin/users` e o bootstrap usam Admin SDK. No Firebase > Configurações do projeto > Contas de serviço, gere uma chave privada para a conta de serviço do projeto. Você fará essa etapa pessoalmente.

Guarde o JSON em local privado **fora do repositório**. Não envie o arquivo para o GitHub. Copie os três campos necessários para `.env.admin`, criado a partir do exemplo:

```sh
cp .env.admin.example .env.admin
```

Preencha no editor:

```dotenv
FIREBASE_PROJECT_ID=seu-projeto
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@seu-projeto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nCONTEUDO_REAL\n-----END PRIVATE KEY-----\n"
BOOTSTRAP_ADMIN_EMAIL=seu-email@example.com
BOOTSTRAP_ADMIN_NAME=Seu nome
INITIAL_BUDGET_CENTS=0
```

A chave pode ser mantida em uma linha, com `\n` representando as quebras. O código converte as quebras escapadas. Os campos devem pertencer ao mesmo projeto da configuração Web. `.env.admin` é ignorado pelo Git e não é carregado pelo Vite.

Use uma conta de serviço com permissões suficientes para administrar Authentication e ler/gravar Firestore. Não é necessário habilitar Cloud Functions, Cloud Run, Storage ou plano Blaze para esta arquitetura.

## 6. Criar o primeiro administrador e a estrutura

1. No console Firebase, abra Authentication > Usuários > Adicionar usuário.
2. Crie sua conta com o e-mail de `BOOTSTRAP_ADMIN_EMAIL` e uma senha forte.
3. Execute:

```sh
npm run bootstrap
```

O script procura essa conta, define a claim `role=admin`, cria seu vínculo ativo, cria a reforma `main` e as três categorias iniciais. Não redefine orçamento/categorias que já existirem. `INITIAL_BUDGET_CENTS=8000000`, por exemplo, representa R$ 80.000 na criação inicial. Você também poderá ajustar o orçamento pela interface.

Depois, entre pelo e-mail e senha. Se já estava autenticado, saia e entre novamente para atualizar o token e o cargo. O script não é executado automaticamente no build/deploy.

## 7. Rodar conectado ao Firebase

```sh
npm run dev
```

Despesas, categorias, orçamento, Google e vinculação funcionarão com Firebase configurado. Para testar a API administrativa local, use Vercel CLI:

```sh
npx vercel login
npx vercel link
npx vercel dev
```

Antes, configure as variáveis administrativas no ambiente **Development** da Vercel ou disponibilize-as no ambiente do processo local. Não copie `.env.admin` para um arquivo com prefixos VITE_. Se utilizar `npx vercel env pull .env.local`, preserve também a configuração Web necessária nesse arquivo e revise os valores. Evite conectar Development a dados reais enquanto testa operações de exclusão/importação.

`npm run dev` e `npm run preview` servem a interface, não `/api/admin/users`. O modo demo simula a administração sem criar contas reais.

## 8. Subir ao GitHub

Crie o repositório quando quiser. Antes do commit, revise arquivos:

```sh
git init
git add .
git status
```

Confirme que `.env.local`, `.env.admin`, JSON de conta de serviço, logs, `node_modules` e `dist` não aparecem. Não force a inclusão de arquivos ignorados. Depois faça commit e configure seu remoto como preferir. A pasta inclui workflow de teste/build para GitHub Actions; ele não precisa de segredos e usa modo demo.

## 9. Publicar na Vercel

1. Entre na Vercel e importe o repositório GitHub.
2. Selecione o plano Hobby e framework Vite.
3. Use Node.js **22.x**, instalação `npm ci`, build `npm run build`, saída `dist` e raiz do repositório.
4. Configure as variáveis abaixo em **Production**. Para Preview/Development, prefira projetos Firebase separados quando possível.

| Variável | Tipo | Valor |
|---|---|---|
| VITE_APP_MODE | Pública | firebase |
| VITE_FIREBASE_API_KEY | Pública | Configuração Web |
| VITE_FIREBASE_AUTH_DOMAIN | Pública | Configuração Web |
| VITE_FIREBASE_PROJECT_ID | Pública | Configuração Web |
| VITE_FIREBASE_APP_ID | Pública | Configuração Web |
| VITE_USE_EMULATORS | Pública | false |
| FIREBASE_PROJECT_ID | Servidor | Mesmo projeto |
| FIREBASE_CLIENT_EMAIL | Servidor | Conta de serviço |
| FIREBASE_PRIVATE_KEY | Segredo do servidor | Chave privada |

5. Para `FIREBASE_PRIVATE_KEY` no painel, cole a chave inteira com quebras reais **ou** a versão com `\n`, sem aspas externas adicionais. Marque como sensível quando a opção estiver disponível.
6. Faça o deploy. `vercel.json` preserva `/api` e permite atualizar páginas como `/despesas` diretamente.
7. Cadastre o domínio `nome-do-projeto.vercel.app` em Domínios autorizados do Firebase Authentication.
8. Teste o primeiro administrador, um familiar `user`, a recuperação e os dois métodos de login.

Nunca use `VITE_APP_MODE=demo` para registrar despesas reais em produção. Se você publicar a demo deliberadamente, ela continuará sendo apenas armazenamento local, sem autenticação.

## 10. Criar familiares e vincular login

No aplicativo autenticado como admin, abra Administração. Informe nome, e-mail, senha inicial e cargo. A criação ocorre no servidor sem encerrar a sessão do administrador. Entregue a senha por um meio privado e oriente o familiar a trocar por recuperação de senha.

Para usar os dois métodos na mesma conta:

- Conta criada por e-mail/senha: entrar assim, abrir Minha conta, clicar Conectar Google e autenticar com o Google correspondente.
- Conta Google já autorizada: entrar pelo Google, abrir Minha conta e definir/confirmar uma senha do aplicativo.
- O UID permanece o mesmo. Não criar uma segunda conta nem definir como política juntar pessoas apenas por igualdade de e-mail.
- Se o Firebase exigir login recente, sair e entrar novamente.
- Se Google ou senha já estiver vinculado a outro UID, a aplicação mostra o conflito; não há migração automática de contas.

### Conta Google criada antes da autorização

Se um familiar entrou pelo Google antes de você cadastrá-lo, o e-mail já existe no Authentication. Autorize a identidade existente, sem apagá-la nem criar outra:

```sh
node --env-file=.env.admin scripts/authorize-member.mjs familiar@example.com user
```

Este comando local exige suas credenciais administrativas. O familiar deve sair e entrar novamente. Ele poderá habilitar senha em Minha conta. Passe `admin` em vez de `user` apenas se quiser conceder administração conscientemente.

## 11. Custos, manutenção e acesso

- Firebase Spark e Vercel Hobby possuem cotas. Spark não é uma promessa de uso ilimitado; ao atingir limites, operações podem ser interrompidas em vez de continuar normalmente.
- O caso é pessoal/não comercial. Use o subdomínio gratuito; domínio próprio pode ter custo de registro.
- Não habilitamos faturamento nem recursos que exigem Blaze. Não habilite SMS ou serviços pagos para seguir este guia.
- Acompanhe leituras/gravações no Firestore e uso da Vercel. A aplicação mantém listeners das despesas, portanto novas sessões leem os registros da reforma.
- Faça exportações periódicas. Exportação Excel é uma cópia dos lançamentos, não backup completo de contas/cargos/configurações. Exclusão na interface é definitiva.
- Para retirar acesso, enquanto não há essa função na interface: desative a conta em Authentication, altere `active=false` no documento de membro e revogue as sessões/refresh tokens pelo Admin SDK conforme a documentação. Não dependa apenas de esconder um item do menu.
- Se uma chave privada vazar, revogue a chave no Google Cloud, gere outra e atualize as variáveis; remover do último commit não remove o histórico.

## Referências oficiais

- Vue: https://vuejs.org/guide/quick-start.html
- Vinculação de provedores: https://firebase.google.com/docs/auth/web/account-linking
- Administração de usuários: https://firebase.google.com/docs/auth/admin/manage-users
- Custom claims: https://firebase.google.com/docs/auth/admin/custom-claims
- Revogação de sessões: https://firebase.google.com/docs/auth/admin/manage-sessions
- Regras Firestore: https://firebase.google.com/docs/firestore/security/get-started
- Emulador e testes: https://firebase.google.com/docs/firestore/security/test-rules-emulator
- Planos Firebase: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- Vercel Hobby: https://vercel.com/docs/plans/hobby
- Variáveis Vercel: https://vercel.com/docs/environment-variables
