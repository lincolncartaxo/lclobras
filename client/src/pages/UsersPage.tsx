import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";

const operationalRoleLabels: Record<string, string> = {
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
  const updateOperationalRole = trpc.people.setOperationalRole.useMutation({
    onSuccess: async () => {
      await utils.people.list.invalidate();
      toast.success("Perfil operacional atualizado.");
    },
    onError: error => toast.error(error.message),
  });
  const updateAccountRole = trpc.people.setAccountRole.useMutation({
    onSuccess: async result => {
      await utils.people.list.invalidate();
      toast.success(
        result.role === "admin"
          ? "Usuário promovido a superusuário admin."
          : "Acesso administrativo removido do usuário."
      );
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
            <h1>Usuários e permissões</h1>
            <p>
              Gerencie o acesso total do app e os papéis operacionais de cada
              conta autenticada.
            </p>
          </div>
        </div>
      </div>
      {user?.role !== "admin" ? (
        <section className="panel access-denied">
          <ShieldCheck size={27} />
          <h2>Acesso restrito</h2>
          <p>Apenas superusuários admin podem consultar ou alterar perfis.</p>
        </section>
      ) : (
        <>
          <div className="permission-note">
            <AlertTriangle size={15} /> O papel <strong>Admin</strong> permite
            todas as operações e a gestão de usuários. Contas são criadas pelo
            login Manus; esta tela altera papéis de contas já cadastradas. Para
            evitar lockout, não é possível rebaixar a própria conta nem o último
            administrador. A conta proprietária do projeto permanece como admin.
          </div>
          <section className="table-card">
            <div className="data-table-wrap">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>E-mail</th>
                    <th>Papel da aplicação</th>
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
                          {person.id === user.id && (
                            <span className="record-sub">Sua conta</span>
                          )}
                        </td>
                        <td>{person.email || "—"}</td>
                        <td>
                          <select
                            className={
                              person.role === "admin" ? "account-role-admin" : ""
                            }
                            value={person.role}
                            disabled={
                              person.id === user.id ||
                              person.isOwner ||
                              updateAccountRole.isPending
                            }
                            aria-label={`Papel da aplicação de ${person.name || person.email}`}
                            title={
                              person.isOwner
                                ? "A conta proprietária do projeto deve permanecer como superusuário admin."
                                : person.id === user.id
                                ? "Outro administrador deve alterar seu papel."
                                : "Alterar papel de acesso ao aplicativo"
                            }
                            onChange={event =>
                              updateAccountRole.mutate({
                                id: person.id,
                                role: event.target.value as "user" | "admin",
                              })
                            }
                          >
                            <option value="user">Usuário</option>
                            <option value="admin">Superusuário admin</option>
                          </select>
                          {person.isOwner && (
                            <span className="record-sub">
                              Conta proprietária protegida
                            </span>
                          )}
                        </td>
                        <td>
                          <select
                            value={person.operationalRole}
                            disabled={updateOperationalRole.isPending}
                            aria-label={`Perfil operacional de ${person.name || person.email}`}
                            onChange={event =>
                              updateOperationalRole.mutate({
                                id: person.id,
                                operationalRole: event.target.value as
                                  | "administrativo"
                                  | "almoxarife"
                                  | "encarregado",
                              })
                            }
                          >
                            {Object.entries(operationalRoleLabels).map(
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
              <span className="role-dot admin" />
              <strong>Admin — superusuário</strong>
              <p>
                Acesso a todos os módulos e operações, incluindo pedidos,
                recebimentos, retiradas e administração de usuários.
              </p>
            </div>
            <div>
              <span className="role-dot stock" />
              <strong>Almoxarife</strong>
              <p>Pode criar e editar pedidos e entradas/recebimentos.</p>
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
                Opera os demais módulos, sem substituir os papéis de campo nem
                o superusuário admin.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
