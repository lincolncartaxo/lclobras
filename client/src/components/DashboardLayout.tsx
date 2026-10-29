import { useAuth } from "@/_core/hooks/useAuth";
import { MODULES, NAV_GROUPS } from "@/modules/definitions";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Building2,
  ChevronRight,
  Menu,
  PanelLeftClose,
  LogOut,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";

const headings: Record<string, string> = {
  "/": "Visão geral",
  "/usuarios": "Usuários e perfis",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user, logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();
  const page =
    headings[location] ??
    MODULES.find(module => location === `/m/${module.id}`)?.title ??
    "LclObras";

  if (loading) {
    return (
      <div className="auth-loading">
        <span className="loader" />
        <p>Conectando ao LclObras…</p>
      </div>
    );
  }
  if (!user) {
    return (
      <main className="login-screen">
        <section className="login-card">
          <BrandMark />
          <span className="eyebrow">GESTÃO INTEGRADA DE OBRAS</span>
          <h1>Seu canteiro, contrato e caixa em uma só visão.</h1>
          <p>Acesse o painel operacional do LclObras com sua conta Manus.</p>
          <Button
            className="login-button"
            size="lg"
            onClick={() => startLogin()}
          >
            Entrar com Manus <ChevronRight className="size-4" />
          </Button>
          <span className="login-footnote">
            Acesso protegido · Registros salvos no banco da empresa
          </span>
        </section>
        <div className="login-side-art" aria-hidden="true">
          <div className="blueprint-grid" />
          <div className="survey-line line-one" />
          <div className="survey-line line-two" />
          <div className="survey-stamp">
            LC
            <br />
            OBRAS
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <Link
          href="/"
          className="brand-lockup"
          onClick={() => setMobileOpen(false)}
        >
          <BrandMark />
          <span>
            <strong>LclObras</strong>
            <small>CONTROLE DE OBRAS</small>
          </span>
        </Link>
        <div className="sidebar-context">
          <span className="context-dot" /> Operação integrada
        </div>
        <nav className="nav-list" aria-label="Navegação principal">
          <Link
            href="/"
            className={`nav-link ${location === "/" ? "active" : ""}`}
            onClick={() => setMobileOpen(false)}
          >
            <Building2 size={17} />
            <span>Visão geral</span>
          </Link>
          {NAV_GROUPS.map(group => (
            <div className="nav-group" key={group}>
              <div className="nav-group-title">{group}</div>
              {MODULES.filter(module => module.group === group).map(module => {
                const Icon = module.icon;
                const href = `/m/${module.id}`;
                return (
                  <Link
                    key={module.id}
                    href={href}
                    className={`nav-link ${location === href ? "active" : ""}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon size={16} />
                    <span>{module.shortTitle}</span>
                  </Link>
                );
              })}
            </div>
          ))}
          {user.role === "admin" && (
            <div className="nav-group">
              <div className="nav-group-title">Administração</div>
              <Link
                href="/usuarios"
                className={`nav-link ${location === "/usuarios" ? "active" : ""}`}
                onClick={() => setMobileOpen(false)}
              >
                <UserRound size={16} />
                <span>Usuários e perfis</span>
              </Link>
            </div>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-avatar">
            {(user.name || user.email || "U").slice(0, 1).toUpperCase()}
          </div>
          <div className="profile-copy">
            <strong>{user.name || "Usuário"}</strong>
            <small>
              {user.operationalRole === "almoxarife"
                ? "Almoxarife"
                : user.operationalRole === "encarregado"
                  ? "Encarregado"
                  : user.role === "admin"
                    ? "Administrador"
                    : "Administrativo"}
            </small>
          </div>
          <button
            className="icon-button logout-icon"
            aria-label="Sair"
            title="Sair"
            onClick={() => void logout()}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      {isMobile && mobileOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <main className="main-shell">
        <header className="topbar">
          {isMobile && (
            <button
              className="icon-button mobile-menu-toggle"
              onClick={() => setMobileOpen(value => !value)}
              aria-label="Abrir navegação"
            >
              <Menu size={19} />
            </button>
          )}
          <div className="breadcrumb">
            <span>Operações</span>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            <span className="live-indicator">
              <span /> Dados sincronizados
            </span>
            <div className="top-user">
              <span className="top-user-avatar">
                {(user.name || "U").slice(0, 1).toUpperCase()}
              </span>
              <span>{user.name?.split(" ")[0] || "Minha conta"}</span>
              <PanelLeftClose size={14} className="top-user-caret" />
            </div>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none">
        <path d="M8 30V10h8v12h16v8H8Z" fill="currentColor" />
        <path
          d="M8 10h24M16 10v12"
          stroke="#fff"
          strokeWidth="1.6"
          opacity=".82"
        />
        <path
          d="M21 26h7"
          stroke="#f2a23a"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
