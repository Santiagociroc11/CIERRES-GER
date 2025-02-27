import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const ReasignarCliente = ({ clienteId, asesorActual }) => {
  const [asesores, setAsesores] = useState([]);
  const [nuevoAsesor, setNuevoAsesor] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const fetchAsesores = async () => {
      setLoading(true);
      setErrorMsg("");
      try {
        const { data, error } = await supabase
          .from("GERSSON_ASESORES")
          .select("ID, NOMBRE");
        if (error) throw error;
        setAsesores(data);
      } catch (error) {
        console.error("Error fetching asesores:", error);
        setErrorMsg("Error al cargar asesores.");
      } finally {
        setLoading(false);
      }
    };

    fetchAsesores();
  }, []);

  const avisoTG = async (clienteId, asesorViejoId, asesorNuevoId) => {
    try {
      const response = await fetch(
        "https://n8n.automscc.com/webhook/reasigna-cierres",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cliente_id: clienteId,
            asesor_viejo_id: asesorViejoId,
            asesor_nuevo_id: asesorNuevoId,
          }),
        }
      );
      if (!response.ok) {
        throw new Error("Error al enviar avisoTG");
      }
    } catch (error) {
      console.error("Error en avisoTG:", error);
      setErrorMsg("Error al enviar aviso a Telegram.");
    }
  };

  const reasignar = async () => {
    if (!nuevoAsesor) {
      setErrorMsg("Selecciona un asesor.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const nuevoAsesorData = asesores.find((a) => a.ID === parseInt(nuevoAsesor));
      if (!nuevoAsesorData) throw new Error("Asesor no encontrado.");

      await supabase
        .from("GERSSON_CLIENTES")
        .update({
          ID_ASESOR: parseInt(nuevoAsesor),
          NOMBRE_ASESOR: nuevoAsesorData.NOMBRE,
        })
        .eq("ID", clienteId);

      const asesorViejoId = asesores.find((a) => a.NOMBRE === asesorActual)?.ID;
      await avisoTG(clienteId, asesorViejoId, parseInt(nuevoAsesor));

      alert("Cliente reasignado correctamente");
      setModalOpen(false);
    } catch (error) {
      console.error("Error reasignando cliente:", error);
      setErrorMsg("Error al reasignar cliente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={() => setModalOpen(true)}
        className="mt-2 sm:mt-0 inline-flex items-center px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Reasignar Cliente
      </button>

      {modalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-80">
            <h3 className="text-lg font-bold mb-2">Reasignar Cliente</h3>
            <p className="mb-4">
              Asesor actual: <strong>{asesorActual}</strong>
            </p>

            {errorMsg && <p className="text-red-500 mb-2">{errorMsg}</p>}

            <select
              className="border p-2 w-full my-2"
              value={nuevoAsesor}
              onChange={(e) => setNuevoAsesor(e.target.value)}
              disabled={loading}
            >
              <option value="">Selecciona un nuevo asesor</option>
              {asesores.map((asesor) => (
                <option key={asesor.ID} value={asesor.ID}>
                  {asesor.NOMBRE}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setModalOpen(false)}
                className="bg-gray-300 text-gray-700 px-3 py-1 rounded-md hover:bg-gray-400 transition"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={reasignar}
                className="bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600 transition"
                disabled={loading}
              >
                {loading ? "Cargando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReasignarCliente;