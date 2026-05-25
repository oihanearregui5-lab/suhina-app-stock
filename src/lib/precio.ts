import { supabase } from "@/integrations/supabase/client";

export interface PrecioSugerido {
  precio: number;
  fuente: "historico" | "referencia" | "ninguno";
  detalle: string;
}

/**
 * Lógica de cascada para sugerir precio unitario al añadir artículo en venta:
 * 1) Última línea de compra con ese artículo → precio_unitario_neto
 * 2) articulos.precio_compra_referencia
 * 3) 0 con aviso
 */
export async function sugerirPrecio(articuloId: string, referencia: string): Promise<PrecioSugerido> {
  // 1) Por articulo_id
  const { data: porId } = await supabase
    .from("lineas_albaran_compra")
    .select("precio_unitario_neto, albaran_id, albaranes_compra!inner(fecha, proveedor)")
    .eq("articulo_id", articuloId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let row: any = porId;
  // 2) Por referencia si no había por id (caso de líneas antiguas sin articulo_id)
  if (!row) {
    const { data: porRef } = await supabase
      .from("lineas_albaran_compra")
      .select("precio_unitario_neto, albaran_id, albaranes_compra!inner(fecha, proveedor)")
      .eq("referencia", referencia)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    row = porRef;
  }

  if (row?.precio_unitario_neto) {
    const fecha = row.albaranes_compra?.fecha;
    const prov = row.albaranes_compra?.proveedor;
    const f = fecha ? new Date(fecha).toLocaleDateString("es-ES") : "";
    return {
      precio: Number(row.precio_unitario_neto),
      fuente: "historico",
      detalle: `Último precio compra (${f}${prov ? " — " + prov : ""})`,
    };
  }

  // 3) Precio referencia
  const { data: art } = await supabase
    .from("articulos")
    .select("precio_compra_referencia")
    .eq("id", articuloId)
    .maybeSingle();

  if (art?.precio_compra_referencia) {
    return {
      precio: Number(art.precio_compra_referencia),
      fuente: "referencia",
      detalle: "Precio de referencia inicial",
    };
  }

  return { precio: 0, fuente: "ninguno", detalle: "⚠ Sin precio histórico, introduce manualmente" };
}
