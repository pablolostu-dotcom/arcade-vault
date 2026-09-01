// ===== lib/database.types.ts — tipos del esquema, generados =====
// NO editar a mano: este archivo lo regenera `npm run db:types` desde el
// esquema real del proyecto de Supabase. Se versiona a propósito para que
// clonar y compilar el repo no requiera tener el CLI instalado ni autenticado.
//
// Hoy sale vacío porque el SPEC 04 no crea ninguna tabla: es solo el cableado.
// El día que exista la primera migración, basta volver a correr el script y
// los tres clientes (browser, servidor y proxy) conocen el esquema nuevo.

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
