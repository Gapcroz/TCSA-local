// /src/js/register.js
import { displayMessage } from './common.js';

const registerForm = document.getElementById('registerForm');
const messageElement = document.getElementById('message');

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (password !== confirmPassword) {
    displayMessage(messageElement, 'Las contraseñas no coinciden.', 'error');
    return;
  }

  if (password.length < 6) {
    displayMessage(
      messageElement,
      'La contraseña debe tener al menos 6 caracteres.',
      'error',
    );
    return;
  }

  try {
    const response = await fetch('/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      displayMessage(
        messageElement,
        data.message + ' Ahora puedes iniciar sesión.',
        'success',
      );
      // Optionally clear fields or redirect
      registerForm.reset();
      setTimeout(() => {
        window.location.href = '/auth/login'; // Redirect to login after successful registration
      }, 2000);
    } else {
      displayMessage(
        messageElement,
        data.message || 'Error al registrar usuario.',
        'error',
      );
    }
  } catch (error) {
    console.error('Error:', error);
    displayMessage(messageElement, 'Error de red o del servidor.', 'error');
  }
});