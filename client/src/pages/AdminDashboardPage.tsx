import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { MODULES, NAV_GROUPS } from "@/modules/definitions";
import { trpc } from "@/lib/trpc";
import {
  ArrowUpRight,
  Database,
  FileArchive,
  HandCoins,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link } from "wouter";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const overview = trpc.admin.overview.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const data = overview.data;

  if (user?.role !== "admin") {
    return (
      <div className="module-page">
        <section className="panel access-denied">
          <ShieldCheck size={27} />
          <h2>Acesso restrito</h2>
          <p>Este painel está disponível somente para superusuários admin.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">CONTROLE ADMINISTRATIVO</span>
          <h1>Administração do LclObras</h1>
          <p>
            Visão do banco operacional e acesso central ao CRUD dos módulos e
            aos perfis de usuários.
          </p>
        </div>
        <Link href="/usuarios">
          <Button className="primary-action">
            <Users size={16} /> Usuários e permissões
          </Button>
        </Link>
      </div>

      <div className="admin-metrics">
        <Metric
          icon={Database}
          label="Registros operacionais"
          value={data?.totalRecords ?? 0}
          tone="blue"
        />
        <Metric
          icon={Users}
          label="Contas cadastradas"
          value={data?.userCount ?? 0}
          tone="green"
        />
        <Metric
          icon={ShieldCheck}
          label="Superusuários admin"
          value={data?.adminCount ?? 0}
          tone="amber"
        />
        <Metric
          icon={FileArchive}
          label="Documentos anexados"
          value={data?.attachmentCount ?? 0}
          tone="blue"
        />
        <Metric
          icon={HandCoins}
          label="Baixas financeiras"
          value={data?.settlementCount ?? 0}
          tone="green"
        />
      </div>

      <section className="admin-governance panel">
        <div className="admin-governance-icon">
          <ShieldCheck size={18} />
        </div>
        <div>
          <strong>CRUD com validações de negócio</strong>
          <p>
            Cada atalho abre o módulo operacional correspondente. As regras de
            obra, centro de custo, estoque e contratos continuam valendo; baixas
            financeiras e históricos protegidos não podem ser apagados por um
            CRUD genérico.
          </p>
        </div>
        <Link href="/usuarios" className="text-link">
          Gerenciar acessos <ArrowUpRight size={15} />
        </Link>
      </section>

      {overview.isError && (
        <div className="permission-note" role="alert">
          Não foi possível carregar o resumo: {overview.error.message}
        </div>
      )}

      {NAV_GROUPS.map(group => {
        const modules = MODULES.filter(module => module.group === group);
        if (!modules.length) return null;
        return (
          <section className="admin-module-section" key={group}>
            <div className="admin-section-heading">
              <div>
                <span className="eyebrow">DADOS POR ÁREA</span>
                <h2>{group}</h2>
              </div>
              <span className="mini-count">{modules.length} módulos</span>
            </div>
            <div className="admin-module-grid">
              {modules.map(module => {
                const Icon = module.icon;
                const count = data?.moduleCounts[module.id] ?? 0;
                return (
                  <Link
                    key={module.id}
                    href={`/m/${module.id}`}
                    className="admin-module-card"
                  >
                    <span className="admin-module-icon">
                      <Icon size={18} />
                    </span>
                    <span className="admin-module-copy">
                      <strong>{module.title}</strong>
                      <small>{module.description}</small>
                    </span>
                    <span className="admin-module-count">
                      {module.report ? "Relatório" : `${count} registros`}
                    </span>
                    <ArrowUpRight size={15} className="admin-module-arrow" />
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="panel admin-account-panel">
        <div>
          <span className="eyebrow">GOVERNANÇA DE ACESSO</span>
          <h2>Contas e perfis</h2>
          <p>
            Ajuste separadamente o papel de superusuário e o perfil operacional
            dos usuários que já entraram com autenticação Manus.
          </p>
        </div>
        <Link href="/usuarios">
          <Button variant="outline">Abrir usuários e perfis</Button>
        </Link>
      </section>

      {overview.isLoading && (
        <div className="empty-inline">Carregando totais do banco…</div>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Database;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}>
        <Icon size={18} />
      </div>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value.toLocaleString("pt-BR")}</strong>
      <span className="metric-foot">Banco gerenciado do LclObras</span>
    </article>
  );
}
