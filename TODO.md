# LclObras — Entregas e critérios

## Aplicação, identidade e acesso
- [x] Criar o app de controle de obras denominado **LclObras**, baseado no app **LclPO**, com interface operacional responsiva em português e registros persistentes; manter autenticação Manus real e não usar usuário fictício.
- [x] Promover a única conta já cadastrada para `admin`; esse perfil de superusuário pode realizar todas as operações do app.
- [x] Disponibilizar atribuição de perfis operacionais **almoxarife** e **encarregado** aos usuários; validar as permissões no servidor, além de refletir as ações permitidas na interface.

## Painel administrativo, CRUD e usuários
- [x] Disponibilizar um painel de administração, acessível somente a `admin`, com visão geral e atalhos para CRUD de todos os módulos e registros operacionais do banco, usando as telas e validações de domínio existentes.
- [x] Aplicar o pedido: “o ideal seria que esse admin tivesse acesso a um painel de administração com crud para todo o banco de dados inclusive permissões/perfis de usuários cadastrados”. Administradores podem consultar, criar, editar e excluir registros operacionais em todos os módulos, inclusive pedidos, entradas/recebimentos e retiradas, sem contornar validações de obra, centro de custo, estoque, contratos ou finanças.
- [x] Permitir que o admin altere, para contas que já autenticaram pelo Manus, o papel da aplicação (`user`/`admin`) e o perfil operacional (`administrativo`/`almoxarife`/`encarregado`), separadamente; bloquear a remoção do último administrador e qualquer autodemissão. A conta proprietária do projeto permanece como admin, pois o login a promove automaticamente. Identidades de conta continuam sendo criadas pela autenticação Manus, não por usuários fictícios.
- [x] Preservar as salvaguardas: baixas financeiras são append-only; registros e movimentos com referências ou histórico protegido não podem ser apagados de forma destrutiva; tabelas técnicas internas não são editadas como dados de negócio.

## Obras, contratos, orçamento e centros de custo
- [x] Disponibilizar cadastro de clientes e associar cada obra/contrato a um cliente cadastrado.
- [x] Disponibilizar centros de custo por obra, associados a um contrato com o cliente a ser cadastrado, e um centro de custo de administração.
- [x] Garantir a existência automática de um centro de custo único denominado **Administração Central**, sem vínculo a obra, destinado à manutenção do escritório da empresa; proteger sua identidade para impedir duplicação, renomeação ou exclusão pelo CRUD comum.
- [x] Manter despesas gerais do escritório no centro Administração Central e não rateá-las automaticamente entre as obras.
- [x] Disponibilizar uma planilha contratada/orçamento com itens previstos vinculados à obra, à atividade e ao centro de custo, para comparação com os custos realizados.
- [x] Reforçar a compatibilidade entre obra e centro de custo: custos de obra devem apontar para centro daquela obra; custos administrativos devem apontar para centro de administração, com validação no servidor.
- [x] Permitir armazenar arquivos vinculados aos respectivos registros, como contratos, assinatura de recebimento de material e notas fiscais emitidas para cliente; permitir consultar e abrir/baixar os anexos com controle de acesso.

## Pedidos, compras e fornecedores
- [x] Disponibilizar controle de pedidos (códigos) x controle de compras.
- [x] Disponibilizar cadastro de fornecedores/colaboradores.
- [x] Disponibilizar mapas de equalização (cotação) com condições por fornecedores.
- [x] Disponibilizar controle e medição de contratos de fornecedores.
- [x] Compras, folha e medições aprovadas devem gerar ou atualizar um único lançamento de conta a pagar vinculado ao registro de origem; uma medição “em análise” não pode gerar conta a pagar.

## Almoxarifado e custos de materiais
- [x] Disponibilizar controle de entrada e saídas de materiais do almoxarifado.
- [x] Aplicar a regra: “as entradas/recebimento de material e os pedidos devem ser feitos por almoxarife e as retiradas por encarregado.” Os pedidos e entradas/recebimentos só podem ser registrados por usuário com perfil almoxarife; as retiradas/saídas só podem ser registradas por usuário com perfil encarregado. Cada retirada identifica o encarregado responsável.
- [x] Não permitir registrar retirada acima do saldo disponível para obra, material, unidade e centro de custo.
- [x] Disponibilizar controle de consumo de material associado à quantidade adquirida x o planejado para gastar na atividade, exibindo também o consumo realizado e os desvios.

## Equipe e folha
- [x] Disponibilizar controle de folha.
- [x] A folha deve selecionar colaborador cadastrado e gerar ou atualizar um único lançamento de conta a pagar vinculado ao registro de origem, sem duplicar custos por causa de uma baixa ou pagamento.

## Gestão financeira
- [x] Disponibilizar análise de fluxo de caixa comparando a planilha contratada x custos de obra, considerando todos os custos.
- [x] Disponibilizar controle de contas a receber e contas a pagar.
- [x] Relacionar o fluxo financeiro à obra, registrar vencimentos, baixas totais e parciais e exibir valores em aberto; baixas permanecem vinculadas à conta original, e os compromissos pagos não podem ser contabilizados duas vezes.
- [x] Não permitir apagar ou reverter uma baixa por edição genérica da conta; validar que o total baixado não ultrapasse o valor da conta e calcular o saldo em aberto como total menos baixas.
- [x] Quando houver atraso de recebimento na obra, permitir que a baixa de uma conta a pagar da obra registre que a despesa foi honrada pela Administração Central; a conta continua vinculada à obra e ao centro de custo da obra, não cria saldo de reembolso e o custo é contado uma única vez.
- [x] Calcular e exibir por obra o caixa realizado como recebimentos de clientes efetivamente baixados menos despesas da obra efetivamente pagas, incluindo despesas pagas pela Administração Central; mostrar separadamente o valor coberto pela Central e não incluir overhead do escritório não rateado.
- [x] Exibir na tela inicial e no fluxo de caixa o caixa de cada obra e o resultado contratual: valor do contrato menos custos da obra registrados (contas a pagar pagas e em aberto); antes do encerramento apresentar como projeção e, depois de todos os custos registrados no encerramento, como lucro final.

## Planejamento e cronograma
- [x] Disponibilizar controle do cronograma de obra.

## Repositório e entrega
- [x] Criar/atualizar o repositório `https://github.com/lincolncartaxo/lclobras` com o código baseado no `https://github.com/lincolncartaxo/lclpo`; publicar o código na branch principal sem reescrever ou forçar o histórico remoto (commit inicial `a924ee8`).
- [x] Enviar as mudanças do painel administrativo à branch `main` do repositório `https://github.com/lincolncartaxo/lclobras` e registrar o checkpoint do projeto sem force-push (commit `807f6c9`).

## Publicação via Vercel
- [ ] Fazer a raiz de `https://lclobras.vercel.app/` servir o `index.html` e os assets do build `dist/public`, encaminhar `/api/*` e `/manus-storage/*` ao backend Manus já publicado e permitir deep links da SPA, sem expor o bundle do servidor como página inicial.
