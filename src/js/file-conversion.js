document.addEventListener("DOMContentLoaded", async () => {
  // Element Selections
  const fileInput = document.getElementById("fileInput");
  const outputFormatSelect = document.getElementById("outputFormat");
  const documentTypeSelect = document.getElementById("documentType");
  const documentTypeGroup = document.getElementById("documentTypeGroup");
  const uploadButton = document.getElementById("uploadButton");
  const uploadMessage = document.getElementById("uploadMessage");
  const uploadResultDiv = document.getElementById("uploadResult");
  const conversionJobsList = document.getElementById("conversionJobsList");
  const adminLink = document.getElementById("adminLink");
  const paginationControls = document.getElementById("paginationControls");
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");
  const pageInfo = document.getElementById("pageInfo");

  // State Management
  let currentPage = 1;
  const jobsPerPage = 10;

  // --- Helper Functions ---

  const setButtonLoading = (isLoading) => {
    const btnText = uploadButton.querySelector(".btn-text");
    const spinner = uploadButton.querySelector(".spinner");
    uploadButton.disabled = isLoading;
    btnText.classList.toggle("hidden", isLoading);
    spinner.classList.toggle("hidden", !isLoading);
  };

  const displayUploadResult = (result) => {
    uploadResultDiv.innerHTML = "";
    uploadResultDiv.className = "conversion-result";

    let title,
      message,
      actionsHTML = "";

    if (result.status === "completed") {
      uploadResultDiv.classList.add("success");
      title = "Exportación Exitosa";
      message = `El archivo se ha exportado correctamente como '${result.documentType}'.`;
      actionsHTML = `<a href="/api/files/${result.jobId}/download" target="_blank">Descargar Archivo Exportado</a>`;
    } else if (result.status === "completed_with_errors") {
      uploadResultDiv.classList.add("warning");
      title = "Completada con Errores";
      message =
        "El archivo se procesó, pero se encontraron problemas. Revise el reporte de errores.";
      actionsHTML = `
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

  const displayApiError = (errorMessage) => {
    uploadResultDiv.innerHTML = "";
    uploadResultDiv.className = "conversion-result error";
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
      if (response.ok) {
        const data = await response.json();
        if (data.isAdmin) {
          adminLink.classList.remove("hidden");
        }
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  };

  const updatePaginationControls = (data) => {
    if (data.totalPages <= 1) {
      paginationControls.classList.add("hidden");
      return;
    }
    pageInfo.textContent = `Página ${data.currentPage} de ${data.totalPages}`;
    prevPageBtn.disabled = data.currentPage <= 1;
    nextPageBtn.disabled = data.currentPage >= data.totalPages;
    paginationControls.classList.remove("hidden");
  };

  // --- Main Logic and Event Listeners ---

  await checkAdminStatus();
  fetchConversionJobs(currentPage);

  // When a new file is selected, reset the UI state.
  fileInput.addEventListener("change", () => {
    const fileName = fileInput.files[0] ? fileInput.files[0].name : "";
    const fileExtension = fileName.split(".").pop().toLowerCase();

    // Always hide the result box and message when a new file is chosen
    uploadResultDiv.classList.add("hidden");
    uploadMessage.textContent = "";

    // Show dropdown for TXT, hide it for others to start with a clean slate.
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

    uploadMessage.textContent = "";
    uploadResultDiv.classList.add("hidden");

    if (!file) {
      displayApiError("Por favor, seleccione un archivo.");
      return;
    }

    // If the dropdown is visible, a selection is mandatory.
    if (
      documentTypeGroup.style.display === "block" &&
      !documentType
    ) {
      displayApiError("Por favor, seleccione un tipo de documento.");
      return;
    }

    setButtonLoading(true);
    uploadMessage.textContent = "Subiendo y procesando...";
    uploadMessage.style.color = "orange";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("outputFormat", outputFormat);

    // Append documentType if the dropdown is visible (for TXT or ambiguity fallback)
    if (documentTypeGroup.style.display === "block") {
      formData.append("documentType", documentType);
    }

    try {
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
        // Assuming JWT is handled by a session or another mechanism if not in localStorage
      });

      const result = await response.json();
      uploadMessage.textContent = "";

      if (response.ok) {
        displayUploadResult(result);
        fileInput.value = ""; // Clear file input on success
        documentTypeGroup.style.display = "none"; // Hide dropdown
        currentPage = 1;
        fetchConversionJobs(currentPage, result.jobId);
      } else {
        // --- NEW: Handle ambiguity error specifically ---
        if (result.errorType === "AMBIGUITY_DETECTED") {
          displayApiError(
            "No se pudo determinar el tipo de archivo automáticamente. Por favor, selecciónelo manualmente y vuelva a intentarlo."
          );
          documentTypeGroup.style.display = "block"; // Show the dropdown
        } else {
          displayApiError(result.message);
        }
      }
    } catch (error) {
      uploadMessage.textContent = "";
      displayApiError("Error de red o el servidor no responde.");
      console.error("Fetch error:", error);
    } finally {
      setButtonLoading(false);
    }
  });

  // Pagination and Job Fetching logic (remains unchanged)
  prevPageBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      fetchConversionJobs(currentPage);
    }
  });

  nextPageBtn.addEventListener("click", () => {
    currentPage++;
    fetchConversionJobs(currentPage);
  });

  async function fetchConversionJobs(page, newJobId = null) {
    try {
      const response = await fetch(
        `/api/conversion-jobs?page=${page}&limit=${jobsPerPage}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch job history.");
      }
      const data = await response.json();
      const { jobs } = data;

      conversionJobsList.innerHTML = "";

      if (jobs.length === 0) {
        paginationControls.classList.add("hidden");
        conversionJobsList.innerHTML =
          '<p class="no-jobs">No hay trabajos de conversión aún.</p>';
        return;
      }

      updatePaginationControls(data);

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
              job.convertedFilePath
                ? `<button class="download-btn" data-job-id="${job._id}">Download Exported</button>`
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
      paginationControls.classList.add("hidden");
      conversionJobsList.innerHTML =
        '<p class="no-jobs error-message">Error loading conversion history.</p>';
    }
  }
});