# LclObras — Entregas e critérios

## Aplicação, identidade e acesso
- [x] Criar o app de controle de obras denominado **LclObras**, baseado no app **LclPO**, com interface operacional responsiva em português e registros persistentes; manter autenticação Manus real e não usar usuário fictício.
- [x] Promover a única conta já cadastrada para `admin`; esse perfil de superusuário pode realizar todas as operações do app.
- [x] Disponibilizar atribuição de perfis operacionais **almoxarife** e **encarregado** aos usuários; validar as permissões no servidor, além de refletir as ações permitidas na interface.
- [x] Implementar o cadastro local escolhido pelo usuário: qualquer visitante pode solicitar uma conta com e-mail e senha, mas a solicitação começa pendente, não recebe sessão e não acessa dados/procedures protegidas até aprovação de um administrador; as contas Manus existentes permanecem aprovadas.
- [x] Permitir que somente administradores aprovem ou rejeitem solicitações locais no painel de usuários; verificar o estado em cada autenticação e invalidar tokens já emitidos por meio de `sessionVersion`, incrementada ao mudar aprovação ou senha, para que uma conta rejeitada/revogada não recupere acesso mesmo se depois for aprovada novamente.
- [x] Garantir que cadastro local sempre crie papel `user`; não conceder `admin` por e-mail autodeclarado. A resposta pública de `auth.me`, cadastro e login não pode incluir `passwordHash` nem `passwordSalt`; limitar tentativas públicas e rejeitar submissões cross-site em formato de formulário.

## Painel administrativo, CRUD e usuários
- [x] Disponibilizar um painel de administração, acessível somente a `admin`, com visão geral e atalhos para CRUD de todos os módulos e registros operacionais do banco, usando as telas e validações de domínio existentes.
- [x] Aplicar o pedido: “o ideal seria que esse admin tivesse acesso a um painel de administração com crud para todo o banco de dados inclusive permissões/perfis de usuários cadastrados”. Administradores podem consultar, criar, editar e excluir registros operacionais em todos os módulos, inclusive pedidos, entradas/recebimentos e retiradas, sem contornar validações de obra, centro de custo, estoque, contratos ou finanças.
- [x] Permitir que o admin altere, para contas autenticadas e aprovadas, o papel da aplicação (`user`/`admin`) e o perfil operacional (`administrativo`/`almoxarife`/`encarregado`), separadamente; bloquear a remoção do último administrador e qualquer autodemissão. A conta proprietária do projeto permanece como admin por sua identidade Manus autenticada (`OWNER_OPEN_ID`), nunca por um endereço de e-mail autodeclarado.
- [x] Preservar as salvaguardas: baixas financeiras são append-only; registros e movimentos com referências ou histórico protegido não podem ser apagados de forma destrutiva; tabelas técnicas internas não são editadas como dados de negócio.

## Formulários e campos por finalidade
- [x] Revisar todos os formulários do app para evitar campos desnecessários; remover campos genéricos sem finalidade operacional no módulo e preservar os usados por validações, estoque, financeiro, contratos, cronograma, permissões e vínculos. Usar allowlist obrigatória por módulo (`visibleBaseFields`); campos-base novos ficam ocultos até inclusão explícita e não há fallback que os exiba em todos os formulários. Campos ocultos não são renderizados em formulário/lista e valores históricos não são apagados nem zerados ao editar.
- [x] No cadastro de Clientes, manter identificação e dados de contato (nome/razão social, CNPJ/CPF, contato principal, telefone, e-mail e endereço de cobrança); remover código interno genérico, valor total, quantidade, data de registro, status de etapa genérico e responsável duplicado. O valor contratado permanece no cadastro da obra/contrato.
- [x] No cadastro de Centros de custo, ocultar código editável, valor, quantidade, data e responsável genéricos; manter nome, tipo, responsável específico e observação; mostrar e exigir a obra somente quando o tipo for **Obra**, e limpar o vínculo quando o tipo for **Administração**. Preservar o código protegido da Administração Central e o status ativo/cancelado usado pelas validações.
- [x] Nos cadastros de Fornecedores, manter código como **Código interno do fornecedor**, pois ele identifica o fornecedor nos seletores; remover valor, quantidade, data, status de etapa, responsável, obra e centro genéricos; manter nome, CNPJ/CPF, contato, telefone, e-mail e condição comercial.
- [x] Nos demais módulos, exibir campos-base por finalidade: em Obras, manter código interno, valor contratado, cliente, status e responsável e remover quantidade/data genéricas; em Orçamento, manter item, obra, centro, valor e status, ocultar quantidade/data/responsável genéricos sem retirar o fallback legado `record.quantity`; em Cronograma, manter obra, responsável e status e usar datas/progresso específicos do cronograma.
- [x] Em Pedidos, manter código obrigatório/único, obra, centro, quantidade solicitada, prazo necessário, almoxarife responsável e status; ocultar valor, quantidade e data genéricos. Em Compras, manter código, valor, obra, centro, status, data da compra, fornecedor, material, quantidade comprada e vencimento; ocultar apenas quantidade genérica. Em Cotações, manter código obrigatório, obra, item, fornecedor, preço unitário, prazo, condição e validade, sem centro, valor/quantidade/data/status/responsável genéricos. Em Contratos de fornecedores, manter código de identificação usado nos seletores, obra, fornecedor, valor contratado opcional, número oficial, escopo, vigência e status, sem quantidade/data/responsável genéricos.
- [x] Em Medições, manter obra, centro, contrato, fornecedor, período, quantidade executada, nota fiscal, status, valor aprovado e vencimento; exigir valor/vencimento somente quando aprovado ou concluído, identificar a data como **Data da medição** e ocultar quantidade genérica. Em Entradas e Retiradas de almoxarifado, manter quantidade específica (recebida/retirada), data, status e vínculo de obra/centro, remover valor/código genéricos; a retirada exige **Encarregado responsável**. Em Consumo, manter material, atividade, unidade e as três quantidades específicas; remover código/valor/quantidade/status/responsável genéricos e identificar a data opcional como **Data do consumo**.
- [x] Em Colaboradores, manter nome e dados pessoais/função/admissão e ocultar código/valor/quantidade/data/status/responsável genéricos. Em Folha, manter colaborador, período, bruto, descontos e vencimento; o valor líquido é calculado e somente leitura, sem quantidade genérica. Em Contas a pagar/receber, manter valor e vencimento obrigatórios e detalhes de documento/parcela; status é derivado do financeiro e quantidade/responsável/código/status genéricos não são editáveis.
- [x] Revisar também os formulários especializados: no login, aplicar senha mínima de 8 caracteres somente no cadastro e nome entre 2 e 160; nos anexos, manter limite de 10 MB e PDF/PNG/JPG/WEBP/XML/TXT, informando TXT na mensagem; nas baixas, distinguir recebimento de pagamento nos rótulos, validar datas de calendário e manter a baixa imutável; no avanço físico-financeiro, identificar código/atividade/quantidade/unidade do item e rotular a observação como opcional; na administração, impedir alteração visual da aprovação da própria conta/proprietária e desabilitar perfil operacional de conta local não aprovada.

## Obras, contratos, orçamento e centros de custo
- [x] Disponibilizar cadastro de clientes e associar cada obra/contrato a um cliente cadastrado.
- [x] Disponibilizar centros de custo por obra, associados a um contrato com o cliente a ser cadastrado, e um centro de custo de administração.
- [x] Garantir a existência automática de um centro de custo único denominado **Administração Central**, sem vínculo a obra, destinado à manutenção do escritório da empresa; proteger sua identidade para impedir duplicação, renomeação ou exclusão pelo CRUD comum.
- [x] Manter despesas gerais do escritório no centro Administração Central e não rateá-las automaticamente entre as obras.
- [x] Disponibilizar uma planilha contratada/orçamento com itens previstos vinculados à obra, à atividade e ao centro de custo, para comparação com os custos realizados.
- [x] Reforçar a compatibilidade entre obra e centro de custo: custos de obra devem apontar para centro daquela obra; custos administrativos devem apontar para centro de administração, com validação no servidor.
- [x] Permitir armazenar arquivos vinculados aos respectivos registros, como contratos, assinatura de recebimento de material e notas fiscais emitidas para cliente; permitir consultar e abrir/baixar os anexos com controle de acesso.

## Avanço físico x financeiro por item
- [x] Para cada item ativo da planilha contratada de uma obra, registrar snapshots cumulativos por data com avanço físico (%) e valor acumulado de medição aprovado pelo cliente (R$); corrigir a mesma data sem criar duplicidade e preservar o histórico das demais datas.
- [x] Comparar cada item usando valor físico equivalente = valor contratado do item × avanço físico; avanço financeiro = medição aprovada acumulada ÷ valor contratado; diferença em R$ = medição aprovada − valor físico equivalente; diferença em pontos percentuais = avanço financeiro − avanço físico. Indicar que positivo é valor aprovado à frente e negativo é execução física à frente.
- [x] Exibir uma visão ponderada pelo valor contratado, filtrável por obra, com valores contratados, físico, medição aprovada, percentuais, diferenças em reais e pontos percentuais, data da última medição e histórico por item; não usar média simples dos percentuais.
- [x] Disponibilizar a tela em português na navegação e no manifesto de rotas; proteger leitura com autenticação, permitir gravação/correção somente a administradores e validar no servidor vínculo do item/obra, data válida não futura, percentuais (0% a 100%) e que a medição aprovada não exceda o valor contratado vigente.
- [x] Diferenciar medição aprovada de faturamento e recebimento: valores aprovados por item não alteram contas a receber nem caixa; recebimentos efetivos continuam sendo registrados no fluxo financeiro.

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
- [x] Fazer a raiz de `https://lclobras.vercel.app/` servir o `index.html` e os assets do build `dist/public`, encaminhar `/api/*` e `/manus-storage/*` ao backend Manus já publicado e permitir deep links da SPA, sem expor o bundle do servidor como página inicial.
- [ ] Solicitar ao suporte Manus a autorização do domínio `lclobras.vercel.app` como `redirect_uri` permitido do OAuth deste projeto; até isso ser liberado, o login Manus na Vercel permanece bloqueado pelo erro de domínio não permitido.

## Migração do banco para HostGator
- [x] Preparar configuração Drizzle separada para HostGator e comandos explícitos `db:migrate:hostgator`/`db:copy:hostgator`; `APP_DATABASE_URL` é obrigatório para o destino e não há fallback para `DATABASE_URL`. Manter o runtime atual no banco Manus até a migração e a confirmação final.
- [x] Impedir que `db:migrate:hostgator` use como destino o mesmo host, porta e banco indicados em `DATABASE_URL`; abortar antes de executar DDL quando origem e destino não puderem ser distinguidos.
- [ ] Solicitar `APP_DATABASE_URL` pelo formulário protegido do projeto; usar primeiro o escopo Development para aplicar schema e preparar a cópia. Nunca pedir ou registrar DSN no chat, código, Git, terminal ou logs.
- [ ] Confirmar acesso remoto HostGator por endereço/IP específico e porta 3306; solicitar ao suporte Manus confirmação de IP de saída fixo do runtime e liberar somente esse IP. Nunca liberar o banco usando `%` ou `0.0.0.0/0`; o Workbench do usuário requer allowlist própria.
- [ ] Aplicar ao banco HostGator vazio as migrações Drizzle e copiar todas as tabelas de aplicação preservando IDs, papéis, registros financeiros, medições, referências de anexos e contadores `AUTO_INCREMENT`, sem apagar nem alterar o banco origem.
- [ ] Executar a cópia final em janela de manutenção: congelar gravações na origem e manter exclusividade de escrita no destino. O migrador exige `--confirm-empty-target`, `--confirm-source-write-freeze` e `--confirm-exclusive-target`; não oferece sincronização incremental nem aceita destino preenchido.
- [ ] Comparar estrutura completa (colunas/tipos/defaults, índices, constraints, collations e FKs), exigir InnoDB e UTC nas duas pontas, comparar contagens e hashes dos valores por tabela e validar referências antes de solicitar confirmação final para mudar o runtime para `APP_DATABASE_URL`; não trocar o banco ativo se houver divergências.
- [ ] Somente após validação sem divergências e confirmação explícita do usuário, configurar `APP_DATABASE_URL` em Production e fazer o runtime usar HostGator. Preservar o banco Manus como contingência; documentar que gravações posteriores ao cutover não são replicadas automaticamente para a origem.
