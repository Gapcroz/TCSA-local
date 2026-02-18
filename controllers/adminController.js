// controllers/adminController.js
const userRepository = require('../repositories/userRepository');
const mongoose = require('mongoose');

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

const deleteUser = async (req, res) => {
  const { userId } = req.params;

  // Validar que userId sea un ObjectId válido
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'ID de usuario inválido.' });
  }

  // No permitir que un admin se elimine a sí mismo
  if (req.user.id.toString() === userId) {
    return res.status(403).json({ message: 'No puedes eliminar tu propia cuenta.' });
  }

  let session;
  
  try {
    // Iniciar sesión de MongoDB para transacción
    session = await mongoose.startSession();
    // Iniciar transacción para garantizar atomicidad
    await session.startTransaction();

    // Eliminar el usuario primero (más seguro que tener datos huérfanos)
    const deletedUser = await userRepository.deleteUserById(userId, session);
    
    // Si el usuario no existía o ya fue eliminado, abortar
    if (!deletedUser) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error('Error al abortar transacción (usuario no encontrado):', abortError);
      }
      return res.status(404).json({ message: 'Usuario no encontrado o ya fue eliminado.' });
    }

    // Eliminar sesiones del usuario
    const sessionCollection = mongoose.connection.collection('sessions_hzo');
    let cursor;
    try {
      // Buscar y eliminar sesiones usando agregación para evitar cargar todo en memoria
      cursor = sessionCollection.find({}, { projection: { _id: 1, session: 1 }, session });
      const sessionIdsToDelete = [];
      
      // Procesar sesiones de forma eficiente sin cargar todas en memoria
      while (await cursor.hasNext()) {
        const sess = await cursor.next();
        try {
          const sessionData = JSON.parse(sess.session);
          if (sessionData.passport && sessionData.passport.user === userId) {
            sessionIdsToDelete.push(sess._id);
          }
        } catch (parseError) {
          // Sesión corrupta, ignorar y continuar
          continue;
        }
      }

      // Eliminar sesiones en lotes si se encontraron
      if (sessionIdsToDelete.length > 0) {
        await sessionCollection.deleteMany({
          _id: { $in: sessionIdsToDelete }
        }, { session });
      }
    } catch (sessionError) {
      console.error('Error al invalidar sesiones:', sessionError);
      // Como el usuario ya fue eliminado en la transacción, hacer rollback
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error('Error al abortar transacción (fallo en sesiones):', abortError);
      }
      return res.status(500).json({ 
        message: 'Error al invalidar sesiones del usuario.' 
      });
    } finally {
      // Cerrar cursor explícitamente para liberar recursos
      if (cursor) {
        await cursor.close();
      }
    }

    // Confirmar transacción - todo fue exitoso
    await session.commitTransaction();
    
    res.status(200).json({ 
      message: 'Usuario eliminado exitosamente. Sus trabajos de conversión se mantienen para auditoría.' 
    });
    
  } catch (error) {
    // En caso de error, hacer rollback de la transacción
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error('Error al abortar transacción (error general):', abortError);
      }
    }
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    // Finalizar sesión de MongoDB
    if (session) {
      session.endSession();
    }
  }
};

module.exports = {
  getAllUsers,
  updateUserAccess,
  deleteUser,
};