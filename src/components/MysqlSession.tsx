import React, { useState, useEffect } from 'react'
import { 
  Database, Table, Search, Play, Key, RefreshCw, 
  AlertTriangle, Users, Cpu, FileText, CheckCircle, 
  Download, Terminal, UserPlus, X, Folder,
  ChevronRight, ChevronDown, Globe, User
} from 'lucide-react'

const GLOBAL_PRIVS_LIST = [
  'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'RELOAD', 'SHUTDOWN', 
  'PROCESS', 'FILE', 'GRANT', 'REFERENCES', 'INDEX', 'ALTER', 'SHOW DATABASES', 
  'SUPER', 'CREATE TEMPORARY TABLES', 'LOCK TABLES', 'EXECUTE', 'REPLICATION SLAVE', 
  'REPLICATION CLIENT', 'CREATE VIEW', 'SHOW VIEW', 'CREATE ROUTINE', 'ALTER ROUTINE', 
  'CREATE USER', 'EVENT', 'TRIGGER', 'CREATE TABLESPACE'
];

const DB_PRIVS_LIST = [
  'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'GRANT', 
  'REFERENCES', 'INDEX', 'ALTER', 'CREATE TEMPORARY TABLES', 'LOCK TABLES', 
  'EXECUTE', 'CREATE VIEW', 'SHOW VIEW', 'CREATE ROUTINE', 'ALTER ROUTINE', 
  'EVENT', 'TRIGGER'
];

interface MysqlSessionProps {
  sessionId: string;
  connection: any;
  credential: any;
}

export default function MysqlSession({ sessionId, connection, credential }: MysqlSessionProps) {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Database structure
  const [databases, setDatabases] = useState<string[]>([]);
  const [currentDb, setCurrentDb] = useState<string>('');
  const [tables, setTables] = useState<string[]>([]);
  const [tableSearch, setTableSearch] = useState('');

  // Main UI state
  const [activeTab, setActiveTab] = useState<'editor' | 'users' | 'processes'>('editor');
  const [queryText, setQueryText] = useState('SELECT 1;');
  const [executingQuery, setExecutingQuery] = useState(false);
  const [queryResult, setQueryResult] = useState<{
    success: boolean;
    rows?: any[];
    isQuery?: boolean;
    fields?: any[];
    error?: string;
    executionTime?: number;
  } | null>(null);

  // User Manager state
  const [users, setUsers] = useState<{ User: string; Host: string }[]>([]);
  const [userError, setUserError] = useState<string | null>(null);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showOnlyPrivileged, setShowOnlyPrivileged] = useState(false);
  const [selectedNode, setSelectedNode] = useState<{ type: 'global' | 'object_folder' | 'database'; dbName?: string }>({ type: 'global' });
  const [objectFolderExpanded, setObjectFolderExpanded] = useState(true);

  // Privileges State Map
  const [privilegesState, setPrivilegesState] = useState<{
    global: string[];
    databases: Record<string, string[]>;
  }>({ global: [], databases: {} });

  const [originalPrivilegesState, setOriginalPrivilegesState] = useState<{
    global: string[];
    databases: Record<string, string[]>;
  }>({ global: [], databases: {} });
  
  // Create User Form
  const [newUsername, setNewUsername] = useState('');
  const [newUserHost, setNewUserHost] = useState('%');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [grantAllPrivs, setGrantAllPrivs] = useState(true);

  // Change Password Form
  const [selectedUser, setSelectedUser] = useState<{ User: string; Host: string } | null>(null);
  const [changePasswordVal, setChangePasswordVal] = useState('');

  // User Grants state
  const [userGrants, setUserGrants] = useState<string[]>([]);
  const [savingChanges, setSavingChanges] = useState(false);

  useEffect(() => {
    if (selectedUser) {
      loadUserGrants(selectedUser.User, selectedUser.Host);
    } else {
      setUserGrants([]);
    }
  }, [selectedUser]);

  useEffect(() => {
    const newState = {
      global: [] as string[],
      databases: {} as Record<string, string[]>
    };

    userGrants.forEach(grant => {
      const hasGrantOption = grant.toUpperCase().includes('WITH GRANT OPTION');
      const match = grant.match(/GRANT\s+(.+?)\s+ON\s+(.+?)\s+TO\s+/i);
      if (match) {
        let privsPart = match[1].toUpperCase();
        let scopePart = match[2].replace(/`/g, '');
        
        let privs = privsPart.split(',').map(p => p.trim());
        if (privs.includes('ALL PRIVILEGES')) {
          if (scopePart === '*.*') {
            privs = [...GLOBAL_PRIVS_LIST];
          } else {
            privs = [...DB_PRIVS_LIST];
          }
        }
        
        if (hasGrantOption && !privs.includes('GRANT')) {
          privs.push('GRANT');
        }

        if (scopePart === '*.*') {
          newState.global = Array.from(new Set([...newState.global, ...privs]));
        } else if (scopePart.endsWith('.*')) {
          const dbName = scopePart.substring(0, scopePart.length - 2);
          newState.databases[dbName] = Array.from(new Set([...(newState.databases[dbName] || []), ...privs]));
        } else {
          const parts = scopePart.split('.');
          const dbName = parts[0];
          newState.databases[dbName] = Array.from(new Set([...(newState.databases[dbName] || []), ...privs]));
        }
      }
    });

    setPrivilegesState(newState);
    setOriginalPrivilegesState(JSON.parse(JSON.stringify(newState)));
    setSelectedNode({ type: 'global' });
  }, [userGrants]);

  // Process Monitor state
  const [processes, setProcesses] = useState<any[]>([]);
  const [loadingProcesses, setLoadingProcesses] = useState(false);
  const [processAutoRefresh, setProcessAutoRefresh] = useState(true);

  // Connect on mount
  useEffect(() => {
    connectDb();
    return () => {
      // Clean up connection
      window.ipcRenderer.invoke('mysql:disconnect', sessionId).catch(() => {});
    };
  }, [sessionId]);

  // Auto-refresh processes loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTab === 'processes' && processAutoRefresh && connected) {
      loadProcesses();
      interval = setInterval(() => {
        loadProcesses();
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab, processAutoRefresh, connected]);

  const connectDb = async () => {
    setConnecting(true);
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await window.ipcRenderer.invoke('mysql:connect', sessionId, connection, credential);
      if (res.success) {
        setConnected(true);
        // Load default structure
        await loadDatabases();
        
        // If an initial database is configured, select it
        const initialDb = connection.database || '';
        if (initialDb) {
          setCurrentDb(initialDb);
          await loadTables(initialDb);
          setQueryText(`SELECT * FROM ${initialDb}. LIMIT 50;`);
        } else {
          // Select first DB if available (excluding system DBs)
          const systemDbs = ['information_schema', 'mysql', 'performance_schema', 'sys'];
          const userDbs = databases.filter(d => !systemDbs.includes(d));
          const firstDb = userDbs.length > 0 ? userDbs[0] : databases[0];
          if (firstDb) {
            setCurrentDb(firstDb);
            await loadTables(firstDb);
          }
        }
      } else {
        setErrorMsg(res.error || 'No se pudo conectar al servidor MySQL.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error inesperado al conectar.');
    } finally {
      setConnecting(false);
      setLoading(false);
    }
  };

  const loadDatabases = async () => {
    const res = await window.ipcRenderer.invoke('mysql:query', sessionId, 'SHOW DATABASES;');
    if (res.success && res.rows) {
      const dbNames = res.rows.map((row: any) => Object.values(row)[0] as string);
      setDatabases(dbNames);
    }
  };

  const loadTables = async (dbName: string) => {
    if (!dbName) return;
    try {
      // Use selected database
      await window.ipcRenderer.invoke('mysql:query', sessionId, `USE \`${dbName}\`;`);
      const res = await window.ipcRenderer.invoke('mysql:query', sessionId, 'SHOW TABLES;');
      if (res.success && res.rows) {
        const tableNames = res.rows.map((row: any) => Object.values(row)[0] as string);
        setTables(tableNames);
      } else {
        setTables([]);
      }
    } catch (err) {
      setTables([]);
    }
  };

  const handleDbChange = async (dbName: string) => {
    setCurrentDb(dbName);
    await loadTables(dbName);
    setQueryText(`SELECT * FROM \`${dbName}\`. LIMIT 50;`);
  };

  // Run raw SQL
  const executeSql = async (customSql?: string) => {
    const sqlToRun = customSql || queryText;
    if (!sqlToRun.trim()) return;

    setExecutingQuery(true);
    setQueryResult(null);
    const start = performance.now();

    try {
      const res = await window.ipcRenderer.invoke('mysql:query', sessionId, sqlToRun);
      const end = performance.now();
      const timeMs = Math.round(end - start);

      if (res.success) {
        setQueryResult({
          success: true,
          rows: res.rows,
          isQuery: res.isQuery,
          fields: res.fields,
          executionTime: timeMs
        });

        // If query was SHOW DATABASES or SHOW TABLES, refresh sidebar
        const upperSql = sqlToRun.toUpperCase();
        if (upperSql.includes('SHOW DATABASES') || upperSql.includes('CREATE DATABASE') || upperSql.includes('DROP DATABASE')) {
          loadDatabases();
        }
        if (upperSql.includes('CREATE TABLE') || upperSql.includes('DROP TABLE') || upperSql.includes('USE ')) {
          if (currentDb) loadTables(currentDb);
        }
      } else {
        setQueryResult({
          success: false,
          error: res.error,
          executionTime: timeMs
        });
      }
    } catch (err: any) {
      setQueryResult({
        success: false,
        error: err.message || 'Error al ejecutar la consulta.',
        executionTime: 0
      });
    } finally {
      setExecutingQuery(false);
    }
  };

  // Load MySQL Users
  const loadUsers = async () => {
    setUserError(null);
    try {
      const res = await window.ipcRenderer.invoke('mysql:query', sessionId, 'SELECT User, Host FROM mysql.user ORDER BY User, Host;');
      if (res.success && res.rows) {
        const rows = res.rows as any[];
        setUsers(rows);
        
        // Also load databases for the privileges tree
        const dbRes = await window.ipcRenderer.invoke('mysql:query', sessionId, 'SHOW DATABASES;');
        if (dbRes.success && dbRes.rows) {
          const dbNames = dbRes.rows.map((row: any) => Object.values(row)[0] as string);
          setDatabases(dbNames);
        }

        if (rows.length > 0) {
          setSelectedUser(rows[0]);
        } else {
          setSelectedUser(null);
        }
      } else {
        setUserError(res.error || 'No se pudo leer la lista de usuarios. Asegúrate de tener permisos de administrador.');
      }
    } catch (err: any) {
      setUserError(err.message || 'Error de red al leer la lista de usuarios.');
    }
  };

  const loadUserGrants = async (username: string, host: string) => {
    try {
      const query = `SHOW GRANTS FOR '${username}'@'${host}';`;
      const res = await window.ipcRenderer.invoke('mysql:query', sessionId, query);
      if (res.success && res.rows) {
        const grantsList = res.rows.map((row: any) => Object.values(row)[0] as string);
        setUserGrants(grantsList);
      } else {
        setUserGrants([]);
      }
    } catch (err) {
      setUserGrants([]);
    }
  };

  const handleToggleGlobalPrivilege = (priv: string) => {
    setPrivilegesState(prev => {
      const current = prev.global;
      const next = current.includes(priv) 
        ? current.filter(p => p !== priv) 
        : [...current, priv];
      return { ...prev, global: next };
    });
  };

  const handleToggleDbPrivilege = (db: string, priv: string) => {
    setPrivilegesState(prev => {
      const current = prev.databases[db] || [];
      const next = current.includes(priv) 
        ? current.filter(p => p !== priv) 
        : [...current, priv];
      return { 
        ...prev, 
        databases: { ...prev.databases, [db]: next } 
      };
    });
  };

  const handleSelectAllGlobal = (checked: boolean) => {
    setPrivilegesState(prev => ({
      ...prev,
      global: checked ? [...GLOBAL_PRIVS_LIST] : []
    }));
  };

  const handleSelectAllDb = (db: string, checked: boolean) => {
    setPrivilegesState(prev => ({
      ...prev,
      databases: {
        ...prev.databases,
        [db]: checked ? [...DB_PRIVS_LIST] : []
      }
    }));
  };

  const handleCancelChanges = () => {
    setPrivilegesState(JSON.parse(JSON.stringify(originalPrivilegesState)));
    alert('Se han descartado los cambios locales no guardados.');
  };

  const handleSaveChanges = async () => {
    if (!selectedUser) return;
    setSavingChanges(true);

    try {
      // 1. Global privileges
      const globChanged = JSON.stringify(privilegesState.global.sort()) !== JSON.stringify(originalPrivilegesState.global.sort());
      if (globChanged) {
        if (originalPrivilegesState.global.length > 0) {
          try {
            await window.ipcRenderer.invoke('mysql:query', sessionId, `REVOKE ALL PRIVILEGES ON *.* FROM '${selectedUser.User}'@${selectedUser.Host ? `'${selectedUser.Host}'` : 'CURRENT_USER()'};`);
          } catch (e) {}
        }
        
        const cleanGlob = privilegesState.global.filter(p => p !== 'GRANT');
        if (cleanGlob.length > 0) {
          const hasGrantOption = privilegesState.global.includes('GRANT');
          const query = `GRANT ${cleanGlob.join(', ')} ON *.* TO '${selectedUser.User}'@'${selectedUser.Host}'${hasGrantOption ? ' WITH GRANT OPTION' : ''};`;
          const res = await window.ipcRenderer.invoke('mysql:query', sessionId, query);
          if (!res.success) {
            throw new Error(`Error en privilegios globales: ${res.error}`);
          }
        }
      }

      // 2. Database privileges
      for (const db of databases) {
        const origDbPrivs = originalPrivilegesState.databases[db] || [];
        const nextDbPrivs = privilegesState.databases[db] || [];
        
        const dbChanged = JSON.stringify(origDbPrivs.sort()) !== JSON.stringify(nextDbPrivs.sort());
        if (dbChanged) {
          if (origDbPrivs.length > 0) {
            try {
              await window.ipcRenderer.invoke('mysql:query', sessionId, `REVOKE ALL PRIVILEGES ON \`${db}\`.* FROM '${selectedUser.User}'@'${selectedUser.Host}';`);
            } catch (e) {}
          }

          const cleanDb = nextDbPrivs.filter(p => p !== 'GRANT');
          if (cleanDb.length > 0) {
            const hasGrantOption = nextDbPrivs.includes('GRANT');
            const query = `GRANT ${cleanDb.join(', ')} ON \`${db}\`.* TO '${selectedUser.User}'@'${selectedUser.Host}'${hasGrantOption ? ' WITH GRANT OPTION' : ''};`;
            const res = await window.ipcRenderer.invoke('mysql:query', sessionId, query);
            if (!res.success) {
              throw new Error(`Error en base de datos ${db}: ${res.error}`);
            }
          }
        }
      }

      await window.ipcRenderer.invoke('mysql:query', sessionId, 'FLUSH PRIVILEGES;');
      await loadUserGrants(selectedUser.User, selectedUser.Host);
      alert('¡Los privilegios del usuario se actualizaron y guardaron correctamente!');
    } catch (err: any) {
      alert('Error al guardar privilegios: ' + err.message);
    } finally {
      setSavingChanges(false);
    }
  };

  // Create MySQL User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;

    try {
      const createSql = `CREATE USER '${newUsername}'@'${newUserHost}' IDENTIFIED BY '${newUserPassword}';`;
      const res = await window.ipcRenderer.invoke('mysql:query', sessionId, createSql);
      
      if (!res.success) {
        alert('Error al crear usuario: ' + res.error);
        return;
      }

      if (grantAllPrivs) {
        const grantSql = `GRANT ALL PRIVILEGES ON *.* TO '${newUsername}'@'${newUserHost}' WITH GRANT OPTION;`;
        const grantRes = await window.ipcRenderer.invoke('mysql:query', sessionId, grantSql);
        if (!grantRes.success) {
          alert('Usuario creado, pero falló la asignación de privilegios: ' + grantRes.error);
        }
      }

      // Flush Privileges
      await window.ipcRenderer.invoke('mysql:query', sessionId, 'FLUSH PRIVILEGES;');
      
      // Reset Form & Reload
      setNewUsername('');
      setNewUserPassword('');
      setShowCreateUserModal(false);
      await loadUsers();
    } catch (err: any) {
      alert('Error inesperado: ' + err.message);
    }
  };

  // Change password for user
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !changePasswordVal.trim()) return;

    try {
      const alterSql = `ALTER USER '${selectedUser.User}'@'${selectedUser.Host}' IDENTIFIED BY '${changePasswordVal}';`;
      const res = await window.ipcRenderer.invoke('mysql:query', sessionId, alterSql);
      
      if (res.success) {
        await window.ipcRenderer.invoke('mysql:query', sessionId, 'FLUSH PRIVILEGES;');
        alert('Contraseña actualizada con éxito para ' + selectedUser.User);
        setChangePasswordVal('');
        setShowPasswordModal(false);
      } else {
        alert('Error al actualizar contraseña: ' + res.error);
      }
    } catch (err: any) {
      alert('Error inesperado: ' + err.message);
    }
  };

  // Delete user
  const handleDeleteUser = async (user: string, host: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente el usuario '${user}'@'${host}'?`)) return;

    try {
      const dropSql = `DROP USER '${user}'@'${host}';`;
      const res = await window.ipcRenderer.invoke('mysql:query', sessionId, dropSql);
      if (res.success) {
        await window.ipcRenderer.invoke('mysql:query', sessionId, 'FLUSH PRIVILEGES;');
        await loadUsers();
      } else {
        alert('Error al eliminar usuario: ' + res.error);
      }
    } catch (err: any) {
      alert('Error inesperado: ' + err.message);
    }
  };

  // Load Running Processes
  const loadProcesses = async () => {
    setLoadingProcesses(true);
    try {
      const res = await window.ipcRenderer.invoke('mysql:query', sessionId, 'SHOW FULL PROCESSLIST;');
      if (res.success && res.rows) {
        setProcesses(res.rows);
      }
    } catch (err) {}
    setLoadingProcesses(false);
  };

  // Kill database process thread
  const handleKillProcess = async (id: number) => {
    if (!window.confirm(`¿Seguro que deseas matar el proceso/hilo número ${id}?`)) return;

    setLoadingProcesses(true);
    try {
      const res = await window.ipcRenderer.invoke('mysql:query', sessionId, `KILL ${id};`);
      if (res.success) {
        await loadProcesses();
      } else {
        alert('Error al matar proceso: ' + res.error);
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoadingProcesses(false);
    }
  };

  const exportResult = () => {
    if (!queryResult || !queryResult.rows || queryResult.rows.length === 0) return;
    try {
      const rows = queryResult.rows;
      const headers = Object.keys(rows[0]);
      const csvContent = [
        headers.join(','),
        ...rows.map(row => headers.map(fieldName => JSON.stringify(row[fieldName] ?? '')).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `rdm_query_result_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('No se pudo exportar a CSV.');
    }
  };

  const handleTableClick = (table: string) => {
    const fullTableName = currentDb ? `\`${currentDb}\`.\`${table}\`` : `\`${table}\``;
    const sql = `SELECT * FROM ${fullTableName} LIMIT 50;`;
    setQueryText(sql);
    executeSql(sql);
  };

  // Filtered tables for explorer sidebar
  const filteredTables = tables.filter(t => t.toLowerCase().includes(tableSearch.toLowerCase()));

  // Render Loader
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[var(--bg-primary)] text-[var(--text-muted)] gap-4">
        <div className="relative flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
          <Database className="w-5 h-5 absolute text-cyan-500 animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase text-cyan-500 tracking-widest animate-pulse">
            {connecting ? 'Estableciendo Conexión TCP...' : 'Analizando Base de Datos...'}
          </p>
          <p className="text-[10px] text-[var(--text-dim)] mt-1">{connection.host}:{connection.port || 3306}</p>
        </div>
      </div>
    );
  }

  // Render Error state
  if (errorMsg) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[var(--bg-primary)] p-6 text-center">
        <div className="p-3 bg-red-500/10 rounded-full border border-red-500/20 text-red-500 dark:text-red-400 mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-sm font-semibold text-[var(--text-main)] uppercase tracking-wider">Error de Conexión MySQL</h3>
        <p className="text-xs text-red-700 dark:text-red-300 max-w-md mt-2 leading-relaxed font-mono bg-black/5 dark:bg-black/40 p-3 rounded border border-[var(--panel-border)]">
          {errorMsg}
        </p>
        <button 
          onClick={connectDb}
          className="mt-5 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reintentar Conexión
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-[var(--bg-secondary)] overflow-hidden text-[var(--text-muted)] border-t border-[var(--panel-border)]">
      
      {/* 1. EXPLORER SIDEBAR */}
      <div className="w-56 border-r border-[var(--panel-border)] bg-[var(--bg-secondary)] flex flex-col select-none">
        
        {/* Connection Header */}
        <div className="p-3 border-b border-[var(--panel-border)] bg-[var(--bg-primary)]/40 flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 tracking-wide uppercase flex items-center gap-1">
              <Database className="w-3 h-3 text-cyan-600 dark:text-cyan-400" /> Connected
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
          </div>
          <p className="text-xs font-bold text-[var(--text-main)] truncate">{connection.name}</p>
          <p className="text-[9px] text-[var(--text-dim)] truncate font-mono">{connection.host}</p>
        </div>

        {/* Database Selector Dropdown */}
        <div className="p-2 border-b border-[var(--panel-border)] bg-[var(--bg-primary)]/20 flex flex-col gap-1">
          <label className="text-[9px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">Schema / BD</label>
          <select 
            value={currentDb}
            onChange={e => handleDbChange(e.target.value)}
            className="w-full bg-[var(--bg-secondary)] border border-[var(--panel-border)] text-xs py-1 px-1.5 rounded text-[var(--text-main)] focus:outline-none focus:border-cyan-500 transition-all font-mono"
          >
            <option value="">-- Ninguna --</option>
            {databases.map(db => (
              <option key={db} value={db} className="bg-[var(--bg-secondary)] text-[var(--text-main)]">{db}</option>
            ))}
          </select>
        </div>

        {/* List of Tables Explorer */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-2 flex items-center gap-1.5 border-b border-[var(--panel-border)] bg-[var(--bg-primary)]/10">
            <Search className="w-3 h-3 text-[var(--text-dim)]" />
            <input 
              type="text" 
              placeholder="Buscar tabla..." 
              value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
              className="w-full bg-transparent text-[11px] placeholder:text-[var(--text-dim)]/60 text-[var(--text-main)] focus:outline-none"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 scrollbar-thin">
            <span className="text-[9px] text-[var(--text-dim)] font-bold uppercase tracking-wider px-1">Tablas ({filteredTables.length})</span>
            {filteredTables.length > 0 ? (
              filteredTables.map(t => (
                <button
                  key={t}
                  onClick={() => handleTableClick(t)}
                  className="w-full text-left py-1 px-1.5 rounded hover:bg-[var(--bg-tertiary)]/30 transition-all text-xs truncate flex items-center gap-2 group text-[var(--text-muted)] hover:text-[var(--text-main)]"
                >
                  <Table className="w-3.5 h-3.5 text-cyan-500/60 group-hover:text-cyan-500 transition-colors shrink-0" />
                  <span className="truncate font-mono">{t}</span>
                </button>
              ))
            ) : (
              <span className="text-[10px] text-[var(--text-dim)] italic px-1 mt-2">Ninguna tabla disponible</span>
            )}
          </div>
        </div>

        {/* Extra admin panels list */}
        <div className="p-2 border-t border-[var(--panel-border)] bg-[var(--bg-primary)]/30 flex flex-col gap-1">
          <span className="text-[9px] text-[var(--text-dim)] font-bold uppercase tracking-wider px-1">Administración</span>
          <button 
            onClick={() => { setActiveTab('users'); loadUsers(); }}
            className={`w-full text-left py-1.5 px-2 rounded transition-all text-xs flex items-center gap-2 ${activeTab === 'users' ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 font-medium border border-cyan-500/20' : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]/40 hover:text-[var(--text-main)]'}`}
          >
            <Users className="w-3.5 h-3.5 text-cyan-500" /> Usuarios
          </button>
          <button 
            onClick={() => { setActiveTab('processes'); loadProcesses(); }}
            className={`w-full text-left py-1.5 px-2 rounded transition-all text-xs flex items-center gap-2 ${activeTab === 'processes' ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 font-medium border border-cyan-500/20' : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]/40 hover:text-[var(--text-main)]'}`}
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-500" /> Monitor Procesos
          </button>
        </div>
      </div>

      {/* 2. MAIN AREA PANELS */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-primary)]/10">
        
        {/* Navigation Bar */}
        <div className="h-10 border-b border-[var(--panel-border)] bg-[var(--bg-primary)]/30 flex items-center justify-between px-4">
          <div className="flex items-center gap-2 select-none">
            <button 
              onClick={() => setActiveTab('editor')}
              className={`px-3 h-10 border-b-2 text-xs font-semibold transition-all uppercase tracking-wide flex items-center gap-1.5 ${activeTab === 'editor' ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-[var(--bg-primary)]/10' : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text-main)]'}`}
            >
              <Terminal className="w-3.5 h-3.5" /> Editor SQL
            </button>
            <button 
              onClick={() => { setActiveTab('users'); loadUsers(); }}
              className={`px-3 h-10 border-b-2 text-xs font-semibold transition-all uppercase tracking-wide flex items-center gap-1.5 ${activeTab === 'users' ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-[var(--bg-primary)]/10' : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text-main)]'}`}
            >
              <Users className="w-3.5 h-3.5" /> USUARIOS
            </button>
            <button 
              onClick={() => { setActiveTab('processes'); loadProcesses(); }}
              className={`px-3 h-10 border-b-2 text-xs font-semibold transition-all uppercase tracking-wide flex items-center gap-1.5 ${activeTab === 'processes' ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-[var(--bg-primary)]/10' : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text-main)]'}`}
            >
              <Cpu className="w-3.5 h-3.5" /> Procesos MySQL
            </button>
          </div>

          {activeTab === 'editor' && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => executeSql()}
                disabled={executingQuery}
                className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 text-white rounded text-xs font-bold transition-all flex items-center gap-1.5 shadow-[0_0_8px_rgba(6,182,212,0.2)]"
              >
                {executingQuery ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                {executingQuery ? 'Ejecutando...' : 'Ejecutar (F5)'}
              </button>
            </div>
          )}
        </div>

        {/* Panel Content Router */}
        <div className="flex-1 overflow-hidden flex flex-col">
          
          {/* TAB A: EDITOR SQL */}
          {activeTab === 'editor' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* SQL Textarea Block */}
              <div className="h-44 border-b border-[var(--panel-border)] relative flex flex-col bg-[var(--bg-primary)]/40">
                <div className="px-3 py-1 border-b border-[var(--panel-border)] bg-[var(--bg-primary)]/30 flex items-center justify-between select-none">
                  <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Escribe tu consulta SQL</span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setQueryText('')} 
                      className="text-[9px] text-[var(--text-dim)] hover:text-red-500 transition-colors"
                    >
                      Limpiar
                    </button>
                    <span className="text-[9px] text-[var(--text-dim)]">|</span>
                    <span className="text-[9px] text-[var(--text-dim)] font-mono">Use Ctrl + Enter para ejecutar</span>
                  </div>
                </div>
                
                <textarea
                  value={queryText}
                  onChange={e => setQueryText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      executeSql();
                    }
                  }}
                  className="flex-1 w-full bg-transparent p-3 text-xs font-mono text-cyan-700 dark:text-cyan-300 placeholder-[var(--text-dim)]/50 focus:outline-none resize-none leading-relaxed"
                  placeholder="SELECT * FROM tabla LIMIT 100;"
                  spellCheck={false}
                />
              </div>

              {/* SQL RESULTS */}
              <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-primary)]/10">
                
                {/* Result header / stats */}
                <div className="px-4 py-2 border-b border-[var(--panel-border)] bg-[var(--bg-primary)]/30 flex items-center justify-between select-none">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Resultados de Consulta</span>
                    {queryResult && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${queryResult.success ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'}`}>
                        {queryResult.success ? '✓ Éxito' : '✗ Falló'}
                      </span>
                    )}
                  </div>

                  {queryResult && queryResult.success && (
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-[var(--text-dim)] font-mono">
                        Tiempo: <strong className="text-[var(--text-main)]">{queryResult.executionTime}ms</strong>
                      </span>
                      {queryResult.rows && queryResult.rows.length > 0 && (
                        <>
                          <span className="text-[10px] text-[var(--text-dim)] font-mono">
                            Filas: <strong className="text-[var(--text-main)]">{queryResult.rows.length}</strong>
                          </span>
                          <button 
                            onClick={exportResult}
                            className="px-2 py-0.5 bg-[var(--bg-primary)]/20 hover:bg-[var(--bg-primary)]/30 rounded border border-[var(--panel-border)] text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5 transition-all"
                          >
                            <Download className="w-3 h-3" /> Exportar CSV
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Result Container */}
                <div className="flex-1 overflow-auto p-4 scrollbar-thin">
                  
                  {!queryResult && !executingQuery && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none">
                      <FileText className="w-10 h-10 text-[var(--text-dim)]/20 mb-2" />
                      <p className="text-xs text-[var(--text-dim)]">Escribe una consulta SQL y presiona "Ejecutar" para ver la respuesta.</p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-md">
                        <button 
                          onClick={() => { setQueryText('SHOW PROCESSLIST;'); executeSql('SHOW PROCESSLIST;'); }}
                          className="px-2.5 py-1 bg-[var(--bg-primary)]/20 hover:bg-[var(--bg-primary)]/30 border border-[var(--panel-border)] rounded text-[10px] text-[var(--text-muted)] hover:text-cyan-600 dark:hover:text-cyan-400 transition-all font-mono"
                        >
                          SHOW PROCESSLIST;
                        </button>
                        <button 
                          onClick={() => { setQueryText('SELECT VERSION(), CURRENT_USER();'); executeSql('SELECT VERSION(), CURRENT_USER();'); }}
                          className="px-2.5 py-1 bg-[var(--bg-primary)]/20 hover:bg-[var(--bg-primary)]/30 border border-[var(--panel-border)] rounded text-[10px] text-[var(--text-muted)] hover:text-cyan-600 dark:hover:text-cyan-400 transition-all font-mono"
                        >
                          SELECT VERSION();
                        </button>
                        <button 
                          onClick={() => { setQueryText('SHOW VARIABLES LIKE "%char%";'); executeSql('SHOW VARIABLES LIKE "%char%";'); }}
                          className="px-2.5 py-1 bg-[var(--bg-primary)]/20 hover:bg-[var(--bg-primary)]/30 border border-[var(--panel-border)] rounded text-[10px] text-[var(--text-muted)] hover:text-cyan-600 dark:hover:text-cyan-400 transition-all font-mono"
                        >
                          SHOW VARIABLES;
                        </button>
                      </div>
                    </div>
                  )}

                  {executingQuery && (
                    <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                      <p className="text-xs text-[var(--text-dim)] font-mono">Procesando consulta SQL en el servidor...</p>
                    </div>
                  )}

                  {queryResult && !queryResult.success && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded flex gap-3 text-red-700 dark:text-red-300">
                      <AlertTriangle className="w-5 h-5 shrink-0 text-red-500 dark:text-red-400" />
                      <div className="flex-1 flex flex-col gap-1">
                        <span className="text-xs font-bold uppercase tracking-wide">Error de Sintaxis o Servidor SQL</span>
                        <span className="text-[11px] font-mono leading-relaxed bg-black/5 dark:bg-black/45 p-2.5 rounded border border-[var(--panel-border)]">
                          {queryResult.error}
                        </span>
                      </div>
                    </div>
                  )}

                  {queryResult && queryResult.success && queryResult.isQuery && (
                    <div className="w-full">
                      {queryResult.rows && queryResult.rows.length > 0 ? (
                        <div className="overflow-x-auto rounded border border-[var(--panel-border)] bg-[var(--bg-secondary)] shadow-sm">
                          <table className="w-full text-left text-xs font-mono select-text">
                            <thead>
                              <tr className="bg-[var(--bg-primary)]/20 border-b border-[var(--panel-border)] text-cyan-600 dark:text-cyan-400 select-none">
                                <th className="px-3 py-2 text-[10px] font-bold text-center border-r border-[var(--panel-border)] text-[var(--text-dim)] bg-[var(--bg-primary)]/20">#</th>
                                {Object.keys(queryResult.rows[0]).map(key => (
                                  <th key={key} className="px-3 py-2 text-[10px] font-bold border-r border-[var(--panel-border)] uppercase tracking-wide">
                                    {key}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--panel-border)]">
                              {queryResult.rows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-cyan-500/5 transition-colors">
                                  <td className="px-3 py-1.5 text-center border-r border-[var(--panel-border)] text-[var(--text-dim)] select-none bg-[var(--bg-primary)]/10">{idx + 1}</td>
                                  {Object.entries(row).map(([_cellKey, cellVal]: any, cellIdx) => (
                                    <td key={cellIdx} className="px-3 py-1.5 border-r border-[var(--panel-border)] break-all max-w-[250px] truncate text-[var(--text-muted)] hover:text-[var(--text-main)]" title={String(cellVal ?? 'NULL')}>
                                      {cellVal === null ? (
                                        <span className="text-[var(--text-dim)]/50 italic select-none">NULL</span>
                                      ) : typeof cellVal === 'object' ? (
                                        JSON.stringify(cellVal)
                                      ) : (
                                        String(cellVal)
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-4 bg-[var(--bg-primary)]/10 border border-[var(--panel-border)] rounded text-center text-xs text-[var(--text-dim)] italic select-none">
                          La consulta se ejecutó con éxito pero devolvió un conjunto de resultados vacío.
                        </div>
                      )}
                    </div>
                  )}

                  {queryResult && queryResult.success && !queryResult.isQuery && (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded flex gap-3 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle className="w-5 h-5 shrink-0 text-emerald-500 dark:text-emerald-400" />
                      <div className="flex-1 flex flex-col gap-1">
                        <span className="text-xs font-bold uppercase tracking-wide">Consulta DDL/DML Ejecutada</span>
                        <p className="text-xs">Sentencia ejecutada correctamente en el motor MySQL.</p>
                        <span className="text-[11px] font-mono leading-relaxed bg-black/5 dark:bg-black/45 p-2.5 rounded border border-[var(--panel-border)] mt-1">
                          {JSON.stringify(queryResult.rows)}
                        </span>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

          {/* TAB B: GESTOR DE USUARIOS (ESTILO SQLYOG) */}
          {activeTab === 'users' && (
            <div className="flex-1 flex flex-col overflow-hidden h-full">
              {/* TOP BAR / HEADER (SQLyog styled) */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-[var(--panel-border)] bg-[var(--bg-primary)]/20 select-none">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-[var(--text-muted)]">Usuario</span>
                  <select
                    value={selectedUser ? `${selectedUser.User}@${selectedUser.Host}` : ''}
                    onChange={e => {
                      const val = e.target.value;
                      const found = users.find(u => `${u.User}@${u.Host}` === val);
                      if (found) setSelectedUser(found);
                    }}
                    className="bg-[var(--bg-secondary)] border border-[var(--panel-border)] text-xs text-[var(--text-main)] px-3 py-1.5 rounded focus:outline-none focus:border-cyan-500 font-mono w-60"
                  >
                    {users.map((usr, i) => (
                      <option key={i} value={`${usr.User}@${usr.Host}`}>
                        {usr.User}@{usr.Host}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (selectedUser) handleDeleteUser(selectedUser.User, selectedUser.Host);
                    }}
                    disabled={!selectedUser}
                    className="px-3.5 py-1.5 border border-red-500/30 hover:bg-red-500/10 text-red-600 dark:text-red-400 rounded text-xs font-semibold transition-all disabled:opacity-40"
                  >
                    Eliminar Usuario
                  </button>
                  <button
                    onClick={() => setShowCreateUserModal(true)}
                    className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-bold transition-all shadow-[0_0_8px_rgba(6,182,212,0.15)]"
                  >
                    Añadir Usuario
                  </button>
                </div>
              </div>

              {userError && (
                <div className="p-4 mx-5 mt-4 bg-red-500/10 border border-red-500/20 rounded flex gap-3 text-red-700 dark:text-red-300 select-none">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-red-500 dark:text-red-400" />
                  <div className="flex-1">
                    <span className="text-xs font-bold uppercase tracking-wide">Faltan Permisos de Administrador</span>
                    <p className="text-[11px] mt-1 leading-relaxed">{userError}</p>
                    <p className="text-[10px] text-[var(--text-dim)] mt-2">Puedes intentar ejecutar comandos CREATE USER o GRANT manualmente desde el Editor SQL.</p>
                  </div>
                </div>
              )}

              {!userError && (
                <div className="flex-1 flex flex-col min-h-0 p-4">
                  {/* MAIN SPLIT VIEW CONTAINER */}
                  <div className="flex-1 flex gap-4 min-h-0">
                    
                    {/* LEFT COLUMN: OBJECT TREE */}
                    <div className="w-80 shrink-0 border border-[var(--panel-border)] bg-[var(--bg-secondary)] rounded-lg flex flex-col overflow-hidden">
                      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1.5 scrollbar-thin select-none">
                        {selectedUser ? (
                          <div className="flex flex-col gap-1">
                            {/* Root Node: User */}
                            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-main)] font-mono">
                              <ChevronDown className="w-3.5 h-3.5 text-[var(--text-dim)] shrink-0" />
                              <User className="w-4 h-4 text-cyan-500 shrink-0" />
                              <span>{selectedUser.User}@{selectedUser.Host}</span>
                            </div>

                            {/* Global Privileges Child Node */}
                            <div 
                              onClick={() => setSelectedNode({ type: 'global' })}
                              className={`ml-6 p-2 rounded cursor-pointer transition-all text-xs flex items-center gap-2 border ${
                                selectedNode.type === 'global'
                                  ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-300 font-bold font-sans'
                                  : 'border-transparent text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]/20 hover:text-[var(--text-main)] font-sans'
                              }`}
                            >
                              <Globe className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                              <span>Privilegios Globales</span>
                            </div>

                            {/* Object Level Privileges Folder Node */}
                            <div className="ml-6 flex flex-col gap-1">
                              <div 
                                onClick={() => {
                                  setObjectFolderExpanded(!objectFolderExpanded);
                                  setSelectedNode({ type: 'object_folder' });
                                }}
                                className={`p-2 rounded cursor-pointer transition-all text-xs flex items-center gap-2 border ${
                                  selectedNode.type === 'object_folder'
                                    ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-300 font-bold font-sans'
                                    : 'border-transparent text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]/20 hover:text-[var(--text-main)] font-sans'
                                }`}
                              >
                                {objectFolderExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-[var(--text-dim)] shrink-0" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-[var(--text-dim)] shrink-0" />
                                )}
                                <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span>Privilegios a Nivel de Objeto</span>
                              </div>

                              {/* Database Leaves */}
                              {objectFolderExpanded && (
                                <div className="ml-5 pl-2 border-l border-[var(--panel-border)]/50 flex flex-col gap-1">
                                  {databases.filter(db => {
                                    if (!showOnlyPrivileged) return true;
                                    const dbPrivs = privilegesState.databases[db] || [];
                                    return dbPrivs.length > 0;
                                  }).length === 0 ? (
                                    <span className="text-[10px] text-[var(--text-dim)] italic p-2 select-none">No hay bases de datos</span>
                                  ) : (
                                    databases.filter(db => {
                                      if (!showOnlyPrivileged) return true;
                                      const dbPrivs = privilegesState.databases[db] || [];
                                      return dbPrivs.length > 0;
                                    }).map((db, idx) => {
                                      const isSelected = selectedNode.type === 'database' && selectedNode.dbName === db;
                                      const hasPrivs = (privilegesState.databases[db] || []).length > 0;
                                      return (
                                        <div
                                          key={idx}
                                          onClick={() => setSelectedNode({ type: 'database', dbName: db })}
                                          className={`p-1.5 rounded cursor-pointer transition-all text-xs flex items-center gap-2 border ${
                                            isSelected
                                              ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-300 font-bold'
                                              : 'border-transparent text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]/20 hover:text-[var(--text-main)]'
                                          }`}
                                        >
                                          <Database className={`w-3.5 h-3.5 shrink-0 ${hasPrivs ? 'text-emerald-500' : 'text-[var(--text-dim)]/60'}`} />
                                          <span className="font-mono text-[11px] truncate">{db}</span>
                                          {hasPrivs && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-auto shrink-0" title="Tiene privilegios asignados" />
                                          )}
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="py-12 flex flex-col items-center justify-center gap-2 text-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-500"></div>
                            <p className="text-xs text-[var(--text-dim)]">Cargando usuarios...</p>
                          </div>
                        )}
                      </div>

                      {/* Checkbox at the bottom */}
                      <div className="p-3 border-t border-[var(--panel-border)] bg-[var(--bg-primary)]/10 flex items-center gap-2 select-none">
                        <input
                          type="checkbox"
                          id="chkShowOnlyPriv"
                          checked={showOnlyPrivileged}
                          onChange={e => setShowOnlyPrivileged(e.target.checked)}
                          className="rounded border-[var(--panel-border)] bg-transparent text-cyan-600 dark:text-cyan-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
                        />
                        <label htmlFor="chkShowOnlyPriv" className="text-[11px] text-[var(--text-muted)] font-semibold cursor-pointer select-none">
                          Mostrar solo objetos con privilegios
                        </label>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: PRIVILEGES CHECKBOX GRID */}
                    <div className="flex-1 border border-[var(--panel-border)] bg-[var(--bg-secondary)] rounded-lg flex flex-col overflow-hidden">
                      {selectedNode.type === 'global' && (
                        <div className="flex-1 flex flex-col overflow-hidden">
                          {/* Scope Header */}
                          <div className="p-4 border-b border-[var(--panel-border)] bg-[var(--bg-primary)]/10 flex items-center gap-2 select-none text-[var(--text-muted)]">
                            <Globe className="w-4 h-4 text-cyan-500" />
                            <span className="text-xs font-bold">CONCEDER/REVOCAR privilegios globales para este usuario</span>
                          </div>

                          {/* Select All Checkbox */}
                          <div className="p-3 bg-[var(--bg-primary)]/5 border-b border-[var(--panel-border)]/50 flex items-center gap-2 select-none">
                            <input
                              type="checkbox"
                              id="globalSelectAll"
                              checked={GLOBAL_PRIVS_LIST.every(p => privilegesState.global.includes(p))}
                              onChange={e => handleSelectAllGlobal(e.target.checked)}
                              className="rounded border-[var(--panel-border)] bg-transparent text-cyan-600 dark:text-cyan-500 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                            />
                            <label htmlFor="globalSelectAll" className="text-xs font-bold text-[var(--text-main)] cursor-pointer">
                              Seleccionar/Deseleccionar Todo
                            </label>
                          </div>

                          {/* Checkboxes Grid */}
                          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 font-mono text-[11px] text-[var(--text-main)]">
                              {GLOBAL_PRIVS_LIST.map((priv, idx) => {
                                const isChecked = privilegesState.global.includes(priv);
                                return (
                                  <label 
                                    key={idx}
                                    className="flex items-start gap-2.5 p-2 rounded hover:bg-[var(--bg-primary)]/15 border border-[var(--panel-border)]/30 hover:border-cyan-500/20 cursor-pointer transition-all select-none"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleGlobalPrivilege(priv)}
                                      className="rounded border-[var(--panel-border)] bg-transparent text-cyan-600 dark:text-cyan-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 mt-0.5 cursor-pointer shrink-0"
                                    />
                                    <span>{priv}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedNode.type === 'database' && selectedNode.dbName && (
                        <div className="flex-1 flex flex-col overflow-hidden">
                          {/* Scope Header */}
                          <div className="p-4 border-b border-[var(--panel-border)] bg-[var(--bg-primary)]/10 flex items-center justify-between select-none text-[var(--text-muted)]">
                            <div className="flex items-center gap-2">
                              <Database className="w-4 h-4 text-emerald-500" />
                              <span className="text-xs font-bold">CONCEDER/REVOCAR privilegios sobre los objetos seleccionados para este usuario</span>
                            </div>
                            <span className="text-xs font-bold font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                              bd: {selectedNode.dbName}
                            </span>
                          </div>

                          {/* Select All Checkbox */}
                          <div className="p-3 bg-[var(--bg-primary)]/5 border-b border-[var(--panel-border)]/50 flex items-center gap-2 select-none">
                            <input
                              type="checkbox"
                              id="dbSelectAll"
                              checked={DB_PRIVS_LIST.every(p => (privilegesState.databases[selectedNode.dbName!] || []).includes(p))}
                              onChange={e => handleSelectAllDb(selectedNode.dbName!, e.target.checked)}
                              className="rounded border-[var(--panel-border)] bg-transparent text-cyan-600 dark:text-cyan-500 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                            />
                            <label htmlFor="dbSelectAll" className="text-xs font-bold text-[var(--text-main)] cursor-pointer">
                              Seleccionar/Deseleccionar Todo
                            </label>
                          </div>

                          {/* Checkboxes Grid */}
                          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 font-mono text-[11px] text-[var(--text-main)]">
                              {DB_PRIVS_LIST.map((priv, idx) => {
                                const isChecked = (privilegesState.databases[selectedNode.dbName!] || []).includes(priv);
                                return (
                                  <label 
                                    key={idx}
                                    className="flex items-start gap-2.5 p-2 rounded hover:bg-[var(--bg-primary)]/15 border border-[var(--panel-border)]/30 hover:border-emerald-500/20 cursor-pointer transition-all select-none"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleDbPrivilege(selectedNode.dbName!, priv)}
                                      className="rounded border-[var(--panel-border)] bg-transparent text-cyan-600 dark:text-cyan-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 mt-0.5 cursor-pointer shrink-0"
                                    />
                                    <span>{priv}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedNode.type === 'object_folder' && (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none bg-[var(--bg-primary)]/5">
                          <Folder className="w-16 h-16 text-[var(--text-dim)]/20 mb-3 animate-pulse" />
                          <h4 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">Nota - Selecciona un objeto para gestionar sus privilegios</h4>
                          <p className="text-[11px] text-[var(--text-dim)] mt-2 max-w-sm leading-relaxed">
                            Selecciona una base de datos específica bajo la carpeta "Privilegios a Nivel de Objeto" de la izquierda para ver y gestionar sus privilegios.
                          </p>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* BOTTOM ACTION BAR */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--panel-border)] pt-4 select-none">
                    <button
                      onClick={() => {
                        if (selectedUser) {
                          setChangePasswordVal('');
                          setShowPasswordModal(true);
                        }
                      }}
                      disabled={!selectedUser}
                      className="px-3.5 py-1.5 bg-[var(--bg-primary)]/15 hover:bg-[var(--bg-primary)]/25 border border-[var(--panel-border)] rounded text-xs font-bold text-cyan-600 dark:text-cyan-300 hover:border-cyan-500 transition-all flex items-center gap-1.5 disabled:opacity-40"
                    >
                      <Key className="w-3.5 h-3.5 text-cyan-500 shrink-0" /> Cambiar Contraseña del Usuario
                    </button>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleCancelChanges}
                        className="px-4 py-1.5 border border-[var(--panel-border)] text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-primary)]/15 rounded transition-all font-semibold"
                      >
                        Cancelar Cambios
                      </button>
                      <button
                        onClick={handleSaveChanges}
                        disabled={savingChanges || !selectedUser}
                        className="px-5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-bold transition-all shadow-[0_0_8px_rgba(6,182,212,0.2)] flex items-center gap-1.5 disabled:opacity-55"
                      >
                        {savingChanges ? (
                          <>
                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                            <span>Guardando...</span>
                          </>
                        ) : (
                          <span>Guardar Cambios</span>
                        )}
                      </button>
                    </div>
                  </div>

                </div>
              )}

              {/* MODAL CREAR NUEVO USUARIO (FONDO OSCURO CON BACKDROP-BLUR) */}
              {showCreateUserModal && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="w-full max-w-lg bg-[var(--bg-secondary)] border border-[var(--panel-border)] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 select-none font-sans">
                    <div className="flex items-center justify-between p-4 border-b border-[var(--panel-border)] bg-[var(--bg-primary)]/20">
                      <span className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-1.5 font-sans">
                        <UserPlus className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Crear Nuevo Usuario MySQL
                      </span>
                      <button onClick={() => setShowCreateUserModal(false)} className="text-xs text-[var(--text-dim)] hover:text-[var(--text-main)]"><X className="w-4 h-4" /></button>
                    </div>

                    <form onSubmit={handleCreateUser} className="p-5 flex flex-col gap-4 font-sans">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2 flex flex-col gap-1">
                          <label className="text-[9px] text-[var(--text-dim)] font-semibold uppercase">Nombre del Usuario</label>
                          <input 
                            type="text" 
                            placeholder="ej. api_user" 
                            value={newUsername}
                            onChange={e => setNewUsername(e.target.value)}
                            className="glass-input text-xs bg-[var(--bg-secondary)] border border-[var(--panel-border)] text-[var(--text-main)] px-3 py-1.5"
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] text-[var(--text-dim)] font-semibold uppercase">Host Permitido</label>
                          <input 
                            type="text" 
                            placeholder="ej. % o localhost" 
                            value={newUserHost}
                            onChange={e => setNewUserHost(e.target.value)}
                            className="glass-input text-xs font-mono bg-[var(--bg-secondary)] border border-[var(--panel-border)] text-[var(--text-main)] px-3 py-1.5"
                            required
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-[var(--text-dim)] font-semibold uppercase">Contraseña del Usuario</label>
                        <input 
                          type="password" 
                          placeholder="Escribe clave fuerte..." 
                          value={newUserPassword}
                          onChange={e => setNewUserPassword(e.target.value)}
                          className="glass-input text-xs bg-[var(--bg-secondary)] border border-[var(--panel-border)] text-[var(--text-main)] px-3 py-1.5"
                          required
                        />
                      </div>

                      <div className="flex items-center gap-2 mt-2 bg-[var(--bg-primary)]/20 p-2.5 rounded border border-[var(--panel-border)]">
                        <input 
                          type="checkbox" 
                          id="chkGrantAll"
                          checked={grantAllPrivs}
                          onChange={e => setGrantAllPrivs(e.target.checked)}
                          className="rounded border-[var(--panel-border)] bg-transparent text-cyan-600 dark:text-cyan-500 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor="chkGrantAll" className="text-xs text-[var(--text-muted)] cursor-pointer select-none">
                          Otorgar todos los privilegios globales (<code className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono">GRANT ALL PRIVILEGES</code>)
                        </label>
                      </div>

                      <div className="flex justify-end gap-3 mt-4 border-t border-[var(--panel-border)] pt-4">
                        <button 
                          type="button" 
                          onClick={() => setShowCreateUserModal(false)}
                          className="px-4 py-1.5 border border-[var(--panel-border)] text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--bg-primary)]/20 rounded text-xs transition-all"
                        >
                          Cancelar
                        </button>
                        <button 
                          type="submit"
                          className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-bold transition-all shadow-[0_0_8px_rgba(6,182,212,0.15)]"
                        >
                          Crear Usuario
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* MODAL CAMBIAR CONTRASEÑA */}
              {showPasswordModal && selectedUser && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--panel-border)] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 select-none font-sans">
                    <div className="flex items-center justify-between p-4 border-b border-[var(--panel-border)] bg-[var(--bg-primary)]/20">
                      <span className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-1.5 font-sans">
                        <Key className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Cambiar Contraseña del Usuario
                      </span>
                      <button onClick={() => setShowPasswordModal(false)} className="text-xs text-[var(--text-dim)] hover:text-[var(--text-main)]"><X className="w-4 h-4" /></button>
                    </div>

                    <form onSubmit={handleChangePassword} className="p-5 flex flex-col gap-4 font-sans">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-[var(--text-dim)] font-semibold uppercase">Nueva contraseña para '{selectedUser.User}'@'{selectedUser.Host}'</label>
                        <input 
                          type="password" 
                          placeholder="Escribe la nueva contraseña..." 
                          value={changePasswordVal}
                          onChange={e => setChangePasswordVal(e.target.value)}
                          className="glass-input text-xs bg-[var(--bg-secondary)] border border-[var(--panel-border)] text-[var(--text-main)] px-3 py-1.5"
                          required
                          autoFocus
                        />
                      </div>

                      <div className="flex justify-end gap-3 mt-4 border-t border-[var(--panel-border)] pt-4">
                        <button 
                          type="button" 
                          onClick={() => setShowPasswordModal(false)}
                          className="px-4 py-1.5 border border-[var(--panel-border)] text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--bg-primary)]/20 rounded text-xs transition-all"
                        >
                          Cancelar
                        </button>
                        <button 
                          type="submit"
                          className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-bold transition-all shadow-[0_0_8px_rgba(6,182,212,0.15)]"
                        >
                          Actualizar Contraseña
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB C: MONITOR DE PROCESOS */}
          {activeTab === 'processes' && (
            <div className="flex-1 flex flex-col overflow-hidden p-5 font-sans">
              
              <div className="flex items-center justify-between mb-4 border-b border-[var(--panel-border)] pb-3 select-none">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-cyan-600 dark:text-cyan-400 animate-pulse" /> Monitor de Consultas Activas
                  </h3>
                  <p className="text-[11px] text-[var(--text-dim)] mt-0.5">Visualiza en tiempo real qué consultas y conexiones están saturando tu base de datos y detén hilos pesados con un click.</p>
                </div>

                <div className="flex items-center gap-3 font-sans">
                  <div className="flex items-center gap-1.5 bg-[var(--bg-primary)]/10 px-2.5 py-1 rounded border border-[var(--panel-border)]">
                    <input 
                      type="checkbox" 
                      id="chkRefresh" 
                      checked={processAutoRefresh}
                      onChange={e => setProcessAutoRefresh(e.target.checked)}
                      className="rounded border-[var(--panel-border)] bg-transparent text-cyan-600 dark:text-cyan-500 focus:ring-0 focus:ring-offset-0"
                    />
                    <label htmlFor="chkRefresh" className="text-[10px] text-[var(--text-muted)] font-semibold cursor-pointer">Auto-refrescar (3s)</label>
                  </div>

                  <button 
                    onClick={loadProcesses}
                    disabled={loadingProcesses}
                    className="p-1.5 bg-[var(--bg-primary)]/10 hover:bg-[var(--bg-primary)]/25 rounded border border-[var(--panel-border)] text-cyan-600 dark:text-cyan-400 flex items-center justify-center transition-all disabled:opacity-50"
                    title="Actualizar ahora"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingProcesses ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Process Grid */}
              <div className="flex-1 overflow-auto rounded border border-[var(--panel-border)] bg-[var(--bg-secondary)] shadow-sm scrollbar-thin">
                {processes.length > 0 ? (
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="bg-[var(--bg-primary)]/20 border-b border-[var(--panel-border)] text-cyan-600 dark:text-cyan-400 select-none">
                        <th className="px-3 py-2 text-[10px] font-bold">ID</th>
                        <th className="px-3 py-2 text-[10px] font-bold">Usuario</th>
                        <th className="px-3 py-2 text-[10px] font-bold">Host</th>
                        <th className="px-3 py-2 text-[10px] font-bold">BD</th>
                        <th className="px-3 py-2 text-[10px] font-bold">Comando</th>
                        <th className="px-3 py-2 text-[10px] font-bold text-center">Tiempo (s)</th>
                        <th className="px-3 py-2 text-[10px] font-bold">Estado</th>
                        <th className="px-3 py-2 text-[10px] font-bold">Consulta Activa</th>
                        <th className="px-3 py-2 text-[10px] font-bold text-right select-none">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--panel-border)]">
                      {processes.map((proc, i) => (
                        <tr key={i} className="hover:bg-[var(--bg-tertiary)]/20 transition-colors">
                          <td className="px-3 py-1.5 text-[var(--text-main)] font-bold">{proc.Id}</td>
                          <td className="px-3 py-1.5 text-[var(--text-muted)]">{proc.User}</td>
                          <td className="px-3 py-1.5 text-[var(--text-dim)] truncate max-w-[120px]">{proc.Host}</td>
                          <td className="px-3 py-1.5 text-cyan-600 dark:text-cyan-400">{proc.db || <span className="text-[var(--text-dim)]/50 italic">none</span>}</td>
                          <td className="px-3 py-1.5 text-[var(--text-muted)]">{proc.Command}</td>
                          <td className="px-3 py-1.5 text-center text-[var(--text-main)] font-semibold">{proc.Time}</td>
                          <td className="px-3 py-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${proc.State === 'Query' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' : 'bg-[var(--bg-primary)]/10 text-[var(--text-dim)]'}`}>
                              {proc.State || 'Idle'}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 max-w-[200px] truncate text-[var(--text-muted)] hover:text-[var(--text-main)]" title={proc.Info || ''}>
                            {proc.Info || <span className="text-[var(--text-dim)]/50 italic">-</span>}
                          </td>
                          <td className="px-3 py-1.5 text-right select-none font-sans">
                            <button 
                              onClick={() => handleKillProcess(proc.Id)}
                              disabled={proc.Command === 'Daemon'}
                              className="px-2 py-0.5 bg-red-500/10 hover:bg-red-500/20 disabled:bg-[var(--bg-primary)]/10 disabled:text-[var(--text-dim)] rounded border border-red-500/15 text-[9px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 transition-all"
                            >
                              Kill
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-12 text-center text-xs text-[var(--text-dim)] italic">No hay hilos activos en este momento</div>
                )}
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
