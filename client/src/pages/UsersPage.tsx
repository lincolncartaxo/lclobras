import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";

const roleLabels: Record<string, string> = {
  administrativo: "Administrativo",
  almoxarife: "Almoxarife",
  encarregado: "Encarregado",
};

export default function UsersPage() {
  const { user } = useAuth();
  const people = trpc.people.list.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const utils = trpc.useUtils();
  const update = trpc.people.setOperationalRole.useMutation({
    onSuccess: async () => {
      await utils.people.list.invalidate();
      toast.success("Perfil operacional atualizado.");
    },
    onError: error => toast.error(error.message),
  });

  return (
    <div className="module-page">
      <div className="page-heading">
        <div className="module-title-lockup">
          <span className="module-hero-icon">
            <Users size={21} />
          </span>
          <div>
            <span className="eyebrow">ADMINISTRAÇÃO</span>
            <h1>Usuários e perfis</h1>
            <p>
              Atribua o perfil operacional que controla os lançamentos do
              almoxarifado.
            </p>
          </div>
        </div>
      </div>
      {user?.role !== "admin" ? (
        <section className="panel access-denied">
          <ShieldCheck size={27} />
          <h2>Acesso restrito</h2>
          <p>
            Apenas administradores podem consultar ou alterar os perfis de
            usuários.
          </p>
        </section>
      ) : (
        <>
          <div className="permission-note">
            <AlertTriangle size={15} /> Pedidos e recebimentos são restritos ao
            almoxarife. Retiradas são restritas ao encarregado. As permissões
            também são verificadas no servidor.
          </div>
          <section className="table-card">
            <div className="data-table-wrap">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>E-mail</th>
                    <th>Perfil da conta</th>
                    <th>Perfil operacional</th>
                  </tr>
                </thead>
                <tbody>
                  {people.isLoading ? (
                    <tr>
                      <td colSpan={4}>Carregando usuários…</td>
                    </tr>
                  ) : people.error ? (
                    <tr>
                      <td colSpan={4}>
                        Não foi possível carregar: {people.error.message}
                      </td>
                    </tr>
                  ) : people.data?.length ? (
                    people.data.map(person => (
                      <tr key={person.id}>
                        <td className="record-primary">
                          {person.name || "Usuário"}
                        </td>
                        <td>{person.email || "—"}</td>
                        <td>
                          <span className="role-chip">
                            {person.role === "admin"
                              ? "Administrador"
                              : "Usuário"}
                          </span>
                        </td>
                        <td>
                          <select
                            value={person.operationalRole}
                            disabled={update.isPending}
                            aria-label={`Perfil operacional de ${person.name || person.email}`}
                            onChange={event =>
                              update.mutate({
                                id: person.id,
                                operationalRole: event.target.value as
                                  | "administrativo"
                                  | "almoxarife"
                                  | "encarregado",
                              })
                            }
                          >
                            {Object.entries(roleLabels).map(
                              ([value, label]) => (
                                <option value={value} key={value}>
                                  {label}
                                </option>
                              )
                            )}
                          </select>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4}>
                        Nenhum usuário cadastrado. Usuários aparecerão após
                        autenticação no LclObras.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <section className="role-explainer">
            <div>
              <span className="role-dot stock" />
              <strong>Almoxarife</strong>
              <p>
                Pode criar e editar pedidos e entradas/recebimentos de
                materiais.
              </p>
            </div>
            <div>
              <span className="role-dot field" />
              <strong>Encarregado</strong>
              <p>Pode criar e editar retiradas de materiais para as equipes.</p>
            </div>
            <div>
              <span className="role-dot admin" />
              <strong>Administrativo</strong>
              <p>
                Opera os demais módulos. Para registrar movimentos de estoque,
                precisa também receber o perfil de almoxarife ou encarregado;
                administradores da plataforma mantêm acesso de supervisão.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
