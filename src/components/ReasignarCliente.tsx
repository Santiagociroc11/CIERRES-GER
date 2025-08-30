import { useState, useEffect } from "react";
import { apiClient } from "../lib/apiClient";
import { Asesor } from "../types";

interface ReasignarClienteProps {
  clienteId: number;
  asesorActual: string;
  asesorActualId?: number;
  onReasignSuccess?: (clienteId: number, nuevoAsesorId: number) => void;
}

const ReasignarCliente = ({ clienteId, asesorActual, asesorActualId, onReasignSuccess }: ReasignarClienteProps) => {
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [nuevoAsesor, setNuevoAsesor] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modoReasignacion, setModoReasignacion] = useState<'manual' | 'automatico'>('manual');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const fetchAsesores = async () => {
      setLoading(true);
      setErrorMsg("");
      try {
        const data = await apiClient.request<Asesor[]>("/GERSSON_ASESORES?select=ID,NOMBRE", "GET");
        setAsesores(data);
      } catch (error: any) {
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
        "/api/reasigna-cierres",
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

  const reasignarAutomatico = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      // Obtener asesorViejoId
      const asesorViejoId = asesorActualId || asesores.find((a) => a.NOMBRE === asesorActual)?.ID;
      
      if (!asesorViejoId) {
        throw new Error("No se pudo determinar el ID del asesor actual");
      }

      const response = await fetch("/api/reasigna-automatico", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cliente_id: clienteId,
          asesor_viejo_id: asesorViejoId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al reasignar automáticamente");
      }

      const result = await response.json();
      
      alert(`Cliente reasignado automáticamente a: ${result.data.asesor_nuevo.nombre}`);
      setModalOpen(false);
      
      // Notificar al componente padre sobre el éxito de la reasignación
      if (onReasignSuccess) {
        onReasignSuccess(clienteId, result.data.asesor_nuevo.id);
      }
    } catch (error: any) {
      console.error("Error reasignando cliente automáticamente:", error);
      setErrorMsg(error.message || "Error al reasignar cliente automáticamente.");
    } finally {
      setLoading(false);
    }
  };

  const confirmarReasignacion = async () => {
    if (modoReasignacion === 'automatico') {
      await reasignarAutomatico();
    } else {
      await reasignarManual();
    }
  };

  const reasignarManual = async () => {
    if (!nuevoAsesor) {
      setErrorMsg("Selecciona un asesor.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const nuevoAsesorData = asesores.find((a) => a.ID === parseInt(nuevoAsesor));
      if (!nuevoAsesorData) throw new Error("Asesor no encontrado.");
    
      await apiClient.request(
        `/GERSSON_CLIENTES?ID=eq.${clienteId}`,
        "PATCH",
        {
          ID_ASESOR: parseInt(nuevoAsesor),
          NOMBRE_ASESOR: nuevoAsesorData.NOMBRE,
        }
      );
    
      const asesorViejoId = asesorActualId || asesores.find((a) => a.NOMBRE === asesorActual)?.ID;
      await avisoTG(clienteId, asesorViejoId, parseInt(nuevoAsesor));
    
      alert("Cliente reasignado correctamente");
      setModalOpen(false);
      
      // Notificar al componente padre sobre el éxito de la reasignación
      if (onReasignSuccess) {
        onReasignSuccess(clienteId, parseInt(nuevoAsesor));
      }
    } catch (error: any) {
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
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h3 className="text-lg font-bold mb-2">Reasignar Cliente</h3>
            <p className="mb-4">
              Asesor actual: <strong>{asesorActual}</strong>
            </p>

            {errorMsg && <p className="text-red-500 mb-2">{errorMsg}</p>}

            {/* Selector de modo */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Tipo de reasignación:</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="modoReasignacion"
                    value="manual"
                    checked={modoReasignacion === 'manual'}
                    onChange={(e) => setModoReasignacion(e.target.value as 'manual' | 'automatico')}
                    className="mr-2"
                  />
                  Manual
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="modoReasignacion"
                    value="automatico"
                    checked={modoReasignacion === 'automatico'}
                    onChange={(e) => setModoReasignacion(e.target.value as 'manual' | 'automatico')}
                    className="mr-2"
                  />
                  Automático
                </label>
              </div>
            </div>

            {/* Mostrar selector de asesor solo en modo manual */}
            {modoReasignacion === 'manual' && (
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
            )}

            {/* Mostrar descripción en modo automático */}
            {modoReasignacion === 'automatico' && (
              <div className="bg-green-50 border border-green-200 p-3 rounded mb-2">
                <p className="text-sm text-green-700">
                  El sistema asignará automáticamente al próximo asesor disponible según la lógica de ponderación.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setModalOpen(false)}
                className="bg-gray-300 text-gray-700 px-3 py-1 rounded-md hover:bg-gray-400 transition"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarReasignacion}
                className={`px-3 py-1 rounded-md transition text-white ${
                  modoReasignacion === 'automatico' 
                    ? 'bg-green-500 hover:bg-green-600' 
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
                disabled={loading}
              >
                {loading ? "Procesando..." : `Confirmar ${modoReasignacion === 'automatico' ? 'Automático' : 'Manual'}`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ReasignarCliente;