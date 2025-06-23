import { displayMessage } from './common.js';

const uploadButton = document.getElementById('uploadButton');
const fileInput = document.getElementById('fileInput');
const outputFormat = document.getElementById('outputFormat');
const uploadMessageElement = document.getElementById('uploadMessage');
const conversionJobsList = document.getElementById('conversionJobsList');
const adminLink = document.getElementById('adminLink');

async function fetchConversionJobs() {
  try {
    const response = await fetch('/api/user/conversion-jobs');
    const data = await response.json();

    if (response.ok) {
      conversionJobsList.innerHTML = '';
      if (data.jobs && data.jobs.length > 0) {
        data.jobs.forEach((job) => {
          const jobElement = document.createElement('div');
          jobElement.className = 'conversion-job';
          jobElement.innerHTML = `
            <span>Archivo: <strong>${job.fileName}</strong></span>
            <span>Formato: <strong>${job.outputFormat.toUpperCase()}</strong></span>
            <span class="status-badge status-${job.status}">${job.status.replace(
              '_',
              ' ',
            )}</span>
            <div class="job-actions">
              ${
                job.status === 'completed' ||
                job.status === 'completed_with_errors'
                  ? `<button class="download-btn" onclick="downloadFile('${job._id}')">Descargar</button>`
                  : ''
              }
              ${
                job.status === 'completed_with_errors' ||
                job.status === 'failed'
                  ? `<button class="error-btn" onclick="downloadErrorReport('${job._id}')">Errores</button>`
                  : ''
              }
            </div>
          `;
          conversionJobsList.appendChild(jobElement);
        });
      } else {
        conversionJobsList.innerHTML =
          '<p class="no-jobs">No hay trabajos de conversión aún.</p>';
      }
    } else {
      console.error('Error fetching conversion jobs:', data.message);
      displayMessage(
        uploadMessageElement,
        'Error al cargar historial de conversiones.',
        'error',
      );
    }
  } catch (error) {
    console.error('Network error fetching conversion jobs:', error);
    displayMessage(
      uploadMessageElement,
      'Error de red al cargar historial de conversiones.',
      'error',
    );
  }
}

window.downloadFile = async function (jobId) { // Make global for onclick
  try {
    const response = await fetch(`/api/files/${jobId}/download`);
    if (response.ok) {
      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'converted_file';
      if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
          if (filenameMatch && filenameMatch[1]) {
              filename = filenameMatch[1];
          }
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      displayMessage(uploadMessageElement, 'Descarga iniciada.', 'success');
    } else {
      const errorData = await response.json();
      displayMessage(
        uploadMessageElement,
        errorData.message || 'Error al descargar el archivo.',
        'error',
      );
    }
  } catch (error) {
    console.error('Error downloading file:', error);
    displayMessage(uploadMessageElement, 'Error de red al descargar.', 'error');
  }
}

window.downloadErrorReport = async function (jobId) { // Make global for onclick
  try {
    const response = await fetch(`/api/files/${jobId}/errors`);
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `error_report_${jobId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      displayMessage(uploadMessageElement, 'Descarga del reporte de errores iniciada.', 'success');
    } else {
      const errorData = await response.json();
      displayMessage(
        uploadMessageElement,
        errorData.message || 'Error al descargar el reporte de errores.',
        'error',
      );
    }
  } catch (error) {
    console.error('Error downloading error report:', error);
    displayMessage(uploadMessageElement, 'Error de red al descargar el reporte de errores.', 'error');
  }
}

async function checkUserRole() {
  try {
    const response = await fetch('/api/user/profile');
    const data = await response.json();
    if (response.ok && data.user && data.user.role === 'admin') {
      adminLink.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error checking user role:', error);
  }
}

uploadButton.addEventListener('click', async () => {
  const file = fileInput.files[0];
  const format = outputFormat.value;

  if (!file) {
    displayMessage(
      uploadMessageElement,
      'Por favor, seleccione un archivo.',
      'error',
    );
    return;
  }

  if (!format) {
    displayMessage(
      uploadMessageElement,
      'Por favor, seleccione un formato de salida.',
      'error',
    );
    return;
  }

  displayMessage(
    uploadMessageElement,
    'Subiendo y convirtiendo... Por favor, espere.',
    'info',
  );

  const formData = new FormData();
  formData.append('file', file);
  formData.append('outputFormat', format);

  try {
    const response = await fetch('/api/files/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (response.ok) {
      displayMessage(
        uploadMessageElement,
        data.message + ' ID del trabajo: ' + data.jobId,
        'success',
      );
      fileInput.value = '';
      outputFormat.value = '';
      fetchConversionJobs();
    } else {
      displayMessage(
        uploadMessageElement,
        data.message || 'Error al subir y convertir el archivo.',
        'error',
      );
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    displayMessage(
      uploadMessageElement,
      'Error de red o del servidor al subir el archivo.',
      'error',
    );
  }
});

document.addEventListener('DOMContentLoaded', () => {
  fetchConversionJobs();
  checkUserRole();
});