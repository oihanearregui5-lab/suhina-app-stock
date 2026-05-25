import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { formatEUR, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_app/albaranes-venta/")({ component: AlbaranesVentaList });

function AlbaranesVentaList() {
  const { data, isLoading } = useQuery({
    queryKey: ["albaranes-venta"],
    queryFn: async () => {
      const { data } = await supabase
        .from("albaranes_venta")
        .select("*, lineas_albaran_venta(count)")
        .order("fecha", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Albaranes de venta</h1>
          <p className="text-sm text-muted-foreground">Salidas internas de material</p>
        </div>
        <Link to="/albaranes-venta/nuevo">
          <Button><Plus className="h-4 w-4 mr-1" />Nuevo albarán</Button>
        </Link>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-sidebar">
            <tr>
              <th className="text-left px-3 py-2">Nº</th><th className="text-left px-3 py-2">Fecha</th><th className="text-left px-3 py-2">Cliente</th>
              <th className="text-left px-3 py-2">Obra/Ref.</th><th className="text-right px-3 py-2">Líneas</th><th className="text-right px-3 py-2">Total est.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Cargando…</td></tr>}
            {(data ?? []).map((a: any) => (
              <tr key={a.id} className="hover:bg-accent/30">
                <td className="px-3 py-2 font-mono text-xs">
                  <Link to="/albaranes-venta/$id" params={{ id: a.id }} className="text-primary hover:underline">{a.numero}</Link>
                </td>
                <td className="px-3 py-2">{formatDate(a.fecha)}</td>
                <td className="px-3 py-2">{a.cliente ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{a.obra_o_referencia ?? "—"}</td>
                <td className="px-3 py-2 text-right">{a.lineas_albaran_venta?.[0]?.count ?? 0}</td>
                <td className="px-3 py-2 text-right font-medium">{formatEUR(a.total_estimado)}</td>
              </tr>
            ))}
            {!isLoading && !data?.length && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No hay albaranes</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
