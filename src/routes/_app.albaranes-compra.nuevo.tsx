import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { todayISO, formatEUR } from "@/lib/format";

export const Route = createFileRoute("/_app/albaranes-compra/nuevo")({ component: NuevoCompra });

type Linea = {
  articulo_id: string | null;
  referencia: string;
  descripcion: string;
  cantidad: string;
  precio_bruto: string;
  descuento_pct: string;
  iva_pct: string;
  total_linea: string;
};

const emptyLinea = (): Linea => ({ articulo_id: null, referencia: "", descripcion: "", cantidad: "1", precio_bruto: "", descuento_pct: "0", iva_pct: "21", total_linea: "" });

function parseN(s: string) { return Number((s || "0").replace(",", ".")) || 0; }

function NuevoCompra() {
  const navigate = useNavigate();
  const [cab, setCab] = useState({ numero_albaran: "", numero_factura: "", proveedor: "", fecha: todayISO(), nota: "", portes: "0", observaciones: "" });
  const [lineas, setLineas] = useState<Linea[]>([emptyLinea()]);
  const [articulos, setArticulos] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("articulos").select("id, referencia, descripcion").order("referencia").limit(2000).then(({ data }) => setArticulos(data ?? []));
  }, []);

  const subtotal = useMemo(() => lineas.reduce((s, l) => s + parseN(l.total_linea), 0), [lineas]);
  const ivaTotal = useMemo(() => lineas.reduce((s, l) => s + parseN(l.total_linea) * parseN(l.iva_pct) / 100, 0), [lineas]);
  const total = subtotal + ivaTotal + parseN(cab.portes);

  function updLinea(i: number, patch: Partial<Linea>) {
    setLineas(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }

  function autocalcTotal(i: number, l: Linea) {
    const auto = parseN(l.cantidad) * parseN(l.precio_bruto) * (1 - parseN(l.descuento_pct) / 100);
    updLinea(i, { total_linea: auto.toFixed(2).replace(".", ",") });
  }

  function pickArticulo(i: number, art: any) {
    updLinea(i, { articulo_id: art.id, referencia: art.referencia, descripcion: art.descripcion });
  }

  async function guardar() {
    if (!cab.proveedor.trim()) { toast.error("Indica el proveedor"); return; }
    const validas = lineas.filter(l => l.referencia && parseN(l.cantidad) > 0 && parseN(l.total_linea) > 0);
    if (!validas.length) { toast.error("Añade al menos una línea válida"); return; }

    setSaving(true);
    try {
      const { data: cabRow, error: e1 } = await supabase.from("albaranes_compra").insert({
        numero_albaran: cab.numero_albaran || null,
        numero_factura: cab.numero_factura || null,
        proveedor: cab.proveedor.trim(),
        fecha: cab.fecha,
        nota: cab.nota || null,
        subtotal, iva_total: ivaTotal, total, portes: parseN(cab.portes),
        observaciones: cab.observaciones || null,
      }).select("id").single();
      if (e1) throw e1;

      const payload = validas.map(l => ({
        albaran_id: cabRow.id,
        articulo_id: l.articulo_id,
        referencia: l.referencia,
        descripcion: l.descripcion,
        cantidad: parseN(l.cantidad),
        precio_bruto: parseN(l.precio_bruto) || null,
        descuento_pct: parseN(l.descuento_pct),
        iva_pct: parseN(l.iva_pct),
        total_linea: parseN(l.total_linea),
      }));
      const { error: e2 } = await supabase.from("lineas_albaran_compra").insert(payload);
      if (e2) throw e2;

      toast.success("Albarán guardado. Stock actualizado.");
      navigate({ to: "/albaranes-compra" });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Link to="/albaranes-compra" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" />Volver</Link>
      <h1 className="text-2xl font-bold">Nuevo albarán de compra</h1>

      <div className="bg-card border border-border rounded-lg p-4 grid md:grid-cols-3 gap-3">
        <div><Label>Proveedor *</Label><Input value={cab.proveedor} onChange={e => setCab({ ...cab, proveedor: e.target.value })} /></div>
        <div><Label>Nº albarán</Label><Input value={cab.numero_albaran} onChange={e => setCab({ ...cab, numero_albaran: e.target.value })} /></div>
        <div><Label>Nº factura</Label><Input value={cab.numero_factura} onChange={e => setCab({ ...cab, numero_factura: e.target.value })} /></div>
        <div><Label>Fecha *</Label><Input type="date" value={cab.fecha} onChange={e => setCab({ ...cab, fecha: e.target.value })} /></div>
        <div><Label>Portes</Label><Input value={cab.portes} onChange={e => setCab({ ...cab, portes: e.target.value })} /></div>
        <div className="md:col-span-1"><Label>Nota</Label><Input value={cab.nota} onChange={e => setCab({ ...cab, nota: e.target.value })} /></div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground bg-sidebar">
              <tr>
                <th className="text-left px-2 py-2 w-48">Referencia</th>
                <th className="text-left px-2 py-2">Descripción</th>
                <th className="text-right px-2 py-2 w-20">Cant.</th>
                <th className="text-right px-2 py-2 w-24">P. bruto</th>
                <th className="text-right px-2 py-2 w-16">Dto %</th>
                <th className="text-right px-2 py-2 w-16">IVA %</th>
                <th className="text-right px-2 py-2 w-24">Total</th>
                <th className="px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lineas.map((l, i) => {
                const pUnit = parseN(l.cantidad) > 0 ? parseN(l.total_linea) / parseN(l.cantidad) : 0;
                const match = articulos.filter(a => l.referencia && a.referencia.toLowerCase().includes(l.referencia.toLowerCase())).slice(0, 6);
                return (
                  <tr key={i} className="align-top">
                    <td className="px-2 py-2">
                      <Input list={`refs-${i}`} value={l.referencia} onChange={(e) => {
                        const v = e.target.value;
                        const exact = articulos.find(a => a.referencia === v);
                        if (exact) pickArticulo(i, exact);
                        else updLinea(i, { referencia: v, articulo_id: null });
                      }} className="font-mono text-xs" placeholder="Referencia" />
                      <datalist id={`refs-${i}`}>
                        {match.map(a => <option key={a.id} value={a.referencia}>{a.descripcion}</option>)}
                      </datalist>
                      {!l.articulo_id && l.referencia && <div className="text-[10px] text-warning mt-1">⚠ Artículo no en catálogo</div>}
                    </td>
                    <td className="px-2 py-2"><Input value={l.descripcion} onChange={e => updLinea(i, { descripcion: e.target.value })} /></td>
                    <td className="px-2 py-2"><Input className="text-right" value={l.cantidad} onChange={e => updLinea(i, { cantidad: e.target.value })} onBlur={() => autocalcTotal(i, l)} /></td>
                    <td className="px-2 py-2"><Input className="text-right" value={l.precio_bruto} onChange={e => updLinea(i, { precio_bruto: e.target.value })} onBlur={() => autocalcTotal(i, l)} /></td>
                    <td className="px-2 py-2"><Input className="text-right" value={l.descuento_pct} onChange={e => updLinea(i, { descuento_pct: e.target.value })} onBlur={() => autocalcTotal(i, l)} /></td>
                    <td className="px-2 py-2"><Input className="text-right" value={l.iva_pct} onChange={e => updLinea(i, { iva_pct: e.target.value })} /></td>
                    <td className="px-2 py-2">
                      <Input className="text-right font-medium" value={l.total_linea} onChange={e => updLinea(i, { total_linea: e.target.value })} />
                      <div className="text-[10px] text-muted-foreground text-right mt-1">P.unit: {formatEUR(pUnit, 4)}</div>
                    </td>
                    <td className="px-2 py-2"><button type="button" onClick={() => setLineas(prev => prev.filter((_, k) => k !== i))} className="text-destructive"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-border flex justify-between">
          <Button type="button" variant="outline" onClick={() => setLineas(prev => [...prev, emptyLinea()])}><Plus className="h-4 w-4 mr-1" />Añadir línea</Button>
          <div className="text-sm space-y-1 text-right">
            <div>Subtotal: <span className="font-medium">{formatEUR(subtotal)}</span></div>
            <div className="text-muted-foreground">IVA: {formatEUR(ivaTotal)} · Portes: {formatEUR(parseN(cab.portes))}</div>
            <div className="text-lg font-bold text-primary">Total: {formatEUR(total)}</div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Link to="/albaranes-compra"><Button variant="outline">Cancelar</Button></Link>
        <Button onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "Guardar albarán"}</Button>
      </div>
    </div>
  );
}
