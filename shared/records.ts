export const ADMIN_CENTRAL_COST_CENTER_CODE = "ADM-CENTRAL";
export const ADMIN_CENTRAL_COST_CENTER_SYSTEM_KEY =
  "lclobras:administracao-central";
export const ADMIN_CENTRAL_COST_CENTER_TITLE = "Administração Central";

export const BUSINESS_MODULE_IDS = [
  "obras",
  "clientes",
  "orcamento",
  "centros-custo",
  "pedidos",
  "compras",
  "almoxarifado-entrada",
  "almoxarifado-retirada",
  "fornecedores",
  "colaboradores",
  "cotacoes",
  "contratos-fornecedor",
  "medicoes",
  "folha",
  "consumo",
  "contas-receber",
  "contas-pagar",
  "cronograma",
] as const;

export type BusinessModuleId = (typeof BUSINESS_MODULE_IDS)[number];
export type OperationalRole = "administrativo" | "almoxarife" | "encarregado";
export type AppRole = "user" | "admin";

export const MODULE_REQUIRED_ROLE: Partial<
  Record<BusinessModuleId, OperationalRole>
> = {
  pedidos: "almoxarife",
  "almoxarifado-entrada": "almoxarife",
  "almoxarifado-retirada": "encarregado",
};

export function canWriteModule(
  module: BusinessModuleId,
  role: AppRole,
  operationalRole: OperationalRole
): boolean {
  if (role === "admin") return true;
  const requiredRole = MODULE_REQUIRED_ROLE[module];
  return !requiredRole || operationalRole === requiredRole;
}
