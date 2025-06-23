// src/js/login.js
import { displayMessage } from './common.js';

const messageElement = document.getElementById('message');
const loginForm = document.getElementById('loginForm');

loginForm.addEventListener('submit', async (e) => {
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
     if (response.redirected) {
      // If the server redirected, it means we're going to an HTML page (like /access-pending)
      // or to the dashboard. Let the browser handle the full page redirect.
      window.location.href = response.url;
      return; // Stop further processing in this function
    }
    const data = await response.json();

    if (response.ok) {
      displayMessage(messageElement, data.message, 'success');
      if (data.redirect) {
        setTimeout(() => {
          window.location.href = data.redirect;
        }, 1000);
      }
    } else {
      displayMessage(
        messageElement,
        data.message || 'Error al iniciar sesión.',
        'error',
      );
    }
  } catch (error) {
    console.error('Error:', error);
    displayMessage(messageElement, 'Error de red o del servidor.', 'error');
  }
});