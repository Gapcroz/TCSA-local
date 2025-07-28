document.addEventListener("DOMContentLoaded", async () => {
  const fileInput = document.getElementById("fileInput");
  const outputFormatSelect = document.getElementById("outputFormat");
  const documentTypeSelect = document.getElementById("documentType");
  const documentTypeGroup = document.getElementById("documentTypeGroup");
  const uploadButton = document.getElementById("uploadButton");
  const uploadMessage = document.getElementById("uploadMessage");
  const uploadResultDiv = document.getElementById("uploadResult");
  const conversionJobsList = document.getElementById("conversionJobsList");
  const adminLink = document.getElementById("adminLink");

  // Helper to manage button state
  const setButtonLoading = (isLoading) => {
    const btnText = uploadButton.querySelector(".btn-text");
    const spinner = uploadButton.querySelector(".spinner");
    uploadButton.disabled = isLoading;
    btnText.classList.toggle("hidden", isLoading);
    spinner.classList.toggle("hidden", !isLoading);
  };

  // Helper to display the final result in its own dedicated div
  const displayUploadResult = (result) => {
    uploadResultDiv.innerHTML = "";
    uploadResultDiv.className = "conversion-result"; // Reset classes

    let title, message, actionsHTML = "";

    if (result.status === "completed") {
      uploadResultDiv.classList.add("success");
      title = "Conversión Exitosa";
      message = "El archivo se ha convertido correctamente.";
      actionsHTML = `<a href="/api/files/${result.jobId}/download" target="_blank">Descargar Archivo Convertido</a>`;
    } else if (result.status === "completed_with_errors") {
      uploadResultDiv.classList.add("warning");
      title = "Conversión Completada con Errores";
      message =
        "El archivo se procesó, pero se encontraron algunos problemas. Revise el reporte de errores para más detalles.";
      actionsHTML = `
        <a href="/api/files/${result.jobId}/download" target="_blank">Descargar Archivo (con errores)</a>
        <a href="/api/files/${result.jobId}/errors" target="_blank">Descargar Reporte de Errores</a>
      `;
    }

    uploadResultDiv.innerHTML = `
      <h4>${title}</h4>
      <p>${message}</p>
      <div class="result-actions">${actionsHTML}</div>
    `;
    uploadResultDiv.classList.remove("hidden");
  };

  // Helper to display critical API errors in the result box
  const displayApiError = (errorMessage) => {
    uploadResultDiv.innerHTML = "";
    uploadResultDiv.className = "conversion-result error"; // Reset and add error class
    uploadResultDiv.innerHTML = `
      <h4>Error en la Solicitud</h4>
      <p>${
        errorMessage || "Ocurrió un error desconocido. Inténtelo de nuevo."
      }</p>
    `;
    uploadResultDiv.classList.remove("hidden");
  };

  const checkAdminStatus = async () => {
    try {
      const response = await fetch("/auth/check-admin");
      const data = await response.json();
      if (data.isAdmin) {
        adminLink.classList.remove("hidden");
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  };

  await checkAdminStatus();
  fetchConversionJobs();

  fileInput.addEventListener("change", () => {
    const fileName = fileInput.files[0] ? fileInput.files[0].name : "";
    const fileExtension = fileName.split(".").pop().toLowerCase();
    if (fileExtension === "txt") {
      documentTypeGroup.style.display = "block";
    } else {
      documentTypeGroup.style.display = "none";
      documentTypeSelect.value = ""; // Reset selection
    }
  });

  uploadButton.addEventListener("click", async () => {
    const file = fileInput.files[0];
    const outputFormat = outputFormatSelect.value;
    const documentType = documentTypeSelect.value;

    // Hide previous results and messages on new attempt
    uploadMessage.textContent = "";
    uploadResultDiv.classList.add("hidden");

    if (!file) {
      displayApiError("Por favor, seleccione un archivo.");
      return;
    }

    const fileExtension = file.name.split(".").pop().toLowerCase();
    if (fileExtension === "txt" && !documentType) {
      displayApiError(
        "Por favor, seleccione un tipo de documento para archivos TXT."
      );
      return;
    }

    setButtonLoading(true);
    uploadMessage.textContent = "Subiendo y convirtiendo...";
    uploadMessage.style.color = "orange";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("outputFormat", outputFormat);
    if (fileExtension === "txt") {
      formData.append("documentType", documentType);
    }

    try {
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const result = await response.json();
      uploadMessage.textContent = ""; // Clear "in progress" message

      if (response.ok) {
        displayUploadResult(result);
        fileInput.value = ""; // Clear the file input
        fetchConversionJobs(result.jobId); // Refresh list and highlight new job
      } else {
        // Use the new error display for 4xx/5xx errors
        displayApiError(result.message);
      }
    } catch (error) {
      // Use the new error display for network errors
      uploadMessage.textContent = "";
      displayApiError("Error de red o el servidor no responde.");
      console.error("Fetch error:", error);
    } finally {
      setButtonLoading(false);
    }
  });

  async function fetchConversionJobs(newJobId = null) {
    try {
      // This endpoint now exists and will be created below
      const response = await fetch("/api/conversion-jobs", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch job history.");
      }
      const jobs = await response.json();

      conversionJobsList.innerHTML = "";

      if (jobs.length === 0) {
        conversionJobsList.innerHTML =
          '<p class="no-jobs">No hay trabajos de conversión aún.</p>';
        return;
      }

      jobs.forEach((job) => {
        const jobElement = document.createElement("div");
        jobElement.classList.add("conversion-job");
        if (job._id === newJobId) {
          jobElement.classList.add("new-job");
        }
        jobElement.dataset.jobId = job._id;

        jobElement.innerHTML = `
          <div>
            <span class="job-label">Original File</span>
            ${job.fileName}
          </div>
          <div>
            <span class="job-label">Status</span>
            <span class="status-badge status-${job.status}">
              ${job.status.replace(/_/g, " ")}
            </span>
          </div>
          <div>
            <span class="job-label">Submitted</span>
            ${new Date(job.createdAt).toLocaleString()}
          </div>
          <div>
            <span class="job-label">Completed</span>
            ${
              job.completedAt
                ? new Date(job.completedAt).toLocaleString()
                : "N/A"
            }
          </div>
          <div class="job-actions">
            ${
              job.status === "completed" ||
              job.status === "completed_with_errors"
                ? `<button class="download-btn" data-job-id="${job._id}">Download Converted</button>`
                : ""
            }
            ${
              job.errorReportPath
                ? `<button class="error-btn" data-job-id="${job._id}">Download Error Report</button>`
                : ""
            }
          </div>
        `;
        conversionJobsList.appendChild(jobElement);
      });

      // Add event listeners for download buttons
      conversionJobsList.querySelectorAll(".download-btn").forEach((button) => {
        button.addEventListener("click", (e) => {
          const jobId = e.target.dataset.jobId;
          window.location.href = `/api/files/${jobId}/download`;
        });
      });

      conversionJobsList.querySelectorAll(".error-btn").forEach((button) => {
        button.addEventListener("click", (e) => {
          const jobId = e.target.dataset.jobId;
          window.location.href = `/api/files/${jobId}/errors`;
        });
      });

      // Remove highlight after a delay
      if (newJobId) {
        setTimeout(() => {
          const newJobElement = conversionJobsList.querySelector(".new-job");
          if (newJobElement) {
            newJobElement.classList.remove("new-job");
          }
        }, 3000);
      }
    } catch (error) {
      console.error("Error fetching conversion jobs:", error);
      conversionJobsList.innerHTML =
        '<p class="no-jobs error-message">Error loading conversion history.</p>';
    }
  }
});