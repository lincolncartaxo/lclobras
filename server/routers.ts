import { COOKIE_NAME } from "@shared/const";
import {
  ADMIN_CENTRAL_COST_CENTER_CODE,
  ADMIN_CENTRAL_COST_CENTER_SYSTEM_KEY,
  ADMIN_CENTRAL_COST_CENTER_TITLE,
  BUSINESS_MODULE_IDS,
  type BusinessModuleId,
} from "@shared/records";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { BusinessRecord } from "../drizzle/schema";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import {
  deleteBusinessRecord,
  ensureAdministrationCentralCostCenter,
  getBusinessRecord,
  getAdminDashboardCounts,
  getRecordAttachment,
  insertBusinessRecord,
  insertStockMovement,
  insertRecordAttachment,
  insertRecordSettlementSafely,
  listAllRecordSettlements,
  listBusinessRecords,
  listBusinessUsers,
  listRecordAttachments,
  listRecordSettlements,
  UserAccountRoleChangeError,
  InsufficientStockError,
  RecordHasSettlementsError,
  normalizeStockMaterial,
  normalizeStockUnit,
  SettlementExceedsBalanceError,
  SettlementPayerValidationError,
  SettledAmountExceededError,
  setUserAccountRoleSafely,
  setUserOperationalRole,
  updateFinancialRecordSafely,
  updateStockMovement,
  updateBusinessRecord,
} from "./db";
import { calculateWorkFinanceMetrics } from "./finance";
import { storageGetSignedUrl, storagePut } from "./storage";
import {
  BudgetItemProgressIntegrityError,
  listAllBudgetItemProgress,
  saveBudgetItemProgressSafely,
} from "./db";

const moduleSchema = z.enum(BUSINESS_MODULE_IDS);
const roleSchema = z.enum(["administrativo", "almoxarife", "encarregado"]);
const accountRoleSchema = z.enum(["user", "admin"]);
const attachmentCategorySchema = z.enum([
  "contrato",
  "assinatura_recebimento",
  "nota_fiscal_cliente",
  "outro",
]);
const recordInput = z.object({
  module: moduleSchema,
  code: z.string().trim().max(80).optional().nullable(),
  title: z.string().trim().min(1).max(240),
  workId: z.number().int().positive().optional().nullable(),
  costCenterId: z.number().int().positive().optional().nullable(),
  amount: z
    .number()
    .finite()
    .nonnegative()
    .refine(
      value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7,
      "Use no máximo duas casas decimais."
    )
    .optional()
    .nullable(),
  quantity: z.number().finite().nonnegative().optional().nullable(),
  recordDate: z.string().max(10).optional().nullable(),
  status: z.string().trim().min(1).max(40).default("planejado"),
  responsible: z.string().trim().max(180).optional().nullable(),
  details: z.record(z.string(), z.unknown()).default({}),
});
const modulesRequiringWork = new Set<BusinessModuleId>([
  "orcamento",
  "pedidos",
  "compras",
  "almoxarifado-entrada",
  "almoxarifado-retirada",
  "cotacoes",
  "contratos-fornecedor",
  "medicoes",
  "folha",
  "consumo",
  "contas-receber",
  "cronograma",
]);
const modulesRequiringCenter = new Set<BusinessModuleId>([
  "orcamento",
  "pedidos",
  "compras",
  "almoxarifado-entrada",
  "almoxarifado-retirada",
  "medicoes",
  "folha",
  "consumo",
  "contas-pagar",
]);
const autoPayableModules = new Set<BusinessModuleId>([
  "compras",
  "medicoes",
  "folha",
]);
const stockMovementModules = new Set<BusinessModuleId>([
  "almoxarifado-entrada",
  "almoxarifado-retirada",
]);
const supplierReferenceModules = new Set<BusinessModuleId>([
  "compras",
  "cotacoes",
  "contratos-fornecedor",
  "medicoes",
]);

function isCentralAdministrationIdentity(title: string, code?: string | null) {
  const normalize = (value: string) => value.trim().toLocaleLowerCase("pt-BR");
  return (
    normalize(title) === normalize(ADMIN_CENTRAL_COST_CENTER_TITLE) ||
    normalize(String(code ?? "")) === normalize(ADMIN_CENTRAL_COST_CENTER_CODE)
  );
}

function fail(
  code:
    | "BAD_REQUEST"
    | "CONFLICT"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "PRECONDITION_FAILED"
    | "INTERNAL_SERVER_ERROR",
  message: string
): never {
  throw new TRPCError({ code, message });
}

function isDuplicateKeyError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; errno?: unknown };
  return candidate.code === "ER_DUP_ENTRY" || Number(candidate.errno) === 1062;
}

function assertWriter(
  module: BusinessModuleId,
  user: { role: string; operationalRole: string }
) {
  if (user.role === "admin") return;
  const required =
    module === "pedidos" || module === "almoxarifado-entrada"
      ? "almoxarife"
      : module === "almoxarifado-retirada"
        ? "encarregado"
        : undefined;
  if (required && user.operationalRole !== required) {
    fail(
      "FORBIDDEN",
      required === "almoxarife"
        ? "Somente o almoxarife pode registrar pedidos e recebimentos de material."
        : "Somente o encarregado pode registrar retiradas de material."
    );
  }
}

function parseDetails(
  details: string | null | undefined
): Record<string, unknown> {
  if (!details) return {};
  try {
    return JSON.parse(details) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function decodeRecord(record: BusinessRecord) {
  return { ...record, details: parseDetails(record.details) };
}

async function requireRecord(id: number) {
  const record = await getBusinessRecord(id);
  if (!record) fail("NOT_FOUND", "Registro não encontrado.");
  return record;
}

async function ensureUniqueOrderCode(
  code: string | null | undefined,
  ignoreId?: number
) {
  if (!code?.trim())
    fail("BAD_REQUEST", "Informe um código para o pedido de material.");
  const normalized = code.trim().toLocaleLowerCase("pt-BR");
  const duplicate = (await listBusinessRecords("pedidos")).some(
    record =>
      record.id !== ignoreId &&
      record.code?.trim().toLocaleLowerCase("pt-BR") === normalized
  );
  if (duplicate) fail("CONFLICT", "Este código de pedido já está em uso.");
}

async function validateReferences(
  module: BusinessModuleId,
  workId: number | null | undefined,
  costCenterId: number | null | undefined,
  details: Record<string, unknown>
) {
  if (module === "obras" && workId)
    fail("BAD_REQUEST", "Uma obra não pode ser vinculada a outra obra.");
  if (workId != null) {
    const work = await getBusinessRecord(workId);
    if (!work || work.module !== "obras" || work.status === "cancelado")
      fail(
        "BAD_REQUEST",
        "A obra selecionada não existe ou não está disponível."
      );
  } else if (modulesRequiringWork.has(module)) {
    fail("BAD_REQUEST", "Este registro precisa estar vinculado a uma obra.");
  }
  if (module === "centros-custo") {
    const type = String(details.tipo ?? "").toLocaleLowerCase("pt-BR");
    if (type === "obra" && !workId)
      fail(
        "BAD_REQUEST",
        "Um centro de custo do tipo Obra deve estar vinculado a uma obra."
      );
    if (type === "administração" && workId)
      fail(
        "BAD_REQUEST",
        "O centro de custo de Administração não pode estar vinculado a uma obra."
      );
    if (type !== "obra" && type !== "administração")
      fail(
        "BAD_REQUEST",
        "Selecione se o centro de custo pertence a uma obra ou à Administração."
      );
  }
  if (modulesRequiringCenter.has(module) && costCenterId == null) {
    fail("BAD_REQUEST", "Selecione o centro de custo deste lançamento.");
  }
  if (costCenterId != null) {
    const center = await getBusinessRecord(costCenterId);
    if (
      !center ||
      center.module !== "centros-custo" ||
      center.status === "cancelado"
    )
      fail(
        "BAD_REQUEST",
        "O centro de custo selecionado não existe ou está cancelado."
      );
    const centerType = String(
      parseDetails(center.details).tipo ?? ""
    ).toLocaleLowerCase("pt-BR");
    if (center.workId == null) {
      if (centerType !== "administração")
        fail(
          "BAD_REQUEST",
          "Centro sem obra deve ser o centro de custo de Administração."
        );
      if (workId != null)
        fail(
          "BAD_REQUEST",
          "O centro de custo de Administração não pode ser lançado como custo de uma obra."
        );
    } else if (center.workId !== workId || centerType !== "obra") {
      fail(
        "BAD_REQUEST",
        "O centro de custo selecionado não é compatível com a obra deste lançamento."
      );
    }
  }
  if (module === "obras" || module === "contas-receber") {
    const clientName = String(details.cliente ?? "").trim();
    if (!clientName)
      fail(
        "BAD_REQUEST",
        "Selecione um cliente cadastrado para este contrato/recebível."
      );
    const clients = await listBusinessRecords("clientes");
    if (!clients.some(client => client.title === clientName))
      fail("BAD_REQUEST", "O cliente selecionado não existe no cadastro.");
    if (module === "contas-receber" && workId) {
      const work = await getBusinessRecord(workId);
      if (
        work &&
        String(parseDetails(work.details).cliente ?? "") !== clientName
      )
        fail(
          "BAD_REQUEST",
          "A conta a receber deve pertencer ao cliente do contrato da obra selecionada."
        );
    }
  }
  if (module === "folha") {
    const collaboratorName = String(details.colaborador ?? "").trim();
    if (!collaboratorName)
      fail("BAD_REQUEST", "Selecione um colaborador cadastrado para a folha.");
    const collaborators = await listBusinessRecords("colaboradores");
    if (
      !collaborators.some(
        collaborator => collaborator.title === collaboratorName
      )
    )
      fail("BAD_REQUEST", "O colaborador selecionado não existe no cadastro.");
  }
  if (module === "compras") {
    const orderCode = String(details.pedidoOrigem ?? "").trim();
    if (orderCode) {
      const matches = (await listBusinessRecords("pedidos")).filter(
        order =>
          order.code?.trim().toLocaleLowerCase("pt-BR") ===
          orderCode.toLocaleLowerCase("pt-BR")
      );
      if (matches.length !== 1)
        fail(
          "BAD_REQUEST",
          "O código do pedido de origem precisa corresponder a exatamente um pedido cadastrado."
        );
      const order = matches[0];
      if (order.workId !== workId || order.costCenterId !== costCenterId)
        fail(
          "BAD_REQUEST",
          "A compra e o pedido de origem devem ter a mesma obra e o mesmo centro de custo."
        );
    }
  }
  if (module === "almoxarifado-entrada") {
    const sourceCode = String(details.pedidoOrigem ?? "").trim();
    if (sourceCode) {
      const sources = [
        ...(await listBusinessRecords("pedidos")),
        ...(await listBusinessRecords("compras")),
      ].filter(
        row =>
          row.code?.trim().toLocaleLowerCase("pt-BR") ===
          sourceCode.toLocaleLowerCase("pt-BR")
      );
      if (sources.length !== 1)
        fail(
          "BAD_REQUEST",
          "O código de origem do recebimento deve identificar exatamente um pedido ou uma compra."
        );
      if (
        sources[0].workId !== workId ||
        sources[0].costCenterId !== costCenterId
      )
        fail(
          "BAD_REQUEST",
          "O recebimento deve pertencer à mesma obra e ao mesmo centro de custo do pedido/compra."
        );
    }
  }
  if (supplierReferenceModules.has(module)) {
    const supplierName = String(details.fornecedor ?? "").trim();
    if (!supplierName)
      fail(
        "BAD_REQUEST",
        "Selecione um fornecedor cadastrado para este registro."
      );
    const suppliers = await listBusinessRecords("fornecedores");
    if (!suppliers.some(supplier => supplier.title === supplierName))
      fail("BAD_REQUEST", "O fornecedor selecionado não existe no cadastro.");
  }
  if (module === "medicoes") {
    const contractId = Number(details.contratoFornecedorId ?? 0);
    if (!Number.isInteger(contractId) || contractId <= 0)
      fail("BAD_REQUEST", "Selecione o contrato cadastrado do fornecedor.");
    const contract = await getBusinessRecord(contractId);
    if (
      !contract ||
      contract.module !== "contratos-fornecedor" ||
      contract.status === "cancelado"
    )
      fail(
        "BAD_REQUEST",
        "O contrato do fornecedor não existe ou está cancelado."
      );
    const contractDetails = parseDetails(contract.details);
    if (
      contract.workId !== workId ||
      String(contractDetails.fornecedor ?? "") !==
        String(details.fornecedor ?? "")
    )
      fail(
        "BAD_REQUEST",
        "A medição deve usar contrato do mesmo fornecedor e da mesma obra."
      );
  } else if (details.contratoFornecedorId != null) {
    fail("BAD_REQUEST", "Contrato de fornecedor só é permitido em medições.");
  }
}

async function isSupplierReferenced(name: string) {
  const records = await listBusinessRecords();
  return records.some(record => {
    if (record.module === "contas-pagar")
      return String(parseDetails(record.details).fornecedor ?? "") === name;
    return (
      supplierReferenceModules.has(record.module as BusinessModuleId) &&
      String(parseDetails(record.details).fornecedor ?? "") === name
    );
  });
}

async function isClientReferenced(name: string) {
  const records = await listBusinessRecords();
  return records.some(
    record =>
      (record.module === "obras" || record.module === "contas-receber") &&
      String(parseDetails(record.details).cliente ?? "") === name
  );
}

async function isCollaboratorReferenced(name: string) {
  const records = await listBusinessRecords("folha");
  return records.some(
    record => String(parseDetails(record.details).colaborador ?? "") === name
  );
}

function validateStockMovement(
  module: BusinessModuleId,
  workId: number | null | undefined,
  costCenterId: number | null | undefined,
  quantity: number | null | undefined,
  details: Record<string, unknown>,
  _status?: string,
  _ignoreRecordId?: number
) {
  if (!stockMovementModules.has(module)) return;
  if (!workId || !costCenterId)
    fail(
      "BAD_REQUEST",
      "Vincule o movimento do estoque a uma obra e a um centro de custo."
    );
  const material = normalizeStockMaterial(details.material);
  const unit = normalizeStockUnit(details.unidade);
  if (!material) fail("BAD_REQUEST", "Informe o material movimentado.");
  if (!unit) fail("BAD_REQUEST", "Informe a unidade do material movimentado.");
  if (!(Number(quantity) > 0))
    fail("BAD_REQUEST", "Informe uma quantidade maior que zero.");
}

function settlementTotal(
  rows: Awaited<ReturnType<typeof listRecordSettlements>>
) {
  return (
    Math.round(
      rows.reduce((total, row) => total + Number(row.amount), 0) * 100
    ) / 100
  );
}

function dueDate(details: Record<string, unknown>) {
  const value = details.vencimento;
  return typeof value === "string" ? value : "";
}

function todayInSaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) =>
    parts.find(part => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function validateFinancialFields(
  module: BusinessModuleId,
  status: string,
  amount: number | null | undefined,
  details: Record<string, unknown>
) {
  const amountRequired =
    module === "obras" ||
    module === "orcamento" ||
    module === "compras" ||
    module === "folha" ||
    module === "contas-pagar" ||
    module === "contas-receber" ||
    (module === "medicoes" && measurementApproved({ status }));
  if (amountRequired && !(Number(amount) > 0))
    fail(
      "BAD_REQUEST",
      "Informe um valor maior que zero para este registro financeiro."
    );
  const dueDateRequired =
    module === "compras" ||
    module === "folha" ||
    module === "contas-pagar" ||
    module === "contas-receber" ||
    (module === "medicoes" && measurementApproved({ status }));
  if (
    dueDateRequired &&
    (typeof details.vencimento !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(details.vencimento))
  ) {
    fail(
      "BAD_REQUEST",
      "Informe a data de vencimento para integrar este compromisso ao fluxo de caixa."
    );
  }
  if (module === "folha") {
    const gross = Number(details.valorBruto ?? 0);
    const discounts = Number(details.descontos ?? 0);
    const net = Math.round((gross - discounts) * 100) / 100;
    if (
      gross <= 0 ||
      discounts < 0 ||
      discounts > gross ||
      Math.round(Number(amount ?? 0) * 100) !== Math.round(net * 100)
    ) {
      fail(
        "BAD_REQUEST",
        "O valor da conta a pagar deve ser o líquido da folha: valor bruto menos descontos."
      );
    }
  }
  if (module === "consumo") {
    const missingLabels = ["material", "atividade", "unidade"].filter(
      key => !String(details[key] ?? "").trim()
    );
    if (missingLabels.length)
      fail(
        "BAD_REQUEST",
        "Informe material, atividade e unidade para registrar o consumo."
      );
    const keys = [
      "quantidadeAdquirida",
      "quantidadePlanejada",
      "quantidadeConsumida",
    ];
    const values = keys.map(key => details[key]);
    if (
      values.some(
        value =>
          value == null ||
          value === "" ||
          !Number.isFinite(Number(value)) ||
          Number(value) < 0
      )
    ) {
      fail(
        "BAD_REQUEST",
        "Informe quantidades adquirida, planejada e consumida válidas para comparar o material."
      );
    }
  }
  if (module === "cotacoes") {
    if (!(Number(details.precoUnitario) > 0))
      fail(
        "BAD_REQUEST",
        "Informe um preço unitário maior que zero para a cotação."
      );
    if (
      !String(details.prazoEntrega ?? "").trim() ||
      !String(details.condicaoPagamento ?? "").trim()
    )
      fail(
        "BAD_REQUEST",
        "Informe prazo de entrega e condição de pagamento do fornecedor."
      );
  }
}

function financialRecordView(
  record: BusinessRecord,
  settlements: Awaited<ReturnType<typeof listRecordSettlements>>
) {
  const details = parseDetails(record.details);
  const settledAmount = settlementTotal(settlements);
  const totalAmount = Number(record.amount ?? 0);
  const openBalance = Math.max(
    0,
    Math.round((totalAmount - settledAmount) * 100) / 100
  );
  const receivable = record.module === "contas-receber";
  const fullySettled = totalAmount > 0 && openBalance === 0;
  const due = dueDate(details);
  const overdue =
    openBalance > 0 &&
    due !== "" &&
    due < new Date().toISOString().slice(0, 10);
  const status = fullySettled
    ? receivable
      ? "recebido"
      : "pago"
    : overdue
      ? "atrasado"
      : settledAmount > 0
        ? "parcial"
        : "pendente";
  return { ...record, details, settledAmount, openBalance, status };
}

async function enrichRecords(records: BusinessRecord[]) {
  const financeRows = records.filter(
    record =>
      record.module === "contas-pagar" || record.module === "contas-receber"
  );
  if (financeRows.length === 0) return records.map(decodeRecord);
  const allSettlements = await listAllRecordSettlements();
  const byRecord = new Map<number, typeof allSettlements>();
  for (const settlement of allSettlements) {
    byRecord.set(settlement.recordId, [
      ...(byRecord.get(settlement.recordId) ?? []),
      settlement,
    ]);
  }
  return records.map(record =>
    record.module === "contas-pagar" || record.module === "contas-receber"
      ? financialRecordView(record, byRecord.get(record.id) ?? [])
      : decodeRecord(record)
  );
}

function autoPayableCategory(module: BusinessModuleId) {
  if (module === "compras") return "Materiais";
  if (module === "folha") return "Equipe / folha";
  return "Serviços";
}

function measurementApproved(record: Pick<BusinessRecord, "status">) {
  return record.status === "aprovado" || record.status === "concluido";
}

async function syncAutoPayable(source: BusinessRecord) {
  if (!autoPayableModules.has(source.module as BusinessModuleId)) return;
  const module = source.module as BusinessModuleId;
  if (module === "medicoes" && !measurementApproved(source)) return;
  if (Number(source.amount ?? 0) <= 0)
    fail(
      "BAD_REQUEST",
      "Informe um valor maior que zero para gerar a conta a pagar vinculada."
    );
  if (!source.costCenterId)
    fail(
      "BAD_REQUEST",
      "O lançamento de origem precisa ter um centro de custo antes de gerar a conta a pagar."
    );

  const payables = await listBusinessRecords("contas-pagar");
  const existing = payables.find(
    record =>
      record.sourceModule === source.module &&
      record.sourceRecordId === source.id
  );
  const sourceDetails = parseDetails(source.details);
  const existingDetails = existing ? parseDetails(existing.details) : {};
  const details: Record<string, unknown> = {
    ...existingDetails,
    fornecedor: sourceDetails.fornecedor ?? sourceDetails.colaborador ?? "",
    documento: sourceDetails.notaFiscal ?? source.code ?? "",
    categoria: autoPayableCategory(module),
    vencimento: sourceDetails.vencimento ?? null,
    origem: module,
    origemRegistroId: source.id,
  };
  if (existing) {
    try {
      await updateFinancialRecordSafely(existing.id, {
        module: "contas-pagar",
        title: source.title,
        code: source.code,
        workId: source.workId,
        costCenterId: source.costCenterId,
        supplierContractId: source.supplierContractId,
        amount: source.amount,
        recordDate: source.recordDate,
        responsible: source.responsible,
        details: JSON.stringify(details),
      });
    } catch (error) {
      if (error instanceof SettledAmountExceededError)
        fail("PRECONDITION_FAILED", error.message);
      throw error;
    }
  } else {
    await insertBusinessRecord({
      module: "contas-pagar",
      title: source.title,
      code: source.code,
      workId: source.workId,
      costCenterId: source.costCenterId,
      supplierContractId: source.supplierContractId,
      amount: source.amount,
      quantity: null,
      recordDate: source.recordDate,
      status: "pendente",
      responsible: source.responsible,
      details: JSON.stringify(details),
      sourceModule: source.module,
      sourceRecordId: source.id,
      createdBy: source.createdBy,
    });
  }
}

async function ensureUnsettledAmount(
  recordId: number,
  newAmount: number | null | undefined
) {
  if (newAmount == null) return;
  const settlements = await listRecordSettlements(recordId);
  if (
    Math.round(newAmount * 100) < Math.round(settlementTotal(settlements) * 100)
  ) {
    fail(
      "PRECONDITION_FAILED",
      "O valor da conta não pode ser menor que o total já baixado. Baixas não podem ser revertidas."
    );
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  records: router({
    list: protectedProcedure
      .input(z.object({ module: moduleSchema.optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (input?.module === "centros-custo")
          await ensureAdministrationCentralCostCenter(ctx.user.id);
        return enrichRecords(await listBusinessRecords(input?.module));
      }),
    create: protectedProcedure
      .input(recordInput)
      .mutation(async ({ ctx, input }) => {
        assertWriter(input.module, ctx.user);
        if (
          input.module === "centros-custo" &&
          isCentralAdministrationIdentity(input.title, input.code)
        )
          fail(
            "CONFLICT",
            "Administração Central é um centro sistêmico criado automaticamente e não pode ser duplicado."
          );
        if (input.module === "pedidos") await ensureUniqueOrderCode(input.code);
        if (input.module === "cotacoes" && !input.code?.trim())
          fail(
            "BAD_REQUEST",
            "Informe o código do mapa de cotação para agrupar as propostas."
          );
        if (
          input.module === "almoxarifado-retirada" &&
          !input.responsible?.trim()
        )
          fail(
            "BAD_REQUEST",
            "Informe o encarregado responsável pela retirada."
          );
        await validateReferences(
          input.module,
          input.workId,
          input.costCenterId,
          input.details
        );
        validateFinancialFields(
          input.module,
          input.status,
          input.amount,
          input.details
        );
        await validateStockMovement(
          input.module,
          input.workId,
          input.costCenterId,
          input.quantity,
          input.details,
          input.status
        );
        const record = {
          ...input,
          amount: input.amount ?? null,
          quantity: input.quantity ?? null,
          code: input.code ?? null,
          workId: input.workId ?? null,
          costCenterId: input.costCenterId ?? null,
          supplierContractId:
            input.module === "medicoes"
              ? Number(input.details.contratoFornecedorId)
              : null,
          recordDate: input.recordDate ?? null,
          responsible: input.responsible ?? null,
          details: JSON.stringify(input.details),
          sourceModule: null,
          sourceRecordId: null,
          createdBy: ctx.user.id,
        };
        let id: number;
        try {
          id = stockMovementModules.has(input.module)
            ? await insertStockMovement(record)
            : await insertBusinessRecord(record);
        } catch (error) {
          if (error instanceof InsufficientStockError)
            fail("PRECONDITION_FAILED", error.message);
          if (input.module === "pedidos" && isDuplicateKeyError(error))
            fail("CONFLICT", "Este código de pedido já está em uso.");
          throw error;
        }
        const created = await requireRecord(id);
        try {
          await syncAutoPayable(created);
        } catch (error) {
          if (autoPayableModules.has(input.module))
            await deleteBusinessRecord(id);
          throw error;
        }
        return { id };
      }),
    update: protectedProcedure
      .input(recordInput.extend({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        assertWriter(input.module, ctx.user);
        const existing = await requireRecord(input.id);
        if (existing.module !== input.module)
          fail("NOT_FOUND", "Registro não encontrado.");
        if (existing.systemKey === ADMIN_CENTRAL_COST_CENTER_SYSTEM_KEY) {
          const centerType = String(input.details.tipo ?? "")
            .trim()
            .toLocaleLowerCase("pt-BR");
          if (
            input.title !== ADMIN_CENTRAL_COST_CENTER_TITLE ||
            (input.code ?? null) !== existing.code ||
            input.workId != null ||
            input.costCenterId != null ||
            centerType !== "administração" ||
            input.status === "cancelado"
          )
            fail(
              "PRECONDITION_FAILED",
              "O centro sistêmico Administração Central não pode ser renomeado, vinculado a uma obra ou cancelado."
            );
        } else if (
          input.module === "centros-custo" &&
          isCentralAdministrationIdentity(input.title, input.code)
        ) {
          fail(
            "CONFLICT",
            "Administração Central é um centro sistêmico criado automaticamente e não pode ser duplicado."
          );
        }
        if (existing.module === "contas-pagar" && existing.sourceModule)
          fail(
            "PRECONDITION_FAILED",
            "Esta conta a pagar é gerada automaticamente. Atualize o registro de origem."
          );
        if (input.module === "pedidos")
          await ensureUniqueOrderCode(input.code, existing.id);
        if (input.module === "cotacoes" && !input.code?.trim())
          fail(
            "BAD_REQUEST",
            "Informe o código do mapa de cotação para agrupar as propostas."
          );
        if (
          input.module === "pedidos" &&
          existing.code !== input.code &&
          (await listBusinessRecords("compras")).some(
            row =>
              String(parseDetails(row.details).pedidoOrigem ?? "") ===
              String(existing.code ?? "")
          )
        )
          fail(
            "PRECONDITION_FAILED",
            "Este pedido já está vinculado a uma compra; não é possível alterar seu código de origem."
          );
        const recordsForCancellation =
          input.status === "cancelado" ? await listBusinessRecords() : [];
        if (
          input.module === "obras" &&
          recordsForCancellation.some(
            row => row.id !== existing.id && row.workId === existing.id
          )
        )
          fail(
            "PRECONDITION_FAILED",
            "A obra possui registros vinculados e não pode ser cancelada."
          );
        if (
          input.module === "centros-custo" &&
          recordsForCancellation.some(
            row => row.id !== existing.id && row.costCenterId === existing.id
          )
        )
          fail(
            "PRECONDITION_FAILED",
            "O centro de custo possui registros vinculados e não pode ser cancelado."
          );
        if (
          input.module === "contratos-fornecedor" &&
          recordsForCancellation.some(
            row => row.supplierContractId === existing.id
          )
        )
          fail(
            "PRECONDITION_FAILED",
            "O contrato possui medições vinculadas e não pode ser cancelado."
          );
        if (
          input.module === "pedidos" &&
          existing.code &&
          recordsForCancellation.some(
            row =>
              row.module === "compras" &&
              String(parseDetails(row.details).pedidoOrigem ?? "") ===
                existing.code
          )
        )
          fail(
            "PRECONDITION_FAILED",
            "O pedido está vinculado a uma compra e não pode ser cancelado."
          );
        if (
          existing.module === "fornecedores" &&
          existing.title !== input.title &&
          (await isSupplierReferenced(existing.title))
        )
          fail(
            "PRECONDITION_FAILED",
            "Este fornecedor já está ligado a pedidos financeiros. Atualize os registros vinculados antes de alterar o nome."
          );
        if (
          existing.module === "clientes" &&
          existing.title !== input.title &&
          (await isClientReferenced(existing.title))
        )
          fail(
            "PRECONDITION_FAILED",
            "Este cliente está associado a contratos de obra ou recebíveis e não pode ser renomeado enquanto houver vínculos."
          );
        if (
          existing.module === "colaboradores" &&
          existing.title !== input.title &&
          (await isCollaboratorReferenced(existing.title))
        )
          fail(
            "PRECONDITION_FAILED",
            "Este colaborador possui lançamentos de folha vinculados e não pode ser renomeado."
          );
        if (existing.module === "contratos-fornecedor") {
          const linkedMeasurements = await listBusinessRecords("medicoes");
          const linked = linkedMeasurements.some(
            row => row.supplierContractId === existing.id
          );
          const priorDetails = parseDetails(existing.details);
          if (
            linked &&
            (existing.workId !== input.workId ||
              String(priorDetails.fornecedor ?? "") !==
                String(input.details.fornecedor ?? ""))
          )
            fail(
              "PRECONDITION_FAILED",
              "O contrato possui medições vinculadas e não pode mudar de obra ou fornecedor."
            );
        }
        if (
          input.module === "almoxarifado-retirada" &&
          !input.responsible?.trim()
        )
          fail(
            "BAD_REQUEST",
            "Informe o encarregado responsável pela retirada."
          );
        await validateReferences(
          input.module,
          input.workId,
          input.costCenterId,
          input.details
        );
        validateFinancialFields(
          input.module,
          input.status,
          input.amount,
          input.details
        );
        await validateStockMovement(
          input.module,
          input.workId,
          input.costCenterId,
          input.quantity,
          input.details,
          input.status,
          existing.id
        );
        if (
          input.module === "medicoes" &&
          measurementApproved(existing) &&
          !measurementApproved({ status: input.status })
        ) {
          fail(
            "PRECONDITION_FAILED",
            "Uma medição aprovada com conta a pagar vinculada não pode voltar para análise nem reverter o compromisso."
          );
        }
        if (autoPayableModules.has(input.module)) {
          const linked = (await listBusinessRecords("contas-pagar")).find(
            row =>
              row.sourceModule === input.module &&
              row.sourceRecordId === existing.id
          );
          if (linked) {
            if (input.status === "cancelado")
              fail(
                "PRECONDITION_FAILED",
                "O registro já possui uma conta a pagar. Preserve o compromisso e faça um ajuste financeiro rastreável."
              );
            await ensureUnsettledAmount(linked.id, input.amount);
            const linkedSettlements = await listRecordSettlements(linked.id);
            if (
              linkedSettlements.length > 0 &&
              (linked.workId !== input.workId ||
                linked.costCenterId !== input.costCenterId)
            ) {
              fail(
                "PRECONDITION_FAILED",
                "Não é possível reclassificar obra ou centro de custo de uma conta que já recebeu baixas."
              );
            }
          }
        }
        if (
          input.module === "contas-pagar" ||
          input.module === "contas-receber"
        ) {
          await ensureUnsettledAmount(input.id, input.amount);
          if (
            existing.sourceModule &&
            (existing.title !== input.title ||
              existing.code !== input.code ||
              existing.amount !== input.amount ||
              existing.workId !== input.workId ||
              existing.costCenterId !== input.costCenterId)
          )
            fail(
              "PRECONDITION_FAILED",
              "A conta gerada automaticamente deve ser alterada pelo registro de origem."
            );
        }
        const { id, ...fields } = input;
        const updatedRecord = {
          ...fields,
          amount: fields.amount ?? null,
          quantity: fields.quantity ?? null,
          code: fields.code ?? null,
          workId: fields.workId ?? null,
          costCenterId: fields.costCenterId ?? null,
          supplierContractId:
            fields.module === "medicoes"
              ? Number(fields.details.contratoFornecedorId)
              : null,
          recordDate: fields.recordDate ?? null,
          responsible: fields.responsible ?? null,
          status:
            existing.module === "contas-pagar" ||
            existing.module === "contas-receber"
              ? existing.status
              : fields.status,
          details: JSON.stringify(fields.details),
        };
        try {
          if (stockMovementModules.has(fields.module))
            await updateStockMovement(id, updatedRecord);
          else if (
            fields.module === "contas-pagar" ||
            fields.module === "contas-receber"
          )
            await updateFinancialRecordSafely(id, updatedRecord);
          else await updateBusinessRecord(id, updatedRecord);
        } catch (error) {
          if (error instanceof BudgetItemProgressIntegrityError)
            fail("PRECONDITION_FAILED", error.message);
          if (error instanceof InsufficientStockError)
            fail("PRECONDITION_FAILED", error.message);
          if (error instanceof SettledAmountExceededError)
            fail("PRECONDITION_FAILED", error.message);
          if (fields.module === "pedidos" && isDuplicateKeyError(error))
            fail("CONFLICT", "Este código de pedido já está em uso.");
          throw error;
        }
        try {
          await syncAutoPayable(await requireRecord(id));
        } catch (error) {
          await updateBusinessRecord(id, {
            module: existing.module,
            code: existing.code,
            title: existing.title,
            workId: existing.workId,
            costCenterId: existing.costCenterId,
            supplierContractId: existing.supplierContractId,
            amount: existing.amount,
            quantity: existing.quantity,
            recordDate: existing.recordDate,
            status: existing.status,
            responsible: existing.responsible,
            details: existing.details,
          });
          throw error;
        }
        return { success: true };
      }),
    delete: protectedProcedure
      .input(
        z.object({ id: z.number().int().positive(), module: moduleSchema })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await requireRecord(input.id);
        if (existing.module !== input.module)
          fail("NOT_FOUND", "Registro não encontrado.");
        if (ctx.user.role !== "admin")
          fail(
            "FORBIDDEN",
            "Somente um administrador pode excluir registros operacionais."
          );
        if (existing.systemKey === ADMIN_CENTRAL_COST_CENTER_SYSTEM_KEY)
          fail(
            "PRECONDITION_FAILED",
            "O centro sistêmico Administração Central não pode ser excluído."
          );
        if (stockMovementModules.has(existing.module as BusinessModuleId))
          fail(
            "PRECONDITION_FAILED",
            "Movimentos de almoxarifado não podem ser excluídos; use o cancelamento, sujeito à validação do saldo."
          );
        if (
          existing.module === "fornecedores" &&
          (await isSupplierReferenced(existing.title))
        )
          fail(
            "PRECONDITION_FAILED",
            "Este fornecedor está referenciado por compras, cotações, contratos ou medições e não pode ser excluído."
          );
        if (
          existing.module === "clientes" &&
          (await isClientReferenced(existing.title))
        )
          fail(
            "PRECONDITION_FAILED",
            "Este cliente está associado a contratos de obra ou recebíveis e não pode ser excluído."
          );
        if (
          existing.module === "colaboradores" &&
          (await isCollaboratorReferenced(existing.title))
        )
          fail(
            "PRECONDITION_FAILED",
            "Este colaborador possui lançamentos de folha vinculados e não pode ser excluído."
          );
        const allRecords = await listBusinessRecords();
        if (
          existing.module === "contratos-fornecedor" &&
          allRecords.some(row => row.supplierContractId === existing.id)
        )
          fail(
            "PRECONDITION_FAILED",
            "Este contrato possui medições vinculadas e não pode ser excluído."
          );
        if (
          existing.module === "obras" &&
          allRecords.some(
            row => row.id !== existing.id && row.workId === existing.id
          )
        )
          fail(
            "PRECONDITION_FAILED",
            "Esta obra possui lançamentos vinculados e não pode ser excluída."
          );
        if (
          existing.module === "centros-custo" &&
          allRecords.some(
            row => row.id !== existing.id && row.costCenterId === existing.id
          )
        )
          fail(
            "PRECONDITION_FAILED",
            "Este centro de custo possui lançamentos vinculados e não pode ser excluído."
          );
        if (
          existing.module === "pedidos" &&
          existing.code &&
          allRecords.some(
            row =>
              row.module === "compras" &&
              String(parseDetails(row.details).pedidoOrigem ?? "") ===
                existing.code
          )
        )
          fail(
            "PRECONDITION_FAILED",
            "Este pedido está vinculado a uma compra e deve ser preservado."
          );
        if (
          existing.module === "compras" &&
          existing.code &&
          allRecords.some(
            row =>
              row.module === "almoxarifado-entrada" &&
              String(parseDetails(row.details).pedidoOrigem ?? "") ===
                existing.code
          )
        )
          fail(
            "PRECONDITION_FAILED",
            "Esta compra tem recebimento de material vinculado e deve ser preservada."
          );
        if (existing.sourceModule || existing.sourceRecordId)
          fail(
            "PRECONDITION_FAILED",
            "Esta conta a pagar veio de outro registro e deve ser preservada para evitar divergência financeira."
          );
        if (await listRecordAttachments(input.id).then(rows => rows.length > 0))
          fail(
            "PRECONDITION_FAILED",
            "Este registro possui anexos. Preserve o registro para manter os documentos vinculados."
          );
        if (
          (existing.module === "contas-pagar" ||
            existing.module === "contas-receber") &&
          (await listRecordSettlements(input.id)).length > 0
        ) {
          fail(
            "PRECONDITION_FAILED",
            "Esta conta possui baixas imutáveis e não pode ser excluída."
          );
        }
        if (
          existing.module === "compras" ||
          existing.module === "medicoes" ||
          existing.module === "folha"
        ) {
          const payable = (await listBusinessRecords("contas-pagar")).find(
            row =>
              row.sourceModule === existing.module &&
              row.sourceRecordId === existing.id
          );
          if (payable)
            fail(
              "PRECONDITION_FAILED",
              "Este registro já gerou uma conta a pagar e deve ser preservado."
            );
        }
        try {
          await deleteBusinessRecord(input.id);
        } catch (error) {
          if (error instanceof BudgetItemProgressIntegrityError)
            fail("PRECONDITION_FAILED", error.message);
          if (error instanceof RecordHasSettlementsError)
            fail(
              "PRECONDITION_FAILED",
              "Esta conta possui baixas imutáveis e não pode ser excluída."
            );
          throw error;
        }
        return { success: true };
      }),
  }),
  budgetProgress: router({
    report: protectedProcedure.query(async () => {
      const [records, snapshots] = await Promise.all([
        listBusinessRecords(),
        listAllBudgetItemProgress(),
      ]);
      const works = records
        .filter(record => record.module === "obras")
        .map(work => ({ id: work.id, title: work.title, status: work.status }))
        .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
      const workTitleById = new Map<number, string>(
        works.map(work => [work.id, work.title] as const)
      );
      const snapshotsByItem = new Map<number, typeof snapshots>();
      for (const snapshot of snapshots) {
        const itemSnapshots = snapshotsByItem.get(snapshot.budgetItemId) ?? [];
        itemSnapshots.push(snapshot);
        snapshotsByItem.set(snapshot.budgetItemId, itemSnapshots);
      }
      const rows = records
        .filter(record => record.module === "orcamento")
        .map(item => {
          const details = parseDetails(item.details);
          return {
            itemId: item.id,
            code: item.code,
            title: item.title,
            activity: String(details.atividade ?? ""),
            workId: item.workId,
            workTitle: item.workId
              ? (workTitleById.get(item.workId) ?? "Obra não identificada")
              : "Sem obra vinculada",
            contractAmount: Number(item.amount ?? 0),
            contractedQuantity: Number(
              details.quantidadeContratada ?? item.quantity ?? 0
            ),
            unit: String(details.unidade ?? ""),
            status: item.status,
            history: snapshotsByItem.get(item.id) ?? [],
          };
        })
        .sort((a, b) =>
          `${a.workTitle} ${a.title}`.localeCompare(
            `${b.workTitle} ${b.title}`,
            "pt-BR"
          )
        );
      return { works, rows };
    }),
    save: adminProcedure
      .input(
        z.object({
          budgetItemId: z.number().int().positive(),
          measurementDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD.")
            .refine(value => {
              const parsed = new Date(`${value}T00:00:00.000Z`);
              return (
                !Number.isNaN(parsed.getTime()) &&
                parsed.toISOString().slice(0, 10) === value &&
                value <= todayInSaoPaulo()
              );
            }, "Informe uma data válida até hoje."),
          physicalPercent: z
            .number()
            .finite()
            .nonnegative()
            .max(100)
            .refine(
              value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7,
              "Use no máximo duas casas decimais."
            ),
          approvedAmount: z
            .number()
            .finite()
            .nonnegative()
            .refine(
              value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7,
              "Use no máximo duas casas decimais."
            ),
          notes: z.string().trim().max(1000).optional().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const item = await requireRecord(input.budgetItemId);
        if (item.module !== "orcamento" || item.workId == null)
          fail(
            "BAD_REQUEST",
            "Selecione um item da planilha contratada associado a uma obra."
          );
        if (item.status === "cancelado")
          fail("PRECONDITION_FAILED", "O item selecionado está cancelado.");
        if (
          Math.round(input.approvedAmount * 100) >
          Math.round(Number(item.amount ?? 0) * 100)
        )
          fail(
            "BAD_REQUEST",
            "A medição aprovada acumulada não pode exceder o valor contratado vigente do item."
          );
        try {
          return await saveBudgetItemProgressSafely({
            budgetItemId: item.id,
            measurementDate: input.measurementDate,
            physicalPercent: input.physicalPercent,
            approvedAmount: input.approvedAmount,
            notes: input.notes || null,
            createdBy: ctx.user.id,
          });
        } catch (error) {
          if (error instanceof BudgetItemProgressIntegrityError)
            fail("PRECONDITION_FAILED", error.message);
          throw error;
        }
      }),
  }),
  settlements: router({
    list: protectedProcedure
      .input(z.object({ recordId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const record = await requireRecord(input.recordId);
        if (
          record.module !== "contas-pagar" &&
          record.module !== "contas-receber"
        )
          fail(
            "BAD_REQUEST",
            "Baixas só podem ser consultadas em contas a pagar/receber."
          );
        return listRecordSettlements(input.recordId);
      }),
    create: protectedProcedure
      .input(
        z.object({
          recordId: z.number().int().positive(),
          amount: z
            .number()
            .finite()
            .positive()
            .refine(
              value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7,
              "Use no máximo duas casas decimais."
            ),
          settlementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          reference: z.string().trim().max(240).optional().nullable(),
          paidByCentral: z.boolean().default(false),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const record = await requireRecord(input.recordId);
        if (
          record.module !== "contas-pagar" &&
          record.module !== "contas-receber"
        )
          fail(
            "BAD_REQUEST",
            "Baixas só podem ser lançadas em contas a pagar/receber."
          );
        if (
          input.paidByCentral &&
          (record.module !== "contas-pagar" ||
            record.workId == null ||
            record.costCenterId == null)
        )
          fail(
            "BAD_REQUEST",
            "Somente despesas a pagar vinculadas a uma obra podem ser marcadas como pagas pela Administração Central."
          );
        try {
          return await insertRecordSettlementSafely({
            recordId: input.recordId,
            amount: input.amount,
            settlementDate: input.settlementDate,
            reference: input.reference ?? null,
            paidByCentral: input.paidByCentral,
            createdBy: ctx.user.id,
          });
        } catch (error) {
          if (error instanceof SettlementExceedsBalanceError)
            fail("BAD_REQUEST", error.message);
          if (error instanceof SettlementPayerValidationError)
            fail("PRECONDITION_FAILED", error.message);
          throw error;
        }
      }),
  }),
  files: router({
    list: protectedProcedure
      .input(z.object({ recordId: z.number().int().positive() }))
      .query(async ({ input }) => {
        await requireRecord(input.recordId);
        const rows = await listRecordAttachments(input.recordId);
        return rows.map(
          ({
            id,
            recordId,
            fileName,
            category,
            contentType,
            size,
            createdAt,
          }) => ({
            id,
            recordId,
            fileName,
            category,
            contentType,
            size,
            createdAt,
          })
        );
      }),
    upload: protectedProcedure
      .input(
        z.object({
          recordId: z.number().int().positive(),
          fileName: z.string().trim().min(1).max(240),
          contentType: z.string().max(120),
          size: z
            .number()
            .int()
            .positive()
            .max(10 * 1024 * 1024),
          category: attachmentCategorySchema,
          base64: z.string().min(1).max(14_000_000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const record = await requireRecord(input.recordId);
        assertWriter(record.module as BusinessModuleId, ctx.user);
        const allowedTypes = new Set([
          "application/pdf",
          "image/png",
          "image/jpeg",
          "image/webp",
          "text/xml",
          "application/xml",
          "text/plain",
        ]);
        if (!allowedTypes.has(input.contentType))
          fail(
            "BAD_REQUEST",
            "Formato não permitido. Use PDF, PNG, JPG, WEBP ou XML."
          );
        const bytes = Buffer.from(input.base64, "base64");
        if (
          bytes.byteLength !== input.size ||
          bytes.byteLength > 10 * 1024 * 1024
        )
          fail(
            "BAD_REQUEST",
            "O arquivo está vazio ou excede o limite de 10 MB."
          );
        const safeName = input.fileName
          .replace(/[\\/\u0000-\u001f]/g, "_")
          .slice(0, 220);
        let stored: { key: string; url: string };
        try {
          stored = await storagePut(
            `lclobras/records/${input.recordId}/${crypto.randomUUID()}`,
            bytes,
            input.contentType
          );
        } catch {
          fail(
            "INTERNAL_SERVER_ERROR",
            "Não foi possível armazenar o arquivo no serviço do projeto."
          );
        }
        const id = await insertRecordAttachment({
          recordId: input.recordId,
          fileName: safeName,
          category: input.category,
          contentType: input.contentType,
          size: bytes.byteLength,
          objectKey: stored.key,
          stablePath: stored.url,
          createdBy: ctx.user.id,
        });
        return { id };
      }),
    downloadUrl: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const attachment = await getRecordAttachment(input.id);
        if (!attachment) fail("NOT_FOUND", "Arquivo não encontrado.");
        const record = await requireRecord(attachment.recordId);
        try {
          const url = await storageGetSignedUrl(attachment.objectKey);
          return {
            url,
            fileName: attachment.fileName,
            recordTitle: record.title,
          };
        } catch {
          fail(
            "INTERNAL_SERVER_ERROR",
            "Não foi possível gerar o link temporário do arquivo."
          );
        }
      }),
  }),
  stock: router({
    summary: protectedProcedure.query(async () => {
      const records = await listBusinessRecords();
      const works = new Map(
        records
          .filter(record => record.module === "obras")
          .map(record => [record.id, record.title])
      );
      const centers = new Map(
        records
          .filter(record => record.module === "centros-custo")
          .map(record => [record.id, record.title])
      );
      const grouped = new Map<
        string,
        {
          material: string;
          unit: string;
          workId: number | null;
          workTitle: string;
          costCenterId: number | null;
          costCenterTitle: string;
          received: number;
          withdrawn: number;
        }
      >();
      for (const record of records) {
        if (
          record.module !== "almoxarifado-entrada" &&
          record.module !== "almoxarifado-retirada"
        )
          continue;
        if (record.status === "cancelado") continue;
        const details = parseDetails(record.details);
        const material = String(details.material ?? "").trim();
        if (!material) continue;
        const unit = String(details.unidade ?? "un").trim() || "un";
        const key = [
          record.workId ?? "",
          record.costCenterId ?? "",
          normalizeStockMaterial(material),
          normalizeStockUnit(unit),
        ].join("|");
        const item = grouped.get(key) ?? {
          material,
          unit,
          workId: record.workId,
          workTitle: works.get(record.workId ?? -1) ?? "—",
          costCenterId: record.costCenterId,
          costCenterTitle: centers.get(record.costCenterId ?? -1) ?? "—",
          received: 0,
          withdrawn: 0,
        };
        if (record.module === "almoxarifado-entrada")
          item.received += Number(record.quantity ?? 0);
        else item.withdrawn += Number(record.quantity ?? 0);
        grouped.set(key, item);
      }
      return [...grouped.values()]
        .map(item => ({
          ...item,
          balance: Math.round((item.received - item.withdrawn) * 1000) / 1000,
        }))
        .sort(
          (a, b) =>
            a.workTitle.localeCompare(b.workTitle, "pt-BR") ||
            a.material.localeCompare(b.material, "pt-BR")
        );
    }),
  }),
  dashboard: router({
    summary: protectedProcedure.query(async ({ ctx }) => {
      await ensureAdministrationCentralCostCenter(ctx.user.id);
      const records = await listBusinessRecords();
      const settlements = await listAllRecordSettlements();
      const settledByRecord = new Map<number, number>();
      for (const item of settlements)
        settledByRecord.set(
          item.recordId,
          (settledByRecord.get(item.recordId) ?? 0) + Number(item.amount)
        );
      const byModule = (module: string) =>
        records.filter(record => record.module === module);
      const sum = (items: BusinessRecord[]) =>
        items.reduce((total, item) => total + Number(item.amount ?? 0), 0);
      const settled = (items: BusinessRecord[]) =>
        items.reduce(
          (total, item) => total + (settledByRecord.get(item.id) ?? 0),
          0
        );
      const open = (items: BusinessRecord[]) =>
        items.reduce(
          (total, item) =>
            total +
            Math.max(
              0,
              Number(item.amount ?? 0) - (settledByRecord.get(item.id) ?? 0)
            ),
          0
        );
      const works = byModule("obras");
      const payables = byModule("contas-pagar");
      const receivables = byModule("contas-receber");
      const budgetLines = byModule("orcamento");
      const costs = sum(payables);
      const contracted = sum(works);
      const budgeted = sum(budgetLines);
      const workMap = new Map(works.map(work => [work.id, work]));
      const financeRecordById = new Map(
        [...payables, ...receivables].map(record => [record.id, record])
      );
      const settledByMonth = new Map<
        string,
        { month: string; incoming: number; outgoing: number }
      >();
      for (const movement of settlements) {
        const source = financeRecordById.get(movement.recordId);
        const month = movement.settlementDate.slice(0, 7);
        if (!source || !month) continue;
        const totals = settledByMonth.get(month) ?? {
          month,
          incoming: 0,
          outgoing: 0,
        };
        if (source.module === "contas-receber")
          totals.incoming += Number(movement.amount);
        else totals.outgoing += Number(movement.amount);
        settledByMonth.set(month, totals);
      }
      const workFinance = works.map(work => {
        const workPayables = payables.filter(entry => entry.workId === work.id);
        const workReceivables = receivables.filter(
          entry => entry.workId === work.id
        );
        const workBudget = budgetLines.filter(
          entry => entry.workId === work.id
        );
        const clientContract = Number(work.amount ?? 0);
        const workCosts = sum(workPayables);
        const metrics = calculateWorkFinanceMetrics(
          clientContract,
          work.id,
          records,
          settlements
        );
        return {
          id: work.id,
          title: work.title,
          code: work.code,
          contracted: clientContract,
          budgeted: sum(workBudget),
          costs: workCosts,
          settledCosts: metrics.settledCosts,
          received: metrics.received,
          cashBalance: metrics.cashBalance,
          centralPaidCosts: metrics.centralPaidCosts,
          profitForecast: metrics.profit,
          status: work.status,
          openPayables: open(workPayables),
          receivables: open(workReceivables),
          contractBalance: clientContract - workCosts,
          budgetBalance: sum(workBudget) - workCosts,
        };
      });
      const today = new Date().toISOString().slice(0, 10);
      const overdue = [...payables, ...receivables].filter(item => {
        const details = parseDetails(item.details);
        return (
          Number(item.amount ?? 0) - (settledByRecord.get(item.id) ?? 0) > 0 &&
          dueDate(details) !== "" &&
          dueDate(details) < today
        );
      }).length;
      return {
        workCount: works.length,
        contracted,
        budgeted,
        costs,
        settledCosts: settled(payables),
        receivables: open(receivables),
        totalReceivables: sum(receivables),
        payables: open(payables),
        totalPayables: sum(payables),
        availableContract: contracted - costs,
        overdue,
        settledMonthly: [...settledByMonth.values()].sort((a, b) =>
          a.month.localeCompare(b.month)
        ),
        workFinance,
        recentRecords: records
          .slice()
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
          .slice(0, 6)
          .map(item => ({
            id: item.id,
            module: item.module,
            title: item.title,
            code: item.code,
            status:
              item.module === "contas-pagar" || item.module === "contas-receber"
                ? financialRecordView(
                    item,
                    settlements.filter(row => row.recordId === item.id)
                  ).status
                : item.status,
            amount: Number(item.amount ?? 0),
            updatedAt: item.updatedAt,
            workTitle: item.workId
              ? (workMap.get(item.workId)?.title ?? null)
              : null,
          })),
      };
    }),
  }),
  people: router({
    list: adminProcedure.query(() => listBusinessUsers()),
    setOperationalRole: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          operationalRole: roleSchema,
        })
      )
      .mutation(async ({ input }) => {
        await setUserOperationalRole(input.id, input.operationalRole);
        return { success: true };
      }),
    setAccountRole: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          role: accountRoleSchema,
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          return await setUserAccountRoleSafely(input.id, input.role, ctx.user.id);
        } catch (error) {
          if (error instanceof UserAccountRoleChangeError) {
            const code =
              error.reason === "not_found"
                ? "NOT_FOUND"
                : error.reason === "self_change" ||
                    error.reason === "owner_required"
                  ? "FORBIDDEN"
                  : "PRECONDITION_FAILED";
            fail(code, error.message);
          }
          throw error;
        }
      }),
  }),
  admin: router({
    overview: adminProcedure.query(async ({ ctx }) => {
      await ensureAdministrationCentralCostCenter(ctx.user.id);
      return getAdminDashboardCounts();
    }),
  }),
});

export type AppRouter = typeof appRouter;
