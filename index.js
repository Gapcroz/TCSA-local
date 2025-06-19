// server.js

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const connectDB = require('./config/db'); // Importa la función de conexión a DB
const MongoStore = require('connect-mongo'); // Importa connect-mongo
// Importar rutas
const authRoutes = require('./routes/authRoutes');
const fileRoutes = require('./routes/fileRoutes');
const adminRoutes = require('./routes/adminRoutes'); // Importa las rutas de administración
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
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI, // Usa la misma URI de tu DB
      ttl: 14 * 24 * 60 * 60, // Duración de la sesión en segundos (ej. 14 días)
      collectionName: 'sessions', // Nombre de la colección donde se guardarán las sesiones
      autoRemove: 'interval', // Limpia sesiones expiradas automáticamente
      autoRemoveInterval: 10, // Intervalo de limpieza en minutos (ej. cada 10 min)
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 horas (en milisegundos), debe coincidir con `ttl` o ser menor
    },
  }),
);

// Configuración de Passport
setupPassport(passport); // Pasa la instancia de passport al archivo de configuración
app.use(passport.initialize());
app.use(passport.session());
app.use('/views', express.static('views'));
// Rutas de la API
app.get('/', (req, res) => {
  res.send('¡API de Conversión de Archivos en marcha!');
});

app.use('/auth', authRoutes); // Monta las rutas de autenticación bajo /auth
app.use('/api/files', fileRoutes); // Monta las rutas de archivos bajo /api/files
app.use('/api/admin', adminRoutes); // Monta las rutas de administración bajo /api/admin
// Manejo de errores global (opcional, pero buena práctica)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Algo salió mal!');
});

// Iniciar el Servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});