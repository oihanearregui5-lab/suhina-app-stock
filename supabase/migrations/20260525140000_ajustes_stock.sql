-- ============================================================
-- SUHINA - Ajustes manuales de stock
-- Permite registrar salidas/entradas rápidas sin crear albarán completo
-- Mantiene trazabilidad: cada cambio queda guardado con motivo y fecha
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ajustes_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  articulo_id uuid NOT NULL REFERENCES public.articulos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('salida', 'entrada', 'correccion')),
  cantidad integer NOT NULL CHECK (cantidad > 0),
  motivo text,
  stock_antes integer NOT NULL,
  stock_despues integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_ajustes_articulo ON public.ajustes_stock(articulo_id);
CREATE INDEX IF NOT EXISTS idx_ajustes_fecha ON public.ajustes_stock(created_at DESC);

-- ============================================================
-- Trigger: aplicar el ajuste al stock_actual del artículo
-- ============================================================
CREATE OR REPLACE FUNCTION public.ajuste_stock_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_stock_actual integer;
  v_nuevo_stock integer;
BEGIN
  -- Bloquear la fila del artículo para evitar condiciones de carrera
  SELECT stock_actual INTO v_stock_actual
  FROM public.articulos
  WHERE id = NEW.articulo_id
  FOR UPDATE;

  -- Calcular nuevo stock según tipo
  IF NEW.tipo = 'salida' THEN
    v_nuevo_stock := v_stock_actual - NEW.cantidad;
  ELSIF NEW.tipo = 'entrada' THEN
    v_nuevo_stock := v_stock_actual + NEW.cantidad;
  ELSIF NEW.tipo = 'correccion' THEN
    -- En corrección, cantidad es el VALOR FINAL deseado, no la diferencia
    v_nuevo_stock := NEW.cantidad;
  ELSE
    RAISE EXCEPTION 'Tipo de ajuste no válido: %', NEW.tipo;
  END IF;

  -- Guardar el snapshot antes/después en la propia fila del ajuste
  NEW.stock_antes := v_stock_actual;
  NEW.stock_despues := v_nuevo_stock;

  -- Aplicar el cambio al artículo
  UPDATE public.articulos
  SET stock_actual = v_nuevo_stock, updated_at = now()
  WHERE id = NEW.articulo_id;

  RETURN NEW;
END $$;

ALTER FUNCTION public.ajuste_stock_trigger() SET search_path = public;

DROP TRIGGER IF EXISTS trg_ajuste_stock ON public.ajustes_stock;
CREATE TRIGGER trg_ajuste_stock
BEFORE INSERT ON public.ajustes_stock
FOR EACH ROW EXECUTE FUNCTION public.ajuste_stock_trigger();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.ajustes_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth all ajustes" ON public.ajustes_stock;
CREATE POLICY "auth all ajustes" ON public.ajustes_stock FOR ALL TO authenticated USING (true) WITH CHECK (true);
