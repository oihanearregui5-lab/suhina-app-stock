import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { Sidebar, MobileLogo } from "@/components/Sidebar";
import { useAuth } from "@/lib/auth-context";
import { Box } from "lucide-react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Box className="h-5 w-5 animate-pulse text-primary" />
          Cargando…
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileLogo />
        <main className="flex-1 p-4 md:p-8 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
