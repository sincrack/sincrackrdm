import React, { useState, useEffect } from 'react'
import { Plus, Play, Compass, Key, Code, Activity, History } from 'lucide-react'
import { LOGO_BASE64 } from '../assets/logoBase64'

interface DashboardProps {
  onQuickConnect: (protocol: string, hostStr: string) => void;
  connections: any[];
  activeTabsCount: number;
  credentialsCount: number;
  snippetsCount: number;
  onOpenConnection: (conn: any) => void;
  onNewConnection: () => void;
  quickHistory?: string[];
}

export default function Dashboard({ 
  onQuickConnect, connections, activeTabsCount, credentialsCount, snippetsCount, onOpenConnection, onNewConnection, quickHistory = []
}: DashboardProps) {
  const [quickProtocol, setQuickProtocol] = useState<'ssh' | 'sftp' | 'web'>('ssh');
  const [quickInput, setQuickInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [activeTabRight, setActiveTabRight] = useState<'tips' | 'keys'>('tips');

  useEffect(() => {
    const handleOutsideClick = () => setShowHistory(false);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    onQuickConnect(quickProtocol, quickInput.trim());
  };

  // Obtener conexiones recientes ordenadas por historial de uso real (última conexión abierta)
  // Si no se han conectado nunca, cae de vuelta al orden inverso de creación
  const recentConnections = [...(connections || [])]
    .filter(c => !c.isFolder)
    .sort((a, b) => {
      const timeA = a.lastConnected || 0;
      const timeB = b.lastConnected || 0;
      if (timeA !== timeB) {
        return timeB - timeA; // Descendente por fecha de uso
      }
      return connections.indexOf(b) - connections.indexOf(a); // Más recientes añadidas primero
    })
    .slice(0, 4);



  const getProtocolBadgeClass = (proto: string) => {
    switch (proto) {
      case 'ssh': return 'badge-ssh';
      case 'sftp': return 'badge-sftp';
      case 'rdp': return 'badge-rdp';
      case 'web': return 'badge-web';
      case 'mysql': return 'badge-mysql';
      default: return 'badge-ssh';
    }
  };

  return (
    <div className="w-full h-full flex flex-col gap-6 p-6 overflow-y-auto select-none relative">
      
      {/* Decorative Glowing Orb in Background */}
      <div className="absolute top-[-20%] left-[30%] w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-80 h-80 bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Greetings Block */}
      <div className="flex flex-col gap-1.5 z-10">
        <h1 className="text-3xl font-extrabold title-font tracking-tight text-white flex items-center gap-3">
          <img src={LOGO_BASE64} alt="SinCracK Logo" className="h-12 w-auto object-contain select-none pointer-events-none" />
          <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent self-center">RDM</span>
        </h1>
        <p className="text-xs text-gray-400 max-w-lg">
          Gestor unificado de conexiones remotas y administración de sistemas.
        </p>
      </div>

      {/* METRIC CARD STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 z-10">
        <div className="glass-panel p-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 font-semibold uppercase">CONEXIONES</span>
            <span className="text-2xl font-bold title-font text-white">{connections.filter(c => !c.isFolder).length}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Compass className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 font-semibold uppercase">SESIONES ACTIVAS</span>
            <span className="text-2xl font-bold title-font text-white">{activeTabsCount}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 font-semibold uppercase">CREDENCIALES</span>
            <span className="text-2xl font-bold title-font text-white">{credentialsCount}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Key className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 font-semibold uppercase">SCRIPTS/SNIPPETS</span>
            <span className="text-2xl font-bold title-font text-white">{snippetsCount}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Code className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* QUICK CONNECT BAR */}
      <div className="glass-panel p-4 z-10 border-cyan-500/10 bg-cyan-950/[0.02]">
        <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400/90 mb-3 flex items-center gap-2 select-none">
          <Play className="w-3.5 h-3.5 text-cyan-400" />
          Conexión Rápida
        </h3>
        
        <form onSubmit={handleQuickSubmit} className="flex flex-wrap items-center gap-3">
          {/* Protocol selector */}
          <div className="flex bg-black/40 border border-white/5 p-1 rounded-lg">
            <button 
              type="button"
              onClick={() => setQuickProtocol('ssh')}
              className={`px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wider transition-all ${quickProtocol === 'ssh' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-gray-500'}`}
            >
              SSH
            </button>
            <button 
              type="button"
              onClick={() => setQuickProtocol('sftp')}
              className={`px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wider transition-all ${quickProtocol === 'sftp' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-gray-500'}`}
            >
              SFTP
            </button>
            <button 
              type="button"
              onClick={() => setQuickProtocol('web')}
              className={`px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wider transition-all ${quickProtocol === 'web' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-gray-500'}`}
            >
              Web
            </button>
          </div>

          {/* Connection Input string */}
          <div className="flex-1 min-w-[240px] relative">
            <input 
              type="text" 
              placeholder={quickProtocol === 'web' ? 'https://ejemplo.com' : 'usuario@192.168.1.1:22'}
              value={quickInput}
              onChange={e => setQuickInput(e.target.value)}
              className="w-full glass-input text-xs py-2 pr-9 font-mono"
            />
            {quickHistory.length > 0 && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowHistory(!showHistory);
                  }}
                  className="p-1 rounded text-gray-500 hover:text-cyan-400 hover:bg-white/5 transition-colors cursor-pointer"
                  title="Historial de conexiones rápidas"
                >
                  <History className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Historial Dropdown */}
            {showHistory && quickHistory.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#0c0c10]/95 border border-white/5 shadow-2xl rounded-lg p-1.5 flex flex-col gap-0.5 backdrop-blur-md z-[100] max-h-48 overflow-y-auto animate-scale-in">
                <div className="text-[9px] text-gray-500 font-bold px-2 py-1 select-none uppercase tracking-wider">
                  Historial Rápido
                </div>
                {quickHistory.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setQuickInput(item);
                      setShowHistory(false);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 text-gray-300 hover:text-white font-mono text-[10px] truncate"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button 
            type="submit" 
            className="glass-btn glass-btn-accent py-2 text-xs font-semibold px-5"
          >
            Conectar
          </button>
        </form>
      </div>

      {/* DASHBOARD BOTTOM SECTION: RECENT CONNECTIONS & LAUNCH PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 z-10 flex-1">
        
        {/* Recent Connections table (2/3 width on wide screens) */}
        <div className="lg:col-span-2 glass-panel p-4 flex flex-col min-h-[220px]">
          <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Conexiones Recientes</h3>
            <span className="text-[10px] text-gray-500 font-mono">Historial de uso</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {recentConnections.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 py-10">
                <p className="text-xs font-mono">No hay conexiones guardadas todavía</p>
                <button 
                  onClick={onNewConnection}
                  className="glass-btn text-[10px] py-1 px-3 mt-2 flex items-center border-dashed"
                >
                  <Plus className="w-3 h-3" /> Crear Conexión
                </button>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-gray-500 select-none font-semibold border-b border-white/5 pb-1 text-[10px]">
                    <th className="py-2">Nombre</th>
                    <th className="py-2">Tipo</th>
                    <th className="py-2">Servidor</th>
                    <th className="py-2 text-right">Lanzar</th>
                  </tr>
                </thead>
                <tbody>
                  {recentConnections.map(conn => (
                    <tr 
                      key={conn.id}
                      className="border-b border-white/[0.02] hover:bg-white/[0.02] cursor-pointer transition-colors"
                      onDoubleClick={() => onOpenConnection(conn)}
                    >
                      <td className="py-2.5 font-medium text-white">{conn.name}</td>
                      <td className="py-2.5">
                        <span className={`text-[9px] uppercase font-mono font-semibold px-2 py-0.5 rounded ${getProtocolBadgeClass(conn.protocol)}`}>
                          {conn.protocol}
                        </span>
                      </td>
                      <td className="py-2.5 font-mono text-gray-400">{conn.protocol === 'web' ? conn.url : `${conn.host}:${conn.port}`}</td>
                      <td className="py-2.5 text-right">
                        <button 
                          onClick={() => onOpenConnection(conn)}
                          className="p-1.5 rounded hover:bg-cyan-500/10 text-cyan-400 transition-colors"
                          title="Lanzar Sesión"
                        >
                          <Play className="w-3.5 h-3.5 fill-cyan-400/10" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Shortcuts / Quick Utilities panel (1/3 width) */}
        <div className="glass-panel p-4 flex flex-col min-h-[220px]">
          {/* Tabs selector */}
          <div className="flex border-b border-white/5 pb-2 mb-3 items-center justify-between select-none">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTabRight('tips')}
                className={`text-xs font-bold uppercase tracking-wider transition-colors ${activeTabRight === 'tips' ? 'text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}
              >
                💡 Consejos
              </button>
              <span className="text-gray-700 text-xs">|</span>
              <button
                onClick={() => setActiveTabRight('keys')}
                className={`text-xs font-bold uppercase tracking-wider transition-colors ${activeTabRight === 'keys' ? 'text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}
              >
                ⌨️ Atajos
              </button>
            </div>
            <span className="text-[9px] text-cyan-500 font-mono px-1 rounded bg-cyan-500/10 border border-cyan-500/20 font-bold uppercase select-none animate-pulse">Ayuda</span>
          </div>

          {activeTabRight === 'tips' ? (
            <div className="flex-1 flex flex-col gap-3 text-xs leading-relaxed text-gray-400 font-normal animate-scale-in overflow-y-auto scrollbar-thin pr-1">
              <p>
                <strong>💡 Drag & Drop en SFTP</strong>: Arrastra archivos directamente desde Windows y suéltalos en la cuadrícula de SFTP para subirlos en segundo plano.
              </p>
              <p>
                <strong>📝 Edición Local (WinSCP-style)</strong>: Haz doble click en archivos remotos para editarlos en tu bloc de notas local. Al guardar (`Ctrl+S`), se subirán automáticamente.
              </p>
              <p>
                <strong>⚡ Multidifusión SSH</strong>: Activa el botón de *Multidifusión* para enviar comandos a todas las terminales SSH abiertas de forma simultánea.
              </p>
              <p>
                <strong>🖥️ SSH Dividido</strong>: Divide tu terminal SSH horizontal o verticalmente desde el botón de la barra superior derecha para trabajar en paralelo en el mismo host.
              </p>
              <p>
                <strong>🐳 Panel Docker Integrado</strong>: En una terminal SSH activa, activa la vista *Docker* en la barra superior para gestionar contenedores, ver logs o abrir consolas interactivas.
              </p>
              <p>
                <strong>📜 Scripts y Snippets</strong>: Guarda comandos frecuentes en la sección de scripts. Haz doble click sobre uno para inyectarlo y ejecutarlo al instante en la terminal SSH activa.
              </p>
              <p>
                <strong>🔍 Buscador Spotlight</strong>: Usa el atajo `Ctrl+P` desde cualquier parte de la app para buscar y lanzar rápidamente servidores, carpetas o herramientas del sistema.
              </p>
              <p>
                <strong>🛡️ Contraseña Maestra</strong>: Cifra tu base de datos local con AES-256 desde *Ajustes* para proteger de forma segura tus credenciales contra accesos no autorizados.
              </p>
              <p>
                <strong>⛓️ Jump Hosts (Bastión)</strong>: Enruta tus conexiones SSH/SFTP a través de un servidor intermedio o bastión de forma transparente configurando un Jump Host.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between text-xs leading-relaxed text-gray-400 font-normal animate-scale-in">
              <div className="flex flex-col gap-2.5 pr-1 flex-1 overflow-y-auto scrollbar-thin">
                <div className="flex items-center justify-between border-b border-white/[0.02] pb-1.5">
                  <span className="text-gray-300 font-medium">Buscador Spotlight</span>
                  <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 font-mono text-[10px] text-cyan-400 font-bold shadow-sm select-none">Ctrl + P</kbd>
                </div>
                <div className="flex items-center justify-between border-b border-white/[0.02] pb-1.5">
                  <span className="text-gray-300 font-medium">Alternar Lateral (Sidebar)</span>
                  <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 font-mono text-[10px] text-emerald-400 font-bold shadow-sm select-none">Ctrl + B</kbd>
                </div>
                <div className="flex items-center justify-between border-b border-white/[0.02] pb-1.5">
                  <span className="text-gray-300 font-medium">Nueva Conexión</span>
                  <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 font-mono text-[10px] text-cyan-400 font-bold shadow-sm select-none">Alt + N</kbd>
                </div>
                <div className="flex items-center justify-between border-b border-white/[0.02] pb-1.5">
                  <span className="text-gray-300 font-medium">Volver al Dashboard (Home)</span>
                  <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 font-mono text-[10px] text-cyan-400 font-bold shadow-sm select-none">Alt + H</kbd>
                </div>
                <div className="flex items-center justify-between border-b border-white/[0.02] pb-1.5">
                  <span className="text-gray-300 font-medium">Herramientas de Red</span>
                  <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 font-mono text-[10px] text-amber-400 font-bold shadow-sm select-none">Alt + T</kbd>
                </div>
                <div className="flex items-center justify-between border-b border-white/[0.02] pb-1.5">
                  <span className="text-gray-300 font-medium">Siguiente Pestaña</span>
                  <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 font-mono text-[10px] text-amber-400 font-bold shadow-sm select-none">Alt + ➔</kbd>
                </div>
                <div className="flex items-center justify-between border-b border-white/[0.02] pb-1.5">
                  <span className="text-gray-300 font-medium">Pestaña Anterior</span>
                  <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 font-mono text-[10px] text-amber-400 font-bold shadow-sm select-none">Alt + ⬅</kbd>
                </div>
                <div className="flex items-center justify-between border-b border-white/[0.02] pb-1.5">
                  <span className="text-gray-300 font-medium">Cerrar Pestaña Activa</span>
                  <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 font-mono text-[10px] text-rose-400 font-bold shadow-sm select-none">Alt + W</kbd>
                </div>
                <div className="flex items-center justify-between border-b border-white/[0.02] pb-1.5">
                  <span className="text-gray-300 font-medium">Cerrar Todas las Pestañas</span>
                  <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 font-mono text-[10px] text-rose-500 font-bold shadow-sm select-none">Alt + Shift + W</kbd>
                </div>
              </div>

              <div className="text-[9px] text-gray-500 font-mono text-center mt-2 uppercase tracking-wider select-none">
                Navega velozmente por la app con teclado
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
