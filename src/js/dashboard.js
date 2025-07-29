// /src/js/dashboard.js
import { displayMessage } from './common.js';

const userNameElement = document.getElementById('userName');
const apiAccessStatusElement = document.getElementById('apiAccessStatus');

// Account Settings Tab Elements
const googleLinkedStatusElement = document.getElementById('googleLinkedStatus');
const passwordSetStatusElement = document.getElementById('passwordSetStatus');
const linkGoogleBtn = document.getElementById('linkGoogleBtn');
const unlinkGoogleBtn = document.getElementById('unlinkGoogleBtn');
const setPasswordBtn = document.getElementById('setPasswordBtn');
const currentPasswordInput = document.getElementById('currentPassword'); // Added
const newPasswordInput = document.getElementById('newPassword');
const passwordMessageElement = document.getElementById('passwordMessage');
const googleMessageElement = document.getElementById('googleMessage');

// Account Overview Tab Elements
const getJwtBtn = document.getElementById('getJwtBtn');
const jwtMessageElement = document.getElementById('jwtMessage');
const jwtTokenDisplay = document.getElementById('jwtTokenDisplay');
const copyJwtBtn = document.getElementById('copyJwtBtn'); // New copy button

const adminLink = document.getElementById('adminLink');

// Tab functionality
document.querySelectorAll('.tab-button').forEach((button) => {
  button.addEventListener('click', () => {
    const tabToActivate = button.dataset.tab;

    // Deactivate current active tab button and pane
    document.querySelector('.tab-button.active').classList.remove('active');
    document.querySelector('.tab-pane.active').classList.remove('active');

    // Activate new tab button and pane
    button.classList.add('active');
    document.getElementById(tabToActivate).classList.add('active');
  });
});

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

      // Update Account Settings tab info
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
  jwtTokenDisplay.querySelector('code').textContent = '';
  jwtMessageElement.className = 'message'; // Reset class
  jwtTokenDisplay.classList.remove('bugged'); // Remove bugged class
  copyJwtBtn.classList.add('hidden'); // Hide copy button initially

  try {
    const response = await fetch('/auth/jwt');
    const data = await response.json();

    if (response.ok) {
      const token = data.token;
      jwtTokenDisplay.querySelector('code').textContent = token;
      jwtTokenDisplay.classList.remove('bugged'); // Ensure it's not bugged
      copyJwtBtn.classList.remove('hidden'); // Show copy button
      displayMessage(jwtMessageElement, data.message, 'success');
    } else {
      jwtTokenDisplay.querySelector('code').textContent =
        'Error al cargar JWT. Intente de nuevo.';
      jwtTokenDisplay.classList.add('bugged'); // Add bugged class for visual cue
      copyJwtBtn.classList.add('hidden'); // Keep copy button hidden
      displayMessage(
        jwtMessageElement,
        data.message || 'Error al obtener JWT.',
        'error',
      );
    }
  } catch (error) {
    console.error('Error:', error);
    jwtTokenDisplay.querySelector('code').textContent =
      'Error de red o del servidor al obtener JWT.';
    jwtTokenDisplay.classList.add('bugged'); // Add bugged class for network error
    copyJwtBtn.classList.add('hidden'); // Keep copy button hidden
    displayMessage(
      jwtMessageElement,
      'Error de red o del servidor.',
      'error',
    );
  }
});

copyJwtBtn.addEventListener('click', () => {
  const jwtText = jwtTokenDisplay.querySelector('code').textContent;
  navigator.clipboard.writeText(jwtText).then(
    () => {
      displayMessage(jwtMessageElement, 'JWT copiado al portapapeles!', 'info');
    },
    (err) => {
      displayMessage(jwtMessageElement, 'Error al copiar JWT.', 'error');
      console.error('Error copying JWT: ', err);
    },
  );
});

setPasswordBtn.addEventListener('click', async () => {
  const currentPassword = currentPasswordInput.value;
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
      'La nueva contraseña debe tener al menos 6 caracteres.',
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
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await response.json();
    if (response.ok) {
      displayMessage(passwordMessageElement, data.message, 'success');
      currentPasswordInput.value = '';
      newPasswordInput.value = '';
      fetchUserData(); // Refresh status
    } else {
      displayMessage(
        passwordMessageElement,
        data.message || 'Error al establecer/cambiar contraseña.',
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

unlinkGoogleBtn.addEventListener('click', async () => {
  googleMessageElement.textContent = '';
  googleMessageElement.className = 'message';

  if (
    !confirm(
      '¿Está seguro de que desea desvincular su cuenta de Google? Si no tiene una contraseña establecida, no podrá iniciar sesión después con email/password.',
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
      fetchUserData(); // Refresh status
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
});

document.addEventListener('DOMContentLoaded', fetchUserData);