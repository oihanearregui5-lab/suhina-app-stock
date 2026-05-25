import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Package, FileDown, FileUp, Settings, LogOut, Box } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import logo from "@/assets/suhina-logo.png";
import { cn } from "@/lib/utils";

const nav: ReadonlyArray<{ to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }> = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/articulos", label: "Artículos", icon: Package },
  { to: "/albaranes-compra", label: "Albaranes de compra", icon: FileDown },
  { to: "/albaranes-venta", label: "Albaranes de venta", icon: FileUp },
  { to: "/configuracion/importar", label: "Configuración", icon: Settings },
];

export function Sidebar() {
  const { user, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="hidden md:flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border sticky top-0">
      <div className="px-5 py-6 flex items-center gap-3 border-b border-sidebar-border">
        <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
          <Box className="h-6 w-6" />
        </div>
        <div>
          <div className="font-bold tracking-wide text-sidebar-foreground">SUHINA</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Gestión Empresarial</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-sidebar-border space-y-2">
        <div className="px-3 text-xs text-muted-foreground truncate">{user?.email}</div>
        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

export function MobileLogo() {
  return (
    <div className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-border bg-sidebar">
      <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
        <Box className="h-5 w-5" />
      </div>
      <div className="font-bold text-sidebar-foreground">SUHINA</div>
    </div>
  );
}
