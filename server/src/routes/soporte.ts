import { Router } from 'express';
import winston from 'winston';
import { 
  getClienteByWhatsapp, 
  createCliente, 
  updateCliente,
  getNextAsesorPonderado, 
  getAsesorById, 
  updateAsesorCounter, 
  insertRegistro,
  insertWebhookLog,
  updateWebhookLog,
  getWebhookLogById,
  type WebhookLogEntry
} from '../dbClient';
import { sendTelegramMessage } from '../services/telegramService';
import telegramQueue from '../services/telegramQueueService';
import { getSoporteConfig, updateSoporteConfig } from '../config/webhookConfig';

const router = Router();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Función para limpiar número de WhatsApp
function limpiarNumeroWhatsapp(numero: string): string {
  // Remover el símbolo + y cualquier espacio
  return numero.replace(/^\+/, '').replace(/\s/g, '');
}

// Función para segmentar clientes según CRM
function segmentarCliente(haComprado: boolean, mainDoubt: string | null): {
  tipo: 'VIP_POST_VENTA' | 'PROSPECTO_CALIENTE' | 'PROSPECTO_FRIO';
  prioridad: 'ALTA' | 'MEDIA' | 'BAJA';
  emoji: string;
  descripcion: string;
} {
  if (haComprado) {
    return {
      tipo: 'VIP_POST_VENTA',
      prioridad: 'ALTA',
      emoji: '🔥',
      descripcion: 'Cliente VIP - Post-venta'
    };
  }

  // Para no compradores, segmentar según tipo de duda
  switch (mainDoubt) {
    case 'tecnico':
      return {
        tipo: 'PROSPECTO_CALIENTE',
        prioridad: 'ALTA', // Técnico es alta porque puede ser venta perdida
        emoji: '⚠️',
        descripcion: 'URGENTE - Venta Fallida (Problema Técnico)'
      };
    
    case 'precio':
      return {
        tipo: 'PROSPECTO_CALIENTE',
        prioridad: 'MEDIA',
        emoji: '💰',
        descripcion: 'Lead Caliente - Objeción de Precio'
      };
    
    case 'adecuacion':
      return {
        tipo: 'PROSPECTO_CALIENTE',
        prioridad: 'MEDIA',
        emoji: '🎯',
        descripcion: 'Lead Caliente - Evaluando Compra'
      };
    
    case 'contenido':
      return {
        tipo: 'PROSPECTO_CALIENTE',
        prioridad: 'MEDIA',
        emoji: '📚',
        descripcion: 'Lead Caliente - Duda sobre Producto'
      };
    
    case 'otra':
    default:
      return {
        tipo: 'PROSPECTO_FRIO',
        prioridad: 'BAJA',
        emoji: '❄️',
        descripcion: 'Prospecto Frío - Consulta General'
      };
  }
}

// Función para crear mensaje de notificación al asesor
function createSoporteNotificationMessage(
  clienteName: string,
  clientePhone: string,
  asesorTelegramId: string,
  segmentacion: {
    tipo: string;
    prioridad: string;
    emoji: string;
    descripcion: string;
  },
  mainDoubt: string | null = null,
  crmLabel: string | null = null
): any {
  // Crear header según prioridad
  let headerEmoji = '';
  let urgencyText = '';
  
  switch (segmentacion.prioridad) {
    case 'ALTA':
      headerEmoji = '🚨🔥🚨';
      urgencyText = '*PRIORIDAD ALTA*';
      break;
    case 'MEDIA':
      headerEmoji = '⚡💡⚡';
      urgencyText = '*OPORTUNIDAD DE VENTA*';
      break;
    case 'BAJA':
    default:
      headerEmoji = '💬';
      urgencyText = '*CONSULTA GENERAL*';
      break;
  }

  // Mapear dudas para el mensaje
  const doubtLabels = {
    'precio': '💰 Objeción de Precio - Listo para cerrar',
    'adecuacion': '🎯 Evaluando si comprar - Calentar lead',
    'contenido': '📚 Duda sobre el producto - Educar beneficios', 
    'tecnico': '🔧 ¡PROBLEMA TÉCNICO! - Venta fallida, rescatar YA',
    'otra': '❓ Consulta general'
  };

  let doubtInfo = '';
  if (mainDoubt && doubtLabels[mainDoubt as keyof typeof doubtLabels]) {
    doubtInfo = `\n🎯 *Tipo de Consulta:*\n${doubtLabels[mainDoubt as keyof typeof doubtLabels]}\n`;
  }

  const messageText = `${headerEmoji} *CLIENTE INGRESÓ SUS DATOS EN LINK DE SOPORTE* ${headerEmoji}

${segmentacion.emoji} *${urgencyText}*
${segmentacion.descripcion}

👤 *Cliente:* ${clienteName}
📱 *WhatsApp:* ${clientePhone}
${crmLabel ? `🏷️ *Etiqueta CRM:* \`${crmLabel}\`` : ''}
${doubtInfo}
⏰ *Recibido:* ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}

💬 *Te debe llegar directamente a tu WhatsApp, si no llega, escríbele* 👇🏻

${segmentacion.prioridad === 'ALTA' ? '⚠️ *ACCIÓN INMEDIATA REQUERIDA* ⚠️' : ''}
${segmentacion.tipo === 'PROSPECTO_CALIENTE' ? '💡 *OPORTUNIDAD DE CIERRE* - Lead caliente esperando' : ''}`;

  // Botones dinámicos según el tipo de cliente
  const buttons = [
    [
      {
        text: segmentacion.prioridad === 'ALTA' ? "🚨 IR AL CHAT URGENTE" : "💬 IR AL CHAT",
        url: `https://wa.me/${clientePhone}`
      }
    ],
    [
      {
        text: "📊 REPORTAR EN SISTEMA", 
        url: "https://sistema-cierres-ger.automscc.com/"
      }
    ]
  ];

  return {
    chat_id: asesorTelegramId,
    text: messageText,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: buttons
    }
  };
}

// Endpoint GET que genera la página HTML de soporte
router.get('/', async (_req, res) => {
  try {
    // Obtener configuración de soporte
    let config = null;
    try {
      config = await getSoporteConfig();
    } catch (error) {
      logger.warn('No se pudo obtener configuración de soporte, usando valores por defecto:', error);
    }

    // Valores por defecto o desde configuración
    const pageTitle = config?.pageConfig?.title || 'SOPORTE GERSSON LOPEZ';
    const pageSubtitle = config?.pageConfig?.subtitle || 'Antes de ingresar al chat con el asesor, proporciona estos datos para que te podamos atender rápidamente.';
    const primaryColor = config?.pageConfig?.primaryColor || '#007AFF';
    const endpointUrl = '/api/soporte/formulario-soporte';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/css/intlTelInput.min.css">

    <style>
        * {
            box-sizing: border-box;
        }
        
        body {
            background: linear-gradient(135deg, #667eea 0%, ${primaryColor} 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 1.5rem;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            margin: 0;
        }
        
        .form-container {
            background: white;
            padding: 2.5rem;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
            width: 100%;
            max-width: 420px;
            text-align: center;
            max-height: 90vh;
            overflow-y: auto;
            position: relative;
        }
        
        .form-container::-webkit-scrollbar {
            width: 4px;
        }
        
        .form-container::-webkit-scrollbar-track {
            background: transparent;
        }
        
        .form-container::-webkit-scrollbar-thumb {
            background: #e0e0e0;
            border-radius: 2px;
        }
        
        .form-container::-webkit-scrollbar-thumb:hover {
            background: #bdbdbd;
        }
        
        .form-container h2 {
            font-size: 1.75rem;
            font-weight: 600;
            color: #1a1a1a;
            margin: 0 0 0.5rem 0;
            letter-spacing: -0.5px;
        }
        
        .form-container > p {
            color: #6b7280;
            font-size: 0.95rem;
            margin: 0 0 2rem 0;
            line-height: 1.5;
        }
        
        .input-group {
            margin-bottom: 1.5rem;
            text-align: left;
        }
        
        input[type="text"],
        input[type="tel"] {
            width: 100%;
            padding: 0.875rem 1rem;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            font-size: 0.95rem;
            transition: all 0.2s ease;
            background: #fafafa;
            color: #1a1a1a;
        }
        
        input[type="text"]:focus,
        input[type="tel"]:focus {
            outline: none;
            border-color: ${primaryColor};
            background: white;
            box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
        }
        
        .error-message {
            color: #ef4444;
            font-size: 0.875rem;
            display: none;
            margin-top: 0.5rem;
        }
        
        .spinner {
            display: inline-block;
            height: 1.25rem;
            width: 1.25rem;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 0.8s linear infinite;
            margin-right: 0.5rem;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        button {
            width: 100%;
            background: ${primaryColor} !important;
            color: white !important;
            padding: 1rem 1.5rem;
            border: none !important;
            border-radius: 12px;
            font-size: 1rem;
            font-weight: 600;
            transition: all 0.2s ease;
            margin-top: 1rem;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            box-shadow: 0 4px 12px ${primaryColor}40;
            min-height: 48px;
        }
        
        button:hover {
            background: ${primaryColor} !important;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px ${primaryColor}60;
        }
        
        button:active {
            transform: translateY(0);
        }
        
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none !important;
        }
        
        .hidden {
            display: none;
        }
        
        .course-status-label {
            display: block;
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 0.75rem;
            font-size: 0.95rem;
        }
        
        .course-status-label::after {
            content: ' *';
            color: #ef4444;
        }
        
        .course-status-options {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }
        
        .course-status-option {
            display: flex;
            align-items: center;
            padding: 1rem;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            background: #fafafa;
        }
        
        .course-status-option:hover {
            border-color: ${primaryColor};
            background: #f0f7ff;
            transform: translateY(-1px);
        }
        
        .course-status-option.selected {
            border-color: ${primaryColor};
            background: linear-gradient(135deg, rgba(0, 122, 255, 0.1) 0%, rgba(0, 122, 255, 0.05) 100%);
        }
        
        .status-icon {
            font-size: 1.25rem;
            margin-right: 0.875rem;
        }
        
        .status-text {
            font-weight: 500;
            color: #1a1a1a;
            font-size: 0.95rem;
            flex: 1;
        }
        
        .course-status-checkbox {
            width: 20px;
            height: 20px;
            border: 2px solid #d1d5db;
            border-radius: 6px;
            margin-left: auto;
            transition: all 0.2s ease;
            position: relative;
            background: white;
        }
        
        .course-status-option.selected .course-status-checkbox {
            border-color: ${primaryColor};
            background: ${primaryColor};
        }
        
        .course-status-option.selected .course-status-checkbox::after {
            content: '✓';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 14px;
            font-weight: bold;
        }
        
        .doubt-label {
            display: block;
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 0.75rem;
            font-size: 0.95rem;
        }
        
        .doubt-label::after {
            content: ' *';
            color: #ef4444;
        }
        
        .doubt-options {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }
        
        .doubt-option {
            display: flex;
            align-items: flex-start;
            padding: 1rem;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            background: #fafafa;
            animation: slideInUp 0.3s ease forwards;
            opacity: 0;
        }
        
        .doubt-option:nth-child(1) { animation-delay: 0.05s; }
        .doubt-option:nth-child(2) { animation-delay: 0.1s; }
        .doubt-option:nth-child(3) { animation-delay: 0.15s; }
        .doubt-option:nth-child(4) { animation-delay: 0.2s; }
        .doubt-option:nth-child(5) { animation-delay: 0.25s; }
        
        @keyframes slideInUp {
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .doubt-option:hover {
            border-color: ${primaryColor};
            background: #f0f7ff;
            transform: translateY(-1px);
        }
        
        .doubt-option.selected {
            border-color: ${primaryColor};
            background: linear-gradient(135deg, rgba(0, 122, 255, 0.1) 0%, rgba(0, 122, 255, 0.05) 100%);
        }
        
        .doubt-icon {
            font-size: 1.5rem;
            margin-right: 0.875rem;
            flex-shrink: 0;
            margin-top: 0.125rem;
        }
        
        .doubt-content {
            flex: 1;
            text-align: left;
        }
        
        .doubt-content h4 {
            margin: 0 0 0.375rem 0;
            font-weight: 600;
            color: #1a1a1a;
            font-size: 0.95rem;
        }
        
        .doubt-content p {
            margin: 0;
            color: #6b7280;
            font-size: 0.875rem;
            line-height: 1.5;
        }
        
        .doubt-checkbox {
            width: 20px;
            height: 20px;
            border: 2px solid #d1d5db;
            border-radius: 6px;
            margin-left: 0.75rem;
            flex-shrink: 0;
            transition: all 0.2s ease;
            position: relative;
            background: white;
            margin-top: 0.125rem;
        }
        
        .doubt-option.selected .doubt-checkbox {
            border-color: ${primaryColor};
            background: ${primaryColor};
        }
        
        .doubt-option.selected .doubt-checkbox::after {
            content: '✓';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 14px;
            font-weight: bold;
        }
        
        @media (max-width: 480px) {
            .form-container {
                padding: 1.5rem;
                border-radius: 16px;
            }
            
            .form-container h2 {
                font-size: 1.5rem;
            }
        }
    </style>
</head>
<body>
    <div class="form-container">
        <h2>${pageTitle}</h2>
        <p>${pageSubtitle}</p>
        <form id="supportForm">
            <div class="input-group">
                <input type="text" id="name" placeholder="TU NOMBRE COMPLETO" required>
                <p class="error-message" id="nameError">Por favor, ingresa tu nombre.</p>
            </div>
            <div class="input-group">
                <input type="tel" id="whatsapp" placeholder="TU WHASTAPP" required>
                <p class="error-message" id="whatsappError">Número de WhatsApp inválido.</p>
            </div>
            <div class="input-group">
                <label class="course-status-label">¿YA COMPRASTE EL CURSO?</label>
                <div class="course-status-options">
                    <div class="course-status-option" data-value="si">
                        <div class="status-icon">✅</div>
                        <div class="status-text">Sí, ya compré el curso</div>
                        <div class="course-status-checkbox"></div>
                    </div>
                    <div class="course-status-option" data-value="no">
                        <div class="status-icon">❌</div>
                        <div class="status-text">No, aún no he comprado</div>
                        <div class="course-status-checkbox"></div>
                    </div>
                </div>
                <input type="hidden" id="courseStatus" required>
                <p class="error-message" id="courseStatusError">Selecciona una opción.</p>
            </div>
            
            <!-- Campo condicional para usuarios "No Compradores" -->
            <div class="input-group hidden" id="doubtField">
                <label class="doubt-label">CUÉNTANOS, ¿CUÁL ES TU DUDA PRINCIPAL?</label>
                <div class="doubt-options">
                    <div class="doubt-option" data-value="precio">
                        <div class="doubt-icon">💰</div>
                        <div class="doubt-content">
                            <h4>Quiero saber más sobre el precio</h4>
                            <p>Me interesa pero necesito entender mejor los costos y formas de pago</p>
                        </div>
                        <div class="doubt-checkbox"></div>
                    </div>
                    
                    <div class="doubt-option" data-value="adecuacion">
                        <div class="doubt-icon">🎯</div>
                        <div class="doubt-content">
                            <h4>¿Realmente me servirá?</h4>
                            <p>Quiero estar seguro de que este curso es lo que necesito para mi situación</p>
                        </div>
                        <div class="doubt-checkbox"></div>
                    </div>
                    
                    <div class="doubt-option" data-value="contenido">
                        <div class="doubt-icon">📚</div>
                        <div class="doubt-content">
                            <h4>¿Qué incluye exactamente?</h4>
                            <p>Necesito más detalles sobre qué aprenderé y cómo está organizado</p>
                        </div>
                        <div class="doubt-checkbox"></div>
                    </div>
                    
                    <div class="doubt-option" data-value="tecnico">
                        <div class="doubt-icon">🔧</div>
                        <div class="doubt-content">
                            <h4>Tengo un problema al pagar</h4>
                            <p>Quiero comprar pero algo no funciona, necesito ayuda urgente</p>
                        </div>
                        <div class="doubt-checkbox"></div>
                    </div>
                    
                    <div class="doubt-option" data-value="otra">
                        <div class="doubt-icon">❓</div>
                        <div class="doubt-content">
                            <h4>Otra cosa que me preocupa</h4>
                            <p>Tengo otra duda o inquietud que quiero resolver</p>
                        </div>
                        <div class="doubt-checkbox"></div>
                    </div>
                </div>
                <input type="hidden" id="mainDoubt" required>
                <p class="error-message" id="doubtError">Por favor, selecciona tu duda principal.</p>
            </div>
            
            
            <button type="submit" id="submitButton" style="background: ${primaryColor}; color: white;">
                <div id="spinner" class="spinner hidden"></div>
                <span id="buttonText">IR A SOPORTE</span>
            </button>
        </form>
        <div class="scroll-indicator"></div>
    </div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/intlTelInput.min.js"></script>
    <script>
    const CONFIG = {
        tokens: ["c7ff5b3c8eb6c3", "5fdbd1d4249fe3", "4e9bbfeb1e2938"],
        defaultCountry: "co",
        endpointUrl: "${endpointUrl}",
        intlTelInputUtilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js"
    };

    // --- Inicialización de Teléfono Internacional ---
    const input = document.querySelector("#whatsapp");
    const inputContainer = input.closest('.input-group') || input.parentElement;
    
    const iti = window.intlTelInput(input, {
        initialCountry: "auto",
        separateDialCode: true,
        preferredCountries: ["co", "us", "mx", "ar", "cl", "pe", "es"],
        allowDropdown: true,
        dropdownContainer: inputContainer,
        autoHideDialCode: false,
        nationalMode: false,
        geoIpLookup: async (success, failure) => {
            for (let token of CONFIG.tokens) {
                try {
                    const res = await fetch(\`https://ipinfo.io/json?token=\${token}\`);
                    if (res.status === 429) continue;
                    if (!res.ok) throw new Error(\`Error \${res.status}\`);
                    const data = await res.json();
                    if (data?.country) return success(data.country);
                } catch (err) {}
            }
            success(CONFIG.defaultCountry);
        },
        utilsScript: CONFIG.intlTelInputUtilsScript
    });
    
    // Agregar estilos personalizados para el dropdown con búsqueda y scroll móvil
    const style = document.createElement('style');
    style.textContent = \`
        .iti {
            width: 100% !important;
        }
        .iti__selected-flag {
            z-index: 1 !important;
        }
        .iti__country-list {
            max-height: 50vh !important;
            max-width: 100% !important;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15) !important;
            border-radius: 12px !important;
            border: none !important;
            margin-top: 4px !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            -webkit-overflow-scrolling: touch !important;
            position: absolute !important;
            z-index: 9999 !important;
            background: white !important;
            width: 100% !important;
            left: 0 !important;
            right: 0 !important;
            box-sizing: border-box !important;
        }
        .iti__search-box {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            padding: 0.875rem 1rem !important;
            border: none !important;
            border-bottom: 2px solid #e5e7eb !important;
            font-size: 0.95rem !important;
            width: 100% !important;
            box-sizing: border-box !important;
            background: white !important;
            position: sticky !important;
            top: 0 !important;
            z-index: 10 !important;
            margin: 0 !important;
        }
        .iti__search-box:focus {
            outline: none !important;
            border-bottom-color: ${primaryColor} !important;
        }
        .iti__search-box::placeholder {
            color: #9ca3af !important;
        }
        .iti__country-list::-webkit-scrollbar {
            width: 6px !important;
        }
        .iti__country-list::-webkit-scrollbar-track {
            background: #f1f1f1 !important;
            border-radius: 3px !important;
        }
        .iti__country-list::-webkit-scrollbar-thumb {
            background: #c1c1c1 !important;
            border-radius: 3px !important;
        }
        .iti__country-list::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8 !important;
        }
        .iti__country {
            padding: 0.75rem 1rem !important;
            font-size: 0.9rem !important;
            cursor: pointer !important;
            -webkit-tap-highlight-color: transparent !important;
            white-space: nowrap !important;
        }
        .iti__country:hover,
        .iti__country.iti__highlight {
            background-color: #f0f7ff !important;
        }
        .iti__country-name {
            color: #1a1a1a !important;
        }
        .iti__dial-code {
            color: #6b7280 !important;
        }
        .iti__no-results {
            padding: 0.75rem 1rem !important;
            color: #6b7280 !important;
        }
        @media (max-width: 768px) {
            .iti__country-list {
                max-height: 60vh !important;
                width: 80% !important;
                left: 50% !important;
                transform: translateX(-50%) !important;
                border-radius: 12px !important;
                position: fixed !important;
                bottom: 10% !important;
                top: auto !important;
                margin: 0 !important;
            }
            .iti__search-box {
                border-radius: 12px 12px 0 0 !important;
            }
        }
    \`;
    document.head.appendChild(style);
    
    // Forzar que el buscador aparezca (intl-tel-input lo agrega automáticamente, pero lo aseguramos)
    setTimeout(() => {
        const searchBox = document.querySelector('.iti__search-box');
        if (!searchBox) {
            // Si no existe, intl-tel-input debería crearlo automáticamente
            // Pero forzamos su visibilidad si existe
            console.log('Buscador de países disponible');
        }
    }, 100);

    // --- Un solo listener para todo el código del formulario ---
    document.addEventListener("DOMContentLoaded", function() {
        const form = document.querySelector("#supportForm");
        const submitButton = document.querySelector("#submitButton");
        const spinner = document.querySelector("#spinner");
        const buttonText = document.querySelector("#buttonText");
        const formContainer = document.querySelector(".form-container");

        // --- Lógica del Indicador de Scroll (CORREGIDA) ---
        formContainer.addEventListener("scroll", () => {
            // Revisa si el scroll está cerca del final
            const isAtBottom = formContainer.scrollHeight - formContainer.scrollTop <= formContainer.clientHeight + 2;
            if (formContainer.scrollHeight > formContainer.clientHeight && !isAtBottom) {
                formContainer.classList.add("has-scroll");
            } else {
                formContainer.classList.remove("has-scroll");
            }
        });

        // --- Lógica para las opciones de ESTADO DEL CURSO ---
        const courseStatusOptions = document.querySelectorAll(".course-status-option");
        const courseStatusInput = document.querySelector("#courseStatus");
        const doubtField = document.querySelector("#doubtField");
        const mainDoubtInput = document.querySelector("#mainDoubt");

        courseStatusOptions.forEach(option => {
            option.addEventListener("click", function() {
                courseStatusOptions.forEach(opt => opt.classList.remove("selected"));
                this.classList.add("selected");
                courseStatusInput.value = this.dataset.value;
                document.querySelector("#courseStatusError").style.display = "none";

                if (this.dataset.value === "no") {
                    doubtField.classList.remove("hidden");
                    mainDoubtInput.required = true;
                    setTimeout(() => {
                        if (formContainer.scrollHeight > formContainer.clientHeight) {
                            formContainer.classList.add("has-scroll");
                        }
                        doubtField.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 500);
                } else {
                    doubtField.classList.add("hidden");
                    mainDoubtInput.required = false;
                    mainDoubtInput.value = "";
                    document.querySelectorAll(".doubt-option").forEach(opt => opt.classList.remove("selected"));
                    if (formContainer.scrollHeight <= formContainer.clientHeight) {
                        formContainer.classList.remove("has-scroll");
                    }
                }
            });
        });

        // --- Lógica para las opciones de DUDA ---
        const doubtOptions = document.querySelectorAll(".doubt-option");
        doubtOptions.forEach(option => {
            option.addEventListener("click", function() {
                doubtOptions.forEach(opt => opt.classList.remove("selected"));
                this.classList.add("selected");
                mainDoubtInput.value = this.dataset.value;
                document.querySelector("#doubtError").style.display = "none";
            });
        });

        // --- Lógica para el envío del FORMULARIO ---
        form.addEventListener("submit", async function(event) {
            event.preventDefault();
            document.querySelectorAll(".error-message").forEach(e => e.style.display = "none");

            let valid = true;

            if (!document.querySelector("#name").value.trim()) {
                document.querySelector("#nameError").style.display = "block";
                valid = false;
            }
            if (!courseStatusInput.value) {
                document.querySelector("#courseStatusError").style.display = "block";
                valid = false;
            }
            if (mainDoubtInput.required && !mainDoubtInput.value) {
                document.querySelector("#doubtError").style.display = "block";
                valid = false;
            }
            if (!iti.isValidNumber()) {
                document.querySelector("#whatsappError").style.display = "block";
                valid = false;
            }

            if (!valid) return;

            spinner.classList.remove("hidden");
            buttonText.textContent = "Enviando...";
            submitButton.disabled = true;

            const formData = {
                name: document.querySelector("#name").value,
                courseStatus: courseStatusInput.value,
                whatsapp: iti.getNumber()
            };

            if (formData.courseStatus === "no") {
                formData.mainDoubt = mainDoubtInput.value;
                const doubtLabels = {
                    'precio': '[Objeción Precio]',
                    'adecuacion': '[Lead Cualificación]',
                    'contenido': '[Duda Producto]',
                    'tecnico': '[URGENTE - Venta Fallida]',
                    'otra': '[Consulta General]'
                };
                formData.crmLabel = doubtLabels[formData.mainDoubt] || '[Consulta General]';
            }

            try {
                const response = await fetch(CONFIG.endpointUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData)
                });
                
                if (!response.ok) {
                    throw new Error(\`Error HTTP: \${response.status}\`);
                }
                
                const result = await response.json();
                console.log(result);

                if (result.success && result.url) {
                    window.location.href = result.url;
                } else {
                    throw new Error(result.error || "No se recibió una URL de redirección.");
                }
            } catch (error) {
                console.error("Error al enviar el formulario:", error);
                alert("Hubo un error al enviar tu solicitud. Inténtalo de nuevo.");
                spinner.classList.add("hidden");
                buttonText.textContent = "IR A SOPORTE";
                submitButton.disabled = false;
            }
        });
    });
</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    logger.error('Error generando página de soporte:', error);
    res.status(500).send(`
      <html>
        <body>
          <h1>Error al cargar la página de soporte</h1>
          <p>Por favor, intenta más tarde.</p>
        </body>
      </html>
    `);
  }
});

// Endpoint principal para formularios de soporte
router.post('/formulario-soporte', async (req, res) => {
  const startTime = Date.now();
  let webhookLogId: number | null = null;
  
  try {
    const { body } = req;
    
    logger.info('Formulario de soporte recibido', {
      body,
      timestamp: new Date().toISOString()
    });

    // Validar estructura del formulario
    if (!body || !body.name || !body.whatsapp) {
      return res.status(400).json({
        success: false,
        error: 'Datos de formulario inválidos. Se requiere name y whatsapp',
        timestamp: new Date().toISOString()
      });
    }

    // Extraer y limpiar datos
    const nombre = body.name;
    const whatsappOriginal = body.whatsapp;
    const haComprado = body.courseStatus === 'si';
    const whatsappLimpio = limpiarNumeroWhatsapp(whatsappOriginal);
    
    // Nuevos campos del formulario mejorado
    const mainDoubt = body.mainDoubt || null; // Solo para no compradores
    const doubtType = body.doubtType || null;
    const crmLabel = body.crmLabel || null;

    // Segmentar cliente según CRM
    const segmentacion = segmentarCliente(haComprado, mainDoubt);

    logger.info('Datos procesados del formulario', {
      nombre,
      whatsappOriginal,
      whatsappLimpio,
      haComprado,
      mainDoubt,
      crmLabel,
      segmentacion,
      timestamp: new Date().toISOString()
    });

    // Crear entrada inicial en webhook logs
    const initialLogEntry: WebhookLogEntry = {
      event_type: 'SUPPORT_FORM',
      flujo: segmentacion.tipo, // Usar el tipo de segmentación como flujo
      status: 'received',
      buyer_name: nombre,
      buyer_phone: whatsappLimpio,
      raw_webhook_data: {
        ...body,
        source: 'support_form',
        haComprado: haComprado,
        segmentacion: segmentacion,
        mainDoubt: mainDoubt,
        crmLabel: crmLabel
      },
      received_at: new Date()
    };

    try {
      const logResult = await insertWebhookLog(initialLogEntry);
      webhookLogId = logResult[0]?.id || null;
      logger.info(`Support webhook log creado con ID: ${webhookLogId}`);
    } catch (logError) {
      logger.error('Error creando support webhook log:', logError);
      // Continuar procesamiento aunque falle el logging
    }

    // Actualizar status a processing
    if (webhookLogId) {
      try {
        await updateWebhookLog({
          id: webhookLogId,
          status: 'processing'
        });
      } catch (updateError) {
        logger.error('Error actualizando support webhook log a processing:', updateError);
        // Continuar procesamiento aunque falle la actualización del log
      }
    }

    // 1. Buscar cliente existente (usando getClienteByWhatsapp que maneja la lógica internamente)
    let clienteExistente = await getClienteByWhatsapp(whatsappLimpio);
    
    // Si no encuentra por WhatsApp, log para debugging
    if (!clienteExistente && nombre) {
      logger.info('Cliente no encontrado por WhatsApp en soporte', {
        nombre,
        whatsappCompleto: whatsappLimpio
      });
    }
    
    const currentTimestamp = Math.floor(Date.now() / 1000);
    let clienteId: number;
    let asesorAsignado = null;
    let shouldRedirectToAcademy = false;
    
    // Si dice que ya compró (VIP_POST_VENTA) pero no está en BD, dirigir a academia
    if (segmentacion.tipo === 'VIP_POST_VENTA' && !clienteExistente) {
      shouldRedirectToAcademy = true;
      logger.warn('🚨 VIP_POST_VENTA sin registro en BD - Redirigir a academia', {
        nombre,
        whatsapp: whatsappLimpio,
        reason: 'client_claims_purchased_but_not_in_db'
      });
    }

    // IMPORTANTE: asesorAsignado se maneja dentro de cada bloque según shouldRedirectToAcademy

    // Variables para tracking de resultados de integraciones
    let telegramStatus: 'success' | 'error' | 'skipped' | 'queued' = 'skipped';
    let telegramChatId = '';
    let telegramMessageId = '';
    let telegramError = '';

    if (clienteExistente) {
      logger.info('Cliente existente encontrado', { clienteId: clienteExistente.ID });
      clienteId = clienteExistente.ID;

      // Verificar si ya compró (como en el flujo N8N)
      if (clienteExistente.ESTADO === 'PAGADO' || clienteExistente.ESTADO === 'VENTA CONSOLIDADA') {
        shouldRedirectToAcademy = true;
        
        // Logging detallado para compradores
        logger.warn('🛍️ COMPRADOR DETECTADO - Redirigir a academia', {
          clienteId,
          nombre: nombre,
          whatsapp: whatsappLimpio,
          estado: clienteExistente.ESTADO,
          asesorAsignado: clienteExistente.NOMBRE_ASESOR || 'Sin asesor',
          fechaCreacion: 'unknown',
          segmentacion: {
            tipo: segmentacion.tipo,
            prioridad: segmentacion.prioridad,
            emoji: segmentacion.emoji
          },
          mainDoubt,
          crmLabel,
          action: 'redirect_to_academy',
          reason: 'buyer_status'
        });
      } else {
        // Cliente existente pero no ha comprado, actualizar estado a LINK con datos CRM
        await updateCliente(clienteId, {
          ESTADO: 'LINK',
          NOMBRE: nombre,
          WHATSAPP: whatsappLimpio,
          soporte_tipo: segmentacion.tipo,
          soporte_prioridad: segmentacion.prioridad,
          soporte_duda: mainDoubt,
          soporte_descripcion: segmentacion.descripcion,
          soporte_fecha_ultimo: currentTimestamp
        });

        // Obtener asesor asignado SOLO si NO va a academia
        if (clienteExistente.ID_ASESOR && !shouldRedirectToAcademy) {
          asesorAsignado = await getAsesorById(clienteExistente.ID_ASESOR);
        } else if (shouldRedirectToAcademy) {
          logger.info('🧹 Asesor NO asignado para cliente existente VIP_POST_VENTA', {
            nombre,
            whatsapp: whatsappLimpio,
            clienteId: clienteExistente.ID,
            reason: 'redirect_to_academy_existing_client'
          });
        }
      }
    } else {
      logger.info('Cliente nuevo, creando registro');

      if (!shouldRedirectToAcademy) {
        // Obtener próximo asesor ponderado solo si NO va a academia
        const nextAsesor = await getNextAsesorPonderado();
        if (nextAsesor?.ID) {
          asesorAsignado = await getAsesorById(nextAsesor.ID);
          
          // Crear nuevo cliente con asesor asignado y datos CRM
          const nuevoCliente = await createCliente({
            NOMBRE: nombre,
            ESTADO: 'LINK',
            WHATSAPP: whatsappLimpio,
            ID_ASESOR: nextAsesor.ID,
            NOMBRE_ASESOR: asesorAsignado?.NOMBRE,
            WHA_ASESOR: asesorAsignado?.WHATSAPP,
            FECHA_CREACION: currentTimestamp,
            soporte_tipo: segmentacion.tipo,
            soporte_prioridad: segmentacion.prioridad,
            soporte_duda: mainDoubt,
            soporte_descripcion: segmentacion.descripcion,
            soporte_fecha_ultimo: currentTimestamp
          });
          clienteId = nuevoCliente[0].ID;

          // Incrementar contador LINK del asesor
          await updateAsesorCounter(nextAsesor.ID, 'LINK');
        } else {
          // No hay asesores disponibles - crear cliente sin asesor
          const nuevoCliente = await createCliente({
            NOMBRE: nombre,
            ESTADO: 'LINK',
            WHATSAPP: whatsappLimpio,
            FECHA_CREACION: currentTimestamp,
            soporte_tipo: segmentacion.tipo,
            soporte_prioridad: segmentacion.prioridad,
            soporte_duda: mainDoubt,
            soporte_descripcion: segmentacion.descripcion,
            soporte_fecha_ultimo: currentTimestamp
          });
          clienteId = nuevoCliente[0].ID;
        }
      } else {
        // Cliente VIP_POST_VENTA que no existe en BD - crear SIN asesor
        logger.info('🎓 Creando cliente VIP_POST_VENTA sin asesor (será redirigido a academia)', {
          nombre,
          whatsapp: whatsappLimpio,
          reason: 'vip_post_venta_not_in_db'
        });
        
        const nuevoCliente = await createCliente({
          NOMBRE: nombre,
          ESTADO: 'LINK',
          WHATSAPP: whatsappLimpio,
          FECHA_CREACION: currentTimestamp,
          soporte_tipo: segmentacion.tipo,
          soporte_prioridad: segmentacion.prioridad,
          soporte_duda: mainDoubt,
          soporte_descripcion: segmentacion.descripcion,
          soporte_fecha_ultimo: currentTimestamp
          // SIN ID_ASESOR, NOMBRE_ASESOR, WHA_ASESOR
        });
        clienteId = nuevoCliente[0].ID;
        
        // Asegurar que asesorAsignado permanezca null
        asesorAsignado = null;
      }
    }

    // 2. Registrar evento LINK (solo si el cliente NO está en estado PAGADO)
    if (!shouldRedirectToAcademy) {
      await insertRegistro({
        ID_CLIENTE: clienteId,
        TIPO_EVENTO: 'LINK',
        FECHA_EVENTO: currentTimestamp
      });
      logger.info('✅ Evento LINK registrado para cliente', { clienteId, nombre });
    } else {
      logger.info('🚫 Evento LINK NO registrado - Cliente ya compró', { 
        clienteId, 
        nombre, 
        estado: clienteExistente?.ESTADO || 'VIP_POST_VENTA',
        reason: 'client_already_paid'
      });
    }

    // 3. Si debe ir a academia, responder inmediatamente
    if (shouldRedirectToAcademy) {
      // Obtener número configurado para academia (obligatorio)
      let academyPhoneNumber: string | null = null;
      try {
        const soporteConfig = await getSoporteConfig();
        if (soporteConfig.phoneNumbers.academySupport) {
          academyPhoneNumber = soporteConfig.phoneNumbers.academySupport;
          logger.info('Usando número de soporte configurado:', academyPhoneNumber);
        } else {
          logger.error('Número de soporte academia no está configurado en BD');
        }
      } catch (configError) {
        logger.error('Error obteniendo configuración de soporte:', configError);
      }

      if (!academyPhoneNumber) {
        // Finalizar webhook log con error de configuración
        const processingTime = Date.now() - startTime;
        if (webhookLogId) {
          try {
            await updateWebhookLog({
              id: webhookLogId,
              status: 'error',
              error_message: 'Número de soporte academia no configurado',
              processing_time_ms: processingTime,
              processed_at: new Date()
            });
          } catch (updateError) {
            logger.error('Error actualizando webhook log con error de configuración:', updateError);
          }
        }

        return res.status(500).json({
          success: false,
          error: 'Número de soporte academia no configurado',
          message: 'Debe configurar el número de WhatsApp para soporte academia en el dashboard',
          data: {
            clienteId,
            nombre,
            whatsapp: whatsappLimpio,
            redirectedToAcademy: false,
            configurationRequired: true,
            webhookLogId,
            processingTimeMs: processingTime
          },
          timestamp: new Date().toISOString()
        });
      }

      // Finalizar webhook log para redirección a academia
      const processingTime = Date.now() - startTime;
      if (webhookLogId) {
        try {
                  await updateWebhookLog({
          id: webhookLogId,
          status: 'success',
          cliente_id: clienteId,
          telegram_status: 'skipped',
          telegram_error: 'Cliente redirigido a academia - Ya es comprador',
          processing_time_ms: processingTime,
          processed_at: new Date(),
          buyer_status: clienteExistente?.ESTADO || 'unknown',
          buyer_previous_advisor: clienteExistente?.NOMBRE_ASESOR || undefined,
          buyer_creation_date: undefined,
          redirect_reason: 'buyer_status'
        });
        } catch (updateError) {
          logger.error('Error finalizando webhook log (academia):', updateError);
        }
      }

      return res.json({
        success: true,
        url: `https://wa.me/${academyPhoneNumber}?text=Ya+compre+y+necesito+ayuda.`,
        message: 'Cliente redirigido a academia',
        data: {
          clienteId,
          nombre,
          whatsapp: whatsappLimpio,
          redirectedToAcademy: true,
          academyPhoneUsed: academyPhoneNumber,
          webhookLogId,
          processingTimeMs: processingTime
        },
        timestamp: new Date().toISOString()
      });
    }

    // 4. Enviar notificación por Telegram si tiene asesor (NO para VIPs)
    let telegramNotified = false;
    if (asesorAsignado?.ID_TG && !shouldRedirectToAcademy) {
      try {
        const notificationMessage = createSoporteNotificationMessage(
          nombre,
          whatsappLimpio,
          asesorAsignado.ID_TG,
          segmentacion,
          mainDoubt,
          crmLabel
        );

        telegramChatId = asesorAsignado.ID_TG;
        
        // Usar cola en lugar de envío directo
        const messageId = telegramQueue.enqueueMessage(
          asesorAsignado.ID_TG,
          notificationMessage.text,
          webhookLogId || undefined,
          { 
            type: 'soporte',
            asesor: asesorAsignado.NOMBRE,
            cliente: nombre,
            segmentacion: segmentacion.tipo,
            prioridad: segmentacion.prioridad
          },
          notificationMessage.reply_markup
        );
        
        telegramStatus = 'queued'; // Estado inicial en cola
        telegramMessageId = messageId;
        telegramNotified = true;
        
        logger.info('Notificación de soporte agregada a cola', {
          asesor: asesorAsignado.NOMBRE,
          cliente: nombre,
          telegramId: asesorAsignado.ID_TG,
          messageId,
          segmentacion: segmentacion.tipo,
          queueStats: telegramQueue.getQueueStats()
        });
      } catch (error) {
        telegramStatus = 'error';
        telegramError = error instanceof Error ? error.message : 'Error agregando a cola';
        logger.error('Error agregando notificación de soporte a cola', error);
      }
    } else if (asesorAsignado && !shouldRedirectToAcademy) {
      telegramStatus = 'skipped';
      telegramError = 'Asesor sin ID_TG configurado';
    } else if (shouldRedirectToAcademy) {
      telegramStatus = 'skipped';
      telegramError = 'Cliente VIP_POST_VENTA - No se notifica asesor';
      logger.info('📱 Notificación de Telegram saltada para VIP_POST_VENTA', {
        nombre,
        whatsapp: whatsappLimpio,
        reason: 'vip_post_venta'
      });
    }

    // 5. Preparar mensaje de WhatsApp personalizado según tipo de lead
    let whatsappUrl;
    
    // Si debe ir a academia, NO generar URL de asesor
    if (shouldRedirectToAcademy) {
      whatsappUrl = null; // Se maneja en la respuesta de academia
      logger.info('🎓 URL de WhatsApp saltada para VIP_POST_VENTA', {
        nombre,
        whatsapp: whatsappLimpio,
        reason: 'redirect_to_academy'
      });
    } else if (asesorAsignado?.WHATSAPP) {
      let mensajePersonalizado = '';

      if (haComprado) {
        // VIP POST-VENTA - Mensaje directo y urgente
        mensajePersonalizado = `🔥 Hola! Soy ${nombre}, YA COMPRÉ el curso y tengo un problema que necesito resolver urgentemente. ¿Me puedes ayudar?`;
      } else {
        // PROSPECTOS - Mensajes según tipo de duda
        switch (mainDoubt) {
          case 'precio':
            mensajePersonalizado = `💰 Hola! Soy ${nombre}. Estoy MUY interesado en el curso pero tengo algunas dudas sobre el precio y métodos de pago. ¿Podríamos hablar?`;
            break;
            
          case 'tecnico':
            mensajePersonalizado = `🚨 URGENTE - Hola! Soy ${nombre}. Estaba tratando de COMPRAR el curso pero tengo un problema técnico que me impide completar la compra. ¡Ayúdame por favor!`;
            break;
            
          case 'adecuacion':
            mensajePersonalizado = `🎯 Hola! Soy ${nombre}. Estoy evaluando si el curso es realmente para mí y mi situación. ¿Podrías ayudarme a aclarar algunas dudas?`;
            break;
            
          case 'contenido':
            mensajePersonalizado = `📚 Hola! Soy ${nombre}. Tengo una pregunta específica sobre el contenido del curso antes de tomar la decisión de comprar. ¿Puedes orientarme?`;
            break;
            
          case 'otra':
          default:
            mensajePersonalizado = `❓ Hola! Soy ${nombre}. Tengo algunas consultas sobre la terapia del dolor y me gustaría conversar contigo. ¿Tienes un momento?`;
            break;
        }
      }
      
      const mensajeCodificado = encodeURIComponent(mensajePersonalizado);
      whatsappUrl = `https://wa.me/${asesorAsignado.WHATSAPP}?text=${mensajeCodificado}`;
    } else if (!shouldRedirectToAcademy) {
      // Fallback si no hay asesor Y NO es VIP - usar número configurado (obligatorio)
      let fallbackPhoneNumber: string | null = null;
      try {
        const soporteConfig = await getSoporteConfig();
        if (soporteConfig.phoneNumbers.academySupport) {
          fallbackPhoneNumber = soporteConfig.phoneNumbers.academySupport;
          logger.info('Usando número de soporte configurado para fallback:', fallbackPhoneNumber);
        } else {
          logger.error('Número de soporte academia no configurado para fallback');
        }
      } catch (configError) {
        logger.error('Error obteniendo configuración de soporte para fallback:', configError);
      }

      if (!fallbackPhoneNumber) {
        // Finalizar webhook log con error de configuración
        const processingTime = Date.now() - startTime;
        if (webhookLogId) {
          try {
            await updateWebhookLog({
              id: webhookLogId,
              status: 'error',
              error_message: 'Número de soporte academia no configurado (fallback)',
              processing_time_ms: processingTime,
              processed_at: new Date()
            });
          } catch (updateError) {
            logger.error('Error actualizando webhook log con error de configuración (fallback):', updateError);
          }
        }

        return res.status(500).json({
          success: false,
          error: 'Número de soporte academia no configurado',
          message: 'Debe configurar el número de WhatsApp para soporte academia en el dashboard',
          data: {
            clienteId,
            nombre,
            whatsapp: whatsappLimpio,
            haComprado,
            asesorAsignado: null,
            telegramNotified: false,
            redirectedToAcademy: false,
            configurationRequired: true,
            webhookLogId,
            processingTimeMs: processingTime,
            crmSegmentation: {
              tipo: segmentacion.tipo,
              prioridad: segmentacion.prioridad,
              descripcion: segmentacion.descripcion,
              emoji: segmentacion.emoji
            }
          },
          timestamp: new Date().toISOString()
        });
      }
      
      whatsappUrl = `https://wa.me/${fallbackPhoneNumber}?text=Necesito+ayuda+con+soporte`;
    }

    // Finalizar webhook log con resultado exitoso
    const processingTime = Date.now() - startTime;
    if (webhookLogId) {
      try {
        await updateWebhookLog({
          id: webhookLogId,
          status: 'success',
          cliente_id: clienteId,
          asesor_id: asesorAsignado?.ID || undefined,
          asesor_nombre: asesorAsignado?.NOMBRE || undefined,
          telegram_status: telegramStatus,
          telegram_chat_id: telegramChatId || undefined,
          telegram_message_id: telegramMessageId || undefined,
          telegram_error: telegramError || undefined,
          processing_time_ms: processingTime,
          processed_at: new Date()
        });
      } catch (updateError) {
        logger.error('Error finalizando support webhook log:', updateError);
        // No afectar la respuesta exitosa por errores de logging
      }
    }

    // Obtener el log completo si existe
    let fullLog = null;
    if (webhookLogId) {
      try {
        fullLog = await getWebhookLogById(webhookLogId);
      } catch (logError) {
        logger.warn('No se pudo obtener el log completo para la respuesta:', logError);
      }
    }

    res.json({
      success: true,
      url: whatsappUrl,
      message: 'Formulario de soporte procesado exitosamente',
      data: {
        clienteId,
        nombre,
        whatsapp: whatsappLimpio,
        haComprado,
        asesorAsignado: shouldRedirectToAcademy ? null : asesorAsignado?.NOMBRE || null,
        asesorWhatsapp: shouldRedirectToAcademy ? null : asesorAsignado?.WHATSAPP || null,
        telegramNotified: shouldRedirectToAcademy ? false : telegramNotified,
        redirectedToAcademy: shouldRedirectToAcademy,
        webhookLogId,
        processingTimeMs: processingTime,
        // Nueva información CRM
        crmSegmentation: {
          tipo: segmentacion.tipo,
          prioridad: segmentacion.prioridad,
          descripcion: segmentacion.descripcion,
          emoji: segmentacion.emoji
        },
        mainDoubt,
        crmLabel,
        integrationResults: {
          telegram: { 
            status: telegramStatus, 
            error: telegramError || undefined,
            chatId: telegramChatId || undefined,
            messageId: telegramMessageId || undefined
          }
        },
        // Log completo de la base de datos
        fullLog: fullLog
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error procesando formulario de soporte', error);
    
    // Finalizar webhook log con error (no afectar la respuesta si esto falla)
    const processingTime = Date.now() - startTime;
    if (webhookLogId) {
      try {
        await updateWebhookLog({
          id: webhookLogId,
          status: 'error',
          processing_time_ms: processingTime,
          error_message: error instanceof Error ? error.message : 'Error desconocido',
          error_stack: error instanceof Error ? error.stack : undefined,
          processed_at: new Date()
        });
      } catch (updateError) {
        logger.error('Error actualizando support webhook log con error:', updateError);
        // No afectar la respuesta del webhook por errores de logging
      }
    }

    // Obtener el log completo para la respuesta de error también
    let fullLog = null;
    if (webhookLogId) {
      try {
        fullLog = await getWebhookLogById(webhookLogId);
      } catch (logError) {
        logger.warn('No se pudo obtener el log completo para la respuesta de error:', logError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: {
        message: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        webhookLogId,
        processingTimeMs: processingTime,
        // Log completo para debugging
        fullLog: fullLog
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint de prueba para el formulario de soporte
router.post('/test-soporte', async (req, res) => {
  try {
    const { name, whatsapp, courseStatus = 'no', dryRun = true } = req.body;
    
    if (!name || !whatsapp) {
      return res.status(400).json({
        success: false,
        error: 'Nombre y WhatsApp requeridos para la prueba',
        timestamp: new Date().toISOString()
      });
    }

    const whatsappLimpio = limpiarNumeroWhatsapp(whatsapp);
    const haComprado = courseStatus === 'si';
    
    if (dryRun) {
      // Modo de prueba - no hacer cambios reales
      const ultimosSeis = whatsappLimpio.slice(-6);
      
      res.json({
        success: true,
        message: 'Simulación de formulario de soporte',
        input: { name, whatsapp, courseStatus },
        processed: {
          nombre: name,
          whatsappOriginal: whatsapp,
          whatsappLimpio,
          haComprado,
          ultimosSeisDigitos: ultimosSeis
        },
        simulatedSteps: [
          `Buscaría cliente por últimos 6 dígitos: ${ultimosSeis}`,
          'Evaluaría si cliente ya compró',
          'Asignaría asesor si es cliente nuevo',
          'Registraría evento LINK',
          'Enviaría notificación por Telegram',
          'Generaría URL de WhatsApp'
        ],
        timestamp: new Date().toISOString()
      });
    } else {
      // Procesamiento real
      return res.status(501).json({
        success: false,
        error: 'Procesamiento real no implementado en endpoint de prueba. Use /formulario-soporte',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('Error en prueba de formulario de soporte', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para obtener la configuración de soporte
router.get('/config', async (_req, res) => {
  try {
    const config = await getSoporteConfig();
    res.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error obteniendo configuración de soporte', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para actualizar la configuración de soporte
router.put('/config', async (req, res) => {
  try {
    const { body } = req;
    
    // Validar estructura de la configuración
    if (!body || !body.phoneNumbers) {
      return res.status(400).json({
        success: false,
        error: 'Estructura de configuración inválida. Debe incluir: phoneNumbers',
        timestamp: new Date().toISOString()
      });
    }

    // Actualizar configuración
    const success = await updateSoporteConfig(body);
    
    if (success) {
      logger.info('Configuración de Soporte actualizada', { 
        updatedBy: req.ip,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: 'Configuración de soporte actualizada exitosamente',
        data: await getSoporteConfig(),
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error guardando configuración de soporte',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('Error actualizando configuración de soporte', error);
    
    // Intentar obtener la configuración actual para verificar si algunos datos se guardaron
    let currentConfig = null;
    try {
      currentConfig = await getSoporteConfig();
    } catch (configError) {
      logger.warn('No se pudo obtener configuración actual para verificación:', configError);
    }
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: {
        message: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        note: 'Algunos cambios podrían haberse guardado parcialmente. Revisa la configuración actual.',
        currentConfig: currentConfig || 'No disponible'
      },
      timestamp: new Date().toISOString()
    });
  }
});

export default router;