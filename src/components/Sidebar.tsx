import React, { useState, useEffect } from 'react'
import { 
  Folder, FolderOpen, Terminal, Network, Monitor, Globe, Plus, 
  FolderPlus, Search, Edit3, Trash2, Copy, Key, Settings, 
  Code, Compass, ShieldAlert, ShieldCheck, Save, X, Database, Download, Upload,
  Cpu, FileKey, Activity, Power, FileText, ChevronsDownUp, ChevronsUpDown
} from 'lucide-react'

interface SidebarProps {
  folders: any[];
  connections: any[];
  credentials: any[];
  snippets: any[];
  editorPath: string;
  hasMasterPassword: boolean;
  onSaveEditorPath: (path: string) => void;
  onSaveMasterPassword: (oldPass?: string, newPass?: string) => Promise<any>;
  onAddFolder: (folder: any) => void;
  onEditConnection: (conn: any) => void;
  onDeleteConnection: (id: string) => void;
  onDeleteFolder: (id: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDuplicateConnection: (conn: any) => void;
  onOpenConnection: (conn: any) => void;
  onAddCredential: (cred: any) => void;
  onDeleteCredential: (id: string) => void;
  onAddSnippet: (snip: any) => void;
  onDeleteSnippet: (id: string) => void;
  onExecuteSnippet: (command: string) => void;
  onOpenTools: () => void;
  onOpenDashboard: () => void;
  onTriggerModal: (editing?: any) => void;
  onMoveConnection: (connId: string, folderId: string | null) => void;
  onMoveFolder: (folderId: string, parentId: string | null) => void;
  onImportData: (folders: any[], connections: any[], credentials?: any[]) => void;
  onResetDatabase: () => void;
  appTheme: 'dark' | 'light';
  terminalFontSize: number;
  onSaveTheme: (theme: 'dark' | 'light') => void;
  onSaveTerminalFontSize: (size: number) => void;
  activeSubTool: 'network' | 'password' | 'sshkey' | 'sysinfo' | 'certificate' | 'sslcheck' | 'wol';
  onChangeSubTool: (tool: 'network' | 'password' | 'sshkey' | 'sysinfo' | 'certificate' | 'sslcheck' | 'wol') => void;
  width?: number;
}

export default function Sidebar({
  folders, connections, credentials, snippets, editorPath, hasMasterPassword,
  onSaveEditorPath, onSaveMasterPassword, onAddFolder, onEditConnection,
  onDeleteConnection, onDeleteFolder, onRenameFolder, onDuplicateConnection, onOpenConnection,
  onAddCredential, onDeleteCredential, onAddSnippet, onDeleteSnippet, onExecuteSnippet,
  onOpenTools, onOpenDashboard, onTriggerModal, onMoveConnection, onMoveFolder, onImportData,
  onResetDatabase,
  appTheme, terminalFontSize, onSaveTheme, onSaveTerminalFontSize,
  activeSubTool, onChangeSubTool,
  width
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'connections' | 'snippets' | 'tools' | 'settings'>('connections');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Carpetas colapsadas
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('collapsedFolders');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });

  // --- CREACIÓN DE CARPETAS EN LÍNEA ---
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [newFolderNameInput, setNewFolderNameInput] = useState('');
  const [parentFolderIdForNewFolder, setParentFolderIdForNewFolder] = useState<string | null>(null);

  // --- CAMBIO DE NOMBRE EN LÍNEA ---
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemType, setEditingItemType] = useState<'folder' | 'connection' | null>(null);
  const [editingItemValue, setEditingItemValue] = useState('');

  const handleSaveRename = () => {
    if (!editingItemValue.trim() || !editingItemId) {
      setEditingItemId(null);
      setEditingItemType(null);
      return;
    }
    if (editingItemType === 'folder') {
      onRenameFolder(editingItemId, editingItemValue.trim());
    } else if (editingItemType === 'connection') {
      const conn = connections.find(c => c.id === editingItemId);
      if (conn) {
        onEditConnection({
          ...conn,
          name: editingItemValue.trim()
        });
      }
    }
    setEditingItemId(null);
    setEditingItemType(null);
  };

  // --- SELECCIÓN Y MENÚ DE CONTEXTO ---
  const [selectedConnId, setSelectedConnId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    conn: any;
  } | null>(null);

  const [notesConn, setNotesConn] = useState<any | null>(null);
  const [notesText, setNotesText] = useState('');

  const [folderContextMenu, setFolderContextMenu] = useState<{
    x: number;
    y: number;
    folder: any;
  } | null>(null);

  const handleCreateFolder = () => {
    if (!newFolderNameInput.trim()) return;
    onAddFolder({ 
      id: Math.random().toString(), 
      name: newFolderNameInput.trim(), 
      parentId: parentFolderIdForNewFolder, 
      isFolder: true 
    });
    setNewFolderNameInput('');
    setShowFolderInput(false);
    setParentFolderIdForNewFolder(null);
  };

  const handleContextMenu = (e: React.MouseEvent, conn: any) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      conn
    });
  };

  const handleFolderContextMenu = (e: React.MouseEvent, folder: any) => {
    e.preventDefault();
    e.stopPropagation();
    setFolderContextMenu({
      x: e.clientX,
      y: e.clientY,
      folder
    });
  };

  const handleDropItem = (e: React.DragEvent, targetFolderId: string | null) => {
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      
      if (data.type === 'connection') {
        const connId = data.id;
        onMoveConnection(connId, targetFolderId);
      } else if (data.type === 'folder') {
        const folderId = data.id;
        if (folderId === targetFolderId) return;
        
        // Evitar ciclos de recursión infinitos
        if (targetFolderId !== null) {
          let curr: any = folders.find(f => f.id === targetFolderId);
          while (curr) {
            if (curr.id === folderId) {
              alert('⚠️ No puedes mover una carpeta dentro de sí misma.');
              return;
            }
            if (curr.parentId === folderId) {
              alert('⚠️ No puedes mover una carpeta dentro de sus propios subdirectorios.');
              return;
            }
            curr = folders.find(f => f.id === curr.parentId);
          }
        }
        
        onMoveFolder(folderId, targetFolderId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const closeMenus = () => {
      setContextMenu(null);
      setFolderContextMenu(null);
    };
    window.addEventListener('click', closeMenus);
    return () => window.removeEventListener('click', closeMenus);
  }, []);

  // --- ESTADOS LOCALES DE AGREGADOS (Sidebar Settings / Snippets) ---
  const [newCredName, setNewCredName] = useState('');
  const [newCredUser, setNewCredUser] = useState('');
  const [newCredType, setNewCredType] = useState<'password' | 'key'>('password');
  const [newCredPass, setNewCredPass] = useState('');
  const [newCredKey, setNewCredKey] = useState('');
  
  const [newSnipName, setNewSnipName] = useState('');
  const [newSnipCmd, setNewSnipCmd] = useState('');
  const [editingSnippetId, setEditingSnippetId] = useState<string | null>(null);

  // --- CONTRASEÑA MAESTRA ---
  const [showPassModal, setShowPassModal] = useState(false);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passError, setPassError] = useState('');

  // --- EDITOR LOCAL ---
  const [tempEditorPath, setTempEditorPath] = useState(editorPath);

  const toggleFolder = (folderId: string) => {
    setCollapsedFolders(prev => {
      const isCurrentlyCollapsed = prev[folderId] !== false;
      const next = { ...prev, [folderId]: !isCurrentlyCollapsed };
      localStorage.setItem('collapsedFolders', JSON.stringify(next));
      return next;
    });
  };

  const handleCollapseAll = () => {
    const next: Record<string, boolean> = {};
    folders.forEach(f => {
      next[f.id] = true;
    });
    setCollapsedFolders(next);
    localStorage.setItem('collapsedFolders', JSON.stringify(next));
  };

  const handleExpandAll = () => {
    const next: Record<string, boolean> = {};
    folders.forEach(f => {
      next[f.id] = false;
    });
    setCollapsedFolders(next);
    localStorage.setItem('collapsedFolders', JSON.stringify(next));
  };

  const handleAddCredential = () => {
    if (!newCredName.trim() || !newCredUser.trim()) return alert('Introduce un nombre y usuario');
    onAddCredential({
      id: Math.random().toString(),
      name: newCredName,
      username: newCredUser,
      type: newCredType,
      password: newCredPass,
      privateKey: newCredKey
    });
    setNewCredName('');
    setNewCredUser('');
    setNewCredPass('');
    setNewCredKey('');
  };

  const handleAddSnippet = () => {
    if (!newSnipName.trim() || !newSnipCmd.trim()) return alert('Introduce un nombre y comando');
    onAddSnippet({
      id: editingSnippetId || Math.random().toString(),
      name: newSnipName.trim(),
      command: newSnipCmd.trim()
    });
    setNewSnipName('');
    setNewSnipCmd('');
    setEditingSnippetId(null);
  };

  const handleSavePassword = async () => {
    setPassError('');
    const res = await onSaveMasterPassword(oldPass, newPass);
    if (res.success) {
      setOldPass('');
      setNewPass('');
      setShowPassModal(false);
      alert('Contraseña Maestra guardada con éxito.');
    } else {
      setPassError(res.error || 'Error al cambiar la contraseña maestra');
    }
  };

  const getProtoIcon = (proto: string) => {
    switch (proto) {
      case 'ssh': return <Terminal className="w-3.5 h-3.5 text-cyan-400" />;
      case 'sftp': return <Network className="w-3.5 h-3.5 text-emerald-400" />;
      case 'rdp': return <Monitor className="w-3.5 h-3.5 text-purple-400" />;
      case 'web': return <Globe className="w-3.5 h-3.5 text-amber-400" />;
      case 'mysql': return <Database className="w-3.5 h-3.5 text-cyan-400" />;
      default: return <Terminal className="w-3.5 h-3.5" />;
    }
  };

  // Filtrar conexiones por búsqueda
  const filteredConnections = connections.filter(c => (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()));

  // Renderizar conexiones y subcarpetas recursivamente o por capas
  const renderConnectionsTree = (parentId: string | null) => {
    const activeFolders = folders.filter(f => f.parentId === parentId).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const activeConns = filteredConnections.filter(c => c.folderId === parentId).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (activeFolders.length === 0 && activeConns.length === 0) return null;

    return (
      <div className="flex flex-col gap-1 pl-2 border-l border-white/5 ml-1 mt-1">
        
        {/* Render Carpetas */}
        {activeFolders.map(folder => {
          const isCollapsed = collapsedFolders[folder.id] !== false;
          return (
            <div 
              key={folder.id} 
              className="flex flex-col"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDropItem(e, folder.id); }}
            >
              <div 
                onClick={() => toggleFolder(folder.id)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingItemId(folder.id);
                  setEditingItemType('folder');
                  setEditingItemValue(folder.name);
                }}
                onContextMenu={(e) => handleFolderContextMenu(e, folder)}
                draggable="true"
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'folder', id: folder.id }));
                }}
                className="flex items-center justify-between p-1.5 rounded hover:bg-white/5 cursor-pointer text-xs font-semibold text-gray-300 transition-colors group"
              >
                <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-2">
                  {isCollapsed ? (
                    <Folder className="w-4 h-4 text-cyan-500 fill-cyan-500/10" />
                  ) : (
                    <FolderOpen className="w-4 h-4 text-cyan-400 fill-cyan-400/10" />
                  )}
                  {editingItemId === folder.id ? (
                    <input
                      type="text"
                      value={editingItemValue}
                      onChange={(e) => setEditingItemValue(e.target.value)}
                      onBlur={handleSaveRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename();
                        if (e.key === 'Escape') {
                          setEditingItemId(null);
                          setEditingItemType(null);
                        }
                      }}
                      autoFocus
                      className="bg-black/60 border border-cyan-400/50 rounded px-1 text-[11px] text-white focus:outline-none font-medium h-5 w-full"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="truncate">{folder.name}</span>
                  )}
                </div>
                
                {/* Acciones de Carpeta */}
                <button 
                  onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}
                  className="hidden group-hover:inline-block p-1 rounded hover:bg-white/10 text-rose-400"
                  title="Eliminar Carpeta"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {/* Subhijos */}
              {!isCollapsed && renderConnectionsTree(folder.id)}
            </div>
          );
        })}

        {/* Render Conexiones */}
        {activeConns.map(conn => {
          const isSelected = selectedConnId === conn.id;
          return (
            <div 
              key={conn.id} 
              draggable="true"
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'connection', id: conn.id }));
              }}
              className={`flex items-center justify-between p-1.5 rounded cursor-pointer text-xs group transition-colors border-l-2 ${isSelected ? 'bg-cyan-500/10 border-cyan-400 pl-1 text-white font-semibold' : 'hover:bg-white/5 border-transparent'}`}
              onClick={(e) => { e.stopPropagation(); setSelectedConnId(conn.id); }}
              onDoubleClick={(e) => { e.stopPropagation(); onOpenConnection(conn); }}
              onContextMenu={(e) => handleContextMenu(e, conn)}
            >
              <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-2">
                {getProtoIcon(conn.protocol)}
                {editingItemId === conn.id ? (
                  <input
                    type="text"
                    value={editingItemValue}
                    onChange={(e) => setEditingItemValue(e.target.value)}
                    onBlur={handleSaveRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename();
                      if (e.key === 'Escape') {
                        setEditingItemId(null);
                        setEditingItemType(null);
                      }
                    }}
                    autoFocus
                    className="bg-black/60 border border-cyan-400/50 rounded px-1 text-[11px] text-white focus:outline-none font-medium h-5 w-full font-sans"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className={`truncate transition-colors ${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>{conn.name}</span>
                )}
              </div>
              
              {/* Acciones de Conexión */}
              <div className="hidden group-hover:flex items-center gap-0.5">
                <button 
                  onClick={(e) => { e.stopPropagation(); onTriggerModal(conn); }}
                  className="p-1 rounded hover:bg-white/10 text-cyan-400"
                  title="Editar Conexión"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDuplicateConnection(conn); }}
                  className="p-1 rounded hover:bg-white/10 text-emerald-400"
                  title="Duplicar Conexión"
                >
                  <Copy className="w-3 h-3" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDeleteConnection(conn.id); }}
                  className="p-1 rounded hover:bg-white/10 text-rose-400"
                  title="Eliminar Conexión"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div 
      className="h-full flex bg-[var(--bg-secondary)] border-r border-[var(--panel-border)] overflow-hidden shrink-0"
      style={{ width: width || 320 }}
    >
      
      {/* 1. Bar Selector Vertical */}
      <div className="w-16 border-r border-[var(--panel-border)] bg-[var(--sidebar-bar)] flex flex-col items-center py-4 gap-4 justify-between">
        
        {/* Superior Icons */}
        <div className="flex flex-col gap-4 items-center">
          {/* Logo Icon */}
          <div 
            onClick={onOpenDashboard}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center cursor-pointer shadow-lg shadow-cyan-500/10 hover:scale-105 active:scale-95 transition-all"
            title="Dashboard Principal"
          >
            <Terminal className="w-5 h-5 text-white" />
          </div>

          <div className="w-8 h-[1px] bg-white/5 my-2" />

          {/* Connections Tab */}
          <button 
            onClick={() => setActiveTab('connections')}
            className={`p-2.5 rounded-lg transition-all ${activeTab === 'connections' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-gray-500 hover:text-gray-300'}`}
            title="Conexiones Guardadas"
          >
            <Compass className="w-5 h-5" />
          </button>

          {/* Snippets Tab */}
          <button 
            onClick={() => setActiveTab('snippets')}
            className={`p-2.5 rounded-lg transition-all ${activeTab === 'snippets' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-gray-500 hover:text-gray-300'}`}
            title="Scripts Rápidos"
          >
            <Code className="w-5 h-5" />
          </button>

          {/* Network tools Tab */}
          <button 
            onClick={() => { setActiveTab('tools'); onOpenTools(); }}
            className={`p-2.5 rounded-lg transition-all ${activeTab === 'tools' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-gray-500 hover:text-gray-300'}`}
            title="Herramientas de Red"
          >
            <Network className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Icon */}
        <button 
          onClick={() => setActiveTab('settings')}
          className={`p-2.5 rounded-lg transition-all ${activeTab === 'settings' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-gray-500 hover:text-gray-300'}`}
          title="Configuraciones"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Subpanel Detail Content */}
      <div className="flex-1 h-full min-h-0 flex flex-col p-3 min-w-0">
        
        {/* ========================================== */}
        {/* TAB 1: CONNECTIONS */}
        {/* ========================================== */}
        {activeTab === 'connections' && (
          <div className="flex-1 h-full min-h-0 flex flex-col gap-3 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white select-none">Conexiones</h3>
              <div className="flex items-center gap-1">
                <button 
                  onClick={handleExpandAll}
                  className="p-1 rounded hover:bg-white/5 text-gray-400 hover:text-cyan-400 transition-colors"
                  title="Desplegar todo"
                >
                  <ChevronsUpDown className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={handleCollapseAll}
                  className="p-1 rounded hover:bg-white/5 text-gray-400 hover:text-cyan-400 transition-colors"
                  title="Colapsar todo"
                >
                  <ChevronsDownUp className="w-3.5 h-3.5" />
                </button>
                <div className="w-[1px] h-3 bg-white/10 mx-0.5" />
                <button 
                  onClick={() => onTriggerModal()}
                  className="p-1 rounded hover:bg-white/5 text-cyan-400 transition-colors"
                  title="Nueva Conexión"
                >
                  <Plus className="w-4 h-4" />
                </button>
                 <button 
                  onClick={() => setShowFolderInput(!showFolderInput)}
                  className={`p-1 rounded hover:bg-white/5 transition-colors ${showFolderInput ? 'text-cyan-400 bg-cyan-500/10' : 'text-emerald-400'}`}
                  title="Nueva Carpeta"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Búsqueda */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-500" />
              <input 
                type="text"
                placeholder="Buscar conexiones..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-cyan-500/50 transition-colors"
              />
            </div>

            {/* Creación de Carpeta en Línea */}
            {showFolderInput && (
              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-cyan-950/20 border border-cyan-500/20 animate-slide-in">
                <input 
                  type="text"
                  placeholder={parentFolderIdForNewFolder ? `Subcarpeta en: ${folders.find(f => f.id === parentFolderIdForNewFolder)?.name}...` : "Nombre de la carpeta..."}
                  value={newFolderNameInput}
                  onChange={e => setNewFolderNameInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateFolder();
                    if (e.key === 'Escape') {
                      setShowFolderInput(false);
                      setNewFolderNameInput('');
                      setParentFolderIdForNewFolder(null);
                    }
                  }}
                  className="flex-1 bg-black/50 border border-white/5 rounded-md px-2 py-1 text-xs text-white placeholder-gray-600 outline-none focus:border-cyan-500/50"
                  autoFocus
                />
                <button 
                  onClick={handleCreateFolder}
                  className="px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold uppercase transition-colors"
                >
                  Crear
                </button>
                <button 
                  onClick={() => {
                    setShowFolderInput(false);
                    setNewFolderNameInput('');
                    setParentFolderIdForNewFolder(null);
                  }}
                  className="p-1 rounded hover:bg-white/10 text-gray-400 text-xs transition-colors"
                  title="Cancelar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Árbol Recursivo de Conexiones */}
            <div 
              className="flex-1 h-0 overflow-y-auto min-w-0 pr-1 flex flex-col gap-1"
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); handleDropItem(e, null); }}
            >
              {/* Conexiones Raíz */}
              {folders.filter(f => f.parentId === null).sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(folder => {
                const isCollapsed = collapsedFolders[folder.id] !== false;
                return (
                  <div 
                    key={folder.id} 
                    className="flex flex-col"
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDropItem(e, folder.id); }}
                  >
                    <div 
                      onClick={() => toggleFolder(folder.id)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingItemId(folder.id);
                        setEditingItemType('folder');
                        setEditingItemValue(folder.name);
                      }}
                      onContextMenu={(e) => handleFolderContextMenu(e, folder)}
                      draggable="true"
                      onDragStart={(e) => {
                        e.stopPropagation();
                        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'folder', id: folder.id }));
                      }}
                      className="flex items-center justify-between p-1.5 rounded hover:bg-white/5 cursor-pointer text-xs font-bold text-gray-200 transition-colors group"
                    >
                      <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-2">
                        {isCollapsed ? (
                          <Folder className="w-4 h-4 text-cyan-500 fill-cyan-500/10" />
                        ) : (
                          <FolderOpen className="w-4 h-4 text-cyan-400 fill-cyan-400/10" />
                        )}
                        {editingItemId === folder.id ? (
                          <input
                            type="text"
                            value={editingItemValue}
                            onChange={(e) => setEditingItemValue(e.target.value)}
                            onBlur={handleSaveRename}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename();
                              if (e.key === 'Escape') {
                                setEditingItemId(null);
                                setEditingItemType(null);
                              }
                            }}
                            autoFocus
                            className="bg-black/60 border border-cyan-400/50 rounded px-1 text-[11px] text-white focus:outline-none font-medium h-5 w-full"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className="truncate">{folder.name}</span>
                        )}
                      </div>
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}
                        className="hidden group-hover:inline-block p-1 rounded hover:bg-white/10 text-rose-400"
                        title="Eliminar Carpeta"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
 
                    {/* Subhijos de la carpeta raíz */}
                    {!isCollapsed && renderConnectionsTree(folder.id)}
                  </div>
                );
              })}
 
              {/* Conexiones sueltas en la raíz */}
              {filteredConnections.filter(c => c.folderId === null).sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(conn => {
                const isSelected = selectedConnId === conn.id;
                return (
                  <div 
                    key={conn.id} 
                    draggable="true"
                    onDragStart={(e) => {
                      e.stopPropagation();
                      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'connection', id: conn.id }));
                    }}
                    className={`flex items-center justify-between p-1.5 rounded cursor-pointer text-xs group transition-colors border-l-2 ${isSelected ? 'bg-cyan-500/10 border-cyan-400 pl-1 text-white font-semibold' : 'hover:bg-white/5 border-transparent'}`}
                    onClick={(e) => { e.stopPropagation(); setSelectedConnId(conn.id); }}
                    onDoubleClick={(e) => { e.stopPropagation(); onOpenConnection(conn); }}
                    onContextMenu={(e) => handleContextMenu(e, conn)}
                  >
                    <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-2">
                      {getProtoIcon(conn.protocol)}
                      {editingItemId === conn.id ? (
                        <input
                          type="text"
                          value={editingItemValue}
                          onChange={(e) => setEditingItemValue(e.target.value)}
                          onBlur={handleSaveRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename();
                            if (e.key === 'Escape') {
                              setEditingItemId(null);
                              setEditingItemType(null);
                            }
                          }}
                          autoFocus
                          className="bg-black/60 border border-cyan-400/50 rounded px-1 text-[11px] text-white focus:outline-none font-medium h-5 w-full font-sans"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className={`truncate transition-colors font-medium ${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>{conn.name}</span>
                      )}
                    </div>
                    
                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onTriggerModal(conn); }}
                        className="p-1 rounded hover:bg-white/10 text-cyan-400"
                        title="Editar"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDuplicateConnection(conn); }}
                        className="p-1 rounded hover:bg-white/10 text-emerald-400"
                        title="Duplicar"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteConnection(conn.id); }}
                        className="p-1 rounded hover:bg-white/10 text-rose-400"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {connections.length === 0 && folders.length === 0 && (
                <div className="w-full text-center py-8 text-[11px] text-gray-500 font-mono italic">
                  Haz click en + para añadir tus servidores
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 2: SCRIPTS / SNIPPETS */}
        {/* ========================================== */}
        {activeTab === 'snippets' && (
          <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-y-auto">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white select-none">Scripts Rápidos</h3>
            
            {/* Agregar/Editar Snippet */}
            <div className="p-2.5 rounded bg-black/40 border border-white/5 flex flex-col gap-2">
              <span className="text-[9px] text-cyan-400 font-semibold uppercase">
                {editingSnippetId ? 'Editar Script' : 'Añadir Snippet Manual'}
              </span>
              <input 
                type="text" 
                placeholder="Nombre (ej. Nginx Restart)"
                value={newSnipName}
                onChange={e => setNewSnipName(e.target.value)}
                className="bg-black/30 border border-white/5 rounded px-2 py-1 text-xs text-white outline-none focus:border-cyan-500/50"
              />
              <input 
                type="text" 
                placeholder="Comando (ej. systemctl restart nginx)"
                value={newSnipCmd}
                onChange={e => setNewSnipCmd(e.target.value)}
                className="bg-black/30 border border-white/5 rounded px-2 py-1 text-xs text-cyan-400 font-mono outline-none focus:border-cyan-500/50"
              />
              <div className="flex gap-2 mt-1">
                <button 
                  onClick={handleAddSnippet}
                  className="flex-1 glass-btn text-[10px] py-1.5 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 font-semibold uppercase tracking-wider"
                >
                  {editingSnippetId ? 'Actualizar Script' : 'Guardar Script'}
                </button>
                {editingSnippetId && (
                  <button 
                    onClick={() => {
                      setNewSnipName('');
                      setNewSnipCmd('');
                      setEditingSnippetId(null);
                    }}
                    className="glass-btn text-[10px] px-3 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 font-semibold uppercase tracking-wider"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>

            {/* Listado de Snippets */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1 mt-1 font-sans">
              {snippets.map(snip => (
                <div 
                  key={snip.id}
                  onClick={() => onExecuteSnippet(snip.command)}
                  className="p-2 rounded border border-white/5 hover:border-cyan-500/30 hover:bg-cyan-500/[0.02] cursor-pointer text-xs flex flex-col gap-1 group transition-all"
                  title="Haz click para inyectar este comando en la terminal SSH activa"
                >
                  <div className="flex justify-between items-center font-bold text-gray-200">
                    <span className="truncate">{snip.name}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setEditingSnippetId(snip.id);
                          setNewSnipName(snip.name);
                          setNewSnipCmd(snip.command);
                        }}
                        className="p-1 rounded hover:bg-white/10 text-cyan-400"
                        title="Editar Script"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteSnippet(snip.id); }}
                        className="p-1 rounded hover:bg-white/10 text-rose-400"
                        title="Eliminar Script"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <code className="text-[10px] text-cyan-400/80 font-mono truncate">{snip.command}</code>
                </div>
              ))}
              {snippets.length === 0 && (
                <span className="text-[11px] text-gray-500 text-center italic font-mono mt-8">Ningún script guardado</span>
              )}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 3: SETTINGS */}
        {/* ========================================== */}
        {activeTab === 'settings' && (
          <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-y-auto pb-4 pr-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white select-none">Configuraciones</h3>

            {/* 1. Ruta del Editor de Texto */}
            <div className="flex flex-col gap-1.5 p-2.5 rounded bg-black/40 border border-white/5">
              <span className="text-[9px] text-cyan-400 font-semibold uppercase">Editor Local (WinSCP-style)</span>
              <p className="text-[10px] text-gray-400 leading-relaxed font-normal">
                Introduce la ruta del archivo ejecutable de tu editor favorito (ej: VS Code o Notepad++). Si se deja en blanco, usará el Bloc de Notas por defecto.
              </p>
              <div className="flex gap-1.5 mt-1.5">
                <input 
                  type="text" 
                  value={tempEditorPath}
                  onChange={e => setTempEditorPath(e.target.value)}
                  placeholder="ej. C:\Program Files\Notepad++\notepad++.exe"
                  className="flex-1 bg-black/30 border border-white/5 rounded px-2 py-1 text-xs text-white outline-none focus:border-cyan-500/50 font-mono truncate"
                />
                <button 
                  onClick={() => { onSaveEditorPath(tempEditorPath); alert('Ruta del editor guardada.'); }}
                  className="p-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
                  title="Guardar Ruta"
                >
                  <Save className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 2. Contraseña Maestra de la Base de Datos */}
            <div className="flex flex-col gap-1.5 p-2.5 rounded bg-black/40 border border-white/5">
              <span className="text-[9px] text-cyan-400 font-semibold uppercase">Encriptación de Base de Datos</span>
              <p className="text-[10px] text-gray-400 leading-relaxed font-normal">
                {hasMasterPassword 
                  ? '🔒 Tu base de datos (.db) está cifrada con AES-256 mediante tu Contraseña Maestra. Se solicitará al arrancar.'
                  : '🔓 Base de datos cifrada con clave física local de máquina. Cualquiera con acceso a este ordenador puede abrirla sin contraseña.'
                }
              </p>
              
              <button 
                onClick={() => setShowPassModal(true)}
                className={`glass-btn text-[10px] py-1.5 uppercase font-semibold mt-1 flex items-center justify-center ${hasMasterPassword ? 'border-amber-500/20 text-amber-400 bg-amber-500/10' : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'}`}
              >
                {hasMasterPassword ? 'Cambiar / Quitar Contraseña' : 'Crear Contraseña Maestra'}
              </button>
            </div>

            {/* 3. Gestor de Credenciales Globales */}
            <div className="flex flex-col gap-2 p-2.5 rounded bg-black/40 border border-white/5">
              <span className="text-[9px] text-cyan-400 font-semibold uppercase flex items-center gap-1">
                <Key className="w-3.5 h-3.5" />
                Credenciales Globales
              </span>
              
              {/* Formulario Nueva Credencial */}
              <div className="border border-white/5 p-2 rounded bg-black/20 flex flex-col gap-1.5 mt-1">
                <input 
                  type="text" 
                  placeholder="Nombre Perfil (ej: AWS Root)"
                  value={newCredName}
                  onChange={e => setNewCredName(e.target.value)}
                  className="bg-black/40 border border-white/5 rounded px-2 py-1 text-xs text-white outline-none focus:border-cyan-500/50"
                />
                <input 
                  type="text" 
                  placeholder="Usuario (ej. root, admin)"
                  value={newCredUser}
                  onChange={e => setNewCredUser(e.target.value)}
                  className="bg-black/40 border border-white/5 rounded px-2 py-1 text-xs text-white outline-none focus:border-cyan-500/50"
                />
                
                <select 
                  value={newCredType}
                  onChange={e => setNewCredType(e.target.value as any)}
                  className="bg-black/40 border border-white/5 rounded px-2 py-1 text-xs text-gray-400 outline-none"
                >
                  <option value="password">Autenticación por Contraseña</option>
                  <option value="key">Autenticación por Llave Privada SSH</option>
                </select>

                {newCredType === 'password' ? (
                  <input 
                    type="password" 
                    placeholder="Contraseña"
                    value={newCredPass}
                    onChange={e => setNewCredPass(e.target.value)}
                    className="bg-black/40 border border-white/5 rounded px-2 py-1 text-xs text-white outline-none focus:border-cyan-500/50 font-mono"
                  />
                ) : (
                  <textarea 
                    rows={2}
                    placeholder="Contenido Llave PEM"
                    value={newCredKey}
                    onChange={e => setNewCredKey(e.target.value)}
                    className="bg-black/40 border border-white/5 rounded px-2 py-1 text-xs text-cyan-400 font-mono outline-none resize-none"
                  />
                )}

                <button 
                  onClick={handleAddCredential}
                  className="glass-btn text-[10px] py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 font-semibold uppercase mt-1"
                >
                  Añadir Credencial
                </button>
              </div>

              {/* Lista Credenciales Guardadas */}
              <div className="flex flex-col gap-1.5 mt-2 max-h-48 overflow-y-auto">
                {credentials.map(cred => (
                  <div key={cred.id} className="p-2 rounded bg-black/60 border border-white/[0.03] flex justify-between items-center text-xs">
                    <div className="flex flex-col truncate flex-1 pr-2">
                      <span className="font-semibold text-gray-200 truncate">{cred.name}</span>
                      <span className="text-[10px] text-gray-500 font-mono">user: {cred.username} • {cred.type === 'key' ? 'Llave SSH' : 'Contraseña'}</span>
                    </div>
                    <button 
                      onClick={() => onDeleteCredential(cred.id)}
                      className="p-1 rounded hover:bg-white/10 text-rose-400 transition-colors"
                      title="Eliminar Credencial"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {credentials.length === 0 && (
                  <span className="text-[10px] text-gray-600 text-center italic mt-2">Ninguna credencial global guardada</span>
                )}
              </div>

            </div>

            {/* 4. Copia de Seguridad */}
            <div className="flex flex-col gap-2 p-2.5 rounded bg-black/40 border border-white/5">
              <span className="text-[9px] text-cyan-400 font-semibold uppercase flex items-center gap-1">
                <Database className="w-3.5 h-3.5" />
                Copia de Seguridad
              </span>
              <p className="text-[10px] text-gray-400 leading-relaxed font-normal">
                Exporta tus conexiones y carpetas a un archivo JSON para tener un respaldo o transferirlos a otro equipo.
              </p>
              
              <div className="grid grid-cols-2 gap-2 mt-1 select-none">
                <button 
                  onClick={async () => {
                    const rawBackup = {
                      version: "2.0",
                      folders,
                      connections,
                      credentials
                    };
                    const jsonString = JSON.stringify(rawBackup, null, 2);

                    let backupDataStr = jsonString;
                    let isEncrypted = false;

                    if (hasMasterPassword) {
                      if (confirm("🔒 ¿Deseas cifrar la copia de seguridad utilizando tu Contraseña Maestra actual?\n\n(Recomendado: Cifrará de forma segura todas las credenciales e IPs con AES-256 antes de guardarlo en tu ordenador)")) {
                        const pass = prompt("Introduce tu Contraseña Maestra para autorizar y firmar el cifrado del backup:");
                        if (pass === null) return; // Cancelado

                        const res = await window.ipcRenderer.invoke('db:encrypt-data', jsonString, pass);
                        if (res.success) {
                          backupDataStr = JSON.stringify({ version: "2.0", encrypted: res.encrypted });
                          isEncrypted = true;
                          alert("🎉 Copia de seguridad cifrada con éxito mediante AES-256.");
                        } else {
                          alert(`❌ Error al cifrar: ${res.error || 'Contraseña incorrecta'}`);
                          return;
                        }
                      }
                    } else {
                      if (!confirm("⚠️ No tienes configurada una Contraseña Maestra en la aplicación.\n\nEl archivo se exportará en TEXTO PLANO y tus claves serán visibles en el archivo JSON. ¿Estás seguro de que deseas continuar?")) {
                        return;
                      }
                    }

                    const blob = new Blob([backupDataStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `sincrack_rdm_backup_${isEncrypted ? 'secured_' : ''}${new Date().toISOString().slice(0, 10)}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="glass-btn text-[10px] py-1.5 font-semibold bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 uppercase flex items-center justify-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  Exportar
                </button>
                
                <label className="glass-btn text-[10px] py-1.5 font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 uppercase flex items-center justify-center gap-1 cursor-pointer">
                  <Upload className="w-3 h-3" />
                  Importar
                  <input 
                    type="file" 
                    accept=".json" 
                    className="hidden" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = async (event) => {
                        try {
                          const fileContent = event.target?.result as string;
                          let imported = JSON.parse(fileContent);

                          if (imported.encrypted) {
                            const pass = prompt("🔒 Esta copia de seguridad está cifrada mediante AES-256.\n\nPor favor, introduce la Contraseña Maestra con la que se cifró el archivo:");
                            if (pass === null) return; // Cancelado

                            const decryptRes = await window.ipcRenderer.invoke('db:decrypt-data', imported.encrypted, pass);
                            if (decryptRes.success) {
                              imported = JSON.parse(decryptRes.decrypted);
                            } else {
                              alert("❌ Contraseña incorrecta. No se pudo descifrar la copia de seguridad.");
                              return;
                            }
                          }

                          if (!imported.folders || !imported.connections) {
                            alert('⚠️ El archivo no tiene un formato de copia de seguridad RDM válido.');
                            return;
                          }

                          const credCount = imported.credentials ? imported.credentials.length : 0;
                          if (confirm(`Se importarán:\n- ${imported.folders.length} Carpetas\n- ${imported.connections.length} Conexiones\n- ${credCount} Credenciales\n\n¿Deseas continuar?`)) {
                            onImportData(imported.folders, imported.connections, imported.credentials || []);
                          }
                        } catch (err) {
                          alert('Error al leer el archivo JSON.');
                        }
                      };
                      reader.readAsText(file);
                      e.target.value = ''; // Resetear
                    }}
                  />
                </label>

                {/* Importar Bóveda de Remote Desktop Manager (RDM) original */}
                <label className="glass-btn col-span-2 text-[10px] py-1.5 font-semibold bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 uppercase flex items-center justify-center gap-1 cursor-pointer mt-1 select-none">
                  <Network className="w-3 h-3" />
                  Importar Bóveda JSON
                  <input 
                    type="file" 
                    accept=".json" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        try {
                          const rdmJson = JSON.parse(event.target?.result as string);
                          if (!rdmJson.Connections || !Array.isArray(rdmJson.Connections)) {
                            alert('⚠️ El archivo no tiene un formato de exportación RDM original válido (debe contener un array "Connections").');
                            return;
                          }
                          
                          if (confirm(`Se han detectado ${rdmJson.Connections.length} entradas en el backup de Remote Desktop Manager. ¿Deseas importarlas recreando la estructura original de carpetas?`)) {
                            const pathFolderMap: Record<string, string> = {};
                            const newFolders = [...folders];
                            const newConns = [...connections];

                            // Helper recursivo para crear la jerarquía de grupos separada por backslashes
                            const ensureFolderHierarchy = (groupStr: string): string | null => {
                              if (!groupStr) return null;
                              const segments = groupStr.split('\\').map(s => s.trim()).filter(Boolean);
                              let currentParentId: string | null = null;
                              let currentPathKey = '';

                              for (const segment of segments) {
                                currentPathKey = currentPathKey ? `${currentPathKey}|${segment}` : segment;
                                if (pathFolderMap[currentPathKey]) {
                                  currentParentId = pathFolderMap[currentPathKey];
                                } else {
                                  // Comprobar si ya la hemos cargado antes
                                  const existingFolder = newFolders.find(f => f.name === segment && f.parentId === currentParentId);
                                  if (existingFolder) {
                                    pathFolderMap[currentPathKey] = existingFolder.id;
                                    currentParentId = existingFolder.id;
                                  } else {
                                    const newFolderId = Math.random().toString();
                                    newFolders.push({
                                      id: newFolderId,
                                      name: segment,
                                      parentId: currentParentId,
                                      isFolder: true
                                    });
                                    pathFolderMap[currentPathKey] = newFolderId;
                                    currentParentId = newFolderId;
                                  }
                                }
                              }
                              return currentParentId;
                            };

                            let importedCount = 0;
                            rdmJson.Connections.forEach((conn: any) => {
                              const connType = conn.ConnectionType;
                              const name = conn.Name || 'Conexión Importada';
                              
                              // Si es nodo tipo carpeta/grupo (ConnectionType: 25)
                              if (connType === 25) {
                                const fullPath = conn.Group || name;
                                ensureFolderHierarchy(fullPath);
                                return;
                              }

                              // Asegurar jerarquía y obtener el ID de la carpeta contenedora
                              const fId = ensureFolderHierarchy(conn.Group);

                              if (connType === 77) { // SSH
                                const t = conn.Terminal || {};
                                const host = t.Host || '';
                                const port = t.HostPort || 22;
                                const username = t.Username || '';
                                newConns.push({
                                  id: Math.random().toString(),
                                  name: name,
                                  folderId: fId,
                                  protocol: 'ssh',
                                  openMode: 'tab',
                                  host: host,
                                  port: Number(port),
                                  jumpHostId: null,
                                  credentialId: null,
                                  manualCreds: username ? {
                                    username: username,
                                    type: 'password',
                                    password: '',
                                    privateKey: ''
                                  } : null
                                });
                                importedCount++;
                              } else if (connType === 1) { // RDP
                                const r = conn.RDP || {};
                                let rawUrl = conn.Url || '';
                                let host = rawUrl;
                                let port = 3389;
                                if (rawUrl.includes(':')) {
                                  const parts = rawUrl.split(':');
                                  host = parts[0];
                                  port = Number(parts[1]) || 3389;
                                }
                                const username = r.UserName || '';
                                newConns.push({
                                  id: Math.random().toString(),
                                  name: name,
                                  folderId: fId,
                                  protocol: 'rdp',
                                  openMode: 'tab',
                                  host: host,
                                  port: Number(port),
                                  rdpResolution: '1280x800',
                                  rdpFullscreen: false,
                                  credentialId: null,
                                  manualCreds: username ? {
                                    username: username,
                                    type: 'password',
                                    password: '',
                                    privateKey: ''
                                  } : null
                                });
                                importedCount++;
                              } else if (connType === 5) { // WEB
                                const url = conn.WebBrowserUrl || '';
                                newConns.push({
                                  id: Math.random().toString(),
                                  name: name,
                                  folderId: fId,
                                  protocol: 'web',
                                  openMode: 'tab',
                                  url: url
                                });
                                importedCount++;
                              }
                            });

                            onImportData(newFolders, newConns);
                            alert("🎉 ¡Bóveda RDM importada con éxito! Se han importado " + importedCount + " conexiones y se han recreado todas sus carpetas organizativas.\n\n⚠️ NOTA DE SEGURIDAD: Dado que Devoluciones RDM cifra localmente las contraseñas, tendrás que editar las conexiones importadas y guardar su contraseña por primera vez. Una vez guardadas, quedarán cifradas de forma segura con tu contraseña maestra.");
                          }
                        } catch (err) {
                          alert('Error al leer el archivo JSON.');
                        }
                      };
                      reader.readAsText(file);
                      e.target.value = ''; // Resetear
                    }}
                  />
                </label>
              </div>
            </div>

            {/* 5. Personalización Visual (Tema y Terminal) */}
            <div className="flex flex-col gap-3 p-2.5 rounded bg-black/40 border border-white/5 animate-slide-in">
              <span className="text-[9px] text-cyan-400 font-semibold uppercase flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-cyan-400" />
                Aspecto y Terminal
              </span>
              
              {/* Selector de Tema */}
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-gray-500 font-semibold uppercase">Tema de la Aplicación</label>
                <div className="flex bg-black/40 border border-white/5 p-0.5 rounded">
                  <button 
                    type="button"
                    onClick={() => onSaveTheme('dark')}
                    className={`flex-1 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-colors ${appTheme === 'dark' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Oscuro 🌙
                  </button>
                  <button 
                    type="button"
                    onClick={() => onSaveTheme('light')}
                    className={`flex-1 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-colors ${appTheme === 'light' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Claro ☀️
                  </button>
                </div>
              </div>

              {/* Tamaño de Letra de Terminal */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] text-gray-500 font-semibold uppercase">Tamaño Letra Consola</label>
                  <span className="text-[10px] font-mono text-cyan-400 font-bold">{terminalFontSize}px</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <input 
                    type="range" 
                    min="10" 
                    max="24" 
                    value={terminalFontSize}
                    onChange={(e) => onSaveTerminalFontSize(Number(e.target.value))}
                    className="flex-1 accent-cyan-500 bg-black/40 h-1 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Danger Zone / Restablecer */}
            <div className="p-3.5 rounded-lg bg-rose-950/10 border border-rose-500/20 flex flex-col gap-2 mt-4 animate-slide-in">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5 select-none">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                Zona de Peligro
              </h4>
              <p className="text-[10px] text-gray-400 leading-normal font-normal">
                Elimina de forma permanente todo el contenido de la aplicación (conexiones, carpetas, credenciales globales y scripts) para volver a empezar de cero.
              </p>
              <button
                onClick={onResetDatabase}
                className="glass-btn text-[10px] py-1.5 font-bold bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 uppercase flex items-center justify-center gap-1 mt-1 cursor-pointer select-none border border-rose-500/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Restablecer BBDD
              </button>
            </div>

          </div>
        )}

        {/* ========================================== */}
        {/* TAB 4: TOOLS */}
        {/* ========================================== */}
        {activeTab === 'tools' && (
          <div className="flex-1 h-full min-h-0 flex flex-col gap-3 min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)] select-none">
              Utilidades y Herramientas
            </h3>
            
            <div className="flex flex-col gap-2 pr-1 overflow-y-auto">
              <button
                onClick={() => {
                  onChangeSubTool('network');
                  onOpenTools();
                }}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${
                  activeSubTool === 'network'
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 font-semibold'
                    : 'bg-transparent border-transparent text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <Activity className="w-4 h-4 text-cyan-400" />
                <div className="flex flex-col">
                  <span className="text-xs">Diagnóstico de Red</span>
                  <span className="text-[9px] opacity-70">Ping & Puerto Scanner</span>
                </div>
              </button>

              <button
                onClick={() => {
                  onChangeSubTool('password');
                  onOpenTools();
                }}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${
                  activeSubTool === 'password'
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 font-semibold'
                    : 'bg-transparent border-transparent text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <Key className="w-4 h-4 text-purple-400" />
                <div className="flex flex-col">
                  <span className="text-xs">Generador Contraseñas</span>
                  <span className="text-[9px] opacity-70">Seguras y aleatorias</span>
                </div>
              </button>

              <button
                onClick={() => {
                  onChangeSubTool('sshkey');
                  onOpenTools();
                }}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${
                  activeSubTool === 'sshkey'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-semibold'
                    : 'bg-transparent border-transparent text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <FileKey className="w-4 h-4 text-amber-400" />
                <div className="flex flex-col">
                  <span className="text-xs">Generador Llaves SSH</span>
                  <span className="text-[9px] opacity-70">RSA & Ed25519 Seguras</span>
                </div>
              </button>

              <button
                onClick={() => {
                  onChangeSubTool('sysinfo');
                  onOpenTools();
                }}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${
                  activeSubTool === 'sysinfo'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold'
                    : 'bg-transparent border-transparent text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <Cpu className="w-4 h-4 text-emerald-400" />
                <div className="flex flex-col">
                  <span className="text-xs">Info de mi Sistema</span>
                  <span className="text-[9px] opacity-70">CPU, RAM y Red local</span>
                </div>
              </button>

              <button
                onClick={() => {
                  onChangeSubTool('certificate');
                  onOpenTools();
                }}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${
                  activeSubTool === 'certificate'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-semibold'
                    : 'bg-transparent border-transparent text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <div className="flex flex-col">
                  <span className="text-xs">Certificado Autofirmado</span>
                  <span className="text-[9px] opacity-70">Crear PFX & PEM locales</span>
                </div>
              </button>

              <button
                onClick={() => {
                  onChangeSubTool('sslcheck');
                  onOpenTools();
                }}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${
                  activeSubTool === 'sslcheck'
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 font-semibold'
                    : 'bg-transparent border-transparent text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <Globe className="w-4 h-4 text-cyan-400" />
                <div className="flex flex-col">
                  <span className="text-xs">Comprobador de SSL</span>
                  <span className="text-[9px] opacity-70">Analizar seguridad HTTPS</span>
                </div>
              </button>

              <button
                onClick={() => {
                  onChangeSubTool('wol');
                  onOpenTools();
                }}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${
                  activeSubTool === 'wol'
                    ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 font-semibold'
                    : 'bg-transparent border-transparent text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <Power className="w-4 h-4 text-orange-400" />
                <div className="flex flex-col">
                  <span className="text-xs">Wake on LAN (WoL)</span>
                  <span className="text-[9px] opacity-70">Encendido remoto por MAC</span>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL CONFIGURAR CONTRASEÑA MAESTRA */}
      {showPassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm">
          <div className="w-96 glass-panel p-5 animate-scale-in">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-2 mb-4 title-font">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              Contraseña Maestra RDM
            </h3>

            <p className="text-[10px] text-gray-400 leading-normal mb-4 font-normal">
              Introduce una contraseña maestra para cifrar con AES-256 tus conexiones, llaves y datos. 
              <strong> ¡ATENCIÓN!:</strong> Si olvidas esta contraseña, tus datos serán irrecuperables. 
              *Deja la nueva contraseña en blanco si quieres quitar el cifrado y usar la clave de máquina por defecto.*
            </p>
            
            <div className="flex flex-col gap-3 mb-4">
              {hasMasterPassword && (
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-gray-500 font-semibold uppercase">Contraseña Maestra Actual</label>
                  <input 
                    type="password"
                    placeholder="••••••••"
                    value={oldPass}
                    onChange={e => setOldPass(e.target.value)}
                    className="glass-input text-xs py-1.5"
                  />
                </div>
              )}
              
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-gray-500 font-semibold uppercase">Nueva Contraseña Maestra (o vacío para quitar)</label>
                <input 
                  type="password"
                  placeholder="••••••••"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  className="glass-input text-xs py-1.5"
                />
              </div>

              {passError && <span className="text-[10px] text-rose-400 font-mono">{passError}</span>}
            </div>
            
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowPassModal(false); setPassError(''); }} className="glass-btn text-xs py-1.5 px-3">
                Cancelar
              </button>
              <button onClick={handleSavePassword} className="glass-btn glass-btn-accent text-xs py-1.5 px-3 bg-cyan-600 hover:bg-cyan-500">
                Guardar Contraseña
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GORGEOUS CONTEXT MENU */}
      {contextMenu && (
        <div 
          className="fixed z-[999] w-48 border rounded-lg p-1 shadow-2xl backdrop-blur-md animate-scale-in text-xs context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => {
              onOpenConnection(contextMenu.conn);
              setContextMenu(null);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded hover:bg-white/5 text-gray-200 font-medium flex items-center gap-2 transition-colors"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            Abrir Terminal (SSH)
          </button>
          
          {contextMenu.conn.protocol === 'ssh' && (
            <button 
              onClick={() => {
                const sftpConn = { 
                  ...contextMenu.conn, 
                  id: contextMenu.conn.id + '_sftp', // ID único para no colisionar con la pestaña SSH activa
                  protocol: 'sftp', 
                  name: `${contextMenu.conn.name} [SFTP]` 
                };
                onOpenConnection(sftpConn);
                setContextMenu(null);
              }}
              className="w-full text-left px-2.5 py-1.5 rounded hover:bg-emerald-500/10 hover:text-emerald-400 text-gray-200 font-medium flex items-center gap-2 transition-colors hover-emerald"
            >
              <Network className="w-3.5 h-3.5 text-emerald-400" />
              Conectar como SFTP / SCP
            </button>
          )}

          {contextMenu.conn.protocol === 'rdp' && (
            <button 
              onClick={() => {
                const fsConn = { 
                  ...contextMenu.conn, 
                  rdpFullscreen: true,
                  openMode: 'fullscreen'
                };
                onOpenConnection(fsConn);
                setContextMenu(null);
              }}
              className="w-full text-left px-2.5 py-1.5 rounded hover:bg-cyan-500/10 hover:text-cyan-400 text-gray-200 font-medium flex items-center gap-2 transition-colors hover-cyan"
            >
              <Monitor className="w-3.5 h-3.5 text-cyan-400" />
              Abrir Pantalla Completa
            </button>
          )}
          
          <div className="h-[1px] bg-white/5 my-1 menu-divider" />
          
          <button 
            onClick={() => {
              setEditingItemId(contextMenu.conn.id);
              setEditingItemType('connection');
              setEditingItemValue(contextMenu.conn.name);
              setContextMenu(null);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded hover:bg-white/5 text-gray-300 flex items-center gap-2 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
            Renombrar Conexión
          </button>
          
          <button 
            onClick={() => {
              onTriggerModal(contextMenu.conn);
              setContextMenu(null);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded hover:bg-white/5 text-gray-300 flex items-center gap-2 transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-cyan-400" />
            Propiedades / Editar
          </button>

          <button 
            onClick={() => {
              setNotesConn(contextMenu.conn);
              setNotesText(contextMenu.conn.notes || '');
              setContextMenu(null);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded hover:bg-white/5 text-gray-300 flex items-center gap-2 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            Notas de Conexión
          </button>
          
          <button 
            onClick={() => {
              onDuplicateConnection(contextMenu.conn);
              setContextMenu(null);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded hover:bg-white/5 text-gray-300 flex items-center gap-2 transition-colors"
          >
            <Copy className="w-3.5 h-3.5 text-emerald-400" />
            Duplicar Conexión
          </button>

          {/* OPCIONES DE PORTAPAPELES */}
          {(() => {
            const getResolvedCredentials = (conn: any) => {
              if (!conn) return { username: '', password: '' };
              if (conn.manualCreds) {
                return {
                  username: conn.manualCreds.username || '',
                  password: conn.manualCreds.password || ''
                };
              }
              if (conn.credentialId) {
                const cred = credentials.find((c: any) => c.id === conn.credentialId);
                if (cred) {
                  return {
                    username: cred.username || '',
                    password: cred.password || ''
                  };
                }
              }
              return { username: '', password: '' };
            };

            const resolved = getResolvedCredentials(contextMenu.conn);
            const hostOrUrl = contextMenu.conn.protocol === 'web' ? contextMenu.conn.url : contextMenu.conn.host;

            return (
              <>
                {(hostOrUrl || resolved.username || resolved.password) && (
                  <div className="h-[1px] bg-white/5 my-1 menu-divider" />
                )}
                {hostOrUrl && (
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(hostOrUrl);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-white/5 text-gray-300 flex items-center gap-2 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5 text-cyan-400" />
                    Copiar Host / IP
                  </button>
                )}
                {resolved.username && (
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(resolved.username);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-white/5 text-gray-300 flex items-center gap-2 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5 text-purple-400" />
                    Copiar Usuario
                  </button>
                )}
                {resolved.password && (
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(resolved.password);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-white/5 text-gray-300 flex items-center gap-2 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    Copiar Contraseña
                  </button>
                )}
              </>
            );
          })()}

          <div className="h-[1px] bg-white/5 my-1 menu-divider" />

          <button 
            onClick={() => {
              onDeleteConnection(contextMenu.conn.id);
              setContextMenu(null);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded hover:bg-rose-500/10 hover:text-rose-400 text-rose-400 flex items-center gap-2 transition-colors hover-rose"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Eliminar Conexión
          </button>
        </div>
      )}

      {/* GORGEOUS FOLDER CONTEXT MENU */}
      {folderContextMenu && (
        <div 
          className="fixed z-[999] w-48 border rounded-lg p-1 shadow-2xl backdrop-blur-md animate-scale-in text-xs context-menu"
          style={{ top: folderContextMenu.y, left: folderContextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => {
              setParentFolderIdForNewFolder(folderContextMenu.folder.id);
              setShowFolderInput(true);
              setFolderContextMenu(null);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded hover:bg-emerald-500/10 hover:text-emerald-400 text-gray-200 font-medium flex items-center gap-2 transition-colors hover-emerald"
          >
            <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
            Nueva Subcarpeta
          </button>
          
          <button 
            onClick={() => {
              setEditingItemId(folderContextMenu.folder.id);
              setEditingItemType('folder');
              setEditingItemValue(folderContextMenu.folder.name);
              setFolderContextMenu(null);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded hover:bg-cyan-500/10 hover:text-cyan-400 text-gray-200 font-medium flex items-center gap-2 transition-colors hover-cyan"
          >
            <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
            Renombrar Carpeta
          </button>
          
          <div className="h-[1px] bg-white/5 my-1 menu-divider" />
          
          <button 
            onClick={() => {
              onDeleteFolder(folderContextMenu.folder.id);
              setFolderContextMenu(null);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded hover:bg-rose-500/10 hover:text-rose-400 text-rose-400 flex items-center gap-2 transition-colors hover-rose"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Eliminar Carpeta
          </button>
        </div>
      )}

      {/* MODAL VER / EDITAR NOTAS DE CONEXIÓN */}
      {notesConn && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg glass-panel p-5 border border-cyan-500/20 shadow-2xl animate-scale-in flex flex-col max-h-[80vh]">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-2 mb-3 title-font">
              <FileText className="w-4 h-4 text-cyan-400" />
              Notas: {notesConn.name}
            </h3>
            
            <p className="text-[10px] text-gray-400 leading-normal mb-3 font-normal">
              Escribe comentarios, comandos rápidos o apuntes sobre esta conexión. Se guardarán de forma segura en tu base de datos local.
            </p>

            <textarea
              className="flex-1 w-full min-h-[250px] glass-input p-3 text-xs text-white placeholder-gray-600 outline-none font-mono resize-none scrollbar-thin"
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Escribe tus anotaciones aquí... (ej. comandos de reinicio, IPs secundarias, etc.)"
              autoFocus
            />

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-white/5">
              <button 
                onClick={() => setNotesConn(null)} 
                className="glass-btn text-xs py-1.5 px-3"
              >
                Cerrar
              </button>
              <button 
                onClick={() => {
                  onEditConnection({
                    ...notesConn,
                    notes: notesText
                  });
                  setNotesConn(null);
                }} 
                className="glass-btn glass-btn-accent text-xs py-1.5 px-4 bg-cyan-600 hover:bg-cyan-500"
              >
                Guardar Notas
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
