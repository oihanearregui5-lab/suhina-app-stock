import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { formatEUR } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/articulos/")({ component: ArticulosPage });

function ArticulosPage() {
  const [q, setQ] = useState("");
  const [familia, setFamilia] = useState("");
  const [proveedor, setProveedor] = useState("");
  const qc = useQueryClient();

  const { data: articulos, isLoading } = useQuery({
    queryKey: ["articulos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("articulos").select("*").order("referencia").limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const familias = useMemo(() => Array.from(new Set((articulos ?? []).map(a => a.familia).filter(Boolean))).sort() as string[], [articulos]);
  const proveedores = useMemo(() => Array.from(new Set((articulos ?? []).map(a => a.proveedor_habitual).filter(Boolean))).sort() as string[], [articulos]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (articulos ?? []).filter(a => {
      if (familia && a.familia !== familia) return false;
      if (proveedor && a.proveedor_habitual !== proveedor) return false;
      if (term && !(a.referencia.toLowerCase().includes(term) || a.descripcion.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [articulos, q, familia, proveedor]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Artículos</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} de {articulos?.length ?? 0} artículos</p>
        </div>
        <NewArticleDialog onCreated={() => qc.invalidateQueries({ queryKey: ["articulos"] })} />
      </div>

      <div className="flex flex-wrap gap-3 bg-card border border-border p-3 rounded-lg">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por referencia o descripción…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <select value={familia} onChange={(e) => setFamilia(e.target.value)} className="bg-input border border-border rounded-md px-3 text-sm">
          <option value="">Todas las familias</option>
          {familias.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={proveedor} onChange={(e) => setProveedor(e.target.value)} className="bg-input border border-border rounded-md px-3 text-sm">
          <option value="">Todos los proveedores</option>
          {proveedores.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground bg-sidebar sticky top-0">
              <tr>
                <th className="text-left px-3 py-2">Ref.</th>
                <th className="text-left px-3 py-2">Descripción</th>
                <th className="text-left px-3 py-2">Familia</th>
                <th className="text-right px-3 py-2">Stock</th>
                <th className="text-right px-3 py-2">Mín.</th>
                <th className="text-right px-3 py-2">P. ref.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Cargando…</td></tr>}
              {!isLoading && filtered.slice(0, 500).map(a => {
                const bajo = (a.stock_minimo ?? 0) > 0 && (a.stock_actual ?? 0) <= (a.stock_minimo ?? 0);
                return (
                  <tr key={a.id} className="hover:bg-accent/30">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link to="/articulos/$id" params={{ id: a.id }} className="text-primary hover:underline">{a.referencia}</Link>
                    </td>
                    <td className="px-3 py-2">{a.descripcion}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{a.familia ?? "—"}</td>
                    <td className={`px-3 py-2 text-right font-medium ${bajo ? "text-destructive" : ""}`}>{a.stock_actual}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{a.stock_minimo ?? 0}</td>
                    <td className="px-3 py-2 text-right">{formatEUR(a.precio_compra_referencia, 4)}</td>
                  </tr>
                );
              })}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Sin resultados</td></tr>}
            </tbody>
          </table>
          {filtered.length > 500 && (
            <div className="text-center text-xs text-muted-foreground py-2">Mostrando 500 primeros. Refina la búsqueda para ver más.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewArticleDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ referencia: "", descripcion: "", familia: "", proveedor_habitual: "", precio_compra_referencia: "", stock_actual: "0", stock_minimo: "0" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("articulos").insert({
      referencia: form.referencia.trim(),
      descripcion: form.descripcion.trim(),
      familia: form.familia || null,
      proveedor_habitual: form.proveedor_habitual || null,
      precio_compra_referencia: form.precio_compra_referencia ? Number(form.precio_compra_referencia.replace(",", ".")) : null,
      stock_actual: Number(form.stock_actual || 0),
      stock_minimo: Number(form.stock_minimo || 0),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Artículo creado");
    setOpen(false);
    setForm({ referencia: "", descripcion: "", familia: "", proveedor_habitual: "", precio_compra_referencia: "", stock_actual: "0", stock_minimo: "0" });
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-1" />Nuevo artículo</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo artículo</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Referencia *</Label><Input required value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} /></div>
            <div><Label>Precio referencia</Label><Input value={form.precio_compra_referencia} onChange={(e) => setForm({ ...form, precio_compra_referencia: e.target.value })} placeholder="0,00" /></div>
          </div>
          <div><Label>Descripción *</Label><Input required value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Familia</Label><Input value={form.familia} onChange={(e) => setForm({ ...form, familia: e.target.value })} /></div>
            <div><Label>Proveedor habitual</Label><Input value={form.proveedor_habitual} onChange={(e) => setForm({ ...form, proveedor_habitual: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Stock actual</Label><Input type="number" value={form.stock_actual} onChange={(e) => setForm({ ...form, stock_actual: e.target.value })} /></div>
            <div><Label>Stock mínimo</Label><Input type="number" value={form.stock_minimo} onChange={(e) => setForm({ ...form, stock_minimo: e.target.value })} /></div>
          </div>
          <DialogFooter><Button type="submit">Crear</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
