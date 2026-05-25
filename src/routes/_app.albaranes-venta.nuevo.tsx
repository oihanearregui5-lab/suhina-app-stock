import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, ArrowLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { todayISO, formatEUR } from "@/lib/format";
import { sugerirPrecio } from "@/lib/precio";

export const Route = createFileRoute("/_app/albaranes-venta/nuevo")({ component: NuevoVenta });

type Linea = {
  articulo_id: string;
  referencia: string;
  descripcion: string;
  stock_actual: number;
  cantidad: string;
  precio_unitario_compra: string;
  fuente: string;
};

function parseN(s: string) { return Number((s || "0").replace(",", ".")) || 0; }

function NuevoVenta() {
  const navigate = useNavigate();
  const [cab, setCab] = useState({ numero: "", fecha: todayISO(), cliente: "", obra_o_referencia: "", observaciones: "" });
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [articulos, setArticulos] = useState<any[]>([]);
  const [busq, setBusq] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("articulos").select("id, referencia, descripcion, stock_actual").order("referencia").limit(2000).then(({ data }) => setArticulos(data ?? []));
  }, []);

  const total = useMemo(() => lineas.reduce((s, l) => s + parseN(l.cantidad) * parseN(l.precio_unitario_compra), 0), [lineas]);

  async function addArticulo(art: any) {
    const sug = await sugerirPrecio(art.id, art.referencia);
    setLineas(prev => [...prev, {
      articulo_id: art.id, referencia: art.referencia, descripcion: art.descripcion,
      stock_actual: art.stock_actual ?? 0,
      cantidad: "1", precio_unitario_compra: sug.precio.toFixed(4).replace(".", ","),
      fuente: sug.detalle,
    }]);
    setBusq("");
  }

  async function guardar() {
    if (!lineas.length) { toast.error("Añade al menos una línea"); return; }
    setSaving(true);
    try {
      const { data: cabRow, error: e1 } = await supabase.from("albaranes_venta").insert({
        numero: cab.numero || null,
        fecha: cab.fecha,
        cliente: cab.cliente || null,
        obra_o_referencia: cab.obra_o_referencia || null,
        observaciones: cab.observaciones || null,
        total_estimado: total,
      }).select("id").single();
      if (e1) throw e1;

      const payload = lineas.map(l => ({
        albaran_id: cabRow.id,
        articulo_id: l.articulo_id,
        referencia: l.referencia,
        descripcion: l.descripcion,
        cantidad: Number(parseN(l.cantidad)),
        precio_unitario_compra: parseN(l.precio_unitario_compra),
      }));
      const { error: e2 } = await supabase.from("lineas_albaran_venta").insert(payload);
      if (e2) throw e2;

      toast.success("Albarán guardado. Stock descontado.");
      navigate({ to: "/albaranes-venta" });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const matches = busq.trim().length >= 2
    ? articulos.filter(a => a.referencia.toLowerCase().includes(busq.toLowerCase()) || a.descripcion.toLowerCase().includes(busq.toLowerCase())).slice(0, 8)
    : [];

  return (
    <div className="space-y-5">
      <Link to="/albaranes-venta" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" />Volver</Link>
      <h1 className="text-2xl font-bold">Nuevo albarán de venta</h1>

      <div className="bg-card border border-border rounded-lg p-4 grid md:grid-cols-4 gap-3">
        <div><Label>Nº (auto)</Label><Input value={cab.numero} onChange={e => setCab({ ...cab, numero: e.target.value })} placeholder="V-2026-0001" /></div>
        <div><Label>Fecha *</Label><Input type="date" value={cab.fecha} onChange={e => setCab({ ...cab, fecha: e.target.value })} /></div>
        <div><Label>Cliente</Label><Input value={cab.cliente} onChange={e => setCab({ ...cab, cliente: e.target.value })} /></div>
        <div><Label>Obra / Referencia</Label><Input value={cab.obra_o_referencia} onChange={e => setCab({ ...cab, obra_o_referencia: e.target.value })} placeholder="Furgoneta, Taller…" /></div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <Label>Añadir artículo</Label>
        <div className="relative">
          <Input value={busq} onChange={e => setBusq(e.target.value)} placeholder="Buscar por referencia o descripción…" />
          {matches.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-2xl z-10 max-h-72 overflow-auto">
              {matches.map(a => (
                <button key={a.id} type="button" onClick={() => addArticulo(a)} className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b border-border last:border-0">
                  <span className="font-mono text-xs text-primary">{a.referencia}</span> · {a.descripcion}
                  <span className="text-xs text-muted-foreground ml-2">Stock: {a.stock_actual}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-sidebar">
            <tr>
              <th className="text-left px-2 py-2">Artículo</th>
              <th className="text-right px-2 py-2 w-24">Stock</th>
              <th className="text-right px-2 py-2 w-24">Cant.</th>
              <th className="text-right px-2 py-2 w-32">P. unit.</th>
              <th className="text-right px-2 py-2 w-28">Total</th>
              <th className="px-2 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lineas.map((l, i) => {
              const cant = parseN(l.cantidad);
              const excede = cant > l.stock_actual;
              return (
                <tr key={i} className="align-top">
                  <td className="px-2 py-2">
                    <div className="font-mono text-xs text-primary">{l.referencia}</div>
                    <div className="text-xs">{l.descripcion}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{l.fuente}</div>
                  </td>
                  <td className={`px-2 py-2 text-right ${excede ? "text-destructive font-bold" : ""}`}>
                    {l.stock_actual}
                    {excede && <div className="flex items-center justify-end gap-1 text-[10px]"><AlertTriangle className="h-3 w-3" />Excede</div>}
                  </td>
                  <td className="px-2 py-2"><Input className="text-right" value={l.cantidad} onChange={e => setLineas(prev => prev.map((x, k) => k === i ? { ...x, cantidad: e.target.value } : x))} /></td>
                  <td className="px-2 py-2"><Input className="text-right" value={l.precio_unitario_compra} onChange={e => setLineas(prev => prev.map((x, k) => k === i ? { ...x, precio_unitario_compra: e.target.value } : x))} /></td>
                  <td className="px-2 py-2 text-right font-medium">{formatEUR(cant * parseN(l.precio_unitario_compra))}</td>
                  <td className="px-2 py-2"><button type="button" onClick={() => setLineas(prev => prev.filter((_, k) => k !== i))} className="text-destructive"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              );
            })}
            {!lineas.length && <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Busca y añade artículos arriba</td></tr>}
          </tbody>
        </table>
        <div className="p-3 border-t border-border text-right">
          <div className="text-lg font-bold text-primary">Total estimado: {formatEUR(total)}</div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Link to="/albaranes-venta"><Button variant="outline">Cancelar</Button></Link>
        <Button onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "Guardar albarán"}</Button>
      </div>
    </div>
  );
}
