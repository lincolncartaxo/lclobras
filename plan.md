# Plano do LclObras

## Objetivo e abordagem

Construir uma aplicação autenticada de gestão de obras, baseada na experiência visual e no domínio operacional do LclPO, mas adaptada aos fluxos do LclObras. A aplicação terá módulos para clientes, obras, contratos, orçamento, centros de custo, suprimentos, almoxarifado, equipe, folha, financeiro e cronograma. A interface e os dados devem ser em português brasileiro; cadastros e lançamentos persistem no banco gerenciado do projeto.

O repositório de destino pedido é `https://github.com/lincolncartaxo/lclobras`, tomando `https://github.com/lincolncartaxo/lclpo` como referência. A captura do desenvolvimento anterior foi incorporada como referência funcional; seu detalhe de stack TanStack Start não substitui a stack do projeto WebDev já inicializado e aprovado, para evitar transplantar outro runtime durante a implementação.

## Arquitetura e integração

- **Frontend:** React e TypeScript, Vite, Wouter para rotas, componentes shadcn/ui e lucide-react; páginas em `client/src/pages`, shell autenticado em `client/src/components` e definições de formulário/navegação em `client/src/modules`.
- **Servidor:** Express e tRPC, com procedures autenticadas em `server/routers.ts`; regras de perfil, autorização, validação de relações, estoque, finanças e anexos são aplicadas no servidor, além da interface.
- **Dados:** Drizzle/MySQL no banco gerenciado do projeto. `drizzle/schema.ts` descreve usuários, registros operacionais, referências de origem, anexos e baixas; migrações versionadas em `drizzle/`. `server/db.ts` concentra operações persistentes e `shared/records.ts` define os tipos e módulos compartilhados.
- **Arquivos:** armazenamento durável gerenciado do projeto. O banco mantém metadados privados e vínculo com o registro; download passa por procedure autenticada e URL temporária. O servidor valida perfil, tamanho e formato do arquivo.
- **Servidor local e publicação:** o processo full-stack usa a porta configurada pelo WebDev e disponibiliza `/api/health`; o manifesto `client/public/manus-routes.json` declara as rotas de página. A identidade da plataforma é configurada por `app.config.ts`.
- **Stack e dependências:** preservar o starter WebDev já inicializado e suas dependências existentes; reutilizar a organização visual de LclPO, sem adicionar outro runtime ou bibliotecas desnecessárias.

## Modelo de domínio e regras principais

Os registros de negócio usam estrutura compartilhada, com `module`, título/código, obra, centro de custo, quantidade, valor, data, estado, responsável e detalhes específicos. IDs de obra, centro de custo, usuário e origem são validados no servidor. Cliente, fornecedor e colaborador são selecionados de seus cadastros-mestre; nomes vinculados a contratos, recebíveis, suprimentos ou folha não podem ser renomeados/excluídos enquanto houver referências.

- Obras relacionam um cliente cadastrado, número de contrato, valor contratado, vigência e documentos. A planilha contratada é lançada por itens/atividades vinculados à obra e a centros de custo; o centro de Administração é separado dos centros de obra.
- Pedidos conservam códigos únicos que podem ser associados às compras; recebimentos podem referenciar pedido/compra da mesma obra e centro. Cotações mantêm fornecedor cadastrado, preço, prazo, condição comercial e validade para equalização. Contratos de terceiros e medições permanecem ligados ao fornecedor e à obra.
- Perfis **almoxarife** e **encarregado** são atribuídos por administrador. Pedidos e recebimentos/entradas só podem ser criados/editados pelo almoxarife; retiradas/saídas somente pelo encarregado. Cada retirada identifica o encarregado responsável. Estoque é calculado pelas entradas menos retiradas ativas e a retirada não pode superar o saldo disponível da obra, material, unidade e centro de custo; movimentos cancelados são excluídos da posição.
- Consumo de material é associado à obra, centro de custo, atividade, quantidade adquirida, quantidade planejada e quantidade consumida, exibindo desvios.
- Folha seleciona colaborador cadastrado, calcula o líquido como bruto menos descontos e gera ou atualiza uma única conta a pagar vinculada ao registro de origem. Compras e medições aprovadas também geram ou atualizam um único lançamento de contas a pagar, com referência única. Medições em análise não geram obrigação.
- Contas a pagar e receber mantêm o valor total e vencimento. Baixas parciais/totais são registros separados, append-only, vinculados à conta e não podem ser editados/apagados pelo fluxo genérico. O saldo aberto é total menos baixas; não são criadas contas adicionais para parcelas baixadas, evitando dupla contagem. Recebíveis devem apontar para o cliente do contrato da obra.
- Fluxo financeiro por obra compara contrato do cliente, planilha prevista, custos comprometidos, baixas, valores a pagar/a receber em aberto e saldo contratual. Custos pagos continuam compondo o custo total uma só vez. Gastos do centro de Administração aparecem no total consolidado e não são atribuídos artificialmente a uma obra.
- Anexos podem ser vinculados aos registros, incluindo contratos, assinaturas de recebimento de material e notas fiscais emitidas ao cliente. A aplicação exige autenticação para emitir links temporários de download.

## Estrutura principal do projeto

- `client/src/pages/Home.tsx`: painel executivo e indicadores por obra.
- `client/src/pages/ModulePage.tsx`: cadastros/listagens operacionais, relatórios de fluxo, anexos e baixas.
- `client/src/pages/UsersPage.tsx`: atribuição administrativa dos perfis operacionais.
- `client/src/components/DashboardLayout.tsx`: navegação e identidade do LclObras.
- `client/src/modules/definitions.ts`: nomes, grupos, campos e regras da interface por módulo.
- `client/public/manus-routes.json`: rotas públicas de página reconhecidas pelo WebDev.
- `server/routers.ts`: procedures tRPC autenticadas, regras e validações de domínio.
- `server/db.ts` e `server/storage.ts`: persistência e integração do armazenamento gerenciado.
- `drizzle/schema.ts`, `drizzle/relations.ts` e `drizzle/*.sql`: modelo relacional e migrações aditivas.
- `shared/records.ts`: contratos de tipos e permissões compartilhados entre cliente e servidor.
- `plan.md` e `TODO.md`: decisões aprovadas e resultados/critério de aceite rastreáveis.

## Direção de design

Três direções possíveis, com probabilidades residuais: **blueprint editorial industrial (0,06)**, uma interface de prancheta técnica clara com anotações de obra; **Swiss ledger (0,03)**, um livro de controle tipográfico e rigoroso; **terminal de canteiro (0,02)**, uma estética utilitária escura e densa. Escolha: blueprint editorial industrial, coerente com o LclPO e com um sistema usado por engenharia, compras, almoxarifado e financeiro.

- **Movimento de design:** editorial técnico de engenharia, combinando disciplina de prancheta de obra com a clareza de um SaaS operacional contemporâneo.
- **Princípios centrais:** leitura rápida; rastreabilidade por obra/centro/origem; densidade de dados sem ruído; ações e permissões visíveis por perfil.
- **Filosofia de cor:** navegação azul-marinho dá estabilidade; superfícies quentes e claras reduzem fadiga em tabelas; âmbar de segurança assinala ação, seleção e alertas; verde e vermelho ficam reservados a saldo positivo e exceções. Cor de marca própria: âmbar de obra `#E58A31`.
- **Paradigma de layout:** shell de navegação lateral, cabeçalho de módulo com contexto da obra, tabelas largas como área primária e painéis/detalhes no contexto do registro; no celular, navegação e conteúdo se reorganizam sem reduzir a tabela a cartões ilegíveis.
- **Elementos de assinatura:** marca geométrica em forma de canto de planta/estrutura com linhas de nível; marcadores âmbar de status; números financeiros alinhados e subtítulos técnicos compactos.
- **Interação:** salvar com confirmação visual, validação próxima do campo, estados de carregamento/erro claros e confirmação explícita antes de ações destrutivas; permissões explicadas no contexto, não só ocultadas.
- **Animação:** transições curtas e discretas (120–180 ms) em diálogos, navegação e feedback; sem animação decorativa de métricas financeiras.
- **Tipografia:** Inter com fallback sans-serif do sistema para interface; `ui-monospace`/monospace para códigos, quantidades e referências, com hierarquia consistente entre título do módulo, contexto e metadados.
- **Essência de marca:** “controle de campo e escritório conectado, do pedido ao fluxo de caixa”; personalidade: precisa, pragmática e confiável.
- **Voz da marca:** títulos claros e operacionais, chamadas no imperativo curto e mensagens específicas. Exemplos: “Obra em foco: custos, prazos e materiais no mesmo lugar.”; “Registre a entrada para atualizar o saldo do almoxarifado.”
- **Wordmark e símbolo:** logotipo tipográfico LclObras acompanhado por um monograma original “L” formado por cantos de planta, linha de base e dois traços de nível, usando âmbar como detalhe. Não reutilizar a marca do LclPO como se fosse o logotipo do LclObras.

## Decisões recuperadas da captura do projeto anterior

A captura enviada pelo usuário reforça o modelo financeiro reconciliável, a geração vinculada de contas a pagar, as baixas parciais, a prevenção de reversões/duplicidades, a aprovação antes de reconhecer medições e a compatibilidade estrita entre obra e centro de custo. Essas regras estão detalhadas no modelo de domínio acima e nos critérios completos do `TODO.md`.
