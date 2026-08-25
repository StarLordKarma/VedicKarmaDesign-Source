import { Toaster } from "@/components/ui/sonner";
import React, { Suspense, lazy } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Privacy from "@/pages/Privacy";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
const Admin = lazy(() => import("./pages/Admin"));
const ReportStudio = lazy(() => import("@/pages/ReportStudio"));
const ClientStatus = lazy(() => import("@/pages/ClientStatus"));
const AdminMetrics = lazy(() => import("@/pages/AdminMetrics"));
const AdminStatusLinks = lazy(() => import("@/pages/AdminStatusLinks"));

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/privacy"} component={Privacy} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/admin/report-studio"} component={ReportStudio} />
      <Route path={"/status/:token"} component={ClientStatus} />
      <Route path={"/admin/metrics"} component={AdminMetrics} />
      <Route path={"/admin/status-links"} component={AdminStatusLinks} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        switchable
      >
        <TooltipProvider>
          <Toaster />
          <Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#f8f5f0] text-sm text-[#635a52]">Loading workspace…</div>}>
            <Router />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
