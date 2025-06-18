// middleware/authMiddleware.js


const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  
  res.status(401).send('No autorizado. Por favor, inicie sesión.');
  
};

module.exports = {
  ensureAuthenticated,
};