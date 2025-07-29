// services/sftpService.js
const Client = require("ssh2-sftp-client");
const fs = require("fs/promises");
const path = require("path");

const sftpConfig = {
  host: process.env.SFTP_HOST,
  port: parseInt(process.env.SFTP_PORT || "22", 10),
  username: process.env.SFTP_USERNAME,
  password: process.env.SFTP_PASSWORD,
  // For production, consider using privateKey instead of password for better security
  // privateKey: require('fs').readFileSync('/path/to/your/private_key'),
};

/**
 * Uploads a file to the SFTP server.
 * @param {string} localFilePath - The full path to the local file to upload.
 * @param {string} remoteFilePath - The desired full path on the SFTP server (e.g., '/upload/my_file.txt').
 * @returns {Promise<void>}
 */
const uploadFileViaSftp = async (localFilePath, remoteFilePath) => {
  const sftp = new Client();
  try {
    console.log(
      `[SFTP Service] Connecting to SFTP server: ${sftpConfig.host}:${sftpConfig.port}...`
    );
    await sftp.connect(sftpConfig);
    console.log(
      `[SFTP Service] Connected. Uploading ${localFilePath} to ${remoteFilePath}...`
    );

    await sftp.put(localFilePath, remoteFilePath);
    console.log(
      `[SFTP Service] Successfully uploaded ${localFilePath} to ${remoteFilePath}`
    );
  } catch (err) {
    console.error(
      `[SFTP Service] SFTP upload failed for ${localFilePath}:`,
      err
    );
    throw new Error(`SFTP upload failed: ${err.message}`);
  } finally {
    sftp.end();
  }
};

/**
 * Downloads a file from the SFTP server. (Optional, if you need to fetch files)
 * @param {string} remoteFilePath - The full path to the file on the SFTP server.
 * @param {string} localFilePath - The local path where the file should be saved.
 * @returns {Promise<void>}
 */
const downloadFileViaSftp = async (remoteFilePath, localFilePath) => {
  const sftp = new Client();
  try {
    console.log(`[SFTP Service] Connecting to SFTP server for download.`);
    await sftp.connect(sftpConfig);
    console.log(
      `[SFTP Service] Downloading ${remoteFilePath} to ${localFilePath}...`
    );
    await sftp.get(remoteFilePath, localFilePath);
    console.log(`[SFTP Service] Successfully downloaded ${remoteFilePath}`);
  } catch (err) {
    console.error(
      `[SFTP Service] SFTP download failed for ${remoteFilePath}:`,
      err
    );
    throw new Error(`SFTP download failed: ${err.message}`);
  } finally {
    sftp.end();
  }
};

module.exports = {
  uploadFileViaSftp,
  downloadFileViaSftp, // Export if needed
};
