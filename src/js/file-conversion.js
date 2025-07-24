// src/js/file-conversion.js
document.addEventListener("DOMContentLoaded", async () => {
  const fileInput = document.getElementById("fileInput");
  const outputFormatSelect = document.getElementById("outputFormat");
  // Since output format is now fixed to 'txt', we might not strictly need this
  // but keeping it for consistency in API calls.
  outputFormatSelect.value = "txt"; // Force it to 'txt'

  const documentTypeSelect = document.getElementById("documentType");
  const documentTypeGroup = document.getElementById("documentTypeGroup");
  const uploadButton = document.getElementById("uploadButton");
  const uploadMessage = document.getElementById("uploadMessage");
  const conversionJobsList = document.getElementById("conversionJobsList");
  const adminLink = document.getElementById("adminLink");

  // Check if user is admin
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

  // Show/hide document type selection based on input file type
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
    const outputFormat = outputFormatSelect.value; // Will be 'txt'
    const documentType = documentTypeSelect.value;

    if (!file) {
      uploadMessage.textContent = "Please select a file.";
      uploadMessage.style.color = "red";
      return;
    }
    // No need to check outputFormat as it's fixed

    const fileExtension = file.name.split(".").pop().toLowerCase();
    if (fileExtension === "txt" && !documentType) {
      uploadMessage.textContent =
        "Please select a document type for TXT input files.";
      uploadMessage.style.color = "red";
      return;
    }

    uploadMessage.textContent = "Uploading and converting...";
    uploadMessage.style.color = "orange";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("outputFormat", outputFormat); // Always 'txt'
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

      if (response.ok) {
        uploadMessage.textContent = result.message;
        uploadMessage.style.color = "green";
        fileInput.value = ""; // Clear the file input
        fetchConversionJobs(); // Refresh the list of jobs
      } else {
        uploadMessage.textContent = `Error: ${
          result.message || "Unknown error"
        }`;
        uploadMessage.style.color = "red";
      }
    } catch (error) {
      console.error("Fetch error:", error);
      uploadMessage.textContent = "Network error or server unreachable.";
      uploadMessage.style.color = "red";
    }
  });

  async function fetchConversionJobs() {
    try {
      const response = await fetch("/api/conversion-jobs", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const jobs = await response.json();

      conversionJobsList.innerHTML = ""; // Clear existing list

      if (jobs.length === 0) {
        conversionJobsList.innerHTML =
          '<p class="no-jobs">No hay trabajos de conversión aún.</p>';
        return;
      }

      jobs.forEach((job) => {
        const jobElement = document.createElement("div");
        jobElement.classList.add("conversion-job");
        jobElement.innerHTML = `
          <span><b>Original File:</b> ${job.fileName}</span>
          <span><b>Output Format:</b> ${job.outputFormat}</span>
          <span><b>Status:</b> <span class="status-badge status-${
            job.status
          }">${job.status.replace(/_/g, " ")}</span></span>
          <span><b>Submitted:</b> ${new Date(
            job.createdAt
          ).toLocaleString()}</span>
          ${
            job.completedAt
              ? `<span><b>Completed:</b> ${new Date(
                  job.completedAt
                ).toLocaleString()}</span>`
              : ""
          }
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
          window.location.href = `/api/convert/download/${jobId}`;
        });
      });

      conversionJobsList.querySelectorAll(".error-btn").forEach((button) => {
        button.addEventListener("click", (e) => {
          const jobId = e.target.dataset.jobId;
          window.location.href = `/api/convert/errors/${jobId}`;
        });
      });
    } catch (error) {
      console.error("Error fetching conversion jobs:", error);
      conversionJobsList.innerHTML =
        '<p class="no-jobs error-message">Error loading conversion history.</p>';
    }
  }
});
