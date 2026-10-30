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
  calculateBudgetProgressMetrics,
  calculateBudgetProgressTotals,
  selectProgressSnapshotAtOrBefore,
} from "@shared/budget-progress";
import {
  Activity,
  AlertCircle,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileSpreadsheet,
  History,
  Plus,
  Search,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type Snapshot = {
  id: number;
  budgetItemId: number;
  measurementDate: string;
  physicalPercent: number;
  approvedAmount: number;
  notes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};
type ProgressRow = {
  itemId: number;
  code: string | null;
  title: string;
  activity: string;
  workId: number | null;
  workTitle: string;
  contractAmount: number;
  contractedQuantity: number;
  unit: string;
  status: string;
  history: Snapshot[];
};

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
const percent = (value: number) =>
  `${Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })}%`;
const percentagePoints = (value: number) =>
  `${value > 0 ? "+" : ""}${Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} p.p.`;
const todayLocal = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};
const parseNumericInput = (value: string) => {
  const normalized = value.trim().replace(",", ".");
  return normalized === "" ? Number.NaN : Number(normalized);
};
const dateLabel = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
};
const varianceTone = (value: number) =>
  value > 0.005
    ? "variance-financial-ahead"
    : value < -0.005
      ? "variance-physical-ahead"
      : "variance-balanced";

export default function BudgetProgressPage() {
  const { user } = useAuth();
  const report = trpc.budgetProgress.report.useQuery();
  const utils = trpc.useUtils();
  const [selectedWork, setSelectedWork] = useState("all");
  const [search, setSearch] = useState("");
  const [includeCanceled, setIncludeCanceled] = useState(false);
  const [measurementItem, setMeasurementItem] = useState<ProgressRow | null>(
    null
  );
  const [historyItem, setHistoryItem] = useState<ProgressRow | null>(null);
  const [measurementDate, setMeasurementDate] = useState(todayLocal());
  const [physicalPercent, setPhysicalPercent] = useState("0");
  const [approvedAmount, setApprovedAmount] = useState("0");
  const [notes, setNotes] = useState("");

  const mutation = trpc.budgetProgress.save.useMutation({
    onSuccess: async () => {
      toast.success("Medição do item registrada.");
      await utils.budgetProgress.report.invalidate();
      setMeasurementItem(null);
    },
    onError: error => toast.error(error.message),
  });

  const rows = report.data?.rows ?? [];
  const visibleRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return rows.filter(row => {
      if (selectedWork !== "all" && row.workId !== Number(selectedWork))
        return false;
      if (!includeCanceled && row.status === "cancelado") return false;
      if (!query) return true;
      return `${row.workTitle} ${row.title} ${row.code ?? ""} ${row.activity}`
        .toLocaleLowerCase("pt-BR")
        .includes(query);
    });
  }, [includeCanceled, rows, search, selectedWork]);

  const activeRows = visibleRows.filter(row => row.status !== "cancelado");
  const totals = calculateBudgetProgressTotals(
    activeRows.map(row => {
      const latest = selectProgressSnapshotAtOrBefore(
        row.history,
        todayLocal()
      );
      return {
        contractAmount: row.contractAmount,
        physicalPercent: latest?.physicalPercent ?? 0,
        approvedAmount: latest?.approvedAmount ?? 0,
      };
    })
  );

  const openMeasurement = (item: ProgressRow) => {
    const defaultDate = todayLocal();
    const sameDate = item.history.find(
      snapshot => snapshot.measurementDate === defaultDate
    );
    const base = selectProgressSnapshotAtOrBefore(item.history, defaultDate);
    setMeasurementItem(item);
    setMeasurementDate(defaultDate);
    setPhysicalPercent(String(base?.physicalPercent ?? 0));
    setApprovedAmount(String(base?.approvedAmount ?? 0));
    setNotes(sameDate?.notes ?? "");
  };

  const changeMeasurementDate = (value: string) => {
    setMeasurementDate(value);
    const existing = measurementItem?.history.find(
      snapshot => snapshot.measurementDate === value
    );
    const base = measurementItem
      ? selectProgressSnapshotAtOrBefore(measurementItem.history, value)
      : null;
    setPhysicalPercent(String(base?.physicalPercent ?? 0));
    setApprovedAmount(String(base?.approvedAmount ?? 0));
    setNotes(existing?.notes ?? "");
  };

  const submitMeasurement = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!measurementItem) return;
    if (measurementDate > todayLocal()) {
      toast.error("A data da medição não pode ser futura.");
      return;
    }
    const physical = parseNumericInput(physicalPercent);
    const approved = parseNumericInput(approvedAmount);
    if (!Number.isFinite(physical) || physical < 0 || physical > 100) {
      toast.error("Informe um avanço físico acumulado entre 0% e 100%.");
      return;
    }
    if (!Number.isFinite(approved) || approved < 0) {
      toast.error("Informe um valor aprovado acumulado válido.");
      return;
    }
    if (approved - measurementItem.contractAmount > 0.005) {
      toast.error(
        "O valor acumulado aprovado não pode ultrapassar o valor contratado do item."
      );
      return;
    }
    mutation.mutate({
      budgetItemId: measurementItem.itemId,
      measurementDate,
      physicalPercent: physical,
      approvedAmount: approved,
      notes: notes.trim() || null,
    });
  };

  const formSnapshotExists = measurementItem?.history.some(
    snapshot => snapshot.measurementDate === measurementDate
  );

  return (
    <div className="dashboard-page budget-progress-page">
      <div className="page-heading budget-progress-heading">
        <div>
          <span className="eyebrow">CONTROLE DO CONTRATO COM O CLIENTE</span>
          <h1>Avanço físico x financeiro</h1>
          <p>
            Compare, item a item, o que foi executado com o que o cliente já
            aprovou em medição.
          </p>
        </div>
        <Link href="/m/orcamento" className="text-link">
          <FileSpreadsheet size={16} /> Abrir planilha contratada
          <ChevronRight size={15} />
        </Link>
      </div>

      <section className="progress-explainer">
        <div className="progress-explainer-icon">
          <Activity size={19} />
        </div>
        <div>
          <strong>Como interpretar o desvio</strong>
          <p>
            O valor físico equivalente é o valor do item contratado multiplicado
            pelo avanço físico. A diferença é <b>medição aprovada − valor físico</b>:
            positiva indica financeiro à frente; negativa indica execução física
            à frente. Aprovação não é faturamento nem recebimento — o caixa segue
            em Contas a Receber e no Fluxo de Caixa.
          </p>
        </div>
      </section>

      <div className="progress-metric-grid">
        <ProgressMetric
          label="Contrato selecionado"
          value={money(totals.contractAmount)}
          caption="Itens ativos da planilha contratada"
          icon={FileSpreadsheet}
        />
        <ProgressMetric
          label="Avanço físico ponderado"
          value={percent(totals.physicalPercent)}
          caption={money(totals.physicalValue) + " em valor físico equivalente"}
          icon={Activity}
        />
        <ProgressMetric
          label="Medição aprovada ponderada"
          value={percent(totals.financialPercent)}
          caption={money(totals.approvedAmount) + " aprovada pelo cliente"}
          icon={TrendingUp}
        />
        <ProgressMetric
          label="Desvio financeiro − físico"
          value={money(totals.varianceAmount)}
          caption={percentagePoints(totals.variancePercentagePoints)}
          icon={totals.varianceAmount < 0 ? Activity : TrendingUp}
          tone={varianceTone(totals.varianceAmount)}
        />
      </div>

      <section className="panel budget-progress-panel">
        <div className="progress-toolbar">
          <div className="progress-filters">
            <label className="progress-search">
              <Search size={16} />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Buscar obra, item ou código"
                aria-label="Buscar obra, item ou código"
              />
            </label>
            <select
              className="progress-select"
              value={selectedWork}
              onChange={event => setSelectedWork(event.target.value)}
              aria-label="Filtrar por obra"
            >
              <option value="all">Todas as obras</option>
              {(report.data?.works ?? []).map(work => (
                <option value={work.id} key={work.id}>
                  {work.title}
                </option>
              ))}
            </select>
            <label className="progress-canceled-filter">
              <input
                type="checkbox"
                checked={includeCanceled}
                onChange={event => setIncludeCanceled(event.target.checked)}
              />
              Incluir cancelados
            </label>
          </div>
          <span className="progress-row-count">
            {visibleRows.length} {visibleRows.length === 1 ? "item" : "itens"}
          </span>
        </div>

        {report.isLoading ? (
          <div className="empty-inline">
            <span className="loader" /> Carregando itens contratados…
          </div>
        ) : report.error ? (
          <div className="progress-error">
            <AlertCircle size={18} />
            <span>{report.error.message}</span>
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="progress-empty">
            <div className="empty-icon">
              <FileSpreadsheet size={20} />
            </div>
            <strong>
              {rows.length === 0
                ? "Ainda não há itens na planilha contratada"
                : "Nenhum item corresponde aos filtros"}
            </strong>
            <span>
              Cadastre os itens do cliente para comparar execução e aprovação.
            </span>
            {rows.length === 0 && (
              <Link href="/m/orcamento">
                <Button className="primary-action">
                  <Plus size={15} /> Cadastrar itens
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table budget-progress-table">
              <thead>
                <tr>
                  <th>Obra / item contratado</th>
                  <th className="num">Valor do item</th>
                  <th>Avanço físico</th>
                  <th className="num">Valor físico</th>
                  <th className="num">Aprovado</th>
                  <th>Desvio</th>
                  <th>Último corte</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(item => {
                  const latest = selectProgressSnapshotAtOrBefore(
                    item.history,
                    todayLocal()
                  );
                  const metrics = calculateBudgetProgressMetrics({
                    contractAmount: item.contractAmount,
                    physicalPercent: latest?.physicalPercent ?? 0,
                    approvedAmount: latest?.approvedAmount ?? 0,
                  });
                  const canceled = item.status === "cancelado";
                  const barWidth = Math.min(
                    100,
                    Math.max(0, metrics.physicalPercent)
                  );
                  return (
                    <tr key={item.itemId}>
                      <td className="record-primary progress-item-cell">
                        <span className="progress-work-name">{item.workTitle}</span>
                        <strong>{item.title}</strong>
                        <span className="record-sub">
                          {item.code ? `${item.code} · ` : ""}
                          {item.activity || "Item da planilha contratada"}
                          {item.contractedQuantity > 0
                            ? ` · ${item.contractedQuantity.toLocaleString("pt-BR")} ${item.unit}`
                            : ""}
                          {canceled ? " · cancelado" : ""}
                        </span>
                      </td>
                      <td className="num">{money(item.contractAmount)}</td>
                      <td>
                        <div className="progress-cell">
                          <strong>{percent(metrics.physicalPercent)}</strong>
                          <div className="progress-track">
                            <span style={{ width: `${barWidth}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="num">{money(metrics.physicalValue)}</td>
                      <td className="num">
                        {money(metrics.approvedAmount)}
                        <span className="record-sub">
                          {percent(metrics.financialPercent)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`progress-variance ${varianceTone(metrics.varianceAmount)}`}
                        >
                          {money(metrics.varianceAmount)}
                        </span>
                        <span className="record-sub">
                          {percentagePoints(metrics.variancePercentagePoints)}
                        </span>
                      </td>
                      <td>
                        {latest ? dateLabel(latest.measurementDate) : "Sem medição"}
                        {item.history.length > 1 && (
                          <span className="record-sub">
                            {item.history.length} snapshots
                          </span>
                        )}
                      </td>
                      <td className="progress-actions">
                        {item.history.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setHistoryItem(item)}
                            aria-label={`Ver histórico de ${item.title}`}
                          >
                            <History size={15} /> Histórico
                          </Button>
                        )}
                        {user?.role === "admin" && !canceled && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openMeasurement(item)}
                          >
                            <Plus size={15} /> Registrar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="progress-table-footnote">
          <Clock3 size={14} /> Os percentuais gerais são ponderados pelo valor
          contratado dos itens ativos. O total considera o snapshot mais recente
          de cada item; snapshots anteriores permanecem no histórico.
        </div>
        {user?.role !== "admin" && (
          <div className="progress-readonly-note">
            <AlertCircle size={15} /> Consulta liberada; somente administradores
            podem registrar ou corrigir medições.
          </div>
        )}
      </section>

      <Dialog
        open={measurementItem !== null}
        onOpenChange={open => !open && setMeasurementItem(null)}
      >
        <DialogContent className="budget-progress-dialog">
          <DialogHeader>
            <DialogTitle>Registrar medição do item</DialogTitle>
            <DialogDescription>
              Informe os valores acumulados até a data de corte. Não lance apenas
              a variação do período.
            </DialogDescription>
          </DialogHeader>
          {measurementItem && (
            <form className="progress-form" onSubmit={submitMeasurement}>
              <div className="progress-selected-item">
                <strong>{measurementItem.title}</strong>
                <span>
                  {measurementItem.workTitle} · Contratado{" "}
                  {money(measurementItem.contractAmount)}
                </span>
              </div>
              <div className="progress-form-grid">
                <label>
                  <span>Data de corte / medição</span>
                  <input
                    type="date"
                    value={measurementDate}
                    max={todayLocal()}
                    onChange={event => changeMeasurementDate(event.target.value)}
                    required
                  />
                </label>
                <label>
                  <span>Avanço físico acumulado (%)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    step="0.01"
                    value={physicalPercent}
                    onChange={event => setPhysicalPercent(event.target.value)}
                    required
                  />
                </label>
                <label className="progress-form-wide">
                  <span>Valor acumulado aprovado pelo cliente (R$)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max={measurementItem.contractAmount}
                    step="0.01"
                    value={approvedAmount}
                    onChange={event => setApprovedAmount(event.target.value)}
                    required
                  />
                </label>
                <label className="progress-form-wide">
                  <span>Observações</span>
                  <textarea
                    value={notes}
                    onChange={event => setNotes(event.target.value)}
                    maxLength={1000}
                    rows={3}
                    placeholder="Referência do boletim, pendência ou ajuste…"
                  />
                </label>
              </div>
              <div className="progress-form-hint">
                {formSnapshotExists
                  ? "Já existe um snapshot deste item nessa data; salvar atualizará esse registro."
                  : "Uma data nova cria um snapshot acumulado e preserva os anteriores."}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMeasurementItem(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="primary-action"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? "Salvando…" : "Salvar medição"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={historyItem !== null}
        onOpenChange={open => !open && setHistoryItem(null)}
      >
        <DialogContent className="budget-progress-dialog progress-history-dialog">
          <DialogHeader>
            <DialogTitle>Histórico de avanço</DialogTitle>
            <DialogDescription>
              {historyItem?.title} · {historyItem?.workTitle}
            </DialogDescription>
          </DialogHeader>
          <div className="progress-history-list">
            {[...(historyItem?.history ?? [])]
              .reverse()
              .map(snapshot => {
                const metrics = calculateBudgetProgressMetrics({
                  contractAmount: historyItem?.contractAmount ?? 0,
                  physicalPercent: snapshot.physicalPercent,
                  approvedAmount: snapshot.approvedAmount,
                });
                return (
                  <article className="progress-history-entry" key={snapshot.id}>
                    <div className="progress-history-date">
                      <CalendarDays size={15} />
                      <strong>{dateLabel(snapshot.measurementDate)}</strong>
                    </div>
                    <div className="progress-history-metrics">
                      <span>Físico: {percent(metrics.physicalPercent)}</span>
                      <span>Valor físico: {money(metrics.physicalValue)}</span>
                      <span>
                        Aprovado: {money(metrics.approvedAmount)} (
                        {percent(metrics.financialPercent)})
                      </span>
                      <strong className={varianceTone(metrics.varianceAmount)}>
                        Desvio: {money(metrics.varianceAmount)} ·{" "}
                        {percentagePoints(metrics.variancePercentagePoints)}
                      </strong>
                    </div>
                    {snapshot.notes && <p>{snapshot.notes}</p>}
                  </article>
                );
              })}
            {(historyItem?.history.length ?? 0) === 0 && (
              <div className="empty-inline">Ainda não há snapshots registrados.</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryItem(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProgressMetric({
  label,
  value,
  caption,
  icon: Icon,
  tone = "",
}: {
  label: string;
  value: string;
  caption: string;
  icon: typeof Activity;
  tone?: string;
}) {
  return (
    <article className={`metric-card progress-metric ${tone}`}>
      <div className="metric-icon blue">
        <Icon size={18} />
      </div>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-foot">{caption}</span>
    </article>
  );
}
