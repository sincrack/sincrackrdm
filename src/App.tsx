import { useState, useEffect } from 'react'
import { 
  Terminal, Network, Globe, 
  Settings, Key, Folder, LogIn, Eye, EyeOff, X, Home, Activity,
  Loader2, Minus, ArrowRight, Copy, Radio, Search, Database
} from 'lucide-react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import TerminalSession from './components/TerminalSession'
import SftpSession from './components/SftpSession'
import WebSession from './components/WebSession'
import NetworkTools from './components/NetworkTools'
import ConnectionModal from './components/ConnectionModal'
import MysqlSession from './components/MysqlSession'
import { LOGO_BASE64 } from './assets/logoBase64'

interface Tab {
  id: string;
  name: string;
  type: 'dashboard' | 'ssh' | 'sftp' | 'web' | 'tools' | 'mysql';
  connection?: any;
}

export default function App() {
  // --- SEGURIDAD Y LOGIN ---
  const [dbLoaded, setDbLoaded] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [dbData, setDbData] = useState<any>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // --- MODELO DE DATOS DE LA BASE ---
  const [folders, setFolders] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [snippets, setSnippets] = useState<any[]>([]);
  const [editorPath, setEditorPath] = useState('');
  const [hasMasterPassword, setHasMasterPassword] = useState(false);
  const [appTheme, setAppTheme] = useState<'dark' | 'light'>('dark');
  const [terminalFontSize, setTerminalFontSize] = useState<number>(14);

  // --- ANCHO DE LA BARRA LATERAL REDIMENSIONABLE ---
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [lastSidebarWidth, setLastSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = (mouseDownEvent: any) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(200, Math.min(600, e.clientX));
      setSidebarWidth(newWidth);
      setLastSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    const root = document.documentElement;
    if (appTheme === 'light') {
      root.classList.add('theme-light');
      root.style.colorScheme = 'light';
    } else {
      root.classList.remove('theme-light');
      root.style.colorScheme = 'dark';
    }
  }, [appTheme]);

  // --- GESTIÓN DE PESTAÑAS ---
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'dashboard', name: 'Inicio', type: 'dashboard' }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('dashboard');
  const [activeSubTool, setActiveSubTool] = useState<'network' | 'password' | 'sshkey' | 'sysinfo' | 'certificate' | 'sslcheck' | 'wol'>('network');

  // --- SPOTLIGHT LAUNCHER ---
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [spotlightQuery, setSpotlightQuery] = useState('');
  const [spotlightSelectedIndex, setSpotlightSelectedIndex] = useState(0);

  const getSpotlightItems = () => {
    const items: Array<{
      id: string;
      name: string;
      type: 'connection' | 'folder' | 'utility';
      subtitle: string;
      action: () => void;
    }> = [];

    // 1. Conexiones
    connections.forEach((conn: any) => {
      items.push({
        id: conn.id,
        name: conn.name,
        type: 'connection',
        subtitle: `Conexión ${conn.protocol.toUpperCase()} • ${conn.host || conn.url || ''}`,
        action: () => {
          handleOpenConnection(conn);
        }
      });
    });

    // 2. Carpetas
    folders.forEach((fold: any) => {
      items.push({
        id: fold.id,
        name: fold.name,
        type: 'folder',
        subtitle: 'Carpeta de Conexiones',
        action: () => {
          // No-op for folders
        }
      });
    });

    // 3. Herramientas / Utilidades
    const utilitiesList = [
      { name: 'Wake on LAN (WoL)', sub: 'Encender ordenadores remotos por red', action: () => { setActiveSubTool('wol'); setActiveTabId('tools'); } },
      { name: 'Herramientas de Red (Ping/Port Scanner)', sub: 'Escaneo de red local y ping en vivo', action: () => { setActiveSubTool('network'); setActiveTabId('tools'); } },
      { name: 'Generador de Contraseñas', sub: 'Generación segura de claves aleatorias', action: () => { setActiveSubTool('password'); setActiveTabId('tools'); } },
      { name: 'Gestor de Claves SSH', sub: 'Administración de llaves públicas/privadas', action: () => { setActiveSubTool('sshkey'); setActiveTabId('tools'); } },
      { name: 'Información de Sistema', sub: 'Detalles de hardware de este PC', action: () => { setActiveSubTool('sysinfo'); setActiveTabId('tools'); } },
      { name: 'Comprobar Certificados SSL', sub: 'Verificación de vigencia y emisor HTTPS', action: () => { setActiveSubTool('sslcheck'); setActiveTabId('tools'); } },
      { name: 'Certificados Locales', sub: 'Ver detalles de certificados locales', action: () => { setActiveSubTool('certificate'); setActiveTabId('tools'); } }
    ];

    utilitiesList.forEach((ut, idx) => {
      items.push({
        id: `utility_${idx}`,
        name: ut.name,
        type: 'utility',
        subtitle: `Utilidad • ${ut.sub}`,
        action: ut.action
      });
    });

    return items;
  };

  // --- BROADCAST COMMANDS ---
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastCmd, setBroadcastCmd] = useState('');

  const sendBroadcastCommand = () => {
    const cmd = broadcastCmd.trim();
    if (!cmd) return;

    const sshTabs = tabs.filter(t => t.type === 'ssh');
    if (sshTabs.length === 0) return;

    sshTabs.forEach(tab => {
      window.ipcRenderer.send('ssh:write', tab.id, cmd + '\n');
    });

    setBroadcastCmd('');
  };

  // --- ATAJOS DE TECLADO PREMIUM ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Spotlight (Ctrl + P) - Debe interceptarse incluso en inputs
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setShowSpotlight(prev => !prev);
        setSpotlightQuery('');
        setSpotlightSelectedIndex(0);
        return;
      }

      // Evitar interceptar atajos en inputs de texto o textareas
      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.getAttribute('contenteditable') === 'true'
      )) {
        return;
      }

      // Ctrl + B -> Alternar Sidebar
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarWidth(prev => {
          if (prev > 0) {
            setLastSidebarWidth(prev);
            return 0;
          } else {
            return lastSidebarWidth;
          }
        });
      }

      // Alt + N -> Nueva conexión
      else if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setEditingConnection(null);
        setShowModal(true);
      }

      // Alt + H -> Ir al Dashboard (Home)
      else if (e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setActiveTabId('dashboard');
      }

      // Alt + T -> Abrir Herramientas de Red
      else if (e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleOpenTools();
      }

      // Alt + Shift + W -> Cerrar todas las pestañas
      else if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (confirm('¿Estás seguro de que quieres cerrar todas las pestañas abiertas?')) {
          setTabs([{ id: 'dashboard', name: 'Inicio', type: 'dashboard' }]);
          setActiveTabId('dashboard');
        }
      }

      // Alt + Flecha Derecha -> Siguiente pestaña
      else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        if (tabs.length > 1) {
          const currentIndex = tabs.findIndex(t => t.id === activeTabId);
          if (currentIndex !== -1) {
            const nextIndex = (currentIndex + 1) % tabs.length;
            setActiveTabId(tabs[nextIndex].id);
          }
        }
      } 
      // Alt + Flecha Izquierda -> Pestaña anterior
      else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        if (tabs.length > 1) {
          const currentIndex = tabs.findIndex(t => t.id === activeTabId);
          if (currentIndex !== -1) {
            const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
            setActiveTabId(tabs[prevIndex].id);
          }
        }
      }
      // Alt + W -> Cerrar pestaña activa actual (excepto 'dashboard')
      else if (e.altKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (activeTabId && activeTabId !== 'dashboard') {
          const tabToClose = activeTabId;
          setTabs(prev => {
            const idx = prev.findIndex(t => t.id === tabToClose);
            if (idx === -1) return prev;
            const updated = prev.filter(t => t.id !== tabToClose);
            
            if (activeTabId === tabToClose) {
              if (updated.length > 0) {
                const nextActiveIdx = Math.max(0, idx - 1);
                setActiveTabId(updated[nextActiveIdx].id);
              } else {
                setActiveTabId('dashboard');
              }
            }
            return updated;
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTabId, lastSidebarWidth]);

  // --- HISTORIAL Y MENÚ CONTEXTUAL ---
  const [quickHistory, setQuickHistory] = useState<string[]>([]);
  const [tabContextMenu, setTabContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
  } | null>(null);

  useEffect(() => {
    const handleGlobalClick = () => setTabContextMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // --- MODAL CONEXIONES ---
  const [showModal, setShowModal] = useState(false);
  const [editingConnection, setEditingConnection] = useState<any>(null);

  // --- CONEXIÓN RÁPIDA PENDIENTE (MODAL DE CONTRASEÑA) ---
  const [quickConnectPending, setQuickConnectPending] = useState<{
    protocol: string;
    hostStr: string;
    username: string;
    host: string;
    port: number;
    url: string;
  } | null>(null);
  const [quickConnectPassword, setQuickConnectPassword] = useState('');

  // --- CARGA INICIAL DE LA APP ---
  useEffect(() => {
    // Comprobar si existe base de datos y si requiere contraseña maestra
    window.ipcRenderer.invoke('db:check-exists').then((exists: boolean) => {
      if (!exists) {
        // Si no existe, al cargar por primera vez creará una por defecto sin contraseña
        loadAppDatabase();
      } else {
        // Intentar cargar de forma silenciosa con la clave por defecto
        window.ipcRenderer.invoke('db:load').then((res: any) => {
          if (res.success) {
            setDbData(res.db);
            syncStateFromDb(res.db);
            setDbLoaded(true);
          } else {
            // Si falla, significa que requiere contraseña maestra para descifrar
            setNeedsPassword(true);
          }
        });
      }
    });
  }, []);

  const syncStateFromDb = (db: any) => {
    setFolders(db.folders || []);
    setConnections(db.connections || []);
    setCredentials(db.credentials || []);
    setSnippets(db.snippets || []);
    setEditorPath(db.settings?.editorPath || '');
    setHasMasterPassword(db.hasMasterPassword || false);
    setQuickHistory(db.settings?.quickConnectHistory || []);
    setAppTheme(db.settings?.appTheme || 'dark');
    setTerminalFontSize(db.settings?.terminalFontSize || 14);
  };

  const loadAppDatabase = (password?: string) => {
    setLoginError('');
    window.ipcRenderer.invoke('db:load', password).then((res: any) => {
      if (res.success) {
        setMasterPassword(password || '');
        setDbData(res.db);
        syncStateFromDb(res.db);
        setNeedsPassword(false);
        setDbLoaded(true);
      } else {
        setLoginError(res.error || 'Contraseña incorrecta');
      }
    });
  };

  // --- GUARDADO AUTOSAVE ---
  const saveStateToDb = (updatedDb: any) => {
    setDbData(updatedDb);
    window.ipcRenderer.invoke('db:save', updatedDb, masterPassword || undefined);
  };

  const handleSaveTheme = (theme: 'dark' | 'light') => {
    setAppTheme(theme);
    const updated = {
      ...dbData,
      settings: {
        ...(dbData?.settings || {}),
        appTheme: theme
      }
    };
    saveStateToDb(updated);
  };

  const handleSaveTerminalFontSize = (size: number) => {
    setTerminalFontSize(size);
    const updated = {
      ...dbData,
      settings: {
        ...(dbData?.settings || {}),
        terminalFontSize: size
      }
    };
    saveStateToDb(updated);
  };

  // --- OPERACIONES DE PERFILES ---
  
  const handleAddFolder = (folder: any) => {
    const updated = {
      ...dbData,
      folders: [...folders, folder]
    };
    setFolders(updated.folders);
    saveStateToDb(updated);
  };

  const handleDeleteFolder = (folderId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta carpeta? Las conexiones que contiene se moverán a la raíz.')) return;
    
    // Mover conexiones dentro de la carpeta a la raíz
    const updatedConns = connections.map(c => c.folderId === folderId ? { ...c, folderId: null } : c);
    // Mover carpetas hijas a la raíz
    const updatedFolders = folders
      .filter(f => f.id !== folderId)
      .map(f => f.parentId === folderId ? { ...f, parentId: null } : f);

    const updated = {
      ...dbData,
      folders: updatedFolders,
      connections: updatedConns
    };

    setFolders(updatedFolders);
    setConnections(updatedConns);
    saveStateToDb(updated);
  };

  const handleRenameFolder = (folderId: string, newName: string) => {
    const updatedFolders = folders.map(f => f.id === folderId ? { ...f, name: newName } : f);
    const updated = {
      ...dbData,
      folders: updatedFolders
    };
    setFolders(updatedFolders);
    saveStateToDb(updated);
  };

  const handleSaveConnection = (connData: any) => {
    let updatedConns;
    const exists = connections.some(c => c.id === connData.id);

    if (exists) {
      updatedConns = connections.map(c => c.id === connData.id ? connData : c);
    } else {
      updatedConns = [...connections, connData];
    }

    const updated = {
      ...dbData,
      connections: updatedConns
    };

    setConnections(updatedConns);
    setTabs(prev => prev.map(t => t.connection && (t.connection.id === connData.id || t.connection.id === connData.id + '_sftp') ? { ...t, connection: connData } : t));
    saveStateToDb(updated);
  };

  const handleDeleteConnection = (connId: string) => {
    const conn = connections.find(c => c.id === connId);
    const connName = conn ? conn.name : '';
    if (!confirm(connName ? `¿Estás seguro de que quieres eliminar la conexión "${connName}"?` : '¿Estás seguro de que quieres eliminar esta conexión?')) return;

    const updatedConns = connections.filter(c => c.id !== connId);
    const updated = {
      ...dbData,
      connections: updatedConns
    };
    setConnections(updatedConns);
    saveStateToDb(updated);

    // Cerrar pestaña si estaba abierta
    closeTab(connId);
  };

  const handleDuplicateConnection = (conn: any) => {
    const copy = {
      ...conn,
      id: Math.random().toString(),
      name: `${conn.name} (Copia)`
    };
    const updatedConns = [...connections, copy];
    const updated = {
      ...dbData,
      connections: updatedConns
    };
    setConnections(updatedConns);
    saveStateToDb(updated);
  };

  // --- OPERACIONES DE CREDENCIALES ---

  const handleAddCredential = (cred: any) => {
    const updatedCreds = [...credentials, cred];
    const updated = {
      ...dbData,
      credentials: updatedCreds
    };
    setCredentials(updatedCreds);
    saveStateToDb(updated);
  };

  const handleDeleteCredential = (credId: string) => {
    if (connections.some(c => c.credentialId === credId)) {
      return alert('No puedes eliminar esta credencial porque está siendo usada por conexiones activas. Desvincúlalas primero.');
    }
    const cred = credentials.find(c => c.id === credId);
    const credName = cred ? cred.name : '';
    if (!confirm(credName ? `¿Estás seguro de que quieres eliminar la credencial "${credName}"?` : '¿Estás seguro de que quieres eliminar esta credencial?')) return;

    const updatedCreds = credentials.filter(c => c.id !== credId);
    const updated = {
      ...dbData,
      credentials: updatedCreds
    };
    setCredentials(updatedCreds);
    saveStateToDb(updated);
  };

  // --- OPERACIONES DE SNIPPETS ---

  const handleAddSnippet = (snip: any) => {
    let updatedSnips;
    const exists = snippets.some(s => s.id === snip.id);
    if (exists) {
      updatedSnips = snippets.map(s => s.id === snip.id ? snip : s);
    } else {
      updatedSnips = [...snippets, snip];
    }
    const updated = {
      ...dbData,
      snippets: updatedSnips
    };
    setSnippets(updatedSnips);
    saveStateToDb(updated);
  };

  const handleDeleteSnippet = (snipId: string) => {
    const snip = snippets.find(s => s.id === snipId);
    const snipName = snip ? snip.name : '';
    if (!confirm(snipName ? `¿Estás seguro de que quieres eliminar el script "${snipName}"?` : '¿Estás seguro de que quieres eliminar este script?')) return;

    const updatedSnips = snippets.filter(s => s.id !== snipId);
    const updated = {
      ...dbData,
      snippets: updatedSnips
    };
    setSnippets(updatedSnips);
    saveStateToDb(updated);
  };

  // --- MOVER CONEXIONES Y CARPETAS (DRAG & DROP) ---
  const handleMoveConnection = (connId: string, folderId: string | null) => {
    const updatedConns = connections.map(c => c.id === connId ? { ...c, folderId } : c);
    const updated = {
      ...dbData,
      connections: updatedConns
    };
    setConnections(updatedConns);
    saveStateToDb(updated);
  };

  const handleMoveFolder = (folderId: string, parentId: string | null) => {
    const updatedFolders = folders.map(f => f.id === folderId ? { ...f, parentId } : f);
    const updated = {
      ...dbData,
      folders: updatedFolders
    };
    setFolders(updatedFolders);
    saveStateToDb(updated);
  };

  const handleImportData = (importedFolders: any[], importedConns: any[], importedCreds?: any[]) => {
    const idMap: Record<string, string> = {};
    const credIdMap: Record<string, string> = {};
    
    // 1. Importar credenciales y regenerar IDs para evitar colisión
    const newCreds = [...credentials];
    if (importedCreds && Array.isArray(importedCreds)) {
      importedCreds.forEach(cr => {
        const originalId = cr.id;
        const newId = Math.random().toString();
        credIdMap[originalId] = newId;
        newCreds.push({
          ...cr,
          id: newId
        });
      });
    }

    // 2. Importar carpetas y regenerar IDs para evitar colisión
    const newFolders = [...folders];
    importedFolders.forEach(f => {
      const originalId = f.id;
      const newId = Math.random().toString();
      idMap[originalId] = newId;
      newFolders.push({
        ...f,
        id: newId,
        parentId: f.parentId ? (idMap[f.parentId] || f.parentId) : null
      });
    });

    // 3. Importar conexiones vinculando la jerarquía de carpetas y credenciales
    const newConns = [...connections];
    importedConns.forEach(c => {
      newConns.push({
        ...c,
        id: Math.random().toString(),
        folderId: c.folderId ? (idMap[c.folderId] || c.folderId) : null,
        credentialId: c.credentialId ? (credIdMap[c.credentialId] || c.credentialId) : null
      });
    });

    const updated = {
      ...dbData,
      folders: newFolders,
      connections: newConns,
      credentials: newCreds
    };

    setFolders(newFolders);
    setConnections(newConns);
    setCredentials(newCreds);
    saveStateToDb(updated);
  };

  const handleResetDatabase = () => {
    if (!confirm('⚠️ ¡ATENCIÓN!: Esto eliminará permanentemente todas tus carpetas, conexiones, credenciales globales y scripts de la base de datos local. ¿Estás seguro de que quieres restablecer todo a cero?')) return;
    
    const updated = {
      ...dbData,
      folders: [],
      connections: [],
      credentials: [],
      snippets: []
    };
    setFolders([]);
    setConnections([]);
    setCredentials([]);
    setSnippets([]);
    saveStateToDb(updated);
    alert('♻️ Base de datos restablecida con éxito. Todo ha sido borrado.');
  };

  // --- AJUSTES GLOBALES ---

  const handleSaveEditorPath = (path: string) => {
    setEditorPath(path);
    const updated = {
      ...dbData,
      settings: {
        ...dbData.settings,
        editorPath: path
      }
    };
    saveStateToDb(updated);
  };

  const handleSaveMasterPassword = async (oldPassword?: string, newPassword?: string) => {
    const res = await window.ipcRenderer.invoke('db:set-master-password', oldPassword || undefined, newPassword || undefined);
    if (res.success) {
      setMasterPassword(newPassword || '');
      setHasMasterPassword(!!newPassword);
      // Recargar datos internos
      loadAppDatabase(newPassword);
    }
    return res;
  };

  // --- LANZAR SESIONES / PESTAÑAS ---

  const handleOpenConnection = (conn: any) => {
    // Actualizar el timestamp de 'lastConnected' para el historial dinámico del dashboard
    const exists = connections.some(c => c.id === conn.id);
    if (exists) {
      const updatedConns = connections.map(c => c.id === conn.id ? { ...c, lastConnected: Date.now() } : c);
      const updated = {
        ...dbData,
        connections: updatedConns
      };
      setConnections(updatedConns);
      saveStateToDb(updated);
    }

    if (conn.protocol === 'rdp') {
      // Lanzar sesión RDP nativa en Windows en segundo plano
      let cred = { username: '', password: '' };
      if (conn.credentialId) {
        cred = credentials.find(c => c.id === conn.credentialId) || cred;
      } else if (conn.manualCreds) {
        cred = conn.manualCreds;
      }

      window.ipcRenderer.invoke('rdp:launch', conn, cred).then((res: any) => {
        if (!res.success) {
          alert('Error al lanzar RDP: ' + res.error);
        }
      });
      return;
    }

    if (conn.openMode === 'window') {
      // Abrir en ventana independiente de Electron
      // En Web, pasamos URL, en SSH/SFTP podemos levantar una instancia (en esta versión abrimos Webs)
      if (conn.protocol === 'web') {
        window.ipcRenderer.invoke('window:open-external', conn.url, conn.name);
        return;
      }
    }

    // Abrir en pestaña interna
    const tabExists = tabs.some(t => t.id === conn.id);
    if (tabExists) {
      setActiveTabId(conn.id);
    } else {
      const newTab: Tab = {
        id: conn.id,
        name: conn.name,
        type: conn.protocol,
        connection: { ...conn, lastConnected: Date.now() }
      };
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(conn.id);
    }
  };

  const closeTab = (tabId: string) => {
    if (tabId === 'dashboard') return;
    setTabs(prev => prev.filter(t => t.id !== tabId));
    if (activeTabId === tabId) {
      setActiveTabId('dashboard');
    }
  };

  const handleQuickConnect = (protocol: string, hostStr: string) => {
    // Guardar en el historial
    const updatedHistory = [hostStr, ...quickHistory.filter(h => h !== hostStr)].slice(0, 6);
    const updated = {
      ...dbData,
      settings: {
        ...dbData.settings,
        quickConnectHistory: updatedHistory
      }
    };
    setQuickHistory(updatedHistory);
    saveStateToDb(updated);

    // Parser de quick connect: ej root@192.168.1.50:22 o http://proxmox.local
    let host = hostStr;
    let username = 'root';
    let port = 22;
    let url = hostStr;

    if (protocol !== 'web') {
      if (hostStr.includes('@')) {
        const parts = hostStr.split('@');
        username = parts[0];
        host = parts[1];
      }
      if (host.includes(':')) {
        const parts = host.split(':');
        host = parts[0];
        port = Number(parts[1]) || 22;
      }
    }

    if (protocol === 'ssh' || protocol === 'sftp') {
      setQuickConnectPending({ protocol, hostStr, username, host, port, url });
      setQuickConnectPassword('');
    } else {
      executeQuickConnect(protocol, username, host, port, url, '');
    }
  };

  const executeQuickConnect = (protocol: string, username: string, host: string, port: number, url: string, pass: string) => {
    const tempConn = {
      id: 'quick_' + Math.random().toString(),
      name: `Rápida: ${host}`,
      protocol,
      host,
      port,
      url,
      openMode: 'tab',
      manualCreds: {
        username,
        type: 'password',
        password: pass
      }
    };

    const newTab: Tab = {
      id: tempConn.id,
      name: tempConn.name,
      type: protocol as any,
      connection: tempConn
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(tempConn.id);
  };

  const handleOpenTools = () => {
    const exists = tabs.some(t => t.id === 'tools');
    if (exists) {
      setActiveTabId('tools');
    } else {
      setTabs(prev => [...prev, { id: 'tools', name: 'Herramientas de Red', type: 'tools' }]);
      setActiveTabId('tools');
    }
  };

  // --- EJECUCIÓN DE SNIPPETS ---
  const handleExecuteSnippet = (command: string) => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab && activeTab.type === 'ssh') {
      // Inyectar comando en la terminal SSH activa enviando IPC
      window.ipcRenderer.send('ssh:write', activeTab.id, command + '\n');
    } else {
      alert('⚠️ Por favor, selecciona una pestaña de terminal SSH activa para ejecutar este script.');
    }
  };

  // --- RENDERIZADO DE PESTAÑA SELECCIONADA ---
  const renderActiveTabContent = (tab: Tab) => {
    switch (tab.type) {
      case 'dashboard':
        return (
          <Dashboard 
            onQuickConnect={handleQuickConnect}
            connections={connections}
            activeTabsCount={tabs.length - 1}
            credentialsCount={credentials.length}
            snippetsCount={snippets.length}
            onOpenConnection={handleOpenConnection}
            onNewConnection={() => { setEditingConnection(null); setShowModal(true); }}
            quickHistory={quickHistory}
          />
        );
      case 'ssh':
        // Resolver credenciales del perfil
        let sshCred = tab.connection.manualCreds || credentials.find(c => c.id === tab.connection.credentialId);
        // Resolver Jump Host si tiene
        let jumpHost: any = null;
        if (tab.connection.jumpHostId) {
          const jConn = connections.find(c => c.id === tab.connection.jumpHostId);
          if (jConn) {
            const jCred = jConn.manualCreds || credentials.find(c => c.id === jConn.credentialId);
            jumpHost = { connection: jConn, credential: jCred };
          }
        }
        return (
          <TerminalSession 
            key={tab.id}
            sessionId={tab.id}
            connection={tab.connection}
            credential={sshCred}
            jumpHost={jumpHost}
            snippets={snippets}
            globalFontSize={terminalFontSize}
            onClose={() => closeTab(tab.id)}
            onUpdateConnection={handleSaveConnection}
            onOpenSftp={() => {
              const sftpTabId = tab.id + '_sftp';
              const exists = tabs.some(t => t.id === sftpTabId);
              if (exists) {
                setActiveTabId(sftpTabId);
              } else {
                const sftpTab: Tab = {
                  id: sftpTabId,
                  name: `${tab.connection.name} [SFTP]`,
                  type: 'sftp',
                  connection: tab.connection
                };
                setTabs(prev => [...prev, sftpTab]);
                setActiveTabId(sftpTabId);
              }
            }}
          />
        );
      case 'sftp':
        let sftpCred = tab.connection.manualCreds || credentials.find(c => c.id === tab.connection.credentialId);
        let sftpJump: any = null;
        if (tab.connection.jumpHostId) {
          const jConn = connections.find(c => c.id === tab.connection.jumpHostId);
          if (jConn) {
            const jCred = jConn.manualCreds || credentials.find(c => c.id === jConn.credentialId);
            sftpJump = { connection: jConn, credential: jCred };
          }
        }
        return (
          <SftpSession 
            key={tab.id}
            sessionId={tab.id}
            connection={tab.connection}
            credential={sftpCred}
            jumpHost={sftpJump}
          />
        );
      case 'web':
        return <WebSession key={tab.id} connection={tab.connection} />;
      case 'mysql':
        let mysqlCred = tab.connection.manualCreds || credentials.find(c => c.id === tab.connection.credentialId);
        return (
          <MysqlSession 
            key={tab.id}
            sessionId={tab.id}
            connection={tab.connection}
            credential={mysqlCred}
          />
        );
      case 'tools':
        return <NetworkTools key={tab.id} activeSubTool={activeSubTool} onChangeSubTool={setActiveSubTool} />;
      default:
        return <div className="text-gray-500 font-mono p-4">Pestaña no válida</div>;
    }
  };

  const getTabIcon = (tab: Tab) => {
    switch (tab.type) {
      case 'dashboard': return <Home className="w-3.5 h-3.5" />;
      case 'ssh': return <Terminal className="w-3.5 h-3.5" />;
      case 'sftp': return <Network className="w-3.5 h-3.5" />;
      case 'web': return <Globe className="w-3.5 h-3.5" />;
      case 'mysql': return <Database className="w-3.5 h-3.5" />;
      case 'tools': return <Activity className="w-3.5 h-3.5" />;
      default: return <Terminal className="w-3.5 h-3.5" />;
    }
  };

  const getTabColorClass = (tab: Tab) => {
    if (tab.id !== activeTabId) return 'border-transparent text-gray-500 hover:text-gray-300';
    
    switch (tab.type) {
      case 'dashboard': return 'border-cyan-400 text-cyan-400 shadow-md shadow-cyan-500/5';
      case 'ssh': return 'border-cyan-400 text-cyan-400 shadow-md shadow-cyan-500/5';
      case 'sftp': return 'border-emerald-400 text-emerald-400 shadow-md shadow-emerald-500/5';
      case 'web': return 'border-amber-400 text-amber-400 shadow-md shadow-amber-500/5';
      case 'mysql': return 'border-cyan-400 text-cyan-400 shadow-md shadow-cyan-500/5';
      case 'tools': return 'border-cyan-400 text-cyan-400 shadow-md shadow-cyan-500/5';
      default: return 'border-cyan-400 text-cyan-400';
    }
  };

  // --- RENDERIZADO LOGIN / CONTRASEÑA MAESTRA ---
  if (needsPassword) {
    return (
      <div className="w-screen h-screen bg-[#08080a] flex items-center justify-center relative select-none font-sans body">
        {/* Glowing blur ball */}
        <div className="absolute w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[120px]" />
        
        <div className="w-96 glass-panel p-6 border-white/10 z-10 animate-scale-in text-center flex flex-col items-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src={LOGO_BASE64} alt="SinCracK Logo" className="h-10 w-auto object-contain select-none pointer-events-none" />
            <span className="text-xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent self-center">RDM</span>
          </div>

          <p className="text-xs text-gray-400 mb-6">Tu base de datos local está cifrada de forma segura. Introduce tu Contraseña Maestra para descifrarla.</p>

          <form 
            onSubmit={(e) => { e.preventDefault(); loadAppDatabase(masterPassword); }}
            className="w-full flex flex-col gap-4"
          >
            <div className="relative w-full flex items-center">
              <input 
                type={showPassword ? 'text' : 'password'}
                placeholder="Contraseña Maestra..."
                value={masterPassword}
                onChange={e => setMasterPassword(e.target.value)}
                className="w-full glass-input pr-10 pl-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none"
                autoFocus
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {loginError && <p className="text-[10px] text-rose-400 font-mono text-left">{loginError}</p>}

            <button 
              type="submit"
              className="glass-btn glass-btn-accent w-full py-2.5 mt-2 bg-gradient-to-r from-cyan-600 to-blue-600 border-none font-bold uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Descifrar Base de Datos
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!dbLoaded) {
    return (
      <div className="w-screen h-screen bg-[#08080a] flex items-center justify-center text-gray-500 font-mono text-xs">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mr-2" />
        Iniciando base de datos segura...
      </div>
    );
  }

  // SPOTLIGHT ITEMS
  const spotlightItems = getSpotlightItems();
  const filteredSpotlight = spotlightItems.filter(item => 
    item.name.toLowerCase().includes(spotlightQuery.toLowerCase()) ||
    item.subtitle.toLowerCase().includes(spotlightQuery.toLowerCase())
  );

  return (
    <div className="w-screen h-screen bg-[var(--bg-primary)] flex text-[var(--text-main)] overflow-hidden font-sans select-none">
      
      {/* 1. LEFT SIDEBAR PANEL */}
      <Sidebar 
        folders={folders}
        width={sidebarWidth}
        connections={connections}
        credentials={credentials}
        snippets={snippets}
        editorPath={editorPath}
        hasMasterPassword={hasMasterPassword}
        appTheme={appTheme}
        terminalFontSize={terminalFontSize}
        onSaveTheme={handleSaveTheme}
        onSaveTerminalFontSize={handleSaveTerminalFontSize}
        onSaveEditorPath={handleSaveEditorPath}
        onSaveMasterPassword={handleSaveMasterPassword}
        onAddFolder={handleAddFolder}
        onEditConnection={handleSaveConnection}
        onDeleteConnection={handleDeleteConnection}
        onDeleteFolder={handleDeleteFolder}
        onRenameFolder={handleRenameFolder}
        onDuplicateConnection={handleDuplicateConnection}
        onOpenConnection={handleOpenConnection}
        onAddCredential={handleAddCredential}
        onDeleteCredential={handleDeleteCredential}
        onAddSnippet={handleAddSnippet}
        onDeleteSnippet={handleDeleteSnippet}
        onExecuteSnippet={handleExecuteSnippet}
        onOpenTools={handleOpenTools}
        onOpenDashboard={() => setActiveTabId('dashboard')}
        onTriggerModal={(conn) => { setEditingConnection(conn); setShowModal(true); }}
        onMoveConnection={handleMoveConnection}
        onMoveFolder={handleMoveFolder}
        onImportData={handleImportData}
        onResetDatabase={handleResetDatabase}
        activeSubTool={activeSubTool}
        onChangeSubTool={setActiveSubTool}
      />

      {/* INTERACTIVE SIDEBAR RESIZER DIVIDER */}
      <div 
        className="w-1 bg-transparent hover:bg-cyan-500/20 active:bg-cyan-500 cursor-col-resize h-full transition-all shrink-0 z-50 relative -ml-0.5 border-r border-[var(--panel-border)]/50"
        onMouseDown={startResizing}
      />

      {/* 2. MAIN WINDOW FRAME */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-primary)]">
        
        {/* Dynamic Horizontal Pestañas (Tabs Bar) */}
        <div className="h-10 bg-[var(--sidebar-bar)] border-b border-[var(--panel-border)] flex items-end justify-between px-3 select-none">
          <div className="flex-1 flex items-end gap-1 overflow-x-auto no-scrollbar pb-0.5">
            {tabs.map(tab => {
              const colorClass = getTabColorClass(tab);
              return (
                <div 
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTabContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      tabId: tab.id
                    });
                  }}
                  className={`h-8 px-3 rounded-t-lg border-b-2 text-xs font-medium cursor-pointer transition-all flex items-center gap-2 select-none whitespace-nowrap bg-white/[0.01] ${colorClass}`}
                >
                  {getTabIcon(tab)}
                  <span className="max-w-[120px] truncate">{tab.name}</span>
                  
                  {tab.id !== 'dashboard' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                      className="p-0.5 rounded-full hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* BOTÓN TRANSMISOR DE COMANDOS SSH (SOLO MOSTRAR SI HAY AL MENOS 1 TIPO SSH ABIERTO) */}
          {tabs.some(t => t.type === 'ssh') && (
            <button
              onClick={() => setShowBroadcast(!showBroadcast)}
              className={`h-7 px-2.5 mb-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all select-none ${
                showBroadcast 
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 font-semibold shadow-md shadow-amber-500/10'
                  : 'bg-white/5 border-[var(--panel-border)] text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title="Transmitir comando a todas las terminales SSH abiertas simultáneamente"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse text-amber-400" />
              Multidifusión
            </button>
          )}
        </div>

        {/* PANEL DE TRANSMISIÓN DE COMANDOS (BROADCAST PANEL) */}
        {showBroadcast && tabs.some(t => t.type === 'ssh') && (
          <div className="px-4 py-2.5 bg-amber-500/5 border-b border-amber-500/20 flex items-center gap-3 animate-scale-in select-none">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 whitespace-nowrap">
                Difusión SSH ({tabs.filter(t => t.type === 'ssh').length} consolas)
              </span>
            </div>
            <div className="flex-1 relative flex items-center">
              <input 
                type="text"
                value={broadcastCmd}
                onChange={e => setBroadcastCmd(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    sendBroadcastCommand();
                  }
                }}
                placeholder="Escribe un comando y pulsa Enter para enviarlo a todas las pestañas SSH activas simultáneamente... (ej: apt update)"
                className="w-full bg-black/40 border border-amber-500/20 focus:border-amber-500/50 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none font-mono"
              />
            </div>
            <button
              onClick={sendBroadcastCommand}
              disabled={!broadcastCmd.trim()}
              className="glass-btn px-4 py-1.5 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 disabled:opacity-50 select-none font-bold uppercase"
            >
              Transmitir
            </button>
          </div>
        )}

        {/* Tab Session Area */}
        <div className="flex-1 min-h-0">
          {tabs.map(tab => (
            <div 
              key={tab.id} 
              className={`w-full h-full ${tab.id === activeTabId ? 'block' : 'hidden'}`}
            >
              {renderActiveTabContent(tab)}
            </div>
          ))}
        </div>

      </div>

      {/* 3. CONNECTION & FOLDER MODAL */}
      <ConnectionModal 
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingConnection(null); }}
        onSave={handleSaveConnection}
        editingConnection={editingConnection}
        folders={folders}
        credentials={credentials}
        connections={connections}
      />

      {/* QUICK CONNECT PASSWORD MODAL */}
      {quickConnectPending && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              executeQuickConnect(
                quickConnectPending.protocol,
                quickConnectPending.username,
                quickConnectPending.host,
                quickConnectPending.port,
                quickConnectPending.url,
                quickConnectPassword
              );
              setQuickConnectPending(null);
            }}
            className="w-96 glass-panel p-5 border border-cyan-500/20 shadow-xl shadow-cyan-500/5 animate-scale-in"
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-2 mb-3 title-font">
              <Key className="w-4 h-4 text-cyan-400" />
              Contraseña Requerida
            </h3>
            <p className="text-[11px] text-gray-400 mb-4 leading-normal font-normal">
              Introduce la contraseña para conectar a <strong className="text-white font-semibold font-mono">{quickConnectPending.username}@{quickConnectPending.host}</strong>:
            </p>
            <div className="flex flex-col gap-1 mb-4">
              <input 
                type="password"
                placeholder="Contraseña"
                value={quickConnectPassword}
                onChange={e => setQuickConnectPassword(e.target.value)}
                className="glass-input text-xs font-mono"
                autoFocus
                required
              />
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button 
                type="button" 
                onClick={() => setQuickConnectPending(null)} 
                className="glass-btn px-4 py-1.5"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="glass-btn glass-btn-accent px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500"
              >
                Conectar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FLOATING TAB CONTEXT MENU */}
      {tabContextMenu && (
        <div 
          style={{ top: tabContextMenu.y, left: tabContextMenu.x }}
          className="fixed z-[100] w-48 context-menu shadow-2xl rounded-lg p-1 flex flex-col gap-0.5 animate-scale-in text-[11px]"
        >
          {tabContextMenu.tabId !== 'dashboard' && (
            <button
              onClick={() => {
                closeTab(tabContextMenu.tabId);
                setTabContextMenu(null);
              }}
              className="w-full text-left px-2.5 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-main)] hover-rose flex items-center gap-2"
            >
              <X className="w-3.5 h-3.5 text-gray-500" />
              Cerrar Pestaña
            </button>
          )}
          <button
            onClick={() => {
              const targetId = tabContextMenu.tabId;
              setTabs(prev => prev.filter(t => t.id === 'dashboard' || t.id === targetId));
              setActiveTabId(targetId);
              setTabContextMenu(null);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-main)] hover-cyan flex items-center gap-2"
          >
            <Minus className="w-3.5 h-3.5 text-gray-500" />
            Cerrar las Demás Pestañas
          </button>
          <button
            onClick={() => {
              const targetIndex = tabs.findIndex(t => t.id === tabContextMenu.tabId);
              if (targetIndex !== -1) {
                const keepTabs = tabs.slice(0, targetIndex + 1);
                if (!keepTabs.some(t => t.id === 'dashboard') && tabs.some(t => t.id === 'dashboard')) {
                  keepTabs.unshift(tabs.find(t => t.id === 'dashboard')!);
                }
                setTabs(keepTabs);
                if (!keepTabs.some(t => t.id === activeTabId)) {
                  setActiveTabId(tabContextMenu.tabId);
                }
              }
              setTabContextMenu(null);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-main)] hover-cyan flex items-center gap-2"
          >
            <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
            Cerrar Pestañas a la Derecha
          </button>
          {tabContextMenu.tabId !== 'dashboard' && (
            <>
              <div className="menu-divider h-[1px] bg-white/5 dark:bg-white/5 my-1" />
              <button
                onClick={() => {
                  const tabToDup = tabs.find(t => t.id === tabContextMenu.tabId);
                  if (tabToDup && tabToDup.connection) {
                    const dupTab: Tab = {
                      id: tabToDup.connection.id + '_dup_' + Math.random().toString(),
                      name: `${tabToDup.connection.name} (Copia)`,
                      type: tabToDup.connection.protocol,
                      connection: {
                        ...tabToDup.connection,
                        id: Math.random().toString() // Generar ID nuevo
                      }
                    };
                    setTabs(prev => [...prev, dupTab]);
                    setActiveTabId(dupTab.id);
                  }
                  setTabContextMenu(null);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-main)] hover-emerald flex items-center gap-2"
              >
                <Copy className="w-3.5 h-3.5 text-gray-500" />
                Duplicar Sesión
              </button>
            </>
          )}
        </div>
      )}

      {/* 🔍 SPOTLIGHT GLOBAL LAUNCHER */}
      {showSpotlight && (
        <div 
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm select-none animate-scale-in"
          onClick={() => setShowSpotlight(false)}
        >
          <div 
            className="w-[500px] glass-panel border border-cyan-500/20 shadow-2xl shadow-cyan-500/10 flex flex-col overflow-hidden max-h-[400px]"
            onClick={e => e.stopPropagation()}
          >
            {/* Search Input Box */}
            <div className="relative flex items-center border-b border-white/10 px-4 py-3 bg-black/40">
              <Search className="w-4 h-4 text-cyan-400 mr-3 shrink-0 animate-pulse" />
              <input 
                type="text"
                autoFocus
                value={spotlightQuery}
                onChange={e => {
                  setSpotlightQuery(e.target.value);
                  setSpotlightSelectedIndex(0);
                }}
                placeholder="Busca conexiones, carpetas o herramientas..."
                className="w-full bg-transparent border-none text-white text-xs outline-none placeholder-gray-500 font-sans"
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSpotlightSelectedIndex(prev => (filteredSpotlight.length > 0 ? (prev + 1) % filteredSpotlight.length : 0));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSpotlightSelectedIndex(prev => (filteredSpotlight.length > 0 ? (prev - 1 + filteredSpotlight.length) % filteredSpotlight.length : 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredSpotlight[spotlightSelectedIndex]) {
                      filteredSpotlight[spotlightSelectedIndex].action();
                      setShowSpotlight(false);
                    }
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setShowSpotlight(false);
                  }
                }}
              />
              <span className="text-[9px] font-bold uppercase tracking-wider bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-gray-400 font-mono shrink-0 select-none">
                ESC
              </span>
            </div>

            {/* Results Area */}
            <div className="flex-1 overflow-y-auto p-1.5 scrollbar-thin flex flex-col gap-0.5 max-h-[300px]">
              {filteredSpotlight.length > 0 ? (
                filteredSpotlight.map((item, idx) => {
                  const isSelected = idx === spotlightSelectedIndex;
                  const getIcon = () => {
                    if (item.type === 'connection') return <Terminal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
                    if (item.type === 'folder') return <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
                    return <Settings className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
                  };

                  return (
                    <div 
                      key={item.id}
                      onClick={() => {
                        item.action();
                        setShowSpotlight(false);
                      }}
                      className={`flex items-center justify-between px-3 py-2 rounded cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-cyan-500/10 border-l-2 border-cyan-400 pl-2 text-white font-medium animate-scale-in' 
                          : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-300 border-l-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate min-w-0">
                        {getIcon()}
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs truncate font-sans">{item.name}</span>
                          <span className="text-[9px] text-gray-500 truncate font-mono mt-0.5">{item.subtitle}</span>
                        </div>
                      </div>
                      
                      {isSelected && (
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded font-mono shrink-0 select-none animate-pulse">
                          Abrir
                        </span>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-xs text-gray-500 font-sans italic select-none">
                  No se encontraron resultados para "{spotlightQuery}"
                </div>
              )}
            </div>

            {/* Footer Navigation Hints */}
            <div className="px-4 py-2 border-t border-white/5 bg-white/[0.01] flex items-center justify-between text-[9px] text-gray-500 font-mono tracking-wider uppercase font-semibold select-none">
              <span className="flex items-center gap-1.5">
                <span>↑↓</span> Navegar
              </span>
              <span className="flex items-center gap-1.5">
                <span>↵ Enter</span> Ejecutar
              </span>
            </div>
          </div>
        </div>
      )}
    
      {/* Custom Global CSS Loader */}
      <style>{`
        /* Ocultar barra de desplazamiento de pestañas pero permitir scroll */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        
        /* Animaciones */
        @keyframes scaleIn {
          from { transform: scale(0.97); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        
        @keyframes slideIn {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        .animate-scale-in {
          animation: scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        
        .animate-slide-in {
          animation: slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
