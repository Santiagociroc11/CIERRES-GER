export const validateWhatsApp = (number: string): boolean => {
  // Eliminar todos los caracteres no numéricos
  const cleanNumber = number.replace(/\D/g, '');
  
  // Validar que tenga entre 10 y 13 dígitos
  return cleanNumber.length >= 10 && cleanNumber.length <= 13;
};

export const validateMonto = (monto: string): boolean => {
  const amount = parseFloat(monto);
  return !isNaN(amount) && amount > 0;
};

export const formatWhatsApp = (number: string): string => {
  const cleanNumber = number.replace(/\D/g, '');
  
  // Si no empieza con '+' o código de país, agregar el código de México
  if (!cleanNumber.startsWith('52') && cleanNumber.length === 10) {
    return `52${cleanNumber}`;
  }
  
  return cleanNumber;
};