import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Package, Wrench, GitMerge, Link2, Cog, Circle, Square, Disc, Hexagon, Pipette, Layers, AlertTriangle, LayoutGrid, List } from "lucide-react";
import { formatEUR } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/articulos/")({ component: ArticulosPage });

// Configuración visual por familia: icono + paleta de colores (tema oscuro, acento por familia)
const FAMILIA_CONFIG: Record<string, { icon: any; accent: string; bar: string; chip: string }> = {
  "ADAPTADORES ROSCA ORFS Y METRICO": { icon: GitMerge,   accent: "text-sky-300",     bar: "bg-sky-500/70",     chip: "bg-sky-500/15 text-sky-200 border-sky-500/30" },
  "ADAPTADORES CONEXION":             { icon: Link2,      accent: "text-emerald-300", bar: "bg-emerald-500/70", chip: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30" },
  "PRENSABLES METRICOS SERIE LIGERA": { icon: Cog,        accent: "text-violet-300",  bar: "bg-violet-500/70",  chip: "bg-violet-500/15 text-violet-200 border-violet-500/30" },
  "PRENSABLES METRICOS SERIE PESADA": { icon: Cog,        accent: "text-fuchsia-300", bar: "bg-fuchsia-500/70", chip: "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/30" },
  "PRENSABLES JIC":                   { icon: Hexagon,    accent: "text-orange-300",  bar: "bg-orange-500/70",  chip: "bg-orange-500/15 text-orange-200 border-orange-500/30" },
  "PRENSABLES GAS":                   { icon: Pipette,    accent: "text-rose-300",    bar: "bg-rose-500/70",    chip: "bg-rose-500/15 text-rose-200 border-rose-500/30" },
  "PRENSABLES ORFS":                  { icon: Square,     accent: "text-teal-300",    bar: "bg-teal-500/70",    chip: "bg-teal-500/15 text-teal-200 border-teal-500/30" },
  "SAE BRIDAS":                       { icon: Layers,     accent: "text-amber-300",   bar: "bg-amber-500/70",   chip: "bg-amber-500/15 text-amber-200 border-amber-500/30" },
  "MANGUERAS HIDRAULICAS":            { icon: Wrench,     accent: "text-indigo-300",  bar: "bg-indigo-500/70",  chip: "bg-indigo-500/15 text-indigo-200 border-indigo-500/30" },
  "CASQUILLOS PRENSABLES":            { icon: Disc,       accent: "text-cyan-300",    bar: "bg-cyan-500/70",    chip: "bg-cyan-500/15 text-cyan-200 border-cyan-500/30" },
  "ESFERICOS":                        { icon: Circle,     accent: "text-pink-300",    bar: "bg-pink-500/70",    chip: "bg-pink-500/15 text-pink-200 border-pink-500/30" },
  "TALLER":                           { icon: Wrench,     accent: "text-yellow-300",  bar: "bg-yellow-500/70",  chip: "bg-yellow-500/15 text-yellow-200 border-yellow-500/30" },
};

const DEFAULT_FAMILIA = { icon: Package, accent: "text-muted-foreground", bar: "bg-muted", chip: "bg-muted/20 text-muted-foreground border-border" };

function getFamiliaConfig(familia: string | null | undefined) {
  if (!familia) return DEFAULT_FAMILIA;
  return FAMILIA_CONFIG[familia] ?? DEFAULT_FAMILIA;
}

function ArticulosPage() {
  const [q, setQ] = useState("");
  const [familia, setFamilia] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [vista, setVista] = useState<"cards" | "tabla">("cards");
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

  // Agrupar por familia
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const art of filtered) {
      const key = art.familia ?? "SIN FAMILIA";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(art);
    }
    // Orden: familias con más artículos primero
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  // Contador global de artículos por familia (para mostrar en los chips)
  const contadoresFamilia = useMemo(() => {
    const map = new Map<string, number>();
    for (const art of articulos ?? []) {
      const key = art.familia ?? "SIN FAMILIA";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [articulos]);

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Artículos</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} de {articulos?.length ?? 0} artículos</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-card border border-border rounded-md p-0.5">
            <button
              onClick={() => setVista("cards")}
              className={`p-1.5 rounded ${vista === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="Vista de tarjetas"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setVista("tabla")}
              className={`p-1.5 rounded ${vista === "tabla" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="Vista de tabla"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <NewArticleDialog onCreated={() => qc.invalidateQueries({ queryKey: ["articulos"] })} />
        </div>
      </div>

      {/* Filtros */}
      <div className="space-y-3 bg-card border border-border p-3 rounded-lg">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por referencia o descripción…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <select value={proveedor} onChange={(e) => setProveedor(e.target.value)} className="bg-input border border-border rounded-md px-3 text-sm">
            <option value="">Todos los proveedores</option>
            {proveedores.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Chips de familia */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFamilia("")}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              familia === "" ? "bg-primary text-primary-foreground border-primary" : "bg-muted/20 text-muted-foreground border-border hover:bg-muted/40"
            }`}
          >
            Todas ({articulos?.length ?? 0})
          </button>
          {familias.map(f => {
            const cfg = getFamiliaConfig(f);
            const Icon = cfg.icon;
            const active = familia === f;
            const count = contadoresFamilia.get(f) ?? 0;
            return (
              <button
                key={f}
                onClick={() => setFamilia(active ? "" : f)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : `${cfg.chip} hover:opacity-80`
                }`}
              >
                <Icon className="h-3 w-3" />
                {f} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido */}
      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">Cargando…</div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-lg">Sin resultados</div>
      )}

      {!isLoading && filtered.length > 0 && vista === "cards" && (
        <div className="space-y-6">
          {grouped.map(([fam, items]) => {
            const cfg = getFamiliaConfig(fam);
            const Icon = cfg.icon;
            return (
              <section key={fam}>
                {/* Cabecera de familia */}
                <div className="flex items-center gap-2 mb-3">
                  <div className={`flex items-center justify-center h-8 w-8 rounded-md ${cfg.chip} border`}>
                    <Icon className={`h-4 w-4 ${cfg.accent}`} />
                  </div>
                  <h2 className="text-base font-semibold uppercase tracking-wide">{fam}</h2>
                  <span className="text-xs text-muted-foreground">{items.length} {items.length === 1 ? "artículo" : "artículos"}</span>
                  <div className={`flex-1 h-px ${cfg.bar} opacity-30 ml-2`} />
                </div>

                {/* Grid de cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {items.map(a => {
                    const stock = a.stock_actual ?? 0;
                    const minimo = a.stock_minimo ?? 0;
                    const bajo = minimo > 0 && stock <= minimo;
                    const sinStock = stock === 0;
                    return (
                      <Link
                        key={a.id}
                        to="/articulos/$id"
                        params={{ id: a.id }}
                        className="group block bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all"
                      >
                        {/* Barra superior coloreada por familia */}
                        <div className={`h-1 ${cfg.bar}`} />
                        <div className="p-3 space-y-2">
                          {/* Referencia y stock */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-mono text-sm font-semibold text-primary group-hover:underline truncate">
                              {a.referencia}
                            </div>
                            <div className="flex flex-col items-end shrink-0">
                              <div className={`text-lg font-bold leading-none ${sinStock ? "text-destructive" : bajo ? "text-orange-400" : "text-foreground"}`}>
                                {stock}
                              </div>
                              <div className="text-[10px] uppercase text-muted-foreground">stock</div>
                            </div>
                          </div>

                          {/* Descripción */}
                          <p className="text-xs text-foreground/80 line-clamp-2 min-h-[2rem]" title={a.descripcion}>
                            {a.descripcion}
                          </p>

                          {/* Pie: precio + aviso stock bajo */}
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                            <div className="text-xs">
                              <span className="text-muted-foreground">P. ref.</span>{" "}
                              <span className="font-medium">{formatEUR(a.precio_compra_referencia, 4)}</span>
                            </div>
                            {bajo && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-orange-400 font-medium">
                                <AlertTriangle className="h-3 w-3" />
                                Stock bajo
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Vista tabla (mantenida para densidad y compatibilidad) */}
      {!isLoading && filtered.length > 0 && vista === "tabla" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-320px)]">
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
                {filtered.slice(0, 500).map(a => {
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
              </tbody>
            </table>
            {filtered.length > 500 && (
              <div className="text-center text-xs text-muted-foreground py-2">Mostrando 500 primeros. Refina la búsqueda para ver más.</div>
            )}
          </div>
        </div>
      )}
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
