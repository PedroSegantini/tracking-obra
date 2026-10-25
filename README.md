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

## Documentação

- [Funcionalidades, telas, banco, permissões e cálculos](docs/PROJETO.md).
- [Configurar Firebase e publicar na Vercel](docs/CONFIGURACAO.md).
- [Verificações realizadas e checklist de aceitação](docs/VALIDACAO.md).

## Implementado

- Login por Google e e-mail/senha, recuperação e vinculação dos métodos.
- Seleção de reformas da família por dropdown, com dados separados; criação exclusiva para admin.
- Acesso às reformas somente para familiares autorizados.
- Perfis `admin` e `user`, criação de contas via API protegida e listagem administrativa.
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

Para interface **e API** com credenciais reais, depois de configurar os serviços, use `npx vercel dev`. O `npm run dev` não executa a função `/api/admin/users`. A demonstração permite exercitar a tela administrativa sem servidor.

Testes das regras (Java 17 e Firebase CLI 14 no ambiente verificado):

```sh
npx firebase-tools@14.0.0 emulators:exec --only firestore --project demo-tracking-obra 'npm run test:rules'
```

O comando utiliza um projeto de demonstração, não sua base de produção. As versões foram fixadas para reproduzir os testes com Java 17; ao atualizar a CLI, confira os requisitos de Java.

## Organização

```text
api/admin/users.js         Endpoint administrativo da Vercel
server/                   Firebase Admin e provisionamento de usuários
scripts/                  Bootstrap e autorização de conta já existente
src/components/           Componentes, modal e lista de despesas
src/views/                Telas
src/lib/                  Cálculos, Excel, Firebase e mensagens de erro
src/store.js              Sessão, sincronização e operações de dados
firestore.rules           Autorização e validação no banco
tests/                    Verificações automatizadas
docs/                     Planejamento e guias
```

## Atualização das regras

Se o Firebase já estava configurado, publique novamente `firestore.rules` para habilitar a seleção e criação de reformas. Os dados da reforma original `main` são preservados. Veja o início do [guia de configuração](docs/CONFIGURACAO.md).

## Antes do GitHub

O `.gitignore` exclui `.env.local`, `.env.admin`, arquivos de credenciais conhecidos, `node_modules`, build e logs. Nunca coloque a chave privada em arquivos de exemplo, no código ou em variáveis `VITE_`. Revise `git status` antes do primeiro commit. Nenhum repositório remoto foi criado ou publicação realizada nesta entrega.

O `package-lock.json` deve ser versionado. Use `npm ci` para reproduzir a instalação. Há overrides documentados em `docs/PROJETO.md` para manter compatibilidade e corrigir dependências transitivas.
