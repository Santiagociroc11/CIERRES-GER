import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan las variables de entorno de Supabase');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const eliminarReporte = async (reporteId: string) => {
  try {
    // 1️⃣ Obtener el reporte (ID_CLIENTE y ESTADO_ANTERIOR)
    const { data: report, error: reportError } = await supabase
      .from("GERSSON_REPORTES")
      .select("ID_CLIENTE, ESTADO_ANTERIOR")
      .eq("ID", reporteId)
      .single();

    if (reportError || !report) {
      console.error("❌ Error al obtener el reporte:", reportError);
      throw new Error("El reporte no existe o no se pudo recuperar.");
    }

    // 2️⃣ Iniciar una transacción manualmente (actualizar estado y eliminar reporte)
    const { error: updateError } = await supabase
      .from("GERSSON_CLIENTES")
      .update({ ESTADO: report.ESTADO_ANTERIOR })
      .eq("ID", report.ID_CLIENTE);

    if (updateError) {
      console.error("❌ Error al actualizar el estado del cliente:", updateError);
      throw new Error("No se pudo actualizar el estado del cliente.");
    }

    // 3️⃣ Eliminar el reporte después de actualizar el estado
    const { error: deleteError } = await supabase
      .from("GERSSON_REPORTES")
      .delete()
      .eq("ID", reporteId);

    if (deleteError) {
      console.error("❌ Error al eliminar el reporte:", deleteError);
      throw new Error("No se pudo eliminar el reporte.");
    }

    console.log("✅ Reporte eliminado y estado del cliente restaurado correctamente.");
    return { success: true };
  } catch (error) {
    console.error("⚠️ Error en eliminarReporte:", error);
    return { success: false, message: error.message };
  }
};
