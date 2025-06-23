// /src/js/admin-dashboard.js
import { displayMessage } from './common.js';

const usersTableBody = document.getElementById('usersTableBody');
const adminMessageElement = document.getElementById('adminMessage');

async function fetchUsers() {
  try {
    const response = await fetch('/api/admin/users');
    const data = await response.json();

    if (response.ok) {
      usersTableBody.innerHTML = '';
      if (data.length > 0) {
        data.forEach((user) => {
          const row = usersTableBody.insertRow();
          row.innerHTML = `
            <td>${user.displayName || user.email}</td>
            <td>
              <select id="role-${user.id}" data-userid="${user.id}">
                <option value="user" ${
                  user.role === 'user' ? 'selected' : ''
                }>Usuario</option>
                <option value="admin" ${
                  user.role === 'admin' ? 'selected' : ''
                }>Admin</option>
              </select>
            </td>
            <td>
              <input type="checkbox" id="isActive-${user.id}" data-userid="${
            user.id
          }" ${user.isActive ? 'checked' : ''}>
              <label for="isActive-${user.id}" class="${
            user.isActive ? 'status-active' : 'status-inactive'
          }">${user.isActive ? 'Activo' : 'Inactivo'}</label>
            </td>
            <td>
              <button class="save-btn" onclick="updateUser('${
                user.id
              }')">Guardar</button>
            </td>
          `;
        });
      } else {
        usersTableBody.innerHTML = `<tr><td colspan="4" class="no-users">No hay usuarios registrados.</td></tr>`;
      }
    } else {
      console.error('Error fetching users:', data.message);
      displayMessage(
        adminMessageElement,
        data.message || 'Error al cargar usuarios.',
        'error',
      );
      if (response.status === 403 || response.status === 401) {
        setTimeout(() => {
          window.location.href = '/auth/dashboard';
        }, 2000);
      }
    }
  } catch (error) {
    console.error('Network error fetching users:', error);
    displayMessage(
      adminMessageElement,
      'Error de red al cargar usuarios.',
      'error',
    );
  }
}

window.updateUser = async function(userId) { // Make global for onclick
  const roleSelect = document.getElementById(`role-${userId}`);
  const isActiveCheckbox = document.getElementById(`isActive-${userId}`);

  const newRole = roleSelect.value;
  const newIsActive = isActiveCheckbox.checked;

  try {
    const response = await fetch(`/api/admin/users/${userId}/access`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        isActive: newIsActive,
        role: newRole,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      displayMessage(adminMessageElement, data.message, 'success');
      fetchUsers();
    } else {
      displayMessage(
        adminMessageElement,
        data.message || 'Error al actualizar usuario.',
        'error',
      );
    }
  } catch (error) {
    console.error('Error updating user:', error);
    displayMessage(adminMessageElement, 'Error de red o del servidor.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', fetchUsers);