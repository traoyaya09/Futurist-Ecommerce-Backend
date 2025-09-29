// utils/cspDirectives.js

const getCSPDirectives = (env) => {
  return {
    defaultSrc: ["'self'"],
    connectSrc: [
      "'self'",
      // Backend URLs
      "http://localhost:8080",
      "ws://localhost:8080",
      "https://futurist-ecommerce-backend.onrender.com",
      "wss://futurist-ecommerce-backend.onrender.com",
      // Dev servers
      "http://localhost:5173",
      "ws://localhost:5173",
      "http://localhost:3000",
      "ws://localhost:3000",
      // Frontend Production URLs
      "https://futurist-ecommerce-frontend.vercel.app",
      "https://futurist-ecommerce-frontend.onrender.com",
      // CDNs
      "https://cdn.jsdelivr.net",
      "https://cdnjs.cloudflare.com",
    ],
    scriptSrc: [
      "'self'",
      "https://cdn.jsdelivr.net",
      "https://kit.fontawesome.com",
      "'unsafe-inline'",
    ],
    styleSrc: [
      "'self'",
      "https://cdnjs.cloudflare.com",
      "https://cdn.jsdelivr.net",
      "'unsafe-inline'",
    ],
    fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "data:"],
    imgSrc: ["*", "data:"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  };
};

const getOrigins = (env) => {
  const devOrigins = ["http://localhost:5173", "http://localhost:3000"];
  const prodOrigins = [
    "https://futurist-ecommerce-frontend.vercel.app",
    "https://futurist-ecommerce-frontend.onrender.com",
  ];

  return {
    frontends: env === 'development' ? devOrigins : prodOrigins,
  };
};

module.exports = { getCSPDirectives, getOrigins };
