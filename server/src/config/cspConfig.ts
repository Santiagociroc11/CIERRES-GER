// Configuración de Content Security Policy permisiva
// Para usar: app.use(helmet({ contentSecurityPolicy: CSP_CONFIG }));

export const CSP_CONFIG = {
  directives: {
    defaultSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "data:", "blob:", "*"],
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "data:", "blob:", "*"],
    styleSrc: ["'self'", "'unsafe-inline'", "data:", "blob:", "*"],
    imgSrc: ["'self'", "data:", "blob:", "*"],
    connectSrc: ["'self'", "data:", "blob:", "*", "https:", "wss:"],
    fontSrc: ["'self'", "data:", "blob:", "*"],
    objectSrc: ["'self'", "data:", "blob:", "*"],
    mediaSrc: ["'self'", "data:", "blob:", "*"],
    frameSrc: ["'self'", "data:", "blob:", "*"],
    workerSrc: ["'self'", "data:", "blob:", "*"],
    childSrc: ["'self'", "data:", "blob:", "*"],
    manifestSrc: ["'self'", "data:", "blob:", "*"],
    prefetchSrc: ["'self'", "data:", "blob:", "*"],
    baseUri: ["'self'"],
    formAction: ["'self'", "*"],
    frameAncestors: ["'self'", "*"],
    upgradeInsecureRequests: []
  }
};

// Configuración mínima de seguridad (solo CORS básico)
export const BASIC_SECURITY_CONFIG = {
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  dnsPrefetchControl: false,
  frameguard: false,
  hidePoweredBy: false,
  hsts: false,
  ieNoOpen: false,
  noSniff: false,
  permittedCrossDomainPolicies: false,
  referrerPolicy: false,
  xssFilter: false
};
