// index.js
// 1. Cargar variables de entorno - ABSOLUTELY MUST BE THE FIRST EXECUTABLE LINE
require('dotenv').config();

// 2. Importar módulos necesarios
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose'); // Mongoose is needed by connect-mongo for type checking
const MongoStore = require('connect-mongo');
const passport = require('passport');
const path = require('path'); // For resolving file paths

// Importar funciones de configuración de Passport
const setupPassport = require('./config/passport'); // Configura 'google' y 'local' strategies
const setupPassportJwt = require('./config/passportJwt'); // Configura 'jwt' strategy

// Importar rutas de la aplicación
const authRoutes = require('./routes/authRoutes');
const fileRoutes = require('./routes/fileRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');
const jobRoutes = require("./routes/jobRoutes"); 
// Import authentication/authorization middleware (assuming these exist from version 2)
const { authenticateRequest, ensureAdmin } = require('./middleware/authMiddleware');

// Import connection to DB utility
const connectDB = require('./config/db');

// NEW: Import cron scheduler and automated processing service for startup
const { startAutomatedFileProcessor } = require('./config/cronScheduler');
const { ensureDirectoriesExist } = require('./services/automatedProcessingService'); // For initial directory setup


const app = express();
const PORT = process.env.PORT || 3000;

// --- TEMPORARY DEBUGGING LINE ---
// Uncomment this line to check if MONGO_URI is loaded correctly from your .env
console.log('DEBUG: MONGO_URI from .env:', process.env.MONGO_URI);
// If this logs 'undefined' or an empty string, check your .env file or its path.
// --- END TEMPORARY DEBUGGING LINE ---

// 3. Conexión a la Base de Datos
// This function in config/db.js should use process.env.MONGO_URI
connectDB();

// 4. Middlewares Globales
app.use(express.json()); // For parsing application/json bodies
app.use(express.urlencoded({ extended: true })); // For parsing URL-encoded bodies

// 5. Configuración de Sesiones con MongoStore
// This connects Express sessions to your MongoDB database for persistent sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET, // Used to sign the session ID cookie
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    store: MongoStore.create({
      // IMPORTANT: Using process.env.MONGO_URI as in your first version
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions", // Name of the collection in MongoDB to store sessions
      ttl: 14 * 24 * 60 * 60, // Session TTL in seconds (14 days)
      autoRemove: "interval", // Auto-remove expired sessions
      autoRemoveInterval: 10, // Interval in minutes to remove expired sessions
      // client: mongoose.connection.getClient(), // Optional: If you want to use the same client instance as mongoose
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production", // Use secure cookies in production (HTTPS)
      httpOnly: true, // Prevents client-side JS from reading the cookie
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // Cookie expiry time (1 day in milliseconds)
    },
  })
);

// 6. Inicializar Passport (Authentication Middleware)
app.use(passport.initialize()); // Initializes Passport
app.use(passport.session()); // Enables Passport to use Express sessions for persistent login

// 7. Configurar todas las Estrategias de Passport
// These functions define how Passport will authenticate users (e.g., Google, Local, JWT)
setupPassport(passport); // Set up Google OAuth and Local strategies
setupPassportJwt(passport); // Set up JWT strategy

// --- NEW: Initialize Automated File Processing ---
// Ensure the necessary directories for automated processing exist ONCE on application start
ensureDirectoriesExist()
  .then(() => {
    console.log('[App Startup] All necessary file directories are ensured.');
    // Start the cron job AFTER directories are confirmed ready
    const cronSchedule = process.env.AUTOMATED_FILE_PROCESSOR_CRON_SCHEDULE || '*/5 * * * *'; // Default to every 5 minutes
    startAutomatedFileProcessor(cronSchedule);
  })
  .catch((err) => {
    console.error('[App Startup] Failed to ensure automated processing directories or start cron job:', err);
    // Depending on criticality, you might want to exit the process here: process.exit(1);
  });


// --- Frontend Serving (Bundled by esbuild) ---
// Serve bundled static files from the 'dist' directory.
// This is crucial for CSS, JS, and any other assets referenced by your HTML.
// This middleware should be placed BEFORE any specific HTML routes below,
// so that linked assets are found first.
app.use(express.static(path.join(__dirname, 'dist')));

// Define routes for your HTML entry points (pages).
// These routes simply serve the respective HTML files from the 'dist' folder.
// The frontend JavaScript in these HTML files will then make API calls to the backend.

// Root route redirects to the login page (as in version 2)
app.get('/', (req, res) => {
  res.redirect('/auth/login');
});

// Login page - accessible to all
app.get('/auth/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'login.html'));
});

// NEW: Registration page - accessible to all
app.get('/auth/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'register.html'));
});

// Dashboard page - requires authentication
app.get('/auth/dashboard', authenticateRequest, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'dashboard.html'));
});

// File Conversion page - requires authentication
app.get('/file-conversion', authenticateRequest, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'file-conversion.html'));
});

// Admin Dashboard page - requires authentication AND admin role
app.get('/admin-dashboard', authenticateRequest, ensureAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'admin-dashboard.html'));
});

// Login failure page - accessible to all (redirect target)
app.get('/auth/login-failure', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'login-failure.html'));
});

// Access pending page - accessible to all (redirect target for inactive users)
app.get('/access-pending', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'access-pending.html'));
});


// --- Backend API Routes ---
// These routes handle the actual data and logic, typically returning JSON.

// Authentication related backend routes (e.g., local login POST, Google OAuth redirects, logout logic)
app.use('/auth', authRoutes);

// API routes for file operations (upload, download, error reports)
// Applying authenticateRequest middleware as in version 2
app.use('/api/files', authenticateRequest, fileRoutes);
app.use("/api", authenticateRequest,jobRoutes);
// API routes for user-specific data (profile, set password, unlink Google)
// Applying authenticateRequest middleware as in version 2
app.use('/api/user', authenticateRequest, userRoutes);

// API routes for administrator actions (e.g., managing users)
// Applying authenticateRequest and ensureAdmin middleware as in version 2
app.use('/api/admin', authenticateRequest, ensureAdmin, adminRoutes);


// 9. Manejo de errores global
// This should be the last middleware in your chain to catch 404s and server errors.

// Catch-all for 404 - if no route matched above
app.use((req, res, next) => {
  res.status(404).send('Página no encontrada');
});

// General error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack); // Log the error stack for debugging
  res.status(500).send('¡Algo salió mal en el servidor!'); // Generic error message to client
});

// 10. Iniciar el Servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
  console.log('Ensure esbuild is also running in watch mode for frontend changes.');
  console.log('You can use `npm run dev` to start both backend and frontend automatically.');
});