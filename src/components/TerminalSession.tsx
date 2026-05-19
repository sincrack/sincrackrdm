import { useEffect, useRef, useState } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { SearchAddon } from 'xterm-addon-search'
import { FolderOpen, Code, Columns, Play, Square, RotateCw, FileText, RefreshCw, X, Globe, Rows, Terminal as LucideTerminal, Copy, Clipboard, Palette, Search } from 'lucide-react'
import SftpSession from './SftpSession'
import 'xterm/css/xterm.css'

interface TerminalSessionProps {
  sessionId: string;
  connection: any;
  credential: any;
  jumpHost?: any;
  snippets?: any[];
  globalFontSize: number;
  onClose: () => void;
  onOpenSftp?: () => void;
  onUpdateConnection?: (conn: any) => void;
}

const THEMES: Record<string, any> = {
  cyberpunk: {
    background: '#09090d',
    foreground: '#e5e7eb',
    cursor: '#00e5ff',
    selectionBackground: 'rgba(0, 229, 255, 0.3)',
    black: '#1f2937', red: '#ef4444', green: '#10b981', yellow: '#f59e0b',
    blue: '#3b82f6', magenta: '#8b5cf6', cyan: '#00e5ff', white: '#f3f4f6',
    brightBlack: '#4b5563', brightRed: '#f87171', brightGreen: '#34d399', brightYellow: '#fbbf24',
    brightBlue: '#60a5fa', brightMagenta: '#a78bfa', brightCyan: '#67e8f9', brightWhite: '#ffffff',
  },
  matrix: {
    background: '#000000',
    foreground: '#33ff33',
    cursor: '#33ff33',
    selectionBackground: 'rgba(51, 255, 51, 0.3)',
    black: '#000000', red: '#00aa00', green: '#33ff33', yellow: '#aa5500',
    blue: '#0000aa', magenta: '#aa00aa', cyan: '#00aaaa', white: '#aaaaaa',
    brightBlack: '#555555', brightRed: '#ff5555', brightGreen: '#55ff55', brightYellow: '#ffff55',
    brightBlue: '#5555ff', brightMagenta: '#ff55ff', brightCyan: '#55ffff', brightWhite: '#ffffff',
  },
  dracula: {
    background: '#1e1f29',
    foreground: '#f8f8f2',
    cursor: '#f1fa8c',
    selectionBackground: 'rgba(241, 250, 140, 0.3)',
    black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c',
    blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
    brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94', brightYellow: '#ffffa5',
    brightBlue: '#d6acff', brightMagenta: '#ff92df', brightCyan: '#a4ffff', brightWhite: '#ffffff',
  },
  amber: {
    background: '#0a0500',
    foreground: '#ffb000',
    cursor: '#ffb000',
    selectionBackground: 'rgba(255, 176, 0, 0.3)',
    black: '#000000', red: '#ffb000', green: '#ffb000', yellow: '#ffb000',
    blue: '#ffb000', magenta: '#ffb000', cyan: '#ffb000', white: '#ffb000',
    brightBlack: '#ffb000', brightRed: '#ffb000', brightGreen: '#ffb000', brightYellow: '#ffb000',
    brightBlue: '#ffb000', brightMagenta: '#ffb000', brightCyan: '#ffb000', brightWhite: '#ffffff',
  },
  snow: {
    background: '#f6f8fa',
    foreground: '#24292e',
    cursor: '#0969da',
    selectionBackground: 'rgba(9, 105, 218, 0.2)',
    black: '#24292e', red: '#cf222e', green: '#1a7f37', yellow: '#4d2d00',
    blue: '#0969da', magenta: '#8250df', cyan: '#1b7c83', white: '#ffffff',
    brightBlack: '#57606a', brightRed: '#a40e26', brightGreen: '#115e29', brightYellow: '#663600',
    brightBlue: '#0550ae', brightMagenta: '#6639ba', brightCyan: '#023b42', brightWhite: '#eaeef2',
  },
  solarizedLight: {
    background: '#fdf6e3',
    foreground: '#657b83',
    cursor: '#586e75',
    selectionBackground: 'rgba(88, 110, 117, 0.2)',
    black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900',
    blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5',
    brightBlack: '#002b36', brightRed: '#cb4b16', brightGreen: '#586e75', brightYellow: '#657b83',
    brightBlue: '#839496', brightMagenta: '#6c71c4', brightCyan: '#93a1a1', brightWhite: '#fdf6e3',
  }
};

export default function TerminalSession({ 
  sessionId, connection, credential, jumpHost, snippets, 
  globalFontSize, onClose: _onClose, onOpenSftp: _onOpenSftp,
  onUpdateConnection
}: TerminalSessionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [showSnippets, setShowSnippets] = useState(false);
  const [showSftp, setShowSftp] = useState(false);
  const [localFontSize, setLocalFontSize] = useState(globalFontSize || 14);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [activeThemeKey, setActiveThemeKey] = useState<string>(connection.terminalTheme || 'cyberpunk');

  // --- SPLIT SCREEN STATES ---
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const splitTerminalRef = useRef<Terminal | null>(null);
  const splitFitAddonRef = useRef<FitAddon | null>(null);
  const [isSplit, setIsSplit] = useState(false);

  // --- DOCKER PANEL STATES ---
  const [activeView, setActiveView] = useState<'terminal' | 'docker'>('terminal');
  const [dockerContainers, setDockerContainers] = useState<any[]>([]);
  const [dockerLoading, setDockerLoading] = useState(false);
  const [dockerError, setDockerError] = useState<string | null>(null);
  const [selectedLogsContainer, setSelectedLogsContainer] = useState<string | null>(null);
  const [logsContent, setLogsContent] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);

  // --- NOTAS Y BÚSQUEDA ---
  const [showNotes, setShowNotes] = useState(false);
  const [notesText, setNotesText] = useState(connection.notes || '');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const splitSearchAddonRef = useRef<SearchAddon | null>(null);

  // Sincronizar notas si cambian desde fuera
  useEffect(() => {
    if (connection.notes !== undefined) {
      setNotesText(connection.notes || '');
    }
  }, [connection.notes]);

  // --- SPLIT SCREEN LAYOUT CONFIGS ---
  const [splitDirection, setSplitDirection] = useState<'vertical' | 'horizontal'>('vertical');

  // --- CONTEXT MENU FOR COPY & PASTE ---
  const [terminalContextMenu, setTerminalContextMenu] = useState<{ x: number, y: number, isSplitTerminal: boolean, openLeft?: boolean } | null>(null);
  const [showScriptsSubmenu, setShowScriptsSubmenu] = useState(false);

  useEffect(() => {
    const handleOutsideClick = () => {
      setTerminalContextMenu(null);
      setShowScriptsSubmenu(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, isSplitTerminal: boolean) => {
    e.preventDefault();
    const openLeft = e.clientX + 320 > window.innerWidth;
    setTerminalContextMenu({
      x: e.clientX,
      y: e.clientY,
      isSplitTerminal,
      openLeft
    });
    setShowScriptsSubmenu(false);
  };

  const handleCopy = () => {
    const term = terminalContextMenu?.isSplitTerminal ? splitTerminalRef.current : terminalRef.current;
    if (term) {
      const selection = term.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
      }
    }
    setTerminalContextMenu(null);
  };

  const handlePaste = () => {
    const targetSessionId = terminalContextMenu?.isSplitTerminal ? sessionId + '_split' : sessionId;
    navigator.clipboard.readText().then(text => {
      window.ipcRenderer.send('ssh:write', targetSessionId, text);
    });
    setTerminalContextMenu(null);
  };

  const hasSelection = () => {
    const term = terminalContextMenu?.isSplitTerminal ? splitTerminalRef.current : terminalRef.current;
    return term ? !!term.getSelection() : false;
  };

  const handleExecuteSnippet = (command: string) => {
    const targetSessionId = terminalContextMenu?.isSplitTerminal ? sessionId + '_split' : sessionId;
    window.ipcRenderer.send('ssh:write', targetSessionId, command + '\n');
    setTerminalContextMenu(null);
  };

  // --- INTERACTIVE CONTAINER SHELL EXECUTION ---
  const connectDockerConsole = (containerName: string) => {
    setActiveView('terminal');
    const cmd = `docker exec -it ${containerName} /bin/bash || docker exec -it ${containerName} /bin/sh || docker exec -it ${containerName} sh\n`;
    window.ipcRenderer.send('ssh:write', sessionId, cmd);
  };

  // Sincronizar tamaño cuando cambie la propiedad global
  useEffect(() => {
    if (globalFontSize) {
      setLocalFontSize(globalFontSize);
    }
  }, [globalFontSize]);

  // Redimensionar automáticamente al cambiar orientación o activar split
  useEffect(() => {
    setTimeout(() => {
      try {
        if (terminalRef.current && fitAddonRef.current) {
          fitAddonRef.current.fit();
          window.ipcRenderer.send('ssh:resize', sessionId, terminalRef.current.cols, terminalRef.current.rows);
        }
        if (splitTerminalRef.current && splitFitAddonRef.current) {
          splitFitAddonRef.current.fit();
          window.ipcRenderer.send('ssh:resize', sessionId + '_split', splitTerminalRef.current.cols, splitTerminalRef.current.rows);
        }
      } catch (e) {}
    }, 150);
  }, [splitDirection, isSplit]);

  // Aplicar cambios en vivo en la terminal xterm.js principal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.fontSize = localFontSize;
      try {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
          window.ipcRenderer.send('ssh:resize', sessionId, terminalRef.current.cols, terminalRef.current.rows);
        }
      } catch (e) {}
    }
  }, [localFontSize, sessionId]);

  // Aplicar cambios en vivo en la terminal xterm.js dividida
  useEffect(() => {
    if (splitTerminalRef.current) {
      splitTerminalRef.current.options.fontSize = localFontSize;
      try {
        if (splitFitAddonRef.current) {
          splitFitAddonRef.current.fit();
          window.ipcRenderer.send('ssh:resize', sessionId + '_split', splitTerminalRef.current.cols, splitTerminalRef.current.rows);
        }
      } catch (e) {}
    }
  }, [localFontSize, isSplit, sessionId]);

  // Aplicar cambios de tema en vivo
  useEffect(() => {
    const activeTheme = THEMES[activeThemeKey] || THEMES.cyberpunk;
    if (terminalRef.current) {
      terminalRef.current.options.theme = activeTheme;
    }
    if (splitTerminalRef.current) {
      splitTerminalRef.current.options.theme = activeTheme;
    }
  }, [activeThemeKey]);

  // --- BUSCADOR CONTROLADORES ---
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (!query) {
      if (searchAddonRef.current) {
        searchAddonRef.current.findNext('');
      }
      if (splitSearchAddonRef.current) {
        splitSearchAddonRef.current.findNext('');
      }
      return;
    }
    if (searchAddonRef.current) {
      searchAddonRef.current.findNext(query, { incremental: true });
    }
    if (splitSearchAddonRef.current && isSplit) {
      splitSearchAddonRef.current.findNext(query, { incremental: true });
    }
  };

  const handleSearchNext = () => {
    if (!searchQuery) return;
    if (searchAddonRef.current) {
      searchAddonRef.current.findNext(searchQuery);
    }
    if (splitSearchAddonRef.current && isSplit) {
      splitSearchAddonRef.current.findNext(searchQuery);
    }
  };

  const handleSearchPrev = () => {
    if (!searchQuery) return;
    if (searchAddonRef.current) {
      searchAddonRef.current.findPrevious(searchQuery);
    }
    if (splitSearchAddonRef.current && isSplit) {
      splitSearchAddonRef.current.findPrevious(searchQuery);
    }
  };

  // 1. Inicializar Terminal Principal
  useEffect(() => {
    if (!containerRef.current) return;

    const activeTheme = THEMES[connection.terminalTheme || 'cyberpunk'] || THEMES.cyberpunk;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: '"JetBrains Mono", Menlo, Monaco, Consolas, monospace',
      fontSize: localFontSize,
      lineHeight: 1.2,
      theme: activeTheme,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    const searchAddon = new SearchAddon();
    term.loadAddon(searchAddon);
    searchAddonRef.current = searchAddon;

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    term.open(containerRef.current);

    term.attachCustomKeyEventHandler((arg) => {
      if ((arg.ctrlKey || arg.metaKey) && arg.code === 'KeyC' && arg.type === 'keydown') {
        const selection = term.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
          return false;
        }
      }
      if ((arg.ctrlKey || arg.metaKey) && arg.code === 'KeyV' && arg.type === 'keydown') {
        navigator.clipboard.readText().then(text => {
          window.ipcRenderer.send('ssh:write', sessionId, text);
        });
        return false;
      }
      if ((arg.ctrlKey || arg.metaKey) && arg.code === 'KeyF' && arg.type === 'keydown') {
        setShowSearch(prev => {
          const next = !prev;
          if (next) {
            setTimeout(() => {
              document.getElementById('terminal-search-input')?.focus();
            }, 100);
          } else {
            handleSearchChange('');
          }
          return next;
        });
        return false;
      }
      return true;
    });

    term.write('\x1b[36m[SinCracK RDM] Conectando a ' + connection.host + ':' + (connection.port || 22) + '...\x1b[0m\r\n');

    let isMounted = true;

    window.ipcRenderer.invoke('ssh:connect', sessionId, connection, credential, jumpHost)
      .then((res: any) => {
        if (!isMounted) return;
        if (!res.success) {
          term.write('\r\n\x1b[31m[Error de Conexión]: ' + (res.error || 'Desconocido') + '\x1b[0m\r\n');
          return;
        }

        term.write('\x1b[32m[SSH listo] Iniciando shell interactiva...\x1b[0m\r\n\r\n');
        
        const cols = term.cols;
        const rows = term.rows;
        window.ipcRenderer.invoke('ssh:shell-start', sessionId, cols, rows).then((shellRes: any) => {
          if (!isMounted) return;
          if (!shellRes.success) {
            term.write('\x1b[31m[Error de Shell]: ' + shellRes.error + '\x1b[0m\r\n');
          }
        });
      });

    const onDataDisposable = term.onData((data) => {
      if (isMounted) {
        window.ipcRenderer.send('ssh:write', sessionId, data);
      }
    });

    const handleSshData = (_: any, data: string) => {
      term.write(data);
    };

    const handleSshClosed = () => {
      term.write('\r\n\x1b[31m[Conexión SSH terminada por el servidor remoto]\x1b[0m\r\n');
    };

    window.ipcRenderer.on(`ssh:data:${sessionId}`, handleSshData);
    window.ipcRenderer.on(`ssh:closed:${sessionId}`, handleSshClosed);

    const resizeObserver = new ResizeObserver(() => {
      try {
        if (containerRef.current && containerRef.current.clientWidth > 0) {
          fitAddon.fit();
          window.ipcRenderer.send('ssh:resize', sessionId, term.cols, term.rows);
        }
      } catch (e) {}
    });
    resizeObserver.observe(containerRef.current);

    setTimeout(() => {
      try {
        fitAddon.fit();
        window.ipcRenderer.send('ssh:resize', sessionId, term.cols, term.rows);
      } catch {}
    }, 200);

    return () => {
      isMounted = false;
      onDataDisposable.dispose();
      window.ipcRenderer.off(`ssh:data:${sessionId}`, handleSshData);
      window.ipcRenderer.off(`ssh:closed:${sessionId}`, handleSshClosed);
      resizeObserver.disconnect();
      window.ipcRenderer.invoke('ssh:disconnect', sessionId);
      term.dispose();
    };
  }, [sessionId]);

  // 2. Inicializar Terminal Dividida (Split Screen)
  useEffect(() => {
    if (!isSplit) {
      if (splitTerminalRef.current) {
        splitTerminalRef.current.dispose();
        splitTerminalRef.current = null;
      }
      window.ipcRenderer.invoke('ssh:disconnect', sessionId + '_split');
      return;
    }

    if (!splitContainerRef.current) return;

    const activeTheme = THEMES[connection.terminalTheme || 'cyberpunk'] || THEMES.cyberpunk;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: '"JetBrains Mono", Menlo, Monaco, Consolas, monospace',
      fontSize: localFontSize,
      lineHeight: 1.2,
      theme: activeTheme,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    const searchAddon = new SearchAddon();
    term.loadAddon(searchAddon);
    splitSearchAddonRef.current = searchAddon;

    splitTerminalRef.current = term;
    splitFitAddonRef.current = fitAddon;

    term.open(splitContainerRef.current);

    const splitSessionId = sessionId + '_split';

    term.attachCustomKeyEventHandler((arg) => {
      if ((arg.ctrlKey || arg.metaKey) && arg.code === 'KeyC' && arg.type === 'keydown') {
        const selection = term.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
          return false;
        }
      }
      if ((arg.ctrlKey || arg.metaKey) && arg.code === 'KeyV' && arg.type === 'keydown') {
        navigator.clipboard.readText().then(text => {
          window.ipcRenderer.send('ssh:write', splitSessionId, text);
        });
        return false;
      }
      if ((arg.ctrlKey || arg.metaKey) && arg.code === 'KeyF' && arg.type === 'keydown') {
        setShowSearch(prev => {
          const next = !prev;
          if (next) {
            setTimeout(() => {
              document.getElementById('terminal-search-input')?.focus();
            }, 100);
          } else {
            handleSearchChange('');
          }
          return next;
        });
        return false;
      }
      return true;
    });

    term.write('\x1b[36m[Dividido] Conectando consola paralela...\x1b[0m\r\n');

    let isMounted = true;

    window.ipcRenderer.invoke('ssh:connect', splitSessionId, connection, credential, jumpHost)
      .then((res: any) => {
        if (!isMounted) return;
        if (!res.success) {
          term.write('\r\n\x1b[31m[Error de Conexión]: ' + (res.error || 'Desconocido') + '\x1b[0m\r\n');
          return;
        }

        term.write('\x1b[32m[SSH listo] Iniciando shell dividida...\x1b[0m\r\n\r\n');
        
        const cols = term.cols;
        const rows = term.rows;
        window.ipcRenderer.invoke('ssh:shell-start', splitSessionId, cols, rows).then((shellRes: any) => {
          if (!isMounted) return;
          if (!shellRes.success) {
            term.write('\x1b[31m[Error de Shell]: ' + shellRes.error + '\x1b[0m\r\n');
          }
        });
      });

    const onDataDisposable = term.onData((data) => {
      if (isMounted) {
        window.ipcRenderer.send('ssh:write', splitSessionId, data);
      }
    });

    const handleSshData = (_: any, data: string) => {
      term.write(data);
    };

    const handleSshClosed = () => {
      term.write('\r\n\x1b[31m[Conexión dividida terminada]\x1b[0m\r\n');
    };

    window.ipcRenderer.on(`ssh:data:${splitSessionId}`, handleSshData);
    window.ipcRenderer.on(`ssh:closed:${splitSessionId}`, handleSshClosed);

    const resizeObserver = new ResizeObserver(() => {
      try {
        if (splitContainerRef.current && splitContainerRef.current.clientWidth > 0) {
          fitAddon.fit();
          window.ipcRenderer.send('ssh:resize', splitSessionId, term.cols, term.rows);
        }
      } catch (e) {}
    });
    resizeObserver.observe(splitContainerRef.current);

    setTimeout(() => {
      try {
        fitAddon.fit();
        window.ipcRenderer.send('ssh:resize', splitSessionId, term.cols, term.rows);
      } catch {}
    }, 200);

    return () => {
      isMounted = false;
      onDataDisposable.dispose();
      window.ipcRenderer.off(`ssh:data:${splitSessionId}`, handleSshData);
      window.ipcRenderer.off(`ssh:closed:${splitSessionId}`, handleSshClosed);
      resizeObserver.disconnect();
      window.ipcRenderer.invoke('ssh:disconnect', splitSessionId);
      term.dispose();
      splitTerminalRef.current = null;
    };
  }, [isSplit, sessionId]);

  // --- DOCKER API CALLS ---
  const fetchDockerContainers = async () => {
    setDockerLoading(true);
    setDockerError(null);
    try {
      const cmd = `docker ps -a --format '{"id":"{{.ID}}","name":"{{.Names}}","state":"{{.State}}","status":"{{.Status}}","image":"{{.Image}}"}'`;
      const res = await window.ipcRenderer.invoke('ssh:exec', sessionId, cmd);
      
      if (!res.success) {
        throw new Error(res.error || 'Error al ejecutar comando.');
      }

      if (res.code !== 0 || res.stderr.toLowerCase().includes('command not found') || res.stderr.toLowerCase().includes('permission denied')) {
        setDockerError('Docker no detectado en este servidor o el usuario no tiene permisos. Asegúrate de instalar docker y agregar tu usuario al grupo docker (`sudo usermod -aG docker $USER`).');
        setDockerContainers([]);
        return;
      }

      const lines = res.stdout.trim().split('\n').filter(Boolean);
      const list = lines.map((l: string) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      }).filter(Boolean);

      setDockerContainers(list);
    } catch (err: any) {
      setDockerError(err.message || 'Error desconocido al conectar con Docker.');
    } finally {
      setDockerLoading(false);
    }
  };

  const runDockerAction = async (containerName: string, action: 'start' | 'stop' | 'restart') => {
    setDockerLoading(true);
    try {
      const res = await window.ipcRenderer.invoke('ssh:exec', sessionId, `docker ${action} ${containerName}`);
      if (!res.success || res.code !== 0) {
        alert(`❌ Error al ejecutar docker ${action}: ${res.stderr || res.error || 'Error desconocido'}`);
      }
      await fetchDockerContainers();
    } catch (err: any) {
      alert(`❌ Error al ejecutar acción: ${err.message}`);
      setDockerLoading(false);
    }
  };

  const viewDockerLogs = async (containerName: string) => {
    setSelectedLogsContainer(containerName);
    setLogsContent('');
    setLogsLoading(true);
    try {
      const res = await window.ipcRenderer.invoke('ssh:exec', sessionId, `docker logs --tail 100 ${containerName}`);
      if (res.success) {
        setLogsContent(res.stdout || res.stderr || 'No hay logs disponibles para este contenedor.');
      } else {
        setLogsContent(`❌ Error al obtener logs: ${res.error}`);
      }
    } catch (err: any) {
      setLogsContent(`❌ Error al obtener logs: ${err.message}`);
    } finally {
      setLogsLoading(false);
    }
  };

  // Cargar contenedores al abrir la pestaña Docker
  useEffect(() => {
    if (activeView === 'docker') {
      fetchDockerContainers();
    }
  }, [activeView]);

  return (
    <div className="w-full h-full flex gap-3 relative select-none">
      
      {/* PANEL PRINCIPAL */}
      {activeView === 'terminal' ? (
        <div 
          className="flex-1 h-full min-w-0 flex flex-col p-2 rounded-lg border relative transition-colors duration-200"
          style={{ 
            backgroundColor: THEMES[activeThemeKey]?.background || '#050507',
            borderColor: activeThemeKey === 'snow' || activeThemeKey === 'solarizedLight' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)'
          }}
        >
          
          {/* Cabecera Flotante de la Terminal (Ultra Compacta) */}
          <div className="absolute top-2 right-4 flex items-center gap-1.5 z-10 select-none backdrop-blur-md p-1 rounded-lg shadow-lg shadow-black/30 border animate-fade-in" style={{ backgroundColor: 'rgba(16, 16, 20, 0.9)', borderColor: 'rgba(255, 255, 255, 0.08)' }}>
            
            {/* PANEL DOCKER TOGGLE */}
            <button
              onClick={() => setActiveView('docker')}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-all hover:scale-105 active:scale-95 border"
              style={{ backgroundColor: 'rgba(6, 182, 212, 0.15)', borderColor: 'rgba(6, 182, 212, 0.3)', color: '#22d3ee' }}
              title="Panel de Control Docker"
            >
              <Globe className="w-3.5 h-3.5 animate-pulse" style={{ color: '#22d3ee' }} />
            </button>

            {/* SPLIT SCREEN TOGGLE */}
            <button
              onClick={() => setIsSplit(!isSplit)}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-all hover:scale-105 active:scale-95 border"
              style={{
                backgroundColor: isSplit ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                borderColor: isSplit ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                color: isSplit ? '#fbbf24' : '#d1d5db'
              }}
              title={isSplit ? 'Quitar División de Pantalla' : 'Dividir Pantalla SSH'}
            >
              <Columns className="w-3.5 h-3.5" />
            </button>

            {/* TOGGLE SPLIT DIRECTION */}
            {isSplit && (
              <button
                onClick={() => setSplitDirection(prev => prev === 'vertical' ? 'horizontal' : 'vertical')}
                className="flex items-center justify-center w-7 h-7 rounded-md transition-all hover:scale-105 active:scale-95 border"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)', color: '#fbbf24' }}
                title={splitDirection === 'vertical' ? 'Cambiar a División Horizontal (Filas)' : 'Cambiar a División Vertical (Columnas)'}
              >
                {splitDirection === 'vertical' ? <Rows className="w-3.5 h-3.5" /> : <Columns className="w-3.5 h-3.5 rotate-90" />}
              </button>
            )}

            {/* SELECTOR DE TEMA DENTRO DE LA TERMINAL */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowThemeSelector(!showThemeSelector);
                  setShowSnippets(false);
                }}
                className="flex items-center justify-center w-7 h-7 rounded-md transition-all hover:scale-105 active:scale-95 border"
                style={{
                  backgroundColor: showThemeSelector ? 'rgba(167, 139, 250, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  borderColor: showThemeSelector ? 'rgba(167, 139, 250, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                  color: showThemeSelector ? '#c084fc' : '#d1d5db'
                }}
                title="Cambiar Tema de Terminal"
              >
                <Palette className="w-3.5 h-3.5" />
              </button>

              {showThemeSelector && (
                <div 
                  className="absolute right-0 mt-1.5 w-40 rounded-lg p-2 shadow-2xl backdrop-blur-md animate-scale-in flex flex-col gap-1 z-[20] border text-xs" 
                  style={{ backgroundColor: 'rgba(16, 16, 20, 0.96)', borderColor: 'rgba(255, 255, 255, 0.12)' }}
                >
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-1 px-1 border-b pb-1 flex justify-between items-center" style={{ color: '#9ca3af', borderBottomColor: 'rgba(255, 255, 255, 0.08)' }}>
                    <span>Temas SSH</span>
                    <button onClick={() => setShowThemeSelector(false)} style={{ color: '#6b7280' }} className="hover:text-white">✕</button>
                  </div>
                  {Object.keys(THEMES).map(themeName => (
                    <button
                      key={themeName}
                      onClick={() => {
                        setActiveThemeKey(themeName);
                        setShowThemeSelector(false);
                      }}
                      className={`w-full text-left px-2 py-1 rounded text-[11px] font-medium transition-colors flex items-center justify-between ${
                        activeThemeKey === themeName 
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                          : 'hover:bg-white/5 text-gray-300'
                      }`}
                    >
                      <span className="capitalize">{themeName}</span>
                      <span 
                        className="w-2.5 h-2.5 rounded-full border border-black/50" 
                        style={{ backgroundColor: THEMES[themeName].cursor }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {snippets && snippets.length > 0 && (
              <div className="relative">
                <button 
                  onClick={() => {
                    setShowSnippets(!showSnippets);
                    setShowThemeSelector(false);
                  }}
                  className="flex items-center justify-center w-7 h-7 rounded-md transition-all hover:scale-105 active:scale-95 border relative"
                  style={{
                    backgroundColor: showSnippets ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    borderColor: showSnippets ? 'rgba(6, 182, 212, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                    color: showSnippets ? '#22d3ee' : '#d1d5db'
                  }}
                  title={`Scripts Guardados (${snippets.length})`}
                >
                  <Code className="w-3.5 h-3.5" />
                  <span className="absolute -top-1 -right-1 bg-cyan-500 text-black text-[7px] font-extrabold px-1 rounded-full border border-black min-w-[10px] text-center select-none">
                    {snippets.length}
                  </span>
                </button>

                {showSnippets && (
                  <div className="absolute right-0 mt-1.5 w-60 rounded-lg p-2 shadow-2xl backdrop-blur-md animate-scale-in flex flex-col gap-1 z-[20] border" style={{ backgroundColor: 'rgba(16, 16, 20, 0.96)', borderColor: 'rgba(255, 255, 255, 0.12)' }}>
                    <div className="text-[9px] font-bold uppercase tracking-wider mb-1 px-1 border-b pb-1 flex justify-between items-center" style={{ color: '#9ca3af', borderBottomColor: 'rgba(255, 255, 255, 0.08)' }}>
                      <span>Scripts Rápidos</span>
                      <button onClick={() => setShowSnippets(false)} style={{ color: '#6b7280' }} className="hover:text-white">✕</button>
                    </div>
                    <div className="max-h-48 overflow-y-auto flex flex-col gap-1 pr-0.5 scrollbar-thin">
                      {snippets.map(snip => (
                        <button
                          key={snip.id}
                          onClick={() => {
                            window.ipcRenderer.send('ssh:write', sessionId, snip.command + '\n');
                            if (isSplit) {
                              window.ipcRenderer.send('ssh:write', sessionId + '_split', snip.command + '\n');
                            }
                            setShowSnippets(false);
                          }}
                          className="w-full text-left p-1.5 rounded hover:bg-cyan-500/10 hover:text-cyan-400 text-[11px] font-mono transition-colors flex flex-col gap-0.5"
                          style={{ color: '#d1d5db' }}
                        >
                          <strong className="text-[10px] font-sans block" style={{ color: '#ffffff' }}>{snip.name}</strong>
                          <span className="truncate opacity-80 block" style={{ color: '#9ca3af' }}>{snip.command}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button 
              onClick={() => setShowSftp(!showSftp)}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-all hover:scale-105 active:scale-95 border"
              style={{
                backgroundColor: showSftp ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                borderColor: showSftp ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)',
                color: '#34d399'
              }}
              title={showSftp ? 'Cerrar SFTP' : 'Explorar SFTP'}
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>

            {/* Botón de Bloc de Notas */}
            <button 
              onClick={() => {
                setShowNotes(!showNotes);
              }}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-all hover:scale-105 active:scale-95 border"
              style={{
                backgroundColor: showNotes ? 'rgba(34, 211, 238, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                borderColor: showNotes ? 'rgba(34, 211, 238, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                color: showNotes ? '#22d3ee' : '#d1d5db'
              }}
              title={showNotes ? 'Cerrar Notas del Servidor' : 'Ver Notas del Servidor'}
            >
              <FileText className="w-3.5 h-3.5" />
            </button>

            {/* Botón de Buscar en Terminal */}
            <button 
              onClick={() => {
                setShowSearch(!showSearch);
                if (!showSearch) {
                  setTimeout(() => {
                    document.getElementById('terminal-search-input')?.focus();
                  }, 100);
                } else {
                  handleSearchChange('');
                }
              }}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-all hover:scale-105 active:scale-95 border"
              style={{
                backgroundColor: showSearch ? 'rgba(167, 139, 250, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                borderColor: showSearch ? 'rgba(167, 139, 250, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                color: showSearch ? '#c084fc' : '#d1d5db'
              }}
              title="Buscar en Terminal (Ctrl + F)"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Zoom de Fuente */}
            <div className="flex items-center border rounded-md p-0.5 select-none h-7" style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)', borderColor: 'rgba(255, 255, 255, 0.08)' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); setLocalFontSize(prev => Math.max(10, prev - 1)); }}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-[10px] font-bold"
                style={{ color: '#9ca3af' }}
                title="Reducir Fuente"
              >
                -
              </button>
              <span className="px-1 text-[8px] font-mono font-semibold select-none" style={{ color: '#6b7280' }}>{localFontSize}px</span>
              <button 
                onClick={(e) => { e.stopPropagation(); setLocalFontSize(prev => Math.min(24, prev + 1)); }}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-[10px] font-bold"
                style={{ color: '#9ca3af' }}
                title="Aumentar Fuente"
              >
                +
              </button>
            </div>

            <div className="flex items-center justify-center w-7 h-7 rounded-md border" style={{ backgroundColor: 'rgba(6, 182, 212, 0.15)', borderColor: 'rgba(6, 182, 212, 0.2)' }} title="Sesión SSH Conectada y Activa">
              <span className="flex h-1.5 w-1.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500"></span>
              </span>
            </div>
          </div>

          {/* BARRA DE BÚSQUEDA FLOTANTE / INTEGRADA */}
          {showSearch && (
            <div className="absolute top-12 right-4 z-20 flex items-center gap-2 p-1.5 rounded-lg shadow-2xl border animate-scale-in text-xs" style={{ backgroundColor: 'rgba(16, 16, 20, 0.95)', borderColor: 'rgba(255, 255, 255, 0.12)' }}>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/40 border border-white/10">
                <Search className="w-3.5 h-3.5 text-gray-400" />
                <input 
                  id="terminal-search-input"
                  type="text"
                  placeholder="Buscar texto..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (e.shiftKey) {
                        handleSearchPrev();
                      } else {
                        handleSearchNext();
                      }
                    } else if (e.key === 'Escape') {
                      setShowSearch(false);
                      handleSearchChange('');
                    }
                  }}
                  className="bg-transparent border-none outline-none text-white text-[11px] w-40 font-sans"
                  autoFocus
                />
              </div>
              <button 
                onClick={handleSearchPrev} 
                className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white"
                title="Anterior (Shift+Enter)"
              >
                ▲
              </button>
              <button 
                onClick={handleSearchNext} 
                className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white"
                title="Siguiente (Enter)"
              >
                ▼
              </button>
              <div className="w-[1px] h-4 bg-white/10 mx-1" />
              <button 
                onClick={() => {
                  setShowSearch(false);
                  handleSearchChange('');
                }} 
                className="p-1.5 rounded hover:bg-rose-500/20 text-gray-400 hover:text-rose-400"
              >
                ✕
              </button>
            </div>
          )}

          {/* CONTENEDOR DE TERMINALES Y NOTAS */}
          <div className="flex-1 w-full h-full flex gap-3 min-h-0 pt-8">
            {/* ÁREA DE TERMINALES DE VISTA DIVIDIDA */}
            <div className={`flex-1 h-full flex gap-2 min-h-0 ${splitDirection === 'horizontal' ? 'flex-col' : 'flex-row'}`}>
              <div 
                ref={containerRef} 
                onContextMenu={(e) => handleContextMenu(e, false)} 
                className="flex-1 h-full min-w-0 rounded-md overflow-hidden relative" 
              />
              
              {isSplit && (
                splitDirection === 'horizontal' ? (
                  <div 
                    className="h-[1.5px] self-stretch mx-2 shrink-0 select-none" 
                    style={{ backgroundColor: activeThemeKey === 'snow' || activeThemeKey === 'solarizedLight' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)' }}
                  />
                ) : (
                  <div 
                    className="w-[1.5px] self-stretch my-2 shrink-0 select-none" 
                    style={{ backgroundColor: activeThemeKey === 'snow' || activeThemeKey === 'solarizedLight' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)' }}
                  />
                )
              )}
              
              {isSplit && (
                <div 
                  ref={splitContainerRef} 
                  onContextMenu={(e) => handleContextMenu(e, true)} 
                  className="flex-1 h-full min-w-0 rounded-md overflow-hidden relative animate-scale-in" 
                />
              )}
            </div>

            {/* BLOC DE NOTAS LATERAL */}
            {showNotes && (
              <div 
                className="w-80 h-full border-l pl-3 flex flex-col min-w-0 animate-slide-in relative z-[15]"
                style={{ borderColor: activeThemeKey === 'snow' || activeThemeKey === 'solarizedLight' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)' }}
              >
                {/* Notes header */}
                <div 
                  className="flex items-center justify-between pb-2 mb-2 border-b select-none pt-1"
                  style={{ borderBottomColor: activeThemeKey === 'snow' || activeThemeKey === 'solarizedLight' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)' }}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 uppercase">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Notas del Servidor</span>
                  </div>
                  <button 
                    onClick={() => setShowNotes(false)} 
                    className="p-1 rounded hover:bg-white/5 text-gray-400 hover:text-white text-[10px]"
                  >
                    ✕
                  </button>
                </div>

                {/* Notes textarea */}
                <textarea
                  className="flex-1 w-full glass-input p-2.5 text-xs text-white placeholder-gray-600 outline-none font-mono resize-none scrollbar-thin"
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="Escribe comandos rápidos, IPs, notas de mantenimiento, etc. de este servidor..."
                />

                {/* Notes footer */}
                <div 
                  className="flex justify-end gap-2 mt-2 pt-2 border-t select-none"
                  style={{ borderTopColor: activeThemeKey === 'snow' || activeThemeKey === 'solarizedLight' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)' }}
                >
                  <button 
                    onClick={() => {
                      if (onUpdateConnection) {
                        onUpdateConnection({
                          ...connection,
                          notes: notesText
                        });
                      }
                    }}
                    className="glass-btn glass-btn-accent py-1 px-3 text-[10px] bg-cyan-600 hover:bg-cyan-500 font-bold uppercase tracking-wider"
                  >
                    Guardar Notas
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ================= DOCKER CONTAINER DASHBOARD ================= */
        <div className="flex-1 h-full min-w-0 flex flex-col p-4 rounded-lg border relative overflow-hidden select-none" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--panel-border)' }}>
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <Globe className="w-5 h-5 text-cyan-400 animate-pulse" />
              <div className="flex flex-col">
                <h2 className="text-sm font-bold text-white tracking-wide">Gestión de Contenedores Docker</h2>
                <span className="text-[10px] text-gray-500 font-mono">Servidor: {connection.host} • Activos: {dockerContainers.filter(c => c.state === 'running').length}/{dockerContainers.length}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={fetchDockerContainers}
                disabled={dockerLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 select-none"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${dockerLoading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>

              <button 
                onClick={() => setActiveView('terminal')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-wider transition-colors select-none"
              >
                <X className="w-3.5 h-3.5" />
                Cerrar Panel
              </button>
            </div>
          </div>

          {/* Contenido / Cargador / Error */}
          <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
            {dockerLoading && dockerContainers.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-xs text-gray-500 font-mono">
                <RefreshCw className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
                Consultando contenedores Docker en el host remoto...
              </div>
            ) : dockerError ? (
              <div className="m-4 p-4 rounded-lg bg-rose-500/5 border border-rose-500/20 flex flex-col gap-2 max-w-2xl mx-auto">
                <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase">
                  <span>⚠️ Advertencia de Entorno</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed font-sans">{dockerError}</p>
                <button
                  onClick={fetchDockerContainers}
                  className="w-fit mt-2 glass-btn bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20 px-3 py-1.5 text-[9px] font-bold uppercase"
                >
                  Reintentar Conexión
                </button>
              </div>
            ) : dockerContainers.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-xs text-gray-500 font-sans italic">
                No se encontraron contenedores en este servidor.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 p-1">
                {dockerContainers.map(container => {
                  const isRunning = container.state === 'running';
                  const isExited = container.state === 'exited' || container.state === 'stopped';
                  
                  return (
                    <div 
                      key={container.id} 
                      className={`glass-panel border rounded-xl p-3 flex flex-col justify-between gap-4 transition-all duration-200 hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/[0.02] ${isRunning ? 'border-cyan-500/10 bg-cyan-950/[0.01]' : 'border-white/5 bg-white/[0.01]'}`}
                    >
                      {/* Cabecera de Tarjeta */}
                      <div className="flex items-start justify-between min-w-0 gap-2">
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-white truncate font-sans tracking-wide">{container.name}</span>
                          <span className="text-[9px] text-gray-500 truncate font-mono mt-0.5">{container.image}</span>
                        </div>

                        {/* LED de estado */}
                        <div className="flex items-center gap-1.5 shrink-0 select-none">
                          <span className="flex h-2 w-2 relative">
                            {isRunning && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            )}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${isRunning ? 'bg-emerald-500' : isExited ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
                          </span>
                          <span className={`text-[8px] font-bold uppercase tracking-wider font-mono ${isRunning ? 'text-emerald-400' : isExited ? 'text-rose-400' : 'text-amber-400'}`}>{container.state}</span>
                        </div>
                      </div>

                      {/* Detalles Status */}
                      <div className="text-[10px] text-gray-400 font-mono bg-black/40 border border-white/5 rounded-md px-2 py-1 truncate">
                        {container.status}
                      </div>

                      {/* Botones de Acción */}
                      <div className="flex items-center justify-between border-t border-white/5 pt-2.5 mt-1 select-none">
                        
                        {/* Control Start/Stop */}
                        <div className="flex items-center gap-1.5">
                          {isRunning ? (
                            <button
                              onClick={() => runDockerAction(container.name, 'stop')}
                              className="p-1.5 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/25 text-rose-400 transition-all active:scale-95"
                              title="Detener Contenedor"
                            >
                              <Square className="w-3 h-3 fill-rose-400/20" />
                            </button>
                          ) : (
                            <button
                              onClick={() => runDockerAction(container.name, 'start')}
                              className="p-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/25 text-emerald-400 transition-all active:scale-95"
                              title="Iniciar Contenedor"
                            >
                              <Play className="w-3 h-3 fill-emerald-400/20" />
                            </button>
                          )}

                          <button
                            onClick={() => runDockerAction(container.name, 'restart')}
                            className="p-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/25 text-cyan-400 transition-all active:scale-95"
                            title="Reiniciar Contenedor"
                          >
                            <RotateCw className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Interactive Console and Logs buttons */}
                        <div className="flex items-center gap-1.5">
                          {isRunning && (
                            <button
                              onClick={() => connectDockerConsole(container.name)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-cyan-500/20 hover:border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 text-cyan-400 text-[9px] font-bold uppercase transition-colors"
                              title="Conectar Consola Interactiva al Contenedor"
                            >
                              <LucideTerminal className="w-3 h-3 text-cyan-400" />
                              Consola
                            </button>
                          )}

                          <button
                            onClick={() => viewDockerLogs(container.name)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-gray-300 text-[9px] font-bold uppercase transition-colors"
                            title="Ver Logs Recientes"
                          >
                            <FileText className="w-3 h-3 text-cyan-400" />
                            Ver Logs
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PANEL SFTP DERECHO INLINE */}
      {showSftp && activeView === 'terminal' && (
        <div className="w-[500px] h-full border rounded-lg flex flex-col min-w-0 relative animate-slide-in shadow-2xl glass-panel" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--panel-border)' }}>
          <div className="flex-1 min-h-0">
            <SftpSession 
              sessionId={sessionId + '_inline_sftp'}
              connection={connection}
              credential={credential}
              jumpHost={jumpHost}
            />
          </div>
        </div>
      )}

      {/* ================= DOCKER LOGS MODAL ================= */}
      {selectedLogsContainer && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/75 backdrop-blur-sm select-none"
          onClick={() => setSelectedLogsContainer(null)}
        >
          <div 
            className="w-[750px] max-h-[500px] border shadow-2xl flex flex-col overflow-hidden animate-scale-in rounded-xl"
            style={{ backgroundColor: '#09090d', borderColor: 'rgba(255, 255, 255, 0.12)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header logs */}
            <div className="flex items-center justify-between border-b px-4 py-3 bg-black/40" style={{ borderBottomColor: 'rgba(255, 255, 255, 0.08)' }}>
              <div className="flex items-center gap-2 font-sans text-xs font-bold" style={{ color: '#ffffff' }}>
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>Logs: {selectedLogsContainer} (Últimas 100 líneas)</span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => viewDockerLogs(selectedLogsContainer)}
                  disabled={logsLoading}
                  className="p-1 rounded hover:bg-white/5 transition-colors"
                  style={{ color: '#9ca3af' }}
                  title="Refrescar logs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
                </button>
                <button 
                  onClick={() => setSelectedLogsContainer(null)}
                  className="p-1 rounded hover:bg-rose-500/20 transition-colors"
                  style={{ color: '#9ca3af' }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Logs Area */}
            <div className="flex-1 bg-[#040406] p-4 overflow-y-auto scrollbar-thin max-h-[400px]">
              {logsLoading ? (
                <div className="h-48 flex flex-col items-center justify-center text-xs text-gray-500 font-mono">
                  <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mb-2" />
                  Obteniendo logs en vivo...
                </div>
              ) : (
                <pre className="text-[10px] font-mono leading-relaxed whitespace-pre-wrap select-text selection:bg-cyan-500/30 selection:text-white" style={{ color: '#e5e7eb' }}>
                  {logsContent}
                </pre>
              )}
            </div>
            
            {/* Footer hints */}
            <div className="px-4 py-2 border-t flex justify-end text-[9px] font-mono uppercase font-bold tracking-wider" style={{ borderTopColor: 'rgba(255, 255, 255, 0.05)', backgroundColor: 'rgba(255, 255, 255, 0.01)', color: '#6b7280' }}>
              <span>Haga click fuera para cerrar</span>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM TERMINAL CONTEXT MENU */}
      {terminalContextMenu && (
        <div 
          style={{ top: terminalContextMenu.y, left: terminalContextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-[9999] w-36 context-menu shadow-2xl rounded-lg p-1 flex flex-col gap-0.5 animate-scale-in text-[11px] select-none"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            onMouseEnter={() => setShowScriptsSubmenu(false)}
            disabled={!hasSelection()}
            className="w-full text-left px-2.5 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-main)] hover-cyan flex items-center gap-2 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Copy className="w-3.5 h-3.5 text-gray-500" />
            Copiar
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePaste();
            }}
            onMouseEnter={() => setShowScriptsSubmenu(false)}
            className="w-full text-left px-2.5 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-main)] hover-cyan flex items-center gap-2"
          >
            <Clipboard className="w-3.5 h-3.5 text-gray-500" />
            Pegar
          </button>

          {snippets && snippets.length > 0 && (
            <div 
              className="relative"
              onMouseLeave={() => setShowScriptsSubmenu(false)}
            >
              <button
                onMouseEnter={() => setShowScriptsSubmenu(true)}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowScriptsSubmenu(!showScriptsSubmenu);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-main)] hover-cyan flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Code className="w-3.5 h-3.5 text-gray-500" />
                  <span>Scripts</span>
                </div>
                <span className="text-[8px] text-gray-400 font-bold">▶</span>
              </button>

              {showScriptsSubmenu && (
                <div 
                  className={`absolute ${terminalContextMenu.openLeft ? 'right-full pr-1.5' : 'left-full pl-1.5'} top-0 w-48 select-none`}
                  style={{ marginTop: '-4px' }}
                >
                  <div className="context-menu shadow-2xl rounded-lg p-1 flex flex-col gap-0.5 animate-scale-in text-[11px] max-h-48 overflow-y-auto scrollbar-thin">
                    {snippets.map(snip => (
                      <button
                        key={snip.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExecuteSnippet(snip.command);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-main)] hover-cyan truncate font-mono text-[10px]"
                        title={snip.command}
                      >
                        {snip.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
