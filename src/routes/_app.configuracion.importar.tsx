import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/configuracion/importar")({ component: ImportarPage });

type Row = Record<string, any>;

function pick(row: Row, names: string[]): any {
  for (const n of names) {
    const k = Object.keys(row).find(k => k.trim().toLowerCase() === n.toLowerCase());
    if (k && row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
  }
  return null;
}
function toNum(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
}

function ImportarPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Row>(ws, { defval: "" });
      setRows(data);
    };
    reader.readAsBinaryString(file);
  }

  async function importar() {
    setImporting(true);
    let ok = 0, err = 0;
    const errores: string[] = [];
    try {
      // chunks de 200
      const mapped = rows.map(r => ({
        referencia: String(pick(r, ["Referencia", "Ref", "REFERENCIA"]) ?? "").trim(),
        descripcion: String(pick(r, ["Descripcion", "Descripción", "DESCRIPCION"]) ?? "").trim(),
        familia: pick(r, ["Descripcion Familia", "Familia", "FAMILIA"]) || null,
        precio_compra_referencia: toNum(pick(r, ["Precio Compra Sin IVA", "Precio Compra", "Precio"])),
        stock_actual: Number(toNum(pick(r, ["STOCK TOTAL", "Stock Total", "Stock"])) ?? 0),
        stock_minimo: Number(toNum(pick(r, ["Stock Minimo", "Stock Mínimo", "Mínimo"])) ?? 0),
        proveedor_habitual: pick(r, ["Descripcion Proveedor Habitual", "Proveedor", "PROVEEDOR"]) || null,
        activo: (() => { const v = pick(r, ["Activo", "ACTIVO"]); return v === null || v === "" ? true : Number(v) !== 0; })(),
        observaciones: pick(r, ["Observaciones", "OBSERVACIONES"]) || null,
      })).filter(r => r.referencia && r.descripcion);

      for (let i = 0; i < mapped.length; i += 200) {
        const chunk = mapped.slice(i, i + 200);
        const { error } = await supabase.from("articulos").upsert(chunk, { onConflict: "referencia" });
        if (error) { err += chunk.length; errores.push(error.message); }
        else ok += chunk.length;
      }
      setResult(`✅ Importados/actualizados: ${ok}. Errores: ${err}.${errores[0] ? " " + errores[0] : ""}`);
      toast.success(`${ok} artículos importados`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Importar artículos desde Excel</h1>
        <p className="text-sm text-muted-foreground">Sube el .xlsx del maestro. Columnas: Referencia, Descripcion, Descripcion Familia, Precio Compra Sin IVA, STOCK TOTAL, Stock Minimo, Descripcion Proveedor Habitual, Activo, Observaciones.</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:border-primary transition-colors">
          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
          <span className="text-sm">{fileName || "Haz clic para seleccionar un .xlsx"}</span>
          <input type="file" accept=".xlsx,.xls" onChange={onFile} className="hidden" />
        </label>

        {rows.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="text-sm text-muted-foreground">{rows.length} filas detectadas. Preview de las 10 primeras:</div>
            <div className="overflow-x-auto bg-background border border-border rounded-md max-h-80">
              <table className="w-full text-xs">
                <thead className="bg-sidebar sticky top-0">
                  <tr>{Object.keys(rows[0]).map(k => <th key={k} className="text-left px-2 py-1 whitespace-nowrap">{k}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.slice(0, 10).map((r, i) => (
                    <tr key={i}>{Object.keys(rows[0]).map(k => <td key={k} className="px-2 py-1 whitespace-nowrap">{String(r[k] ?? "")}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button onClick={importar} disabled={importing}>
              {importing ? "Importando…" : `Importar ${rows.length} artículos (upsert por referencia)`}
            </Button>
          </div>
        )}

        {result && <div className="mt-4 p-3 rounded-md bg-secondary text-sm">{result}</div>}
      </div>
    </div>
  );
}
