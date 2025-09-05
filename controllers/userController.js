// controllers/userController.js
const userRepository = require("../repositories/userRepository");
const bcrypt = require("bcryptjs"); // Necesario para comprobar la existencia de password

const getUserProfile = async (req, res) => {
  try {
    console.log(req.user);
    const user = await userRepository.findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }
    // No enviar el hash de la contraseña ni GoogleId al frontend directamente
    const profile = {
      id: user._id,
      displayName: user.displayName || user.email,
      email: user.email,
      isActive: user.isActive,
      role: user.role,
      googleId: user.googleId, // Se envía para saber si está vinculado
      passwordSet: !!user.password, // Devuelve true si la contraseña existe
      createdAt: user.createdAt,
    };
    res.status(200).json({ user: profile });
  } catch (error) {
    console.error("Error al obtener el perfil del usuario:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

const setUpdatePassword = async (req, res) => {
  // Destructure currentPassword (optional) and newPassword from the request body
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res
      .status(400)
      .json({
        message: "La nueva contraseña debe tener al menos 6 caracteres.",
      });
  }

  try {
    const user = await userRepository.findUserById(req.user.id);

    if (!user) {
      // This case should ideally be caught by authentication middleware,
      // but good to have a fallback.
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    // Check if the user already has a password set (meaning they are changing it)
    if (user.password) {
      // If a password exists, currentPassword is required for security
      if (!currentPassword) {
        return res
          .status(400)
          .json({
            message: "Debe proporcionar su contraseña actual para cambiarla.",
          });
      }

      // Verify the current password
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res
          .status(401)
          .json({ message: "La contraseña actual es incorrecta." });
      }
    } else {
      // If no password is set, they are setting it for the first time.
      // In this case, currentPassword is not required from the client,
      // but we should ensure it's not accidentally sent or used if present.
      // No 'else if (!currentPassword)' needed here as it's optional for first-time set
    }

    // If we reach here, validation passed. Update the password.
    // userRepository.updateUserPassword handles hashing the new password
    await userRepository.updateUserPassword(req.user.id, newPassword);
    res
      .status(200)
      .json({ message: "Contraseña establecida/actualizada exitosamente." });
  } catch (error) {
    console.error("Error al establecer/actualizar contraseña:", error);
    res
      .status(500)
      .json({
        message: "Error interno del servidor al actualizar la contraseña.",
      });
  }
};

const unlinkGoogle = async (req, res) => {
  try {
    // Antes de desvincular, verificar si el usuario tiene una contraseña para iniciar sesión
    const user = await userRepository.findUserById(req.user.id);
    if (!user || !user.password) {
      return res
        .status(400)
        .json({
          message:
            "Necesitas tener una contraseña establecida antes de desvincular Google para asegurar el acceso futuro.",
        });
    }

    await userRepository.unlinkGoogleAccount(req.user.id);
    res
      .status(200)
      .json({ message: "Cuenta de Google desvinculada exitosamente." });
  } catch (error) {
    console.error("Error al desvincular cuenta de Google:", error.message);
    res
      .status(500)
      .json({
        message: "Error al desvincular cuenta de Google: " + error.message,
      });
  }
};

module.exports = {
  getUserProfile,
  setUpdatePassword,
  unlinkGoogle,
};
