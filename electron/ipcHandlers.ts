import { ipcMain, app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import child_process from 'node:child_process'
import net from 'node:net'
import { Client } from 'ssh2'
import dgram from 'node:dgram'
import mysql from 'mysql2/promise'

// ============================================================================
// 1. BASE DE DATOS LOCAL ENCRIPTADA (.db)
// ============================================================================

const DB_FILE = path.join(app.getPath('userData'), 'sincrack-rdm.db');

// Clave única del ordenador para cifrar por defecto sin contraseña maestra
const MACHINE_SALT = 'sincrack-rdm-unique-salt-9876';
const MACHINE_KEY = crypto.scryptSync(
  process.env.COMPUTERNAME || process.env.USER || 'sincrack-rdm-default-machine-key',
  MACHINE_SALT,
  32
);

function getEncryptionKey(masterPassword?: string): Buffer {
  if (masterPassword) {
    return crypto.scryptSync(masterPassword, 'sincrack-salt-master', 32);
  }
  return MACHINE_KEY;
}

function encrypt(text: string, masterPassword?: string): string {
  const key = getEncryptionKey(masterPassword);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedString: string, masterPassword?: string): string {
  const parts = encryptedString.split(':');
  if (parts.length !== 2) throw new Error('Formato de base de datos no válido');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = Buffer.from(parts[1], 'hex');
  const key = getEncryptionKey(masterPassword);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

// Estructura por defecto de la Base de Datos
const DEFAULT_DB = {
  folders: [],
  connections: [],
  credentials: [],
  snippets: [
    { id: 's1', name: 'RAM Libre', command: 'free -h' },
    { id: 's2', name: 'Espacio en Disco', command: 'df -h' },
    { id: 's3', name: 'Puertos Escuchando', command: 'netstat -tulnp || ss -tulnp' },
    { id: 's4', name: 'Contenedores Docker', command: 'docker ps -a' },
    { id: 's5', name: 'Uso de CPU', command: 'top -b -n 1 | head -n 20' }
  ],
  settings: {
    editorPath: ''
  },
  hasMasterPassword: false,
  masterPasswordHash: ''
};

// Cargar Base de Datos
function loadDatabase(masterPassword?: string): typeof DEFAULT_DB {
  if (!fs.existsSync(DB_FILE)) {
    // Si no existe, crear una por defecto cifrada
    const rawData = JSON.stringify(DEFAULT_DB);
    const encryptedData = encrypt(rawData);
    fs.writeFileSync(DB_FILE, encryptedData, 'utf8');
    return JSON.parse(rawData);
  }

  try {
    const fileContent = fs.readFileSync(DB_FILE, 'utf8');
    const decryptedData = decrypt(fileContent, masterPassword);
    return JSON.parse(decryptedData);
  } catch (err: any) {
    console.error('Error al descifrar la base de datos:', err.message);
    throw new Error('Contraseña maestra incorrecta o datos corruptos');
  }
}

// Guardar Base de Datos
function saveDatabase(data: typeof DEFAULT_DB, masterPassword?: string) {
  const rawData = JSON.stringify(data);
  const encryptedData = encrypt(rawData, masterPassword);
  fs.writeFileSync(DB_FILE, encryptedData, 'utf8');
}

// ============================================================================
// 2. CONEXIONES SSH, TERMINAL & SFTP (POOL DE SESIONES)
// ============================================================================

interface ActiveConnection {
  client: Client;
  shellStream?: any;
  sftp?: any;
  watchers: Map<string, fs.FSWatcher>; // localPath -> Watcher
}

const activeSessions = new Map<string, ActiveConnection>();
const activeMysqlConnections = new Map<string, mysql.Connection>();

// Conectar SSH con soporte opcional de Bastión (Jump Host)
async function establishSSH(conn: any, creds: any, jumpHost?: any): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    
    const config: any = {
      host: conn.host,
      port: conn.port || 22,
      username: creds.username,
      readyTimeout: 20000,
      keepaliveInterval: 10000,
    };

    if (creds.type === 'key') {
      config.privateKey = creds.privateKey;
    } else {
      config.password = creds.password;
    }

    client.on('ready', () => resolve(client));
    client.on('error', (err) => reject(err));

    // Si requiere Jump Host
    if (jumpHost && jumpHost.connection && jumpHost.credential) {
      const bastion = new Client();
      const bastionConfig: any = {
        host: jumpHost.connection.host,
        port: jumpHost.connection.port || 22,
        username: jumpHost.credential.username,
        readyTimeout: 15000,
      };

      if (jumpHost.credential.type === 'key') {
        bastionConfig.privateKey = jumpHost.credential.privateKey;
      } else {
        bastionConfig.password = jumpHost.credential.password;
      }

      bastion.on('ready', () => {
        // Reenviar puerto a través del Bastión
        bastion.forwardOut(
          '127.0.0.1', 0, // Source
          conn.host, conn.port || 22, // Target
          (err, stream) => {
            if (err) {
              bastion.end();
              return reject(new Error('Túnel a través de Jump Host fallido: ' + err.message));
            }
            config.sock = stream;
            client.connect(config);
          }
        );
      });

      bastion.on('error', (err) => {
        reject(new Error('Conexión con el Jump Host fallida: ' + err.message));
      });

      bastion.connect(bastionConfig);
    } else {
      client.connect(config);
    }
  });
}

function checkDomainMatch(domain: string, cn: string, altNames: string[]): boolean {
  const normalize = (d: string) => d.toLowerCase().replace(/^\*\./, '');
  const normDomain = domain.toLowerCase();
  
  if (normalize(cn) === normDomain || (cn.startsWith('*.') && normDomain.endsWith(normalize(cn)))) {
    return true;
  }
  
  for (const san of altNames) {
    const cleanSan = san.replace(/^DNS:/i, '');
    if (normalize(cleanSan) === normDomain || (cleanSan.startsWith('*.') && normDomain.endsWith(normalize(cleanSan)))) {
      return true;
    }
  }
  
  return false;
}

// ============================================================================
// CONFIGURACIÓN DE LOS LLAMADOS IPC
// ============================================================================

export function setupIpcHandlers() {
  // --- HANDLERS BASE DE DATOS ---
  
  ipcMain.handle('db:check-exists', () => {
    return fs.existsSync(DB_FILE);
  });

  ipcMain.handle('db:load', (_, masterPassword?: string) => {
    try {
      const db = loadDatabase(masterPassword);
      // Retornar si tiene contraseña maestra configurada
      return { success: true, db };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:save', (_, dbData: any, masterPassword?: string) => {
    try {
      saveDatabase(dbData, masterPassword);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:set-master-password', (_, oldPassword?: string, newPassword?: string) => {
    try {
      const db = loadDatabase(oldPassword);
      if (newPassword) {
        db.hasMasterPassword = true;
        // Hash básico para verificar contraseña al arrancar
        db.masterPasswordHash = crypto.createHash('sha256').update(newPassword).digest('hex');
        saveDatabase(db, newPassword);
      } else {
        db.hasMasterPassword = false;
        db.masterPasswordHash = '';
        saveDatabase(db);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // --- COMPLEMENTOS DE SEGURIDAD (CIFRADO / DESCIFRADO DE COPIAS DE SEGURIDAD) ---

  ipcMain.handle('db:encrypt-data', (_, text: string, masterPassword?: string) => {
    try {
      const encrypted = encrypt(text, masterPassword);
      return { success: true, encrypted };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:decrypt-data', (_, encryptedString: string, masterPassword?: string) => {
    try {
      const decrypted = decrypt(encryptedString, masterPassword);
      return { success: true, decrypted };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // --- WAKE ON LAN (WoL) NATIVO ---

  ipcMain.handle('wol:send', async (_, macAddress: string, ipAddress?: string, port?: number) => {
    try {
      const cleanedMac = macAddress.replace(/[^a-fA-F0-9]/g, '');
      if (cleanedMac.length !== 12) {
        throw new Error('La dirección MAC debe contener exactamente 12 caracteres hexadecimales.');
      }

      const macBuffer = Buffer.from(cleanedMac, 'hex');
      const packet = Buffer.alloc(102);

      // 6 bytes de 0xFF
      for (let i = 0; i < 6; i++) {
        packet[i] = 0xff;
      }

      // Repetir dirección MAC 16 veces
      for (let i = 0; i < 16; i++) {
        macBuffer.copy(packet, 6 + i * 6);
      }

      const socket = dgram.createSocket('udp4');
      const targetIp = ipAddress || '255.255.255.255';
      const targetPort = port || 9;

      return new Promise((resolve) => {
        socket.once('listening', () => {
          socket.setBroadcast(true);
        });

        socket.send(packet, 0, packet.length, targetPort, targetIp, (err) => {
          socket.close();
          if (err) {
            resolve({ success: false, error: err.message });
          } else {
            resolve({ success: true });
          }
        });
      });
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // --- HANDLERS SSH TERMINAL ---

  ipcMain.handle('ssh:connect', async (_, sessionId: string, conn: any, creds: any, jumpHost?: any) => {
    try {
      // Si ya hay sesión previa en esta pestaña, cerrarla
      if (activeSessions.has(sessionId)) {
        const old = activeSessions.get(sessionId);
        old?.watchers.forEach(w => w.close());
        old?.client.end();
        activeSessions.delete(sessionId);
      }

      const client = await establishSSH(conn, creds, jumpHost);
      activeSessions.set(sessionId, {
        client,
        watchers: new Map()
      });

      return { success: true };
    } catch (err: any) {
      console.error('SSH Connection Error:', err);
      return { success: false, error: err.message || 'Error desconocido de conexión' };
    }
  });

  ipcMain.handle('ssh:shell-start', (event, sessionId: string, cols = 80, rows = 24) => {
    const active = activeSessions.get(sessionId);
    if (!active) return { success: false, error: 'Sesión no activa' };

    return new Promise((resolve) => {
      active.client.shell({ term: 'xterm-256color', cols, rows }, (err, stream) => {
        if (err) {
          return resolve({ success: false, error: err.message });
        }

        active.shellStream = stream;

        // Pipe de salida al Frontend
        stream.on('data', (data: Buffer) => {
          // Obtener la ventana actual de forma dinámica
          const targetWin = BrowserWindow.getAllWindows()[0];
          targetWin?.webContents.send(`ssh:data:${sessionId}`, data.toString('utf-8'));
        });

        stream.on('close', () => {
          const targetWin = BrowserWindow.getAllWindows()[0];
          targetWin?.webContents.send(`ssh:closed:${sessionId}`);
          stream.end();
        });

        resolve({ success: true });
      });
    });
  });

  ipcMain.on('ssh:write', (_, sessionId: string, data: string) => {
    const active = activeSessions.get(sessionId);
    if (active && active.shellStream) {
      active.shellStream.write(data);
    }
  });

  ipcMain.on('ssh:resize', (_, sessionId: string, cols: number, rows: number) => {
    const active = activeSessions.get(sessionId);
    if (active && active.shellStream) {
      active.shellStream.setWindow(rows, cols, 0, 0);
    }
  });

  ipcMain.handle('ssh:disconnect', (_, sessionId: string) => {
    const active = activeSessions.get(sessionId);
    if (active) {
      active.watchers.forEach(w => w.close());
      active.shellStream?.end();
      active.client.end();
      activeSessions.delete(sessionId);
    }
    return { success: true };
  });

  ipcMain.handle('ssh:exec', (_, sessionId: string, cmd: string) => {
    const active = activeSessions.get(sessionId);
    if (!active) return { success: false, error: 'Sesión no activa' };

    return new Promise((resolve) => {
      active.client.exec(cmd, (err, stream) => {
        if (err) {
          return resolve({ success: false, error: err.message });
        }

        let stdout = '';
        let stderr = '';

        stream.on('data', (data: Buffer) => {
          stdout += data.toString('utf-8');
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString('utf-8');
        });

        stream.on('close', (code: number) => {
          resolve({ success: true, stdout, stderr, code });
        });
      });
    });
  });

  // --- HANDLERS SFTP FILE EXPLORER ---

  ipcMain.handle('sftp:list', (event, sessionId: string, remotePath: string) => {
    const active = activeSessions.get(sessionId);
    if (!active) return { success: false, error: 'Sesión no activa' };

    return new Promise((resolve) => {
      const getList = (sftpInstance: any) => {
        sftpInstance.readdir(remotePath, (err: any, list: any[]) => {
          if (err) return resolve({ success: false, error: err.message });
          
          const files = list.map(item => {
            const isDir = (item.attrs.mode & 0o170000) === 0o040000;
            return {
              name: item.filename,
              isDirectory: isDir,
              size: item.attrs.size,
              mtime: item.attrs.mtime * 1000, // Unix a ms
              permissions: item.attrs.permissions
            };
          });
          
          resolve({ success: true, files });
        });
      };

      if (active.sftp) {
        getList(active.sftp);
      } else {
        active.client.sftp((err, sftp) => {
          if (err) return resolve({ success: false, error: err.message });
          active.sftp = sftp;
          getList(sftp);
        });
      }
    });
  });

  ipcMain.handle('sftp:mkdir', (event, sessionId: string, remotePath: string) => {
    const active = activeSessions.get(sessionId);
    if (!active || !active.sftp) return { success: false, error: 'SFTP no inicializado' };

    return new Promise((resolve) => {
      active.sftp.mkdir(remotePath, (err: any) => {
        if (err) return resolve({ success: false, error: err.message });
        resolve({ success: true });
      });
    });
  });

  ipcMain.handle('sftp:delete', (event, sessionId: string, remotePath: string, isDirectory: boolean) => {
    const active = activeSessions.get(sessionId);
    if (!active || !active.sftp) return { success: false, error: 'SFTP no inicializado' };

    return new Promise((resolve) => {
      if (isDirectory) {
        active.sftp.rmdir(remotePath, (err: any) => {
          if (err) return resolve({ success: false, error: err.message });
          resolve({ success: true });
        });
      } else {
        active.sftp.unlink(remotePath, (err: any) => {
          if (err) return resolve({ success: false, error: err.message });
          resolve({ success: true });
        });
      }
    });
  });

  ipcMain.handle('sftp:rename', (event, sessionId: string, oldPath: string, newPath: string) => {
    const active = activeSessions.get(sessionId);
    if (!active || !active.sftp) return { success: false, error: 'SFTP no inicializado' };

    return new Promise((resolve) => {
      active.sftp.rename(oldPath, newPath, (err: any) => {
        if (err) return resolve({ success: false, error: err.message });
        resolve({ success: true });
      });
    });
  });

  // Descarga SFTP con progreso
  ipcMain.handle('sftp:download', (event, sessionId: string, remotePath: string, localPath: string, transferId: string) => {
    const active = activeSessions.get(sessionId);
    if (!active || !active.sftp) return { success: false, error: 'SFTP no inicializado' };

    return new Promise((resolve) => {
      active.sftp.fastGet(remotePath, localPath, {
        step: (totalTransferred: number, _chunk: any, total: number) => {
          const targetWin = BrowserWindow.getAllWindows()[0];
          const pct = total > 0 ? Math.round((totalTransferred / total) * 100) : 0;
          targetWin?.webContents.send(`sftp:progress:${transferId}`, { transferred: totalTransferred, total, percentage: pct });
        }
      }, (err: any) => {
        if (err) return resolve({ success: false, error: err.message });
        resolve({ success: true });
      });
    });
  });

  // Subida SFTP con progreso
  ipcMain.handle('sftp:upload', (event, sessionId: string, localPath: string, remotePath: string, transferId: string) => {
    const active = activeSessions.get(sessionId);
    if (!active || !active.sftp) return { success: false, error: 'SFTP no inicializado' };

    return new Promise((resolve) => {
      active.sftp.fastPut(localPath, remotePath, {
        step: (totalTransferred: number, _chunk: any, total: number) => {
          const targetWin = BrowserWindow.getAllWindows()[0];
          const pct = total > 0 ? Math.round((totalTransferred / total) * 100) : 0;
          targetWin?.webContents.send(`sftp:progress:${transferId}`, { transferred: totalTransferred, total, percentage: pct });
        }
      }, (err: any) => {
        if (err) return resolve({ success: false, error: err.message });
        resolve({ success: true });
      });
    });
  });

  // --- HANDLER DE EDICIÓN LOCAL WINSCP-STYLE ---
  ipcMain.handle('sftp:edit-file', async (_, sessionId: string, remotePath: string, filename: string, editorPath?: string) => {
    const active = activeSessions.get(sessionId);
    if (!active || !active.sftp) return { success: false, error: 'Sesión SFTP no activa' };

    const tempDir = path.join(app.getPath('temp'), 'sincrack_rdm', sessionId);
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Crear una estructura limpia de directorios locales según la ruta remota
    const localFilePath = path.join(tempDir, filename);

    return new Promise((resolve) => {
      // 1. Descargar el archivo remotamente de forma temporal
      active.sftp.fastGet(remotePath, localFilePath, {}, async (err: any) => {
        if (err) return resolve({ success: false, error: `Error al descargar temporal: ${err.message}` });

        // 2. Abrir con el editor local
        try {
          if (editorPath && fs.existsSync(editorPath)) {
            // Abrir con editor específico configurado
            child_process.spawn(editorPath, [localFilePath], { detached: true, stdio: 'ignore' }).unref();
          } else {
            // Fallback al editor por defecto del sistema
            await shell.openPath(localFilePath);
          }
        } catch (launchErr: any) {
          return resolve({ success: false, error: `Error al abrir editor: ${launchErr.message}` });
        }

        // Si ya había un watcher para este archivo local, cerrarlo primero
        if (active.watchers.has(localFilePath)) {
          active.watchers.get(localFilePath)?.close();
        }

        // 3. Crear watcher local
        let uploadTimeout: NodeJS.Timeout;
        const watcherStartTime = Date.now();
        const watcher = fs.watch(localFilePath, (eventType) => {
          // Ignorar eventos espurios iniciales de Windows durante los primeros 1.5 segundos
          if (Date.now() - watcherStartTime < 1500) return;

          if (eventType === 'change') {
            // Throttle upload events so we don't spam uploads on every half-written character
            clearTimeout(uploadTimeout);
            uploadTimeout = setTimeout(() => {
              const targetWin = BrowserWindow.getAllWindows()[0];
              targetWin?.webContents.send(`sftp:editor-syncing:${sessionId}`, { filename, status: 'syncing' });

              active.sftp.fastPut(localFilePath, remotePath, {}, (putErr: any) => {
                if (putErr) {
                  targetWin?.webContents.send(`sftp:editor-syncing:${sessionId}`, { filename, status: 'error', error: putErr.message });
                } else {
                  targetWin?.webContents.send(`sftp:editor-syncing:${sessionId}`, { filename, status: 'success' });
                }
              });
            }, 1000);
          }
        });

        active.watchers.set(localFilePath, watcher);
        resolve({ success: true, localPath: localFilePath });
      });
    });
  });

  // --- LANZADOR RDP NATIVO ---

  ipcMain.handle('rdp:launch', (event, conn: any, creds: any) => {
    if (process.platform !== 'win32') {
      return { success: false, error: 'El inicio de sesión RDP directo solo está soportado de forma nativa en Windows en esta versión.' };
    }

    return new Promise((resolve) => {
      const host = conn.host;
      const port = conn.port || 3389;
      const user = creds.username;
      const pass = creds.password;
      const res = conn.rdpResolution || '1280x800';
      const isFullscreen = conn.rdpFullscreen ? 2 : 1; // 2 = full screen, 1 = windowed
      const [w, h] = res.split('x');

      // 1. Crear archivo RDP temporal con posicionamiento y tamaño de ventana explícitos
      const rdpParams = [
        `full address:s:${host}:${port}`,
        `username:s:${user}`,
        `screen mode id:i:${isFullscreen}`,
        `desktopwidth:i:${w}`,
        `desktopheight:i:${h}`,
        `session bpp:i:32`,
        `redirectclipboards:i:1`,
        `redirectprinters:i:0`,
        `audiomode:i:0`,
        `prompt for credentials:i:0`,
        `disable wallpaper:i:0`,
        `authentication level:i:2`,
        `smart sizing:i:1`,
      ];

      if (isFullscreen === 1) {
        const winWidth = parseInt(w) || 1280;
        const winHeight = parseInt(h) || 800;
        // Añadir 100 de margen inicial en pantalla y margen para barra de título y bordes
        rdpParams.push(`winposstr:s:0,1,100,100,${100 + winWidth + 16},${100 + winHeight + 40}`);
      }

      const rdpContent = rdpParams.join('\r\n');

      const tempRdpPath = path.join(app.getPath('temp'), `sincrack_${conn.id || 'rdp'}.rdp`);
      fs.writeFileSync(tempRdpPath, rdpContent, 'utf8');

      // 2. Usar `cmdkey` de Windows para inyectar credenciales temporales en el almacén de Windows
      // Esto evita que RDP vuelva a pedir la contraseña.
      const cmdKeyAdd = `cmdkey /generic:TERMSRV/${host} /user:${user} /pass:${pass}`;
      
      child_process.exec(cmdKeyAdd, (errKey) => {
        if (errKey) {
          return resolve({ success: false, error: 'No se pudo almacenar la credencial RDP temporal: ' + errKey.message });
        }

        // 3. Ejecutar mstsc.exe con el archivo RDP temporal configurado
        const mstsc = child_process.spawn('mstsc.exe', [tempRdpPath]);

        // 4. Cuando mstsc se cierre, borrar las credenciales de cmdkey para no dejar rastro
        mstsc.on('close', () => {
          child_process.exec(`cmdkey /delete:TERMSRV/${host}`, () => {
            try { fs.unlinkSync(tempRdpPath); } catch {}
          });
        });

        resolve({ success: true });
      });
    });
  });

  // --- LANZADORES MULTIVENTANA ---
  ipcMain.handle('window:open-external', (_, url: string, title: string) => {
    // Permite abrir sesiones en ventanas independientes
    const extWin = new BrowserWindow({
      width: 1024,
      height: 768,
      title: title || 'SinCracK Session',
      autoHideMenuBar: true,
      webPreferences: {
        webviewTag: true,
      }
    });
    extWin.removeMenu();
    extWin.loadURL(url);
    return { success: true };
  });

  // --- UTILIDADES DE RED (HERRAMIENTAS) ---

  // Ping visual en tiempo real
  ipcMain.handle('net:ping', (event, host: string, pingId: string) => {
    return new Promise((resolve) => {
      const isWin = process.platform === 'win32';
      const cmd = isWin ? 'ping' : 'ping';
      const args = isWin ? ['-t', host] : [host]; // -t en Windows hace ping infinito, se detiene con el close

      const pingProcess = child_process.spawn(cmd, args);
      
      pingProcess.stdout.on('data', (data) => {
        const line = data.toString('utf-8');
        const targetWin = BrowserWindow.getAllWindows()[0];
        
        // Expresión regular para capturar la latencia (time=XXms)
        let latency = -1;
        const match = line.match(/time[=<]([0-9.]+)\s*ms/i) || line.match(/tiempo[=<]([0-9.]+)\s*ms/i);
        if (match) {
          latency = parseFloat(match[1]);
        }
        
        targetWin?.webContents.send(`net:ping-data:${pingId}`, { text: line, latency });
      });

      // Guardar el proceso de ping en la sesión para poder pararlo
      ipcMain.once(`net:ping-stop:${pingId}`, () => {
        pingProcess.kill();
      });

      pingProcess.on('close', () => {
        resolve({ success: true });
      });
    });
  });

  // Port scanner ultrarrápido y paralelo
  ipcMain.handle('net:scan-ports', (event, host: string, portRange: string, scanId: string) => {
    return new Promise((resolve) => {
      // Parsear rango (ej. 20-100 o lista 21,22,80,3389)
      let ports: number[] = [];
      if (portRange.includes('-')) {
        const [start, end] = portRange.split('-').map(Number);
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) ports.push(i);
        }
      } else {
        ports = portRange.split(',').map(p => Number(p.trim())).filter(p => !isNaN(p));
      }

      if (ports.length === 0) {
        return resolve({ success: false, error: 'Rango de puertos no válido' });
      }

      const totalPorts = ports.length;
      let scanned = 0;
      const concurrencyLimit = 50; // Escanear de 50 en 50 simultáneamente
      const openPorts: number[] = [];
      let index = 0;
      let isCancelled = false;

      // Evento de cancelación
      const cancelChannel = `net:scan-cancel:${scanId}`;
      const onCancel = () => { isCancelled = true; };
      ipcMain.once(cancelChannel, onCancel);

      const scanNext = () => {
        if (isCancelled || index >= totalPorts) {
          if (index >= totalPorts || isCancelled) {
            ipcMain.off(cancelChannel, onCancel);
            const targetWin = BrowserWindow.getAllWindows()[0];
            targetWin?.webContents.send(`net:scan-finished:${scanId}`, { openPorts });
            resolve({ success: true, openPorts });
          }
          return;
        }

        const port = ports[index++];
        const socket = new net.Socket();
        
        socket.setTimeout(1200); // 1.2 segundos de timeout
        
        socket.on('connect', () => {
          openPorts.push(port);
          socket.destroy();
          scanned++;
          const targetWin = BrowserWindow.getAllWindows()[0];
          targetWin?.webContents.send(`net:scan-progress:${scanId}`, { port, status: 'open', scanned, total: totalPorts });
          scanNext();
        });

        socket.on('timeout', () => {
          socket.destroy();
          scanned++;
          const targetWin = BrowserWindow.getAllWindows()[0];
          targetWin?.webContents.send(`net:scan-progress:${scanId}`, { port, status: 'closed', scanned, total: totalPorts });
          scanNext();
        });

        socket.on('error', () => {
          socket.destroy();
          scanned++;
          const targetWin = BrowserWindow.getAllWindows()[0];
          targetWin?.webContents.send(`net:scan-progress:${scanId}`, { port, status: 'closed', scanned, total: totalPorts });
          scanNext();
        });

        socket.connect(port, host);
      };

      // Iniciar el pool paralelo
      for (let i = 0; i < Math.min(concurrencyLimit, totalPorts); i++) {
        scanNext();
      }
    });
  });

  // Generador de Claves SSH Nativas usando crypto de Node.js
  ipcMain.handle('tools:generate-ssh-key', async (event, type: 'rsa' | 'ed25519', bits: number = 2048) => {
    try {
      const cryptoModule = require('crypto');
      if (type === 'ed25519') {
        const { publicKey, privateKey } = cryptoModule.generateKeyPairSync('ed25519', {
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
          }
        });
        return { success: true, publicKey, privateKey };
      } else {
        const { publicKey, privateKey } = cryptoModule.generateKeyPairSync('rsa', {
          modulusLength: bits,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
          }
        });
        return { success: true, publicKey, privateKey };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Consultar Información de Hardware e Interfaces de Red de Node.js
  ipcMain.handle('tools:get-sys-info', async () => {
    try {
      const os = require('os');
      const cpus = os.cpus();
      const cpuModel = cpus.length > 0 ? cpus[0].model : 'Intel/AMD';
      const cpuSpeed = cpus.length > 0 ? cpus[0].speed : 0;
      const cores = cpus.length;
      
      return {
        success: true,
        platform: os.platform(),
        release: os.release(),
        type: os.type(),
        arch: os.arch(),
        cpuModel,
        cpuSpeed,
        cores,
        totalMem: os.totalmem(),
        freeMem: os.freemem(),
        uptime: os.uptime(),
        hostname: os.hostname(),
        networkInterfaces: os.networkInterfaces()
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Generador de Certificados Autofirmados usando node-forge
  ipcMain.handle('tools:generate-certificate', async (event, options: {
    commonName: string;
    organization?: string;
    country?: string;
    dnsNames?: string[];
    ipAddresses?: string[];
    keySize: number;
    validFrom: string;
    validTo: string;
    serverAuth: boolean;
    clientAuth: boolean;
    codeSigning: boolean;
    saveMethod: 'pem' | 'pfx';
    password?: string;
  }) => {
    try {
      const forge = require('node-forge');
      const pki = forge.pki;
      
      // 1. Generar par de claves RSA
      const keys = pki.rsa.generateKeyPair(options.keySize || 2048);
      
      // 2. Crear certificado
      const cert = pki.createCertificate();
      cert.publicKey = keys.publicKey;
      cert.serialNumber = '01' + forge.util.bytesToHex(forge.random.getBytesSync(19));
      
      // Fechas de validez
      cert.validity.notBefore = new Date(options.validFrom);
      cert.validity.notAfter = new Date(options.validTo);
      
      // Atributos de sujeto y emisor
      const attrs = [
        { name: 'commonName', value: options.commonName }
      ];
      if (options.organization) {
        attrs.push({ name: 'organizationName', value: options.organization });
      }
      if (options.country) {
        attrs.push({ name: 'countryName', value: options.country });
      }
      
      cert.setSubject(attrs);
      cert.setIssuer(attrs);
      
      // Extensiones básicas
      const extensions: any[] = [
        {
          name: 'basicConstraints',
          cA: false
        },
        {
          name: 'keyUsage',
          keyEncipherment: true,
          digitalSignature: true
        }
      ];
      
      // Uso extendido de la clave
      const extKeyUsage = [];
      if (options.serverAuth) extKeyUsage.push('1.3.6.1.5.5.7.3.1');
      if (options.clientAuth) extKeyUsage.push('1.3.6.1.5.5.7.3.2');
      if (options.codeSigning) extKeyUsage.push('1.3.6.1.5.5.7.3.3');
      
      if (extKeyUsage.length > 0) {
        extensions.push({
          name: 'extKeyUsage',
          serverAuth: options.serverAuth,
          clientAuth: options.clientAuth,
          codeSigning: options.codeSigning
        });
      }
      
      // Nombres alternativos (SANs)
      const altNames = [];
      if (options.dnsNames && options.dnsNames.length > 0) {
        for (const dns of options.dnsNames) {
          if (dns.trim()) altNames.push({ type: 2, value: dns.trim() });
        }
      }
      if (options.ipAddresses && options.ipAddresses.length > 0) {
        for (const ip of options.ipAddresses) {
          if (ip.trim()) altNames.push({ type: 7, ip: ip.trim() });
        }
      }
      
      if (altNames.length > 0) {
        extensions.push({
          name: 'subjectAltName',
          altNames: altNames
        });
      }
      
      cert.setExtensions(extensions);
      
      // Autofirmar certificado con la clave privada
      cert.sign(keys.privateKey, forge.md.sha256.create());
      
      // Exportar en formatos legibles
      const pemKey = pki.privateKeyToPem(keys.privateKey);
      const pemCert = pki.certificateToPem(cert);
      
      let pfxBase64 = '';
      if (options.saveMethod === 'pfx') {
        const asn1 = forge.pkcs12.toPkcs12Asn1(
          keys.privateKey,
          [cert],
          options.password || '',
          { algorithm: '3des' }
        );
        const pfxDer = forge.asn1.toDer(asn1).getBytes();
        pfxBase64 = forge.util.encode64(pfxDer);
      }
      
      return {
        success: true,
        privateKeyPem: pemKey,
        certificatePem: pemCert,
        pfxBase64: pfxBase64
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Comprobador de SSL de sitios web usando tls de Node.js
  ipcMain.handle('net:check-ssl', async (event, domain: string) => {
    return new Promise((resolve) => {
      try {
        const tls = require('tls');
        
        let cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].split(':')[0];
        if (!cleanDomain) {
          return resolve({ success: false, error: 'Dominio inválido' });
        }
        
        const socket = tls.connect({
          host: cleanDomain,
          port: 443,
          servername: cleanDomain,
          rejectUnauthorized: false,
          timeout: 10000
        }, () => {
          const cert = socket.getPeerCertificate(true);
          if (!cert || Object.keys(cert).length === 0) {
            socket.destroy();
            return resolve({ success: false, error: 'No se pudo obtener el certificado SSL' });
          }
          
          const issuer = cert.issuer || {};
          const subject = cert.subject || {};
          const validFrom = cert.valid_from;
          const validTo = cert.valid_to;
          const fingerprint256 = cert.fingerprint256;
          
          const now = new Date();
          const expiryDate = new Date(validTo);
          const isExpired = now > expiryDate;
          
          const timeDiff = expiryDate.getTime() - now.getTime();
          const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
          
          const altNames = cert.subjectaltname ? cert.subjectaltname.split(',').map((s: string) => s.trim()) : [];
          
          const cn = subject.CN || '';
          const isMatch = checkDomainMatch(cleanDomain, cn, altNames);
          
          const cipher = socket.getCipher();
          const protocol = socket.getProtocol();
          
          const authorized = socket.authorized;
          const authorizationError = socket.authorizationError;
          
          socket.end();
          
          resolve({
            success: true,
            domain: cleanDomain,
            subject: {
              commonName: cn,
              organization: subject.O || '',
              orgUnit: subject.OU || '',
              country: subject.C || '',
              locality: subject.L || '',
              state: subject.ST || ''
            },
            issuer: {
              commonName: issuer.CN || '',
              organization: issuer.O || '',
              country: issuer.C || ''
            },
            validFrom,
            validTo,
            isExpired,
            daysRemaining,
            fingerprint256,
            subjectAltNames: altNames,
            isDomainMatch: isMatch,
            cipher: cipher ? `${cipher.name} (${cipher.version})` : 'Desconocido',
            protocol: protocol || 'Desconocido',
            authorized,
            authorizationError: authorizationError ? String(authorizationError) : null
          });
        });
        
        socket.on('error', (err: any) => {
          socket.destroy();
          resolve({ success: false, error: `Error de red: ${err.message}` });
        });
        
        socket.on('timeout', () => {
          socket.destroy();
          resolve({ success: false, error: 'Tiempo de espera agotado al conectar al puerto 443' });
        });
        
      } catch (err: any) {
        resolve({ success: false, error: err.message });
      }
    });
  });

  // --- HANDLERS MYSQL DATABASE MANAGER ---
  ipcMain.handle('mysql:connect', async (_, sessionId: string, conn: any, creds: any) => {
    try {
      if (activeMysqlConnections.has(sessionId)) {
        try {
          await activeMysqlConnections.get(sessionId)?.end();
        } catch {}
        activeMysqlConnections.delete(sessionId);
      }

      const host = conn.host || 'localhost';
      const port = parseInt(conn.port || 3306, 10);
      const user = creds?.username || conn.username || 'root';
      const password = creds?.password || conn.password || '';
      const database = conn.database || undefined;

      const connection = await mysql.createConnection({
        host,
        port,
        user,
        password,
        database,
        connectTimeout: 8000,
        multipleStatements: true
      });

      activeMysqlConnections.set(sessionId, connection);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('mysql:query', async (_, sessionId: string, sql: string) => {
    const connection = activeMysqlConnections.get(sessionId);
    if (!connection) return { success: false, error: 'Conexión de MySQL no activa o caducada.' };

    try {
      const [rows, fields] = await connection.query(sql);
      return {
        success: true,
        rows: Array.isArray(rows) ? rows : [rows],
        isQuery: Array.isArray(rows),
        fields: fields ? fields.map((f: any) => ({ name: f.name, type: f.columnType })) : []
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('mysql:disconnect', async (_, sessionId: string) => {
    const connection = activeMysqlConnections.get(sessionId);
    if (connection) {
      try {
        await connection.end();
      } catch {}
      activeMysqlConnections.delete(sessionId);
    }
    return { success: true };
  });
}
