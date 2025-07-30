// routes/authRoutes.js
const express = require('express');
const passport = require('passport');
const authController = require('../controllers/authController');
const { authenticateRequest, ensureApiAccess } = require('../middleware/authMiddleware'); // Assuming this path is correct

const router = express.Router();

// Middleware array for API protected routes (session or JWT authentication, and API access check)
const API_PROTECTED_ROUTES = [
  authenticateRequest, // Authenticates via session or JWT
  ensureApiAccess,     // Ensures the user has active API access
];

// Google OAuth routes
router.get(
  '/google',
  (req, res, next) => {
    // Pass 'link=true' to Google strategy if it's for linking an account
    // This state will be returned to the /google/callback route
    const state = req.query.link ? 'link=true' : 'login=true';
    passport.authenticate('google', { scope: ['profile', 'email'], state: state })(req, res, next);
  }
);

// Google OAuth callback route
router.get(
  '/google/callback', // Corrected path to /google/callback as per common practice
  passport.authenticate('google', {
    failureRedirect: '/auth/login-failure', // Redirect to the public failure route on auth failure
  }),
  (req, res) => {
    // Determine redirect based on state from the initial /google request
    if (req.user && req.query.state === 'link=true') {
      // If linking was successful, redirect back to dashboard
      res.redirect('/auth/dashboard');
    } else if (req.user && req.user.isActive) {
      // Regular login successful AND user is active, redirect to dashboard
      res.redirect('/auth/dashboard');
    } else if (req.user && !req.user.isActive) {
      // User is authenticated but account is not active (e.g., pending admin approval)
      res.redirect('/access-pending'); // Redirect to access pending page
    } else {
        // Fallback for unexpected cases, though passport.authenticate should handle most failures
        res.redirect('/auth/login-failure');
    }
  }
);

// Local login/register routes
// These handle the *submission* of login/registration forms.
// The HTML pages are served by `app.get` in server.js or dedicated routes.

router.post('/local-login', authController.localLogin);

// Route for registering a new user with email and password
router.post('/register', authController.registerUser);

// Logout route
router.get('/logout', authController.handleLogout);

// Protected routes using API_PROTECTED_ROUTES middleware
// Ensure these routes are protected by both authentication and API access checks
router.get('/dashboard', API_PROTECTED_ROUTES, authController.getDashboard); // Dashboard HTML route
router.get('/jwt', API_PROTECTED_ROUTES, authController.getJwtToken); // JWT generation route

// Route for displaying login failure page
router.get('/login-failure', authController.handleLoginFailure);

router.get('/check-admin', API_PROTECTED_ROUTES, authController.checkAdminStatus);


module.exports = router;