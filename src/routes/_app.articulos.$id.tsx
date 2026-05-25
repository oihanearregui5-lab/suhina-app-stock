import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatEUR, formatDate } from "@/lib/format";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/articulos/$id")({ component: ArticuloDetail });

function ArticuloDetail() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["articulo", id],
    queryFn: async () => {
      const [art, compras, ventas, ajustes] = await Promise.all([
        supabase.from("articulos").select("*").eq("id", id).maybeSingle(),
        supabase.from("lineas_albaran_compra")
          .select("id, cantidad, precio_unitario_neto, total_linea, albaranes_compra!inner(fecha, proveedor, numero_albaran)")
          .eq("articulo_id", id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("lineas_albaran_venta")
          .select("id, cantidad, precio_unitario_compra, total_linea, albaranes_venta!inner(fecha, cliente, numero)")
          .eq("articulo_id", id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("ajustes_stock")
          .select("id, tipo, cantidad, motivo, stock_antes, stock_despues, created_at")
          .eq("articulo_id", id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      return { articulo: art.data, compras: compras.data ?? [], ventas: ventas.data ?? [], ajustes: ajustes.data ?? [] };
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Cargando…</div>;
  if (!data?.articulo) return <div>No encontrado</div>;
  const a = data.articulo;
  const ultimoPrecio = data.compras[0]?.precio_unitario_neto;

  return (
    <div className="space-y-6">
      <Link to="/articulos" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Volver
      </Link>

      <div>
        <div className="text-xs text-muted-foreground font-mono">{a.referencia}</div>
        <h1 className="text-2xl font-bold">{a.descripcion}</h1>
        <div className="text-sm text-muted-foreground mt-1">{a.familia} · {a.proveedor_habitual}</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="Stock actual" value={a.stock_actual} />
        <Card label="Stock mínimo" value={a.stock_minimo ?? 0} />
        <Card label="Precio referencia" value={formatEUR(a.precio_compra_referencia, 4)} />
        <Card label="Último precio compra" value={ultimoPrecio ? formatEUR(ultimoPrecio, 4) : "—"} highlight />
      </div>

      <Tabs defaultValue="compras">
        <TabsList>
          <TabsTrigger value="compras">Histórico de compras ({data.compras.length})</TabsTrigger>
          <TabsTrigger value="ventas">Histórico de usos ({data.ventas.length})</TabsTrigger>
          <TabsTrigger value="ajustes">Ajustes manuales ({data.ajustes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="compras" className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground bg-sidebar">
              <tr>
                <th className="text-left px-3 py-2">Fecha</th><th className="text-left px-3 py-2">Proveedor</th><th className="text-left px-3 py-2">Nº albarán</th>
                <th className="text-right px-3 py-2">Cant.</th><th className="text-right px-3 py-2">P. unit. neto</th><th className="text-right px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.compras.map((c: any) => (
                <tr key={c.id}>
                  <td className="px-3 py-2">{formatDate(c.albaranes_compra.fecha)}</td>
                  <td className="px-3 py-2">{c.albaranes_compra.proveedor}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c.albaranes_compra.numero_albaran ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{c.cantidad}</td>
                  <td className="px-3 py-2 text-right text-primary font-medium">{formatEUR(c.precio_unitario_neto, 4)}</td>
                  <td className="px-3 py-2 text-right">{formatEUR(c.total_linea)}</td>
                </tr>
              ))}
              {!data.compras.length && <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Sin compras registradas</td></tr>}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="ventas" className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground bg-sidebar">
              <tr>
                <th className="text-left px-3 py-2">Fecha</th><th className="text-left px-3 py-2">Nº</th><th className="text-left px-3 py-2">Cliente</th>
                <th className="text-right px-3 py-2">Cant.</th><th className="text-right px-3 py-2">P. unit.</th><th className="text-right px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.ventas.map((v: any) => (
                <tr key={v.id}>
                  <td className="px-3 py-2">{formatDate(v.albaranes_venta.fecha)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{v.albaranes_venta.numero}</td>
                  <td className="px-3 py-2">{v.albaranes_venta.cliente ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{v.cantidad}</td>
                  <td className="px-3 py-2 text-right">{formatEUR(v.precio_unitario_compra, 4)}</td>
                  <td className="px-3 py-2 text-right">{formatEUR(v.total_linea)}</td>
                </tr>
              ))}
              {!data.ventas.length && <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Sin usos registrados</td></tr>}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="ajustes" className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground bg-sidebar">
              <tr>
                <th className="text-left px-3 py-2">Fecha</th>
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-right px-3 py-2">Cant.</th>
                <th className="text-right px-3 py-2">Antes</th>
                <th className="text-right px-3 py-2">Después</th>
                <th className="text-left px-3 py-2">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.ajustes.map((aj: any) => {
                const labels: Record<string, { txt: string; cls: string }> = {
                  salida:     { txt: "Salida",     cls: "bg-orange-500/15 text-orange-200 border-orange-500/30" },
                  entrada:    { txt: "Entrada",    cls: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30" },
                  correccion: { txt: "Corrección", cls: "bg-primary/15 text-primary border-primary/30" },
                };
                const l = labels[aj.tipo] ?? { txt: aj.tipo, cls: "" };
                return (
                  <tr key={aj.id}>
                    <td className="px-3 py-2">{formatDate(aj.created_at)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${l.cls}`}>{l.txt}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{aj.cantidad}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{aj.stock_antes}</td>
                    <td className="px-3 py-2 text-right font-medium">{aj.stock_despues}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{aj.motivo ?? "—"}</td>
                  </tr>
                );
              })}
              {!data.ajustes.length && <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Sin ajustes manuales</td></tr>}
            </tbody>
          </table>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Card({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
