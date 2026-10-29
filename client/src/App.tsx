import { Toaster } from "@/components/ui/sonner";
import DashboardLayout from "@/components/DashboardLayout";
import Home from "@/pages/Home";
import AdminDashboardPage from "@/pages/AdminDashboardPage";
import ModulePage from "@/pages/ModulePage";
import UsersPage from "@/pages/UsersPage";
import NotFound from "@/pages/NotFound";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";

function AppRoutes() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/administracao" component={AdminDashboardPage} />
        <Route path="/usuarios" component={UsersPage} />
        <Route path="/m/:moduleId" component={ModulePage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <Toaster />
        <AppRoutes />
      </TooltipProvider>
    </ErrorBoundary>
  );
}
