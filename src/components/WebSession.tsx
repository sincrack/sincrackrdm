import React, { useState, useRef, useEffect } from 'react'
import { ArrowLeft, ArrowRight, RefreshCw, Globe, ExternalLink } from 'lucide-react'

interface WebSessionProps {
  connection: any;
}

export default function WebSession({ connection }: WebSessionProps) {
  const [url, setUrl] = useState(connection.url || 'https://google.com');
  const [inputUrl, setInputUrl] = useState(connection.url || 'https://google.com');
  const webviewRef = useRef<any>(null);

  const handleNavigate = () => {
    let targetUrl = inputUrl.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'http://' + targetUrl;
    }
    setUrl(targetUrl);
    setInputUrl(targetUrl);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNavigate();
    }
  };

  const goBack = () => {
    if (webviewRef.current?.canGoBack()) {
      webviewRef.current.goBack();
    }
  };

  const goForward = () => {
    if (webviewRef.current?.canGoForward()) {
      webviewRef.current.goForward();
    }
  };

  const reload = () => {
    webviewRef.current?.reload();
  };

  const openExternal = () => {
    window.ipcRenderer.invoke('window:open-external', url, connection.name);
  };

  // Escuchar cambios de navegación en la webview para actualizar la barra de direcciones
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleLoadCommit = (e: any) => {
      if (e.isMainFrame) {
        setInputUrl(e.url);
        setUrl(e.url);
      }
    };

    webview.addEventListener('load-commit', handleLoadCommit);
    return () => {
      webview.removeEventListener('load-commit', handleLoadCommit);
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col bg-[#08080b] border border-white/5 rounded-lg overflow-hidden">
      
      {/* Browser Controls */}
      <div className="p-2 border-b border-white/5 bg-white/[0.01] flex items-center gap-2">
        <div className="flex items-center gap-0.5">
          <button 
            onClick={goBack} 
            className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            title="Atrás"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button 
            onClick={goForward} 
            className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            title="Adelante"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button 
            onClick={reload} 
            className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            title="Recargar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Address Input */}
        <div className="flex-1 relative flex items-center">
          <Globe className="w-4 h-4 absolute left-3 text-gray-500" />
          <input 
            type="text"
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Introduce una dirección web..."
            className="w-full bg-black/40 border border-white/5 rounded-lg pl-9 pr-20 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-500/50 transition-colors font-mono"
          />
          <button 
            onClick={handleNavigate}
            className="absolute right-2 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 text-[10px] uppercase font-mono tracking-wider font-semibold transition-colors"
          >
            Ir
          </button>
        </div>

        {/* Action Buttons */}
        <button 
          onClick={openExternal}
          className="glass-btn py-1.5 px-3 text-xs bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20"
          title="Abrir en ventana externa independiente"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Pop-out
        </button>
      </div>

      {/* Web Rendering Panel */}
      <div className="flex-1 bg-white relative">
        {/* Usamos tag <webview> de Electron */}
        <webview 
          ref={webviewRef}
          src={url} 
          style={{ width: '100%', height: '100%', border: 'none' }}
          allowpopups={true}
        />
      </div>
    </div>
  );
}
