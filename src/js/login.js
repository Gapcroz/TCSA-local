import { displayMessage } from './common.js';

const messageElement = document.getElementById('message');

document
  .getElementById('authForm')
  .addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
      const response = await fetch('/auth/local-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        displayMessage(messageElement, data.message, 'success');
        if (data.redirect) {
          setTimeout(() => {
            window.location.href = data.redirect;
          }, 1000);
        }
      } else {
        displayMessage(messageElement, data.message || 'Error al iniciar sesión.', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      displayMessage(messageElement, 'Error de red o del servidor.', 'error');
    }
  });

document
  .getElementById('registerButton')
  .addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
      displayMessage(messageElement, 'Por favor, ingrese email y contraseña para registrarse.', 'error');
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
        document.getElementById('password').value = '';
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