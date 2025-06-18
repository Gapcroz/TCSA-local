// server.js

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const connectDB = require('./config/db'); // Importa la función de conexión a DB

// Importar rutas
const authRoutes = require('./routes/authRoutes');
const fileRoutes = require('./routes/fileRoutes');

// Importar configuración de Passport
const setupPassport = require('./config/passport');

const app = express();
const PORT = process.env.PORT || 3000;

// Conectar a la base de datos
connectDB();

// Middlewares globales
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de Sesiones
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

// Configuración de Passport
setupPassport(passport); // Pasa la instancia de passport al archivo de configuración
app.use(passport.initialize());
app.use(passport.session());

// Rutas de la API
app.get('/', (req, res) => {
  res.send('¡API de Conversión de Archivos en marcha!');
});
app.use('/auth', authRoutes); // Monta las rutas de autenticación bajo /auth
app.use('/api/files', fileRoutes); // Monta las rutas de archivos bajo /api/files

// Manejo de errores global (opcional, pero buena práctica)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Algo salió mal!');
});

// Iniciar el Servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});