import React, { useState } from 'react';
import { Cliente, Reporte, Asesor } from '../types';
import { X, Upload, FileVideo, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { uploadToMinio } from '../lib/minio';

interface ConsolidarVentaProps {
  cliente: Cliente;
  asesor: Asesor;
  reporte: Reporte;
  onComplete: () => void;
  onClose: () => void;
}

export default function ConsolidarVenta({
  cliente,
  asesor,
  reporte,
  onComplete,
  onClose
}: ConsolidarVentaProps) {
  const [imagenInicio, setImagenInicio] = useState<File | null>(null);
  const [imagenFin, setImagenFin] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewInicio, setPreviewInicio] = useState<string | null>(null);
  const [previewFin, setPreviewFin] = useState<string | null>(null);

  const handleImageChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setImage: (file: File | null) => void,
    setPreview: (url: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Por favor, selecciona un archivo de imagen válido.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('La imagen no debe superar los 5MB.');
        return;
      }

      setImage(file);
      setError('');

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        setError('Por favor, selecciona un archivo de video válido.');
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        setError('El video no debe superar los 50MB.');
        return;
      }

      setVideo(file);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!imagenInicio || !imagenFin || !video) {
      setError('Por favor, sube todos los archivos requeridos.');
      setLoading(false);
      return;
    }

    try {
      // Subir archivos a MinIO
      const imagenInicioUrl = await uploadToMinio(imagenInicio, 'consolidaciones');
      const imagenFinUrl = await uploadToMinio(imagenFin, 'consolidaciones');
      const videoUrl = await uploadToMinio(video, 'consolidaciones');

      // Actualizar el reporte
      await apiClient.request(
        `/GERSSON_REPORTES?ID=eq.${reporte.ID}`,
        'PATCH',
        {
          CONSOLIDADO: true,
          IMAGEN_INICIO_CONVERSACION: imagenInicioUrl,
          IMAGEN_FIN_CONVERSACION: imagenFinUrl,
          VIDEO_CONVERSACION: videoUrl
        }
      );

      // Actualizar el estado del cliente a "VENTA CONSOLIDADA"
      await apiClient.request(
        `/GERSSON_CLIENTES?ID=eq.${cliente.ID}`,
        'PATCH',
        {
          ESTADO: 'VENTA CONSOLIDADA'
        }
      );

      onComplete();
    } catch (error: any) {
      console.error('Error al consolidar venta:', error);
      setError(error.message || 'Error al consolidar la venta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <FileVideo className="h-6 w-6 text-purple-500 mr-2" />
            <h3 className="text-lg font-medium">Consolidar Venta</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Imagen de inicio de conversación */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Captura del inicio de la conversación
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                {previewInicio ? (
                  <div className="relative">
                    <img
                      src={previewInicio}
                      alt="Preview inicio"
                      className="mx-auto h-32 w-auto object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImagenInicio(null);
                        setPreviewInicio(null);
                      }}
                      className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label className="relative cursor-pointer bg-white rounded-md font-medium text-purple-600 hover:text-purple-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus:ring-purple-500">
                        <span>Subir captura inicial</span>
                        <input
                          type="file"
                          className="sr-only"
                          accept="image/*"
                          onChange={(e) => handleImageChange(e, setImagenInicio, setPreviewInicio)}
                          required
                        />
                      </label>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Imagen de fin de conversación */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Captura del fin de la conversación
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                {previewFin ? (
                  <div className="relative">
                    <img
                      src={previewFin}
                      alt="Preview fin"
                      className="mx-auto h-32 w-auto object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImagenFin(null);
                        setPreviewFin(null);
                      }}
                      className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label className="relative cursor-pointer bg-white rounded-md font-medium text-purple-600 hover:text-purple-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus:ring-purple-500">
                        <span>Subir captura final</span>
                        <input
                          type="file"
                          className="sr-only"
                          accept="image/*"
                          onChange={(e) => handleImageChange(e, setImagenFin, setPreviewFin)}
                          required
                        />
                      </label>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Video de la conversación */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Video de la conversación
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                {video ? (
                  <div className="flex items-center justify-center space-x-2">
                    <FileVideo className="h-12 w-12 text-purple-500" />
                    <span className="text-sm text-gray-600">{video.name}</span>
                    <button
                      type="button"
                      onClick={() => setVideo(null)}
                      className="text-red-500 hover:text-red-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <FileVideo className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label className="relative cursor-pointer bg-white rounded-md font-medium text-purple-600 hover:text-purple-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus:ring-purple-500">
                        <span>Subir video</span>
                        <input
                          type="file"
                          className="sr-only"
                          accept="video/*"
                          onChange={handleVideoChange}
                          required
                        />
                      </label>
                    </div>
                    <p className="text-xs text-gray-500">MP4, WebM hasta 50MB</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? (
              <span className="flex items-center">
                <Upload className="animate-spin h-5 w-5 mr-2" />
                Consolidando...
              </span>
            ) : (
              'Consolidar Venta'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}