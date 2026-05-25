import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatEUR, formatDate } from "@/lib/format";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/albaranes-compra/$id")({ component: DetalleCompra });

function DetalleCompra() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["albcompra", id],
    queryFn: async () => {
      const [cab, lin] = await Promise.all([
        supabase.from("albaranes_compra").select("*").eq("id", id).maybeSingle(),
        supabase.from("lineas_albaran_compra").select("*").eq("albaran_id", id).order("created_at"),
      ]);
      return { cab: cab.data, lineas: lin.data ?? [] };
    },
  });
  if (isLoading) return <div className="text-muted-foreground">Cargando…</div>;
  if (!data?.cab) return <div>No encontrado</div>;
  const a = data.cab;
  return (
    <div className="space-y-5">
      <Link to="/albaranes-compra" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" />Volver</Link>
      <div>
        <h1 className="text-2xl font-bold">Albarán {a.numero_albaran ?? "(sin nº)"}</h1>
        <p className="text-sm text-muted-foreground">{a.proveedor} · {formatDate(a.fecha)} · Factura {a.numero_factura ?? "—"}</p>
        {a.nota && <p className="text-sm mt-1">{a.nota}</p>}
      </div>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-sidebar">
            <tr>
              <th className="text-left px-3 py-2">Ref.</th><th className="text-left px-3 py-2">Descripción</th>
              <th className="text-right px-3 py-2">Cant.</th><th className="text-right px-3 py-2">P. bruto</th>
              <th className="text-right px-3 py-2">Dto.</th><th className="text-right px-3 py-2">Total</th>
              <th className="text-right px-3 py-2">P.unit neto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.lineas.map((l: any) => (
              <tr key={l.id}>
                <td className="px-3 py-2 font-mono text-xs">{l.referencia}</td>
                <td className="px-3 py-2">{l.descripcion}</td>
                <td className="px-3 py-2 text-right">{l.cantidad}</td>
                <td className="px-3 py-2 text-right">{formatEUR(l.precio_bruto, 4)}</td>
                <td className="px-3 py-2 text-right">{l.descuento_pct}%</td>
                <td className="px-3 py-2 text-right">{formatEUR(l.total_linea)}</td>
                <td className="px-3 py-2 text-right text-primary font-medium">{formatEUR(l.precio_unitario_neto, 4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-3 border-t border-border text-right text-lg font-bold text-primary">Total: {formatEUR(a.total)}</div>
      </div>
    </div>
  );
}
