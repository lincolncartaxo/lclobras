import {
  Banknote,
  Building2,
  CalendarDays,
  ClipboardList,
  FileCheck2,
  FileSpreadsheet,
  HardHat,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  ReceiptText,
  Scale,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { BusinessModuleId } from "@shared/records";

export type FieldDefinition = {
  key: string;
  label: string;
  required?: boolean;
  kind?: "text" | "number" | "date" | "textarea" | "select";
  placeholder?: string;
  options?: string[];
};

export type ModuleDefinition = {
  id: BusinessModuleId | "fluxo-caixa";
  title: string;
  shortTitle: string;
  group: string;
  description: string;
  icon: LucideIcon;
  fields?: FieldDefinition[];
  showWork?: boolean;
  showCostCenter?: boolean;
  requireCostCenter?: boolean;
  requireAmount?: boolean;
  report?: boolean;
};

export const MODULES: ModuleDefinition[] = [
  {
    id: "obras",
    title: "Obras e contratos",
    shortTitle: "Obras",
    group: "Obras",
    description: "Cadastre obras, clientes, contratos e valores contratados.",
    icon: Building2,
    requireAmount: true,
    fields: [
      { key: "cliente", label: "Cliente / contratante", required: true },
      { key: "numeroContrato", label: "Nº do contrato" },
      { key: "local", label: "Local da obra" },
      { key: "dataInicio", label: "Início previsto", kind: "date" },
      { key: "dataFim", label: "Término previsto", kind: "date" },
    ],
  },
  {
    id: "clientes",
    title: "Clientes",
    shortTitle: "Clientes",
    group: "Obras",
    description: "Cadastre os contratantes e seus dados de contato.",
    icon: Building2,
    fields: [
      { key: "documento", label: "CNPJ / CPF" },
      { key: "contato", label: "Contato principal" },
      { key: "telefone", label: "Telefone" },
      { key: "email", label: "E-mail" },
      { key: "endereco", label: "Endereço de cobrança", kind: "textarea" },
    ],
  },
  {
    id: "orcamento",
    title: "Planilha contratada",
    shortTitle: "Orçamento",
    group: "Obras",
    description:
      "Cadastre itens e valores previstos por atividade, obra e centro de custo.",
    icon: FileSpreadsheet,
    showWork: true,
    showCostCenter: true,
    requireCostCenter: true,
    requireAmount: true,
    fields: [
      { key: "atividade", label: "Atividade / etapa" },
      { key: "categoria", label: "Categoria de custo" },
      {
        key: "quantidadeContratada",
        label: "Quantidade contratada",
        kind: "number",
      },
      { key: "unidade", label: "Unidade" },
      { key: "valorUnitario", label: "Valor unitário (R$)", kind: "number" },
    ],
  },
  {
    id: "centros-custo",
    title: "Centros de custo",
    shortTitle: "Centros de custo",
    group: "Obras",
    description:
      "Use a Administração Central para despesas do escritório e centros próprios para cada obra.",
    icon: Wallet,
    showWork: true,
    fields: [
      {
        key: "tipo",
        label: "Vinculação",
        kind: "select",
        options: ["Obra", "Administração"],
      },
      { key: "responsavelCentro", label: "Responsável pelo centro" },
      { key: "observacao", label: "Observações", kind: "textarea" },
    ],
  },
  {
    id: "cronograma",
    title: "Cronograma de obra",
    shortTitle: "Cronograma",
    group: "Obras",
    description:
      "Planeje frentes, prazos, responsáveis e avanço das atividades.",
    icon: CalendarDays,
    showWork: true,
    fields: [
      { key: "inicio", label: "Data de início", kind: "date" },
      { key: "termino", label: "Data de término", kind: "date" },
      { key: "avanco", label: "Avanço físico (%)", kind: "number" },
      { key: "predecessora", label: "Atividade predecessora" },
    ],
  },
  {
    id: "pedidos",
    title: "Pedidos de materiais",
    shortTitle: "Pedidos",
    group: "Suprimentos",
    description:
      "Registre pedidos com código, obra, item, quantidade e prazo necessário.",
    icon: ClipboardList,
    showWork: true,
    showCostCenter: true,
    requireCostCenter: true,
    fields: [
      { key: "material", label: "Material / serviço" },
      { key: "unidade", label: "Unidade", placeholder: "un, m, kg…" },
      {
        key: "quantidadeSolicitada",
        label: "Quantidade solicitada",
        kind: "number",
      },
      { key: "necessarioEm", label: "Necessário até", kind: "date" },
    ],
  },
  {
    id: "compras",
    title: "Compras",
    shortTitle: "Compras",
    group: "Suprimentos",
    description: "Acompanhe compras em relação ao pedido de origem e à obra.",
    icon: ShoppingCart,
    showWork: true,
    showCostCenter: true,
    requireCostCenter: true,
    requireAmount: true,
    fields: [
      { key: "pedidoOrigem", label: "Código do pedido" },
      { key: "fornecedor", label: "Fornecedor", required: true },
      { key: "material", label: "Material / serviço", required: true },
      { key: "quantidadeComprada", label: "Quantidade", kind: "number" },
      {
        key: "vencimento",
        label: "Vencimento do compromisso",
        kind: "date",
        required: true,
      },
    ],
  },
  {
    id: "cotacoes",
    title: "Cotações e equalização",
    shortTitle: "Cotações",
    group: "Suprimentos",
    description: "Compare fornecedores, preços, prazos e condições comerciais.",
    icon: Scale,
    showWork: true,
    fields: [
      { key: "itemCotado", label: "Item cotado", required: true },
      { key: "fornecedor", label: "Fornecedor", required: true },
      {
        key: "precoUnitario",
        label: "Preço unitário",
        kind: "number",
        required: true,
      },
      { key: "prazoEntrega", label: "Prazo de entrega", required: true },
      {
        key: "condicaoPagamento",
        label: "Condição de pagamento",
        required: true,
      },
      { key: "validade", label: "Validade da proposta", kind: "date" },
    ],
  },
  {
    id: "fornecedores",
    title: "Fornecedores",
    shortTitle: "Fornecedores",
    group: "Suprimentos",
    description: "Mantenha os dados comerciais e contatos dos fornecedores.",
    icon: Truck,
    fields: [
      { key: "documento", label: "CNPJ / CPF" },
      { key: "contato", label: "Contato" },
      { key: "telefone", label: "Telefone" },
      { key: "email", label: "E-mail" },
      { key: "condicaoPadrao", label: "Condição comercial padrão" },
    ],
  },
  {
    id: "contratos-fornecedor",
    title: "Contratos de fornecedores",
    shortTitle: "Contratos terceiros",
    group: "Suprimentos",
    description: "Controle escopo, valor, fornecedor e vigência contratual.",
    icon: FileCheck2,
    showWork: true,
    fields: [
      { key: "fornecedor", label: "Fornecedor", required: true },
      { key: "numeroContrato", label: "Nº do contrato" },
      { key: "escopo", label: "Escopo contratado", kind: "textarea" },
      { key: "vigenciaAte", label: "Vigência até", kind: "date" },
    ],
  },
  {
    id: "medicoes",
    title: "Medições de contratos",
    shortTitle: "Medições",
    group: "Suprimentos",
    description: "Registre períodos, quantidades executadas e valores medidos.",
    icon: FileSpreadsheet,
    showWork: true,
    showCostCenter: true,
    requireCostCenter: true,
    fields: [
      {
        key: "contratoFornecedor",
        label: "Contrato do fornecedor",
        required: true,
      },
      { key: "fornecedor", label: "Fornecedor", required: true },
      { key: "periodo", label: "Período medido" },
      {
        key: "quantidadeExecutada",
        label: "Quantidade executada",
        kind: "number",
      },
      { key: "notaFiscal", label: "Nota fiscal / documento" },
      { key: "vencimento", label: "Vencimento após aprovação", kind: "date" },
    ],
  },
  {
    id: "almoxarifado-entrada",
    title: "Recebimentos de materiais",
    shortTitle: "Entradas",
    group: "Almoxarifado",
    description:
      "Registre recebimentos e conferências de material no almoxarifado.",
    icon: PackagePlus,
    showWork: true,
    showCostCenter: true,
    requireCostCenter: true,
    fields: [
      { key: "material", label: "Material recebido", required: true },
      { key: "unidade", label: "Unidade", required: true },
      { key: "pedidoOrigem", label: "Código do pedido / compra" },
      { key: "documento", label: "Nota fiscal / documento" },
      {
        key: "observacao",
        label: "Conferência / observações",
        kind: "textarea",
      },
    ],
  },
  {
    id: "almoxarifado-retirada",
    title: "Retiradas de materiais",
    shortTitle: "Retiradas",
    group: "Almoxarifado",
    description:
      "Registre a saída do estoque e identifique o encarregado responsável.",
    icon: PackageMinus,
    showWork: true,
    showCostCenter: true,
    requireCostCenter: true,
    fields: [
      { key: "material", label: "Material retirado", required: true },
      { key: "unidade", label: "Unidade", required: true },
      { key: "atividade", label: "Atividade / frente de serviço" },
      { key: "equipe", label: "Equipe" },
      { key: "observacao", label: "Observações", kind: "textarea" },
    ],
  },
  {
    id: "consumo",
    title: "Consumo de materiais",
    shortTitle: "Consumo",
    group: "Almoxarifado",
    description:
      "Compare material adquirido, planejamento da atividade e consumo realizado.",
    icon: PackageCheck,
    showWork: true,
    showCostCenter: true,
    requireCostCenter: true,
    fields: [
      { key: "material", label: "Material", required: true },
      { key: "atividade", label: "Atividade planejada", required: true },
      { key: "unidade", label: "Unidade", required: true },
      {
        key: "quantidadeAdquirida",
        label: "Quantidade adquirida",
        kind: "number",
        required: true,
      },
      {
        key: "quantidadePlanejada",
        label: "Quantidade planejada",
        kind: "number",
        required: true,
      },
      {
        key: "quantidadeConsumida",
        label: "Quantidade consumida",
        kind: "number",
        required: true,
      },
    ],
  },
  {
    id: "colaboradores",
    title: "Colaboradores",
    shortTitle: "Colaboradores",
    group: "Equipe",
    description: "Cadastre profissionais e dados básicos da equipe.",
    icon: Users,
    fields: [
      { key: "documento", label: "CPF" },
      { key: "funcao", label: "Função" },
      { key: "telefone", label: "Telefone" },
      { key: "dataAdmissao", label: "Data de admissão", kind: "date" },
    ],
  },
  {
    id: "folha",
    title: "Folha e mão de obra",
    shortTitle: "Folha",
    group: "Equipe",
    description:
      "Acompanhe período, colaborador e valor líquido da folha por obra.",
    icon: HardHat,
    showWork: true,
    showCostCenter: true,
    requireCostCenter: true,
    requireAmount: true,
    fields: [
      { key: "colaborador", label: "Colaborador", required: true },
      { key: "periodo", label: "Período de referência" },
      {
        key: "valorBruto",
        label: "Valor bruto",
        kind: "number",
        required: true,
      },
      { key: "descontos", label: "Descontos", kind: "number" },
      {
        key: "vencimento",
        label: "Vencimento da folha",
        kind: "date",
        required: true,
      },
    ],
  },
  {
    id: "contas-receber",
    title: "Contas a receber",
    shortTitle: "A receber",
    group: "Financeiro",
    description:
      "Controle parcelas, documentos, vencimentos e recebimentos de clientes.",
    icon: ReceiptText,
    showWork: true,
    requireAmount: true,
    fields: [
      { key: "cliente", label: "Cliente", required: true },
      { key: "documento", label: "Documento / parcela" },
      { key: "categoria", label: "Categoria" },
      { key: "vencimento", label: "Vencimento", kind: "date", required: true },
    ],
  },
  {
    id: "contas-pagar",
    title: "Contas a pagar",
    shortTitle: "A pagar",
    group: "Financeiro",
    description:
      "Controle compromissos, vencimentos, baixas parciais e categorias de custo.",
    icon: Banknote,
    showWork: true,
    showCostCenter: true,
    requireCostCenter: true,
    requireAmount: true,
    fields: [
      { key: "fornecedor", label: "Fornecedor / favorecido" },
      { key: "documento", label: "Documento / parcela" },
      {
        key: "categoria",
        label: "Categoria de custo",
        kind: "select",
        options: [
          "Materiais",
          "Serviços",
          "Equipe / folha",
          "Equipamentos",
          "Tributos",
          "Administração",
          "Outros",
        ],
      },
      { key: "vencimento", label: "Vencimento", kind: "date", required: true },
    ],
  },
  {
    id: "fluxo-caixa",
    title: "Fluxo de caixa",
    shortTitle: "Fluxo de caixa",
    group: "Financeiro",
    description:
      "Compare valores contratados, custos registrados e recebimentos por obra.",
    icon: Wallet,
    report: true,
  },
];

export const NAV_GROUPS = [
  "Obras",
  "Suprimentos",
  "Almoxarifado",
  "Equipe",
  "Financeiro",
];
export const getModule = (id?: string) =>
  MODULES.find(module => module.id === id);
