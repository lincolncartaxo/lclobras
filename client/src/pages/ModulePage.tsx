import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  ADMIN_CENTRAL_COST_CENTER_SYSTEM_KEY,
  canWriteModule,
  type BusinessModuleId,
} from "@shared/records";
import { getModule } from "@/modules/definitions";
import {
  AlertCircle,
  Banknote,
  Building2,
  Download,
  FilePlus2,
  FileText,
  HandCoins,
  LockKeyhole,
  Pencil,
  Paperclip,
  Plus,
  Search,
  Trash2,
  UploadCloud,
  Wallet,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRoute } from "wouter";
import { toast } from "sonner";

type FormState = Record<string, string>;
type RecordRow = {
  id: number;
  module: string;
  systemKey?: string | null;
  code: string | null;
  title: string;
  workId: number | null;
  costCenterId: number | null;
  supplierContractId: number | null;
  amount: number | null;
  quantity: number | null;
  recordDate: string | null;
  status: string;
  responsible: string | null;
  details: Record<string, unknown>;
  updatedAt: Date;
  sourceModule: string | null;
  sourceRecordId: number | null;
  settledAmount?: number;
  openBalance?: number;
};
type StockRow = {
  workTitle: string;
  costCenterTitle: string;
  material: string;
  unit: string;
  received: number;
  withdrawn: number;
  balance: number;
};
const money = (value: number | null | undefined) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
      }).format(Number(value));
const statusOptions = [
  "planejado",
  "pendente",
  "em_analise",
  "em_andamento",
  "em_compra",
  "parcial",
  "aprovado",
  "recebido",
  "pago",
  "atrasado",
  "concluido",
  "cancelado",
];
const fileCategories = [
  { value: "contrato", label: "Contrato" },
  { value: "assinatura_recebimento", label: "Assinatura de recebimento" },
  { value: "nota_fiscal_cliente", label: "Nota fiscal emitida ao cliente" },
  { value: "outro", label: "Outro documento" },
] as const;
const categoryLabel: Record<string, string> = Object.fromEntries(
  fileCategories.map(({ value, label }) => [value, label])
);
const formatBytes = (size: number) =>
  size > 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`;
const financialModules = new Set(["contas-pagar", "contas-receber"]);
const autoPayableModules = new Set(["compras", "medicoes", "folha"]);
const registeredSupplierModules = new Set([
  "compras",
  "cotacoes",
  "contratos-fornecedor",
  "medicoes",
]);
const registeredClientModules = new Set(["obras", "contas-receber"]);
const registeredCollaboratorModules = new Set(["folha"]);

export default function ModulePage() {
  const [, params] = useRoute<{ moduleId: string }>("/m/:moduleId");
  const moduleId = params?.moduleId;
  const definition = getModule(moduleId);
  if (!definition)
    return (
      <section className="panel access-denied">
        <AlertCircle size={24} />
        <h2>Módulo não encontrado</h2>
        <p>O endereço não corresponde a um módulo do LclObras.</p>
      </section>
    );
  if (definition.report) return <CashFlowPage />;
  return <RecordsModule key={definition.id} definition={definition} />;
}

function RecordsModule({
  definition,
}: {
  definition: NonNullable<ReturnType<typeof getModule>>;
}) {
  const { user } = useAuth();
  const canCreate = user
    ? canWriteModule(
        definition.id as BusinessModuleId,
        user.role,
        user.operationalRole
      )
    : false;
  const recordsQuery = trpc.records.list.useQuery({
    module: definition.id as BusinessModuleId,
  });
  const worksQuery = trpc.records.list.useQuery({ module: "obras" });
  const centersQuery = trpc.records.list.useQuery({ module: "centros-custo" });
  const suppliersQuery = trpc.records.list.useQuery({ module: "fornecedores" });
  const supplierContractsQuery = trpc.records.list.useQuery({
    module: "contratos-fornecedor",
  });
  const clientsQuery = trpc.records.list.useQuery({ module: "clientes" });
  const collaboratorsQuery = trpc.records.list.useQuery({
    module: "colaboradores",
  });
  const isStockModule =
    definition.id === "almoxarifado-entrada" ||
    definition.id === "almoxarifado-retirada";
  const stockQuery = trpc.stock.summary.useQuery(undefined, {
    enabled: isStockModule,
  });
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [attachmentRecord, setAttachmentRecord] = useState<RecordRow | null>(
    null
  );
  const [settlementRecord, setSettlementRecord] = useState<RecordRow | null>(
    null
  );
  const [form, setForm] = useState<FormState>({});
  const Icon = definition.icon;
  const records = (recordsQuery.data ?? []) as RecordRow[];
  const works = (worksQuery.data ?? []) as RecordRow[];
  const centers = (centersQuery.data ?? []) as RecordRow[];
  const suppliers = (suppliersQuery.data ?? []) as RecordRow[];
  const supplierContracts = (supplierContractsQuery.data ?? []) as RecordRow[];
  const clients = (clientsQuery.data ?? []) as RecordRow[];
  const collaborators = (collaboratorsQuery.data ?? []) as RecordRow[];
  const selectedWork = works.find(work => work.id === Number(form.workId));
  const workClient = String(selectedWork?.details?.cliente ?? "");
  const clientOptions =
    definition.id === "contas-receber" && workClient
      ? clients.filter(client => client.title === workClient)
      : clients;
  const supplierContractOptions = supplierContracts.filter(
    contract =>
      contract.workId === Number(form.workId) &&
      contract.status !== "cancelado" &&
      String(contract.details?.fornecedor ?? "") ===
        String(form.fornecedor ?? "")
  );
  const stockBalances = (stockQuery.data ?? []) as StockRow[];
  const isFinancial = financialModules.has(definition.id);
  const filtered = useMemo(() => {
    const text = search.trim().toLocaleLowerCase("pt-BR");
    if (!text) return records;
    return records.filter(record =>
      [
        record.title,
        record.code,
        record.status,
        record.responsible,
        ...Object.values(record.details ?? {}),
      ].some(value =>
        String(value ?? "")
          .toLocaleLowerCase("pt-BR")
          .includes(text)
      )
    );
  }, [records, search]);

  const createMutation = trpc.records.create.useMutation({
    onSuccess: async () => {
      await refreshData();
      toast.success(successMessage());
      setFormOpen(false);
    },
    onError: error => toast.error(error.message),
  });
  const updateMutation = trpc.records.update.useMutation({
    onSuccess: async () => {
      await refreshData();
      toast.success(successMessage(true));
      setFormOpen(false);
    },
    onError: error => toast.error(error.message),
  });
  const deleteMutation = trpc.records.delete.useMutation({
    onSuccess: async () => {
      await refreshData();
      toast.success("Registro excluído.");
    },
    onError: error => toast.error(error.message),
  });
  async function refreshData() {
    await Promise.all([
      utils.records.list.invalidate(),
      utils.dashboard.summary.invalidate(),
      utils.stock.summary.invalidate(),
    ]);
  }
  function successMessage(updated = false) {
    if (autoPayableModules.has(definition.id))
      return updated
        ? "Registro e conta a pagar vinculada atualizados."
        : "Registro salvo e conta a pagar vinculada criada.";
    return updated ? "Registro atualizado." : "Registro salvo.";
  }

  function openCreate() {
    setEditing(null);
    setForm({
      title: "",
      code: "",
      workId: "",
      costCenterId:
        definition.id === "contas-pagar"
          ? String(
              centers.find(
                center =>
                  center.systemKey === ADMIN_CENTRAL_COST_CENTER_SYSTEM_KEY
              )?.id ?? ""
            )
          : "",
      amount: "",
      quantity: "",
      recordDate: "",
      status:
        definition.id === "medicoes"
          ? "em_analise"
          : definition.id === "almoxarifado-entrada" ||
              definition.id === "almoxarifado-retirada"
            ? "concluido"
            : "pendente",
      responsible: "",
      ...Object.fromEntries(
        (definition.fields ?? []).map(field => [field.key, ""])
      ),
    });
    setFormOpen(true);
  }
  function openEdit(record: RecordRow) {
    if (record.sourceModule)
      return toast.error(
        "Esta conta é gerada automaticamente. Edite o registro de origem."
      );
    setEditing(record);
    const details = record.details ?? {};
    setForm({
      title: record.title,
      code: record.code ?? "",
      workId: record.workId ? String(record.workId) : "",
      costCenterId: record.costCenterId ? String(record.costCenterId) : "",
      amount: record.amount == null ? "" : String(record.amount),
      quantity: record.quantity == null ? "" : String(record.quantity),
      recordDate: record.recordDate ?? "",
      status: record.status,
      responsible: record.responsible ?? "",
      ...Object.fromEntries(
        (definition.fields ?? []).map(field => [
          field.key,
          String(
            field.key === "contratoFornecedor"
              ? (record.supplierContractId ?? "")
              : (details[field.key] ?? "")
          ),
        ])
      ),
    });
    setFormOpen(true);
  }
  function submitForm(event: React.FormEvent) {
    event.preventDefault();
    const details = Object.fromEntries(
      (definition.fields ?? []).map(field => {
        const value = form[field.key] ?? "";
        return [
          field.key,
          field.kind === "number" && value !== ""
            ? Number(value)
            : value || null,
        ];
      })
    );
    const selectedSupplierContract = supplierContractOptions.find(
      contract => contract.id === Number(form.contratoFornecedor)
    );
    if (definition.id === "medicoes") {
      details.contratoFornecedorId = selectedSupplierContract?.id ?? null;
      details.contratoFornecedor = selectedSupplierContract?.title ?? null;
    }
    const payload = {
      module: definition.id as BusinessModuleId,
      title: form.title.trim(),
      code: form.code.trim() || null,
      workId: form.workId ? Number(form.workId) : null,
      costCenterId: form.costCenterId ? Number(form.costCenterId) : null,
      amount:
        definition.id === "folha"
          ? Math.max(
              0,
              Math.round(
                (Number(form.valorBruto ?? 0) - Number(form.descontos ?? 0)) *
                  100
              ) / 100
            )
          : form.amount === ""
            ? null
            : Number(form.amount),
      quantity: form.quantity === "" ? null : Number(form.quantity),
      recordDate: form.recordDate || null,
      status: isFinancial
        ? (editing?.status ?? "pendente")
        : form.status || "planejado",
      responsible: form.responsible.trim() || null,
      details,
    };
    if (!payload.title)
      return toast.error("Informe o nome ou a descrição do registro.");
    if (definition.id === "pedidos" && !payload.code)
      return toast.error("Informe um código para o pedido de material.");
    if (definition.id === "cotacoes" && !payload.code)
      return toast.error("Informe o código do mapa de cotação.");
    if (
      registeredClientModules.has(definition.id) &&
      !String(details.cliente ?? "").trim()
    )
      return toast.error("Selecione um cliente cadastrado.");
    if (definition.id === "medicoes" && !selectedSupplierContract)
      return toast.error(
        "Selecione um contrato cadastrado do fornecedor para esta obra."
      );
    if (
      definition.id === "contas-receber" &&
      workClient &&
      details.cliente !== workClient
    )
      return toast.error(
        "A conta a receber deve usar o cliente do contrato da obra."
      );
    if (definition.requireAmount && !(Number(payload.amount) > 0))
      return toast.error("Informe um valor maior que zero.");
    if (
      definition.id === "medicoes" &&
      ["aprovado", "concluido"].includes(payload.status) &&
      !(Number(payload.amount) > 0)
    )
      return toast.error("Informe o valor aprovado da medição.");
    if (
      ["compras", "folha", "contas-pagar", "contas-receber"].includes(
        definition.id
      ) &&
      !details.vencimento
    )
      return toast.error(
        "Informe o vencimento para integrar este compromisso ao fluxo de caixa."
      );
    if (
      definition.id === "medicoes" &&
      ["aprovado", "concluido"].includes(payload.status) &&
      !details.vencimento
    )
      return toast.error("Informe o vencimento da medição aprovada.");
    if (isStockModule && !String(details.material ?? "").trim())
      return toast.error("Informe o material movimentado.");
    if (isStockModule && !String(details.unidade ?? "").trim())
      return toast.error("Informe a unidade do material.");
    if (isStockModule && !(Number(payload.quantity) > 0))
      return toast.error("Informe uma quantidade maior que zero.");
    if (
      definition.showWork &&
      !["centros-custo", "contas-pagar"].includes(definition.id) &&
      !payload.workId
    )
      return toast.error("Selecione a obra relacionada.");
    if (definition.requireCostCenter && !payload.costCenterId)
      return toast.error("Selecione o centro de custo deste lançamento.");
    if (definition.id === "almoxarifado-retirada" && !payload.responsible)
      return toast.error("Informe o encarregado responsável pela retirada.");
    if (
      definition.id === "centros-custo" &&
      details.tipo === "Obra" &&
      !payload.workId
    )
      return toast.error("Selecione a obra deste centro de custo.");
    if (
      definition.id === "centros-custo" &&
      details.tipo === "Administração" &&
      payload.workId
    )
      return toast.error(
        "O centro de Administração não pode estar vinculado a uma obra."
      );
    if (editing) updateMutation.mutate({ ...payload, id: editing.id });
    else createMutation.mutate(payload);
  }

  const filteredCenters = centers.filter(center => {
    if (form.workId) return center.workId === Number(form.workId);
    return center.workId == null;
  });

  return (
    <div className="module-page">
      <div className="page-heading">
        <div className="module-title-lockup">
          <span className="module-hero-icon">
            <Icon size={21} />
          </span>
          <div>
            <span className="eyebrow">{definition.group.toUpperCase()}</span>
            <h1>
              {definition.title}
              <span className="module-count">{records.length} registros</span>
            </h1>
            <p>{definition.description}</p>
          </div>
        </div>
        {canCreate && (
          <div className="module-actions">
            <Button className="primary-action" onClick={openCreate}>
              <Plus size={15} /> Novo registro
            </Button>
          </div>
        )}
      </div>
      {!canCreate && (
        <div className="permission-note">
          <LockKeyhole size={15} />{" "}
          {definition.id === "pedidos" ||
          definition.id === "almoxarifado-entrada"
            ? "Apenas usuários com perfil almoxarife podem cadastrar e alterar estes registros."
            : "Apenas usuários com perfil encarregado podem cadastrar e alterar retiradas."}
        </div>
      )}
      {autoPayableModules.has(definition.id) && (
        <div className="permission-note">
          <Banknote size={15} /> Este registro cria uma única conta a pagar
          vinculada; baixas parciais ficam no histórico dessa mesma conta.
        </div>
      )}
      {definition.id === "medicoes" && (
        <div className="permission-note">
          <AlertCircle size={15} /> Medições em análise não geram contas a
          pagar. A obrigação é criada somente após aprovação.
        </div>
      )}
      {definition.id === "contas-pagar" && (
        <div className="permission-note">
          <Banknote size={15} /> Compras, folha e medições aprovadas aparecem
          aqui automaticamente. Use “Novo registro” apenas para outros
          compromissos, para evitar duplicidade.
        </div>
      )}
      <div className="module-toolbar">
        <label className="search-box">
          <Search size={15} />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={`Pesquisar ${definition.shortTitle.toLocaleLowerCase("pt-BR")}…`}
          />
        </label>
        <div className="module-hint">
          <FileText size={14} /> Anexos de contrato, recebimento e notas fiscais
          disponíveis por registro
        </div>
      </div>
      {isStockModule && (
        <StockSummary
          rows={stockBalances}
          loading={stockQuery.isLoading}
          error={stockQuery.error?.message}
        />
      )}
      {definition.id === "cotacoes" && <EqualizationPanel quotes={records} />}
      <section className="table-card">
        {recordsQuery.isLoading ? (
          <div className="table-empty">
            <span>
              <Icon size={19} />
            </span>
            <strong>Carregando registros…</strong>
            <p>Consultando os dados persistidos.</p>
          </div>
        ) : recordsQuery.error ? (
          <div className="table-empty">
            <span>
              <AlertCircle size={19} />
            </span>
            <strong>Não foi possível carregar os registros</strong>
            <p>{recordsQuery.error.message}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="table-empty">
            <span>
              <Icon size={19} />
            </span>
            <strong>
              {search
                ? "Nenhum registro encontrado"
                : "Ainda não há registros neste módulo"}
            </strong>
            <p>
              {search
                ? "Altere os termos da busca e tente novamente."
                : canCreate
                  ? "Use “Novo registro” para começar. Os dados serão salvos no banco da aplicação."
                  : "Os registros deste módulo aparecerão aqui."}
            </p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descrição</th>
                  {definition.showWork && <th>Obra / vínculo</th>}
                  {definition.showCostCenter && <th>Centro de custo</th>}
                  <th>Data</th>
                  <th>Responsável</th>
                  <th>Status</th>
                  <th className="num">Valor total</th>
                  {isFinancial && <th className="num">Em aberto</th>}
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(record => {
                  const center = centers.find(
                    item => item.id === record.costCenterId
                  );
                  const isSystemCentralCenter =
                    record.systemKey === ADMIN_CENTRAL_COST_CENTER_SYSTEM_KEY;
                  const canEditRecord =
                    canCreate && !record.sourceModule && !isSystemCentralCenter;
                  const acquired = Number(
                    record.details?.quantidadeAdquirida ?? 0
                  );
                  const planned = Number(
                    record.details?.quantidadePlanejada ?? 0
                  );
                  const consumed = Number(
                    record.details?.quantidadeConsumida ?? 0
                  );
                  const acquiredVariance = acquired - planned;
                  const consumptionVariance = consumed - planned;
                  return (
                    <tr key={record.id}>
                      <td>
                        {record.code || <span className="record-sub">—</span>}
                        {record.sourceModule && (
                          <span className="record-sub">
                            Origem automática: {record.sourceModule}
                          </span>
                        )}
                      </td>
                      <td className="record-primary">
                        {record.title}
                        {isSystemCentralCenter && (
                          <span className="record-sub system-center-note">
                            Centro sistêmico protegido
                          </span>
                        )}
                        {record.quantity != null && (
                          <span className="record-sub">
                            Qtd. {record.quantity}
                            {record.details?.unidade
                              ? ` ${String(record.details.unidade)}`
                              : ""}
                          </span>
                        )}
                        {definition.id === "consumo" && (
                          <span
                            className={`record-sub ${consumptionVariance > 0 || acquiredVariance < 0 ? "consumption-overrun" : ""}`}
                          >
                            Adquirida {acquired} · planejada {planned} ·
                            consumida {consumed} · aquisição−plano{" "}
                            {acquiredVariance > 0 ? "+" : ""}
                            {acquiredVariance} · consumo−plano{" "}
                            {consumptionVariance > 0 ? "+" : ""}
                            {consumptionVariance}
                          </span>
                        )}
                      </td>
                      {definition.showWork && (
                        <td>
                          {works.find(work => work.id === record.workId)
                            ?.title ??
                            (definition.id === "centros-custo"
                              ? String(record.details?.tipo ?? "Administração")
                              : record.workId == null &&
                                  definition.id === "contas-pagar"
                                ? "Administração"
                                : "—")}
                        </td>
                      )}
                      {definition.showCostCenter && (
                        <td>{center?.title ?? "—"}</td>
                      )}
                      <td>
                        {record.recordDate
                          ? new Intl.DateTimeFormat("pt-BR").format(
                              new Date(`${record.recordDate}T12:00:00`)
                            )
                          : "—"}
                      </td>
                      <td>{record.responsible || "—"}</td>
                      <td>
                        <span
                          className={`table-status status-${record.status.replace(/[^a-z]/g, "")}`}
                        >
                          {record.status.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="num">
                        {money(record.amount)}
                        {isFinancial &&
                          Number(record.settledAmount ?? 0) > 0 && (
                            <span className="record-sub">
                              Baixado: {money(record.settledAmount)}
                            </span>
                          )}
                      </td>
                      {isFinancial && (
                        <td className="num">
                          {money(record.openBalance ?? record.amount)}
                          <span className="record-sub">
                            Venc. {String(record.details?.vencimento ?? "—")}
                          </span>
                        </td>
                      )}
                      <td>
                        <div className="row-actions">
                          <button
                            title="Anexos"
                            aria-label={`Anexos de ${record.title}`}
                            onClick={() => setAttachmentRecord(record)}
                          >
                            <Paperclip size={14} />
                          </button>
                          {isFinancial &&
                            Number(record.openBalance ?? record.amount ?? 0) >
                              0 && (
                              <button
                                title="Registrar baixa parcial ou total"
                                aria-label={`Registrar baixa de ${record.title}`}
                                onClick={() => setSettlementRecord(record)}
                              >
                                <HandCoins size={14} />
                              </button>
                            )}
                          {canEditRecord && (
                            <button
                              title="Editar"
                              aria-label={`Editar ${record.title}`}
                              onClick={() => openEdit(record)}
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          {user?.role === "admin" &&
                            !isSystemCentralCenter &&
                            !record.sourceModule &&
                            !record.settledAmount && (
                              <button
                                className="danger"
                                title="Excluir"
                                aria-label={`Excluir ${record.title}`}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      "Excluir este registro? Arquivos anexados e baixas impedem a exclusão para preservar os documentos e o histórico."
                                    )
                                  )
                                    deleteMutation.mutate({
                                      id: record.id,
                                      module: definition.id as BusinessModuleId,
                                    });
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {records.length > 0 && (
        <div className="table-footer-note">
          {definition.id === "contas-pagar"
            ? "Valores totais são contados uma vez; o saldo em aberto é total menos baixas registradas."
            : "Os registros permanecem vinculados à obra e ao centro de custo informados no cadastro."}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[650px]">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? "Editar registro"
                : `Novo registro · ${definition.shortTitle}`}
            </DialogTitle>
            <DialogDescription>{definition.description}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitForm}>
            {autoPayableModules.has(definition.id) && (
              <div className="form-note">
                <Banknote size={15} />
                <span>
                  Ao salvar, uma única conta a pagar será criada ou atualizada
                  automaticamente.
                </span>
              </div>
            )}
            {definition.id === "folha" && (
              <div className="form-note">
                <Banknote size={15} />
                <span>
                  A conta a pagar usa o líquido calculado: valor bruto menos
                  descontos.
                </span>
              </div>
            )}
            {definition.id === "medicoes" && (
              <div className="form-note">
                <AlertCircle size={15} />
                <span>
                  A aprovação gera a conta a pagar. “Em análise” não gera
                  compromisso financeiro.
                </span>
              </div>
            )}
            <div className="form-grid">
              <Field
                label={
                  definition.id === "obras"
                    ? "Nome da obra"
                    : definition.id === "orcamento"
                      ? "Atividade / item orçamentário"
                      : "Descrição / identificação"
                }
                value={form.title ?? ""}
                onChange={value => setForm({ ...form, title: value })}
                required
              />
              <Field
                label={
                  definition.id === "pedidos"
                    ? "Código do pedido"
                    : definition.id === "cotacoes"
                      ? "Código do mapa"
                      : "Código"
                }
                value={form.code ?? ""}
                onChange={value => setForm({ ...form, code: value })}
                placeholder="Código interno, pedido ou documento"
                required={
                  definition.id === "pedidos" || definition.id === "cotacoes"
                }
              />
              {definition.showWork && (
                <div className="form-field">
                  <label>
                    Obra relacionada
                    {!["centros-custo", "contas-pagar"].includes(definition.id)
                      ? " *"
                      : ""}
                  </label>
                  <select
                    required={
                      !["centros-custo", "contas-pagar"].includes(definition.id)
                    }
                    className="form-control"
                    value={form.workId ?? ""}
                    onChange={event => {
                      const nextWork = works.find(
                        work => work.id === Number(event.target.value)
                      );
                      setForm({
                        ...form,
                        workId: event.target.value,
                        costCenterId: "",
                        ...(definition.id === "medicoes"
                          ? { contratoFornecedor: "" }
                          : {}),
                        ...(definition.id === "contas-receber"
                          ? {
                              cliente: String(nextWork?.details?.cliente ?? ""),
                            }
                          : {}),
                      });
                    }}
                  >
                    <option value="">
                      {definition.id === "centros-custo" ||
                      definition.id === "contas-pagar"
                        ? "Administração / sem obra"
                        : "Selecione a obra"}
                    </option>
                    {works.map(work => (
                      <option value={work.id} key={work.id}>
                        {work.code ? `${work.code} · ` : ""}
                        {work.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {definition.showCostCenter && (
                <div className="form-field">
                  <label>
                    Centro de custo{definition.requireCostCenter ? " *" : ""}
                  </label>
                  <select
                    required={definition.requireCostCenter}
                    className="form-control"
                    value={form.costCenterId ?? ""}
                    onChange={event =>
                      setForm({ ...form, costCenterId: event.target.value })
                    }
                  >
                    <option value="">Selecione o centro</option>
                    {filteredCenters.map(center => (
                      <option value={center.id} key={center.id}>
                        {center.title}
                        {center.workId == null ? " · Administração" : ""}
                      </option>
                    ))}
                  </select>
                  {filteredCenters.length === 0 && (
                    <small className="field-help">
                      {form.workId
                        ? "Cadastre um centro de custo para a obra selecionada."
                        : "Administração Central é criada automaticamente para despesas gerais."}
                    </small>
                  )}
                </div>
              )}
              <div className="form-field">
                <label>
                  {definition.id === "obras"
                    ? "Valor contratado do cliente (R$)"
                    : definition.id === "orcamento"
                      ? "Valor previsto da atividade (R$)"
                      : definition.id === "folha"
                        ? "Valor líquido da folha (R$)"
                        : "Valor total (R$)"}
                  {definition.requireAmount ||
                  (definition.id === "medicoes" &&
                    ["aprovado", "concluido"].includes(form.status))
                    ? " *"
                    : ""}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  value={
                    definition.id === "folha"
                      ? Math.max(
                          0,
                          Number(form.valorBruto ?? 0) -
                            Number(form.descontos ?? 0)
                        ) || ""
                      : (form.amount ?? "")
                  }
                  readOnly={definition.id === "folha"}
                  onChange={event =>
                    setForm({ ...form, amount: event.target.value })
                  }
                  placeholder="0,00"
                  required={Boolean(
                    definition.requireAmount ||
                      (definition.id === "medicoes" &&
                        ["aprovado", "concluido"].includes(form.status))
                  )}
                />
              </div>
              {definition.id !== "obras" && (
                <div className="form-field">
                  <label>Quantidade{isStockModule ? " *" : ""}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    className="form-control"
                    value={form.quantity ?? ""}
                    onChange={event =>
                      setForm({ ...form, quantity: event.target.value })
                    }
                    placeholder="0"
                    required={isStockModule}
                  />
                </div>
              )}
              <div className="form-field">
                <label>
                  {definition.id === "obras"
                    ? "Data de referência"
                    : "Data do registro"}
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={form.recordDate ?? ""}
                  onChange={event =>
                    setForm({ ...form, recordDate: event.target.value })
                  }
                />
              </div>
              {!isFinancial && (
                <div className="form-field">
                  <label>Status</label>
                  <select
                    className="form-control"
                    value={form.status ?? "planejado"}
                    onChange={event =>
                      setForm({ ...form, status: event.target.value })
                    }
                  >
                    {statusOptions.map(status => (
                      <option key={status} value={status}>
                        {status.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-field">
                <label>
                  {definition.id === "almoxarifado-retirada"
                    ? "Encarregado responsável"
                    : definition.id === "almoxarifado-entrada" ||
                        definition.id === "pedidos"
                      ? "Almoxarife responsável"
                      : "Responsável"}
                </label>
                <input
                  className="form-control"
                  value={form.responsible ?? ""}
                  onChange={event =>
                    setForm({ ...form, responsible: event.target.value })
                  }
                  placeholder="Nome do responsável"
                />
              </div>
              {(definition.fields ?? []).map(field => {
                const required = Boolean(
                  field.required ||
                    (definition.id === "medicoes" &&
                      field.key === "vencimento" &&
                      ["aprovado", "concluido"].includes(form.status))
                );
                return (
                  <div
                    className={`form-field ${field.kind === "textarea" ? "full" : ""}`}
                    key={field.key}
                  >
                    <label>
                      {field.label}
                      {required ? " *" : ""}
                    </label>
                    {field.key === "colaborador" &&
                    registeredCollaboratorModules.has(definition.id) ? (
                      <>
                        <select
                          className="form-control"
                          value={form[field.key] ?? ""}
                          onChange={event =>
                            setForm({
                              ...form,
                              [field.key]: event.target.value,
                            })
                          }
                          required={required}
                        >
                          <option value="">
                            Selecione um colaborador cadastrado
                          </option>
                          {collaborators.map(collaborator => (
                            <option
                              value={collaborator.title}
                              key={collaborator.id}
                            >
                              {collaborator.title}
                            </option>
                          ))}
                        </select>
                        {collaborators.length === 0 && (
                          <small className="field-help">
                            Cadastre primeiro o colaborador neste módulo.
                          </small>
                        )}
                      </>
                    ) : field.key === "cliente" &&
                      registeredClientModules.has(definition.id) ? (
                      <>
                        <select
                          className="form-control"
                          value={form[field.key] ?? ""}
                          onChange={event =>
                            setForm({
                              ...form,
                              [field.key]: event.target.value,
                            })
                          }
                          required={required}
                        >
                          <option value="">
                            Selecione um cliente cadastrado
                          </option>
                          {form[field.key] &&
                            !clientOptions.some(
                              client => client.title === form[field.key]
                            ) && (
                              <option value={form[field.key]}>
                                {form[field.key]}
                              </option>
                            )}
                          {clientOptions.map(client => (
                            <option value={client.title} key={client.id}>
                              {client.title}
                            </option>
                          ))}
                        </select>
                        {clientOptions.length === 0 && (
                          <small className="field-help">
                            {definition.id === "contas-receber" && form.workId
                              ? "A obra selecionada ainda não possui cliente cadastrado."
                              : "Cadastre primeiro o cliente neste módulo."}
                          </small>
                        )}
                      </>
                    ) : field.key === "contratoFornecedor" &&
                      definition.id === "medicoes" ? (
                      <>
                        <select
                          className="form-control"
                          value={form[field.key] ?? ""}
                          onChange={event =>
                            setForm({
                              ...form,
                              [field.key]: event.target.value,
                            })
                          }
                          required={required}
                        >
                          <option value="">Selecione um contrato</option>
                          {supplierContractOptions.map(contract => (
                            <option key={contract.id} value={contract.id}>
                              {contract.code ? `${contract.code} · ` : ""}
                              {contract.title}
                            </option>
                          ))}
                        </select>
                        {supplierContractOptions.length === 0 && (
                          <small className="field-help">
                            Cadastre o contrato do fornecedor para esta obra e
                            selecione o fornecedor correspondente.
                          </small>
                        )}
                      </>
                    ) : field.key === "fornecedor" &&
                      registeredSupplierModules.has(definition.id) ? (
                      <>
                        <select
                          className="form-control"
                          value={form[field.key] ?? ""}
                          onChange={event =>
                            setForm({
                              ...form,
                              [field.key]: event.target.value,
                              ...(definition.id === "medicoes"
                                ? { contratoFornecedor: "" }
                                : {}),
                            })
                          }
                          required={required}
                        >
                          <option value="">
                            Selecione um fornecedor cadastrado
                          </option>
                          {form[field.key] &&
                            !suppliers.some(
                              supplier => supplier.title === form[field.key]
                            ) && (
                              <option value={form[field.key]}>
                                {form[field.key]}
                              </option>
                            )}
                          {suppliers.map(supplier => (
                            <option value={supplier.title} key={supplier.id}>
                              {supplier.code ? `${supplier.code} · ` : ""}
                              {supplier.title}
                            </option>
                          ))}
                        </select>
                        {suppliers.length === 0 && (
                          <small className="field-help">
                            Cadastre primeiro o fornecedor neste módulo.
                          </small>
                        )}
                      </>
                    ) : field.kind === "textarea" ? (
                      <textarea
                        className="form-control"
                        value={form[field.key] ?? ""}
                        onChange={event =>
                          setForm({ ...form, [field.key]: event.target.value })
                        }
                        placeholder={field.placeholder}
                        required={required}
                      />
                    ) : field.kind === "select" ? (
                      <select
                        className="form-control"
                        value={form[field.key] ?? ""}
                        onChange={event =>
                          setForm({ ...form, [field.key]: event.target.value })
                        }
                        required={required}
                      >
                        <option value="">Selecione</option>
                        {field.options?.map(option => (
                          <option value={option} key={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="form-control"
                        type={
                          field.kind === "number"
                            ? "number"
                            : field.kind === "date"
                              ? "date"
                              : "text"
                        }
                        min={field.kind === "number" ? "0" : undefined}
                        step={field.kind === "number" ? "0.001" : undefined}
                        value={form[field.key] ?? ""}
                        onChange={event =>
                          setForm({ ...form, [field.key]: event.target.value })
                        }
                        placeholder={field.placeholder}
                        required={required}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <DialogFooter className="dialog-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setFormOpen(false)}
              >
                Cancelar
              </button>
              <Button
                type="submit"
                className="primary-action"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editing ? "Salvar alterações" : "Salvar registro"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {attachmentRecord && (
        <AttachmentsDialog
          record={attachmentRecord}
          canUpload={canCreate}
          open
          onOpenChange={open => {
            if (!open) setAttachmentRecord(null);
          }}
        />
      )}
      {settlementRecord && (
        <SettlementDialog
          record={settlementRecord}
          open
          onOpenChange={open => {
            if (!open) setSettlementRecord(null);
          }}
          onSaved={refreshData}
        />
      )}
    </div>
  );
}

function EqualizationPanel({ quotes }: { quotes: RecordRow[] }) {
  const groups = new Map<string, { title: string; rows: RecordRow[] }>();
  for (const quote of quotes) {
    const item = String(quote.details?.itemCotado ?? quote.title);
    const title = `${quote.code ? `${quote.code} · ` : ""}${item}`;
    const key = `${quote.code ?? item}::${item.toLocaleLowerCase("pt-BR")}`;
    const group = groups.get(key) ?? { title, rows: [] };
    group.rows.push(quote);
    groups.set(key, group);
  }
  if (groups.size === 0)
    return (
      <div className="empty-inline equalization-empty">
        Cadastre cotações do mesmo item com o mesmo código para comparar
        fornecedores e condições.
      </div>
    );
  return (
    <section className="panel equalization-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">MAPA COMPARATIVO</span>
          <h2>Equalização de fornecedores</h2>
        </div>
        <span className="mini-count">{quotes.length} cotações</span>
      </div>
      {[...groups.entries()].map(([key, group]) => {
        const rows = [...group.rows].sort(
          (a, b) =>
            Number(a.details?.precoUnitario ?? Infinity) -
            Number(b.details?.precoUnitario ?? Infinity)
        );
        const prices = rows
          .map(row => Number(row.details?.precoUnitario))
          .filter(price => Number.isFinite(price) && price > 0);
        const lowest = prices.length ? Math.min(...prices) : null;
        return (
          <div className="equalization-group" key={key}>
            <strong className="equalization-title">{group.title}</strong>
            <div className="data-table-wrap">
              <table className="data-table equalization-table">
                <thead>
                  <tr>
                    <th>Fornecedor</th>
                    <th className="num">Preço unitário</th>
                    <th>Prazo</th>
                    <th>Condição de pagamento</th>
                    <th>Validade</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const price = Number(row.details?.precoUnitario);
                    const isLowest = lowest != null && price === lowest;
                    return (
                      <tr
                        key={row.id}
                        className={isLowest ? "quote-lowest" : ""}
                      >
                        <td className="record-primary">
                          {String(
                            row.details?.fornecedor ??
                              row.responsible ??
                              "Fornecedor não informado"
                          )}
                          {isLowest && (
                            <span className="record-sub">
                              Menor preço informado
                            </span>
                          )}
                        </td>
                        <td className="num">
                          {Number.isFinite(price) && price > 0
                            ? money(price)
                            : "—"}
                        </td>
                        <td>{String(row.details?.prazoEntrega ?? "—")}</td>
                        <td>{String(row.details?.condicaoPagamento ?? "—")}</td>
                        <td>{String(row.details?.validade ?? "—")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function StockSummary({
  rows,
  loading,
  error,
}: {
  rows: StockRow[];
  loading: boolean;
  error?: string;
}) {
  const quantity = (value: number) =>
    new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(value);
  return (
    <section className="panel stock-summary">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">SALDO DISPONÍVEL</span>
          <h2>Posição do almoxarifado</h2>
        </div>
        <span className="mini-count">{rows.length} materiais</span>
      </div>
      {loading ? (
        <div className="empty-inline">
          Calculando saldo de entradas e retiradas…
        </div>
      ) : error ? (
        <div className="empty-inline">
          Não foi possível consultar o estoque: {error}
        </div>
      ) : rows.length ? (
        <div className="data-table-wrap">
          <table className="data-table stock-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Obra</th>
                <th>Centro de custo</th>
                <th className="num">Recebido</th>
                <th className="num">Retirado</th>
                <th className="num">Disponível</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr
                  key={`${row.workTitle}-${row.costCenterTitle}-${row.material}-${row.unit}`}
                >
                  <td className="record-primary">
                    {row.material}
                    <span className="record-sub">Unidade: {row.unit}</span>
                  </td>
                  <td>{row.workTitle}</td>
                  <td>{row.costCenterTitle}</td>
                  <td className="num">{quantity(row.received)}</td>
                  <td className="num">{quantity(row.withdrawn)}</td>
                  <td
                    className={`num ${row.balance <= 0 ? "stock-empty-balance" : "stock-positive-balance"}`}
                  >
                    {quantity(row.balance)} {row.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-inline">
          Registre um recebimento para iniciar o saldo de estoque por obra e
          centro de custo.
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="form-field">
      <label>
        {label}
        {required ? " *" : ""}
      </label>
      <input
        className="form-control"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={240}
      />
    </div>
  );
}

function AttachmentsDialog({
  record,
  canUpload,
  open,
  onOpenChange,
}: {
  record: RecordRow;
  canUpload: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [category, setCategory] =
    useState<(typeof fileCategories)[number]["value"]>("outro");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const attachments = trpc.files.list.useQuery(
    { recordId: record.id },
    { enabled: open }
  );
  const utils = trpc.useUtils();
  const upload = trpc.files.upload.useMutation({
    onSuccess: async () => {
      await utils.files.list.invalidate({ recordId: record.id });
      setSelectedFile(null);
      toast.success("Arquivo armazenado e vinculado ao registro.");
    },
    onError: error => toast.error(error.message),
  });
  const getUrl = trpc.files.downloadUrl.useMutation({
    onError: error => toast.error(error.message),
  });
  async function uploadFile() {
    if (!selectedFile) return toast.error("Selecione um arquivo.");
    if (selectedFile.size > 10 * 1024 * 1024)
      return toast.error("O arquivo deve ter no máximo 10 MB.");
    const allowed = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "text/xml",
      "application/xml",
      "text/plain",
    ];
    if (!allowed.includes(selectedFile.type))
      return toast.error(
        "Formato não permitido. Use PDF, PNG, JPG, WEBP ou XML."
      );
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = () =>
        reject(new Error("Não foi possível ler o arquivo."));
      reader.readAsDataURL(selectedFile);
    });
    upload.mutate({
      recordId: record.id,
      fileName: selectedFile.name,
      contentType: selectedFile.type,
      size: selectedFile.size,
      category,
      base64,
    });
  }
  async function openFile(id: number) {
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try {
      const result = await getUrl.mutateAsync({ id });
      if (tab) tab.location.href = result.url;
      else
        toast.error(
          "Permita a abertura de uma nova aba para baixar o arquivo."
        );
    } catch {
      tab?.close();
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[590px]">
        <DialogHeader>
          <DialogTitle>Arquivos do registro</DialogTitle>
          <DialogDescription>
            {record.code ? `${record.code} · ` : ""}
            {record.title}
          </DialogDescription>
        </DialogHeader>
        <div className="attachment-list">
          {attachments.isLoading ? (
            <div className="empty-inline">Carregando arquivos…</div>
          ) : attachments.data?.length ? (
            attachments.data.map(file => (
              <div className="attachment-row" key={file.id}>
                <span className="attachment-icon">
                  <FileText size={16} />
                </span>
                <span className="attachment-copy">
                  <strong>{file.fileName}</strong>
                  <small>
                    {categoryLabel[file.category] ?? file.category} ·{" "}
                    {formatBytes(file.size)} ·{" "}
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "medium",
                    }).format(new Date(file.createdAt))}
                  </small>
                </span>
                <button
                  className="icon-button attachment-download"
                  title="Abrir / baixar"
                  onClick={() => void openFile(file.id)}
                  disabled={getUrl.isPending}
                >
                  <Download size={16} />
                </button>
              </div>
            ))
          ) : (
            <div className="attachment-empty">
              <Paperclip size={20} />
              <strong>Nenhum arquivo anexado</strong>
              <span>
                Contratos, comprovantes de recebimento e notas fiscais podem ser
                vinculados aqui.
              </span>
            </div>
          )}
        </div>
        {canUpload && (
          <div className="upload-box">
            <div className="form-grid">
              <div className="form-field">
                <label>Categoria do documento</label>
                <select
                  className="form-control"
                  value={category}
                  onChange={event =>
                    setCategory(event.target.value as typeof category)
                  }
                >
                  {fileCategories.map(item => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Arquivo (até 10 MB)</label>
                <input
                  className="form-control file-input"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.xml,.txt"
                  onChange={event =>
                    setSelectedFile(event.target.files?.[0] ?? null)
                  }
                />
              </div>
            </div>
            {selectedFile && (
              <div className="selected-file">
                <FilePlus2 size={14} />
                <span>
                  {selectedFile.name} · {formatBytes(selectedFile.size)}
                </span>
                <button
                  className="icon-button"
                  onClick={() => setSelectedFile(null)}
                  aria-label="Remover arquivo selecionado"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <Button
              className="upload-button"
              onClick={() => void uploadFile()}
              disabled={!selectedFile || upload.isPending}
            >
              <UploadCloud size={15} />{" "}
              {upload.isPending ? "Enviando…" : "Enviar e vincular arquivo"}
            </Button>
            <p className="storage-note">
              Arquivo armazenado no serviço durável do projeto. O acesso ao
              download exige autenticação.
            </p>
          </div>
        )}
        {!canUpload && (
          <div className="permission-note">
            <LockKeyhole size={14} /> Seu perfil não pode adicionar anexos a
            este registro.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SettlementDialog({
  record,
  open,
  onOpenChange,
  onSaved,
}: {
  record: RecordRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [settlementDate, setSettlementDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [reference, setReference] = useState("");
  const [paidByCentral, setPaidByCentral] = useState(false);
  const canMarkAsCentralPaid =
    record.module === "contas-pagar" &&
    record.workId != null &&
    record.costCenterId != null;
  const utils = trpc.useUtils();
  const history = trpc.settlements.list.useQuery(
    { recordId: record.id },
    { enabled: open }
  );
  const create = trpc.settlements.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        onSaved(),
        utils.settlements.list.invalidate({ recordId: record.id }),
      ]);
      setAmount("");
      setReference("");
      setPaidByCentral(false);
      toast.success("Baixa registrada no histórico financeiro.");
    },
    onError: error => toast.error(error.message),
  });
  const settled = Number(record.settledAmount ?? 0);
  const openBalance = Number(record.openBalance ?? record.amount ?? 0);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const amountValue = Number(amount);
    if (!(amountValue > 0))
      return toast.error("Informe um valor de baixa maior que zero.");
    if (amountValue > openBalance)
      return toast.error("O valor excede o saldo em aberto.");
    create.mutate({
      recordId: record.id,
      amount: amountValue,
      settlementDate,
      reference: reference.trim() || null,
      paidByCentral: canMarkAsCentralPaid && paidByCentral,
    });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {record.module === "contas-receber"
              ? "Registrar recebimento"
              : "Registrar baixa"}
          </DialogTitle>
          <DialogDescription>
            {record.code ? `${record.code} · ` : ""}
            {record.title}
          </DialogDescription>
        </DialogHeader>
        <div className="settlement-balances">
          <div>
            <span>Valor total</span>
            <strong>{money(record.amount)}</strong>
          </div>
          <div>
            <span>Já baixado</span>
            <strong>{money(settled)}</strong>
          </div>
          <div>
            <span>Em aberto</span>
            <strong>{money(openBalance)}</strong>
          </div>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="form-field">
              <label>Valor desta baixa (R$)</label>
              <input
                type="number"
                className="form-control"
                min="0.01"
                max={openBalance}
                step="0.01"
                value={amount}
                onChange={event => setAmount(event.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label>Data da baixa</label>
              <input
                type="date"
                className="form-control"
                value={settlementDate}
                onChange={event => setSettlementDate(event.target.value)}
                required
              />
            </div>
            <div className="form-field full">
              <label>Referência / comprovante</label>
              <input
                className="form-control"
                value={reference}
                onChange={event => setReference(event.target.value)}
                placeholder="Identificação do pagamento ou recebimento"
                maxLength={240}
              />
            </div>
          </div>
          {canMarkAsCentralPaid && (
            <label className="settlement-central-option">
              <input
                type="checkbox"
                checked={paidByCentral}
                onChange={event => setPaidByCentral(event.target.checked)}
              />
              <span>
                <strong>Pago pela Administração Central</strong>
                <small>
                  Registra a cobertura de caixa sem transferir o custo para fora
                  da obra ou criar reembolso.
                </small>
              </span>
            </label>
          )}
          <div className="form-note immutable-note">
            <LockKeyhole size={14} />
            <span>
              Baixas são imutáveis: confirme valor e data. Para evitar
              reversões, não é possível editar ou apagar uma baixa registrada.
            </span>
          </div>
          <DialogFooter className="dialog-footer">
            <button
              type="button"
              className="secondary-button"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </button>
            <Button
              type="submit"
              className="primary-action"
              disabled={create.isPending || openBalance <= 0}
            >
              {create.isPending ? "Registrando…" : "Registrar baixa"}
            </Button>
          </DialogFooter>
        </form>
        <div className="settlement-history">
          <strong>Histórico de baixas</strong>
          {history.isLoading ? (
            <span className="record-sub">Carregando…</span>
          ) : history.data?.length ? (
            history.data.map(item => (
              <div className="settlement-history-row" key={item.id}>
                <span>
                  {new Intl.DateTimeFormat("pt-BR").format(
                    new Date(`${item.settlementDate}T12:00:00`)
                  )}
                </span>
                <strong>{money(item.amount)}</strong>
                <small>
                  {item.paidByCentral ? "Administração Central · " : ""}
                  {item.reference || "Sem referência"}
                </small>
              </div>
            ))
          ) : (
            <span className="record-sub">Nenhuma baixa registrada.</span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CashFlowPage() {
  const summary = trpc.dashboard.summary.useQuery();
  const payables = trpc.records.list.useQuery({ module: "contas-pagar" });
  const receivables = trpc.records.list.useQuery({ module: "contas-receber" });
  const finance = summary.data;
  const monthly = new Map<
    string,
    {
      incomingDue: number;
      outgoingDue: number;
      incomingSettled: number;
      outgoingSettled: number;
    }
  >();
  const entries = [
    ...(payables.data ?? []),
    ...(receivables.data ?? []),
  ] as RecordRow[];
  for (const record of entries) {
    const date = String(record.details?.vencimento ?? "");
    const balance = Number(record.openBalance ?? record.amount ?? 0);
    if (!date || balance <= 0) continue;
    const month = date.slice(0, 7);
    const value = monthly.get(month) ?? {
      incomingDue: 0,
      outgoingDue: 0,
      incomingSettled: 0,
      outgoingSettled: 0,
    };
    if (record.module === "contas-receber") value.incomingDue += balance;
    else value.outgoingDue += balance;
    monthly.set(month, value);
  }
  for (const item of finance?.settledMonthly ?? []) {
    const value = monthly.get(item.month) ?? {
      incomingDue: 0,
      outgoingDue: 0,
      incomingSettled: 0,
      outgoingSettled: 0,
    };
    value.incomingSettled += item.incoming;
    value.outgoingSettled += item.outgoing;
    monthly.set(item.month, value);
  }
  const months = [...monthly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 8);
  const max = Math.max(
    1,
    ...months.map(([, value]) =>
      Math.max(
        value.incomingDue,
        value.outgoingDue,
        value.incomingSettled,
        value.outgoingSettled
      )
    )
  );
  return (
    <div className="module-page">
      <div className="page-heading">
        <div className="module-title-lockup">
          <span className="module-hero-icon">
            <Wallet size={21} />
          </span>
          <div>
            <span className="eyebrow">FINANCEIRO</span>
            <h1>Fluxo de caixa</h1>
            <p>
              Caixa realizado, custos, vencimentos e resultado contratual por
              obra.
            </p>
          </div>
        </div>
      </div>
      <div className="cashflow-strip cashflow-strip-four">
        <div className="cashflow-card">
          <span>Contratos com clientes</span>
          <strong>{money(finance?.contracted)}</strong>
        </div>
        <div className="cashflow-card">
          <span>Planilha contratada</span>
          <strong>{money(finance?.budgeted)}</strong>
        </div>
        <div className="cashflow-card">
          <span>Custos totais registrados</span>
          <strong>{money(finance?.costs)}</strong>
        </div>
        <div className="cashflow-card">
          <span>Saldo contratual após custos</span>
          <strong>{money(finance?.availableContract)}</strong>
        </div>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">POR OBRA</span>
            <h2>Planilha / contrato x custos e recebimentos</h2>
          </div>
          <span className="mini-count">
            {finance?.workFinance.length ?? 0} obras
          </span>
        </div>
        {!finance?.workFinance.length ? (
          <div className="table-empty">
            <span>
              <Building2 size={19} />
            </span>
            <strong>Cadastre uma obra e um contrato de cliente</strong>
            <p>
              O comparativo por obra considera planilha contratada, compromissos
              de contas a pagar, baixas e contas a receber.
            </p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table cashflow-table">
              <thead>
                <tr>
                  <th>Obra</th>
                  <th className="num">Contrato</th>
                  <th className="num">Planilha</th>
                  <th>Orçamento consumido</th>
                  <th className="num">Custos totais</th>
                  <th className="num">Pago pela Central</th>
                  <th className="num">A pagar</th>
                  <th className="num">Recebido</th>
                  <th className="num">A receber</th>
                  <th className="num">Caixa líquido</th>
                  <th className="num">Resultado da obra</th>
                </tr>
              </thead>
              <tbody>
                {finance.workFinance.map(work => {
                  const ratio = work.budgeted
                    ? Math.min(100, (work.costs / work.budgeted) * 100)
                    : 0;
                  return (
                    <tr key={work.id}>
                      <td className="record-primary">
                        {work.title}
                        <span className="record-sub">
                          {work.code || "Sem código"}
                        </span>
                      </td>
                      <td className="num">{money(work.contracted)}</td>
                      <td className="num">{money(work.budgeted)}</td>
                      <td>
                        <div className="cashflow-bar">
                          <span style={{ width: `${ratio}%` }} />
                        </div>
                        <span className="record-sub">
                          {work.budgeted
                            ? `${ratio.toFixed(1)}% do orçamento`
                            : "Sem itens orçamentários"}
                        </span>
                      </td>
                      <td className="num">
                        {money(work.costs)}
                        <span className="record-sub">
                          Baixado: {money(work.settledCosts)}
                        </span>
                      </td>
                      <td className="num">{money(work.centralPaidCosts)}</td>
                      <td className="num">{money(work.openPayables)}</td>
                      <td className="num">{money(work.received)}</td>
                      <td className="num">{money(work.receivables)}</td>
                      <td
                        className={`num ${work.cashBalance < 0 ? "negative-balance" : "positive-balance"}`}
                      >
                        {money(work.cashBalance)}
                      </td>
                      <td
                        className={`num ${work.profitForecast < 0 ? "negative-balance" : ""}`}
                      >
                        {money(work.profitForecast)}
                        <span className="record-sub">
                          {["concluido", "encerrado"].includes(
                            work.status.toLocaleLowerCase("pt-BR")
                          )
                            ? "Lucro final"
                            : "Resultado projetado"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="table-footer-note">
          Custos incluem compromissos pagos e em aberto uma única vez. Caixa =
          recebimentos baixados − despesas efetivamente pagas, inclusive as
          honradas pela Administração Central (valor mostrado separadamente,
          sem duplicar o custo). Resultado = contrato − custos registrados da
          obra; overhead do escritório não é rateado.
        </p>
      </section>
      <div className="cashflow-sections">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">VENCIMENTOS E BAIXAS</span>
              <h2>Fluxo mensal</h2>
            </div>
          </div>
          {months.length ? (
            months.map(([month, value]) => (
              <div className="month-row month-row-four" key={month}>
                <strong>
                  {new Intl.DateTimeFormat("pt-BR", {
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(`${month}-01T00:00:00Z`))}
                </strong>
                <div className="month-bars">
                  <span
                    className="incoming-bar"
                    style={{
                      width: `${Math.max(1, (value.incomingDue / max) * 100)}%`,
                    }}
                  />
                  <span
                    className="outgoing-bar"
                    style={{
                      width: `${Math.max(1, (value.outgoingDue / max) * 100)}%`,
                    }}
                  />
                  <span
                    className="settled-in-bar"
                    style={{
                      width: `${Math.max(1, (value.incomingSettled / max) * 100)}%`,
                    }}
                  />
                  <span
                    className="settled-out-bar"
                    style={{
                      width: `${Math.max(1, (value.outgoingSettled / max) * 100)}%`,
                    }}
                  />
                </div>
                <div className="month-values">
                  <span>Receber {money(value.incomingDue)}</span>
                  <span>Pagar {money(value.outgoingDue)}</span>
                  <span>Recebido {money(value.incomingSettled)}</span>
                  <span>Pago {money(value.outgoingSettled)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-inline">
              Inclua vencimentos nas contas para projetar os saldos em aberto.
            </div>
          )}
          <div className="chart-legend">
            <span>
              <i className="incoming-key" /> A receber
            </span>
            <span>
              <i className="outgoing-key" /> A pagar
            </span>
            <span>
              <i className="settled-in-key" /> Recebido
            </span>
            <span>
              <i className="settled-out-key" /> Pago
            </span>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">POSIÇÃO FINANCEIRA</span>
              <h2>Saldos e baixas</h2>
            </div>
          </div>
          <div className="flow-line">
            <span>Contas a receber · em aberto</span>
            <strong>{money(finance?.receivables)}</strong>
          </div>
          <div className="flow-line">
            <span>Contas a pagar · em aberto</span>
            <strong>{money(finance?.payables)}</strong>
          </div>
          <div className="flow-line">
            <span>Contas a receber · total</span>
            <strong>{money(finance?.totalReceivables)}</strong>
          </div>
          <div className="flow-line">
            <span>Contas a pagar · total comprometido</span>
            <strong>{money(finance?.totalPayables)}</strong>
          </div>
          <div className="flow-line">
            <span>Baixas de contas a pagar</span>
            <strong>{money(finance?.settledCosts)}</strong>
          </div>
          <div className="flow-callout">
            <AlertCircle size={15} />
            <span>
              As baixas são imutáveis e não podem ser revertidas na edição.
              Contas automáticas permanecem ligadas à compra, medição aprovada
              ou folha de origem.
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
