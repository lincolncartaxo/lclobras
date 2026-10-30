import { trpc } from "@/lib/trpc";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FileSpreadsheet,
  HardHat,
  Plus,
  TrendingUp,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
const dateLabel = (value: Date | string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(value)
  );
const moduleNames: Record<string, string> = {
  obras: "Obra",
  clientes: "Cliente",
  orcamento: "Planilha contratada",
  "centros-custo": "Centro de custo",
  pedidos: "Pedido",
  compras: "Compra",
  "almoxarifado-entrada": "Recebimento",
  "almoxarifado-retirada": "Retirada",
  fornecedores: "Fornecedor",
  colaboradores: "Colaborador",
  cotacoes: "Cotação",
  "contratos-fornecedor": "Contrato de fornecedor",
  medicoes: "Medição",
  folha: "Folha",
  consumo: "Consumo",
  "contas-receber": "Conta a receber",
  "contas-pagar": "Conta a pagar",
  cronograma: "Atividade",
};

export default function Home() {
  const summary = trpc.dashboard.summary.useQuery();
  const data = summary.data;
  const budgetUse = data?.budgeted ? (data.costs / data.budgeted) * 100 : 0;
  const contractUse = data?.contracted
    ? (data.costs / data.contracted) * 100
    : 0;

  return (
    <div className="dashboard-page">
      <div className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">PAINEL DE CONTROLE</span>
          <h1>Bom dia. Vamos à obra.</h1>
          <p>Resumo operacional, financeiro e de prazos da sua carteira.</p>
        </div>
        <Link href="/m/obras">
          <Button className="primary-action">
            <Plus size={16} /> Nova obra
          </Button>
        </Link>
      </div>
      {!summary.isLoading && data?.workCount === 0 && (
        <div className="onboarding-banner">
          <div className="onboarding-icon">
            <Building2 size={19} />
          </div>
          <div>
            <strong>Comece cadastrando sua primeira obra</strong>
            <p>
              Cadastre o cliente, o contrato e os centros de custo para ativar
              os indicadores.
            </p>
          </div>
          <Link href="/m/obras" className="onboarding-link">
            Cadastrar obra <ChevronRight size={15} />
          </Link>
        </div>
      )}

      <div className="metric-grid">
        <Metric
          title="Obras cadastradas"
          value={String(data?.workCount ?? 0)}
          foot="Contratos cadastrados"
          icon={Building2}
          tone="blue"
        />
        <Metric
          title="Valor contratado"
          value={money(data?.contracted)}
          foot="Soma dos contratos de clientes"
          icon={CircleDollarSign}
          tone="amber"
        />
        <Metric
          title="Planilha contratada"
          value={money(data?.budgeted)}
          foot="Valores previstos por atividade"
          icon={FileSpreadsheet}
          tone="blue"
        />
        <Metric
          title="Custos totais"
          value={money(data?.costs)}
          foot="Contas a pagar, pagas e em aberto"
          icon={TrendingUp}
          tone="red"
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel financial-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">DESEMPENHO FINANCEIRO</span>
              <h2>Planilha e contrato x custos</h2>
            </div>
            <Link href="/m/fluxo-caixa" className="text-link">
              Abrir fluxo de caixa <ChevronRight size={15} />
            </Link>
          </div>
          <div className="financial-highlight">
            <div>
              <span>Valor contratado</span>
              <strong>{money(data?.contracted)}</strong>
            </div>
            <div className="financial-versus">−</div>
            <div>
              <span>Custos totais registrados</span>
              <strong>{money(data?.costs)}</strong>
            </div>
          </div>
          <div className="comparison-labels">
            <span>Custos sobre o contrato do cliente</span>
            <strong className={contractUse > 100 ? "negative-balance" : ""}>
              {contractUse.toFixed(1)}%
            </strong>
          </div>
          <div className="progress-track">
            <span
              style={{ width: `${Math.max(0, Math.min(100, contractUse))}%` }}
            />
          </div>
          <div className="comparison-labels">
            <span>Orçamento previsto consumido</span>
            <strong className={budgetUse > 100 ? "negative-balance" : ""}>
              {budgetUse.toFixed(1)}%
            </strong>
          </div>
          <div className="progress-track budget-progress">
            <span
              style={{ width: `${Math.max(0, Math.min(100, budgetUse))}%` }}
            />
          </div>
          <div className="financial-footnotes">
            <div>
              <ArrowDownLeft size={16} />
              <span>Contas a receber · em aberto</span>
              <strong>{money(data?.receivables)}</strong>
            </div>
            <div>
              <ArrowUpRight size={16} />
              <span>Contas a pagar · em aberto</span>
              <strong>{money(data?.payables)}</strong>
            </div>
          </div>
        </section>
        <section className="panel attention-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">ACOMPANHAMENTO</span>
              <h2>Carteira em foco</h2>
            </div>
            <span className="mini-count">{data?.workCount ?? 0} obras</span>
          </div>
          {data?.workFinance.length ? (
            <div className="work-list">
              {data.workFinance.slice(0, 4).map(work => {
                const base = work.budgeted || work.contracted;
                const used = base ? (work.costs / base) * 100 : 0;
                return (
                  <div className="work-row" key={work.id}>
                    <div className="work-row-head">
                      <div>
                        <strong>{work.title}</strong>
                        <small>
                          {work.code || "Sem código"} · {money(work.budgeted)}{" "}
                          previstos
                        </small>
                      </div>
                      <strong>{money(work.contracted)}</strong>
                    </div>
                    <div className="work-progress">
                      <span
                        style={{
                          width: `${Math.max(0, Math.min(100, used))}%`,
                        }}
                      />
                    </div>
                    <div className="work-row-foot">
                      <span className={used > 100 ? "negative-balance" : ""}>
                        {used.toFixed(1)}%{" "}
                        {work.budgeted ? "do orçamento" : "do contrato"}{" "}
                        consumido
                      </span>
                      <span>{money(work.costs)} em custos</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-card">
              <div className="empty-icon">
                <HardHat size={20} />
              </div>
              <strong>Sem obras cadastradas</strong>
              <span>
                Os valores contratados, orçamentos e custos aparecerão aqui.
              </span>
            </div>
          )}
        </section>
      </div>

      <section className="panel work-cash-summary">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">CAIXA POR OBRA</span>
            <h2>Recebimentos, despesas e resultado</h2>
          </div>
          <Link href="/m/fluxo-caixa" className="text-link">
            Detalhar fluxo <ChevronRight size={15} />
          </Link>
        </div>
        {data?.workFinance.length ? (
          <div className="data-table-wrap">
            <table className="data-table work-cash-table">
              <thead>
                <tr>
                  <th>Obra</th>
                  <th className="num">Recebido</th>
                  <th className="num">Despesas pagas</th>
                  <th className="num">Pago pela Central</th>
                  <th className="num">Caixa líquido</th>
                  <th className="num">Resultado da obra</th>
                </tr>
              </thead>
              <tbody>
                {data.workFinance.map(work => {
                  const finished = ["concluido", "encerrado"].includes(
                    work.status.toLocaleLowerCase("pt-BR")
                  );
                  return (
                    <tr key={work.id}>
                      <td className="record-primary">
                        {work.title}
                        <span className="record-sub">
                          {work.code || "Sem código"}
                        </span>
                      </td>
                      <td className="num">{money(work.received)}</td>
                      <td className="num">{money(work.settledCosts)}</td>
                      <td className="num">{money(work.centralPaidCosts)}</td>
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
                          {finished ? "Lucro final" : "Resultado projetado"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-inline">
            <Building2 size={17} /> Cadastre uma obra para acompanhar o caixa e
            o resultado individual.
          </div>
        )}
        <p className="table-footer-note">
          Caixa líquido = recebimentos baixados − despesas da obra pagas,
          incluindo as honradas pela Administração Central. Resultado = contrato
          − custos registrados da obra; despesas gerais do escritório não são
          rateadas.
        </p>
      </section>

      <div className="dashboard-grid lower-grid">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">ATIVIDADE RECENTE</span>
              <h2>Últimos registros</h2>
            </div>
            <span className="mini-count">Banco em tempo real</span>
          </div>
          {data?.recentRecords.length ? (
            <div className="recent-list">
              {data.recentRecords.map(record => (
                <div
                  className="recent-row"
                  key={`${record.module}-${record.id}`}
                >
                  <span className="recent-dot" />
                  <div className="recent-copy">
                    <strong>{record.title}</strong>
                    <span>
                      {moduleNames[record.module] || record.module}
                      {record.workTitle ? ` · ${record.workTitle}` : ""}
                    </span>
                  </div>
                  <div className="recent-meta">
                    <strong>
                      {record.amount ? money(record.amount) : "—"}
                    </strong>
                    <span>{dateLabel(record.updatedAt)}</span>
                  </div>
                  <span
                    className={`status-pill status-${record.status.replace(/[^a-z]/g, "")}`}
                  >
                    {record.status.replaceAll("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-inline">
              <CalendarClock size={17} /> Seus lançamentos aparecerão conforme a
              operação for sendo registrada.
            </div>
          )}
        </section>
        <section className="panel quick-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">ACESSO RÁPIDO</span>
              <h2>Registrar operação</h2>
            </div>
          </div>
          <div className="quick-links">
            <QuickLink
              href="/m/pedidos"
              icon={ClipboardCheck}
              title="Criar pedido"
              text="Solicitar material à equipe de compras"
            />
            <QuickLink
              href="/m/almoxarifado-entrada"
              icon={ArrowDownLeft}
              title="Registrar recebimento"
              text="Conferir e dar entrada no estoque"
            />
            <QuickLink
              href="/m/almoxarifado-retirada"
              icon={ArrowUpRight}
              title="Registrar retirada"
              text="Baixar material para uma frente"
            />
            <QuickLink
              href="/m/contas-pagar"
              icon={CalendarClock}
              title="Lançar custo"
              text="Adicionar compromisso financeiro"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({
  title,
  value,
  foot,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  foot: string;
  icon: typeof Building2;
  tone: string;
}) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}>
        <Icon size={18} />
      </div>
      <span className="metric-label">{title}</span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-foot">{foot}</span>
    </article>
  );
}
function QuickLink({
  href,
  icon: Icon,
  title,
  text,
}: {
  href: string;
  icon: typeof Building2;
  title: string;
  text: string;
}) {
  return (
    <Link href={href} className="quick-link">
      <span className="quick-icon">
        <Icon size={17} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      <ChevronRight size={16} />
    </Link>
  );
}
