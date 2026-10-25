# Definição do projeto

## Objetivo e escopo

Registrar despesas no momento em que acontecem, pelo celular ou computador, e permitir que a família acompanhe o orçamento de cada reforma selecionada. Idioma pt-BR, moeda BRL e uso com internet. Sem anexos, serviços bancários ou notificações nesta primeira versão.

## Tecnologias e arquitetura

Vue 3 + JavaScript, componentes com `<template>` HTML e estilos CSS. Vite para desenvolvimento/build, Vue Router para navegação, Firebase Authentication para identidade, Firestore Standard para os dados e Vercel para os arquivos estáticos e a função administrativa Node.js. ExcelJS é carregado sob demanda para ler e gerar `.xlsx`. Ícones Lucide e gráficos construídos com HTML/CSS acessível, sem serviço pago.

Fluxos:

1. O navegador autentica no Firebase e recebe um UID/token.
2. O vínculo familiar `renovations/main/members/{uid}` autoriza acesso às reformas da mesma família.
3. Operações diárias acessam Firestore diretamente, sob `firestore.rules`.
4. Criação de usuários chama `POST /api/admin/users` com token Bearer.
5. O servidor verifica token, revogação, cargo `admin` no token e vínculo administrativo ativo antes de usar Admin SDK.

O modo demo só é habilitado explicitamente com `VITE_APP_MODE=demo`. Em modo Firebase, variáveis ausentes resultam em mensagem de configuração, nunca em acesso demonstrativo automático.

## Requisitos e telas

### Login

Google e e-mail/senha, mostrar/ocultar senha, recuperação por e-mail. Sem cadastro público na interface. Contas desconhecidas que autenticarem pelo Google veem acesso pendente e não obtêm os dados. Firebase Auth ainda pode conter essas identidades: autenticação e autorização são verificações distintas.

### Seleção de reforma

O dropdown na sidebar lista as reformas da família e permite trocar a reforma ativa. Administradores também veem **+ Nova reforma**, que abre um formulário de nome. Cada reforma nasce com orçamento zero, sem despesas e com as três categorias iniciais. Somente administradores ativos com claim `role=admin` podem criar o documento no Firestore; a interface não é a única proteção.

Todos os familiares autorizados acessam todas as reformas desta família. Não há permissões separadas por reforma nesta versão. A reforma selecionada é lembrada por usuário no navegador. Ao trocar, orçamento, categorias, despesas, gráficos, filtros, prévias de importação e formulários são reiniciados para o contexto correto. A seleção é bloqueada enquanto há edição de despesa aberta ou criação em andamento.

A reforma antiga `main` continua no mesmo caminho. Os membros permanecem centralizados em `main/members` para manter compatibilidade com o bootstrap e a administração. As reformas não podem ser excluídas pela interface ou por gravação direta do cliente.

### Resumo `/`

- Expectativa de gasto, total/parcial, saldo e crédito pendente.
- Percentual de orçamento utilizado, inclusive acima de 100%.
- Seletor total/parcial atualiza indicadores e ambos os gráficos.
- Distribuição por categoria e compras em seis meses até o mês selecionado.
- Cinco registros com data de compra mais recente.
- Orçamento e indicadores são acumulados de toda a reforma. O seletor de mês afeta apenas o gráfico mensal.

### Despesas `/despesas`

Cadastro em modal, edição, exclusão confirmada. Campos obrigatórios: valor total, data, categoria e pagamento. Descrição opcional com até 500 caracteres. Filtros por descrição/categoria, categoria, método e intervalo de datas. Paginação de 15 registros; exportação respeita todos os resultados filtrados.

Crédito exige total de parcelas e quantidade paga. PIX/Débito é integralmente pago. Todas as pessoas podem editar ou excluir qualquer despesa.

### Configurações `/configuracoes`

Orçamento geral; categorias Pedreiro, Material e Outras despesas; criação de novas categorias com cor; desativação/reativação sem apagar histórico. Qualquer membro pode operar. Categorias usadas e inativas continuam visíveis no histórico e podem permanecer na edição da despesa original; não podem ser usadas em novos registros.

Excel com exportação completa, modelo e importação com prévia. Categorias desconhecidas devem ser criadas antes da importação.

### Minha conta `/conta`

Exibe nome, e-mail, cargo e métodos conectados. Permite conectar Google à conta já autenticada ou adicionar uma senha do aplicativo à conta Google. O UID e o vínculo da reforma permanecem os mesmos. A senha do Google não é modificada. Conflitos com conta já existente são exibidos sem mesclar dados silenciosamente; nova autenticação pode ser exigida pelo Firebase.

### Administração `/admin`

Somente `admin`. Cria usuário com nome, e-mail, senha inicial e cargo (`user` por padrão). Lista membros. Não permite ainda remover contas ou editar cargos. Se houver conta Auth preexistente para o e-mail, o endpoint retorna conflito; o operador poderá autorizar o UID existente pelo script do guia.

### Visual

Fundo neutro, informações monetárias em destaque, botões principais verde-escuros, temas claro e escuro. Tema inicial acompanha o dispositivo e depois respeita escolha salva no navegador. Sidebar no desktop e menu recolhível no celular; tabela se transforma em cartões. Botão flutuante de adicionar despesa no celular. Campos rotulados, foco visível, janela modal nativa, confirmação de exclusão, mensagens de sucesso/erro e suporte a movimento reduzido.

## Modelo Firestore

Cada reforma possui seu próprio documento e subcoleções. Os membros da família ficam centralizados no caminho original:

```text
renovations/{renovationId}
  categories/{categoryId}
  expenses/{expenseId}
renovations/main/members/{uid}  # acesso familiar compartilhado
```

### Reforma

| Campo | Tipo | Observação |
|---|---|---|
| name | string | Nome de 2–80 caracteres; Nossa reforma no bootstrap inicial |
| budgetCents | inteiro | >= 0; zero = orçamento não definido |
| updatedAt | timestamp | Servidor |
| updatedBy | string | UID do último editor |

### Membro

| Campo | Tipo | Observação |
|---|---|---|
| name | string | Nome de exibição, 2–80 caracteres |
| email | string | Identificador de login, normalizado |
| role | string | user ou admin |
| active | boolean | Vínculo autorizado |
| createdBy | string | UID do administrador ou operador local |
| createdAt | timestamp | Data de criação |

O ID do documento é o UID do Authentication. Cargo também é registrado como custom claim `role`. O token é assinado pelo Firebase; o navegador não define o cargo. Senhas não fazem parte do documento.

### Categoria

`name` (2–60 caracteres), `color` (#RRGGBB), `active`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`. ID derivado do nome sem acentos, com letras/números/hífens e até 60 caracteres. Criação usa transação para evitar o mesmo ID. Não há renomeação nesta versão: crie outra categoria e reclassifique se necessário.

### Despesa

| Campo | Tipo | Regra |
|---|---|---|
| amountCents | inteiro | Valor total, > 0, até 100.000.000.000 centavos |
| date | string AAAA-MM-DD | Data da compra, entre 1900 e 2199; sem conversão de fuso |
| categoryId | string | Referência à categoria existente |
| paymentMethod | string | pix ou credit |
| installments | inteiro | 1–600; PIX sempre 1 |
| paidInstallments | inteiro | 0 até installments; PIX sempre 1 |
| description | string | Opcional; armazenada como string vazia quando ausente; até 500 caracteres |
| createdBy, updatedBy | string | UIDs |
| createdAt, updatedAt | timestamp | Servidor |

Não há coleção de parcelas: a quantidade paga representa as primeiras parcelas quitadas. Atualizações preservam autor e data de criação. Despesas são removidas definitivamente após confirmação; não há lixeira nem histórico de versões nesta etapa.

## Permissões

| Ação | user | admin |
|---|---|---|
| Selecionar reforma | Sim | Sim |
| Criar reforma | Não | Sim |
| Consultar e gerenciar orçamento da reforma selecionada | Sim | Sim |
| Consultar e gerenciar categorias | Sim | Sim |
| Consultar, adicionar, editar e excluir despesas de qualquer membro | Sim | Sim |
| Importar e exportar | Sim | Sim |
| Consultar próprio vínculo | Sim | Sim |
| Listar todos os membros | Não | Sim |
| Criar usuários e atribuir cargo | Não | Sim, via API |
| Alterar diretamente membros/cargos no Firestore | Não | Não |

A listagem de reformas exige vínculo familiar ativo; a criação exige vínculo e claim administrativos. Regras negam qualquer outro caminho. Authentication sem vínculo ativo não permite acesso à reforma. Admin SDK ignora as regras Firestore; por isso o endpoint possui autorização própria. Retirar acesso exige desativar vínculo, desativar a conta no Authentication e revogar sessões conforme o guia.

## Cálculos

Valores em centavos inteiros. Entrada textual aceita `1200,50`, `1.200,50` e `1200`; ponto isolado não é separador decimal.

Para compra de valor `V`, `N` parcelas e `P` pagas:

```text
base = floor(V / N)
pago = P == N ? V : base * P
última parcela = V - base * (N - 1)
```

PIX/Débito: `pago = V`.

```text
total = soma do valor integral de cada compra
parcial = soma dos valores pagos
pendente = total - parcial
considerado = total ou parcial, conforme o seletor
saldo = orçamento - considerado
percentual = considerado / orçamento * 100
```

Exemplo: R$ 1.000 em PIX + R$ 1.200 em 6 parcelas, 2 quitadas: total R$ 2.200, parcial R$ 1.400, pendente R$ 800. R$ 100 em 3 parcelas: R$ 33,33, R$ 33,33, R$ 33,34.

Com orçamento zero, não há divisão por zero nem percentual enganoso: exibe Sem orçamento. Se gasto exceder o orçamento, o percentual real e valor excedido aparecem; a barra visual para em 100%.

**Gráfico mensal:** agrupa por mês da compra. Na visão parcial, mostra quanto dessas compras foi pago até agora. Não é fluxo de caixa pelo mês de pagamento, pois não armazenamos datas das quitações.

## Excel

Aba `Despesas`, cabeçalhos: `ID`, `Data`, `Valor total`, `Categoria`, `Pagamento`, `Parcelas`, `Parcelas pagas`, `Descrição`.

- `.xlsx`, até 2 MB, até 400 linhas por arquivo; lote Firestore único para evitar importação parcial.
- Valores numéricos em reais; textos no padrão brasileiro; no máximo duas casas decimais.
- Datas ISO, DD/MM/AAAA ou células de data Excel.
- Crédito exige as duas contagens, inclusive zero pago; PIX pode omiti-las ou informar 1/1.
- Fórmulas, links e células especiais são rejeitados: usar apenas valores.
- ID já existente ou combinação de campos igual gera possível duplicidade e é ignorado.
- Combinação usa data, valor, categoria, método, contagens e descrição normalizada.
- Linhas inválidas/duplicadas são mostradas; confirmação importa apenas as válidas não duplicadas.
- Não atualiza despesas por ID e não cria categorias automaticamente.
- Duplicidades são heurísticas. Dois lançamentos legítimos iguais devem ser cadastrados manualmente. Existe uma nova conferência antes de gravar, mas não há garantia de deduplicação entre importações simultâneas em dispositivos diferentes.
- O arquivo de modelo contém uma linha claramente identificada como EXEMPLO, que deve ser substituída/apagada.
- Processamento local no navegador; arquivo original não é enviado nem armazenado.

## Concorrência, limites e manutenção

Firestore onSnapshot atualiza orçamento, categorias e despesas entre membros. Não há sincronização offline persistente. Operações concorrentes sobre a mesma despesa seguem a última gravação; autoria de criação é preservada. No modo demonstrativo, localStorage não é compartilhado nem é fonte de dados reais. O formato anterior de uma única reforma é reconhecido automaticamente e preservado dentro de `main` ao salvar no novo formato com várias reformas.

A primeira versão carrega toda a coleção de despesas autorizadas e filtra/pagina no navegador. Adequado ao pequeno projeto familiar; bases maiores exigirão consultas paginadas e agregações para economizar leituras. Não há cron jobs, Cloud Functions Firebase, Storage, anexos nem serviços pagos na arquitetura.

Dependências têm lockfile e overrides: `@firebase/app`/`app-compat` alinhados às versões do Firebase 12 para compatibilidade com Node 22 e para evitar instâncias diferentes; `@grpc/grpc-js` e `uuid` transitivos corrigidos. Antes de atualizar, rode testes, auditoria e build e confira se os overrides ainda são necessários.

## Fora do escopo atual

Permissões individuais por reforma, exclusão/renomeação de reformas, orçamentos por categoria, comprovantes, alertas, integração bancária, registro offline, contas por telefone/SMS, vencimento real das parcelas, fluxo de caixa por data de quitação, histórico completo de alterações, alteração de cargos/remoção de usuários pela interface e restauração de despesas excluídas.
