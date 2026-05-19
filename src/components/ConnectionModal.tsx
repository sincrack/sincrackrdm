import { useState, useEffect } from 'react'
import { Folder, Terminal, Network, Monitor, Globe, ShieldAlert, Database } from 'lucide-react'

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  editingConnection?: any;
  folders: any[];
  credentials: any[];
  connections: any[]; // para usar de Jump Host
}

export default function ConnectionModal({ 
  isOpen, onClose, onSave, editingConnection, folders, credentials, connections 
}: ConnectionModalProps) {
  const [modalType, setModalType] = useState<'connection' | 'folder'>('connection');
  const [protocol, setProtocol] = useState<'ssh' | 'sftp' | 'rdp' | 'web' | 'mysql'>('ssh');
  const [mysqlDatabase, setMysqlDatabase] = useState('');

  // --- CAMPOS COMUNES ---
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [folderId, setFolderId] = useState<string>('');
  
  // --- CAMPOS DE SERVIDOR ---
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [credentialId, setCredentialId] = useState(''); // Vincular a credenciales globales
  const [openMode, setOpenMode] = useState<'tab' | 'window' | 'fullscreen'>('tab');
  
  // --- CAMPOS CREDENCIALES MANUALES (Fallback) ---
  const [useGlobalCreds, setUseGlobalCreds] = useState(true);
  const [manualUsername, setManualUsername] = useState('');
  const [manualCredType, setManualCredType] = useState<'password' | 'key'>('password');
  const [manualPassword, setManualPassword] = useState('');
  const [manualPrivateKey, setManualPrivateKey] = useState('');

  // --- JUMP HOST ---
  const [jumpHostId, setJumpHostId] = useState('');

  // --- RDP ESPECÍFICO ---
  const [rdpResolution, setRdpResolution] = useState('1280x800');
  const [rdpFullscreen, setRdpFullscreen] = useState(false);

  // --- WEB ESPECÍFICO ---
  const [webUrl, setWebUrl] = useState('http://');

  // --- TEMA DE TERMINAL ---
  const [terminalTheme, setTerminalTheme] = useState('cyberpunk');

  // Rellenar datos si estamos editando
  useEffect(() => {
    if (editingConnection) {
      setId(editingConnection.id || '');
      setName(editingConnection.name || '');
      setFolderId(editingConnection.folderId || '');
      
      if (editingConnection.isFolder) {
        setModalType('folder');
      } else {
        setModalType('connection');
        setProtocol(editingConnection.protocol || 'ssh');
        setHost(editingConnection.host || '');
        setPort(editingConnection.port || 22);
        setCredentialId(editingConnection.credentialId || '');
        setOpenMode(editingConnection.openMode || 'tab');
        setJumpHostId(editingConnection.jumpHostId || '');
        setRdpResolution(editingConnection.rdpResolution || '1280x800');
        setRdpFullscreen(editingConnection.rdpFullscreen || false);
        setWebUrl(editingConnection.url || 'http://');
        setTerminalTheme(editingConnection.terminalTheme || 'cyberpunk');
        setMysqlDatabase(editingConnection.database || '');

        // Si tenía credenciales manuales incrustadas
        if (editingConnection.manualCreds) {
          setUseGlobalCreds(false);
          setManualUsername(editingConnection.manualCreds.username || '');
          setManualCredType(editingConnection.manualCreds.type || 'password');
          setManualPassword(editingConnection.manualCreds.password || '');
          setManualPrivateKey(editingConnection.manualCreds.privateKey || '');
        } else {
          setUseGlobalCreds(true);
        }
      }
    } else {
      // Limpiar campos para nueva conexión
      setId('');
      setName('');
      setFolderId('');
      setModalType('connection');
      setProtocol('ssh');
      setHost('');
      setPort(22);
      setCredentialId('');
      setOpenMode('tab');
      setJumpHostId('');
      setRdpResolution('1280x800');
      setRdpFullscreen(false);
      setWebUrl('http://');
      setTerminalTheme('cyberpunk');
      setUseGlobalCreds(true);
      setManualUsername('');
      setManualCredType('password');
      setManualPassword('');
      setManualPrivateKey('');
      setMysqlDatabase('');
    }
  }, [editingConnection, isOpen]);

  // Cambiar puerto por defecto según protocolo
  const handleProtocolChange = (p: 'ssh' | 'sftp' | 'rdp' | 'web' | 'mysql') => {
    setProtocol(p);
    if (p === 'ssh' || p === 'sftp') setPort(22);
    else if (p === 'rdp') setPort(3389);
    else if (p === 'mysql') setPort(3306);
  };

  const handleSave = () => {
    if (!name.trim()) return alert('Por favor, introduce un nombre.');

    if (modalType === 'folder') {
      onSave({
        id: id || Math.random().toString(),
        name,
        parentId: folderId || null,
        isFolder: true
      });
    } else {
      if (protocol !== 'web' && !host.trim()) return alert('Por favor, introduce el Host/IP.');
      
      const connData: any = {
        id: id || Math.random().toString(),
        name,
        folderId: folderId || null,
        protocol,
        openMode,
        isFolder: false,
        terminalTheme: protocol === 'ssh' ? terminalTheme : undefined
      };

      if (protocol === 'web') {
        connData.url = webUrl;
      } else {
        connData.host = host;
        connData.port = port;
        connData.jumpHostId = jumpHostId || null;

        if (protocol === 'rdp') {
          connData.rdpResolution = rdpResolution;
          connData.rdpFullscreen = rdpFullscreen;
        }

        if (protocol === 'mysql') {
          connData.database = mysqlDatabase;
        }

        if (useGlobalCreds) {
          if (!credentialId) return alert('Por favor, selecciona una credencial global.');
          connData.credentialId = credentialId;
          connData.manualCreds = null;
        } else {
          if (!manualUsername.trim()) return alert('Introduce un usuario.');
          connData.credentialId = null;
          connData.manualCreds = {
            username: manualUsername,
            type: manualCredType,
            password: manualPassword,
            privateKey: manualPrivateKey
          };
        }
      }

      onSave(connData);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-xl glass-panel p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-2 mb-4 title-font">
          {editingConnection ? 'Editar Elemento' : 'Crear Nuevo Elemento'}
        </h2>

        {/* Modal Type Selector (Solo si es nuevo) */}
        {!editingConnection && (
          <div className="flex bg-black/30 border border-white/5 p-1 rounded-lg mb-4 select-none">
            <button 
              onClick={() => setModalType('connection')}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 ${modalType === 'connection' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-gray-400 border border-transparent'}`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Nueva Conexión
            </button>
            <button 
              onClick={() => setModalType('folder')}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 ${modalType === 'folder' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-gray-400 border border-transparent'}`}
            >
              <Folder className="w-3.5 h-3.5" />
              Nueva Carpeta
            </button>
          </div>
        )}

        {/* FORMULARIO CARPETA */}
        {modalType === 'folder' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-500 font-semibold uppercase">Nombre de la Carpeta</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="ej. Servidores de Producción"
                className="glass-input text-xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-500 font-semibold uppercase">Carpeta contenedora</label>
              <select 
                value={folderId}
                onChange={e => setFolderId(e.target.value)}
                className="glass-input text-xs"
              >
                <option value="">Ninguna (Raíz)</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* FORMULARIO CONEXIÓN */}
        {modalType === 'connection' && (
          <div className="flex flex-col gap-4">
            
            {/* Protocol Select */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-500 font-semibold uppercase">Protocolo / Tipo</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 select-none">
                <button 
                  onClick={() => handleProtocolChange('ssh')}
                  className={`py-2 rounded-lg border text-xs font-medium transition-all flex flex-col items-center gap-1.5 ${protocol === 'ssh' ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300' : 'bg-black/30 border-white/5 text-gray-400 hover:border-white/15'}`}
                >
                  <Terminal className="w-4 h-4" />
                  SSH Shell
                </button>
                <button 
                  onClick={() => handleProtocolChange('sftp')}
                  className={`py-2 rounded-lg border text-xs font-medium transition-all flex flex-col items-center gap-1.5 ${protocol === 'sftp' ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300' : 'bg-black/30 border-white/5 text-gray-400 hover:border-white/15'}`}
                >
                  <Network className="w-4 h-4" />
                  SFTP Explorer
                </button>
                <button 
                  onClick={() => handleProtocolChange('rdp')}
                  className={`py-2 rounded-lg border text-xs font-medium transition-all flex flex-col items-center gap-1.5 ${protocol === 'rdp' ? 'bg-purple-500/15 border-purple-400 text-purple-300' : 'bg-black/30 border-white/5 text-gray-400 hover:border-white/15'}`}
                >
                  <Monitor className="w-4 h-4" />
                  RDP Nativo
                </button>
                <button 
                  onClick={() => handleProtocolChange('web')}
                  className={`py-2 rounded-lg border text-xs font-medium transition-all flex flex-col items-center gap-1.5 ${protocol === 'web' ? 'bg-amber-500/15 border-amber-400 text-amber-300' : 'bg-black/30 border-white/5 text-gray-400 hover:border-white/15'}`}
                >
                  <Globe className="w-4 h-4" />
                  Web Console
                </button>
                <button 
                  onClick={() => handleProtocolChange('mysql')}
                  className={`py-2 rounded-lg border text-xs font-medium transition-all flex flex-col items-center gap-1.5 ${protocol === 'mysql' ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300' : 'bg-black/30 border-white/5 text-gray-400 hover:border-white/15'}`}
                >
                  <Database className="w-4 h-4" />
                  MySQL Yog
                </button>
              </div>
            </div>

            {/* Fila 1: Nombre y Carpeta */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-500 font-semibold uppercase">Nombre del Perfil</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="ej. Servidor Web Principal"
                  className="glass-input text-xs"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-500 font-semibold uppercase">Organizar en Carpeta</label>
                <select 
                  value={folderId}
                  onChange={e => setFolderId(e.target.value)}
                  className="glass-input text-xs"
                >
                  <option value="">Ninguna (Raíz)</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Fila 2: Host y Puerto (Solo si no es Web) */}
            {protocol !== 'web' ? (
              <div className="flex flex-col gap-3 w-full">
                <div className="grid grid-cols-3 gap-3 w-full">
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-[10px] text-gray-500 font-semibold uppercase">Host o IP de Destino</label>
                    <input 
                      type="text" 
                      value={host}
                      onChange={e => setHost(e.target.value)}
                      placeholder="ej. 192.168.1.50 o aws.domain.com"
                      className="glass-input text-xs"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-500 font-semibold uppercase">Puerto</label>
                    <input 
                      type="number" 
                      value={port}
                      onChange={e => setPort(Number(e.target.value))}
                      className="glass-input text-xs font-mono"
                    />
                  </div>
                </div>

                {protocol === 'mysql' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-cyan-400 font-semibold uppercase">Base de Datos Inicial (Opcional)</label>
                    <input 
                      type="text" 
                      value={mysqlDatabase}
                      onChange={e => setMysqlDatabase(e.target.value)}
                      placeholder="ej. mi_base_datos (vacío para listar todo)"
                      className="glass-input text-xs font-mono text-cyan-300"
                    />
                  </div>
                )}
              </div>
            ) : (
              /* Campo Web URL */
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-500 font-semibold uppercase">URL de la Consola Web</label>
                <input 
                  type="text" 
                  value={webUrl}
                  onChange={e => setWebUrl(e.target.value)}
                  placeholder="https://192.168.1.1:8006/ (Proxmox, Plesk, Router, etc.)"
                  className="glass-input text-xs font-mono text-amber-400"
                />
              </div>
            )}

            {/* Configuración RDP Específica */}
            {protocol === 'rdp' && (
              <div className="p-3 bg-purple-950/10 border border-purple-900/20 rounded-lg grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-purple-400 font-semibold uppercase">Resolución RDP</label>
                  <select 
                    value={rdpResolution}
                    onChange={e => setRdpResolution(e.target.value)}
                    className="glass-input py-1.5 text-xs bg-black/40"
                  >
                    <option value="1280x800">1280 × 800 (Por Defecto)</option>
                    <option value="1024x768">1024 × 768</option>
                    <option value="1440x900">1440 × 900</option>
                    <option value="1920x1080">1920 × 1080 (HD)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 mt-4 select-none">
                  <input 
                    type="checkbox" 
                    id="chkRdpFull"
                    checked={rdpFullscreen}
                    onChange={e => setRdpFullscreen(e.target.checked)}
                    className="accent-purple-500 h-4 w-4 rounded bg-black"
                  />
                  <label htmlFor="chkRdpFull" className="text-xs text-gray-300 font-medium cursor-pointer">
                    Abrir en Pantalla Completa
                  </label>
                </div>
              </div>
            )}

            {/* Configuración SSH Tunnel (Jump Host) (No RDP ni Web por ahora) */}
            {(protocol === 'ssh' || protocol === 'sftp') && (
              <div className="p-3 bg-cyan-950/5 border border-cyan-950/20 rounded-lg flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-cyan-400/80 font-semibold uppercase flex items-center gap-1.5">
                    Conexión por Puente / Túnel SSH
                  </label>
                  <select 
                    value={jumpHostId}
                    onChange={e => setJumpHostId(e.target.value)}
                    className="glass-input py-1.5 text-xs bg-black/40"
                  >
                    <option value="">Conexión Directa (Sin túnel)</option>
                    {connections
                      .filter(c => c.protocol === 'ssh' && c.id !== id) // Excluirse a sí mismo
                      .map(c => (
                        <option key={c.id} value={c.id}>Túnel a través de: {c.name} ({c.host})</option>
                      ))}
                  </select>
                </div>

                {protocol === 'ssh' && (
                  <div className="flex flex-col gap-1.5 border-t border-white/5 pt-2">
                    <label className="text-[10px] text-cyan-400/80 font-semibold uppercase flex items-center gap-1.5">
                      Tema Visual de la Terminal
                    </label>
                    <select 
                      value={terminalTheme}
                      onChange={e => setTerminalTheme(e.target.value)}
                      className="glass-input py-1.5 text-xs bg-black/40 font-mono"
                    >
                      <option value="cyberpunk">Cyberpunk (Cian / Negro)</option>
                      <option value="matrix">Matrix (Verde Clásico)</option>
                      <option value="dracula">Dracula (Vampiro Gótico)</option>
                      <option value="amber">Amber (Ámbar Retro / Fósforo)</option>
                      <option value="snow">Snow Light (Blanco Nieve)</option>
                      <option value="solarizedLight">Solarized Light (Crema Cálido)</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Apertura Mode Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-500 font-semibold uppercase">Modo de Apertura</label>
              <select 
                value={openMode}
                onChange={e => setOpenMode(e.target.value as any)}
                className="glass-input text-xs"
              >
                <option value="tab">Abrir en Pestaña interna (Recomendado)</option>
                <option value="window">Abrir en Ventana flotante independiente</option>
                {protocol === 'rdp' && <option value="fullscreen">Pantalla Completa Nativa</option>}
              </select>
            </div>

            {/* CREDENCIALES (Solo si no es Web) */}
            {protocol !== 'web' && (
              <div className="border-t border-white/5 pt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 font-semibold uppercase">Credenciales de Inicio de Sesión</span>
                  
                  {/* Toggle Global vs Manual */}
                  <div className="flex bg-black/40 p-0.5 rounded border border-white/5 select-none text-[9px] font-semibold">
                    <button 
                      onClick={() => setUseGlobalCreds(true)}
                      className={`px-2 py-0.5 rounded transition-all ${useGlobalCreds ? 'bg-cyan-500/10 text-cyan-400' : 'text-gray-500'}`}
                    >
                      Perfil Global
                    </button>
                    <button 
                      onClick={() => setUseGlobalCreds(false)}
                      className={`px-2 py-0.5 rounded transition-all ${!useGlobalCreds ? 'bg-cyan-500/10 text-cyan-400' : 'text-gray-500'}`}
                    >
                      Incrustar Contraseña
                    </button>
                  </div>
                </div>

                {/* Perfil Global Seleccionable */}
                {useGlobalCreds ? (
                  <div className="flex flex-col gap-1.5">
                    <select 
                      value={credentialId}
                      onChange={e => setCredentialId(e.target.value)}
                      className="glass-input text-xs text-cyan-400"
                    >
                      <option value="">-- Seleccionar Credencial Guardada --</option>
                      {credentials.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.username})</option>
                      ))}
                    </select>
                    {credentials.length === 0 && (
                      <p className="text-[10px] text-amber-400/80 flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        No tienes credenciales globales creadas. Ve a Configuración de la barra lateral para crearlas o usa "Incrustar Contraseña".
                      </p>
                    )}
                  </div>
                ) : (
                  /* Formulario Manual Incrustado */
                  <div className="p-3 bg-black/40 rounded-lg border border-white/5 flex flex-col gap-3">
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-gray-500 font-semibold uppercase">Usuario</label>
                        <input 
                          type="text" 
                          value={manualUsername}
                          onChange={e => setManualUsername(e.target.value)}
                          placeholder="ej. root o administrator"
                          className="glass-input py-1.5 text-xs"
                        />
                      </div>
                      
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-gray-500 font-semibold uppercase">Tipo de Autenticación</label>
                        <select 
                          value={manualCredType}
                          onChange={e => setManualCredType(e.target.value as any)}
                          className="glass-input py-1.5 text-xs"
                        >
                          <option value="password">Contraseña</option>
                          <option value="key">Llave Privada SSH</option>
                        </select>
                      </div>
                    </div>

                    {manualCredType === 'password' ? (
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-gray-500 font-semibold uppercase">Contraseña</label>
                        <input 
                          type="password" 
                          value={manualPassword}
                          onChange={e => setManualPassword(e.target.value)}
                          placeholder="••••••••"
                          className="glass-input py-1.5 text-xs font-mono"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-gray-500 font-semibold uppercase">Contenido de la Llave Privada (PEM)</label>
                        <textarea 
                          rows={3}
                          value={manualPrivateKey}
                          onChange={e => setManualPrivateKey(e.target.value)}
                          placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;..."
                          className="glass-input py-1.5 text-xs font-mono resize-y"
                        />
                      </div>
                    )}

                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* Footer Buttons */}
        <div className="flex justify-end gap-2 border-t border-white/5 pt-4 mt-4">
          <button onClick={onClose} className="glass-btn text-xs py-2 px-4">
            Cancelar
          </button>
          <button onClick={handleSave} className="glass-btn glass-btn-accent text-xs py-2 px-4 bg-cyan-600 hover:bg-cyan-500">
            {editingConnection ? 'Guardar Cambios' : 'Crear Elemento'}
          </button>
        </div>

      </div>
    </div>
  );
}
