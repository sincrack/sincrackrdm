import React, { useState, useEffect, useRef } from 'react'
import { 
  Folder, FileText, FileArchive, Image, File, 
  Download, Upload, Trash2, Edit3, FolderPlus, 
  ArrowLeft, RefreshCw, Loader2, Search, X, CheckCircle2, AlertCircle
} from 'lucide-react'

interface SftpSessionProps {
  sessionId: string;
  connection: any;
  credential: any;
  jumpHost?: any;
}

interface SftpFile {
  name: string;
  isDirectory: boolean;
  size: number;
  mtime: number;
  permissions?: number;
}

interface FileTransfer {
  id: string;
  name: string;
  type: 'upload' | 'download';
  progress: number;
  status: 'pending' | 'active' | 'completed' | 'error';
  error?: string;
}

interface SyncNotification {
  filename: string;
  status: 'syncing' | 'success' | 'error';
  error?: string;
  id: string;
}

export default function SftpSession({ sessionId, connection, credential, jumpHost }: SftpSessionProps) {
  const [currentPath, setCurrentPath] = useState('/');
  const currentPathRef = useRef('/');
  const [files, setFiles] = useState<SftpFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modales y inputs
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFile, setSelectedFile] = useState<SftpFile | null>(null);
  
  // Cola de transferencias
  const [transfers, setTransfers] = useState<FileTransfer[]>([]);
  const [showQueue, setShowQueue] = useState(false);
  
  // Notificaciones de edición local (Sync Toasts)
  const [syncNotifications, setSyncNotifications] = useState<SyncNotification[]>([]);

  // Cargar lista de archivos al cambiar la ruta o conectar
  const fetchFiles = async (pathTarget = currentPathRef.current) => {
    setLoading(true);
    setError(null);
    try {
      // Asegurar conexión SSH activa
      await window.ipcRenderer.invoke('ssh:connect', sessionId, connection, credential, jumpHost);
      const res = await window.ipcRenderer.invoke('sftp:list', sessionId, pathTarget);
      
      if (res.success) {
        // Ordenar carpetas primero, luego archivos alfabéticamente
        const sorted = (res.files || []).sort((a: SftpFile, b: SftpFile) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
        setFiles(sorted);
        setCurrentPath(pathTarget);
        currentPathRef.current = pathTarget;
      } else {
        setError(res.error || 'Error al listar el directorio');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión SFTP');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles('/');

    // Escuchar notificaciones de sincronización del editor externo
    const handleSyncMessage = (_: any, data: { filename: string; status: 'syncing' | 'success' | 'error'; error?: string }) => {
      const notifId = Math.random().toString();
      setSyncNotifications(prev => [
        ...prev.filter(n => n.filename !== data.filename), // Quitar previa del mismo archivo
        { ...data, id: notifId }
      ]);

      // Si fue éxito o error, hacer que desaparezca a los 5 segundos
      if (data.status === 'success' || data.status === 'error') {
        setTimeout(() => {
          setSyncNotifications(prev => prev.filter(n => n.id !== notifId));
        }, 5000);
        // Refrescar archivos actuales
        fetchFiles();
      }
    };

    window.ipcRenderer.on(`sftp:editor-syncing:${sessionId}`, handleSyncMessage);

    return () => {
      window.ipcRenderer.off(`sftp:editor-syncing:${sessionId}`, handleSyncMessage);
    };
  }, [sessionId]);

  // Navegar adentro
  const handleDoubleClick = (file: SftpFile) => {
    if (file.isDirectory) {
      const newPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`.replace(/\/+/g, '/');
      fetchFiles(newPath);
    } else {
      handleEdit(file);
    }
  };

  // Navegar hacia atrás
  const handleGoBack = () => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const newPath = '/' + parts.join('/');
    fetchFiles(newPath);
  };

  // Formatear pesos
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Obtener Icono adecuado
  const getFileIcon = (file: SftpFile) => {
    if (file.isDirectory) return <Folder className="w-5 h-5 text-emerald-400 fill-emerald-400/10" />;
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext || '')) {
      return <FileArchive className="w-5 h-5 text-amber-400 fill-amber-400/10" />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '')) {
      return <Image className="w-5 h-5 text-cyan-400 fill-cyan-400/10" />;
    }
    if (['txt', 'conf', 'json', 'yml', 'yaml', 'ini', 'cfg', 'sh', 'php', 'js', 'ts', 'html', 'css'].includes(ext || '')) {
      return <FileText className="w-5 h-5 text-emerald-400 fill-emerald-400/10" />;
    }
    return <File className="w-5 h-5 text-gray-400" />;
  };

  // Crear Carpeta
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const newDirPath = `${currentPath}/${newFolderName}`.replace(/\/+/g, '/');
    const res = await window.ipcRenderer.invoke('sftp:mkdir', sessionId, newDirPath);
    if (res.success) {
      setNewFolderName('');
      setShowFolderModal(false);
      fetchFiles();
    } else {
      alert('Error al crear carpeta: ' + res.error);
    }
  };

  // Borrar Archivo o Carpeta
  const handleDelete = async (file: SftpFile) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar ${file.isDirectory ? 'la carpeta' : 'el archivo'} "${file.name}"?`)) return;
    const targetPath = `${currentPath}/${file.name}`.replace(/\/+/g, '/');
    const res = await window.ipcRenderer.invoke('sftp:delete', sessionId, targetPath, file.isDirectory);
    if (res.success) {
      fetchFiles();
    } else {
      alert('Error al borrar: ' + res.error);
    }
  };

  // Iniciar descarga
  const handleDownload = async (file: SftpFile) => {
    if (file.isDirectory) return;

    // Descargar por defecto con su nombre original en la carpeta de Descargas del sistema
    const localName = file.name;
    const homeDir = process.env.USERPROFILE || process.env.HOME || 'C:\\';
    const localFilePath = `${homeDir}\\Downloads\\${localName}`;
    const remoteFilePath = `${currentPath}/${file.name}`.replace(/\/+/g, '/');

    const transferId = Math.random().toString();
    const newTransfer: FileTransfer = {
      id: transferId,
      name: file.name,
      type: 'download',
      progress: 0,
      status: 'pending'
    };

    setTransfers(prev => [newTransfer, ...prev]);
    setShowQueue(true);

    // Escuchar progreso
    const onProgress = (_: any, data: any) => {
      setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, progress: data.percentage, status: 'active' } : t));
    };

    window.ipcRenderer.on(`sftp:progress:${transferId}`, onProgress);

    const res = await window.ipcRenderer.invoke('sftp:download', sessionId, remoteFilePath, localFilePath, transferId);
    
    window.ipcRenderer.off(`sftp:progress:${transferId}`, onProgress);

    if (res.success) {
      setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, progress: 100, status: 'completed' } : t));
    } else {
      setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, status: 'error', error: res.error } : t));
    }
  };

  // Disparar Edición Remota en Editor Local (WinSCP-style)
  const handleEdit = async (file: SftpFile) => {
    if (file.isDirectory) return;
    const remoteFilePath = `${currentPath}/${file.name}`.replace(/\/+/g, '/');
    
    // Mostramos un toast inmediato de cargando
    const notifId = Math.random().toString();
    setSyncNotifications(prev => [
      ...prev,
      { id: notifId, filename: file.name, status: 'syncing' }
    ]);

    const res = await window.ipcRenderer.invoke('sftp:edit-file', sessionId, remoteFilePath, file.name);
    
    if (!res.success) {
      // Actualizar el toast con el error
      setSyncNotifications(prev => prev.map(n => n.id === notifId ? { ...n, status: 'error', error: res.error } : n));
      setTimeout(() => {
        setSyncNotifications(prev => prev.filter(n => n.id !== notifId));
      }, 5000);
    } else {
      // Cambiar estado a vigilando silenciosamente
      setSyncNotifications(prev => prev.filter(n => n.id !== notifId));
    }
  };

  // Drag & Drop Nativo (Subida Directa)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const filesDropped = e.dataTransfer.files;
    if (filesDropped.length === 0) return;

    for (let i = 0; i < filesDropped.length; i++) {
      const file = filesDropped[i];
      
      // En Electron el file.path es la ruta real absoluta del archivo en el ordenador!
      const localFilePath = (file as any).path;
      if (!localFilePath) continue;

      const remoteFilePath = `${currentPath}/${file.name}`.replace(/\/+/g, '/');

      const transferId = Math.random().toString();
      const newTransfer: FileTransfer = {
        id: transferId,
        name: file.name,
        type: 'upload',
        progress: 0,
        status: 'pending'
      };

      setTransfers(prev => [newTransfer, ...prev]);
      setShowQueue(true);

      const onProgress = (_: any, data: any) => {
        setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, progress: data.percentage, status: 'active' } : t));
      };

      window.ipcRenderer.on(`sftp:progress:${transferId}`, onProgress);

      const res = await window.ipcRenderer.invoke('sftp:upload', sessionId, localFilePath, remoteFilePath, transferId);
      
      window.ipcRenderer.off(`sftp:progress:${transferId}`, onProgress);

      if (res.success) {
        setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, progress: 100, status: 'completed' } : t));
      } else {
        setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, status: 'error', error: res.error } : t));
      }
    }
    fetchFiles();
  };

  // Filtrar archivos en la barra de búsqueda
  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div 
      className="w-full h-full flex border rounded-lg overflow-hidden relative glass-panel"
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--panel-border)' }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      
      {/* Notificaciones Flotantes de Sincronización de Archivos (WinSCP-style) */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {syncNotifications.map(notif => (
          <div 
            key={notif.id} 
            className={`p-3 rounded-lg border backdrop-blur-md shadow-2xl flex items-center gap-3 transition-all duration-300 animate-slide-in ${
              notif.status === 'syncing' 
                ? 'bg-cyan-950/80 border-cyan-500/30 text-cyan-200' 
                : notif.status === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-200'
                : 'bg-rose-950/80 border-rose-500/30 text-rose-200'
            }`}
          >
            {notif.status === 'syncing' && <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />}
            {notif.status === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            {notif.status === 'error' && <AlertCircle className="w-5 h-5 text-rose-400" />}
            
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{notif.filename}</p>
              <p className="text-[10px] opacity-80">
                {notif.status === 'syncing' && 'Abierto en tu editor local. Sincronizando saves...'}
                {notif.status === 'success' && '¡Guardado y subido correctamente!'}
                {notif.status === 'error' && `Error al subir: ${notif.error}`}
              </p>
            </div>
            
            <button 
              onClick={() => setSyncNotifications(prev => prev.filter(n => n.id !== notif.id))}
              className="opacity-60 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Main File Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Navigation Toolbar */}
        <div className="p-3 border-b flex flex-wrap items-center gap-3" style={{ borderBottomColor: 'var(--panel-border)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
          <div className="flex items-center gap-1">
            <button 
              onClick={handleGoBack}
              disabled={currentPath === '/'}
              className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-40 transition-colors"
              title="Atrás"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={() => fetchFiles()}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              title="Recargar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Breadcrumb Path Bar */}
          <div className="flex-1 min-w-[200px] rounded-lg px-3 py-1.5 text-sm font-mono text-emerald-400/90 truncate flex items-center border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--panel-border)' }}>
            {currentPath}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar archivo..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="glass-input pl-9 pr-3 py-1.5 text-xs placeholder-gray-500 outline-none focus:border-emerald-500/50 w-44 transition-all focus:w-56"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowFolderModal(true)}
              className="glass-btn py-1.5 px-3 text-xs bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Nueva Carpeta
            </button>
            <button 
              onClick={() => setShowQueue(!showQueue)}
              className={`glass-btn py-1.5 px-3 text-xs relative ${transfers.some(t => t.status === 'active') ? 'border-amber-500/30 text-amber-400' : ''}`}
            >
              Cola ({transfers.filter(t => t.status === 'active').length})
            </button>
          </div>
        </div>

        {/* File Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <span className="text-xs font-mono">Listando archivos remotos...</span>
            </div>
          ) : error ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-rose-400 p-6 text-center">
              <AlertCircle className="w-10 h-10 text-rose-500" />
              <p className="text-sm font-semibold">{error}</p>
              <button onClick={() => fetchFiles()} className="glass-btn mt-2 text-xs">Reintentar</button>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-500">
              <Folder className="w-12 h-12 stroke-[1] opacity-40 text-emerald-500" />
              <span className="text-sm">Directorio vacío o sin coincidencias</span>
              <span className="text-[10px] opacity-70">Arrastra archivos aquí para subirlos</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b text-gray-500 font-semibold select-none" style={{ borderBottomColor: 'var(--panel-border)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                  <th className="py-2.5 px-4 w-1/2">Nombre</th>
                  <th className="py-2.5 px-4">Peso</th>
                  <th className="py-2.5 px-4">Modificado</th>
                  <th className="py-2.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map(file => (
                  <tr 
                    key={file.name}
                    onDoubleClick={() => handleDoubleClick(file)}
                    onClick={() => setSelectedFile(file)}
                    className="border-b cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ 
                      borderBottomColor: 'var(--panel-border)',
                      backgroundColor: selectedFile?.name === file.name ? 'rgba(0, 229, 255, 0.08)' : 'transparent'
                    }}
                  >
                    <td className="py-2 px-4 font-medium flex items-center gap-2.5 truncate">
                      {getFileIcon(file)}
                      <span className="truncate">{file.name}</span>
                    </td>
                    <td className="py-2 px-4 text-gray-400 font-mono">
                      {file.isDirectory ? 'Carpeta' : formatBytes(file.size)}
                    </td>
                    <td className="py-2 px-4 text-gray-400 font-mono">
                      {new Date(file.mtime).toLocaleString()}
                    </td>
                    <td className="py-2 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 tr-actions-visible">
                        {!file.isDirectory && (
                          <>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleEdit(file); }}
                              className="p-1 rounded hover:bg-white/10 text-cyan-400"
                              title="Editar en tu editor local"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                              className="p-1 rounded hover:bg-white/10 text-emerald-400"
                              title="Descargar"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(file); }}
                          className="p-1 rounded hover:bg-white/10 text-rose-400"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Right Drawer: Transfer Queue */}
      {showQueue && (
        <div className="w-80 border-l flex flex-col backdrop-blur-md" style={{ backgroundColor: 'var(--bg-secondary)', borderLeftColor: 'var(--panel-border)' }}>
          <div className="p-3 border-b flex items-center justify-between" style={{ borderBottomColor: 'var(--panel-border)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Upload className="w-3.5 h-3.5" />
              Cola de Transferencias
            </h3>
            <button onClick={() => setShowQueue(false)} className="p-1 hover:bg-white/10 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {transfers.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-10 font-mono">Cola vacía</p>
            ) : (
              transfers.map(t => (
                <div key={t.id} className="p-2.5 rounded border text-xs flex flex-col gap-1.5" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--panel-border)' }}>
                  <div className="flex justify-between items-center font-medium">
                    <span className="truncate flex-1 pr-2 font-mono text-[11px]">{t.name}</span>
                    <span className={`text-[10px] uppercase font-mono px-1 rounded ${t.type === 'upload' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {t.type === 'upload' ? 'Subir' : 'Bajar'}
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${t.status === 'completed' ? 'bg-emerald-500' : t.status === 'error' ? 'bg-rose-500' : 'bg-amber-500'}`}
                      style={{ width: `${t.progress}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-gray-500 font-mono">
                    <span>{t.status === 'active' ? 'Transfiriendo...' : t.status === 'completed' ? 'Completado' : t.status === 'error' ? 'Error' : 'Pendiente'}</span>
                    <span>{t.progress}%</span>
                  </div>

                  {t.error && <p className="text-[9px] text-rose-400 font-mono mt-1 break-all bg-rose-950/20 p-1 rounded border border-rose-950/40">{t.error}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Folder Creation Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-96 glass-panel p-5 animate-scale-in">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-2 mb-4">
              <FolderPlus className="w-4 h-4" />
              Nueva Carpeta
            </h3>
            
            <input 
              type="text"
              placeholder="Nombre de la carpeta..."
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              className="w-full glass-input mb-4"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
            />
            
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowFolderModal(false)} className="glass-btn text-xs py-1.5 px-3">
                Cancelar
              </button>
              <button onClick={handleCreateFolder} className="glass-btn glass-btn-accent text-xs py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500">
                Crear Carpeta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estilo para que aparezcan las acciones al pasar el ratón (CSS inline rápido para robustez) */}
      <style>{`
        tr:hover .tr-actions-visible {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
