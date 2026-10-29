# LclObras — Entregas e critérios

## Aplicação, identidade e acesso
- [x] Criar o app de controle de obras denominado **LclObras**, baseado no app **LclPO**, com interface operacional responsiva em português e registros persistentes; manter autenticação Manus real e não usar usuário fictício.
- [x] Disponibilizar atribuição de perfis operacionais **almoxarife** e **encarregado** aos usuários; validar as permissões no servidor, além de refletir as ações permitidas na interface.

## Obras, contratos, orçamento e centros de custo
- [x] Disponibilizar cadastro de clientes e associar cada obra/contrato a um cliente cadastrado.
- [x] Disponibilizar centros de custo por obra, associados a um contrato com o cliente a ser cadastrado, e um centro de custo de administração.
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

## Planejamento e cronograma
- [x] Disponibilizar controle do cronograma de obra.

## Repositório e entrega
- [ ] Criar/atualizar o repositório `https://github.com/lincolncartaxo/lclobras` com o código baseado no `https://github.com/lincolncartaxo/lclpo`; publicar o código na branch principal sem reescrever ou forçar o histórico remoto.
