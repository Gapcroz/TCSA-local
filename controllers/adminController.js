// controllers/adminController.js
const userRepository = require('../repositories/userRepository');

const getAllUsers = async (req, res) => {
  try {
    const users = await userRepository.getAllUsers();
    // No enviar datos sensibles como Google ID si no es estrictamente necesario al frontend
    const usersCleaned = users.map(user => ({
      id: user._id,
      displayName: user.displayName,
      email: user.email,
      isActive: user.isActive,
      role: user.role,
      createdAt: user.createdAt
    }));
    res.status(200).json(usersCleaned);
  } catch (error) {
    console.error('Error al obtener todos los usuarios:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const updateUserAccess = async (req, res) => {
  const { userId } = req.params;
  const { isActive, role } = req.body; // El administrador enviará estos campos

  // Validaciones básicas (pueden ser más robustas)
  if (typeof isActive !== 'boolean' || !['user', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Datos de actualización inválidos.' });
  }

  // Opcional: Asegurarse de que un admin no se pueda deshabilitar a sí mismo,
  // o cambiar su propio rol a no-admin via esta API si es el único admin.
  if (req.user.id.toString() === userId && !isActive) {
      return res.status(403).json({ message: 'No puedes deshabilitar tu propia cuenta.' });
  }
   if (req.user.id.toString() === userId && role === 'user' && req.user.role === 'admin') {
      // Logic to prevent self-demotion if you're the only admin
      // For now, allow it, but in a production system, check if there's at least one other admin.
   }


  try {
    const updatedUser = await userRepository.updateUserAccess(userId, isActive, role);
    if (!updatedUser) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    res.status(200).json({ message: 'Acceso de usuario actualizado exitosamente.', user: updatedUser });
  } catch (error) {
    console.error('Error al actualizar acceso de usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

module.exports = {
  getAllUsers,
  updateUserAccess,
};