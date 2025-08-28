// services/sftpService.js
const Client = require("ssh2-sftp-client");
const fs = require("fs/promises");
const path = require("path");

const sftpConfig = {
  host: process.env.SFTP_HOST,
  port: parseInt(process.env.SFTP_PORT || "22", 10),
  username: process.env.SFTP_USERNAME,
  password: process.env.SFTP_PASSWORD,
  privateKey: process.env.SFTP_PRIVATE_KEY_PATH
    ? require("fs").readFileSync(process.env.SFTP_PRIVATE_KEY_PATH)
    : undefined,
  // endurecer conexión
  readyTimeout: 20000, // 20s para establecer sesión
  keepaliveInterval: 10000, // ping cada 10s
  keepaliveCountMax: 5,
};

const NAME_STRATEGY = (
  process.env.SFTP_NAME_CONFLICT_STRATEGY || "timestamp"
).toLowerCase();

/** Util: separa nombre y extensión para rutas POSIX */
function splitExtPosix(filename) {
  const idx = filename.lastIndexOf(".");
  if (idx <= 0) return { name: filename, ext: "" };
  return { name: filename.slice(0, idx), ext: filename.slice(idx) };
}

async function safeExists(sftp, p) {
  try {
    return Boolean(await sftp.exists(p)); // 'd' | '-' | 'l' => true
  } catch {
    return false;
  }
}

/** Si remotePath existe, devuelve un nombre alterno único según estrategia */
async function ensureUniqueRemotePath(sftp, remotePath) {
  if (!(await safeExists(sftp, remotePath))) return remotePath;

  const dir = path.posix.dirname(remotePath);
  const base = path.posix.basename(remotePath);
  const { name, ext } = splitExtPosix(base);

  if (NAME_STRATEGY === "counter") {
    let i = 1;
    while (true) {
      const candidate = path.posix.join(
        dir,
        `${name}_v${String(i).padStart(2, "0")}${ext}`
      );
      if (!(await safeExists(sftp, candidate))) return candidate;
      i += 1;
    }
  } else {
    // timestamp (YYYYMMDDHHMMSS)
    const stamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);
    let candidate = path.posix.join(dir, `${name}.${stamp}${ext}`);
    let i = 1;
    while (await safeExists(sftp, candidate)) {
      candidate = path.posix.join(dir, `${name}.${stamp}_${i}${ext}`);
      i += 1;
    }
    return candidate;
  }
}

function isTransientEndError(err) {
  if (!err) return false;
  const msg = String(err.message || "");
  return err.code === "ECONNRESET" || /ECONNRESET|Socket closed/i.test(msg);
}

/**
 * Sube múltiples archivos en una sola conexión SFTP.
 * @param {Array<{local:string, remote:string}>} files
 * @returns {Promise<Array<{local:string, remote:string}>>} rutas remotas finales
 */
async function uploadFilesViaSftp(files) {
  if (!files || !files.length) return [];

  const sftp = new Client();
  const results = [];
  let allPutsCompleted = false; // marcamos cuando terminamos el loop de puts
  let connectDone = false;

  try {
    console.log(
      `[SFTP Service] Connecting to SFTP server: ${sftpConfig.host}:${sftpConfig.port}...`
    );

    // Manejo de errores del cliente (antes de conectar)
    sftp.on("error", (err) => {
      if (allPutsCompleted && isTransientEndError(err)) {
        console.warn(
          `[SFTP Service] Transient SFTP error post-transfer (ignorado): ${err.message}`
        );
      } else {
        console.error(`[SFTP Service] SFTP client error:`, err);
      }
    });

    sftp.on("close", (hadErr) => {
      if (hadErr && allPutsCompleted) {
        console.warn(
          `[SFTP Service] SFTP closed with error post-transfer (ignorado).`
        );
      }
    });

    sftp.on("end", () => {
      // Algunos servidores terminan abrupto; no hacemos throw aquí
      if (allPutsCompleted) {
        console.warn(`[SFTP Service] SFTP session ended after uploads (ok).`);
      }
    });

    await sftp.connect(sftpConfig);
    connectDone = true;
    console.log(
      `[SFTP Service] Connected. Uploading ${files.length} file(s)...`
    );

    for (const f of files) {
      const local = f.local;
      const remote = (f.remote || "").replace(/\\/g, "/"); // posix
      const remoteDir = path.posix.dirname(remote);

      // crear carpeta remota (best effort)
      await sftp.mkdir(remoteDir, true).catch(() => {});

      const finalRemote = await ensureUniqueRemotePath(sftp, remote);

      if (finalRemote !== remote) {
        console.log(
          `[SFTP Service] Remote exists. Using unique name: ${finalRemote}`
        );
      }

      await sftp.put(local, finalRemote);
      console.log(`[SFTP Service] Uploaded ${local} -> ${finalRemote}`);
      results.push({ local, remote: finalRemote });
    }

    allPutsCompleted = true;
  } catch (err) {
    // Error real durante uploads o connect
    console.error(`[SFTP Service] Batch upload failed:`, err);
    throw new Error(`SFTP batch upload failed: ${err.message}`);
  } finally {
    // Cerrar sesión con cuidado: no fallar si el server ya cortó
    if (connectDone) {
      try {
        await sftp.end();
      } catch (e) {
        if (allPutsCompleted && isTransientEndError(e)) {
          console.warn(
            `[SFTP Service] Ignoring end() error post-transfer: ${e.message}`
          );
        } else {
          // si falló antes de terminar puts o es otro error, sí propagamos
          throw e;
        }
      }
    }
  }

  return results;
}

module.exports = {
  uploadFilesViaSftp,
};
