import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, AlertTriangle, FileDown, FileUp, Wallet } from "lucide-react";
import { formatEUR, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_app/")({ component: Dashboard });

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: React.ReactNode; icon: any; tone?: "alert" }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className={`h-4 w-4 ${tone === "alert" ? "text-destructive" : "text-primary"}`} />
      </div>
      <div className={`mt-2 text-2xl font-bold ${tone === "alert" ? "text-destructive" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      const isoInicio = inicioMes.toISOString().slice(0, 10);

      const [arts, compMes, ventMes, valor, ultCompras, ultVentas, bajoLista] = await Promise.all([
        supabase.from("articulos").select("id", { count: "exact", head: true }).eq("activo", true),
        supabase.from("albaranes_compra").select("id", { count: "exact", head: true }).gte("fecha", isoInicio),
        supabase.from("albaranes_venta").select("id", { count: "exact", head: true }).gte("fecha", isoInicio),
        supabase.from("articulos").select("stock_actual, precio_compra_referencia").eq("activo", true),
        supabase.from("albaranes_compra").select("id, fecha, proveedor, numero_albaran, total").order("fecha", { ascending: false }).limit(5),
        supabase.from("albaranes_venta").select("id, fecha, cliente, numero, total_estimado").order("fecha", { ascending: false }).limit(5),
        supabase.from("articulos").select("id, referencia, descripcion, stock_actual, stock_minimo").gt("stock_minimo", 0).order("stock_actual", { ascending: true }).limit(200),
      ]);

      const filtBajo = (bajoLista.data ?? []).filter((a) => (a.stock_actual ?? 0) <= (a.stock_minimo ?? 0));

      const valorTotal = (valor.data ?? []).reduce((sum: number, a: any) => sum + Number(a.stock_actual || 0) * Number(a.precio_compra_referencia || 0), 0);

      return {
        totalArticulos: arts.count ?? 0,
        bajoStock: filtBajo.length,
        comprasMes: compMes.count ?? 0,
        ventasMes: ventMes.count ?? 0,
        valorTotal,
        ultCompras: ultCompras.data ?? [],
        ultVentas: ultVentas.data ?? [],
        stockBajo: filtBajo.slice(0, 10),
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Resumen general del sistema.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Kpi label="Artículos activos" value={data?.totalArticulos ?? "—"} icon={Package} />
        <Kpi label="Bajo stock mínimo" value={data?.bajoStock ?? "—"} icon={AlertTriangle} tone={(data?.bajoStock ?? 0) > 0 ? "alert" : undefined} />
        <Kpi label="Compras del mes" value={data?.comprasMes ?? "—"} icon={FileDown} />
        <Kpi label="Ventas del mes" value={data?.ventasMes ?? "—"} icon={FileUp} />
        <Kpi label="Valor inventario" value={data ? formatEUR(data.valorTotal) : "—"} icon={Wallet} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-3">Últimos albaranes de compra</h2>
          <div className="divide-y divide-border">
            {(data?.ultCompras ?? []).map((a: any) => (
              <Link key={a.id} to="/albaranes-compra/$id" params={{ id: a.id }} className="flex justify-between py-2 text-sm hover:bg-accent/30 px-2 -mx-2 rounded">
                <div>
                  <div className="font-medium">{a.proveedor}</div>
                  <div className="text-xs text-muted-foreground">{a.numero_albaran ?? "—"} · {formatDate(a.fecha)}</div>
                </div>
                <div className="text-primary font-medium">{formatEUR(a.total)}</div>
              </Link>
            ))}
            {(!data?.ultCompras?.length) && <div className="text-sm text-muted-foreground py-4">Sin albaranes aún.</div>}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-3">Últimos albaranes de venta</h2>
          <div className="divide-y divide-border">
            {(data?.ultVentas ?? []).map((a: any) => (
              <Link key={a.id} to="/albaranes-venta/$id" params={{ id: a.id }} className="flex justify-between py-2 text-sm hover:bg-accent/30 px-2 -mx-2 rounded">
                <div>
                  <div className="font-medium">{a.numero}</div>
                  <div className="text-xs text-muted-foreground">{a.cliente ?? "—"} · {formatDate(a.fecha)}</div>
                </div>
                <div className="text-primary font-medium">{formatEUR(a.total_estimado)}</div>
              </Link>
            ))}
            {(!data?.ultVentas?.length) && <div className="text-sm text-muted-foreground py-4">Sin albaranes aún.</div>}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" /> Artículos con stock bajo
        </h2>
        {!data?.stockBajo?.length ? (
          <div className="text-sm text-muted-foreground py-2">Todo en orden ✅</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr><th className="text-left py-2">Referencia</th><th className="text-left py-2">Descripción</th><th className="text-right py-2">Stock</th><th className="text-right py-2">Mínimo</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.stockBajo.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 font-mono text-xs">{a.referencia}</td>
                    <td className="py-2">{a.descripcion}</td>
                    <td className="py-2 text-right text-destructive font-medium">{a.stock_actual}</td>
                    <td className="py-2 text-right text-muted-foreground">{a.stock_minimo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
