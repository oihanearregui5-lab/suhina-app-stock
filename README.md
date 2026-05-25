# SUHINA — Sistema de Gestión Empresarial

Aplicación interna de SUHINA S.L.U. para la gestión de stock de latiguillos hidráulicos y registro de albaranes de compra y venta.

## Funcionalidades

- **Catálogo de artículos:** 333 referencias con stock, familia, proveedor y precio de referencia.
- **Albaranes de compra:** registro de las entradas de material por proveedor, con cálculo automático del precio unitario neto a partir del total y la cantidad de cada línea.
- **Albaranes de venta:** registro interno de salidas de material con sugerencia automática del precio unitario más reciente.
- **Stock automático:** los triggers de la base de datos suman al stock al registrar una compra y descuentan al registrar una venta.
- **Importación desde Excel** del catálogo inicial.

## Lógica del precio unitario

Cuando se crea una línea en un albarán de venta, la app sugiere el precio con esta cascada:

1. Último precio neto registrado en `lineas_albaran_compra` para ese artículo (`total_linea ÷ cantidad`).
2. Si no hay histórico, usa `articulos.precio_compra_referencia`.
3. Si no hay nada, lo deja a 0 con aviso.

Ejemplo: `BG70430004 TAPON TUERCA CIEGA ORFS 9/16` se compró en cantidad 6 con total 5,83 € → precio unitario neto = **0,9717 €/ud**.

## Stack técnico

- **Frontend:** React 19 + TypeScript + Vite + TanStack Router + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth)
- **Despliegue:** Cloudflare Workers

## Estructura del proyecto

```
src/
├── routes/                    # Rutas de la app (TanStack Router)
├── components/                # Componentes reutilizables y UI de shadcn
├── integrations/supabase/     # Cliente y tipos de Supabase
└── lib/                       # Utilidades: precio.ts, format.ts, auth-context.tsx

supabase/
└── migrations/                # Migraciones SQL versionadas
    ├── 20260525103534_*.sql   # Creación de tablas, triggers y RLS
    ├── 20260525103549_*.sql   # Configuración search_path
    └── 20260525120000_*.sql   # Carga inicial: 333 artículos + albarán Rogimar
```

## Variables de entorno

Definidas en Cloudflare Workers (sección Build):

- `VITE_SUPABASE_URL` — URL del proyecto de Supabase
- `VITE_SUPABASE_PUBLISHABLE_KEY` — clave anon pública

## Comandos de desarrollo local

```bash
bun install        # instalar dependencias
bun run dev        # servidor de desarrollo
bun run build      # compilar para producción
```

---

© 2026 SUHINA S.L.U. — Uso interno
