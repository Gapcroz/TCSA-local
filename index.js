// server.js

// 1. Cargar variables de entorno
require('dotenv').config();

// 2. Importar módulos necesarios
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const passport = require('passport'); // Importa Passport

// Importar funciones de configuración de Passport
const setupPassport = require('./config/passport'); // Configura Google y Local strategies
const setupPassportJwt = require('./config/passportJwt'); // Configura JWT strategy

// Importar rutas
const authRoutes = require('./routes/authRoutes');
const fileRoutes = require('./routes/fileRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');

// Importar conexión a DB
const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// 3. Conexión a la Base de Datos
connectDB();

// 4. Middlewares Globales
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. Configuración de Sesiones con MongoStore
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: 'sessions',
      ttl: 14 * 24 * 60 * 60,
      autoRemove: 'interval',
      autoRemoveInterval: 10,
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

// 6. Inicializar Passport (Middleware de Passport)
app.use(passport.initialize()); // <-- SIEMPRE ANTES DE MONTAR ESTRATEGIAS O RUTAS QUE USEN PASSPORT
app.use(passport.session()); // <-- Para que Passport use sesiones

// 7. Configurar todas las Estrategias de Passport
// ESTOS DEBEN EJECUTARSE ANTES DE QUE CUALQUIER RUTA O MIDDLEWARE
// INTENTE USAR LAS ESTRATEGIAS (ej. authenticateRequest en authMiddleware)
setupPassport(passport); // Configura 'google' y 'local'
setupPassportJwt(passport); // Configura 'jwt'

// 8. Rutas de la API y Vistas Mínimas
app.get('/', (req, res) => {
  res.send('¡API de Conversión de Archivos en marcha!');
});
// Vistas estáticas para el flujo de login (pueden ir aquí o más arriba)
app.use('/views', express.static('views'));
app.use('/access-pending', (req, res) => {
    res.sendFile(require('path').join(__dirname, 'views', 'access-pending.html'));
});


app.use('/auth', authRoutes); // Contiene rutas que usan 'google' y 'local' y el '/dashboard' (que usa sesión)
app.use('/api/files', fileRoutes); // Contiene rutas que usan authenticateRequest (JWT o sesión)
app.use('/api/admin', adminRoutes); // Contiene rutas que usan authenticateRequest
app.use('/api/user', userRoutes); // Contiene rutas que usan authenticateRequest


// 9. Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Algo salió mal!');
});

// 10. Iniciar el Servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});