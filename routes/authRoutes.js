// routes/authRoutes.js
const express = require('express');
const passport = require('passport');
const authController = require('../controllers/authController');

const router = express.Router();

// Google OAuth routes
router.get(
  '/google',
  (req, res, next) => {
    // Pass 'link=true' to Google strategy if it's for linking an account
    const state = req.query.link ? 'link=true' : 'login=true';
    passport.authenticate('google', { scope: ['profile', 'email'], state: state })(req, res, next);
  }
);

router.get(
  '/google/redirect',
  passport.authenticate('google', {
    failureRedirect: '/auth/login-failure', // Redirect to the public failure route
  }),
  (req, res) => {
    // Determine redirect based on state or if account was linked
    if (req.user && req.query.state === 'link=true') {
      // If linking was successful, redirect back to dashboard
      res.redirect('/auth/dashboard');
    } else if (req.user && req.user.isActive) {
      // Regular login successful, redirect to dashboard
      res.redirect('/auth/dashboard');
    } else if (req.user && !req.user.isActive) {
      // User is authenticated but account is not active
      res.redirect('/access-pending'); // Redirect to access pending page
    } else {
        // Fallback, should ideally not happen if passport.authenticate worked
        res.redirect('/auth/login-failure');
    }
  }
);

// Local login/register routes
// Note: These handle the *submission* of login/registration forms,
// the HTML itself is served by `app.get` in server.js.
router.post('/local-login', authController.localLogin);
router.post('/register', authController.registerUser);

// Logout route
router.get('/logout', authController.handleLogout);

// JWT generation route (for API clients, typically via local-login POST, but also directly from dashboard)
router.get('/jwt', authController.getJwtToken);


// Removed this as it's handled by server.js now:
// router.get('/login', authController.getLoginPage);
// router.get('/dashboard', authController.getDashboard);
// router.get('/login-failure', authController.handleLoginFailure);


module.exports = router;