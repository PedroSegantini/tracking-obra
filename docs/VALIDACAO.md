# Verificação e aceitação

## Verificado na entrega

Ambiente: Node 22.23.2, npm 10.9.8, Java 17. Sem credenciais reais do projeto.

- `npm test`: 19 testes aprovados, cobrindo cálculos total/parcial, centavos, datas, validações, Excel, duplicidades, geração/leitura de um arquivo Excel real, cargos, autorização e rollback do provisionamento.
- Firestore Emulator 1.19.8, Firebase CLI 14.0.0: 7 testes aprovados. Visitantes/contas sem vínculo não acessam a reforma; membros alteram orçamento/criam despesas; não podem promover a si mesmos; administradores listam membros; banco rejeita valores, parcelas, datas e autores inválidos; categoria desativada preserva edição existente e bloqueia novos registros.
- Testes de várias reformas: criação restrita, despesas/orçamento/categorias separados, seleção persistida e migração da demonstração anterior aprovados. As regras também verificam que categorias de outra reforma não autorizam um lançamento.
- `npm run build`: compilação de produção aprovada.
- Inicialização dos módulos Authentication e Firestore com configuração fictícia local: aprovada, sem acessar projeto real.
- `npm audit`: zero vulnerabilidades conhecidas na árvore final na data da execução, 24/10/2026. Isso não substitui atualização contínua.
- Servidor Vite local iniciou corretamente. A inspeção visual/interação no navegador não pôde ser realizada: a ferramenta de navegador não estava disponível e o controle nativo do Chrome não tinha permissão.

## O que depende da sua configuração

Login real, recuperação de senha entregue por e-mail, pop-up e vinculação Google, sincronização entre familiares e API administrativa real exigem Firebase/Vercel configurados. Esses fluxos não foram testados com serviços de produção nesta entrega. Não houve deploy nem criação de projeto Firebase.

## Checklist depois de configurar

### Acesso

- [ ] Entrar/sair com a conta administrativa e ver Administração.
- [ ] Criar familiar `user`; entrar como ele sem enxergar Administração.
- [ ] Tentar abrir `/admin` com usuário comum e confirmar bloqueio.
- [ ] Entrar com Google desconhecido e confirmar acesso pendente sem dados.
- [ ] Vincular Google pela conta e-mail/senha e confirmar o mesmo UID/dados nos dois logins.
- [ ] Autorizar Google existente pelo script e adicionar senha em Minha conta.
- [ ] Recuperar senha e confirmar recebimento/funcionamento do e-mail.

### Reformas

- [ ] No admin, abrir dropdown lateral e criar uma reforma pelo item + Nova reforma.
- [ ] Confirmar que a nova reforma começa sem gastos, com orçamento zero e as três categorias iniciais.
- [ ] Alterar orçamento e adicionar despesa; trocar para a anterior e conferir separação.
- [ ] Recarregar/entrar novamente e conferir restauração da última seleção.
- [ ] Com user, selecionar as reformas e confirmar ausência de criação.
- [ ] Confirmar que filtros, formulários e prévia de Excel não permanecem abertos ao trocar de reforma.
- [ ] Se Firebase já existia, publicar as novas regras antes de usar a versão.

### Gastos e cálculo

- [ ] PIX de R$ 1.000 + crédito de R$ 1.200 em 6 parcelas, 2 pagas: total R$ 2.200, parcial R$ 1.400, pendente R$ 800.
- [ ] Alterar para 3 pagas e conferir parcial R$ 1.600.
- [ ] R$ 100 em 3 parcelas: parcial após 2 = R$ 66,66 e após 3 = R$ 100.
- [ ] Testar zero e acima do total no campo de parcelas pagas; este último deve ser rejeitado.
- [ ] Ajustar orçamento em um aparelho e confirmar atualização em outro.
- [ ] Testar orçamento zero e gasto acima do orçamento.
- [ ] Criar, desativar e reativar categoria; conferir histórico.
- [ ] Editar e excluir despesa cadastrada por outro familiar.

### Excel

- [ ] Exportar, abrir no Excel/LibreOffice e conferir centavos/datas/acentos.
- [ ] Baixar modelo, substituir a linha EXEMPLO, importar e revisar antes de salvar.
- [ ] Reimportar o mesmo arquivo e confirmar indicação de duplicidades.
- [ ] Testar uma linha inválida junto de uma válida; confirmar apenas a válida.
- [ ] Exportar filtrado e conferir que todas as páginas do filtro estão no arquivo.

### Visual e publicação

- [ ] Testar desktop, celular real, modo claro e escuro.
- [ ] Conferir menu, modal com teclado, foco e ausência de rolagem horizontal da página.
- [ ] Atualizar diretamente `/despesas`, `/conta` e `/admin` no endereço Vercel.
- [ ] Confirmar que nenhum `FIREBASE_PRIVATE_KEY` foi exposto no bundle nem incluído no Git.
- [ ] Confirmar Firebase Spark, Vercel Hobby, variáveis de produção e domínios autorizados.
