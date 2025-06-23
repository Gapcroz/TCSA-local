import { displayMessage } from './common.js';

const userNameElement = document.getElementById('userName');
const apiAccessStatusElement = document.getElementById('apiAccessStatus');
const googleLinkedStatusElement = document.getElementById('googleLinkedStatus');
const passwordSetStatusElement = document.getElementById('passwordSetStatus');
const linkGoogleBtn = document.getElementById('linkGoogleBtn');
const unlinkGoogleBtn = document.getElementById('unlinkGoogleBtn');
const setPasswordBtn = document.getElementById('setPasswordBtn');
const newPasswordInput = document.getElementById('newPassword');
const passwordMessageElement = document.getElementById('passwordMessage');
const googleMessageElement = document.getElementById('googleMessage');
const getJwtBtn = document.getElementById('getJwtBtn');
const jwtMessageElement = document.getElementById('jwtMessage');
const jwtTokenDisplay = document.getElementById('jwtTokenDisplay');
const adminLink = document.getElementById('adminLink');

async function fetchUserData() {
  try {
    const response = await fetch('/api/user/profile');
    const data = await response.json();

    if (response.ok) {
      const user = data.user;
      userNameElement.textContent = user.displayName || user.email;
      apiAccessStatusElement.textContent = user.isActive
        ? 'Activo'
        : 'Inactivo (contacta al admin)';
      apiAccessStatusElement.style.color = user.isActive ? 'green' : 'red';

      googleLinkedStatusElement.textContent = user.googleId
        ? 'Vinculado con Google'
        : 'No vinculado con Google';
      googleLinkedStatusElement.style.color = user.googleId ? 'green' : 'red';

      passwordSetStatusElement.textContent = user.passwordSet
        ? 'Contraseña establecida'
        : 'No hay contraseña establecida';
      passwordSetStatusElement.style.color = user.passwordSet ? 'green' : 'red';

      if (user.googleId) {
        linkGoogleBtn.classList.add('hidden');
        unlinkGoogleBtn.classList.remove('hidden');
      } else {
        linkGoogleBtn.classList.remove('hidden');
        unlinkGoogleBtn.classList.add('hidden');
      }
      setPasswordBtn.textContent = user.passwordSet
        ? 'Cambiar Contraseña'
        : 'Establecer Contraseña';

      if (user.role === 'admin') {
        adminLink.classList.remove('hidden');
      } else {
        adminLink.classList.add('hidden');
      }
    } else {
      console.error('Error fetching user data:', data.message);
      window.location.href = '/auth/login';
    }
  } catch (error) {
    console.error('Network error fetching user data:', error);
    window.location.href = '/auth/login';
  }
}

getJwtBtn.addEventListener('click', async () => {
  jwtMessageElement.textContent = '';
  jwtTokenDisplay.textContent = '';
  jwtMessageElement.className = 'message'; // Reset class

  try {
    const response = await fetch('/auth/jwt');
    const data = await response.json();

    if (response.ok) {
      jwtTokenDisplay.textContent = data.token;
      displayMessage(jwtMessageElement, data.message, 'success');
    } else {
      jwtTokenDisplay.textContent = '';
      displayMessage(
        jwtMessageElement,
        data.message || 'Error al obtener JWT.',
        'error',
      );
    }
  } catch (error) {
    console.error('Error:', error);
    displayMessage(
      jwtMessageElement,
      'Error de red o del servidor.',
      'error',
    );
  }
});

setPasswordBtn.addEventListener('click', async () => {
  const newPassword = newPasswordInput.value;
  passwordMessageElement.textContent = '';
  passwordMessageElement.className = 'message';

  if (!newPassword) {
    displayMessage(
      passwordMessageElement,
      'Por favor, ingrese una nueva contraseña.',
      'error',
    );
    return;
  }
  if (newPassword.length < 6) {
    displayMessage(
      passwordMessageElement,
      'La contraseña debe tener al menos 6 caracteres.',
      'error',
    );
    return;
  }

  try {
    const response = await fetch('/api/user/set-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ newPassword }),
    });

    const data = await response.json();
    if (response.ok) {
      displayMessage(passwordMessageElement, data.message, 'success');
      newPasswordInput.value = '';
      fetchUserData();
    } else {
      displayMessage(
        passwordMessageElement,
        data.message || 'Error al establecer contraseña.',
        'error',
      );
    }
  } catch (error) {
    console.error('Error:', error);
    displayMessage(
      passwordMessageElement,
      'Error de red o del servidor.',
      'error',
    );
  }
});

window.unlinkGoogle = async function() { // Make global for onclick
  googleMessageElement.textContent = '';
  googleMessageElement.className = 'message';

  if (
    !confirm(
      '¿Está seguro de que desea desvincular su cuenta de Google? Si no tiene una contraseña establecida, no podrá iniciar sesión después.',
    )
  ) {
    return;
  }

  try {
    const response = await fetch('/api/user/unlink-google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    if (response.ok) {
      displayMessage(googleMessageElement, data.message, 'success');
      fetchUserData();
    } else {
      displayMessage(
        googleMessageElement,
        data.message || 'Error al desvincular Google.',
        'error',
      );
    }
  } catch (error) {
    console.error('Error:', error);
    displayMessage(
      googleMessageElement,
      'Error de red o del servidor.',
      'error',
    );
  }
}

document.addEventListener('DOMContentLoaded', fetchUserData);