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
          
          // Columna 1: Display Name
          const cellName = row.insertCell();
          cellName.textContent = user.displayName || user.email;
          
          // Columna 2: Role Select
          const cellRole = row.insertCell();
          const roleSelect = document.createElement('select');
          roleSelect.id = `role-${user.id}`;
          roleSelect.dataset.userid = user.id;
          
          const optionUser = document.createElement('option');
          optionUser.value = 'user';
          optionUser.textContent = 'Usuario';
          optionUser.selected = user.role === 'user';
          
          const optionAdmin = document.createElement('option');
          optionAdmin.value = 'admin';
          optionAdmin.textContent = 'Admin';
          optionAdmin.selected = user.role === 'admin';
          
          roleSelect.appendChild(optionUser);
          roleSelect.appendChild(optionAdmin);
          cellRole.appendChild(roleSelect);
          
          // Columna 3: Active Status
          const cellStatus = row.insertCell();
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.id = `isActive-${user.id}`;
          checkbox.dataset.userid = user.id;
          checkbox.checked = user.isActive;
          
          const label = document.createElement('label');
          label.htmlFor = `isActive-${user.id}`;
          label.className = user.isActive ? 'status-active' : 'status-inactive';
          label.textContent = user.isActive ? 'Activo' : 'Inactivo';
          
          cellStatus.appendChild(checkbox);
          cellStatus.appendChild(label);
          
          // Columna 4: Botones de acción
          const cellActions = row.insertCell();
          
          const saveBtn = document.createElement('button');
          saveBtn.className = 'save-btn';
          saveBtn.textContent = 'Guardar';
          saveBtn.dataset.userid = user.id;
          saveBtn.addEventListener('click', () => handleUpdateUser(user.id));
          
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'delete-btn';
          deleteBtn.textContent = 'Eliminar';
          deleteBtn.dataset.userid = user.id;
          deleteBtn.dataset.email = user.email;
          deleteBtn.addEventListener('click', () => handleDeleteUser(user.id, user.email));
          
          cellActions.appendChild(saveBtn);
          cellActions.appendChild(deleteBtn);
        });
      } else {
        // Usar DOM API en lugar de innerHTML para consistencia
        const row = usersTableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 4;
        cell.className = 'no-users';
        cell.textContent = 'No hay usuarios registrados.';
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

// Función para actualizar usuario
async function handleUpdateUser(userId) {
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

// Función para eliminar usuario
async function handleDeleteUser(userId, userEmail) {
  const confirmDelete = confirm(`¿Estás seguro de eliminar al usuario "${userEmail}"? Esta acción no se puede deshacer.`);
  if (!confirmDelete) return;

  try {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (response.ok) {
      displayMessage(adminMessageElement, data.message, 'success');
      fetchUsers();
    } else {
      displayMessage(adminMessageElement, data.message, 'error');
    }
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    displayMessage(adminMessageElement, 'Error al eliminar usuario.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', fetchUsers);