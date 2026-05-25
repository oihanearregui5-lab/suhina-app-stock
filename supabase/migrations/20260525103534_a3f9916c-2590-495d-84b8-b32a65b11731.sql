
-- ============ TABLES ============

CREATE TABLE public.articulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia text UNIQUE NOT NULL,
  descripcion text NOT NULL,
  familia text,
  proveedor_habitual text,
  precio_compra_referencia numeric(10,4),
  stock_actual integer NOT NULL DEFAULT 0,
  stock_minimo integer DEFAULT 0,
  iva_compra numeric(5,2) DEFAULT 21.00,
  activo boolean DEFAULT true,
  observaciones text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_articulos_referencia ON public.articulos(referencia);
CREATE INDEX idx_articulos_familia ON public.articulos(familia);
CREATE INDEX idx_articulos_proveedor ON public.articulos(proveedor_habitual);

CREATE TABLE public.albaranes_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_albaran text,
  numero_factura text,
  proveedor text NOT NULL,
  fecha date NOT NULL,
  nota text,
  subtotal numeric(10,2),
  portes numeric(10,2) DEFAULT 0,
  iva_total numeric(10,2),
  total numeric(10,2),
  observaciones text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_albcompra_fecha ON public.albaranes_compra(fecha DESC);
CREATE INDEX idx_albcompra_proveedor ON public.albaranes_compra(proveedor);

CREATE TABLE public.lineas_albaran_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  albaran_id uuid NOT NULL REFERENCES public.albaranes_compra(id) ON DELETE CASCADE,
  articulo_id uuid REFERENCES public.articulos(id) ON DELETE SET NULL,
  referencia text NOT NULL,
  descripcion text NOT NULL,
  cantidad numeric(10,2) NOT NULL,
  precio_bruto numeric(10,4),
  descuento_pct numeric(5,2) DEFAULT 0,
  iva_pct numeric(5,2) DEFAULT 21.00,
  total_linea numeric(10,2) NOT NULL,
  precio_unitario_neto numeric(10,4) GENERATED ALWAYS AS (total_linea / NULLIF(cantidad, 0)) STORED,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_linc_albaran ON public.lineas_albaran_compra(albaran_id);
CREATE INDEX idx_linc_articulo ON public.lineas_albaran_compra(articulo_id);
CREATE INDEX idx_linc_referencia ON public.lineas_albaran_compra(referencia);

CREATE TABLE public.albaranes_venta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  cliente text,
  obra_o_referencia text,
  observaciones text,
  total_estimado numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_albventa_fecha ON public.albaranes_venta(fecha DESC);

CREATE TABLE public.lineas_albaran_venta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  albaran_id uuid NOT NULL REFERENCES public.albaranes_venta(id) ON DELETE CASCADE,
  articulo_id uuid NOT NULL REFERENCES public.articulos(id),
  referencia text NOT NULL,
  descripcion text NOT NULL,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  precio_unitario_compra numeric(10,4) NOT NULL DEFAULT 0,
  total_linea numeric(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario_compra) STORED,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_linv_albaran ON public.lineas_albaran_venta(albaran_id);
CREATE INDEX idx_linv_articulo ON public.lineas_albaran_venta(articulo_id);

-- ============ NUMERO ALBARAN VENTA AUTOGENERADO ============
CREATE SEQUENCE IF NOT EXISTS public.seq_venta_numero;

CREATE OR REPLACE FUNCTION public.set_numero_venta()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := 'V-' || to_char(COALESCE(NEW.fecha, CURRENT_DATE), 'YYYY') || '-' || lpad(nextval('public.seq_venta_numero')::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_set_numero_venta
BEFORE INSERT ON public.albaranes_venta
FOR EACH ROW EXECUTE FUNCTION public.set_numero_venta();

-- ============ TRIGGERS DE STOCK ============

-- VENTAS: descontar/ajustar stock
CREATE OR REPLACE FUNCTION public.stock_venta_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.articulos SET stock_actual = stock_actual - NEW.cantidad, updated_at = now()
      WHERE id = NEW.articulo_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.articulos SET stock_actual = stock_actual + OLD.cantidad, updated_at = now()
      WHERE id = OLD.articulo_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.articulo_id = NEW.articulo_id THEN
      UPDATE public.articulos SET stock_actual = stock_actual - (NEW.cantidad - OLD.cantidad), updated_at = now()
        WHERE id = NEW.articulo_id;
    ELSE
      UPDATE public.articulos SET stock_actual = stock_actual + OLD.cantidad WHERE id = OLD.articulo_id;
      UPDATE public.articulos SET stock_actual = stock_actual - NEW.cantidad WHERE id = NEW.articulo_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_stock_venta
AFTER INSERT OR UPDATE OR DELETE ON public.lineas_albaran_venta
FOR EACH ROW EXECUTE FUNCTION public.stock_venta_trigger();

-- COMPRAS: sumar/ajustar stock
CREATE OR REPLACE FUNCTION public.stock_compra_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.articulo_id IS NOT NULL THEN
      UPDATE public.articulos SET stock_actual = stock_actual + NEW.cantidad::integer, updated_at = now()
        WHERE id = NEW.articulo_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.articulo_id IS NOT NULL THEN
      UPDATE public.articulos SET stock_actual = stock_actual - OLD.cantidad::integer, updated_at = now()
        WHERE id = OLD.articulo_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.articulo_id IS NOT NULL THEN
      UPDATE public.articulos SET stock_actual = stock_actual - OLD.cantidad::integer WHERE id = OLD.articulo_id;
    END IF;
    IF NEW.articulo_id IS NOT NULL THEN
      UPDATE public.articulos SET stock_actual = stock_actual + NEW.cantidad::integer WHERE id = NEW.articulo_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_stock_compra
AFTER INSERT OR UPDATE OR DELETE ON public.lineas_albaran_compra
FOR EACH ROW EXECUTE FUNCTION public.stock_compra_trigger();

-- ============ updated_at triggers ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_upd_articulos BEFORE UPDATE ON public.articulos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_upd_albcompra BEFORE UPDATE ON public.albaranes_compra FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_upd_albventa BEFORE UPDATE ON public.albaranes_venta FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ RLS (permisiva para autenticados) ============
ALTER TABLE public.articulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albaranes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lineas_albaran_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albaranes_venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lineas_albaran_venta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth all articulos" ON public.articulos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all albcompra" ON public.albaranes_compra FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all linc" ON public.lineas_albaran_compra FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all albventa" ON public.albaranes_venta FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all linv" ON public.lineas_albaran_venta FOR ALL TO authenticated USING (true) WITH CHECK (true);
