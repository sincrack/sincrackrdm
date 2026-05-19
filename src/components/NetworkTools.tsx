import { useState, useEffect, useRef } from 'react'
import { 
  Radio, Play, Square, Loader2, Compass, 
  CheckCircle2, Key, FileKey, Cpu, RefreshCw, Copy, Check, Download, Info,
  ShieldCheck, Globe, Eye, EyeOff, Calendar, ShieldAlert, Server, Power
} from 'lucide-react'

interface NetworkToolsProps {
  activeSubTool: 'network' | 'password' | 'sshkey' | 'sysinfo' | 'certificate' | 'sslcheck' | 'wol';
  onChangeSubTool: (tool: 'network' | 'password' | 'sshkey' | 'sysinfo' | 'certificate' | 'sslcheck' | 'wol') => void;
}

export default function NetworkTools({ activeSubTool, onChangeSubTool: _onChangeSubTool }: NetworkToolsProps) {
  // ==========================================
  // --- SUBHERRAMIENTA 1: DIAGNÓSTICO DE RED ---
  // ==========================================
  const [activeTool, setActiveTool] = useState<'ping' | 'scanner'>('ping');

  // --- ESTADOS PING ---
  const [pingHost, setPingHost] = useState('1.1.1.1');
  const [pingRunning, setPingRunning] = useState(false);
  const [pingOutput, setPingOutput] = useState<string[]>([]);
  const [currentLatency, setCurrentLatency] = useState<number | null>(null);
  const [pingId, setPingId] = useState('');
  const pingOutputRef = useRef<HTMLDivElement>(null);

  // --- ESTADOS SCANNER ---
  const [scanHost, setScanHost] = useState('127.0.0.1');
  const [scanPorts, setScanPorts] = useState('21,22,80,443,3306,3389,8080');
  const [scanRunning, setScanRunning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ scanned: 0, total: 0, percentage: 0 });
  const [scanResults, setScanResults] = useState<{ port: number; status: 'open' | 'closed' }[]>([]);
  const [scanId, setScanId] = useState('');

  // Auto-scroll para el ping output
  useEffect(() => {
    if (pingOutputRef.current) {
      pingOutputRef.current.scrollTop = pingOutputRef.current.scrollHeight;
    }
  }, [pingOutput]);

  // --- CONTROL PING ---
  const startPing = () => {
    if (!pingHost.trim()) return;
    
    const id = Math.random().toString();
    setPingId(id);
    setPingRunning(true);
    setPingOutput(['Iniciando ping a ' + pingHost + '...']);
    setCurrentLatency(null);

    // Escuchar respuestas de ping
    const handlePingData = (_: any, data: { text: string; latency: number }) => {
      setPingOutput(prev => [...prev, data.text.trim()].slice(-100)); // Limitar a 100 líneas
      if (data.latency > 0) {
        setCurrentLatency(data.latency);
      }
    };

    window.ipcRenderer.on(`net:ping-data:${id}`, handlePingData);

    window.ipcRenderer.invoke('net:ping', pingHost, id).then(() => {
      window.ipcRenderer.off(`net:ping-data:${id}`, handlePingData);
      setPingRunning(false);
      setPingOutput(prev => [...prev, '\r\nPing finalizado.']);
    });
  };

  const stopPing = () => {
    if (pingId) {
      window.ipcRenderer.send(`net:ping-stop:${pingId}`);
      setPingRunning(false);
    }
  };

  useEffect(() => {
    return () => {
      if (pingRunning && pingId) {
        window.ipcRenderer.send(`net:ping-stop:${pingId}`);
      }
    };
  }, [pingRunning, pingId]);

  // --- CONTROL SCANNER ---
  const COMMON_PORTS = '21,22,80,443,1433,3306,3389,5432,8080,9000';
  const ADMIN_PORTS = '22,80,443,3389,8080';

  const applyPreset = (preset: string) => {
    setScanPorts(preset);
  };

  const startScan = () => {
    if (!scanHost.trim() || !scanPorts.trim()) return;

    const id = Math.random().toString();
    setScanId(id);
    setScanRunning(true);
    setScanResults([]);
    setScanProgress({ scanned: 0, total: 0, percentage: 0 });

    // Escuchar progreso
    const handleProgress = (_: any, data: { port: number; status: 'open' | 'closed'; scanned: number; total: number }) => {
      setScanProgress({
        scanned: data.scanned,
        total: data.total,
        percentage: Math.round((data.scanned / data.total) * 100)
      });
      if (data.status === 'open') {
        setScanResults(prev => [...prev, { port: data.port, status: 'open' }]);
      }
    };

    const handleFinished = (_: any, _data: { openPorts: number[] }) => {
      window.ipcRenderer.off(`net:scan-progress:${id}`, handleProgress);
      window.ipcRenderer.off(`net:scan-finished:${id}`, handleFinished);
      setScanRunning(false);
    };

    window.ipcRenderer.on(`net:scan-progress:${id}`, handleProgress);
    window.ipcRenderer.on(`net:scan-finished:${id}`, handleFinished);

    window.ipcRenderer.invoke('net:scan-ports', scanHost, scanPorts, id);
  };

  const cancelScan = () => {
    if (scanId) {
      window.ipcRenderer.send(`net:scan-cancel:${scanId}`);
      setScanRunning(false);
    }
  };

  useEffect(() => {
    return () => {
      if (scanRunning && scanId) {
        window.ipcRenderer.send(`net:scan-cancel:${scanId}`);
      }
    };
  }, [scanRunning, scanId]);

  const getPortDescription = (port: number): string => {
    const descriptions: Record<number, string> = {
      21: 'FTP (File Transfer)',
      22: 'SSH / SFTP Connection',
      23: 'Telnet (Insecure Console)',
      25: 'SMTP (Mail Sending)',
      80: 'HTTP Web Server',
      443: 'HTTPS Secure Web Server',
      1433: 'MS SQL Server',
      3306: 'MySQL Database',
      3389: 'RDP (Remote Desktop)',
      5432: 'PostgreSQL Database',
      8080: 'Alternative Web / Tomcat',
      9000: 'Portainer / PHP-FPM'
    };
    return descriptions[port] || 'Servicio Desconocido';
  };

  // ==========================================
  // --- SUBHERRAMIENTA 2: GENERADOR CONTRASEÑAS ---
  // ==========================================
  const [passLength, setPassLength] = useState(16);
  const [passUpper, setPassUpper] = useState(true);
  const [passLower, setPassLower] = useState(true);
  const [passNumbers, setPassNumbers] = useState(true);
  const [passSymbols, setPassSymbols] = useState(true);
  const [passExcludeSimilar, setPassExcludeSimilar] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copiedPass, setCopiedPass] = useState(false);

  const generatePassword = () => {
    let charset = '';
    let upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let lower = 'abcdefghijklmnopqrstuvwxyz';
    let nums = '0123456789';
    let syms = '!@#$%^&*()_+-=[]{}|;:\',./<>?';
    
    if (passExcludeSimilar) {
      upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Evita I, O
      lower = 'abcdefghijkmnopqrstuvwxyz'; // Evita l, o
      nums = '23456789'; // Evita 0, 1
    }
    
    if (passUpper) charset += upper;
    if (passLower) charset += lower;
    if (passNumbers) charset += nums;
    if (passSymbols) charset += syms;
    
    if (!charset) {
      setGeneratedPassword('¡Selecciona al menos una opción!');
      return;
    }
    
    let result = '';
    for (let i = 0; i < passLength; i++) {
      const randIndex = Math.floor(Math.random() * charset.length);
      result += charset[randIndex];
    }
    setGeneratedPassword(result);
    setCopiedPass(false);
  };

  useEffect(() => {
    if (activeSubTool === 'password') {
      generatePassword();
    }
  }, [activeSubTool, passLength, passUpper, passLower, passNumbers, passSymbols, passExcludeSimilar]);

  const copyPasswordToClipboard = () => {
    if (!generatedPassword || generatedPassword === '¡Selecciona al menos una opción!') return;
    navigator.clipboard.writeText(generatedPassword);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2000);
  };

  const getPasswordStrength = () => {
    let poolSize = 0;
    if (passUpper) poolSize += passExcludeSimilar ? 24 : 26;
    if (passLower) poolSize += passExcludeSimilar ? 25 : 26;
    if (passNumbers) poolSize += passExcludeSimilar ? 8 : 10;
    if (passSymbols) poolSize += 28;
    
    if (poolSize === 0 || !generatedPassword) return { label: 'Ninguna', score: 0, color: 'text-gray-500 bg-gray-500/10 border-gray-500/25', width: 'w-0' };
    
    const entropy = passLength * Math.log2(poolSize);
    if (entropy < 40) {
      return { label: 'Débil', color: 'text-red-400 bg-red-500/10 border-red-500/20', width: 'w-1/4 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' };
    } else if (entropy < 60) {
      return { label: 'Aceptable', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', width: 'w-2/4 bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]' };
    } else if (entropy < 80) {
      return { label: 'Segura', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', width: 'w-3/4 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' };
    } else {
      return { label: 'Muy Segura (Militar)', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20', width: 'w-full bg-gradient-to-r from-emerald-500 to-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.6)]' };
    }
  };

  // ==========================================
  // --- SUBHERRAMIENTA 3: GENERADOR LLAVES SSH ---
  // ==========================================
  const [sshKeyType, setSshKeyType] = useState<'rsa' | 'ed25519'>('rsa');
  const [sshBits, setSshBits] = useState<number>(2048);
  const [sshGenerating, setSshGenerating] = useState(false);
  const [sshPublicKey, setSshPublicKey] = useState('');
  const [sshPrivateKey, setSshPrivateKey] = useState('');
  const [copiedPub, setCopiedPub] = useState(false);
  const [copiedPriv, setCopiedPriv] = useState(false);

  const generateSshKey = async () => {
    setSshGenerating(true);
    setSshPublicKey('');
    setSshPrivateKey('');
    setCopiedPub(false);
    setCopiedPriv(false);
    
    try {
      const res = await window.ipcRenderer.invoke('tools:generate-ssh-key', sshKeyType, sshBits);
      if (res.success) {
        setSshPublicKey(res.publicKey);
        setSshPrivateKey(res.privateKey);
      } else {
        alert('Error al generar llave: ' + res.error);
      }
    } catch (e: any) {
      alert('Error de invocación IPC: ' + e.message);
    } finally {
      setSshGenerating(false);
    }
  };

  const downloadSshFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ==========================================
  // --- SUBHERRAMIENTA 4: INFO DE SISTEMA ---
  // ==========================================
  const [sysInfo, setSysInfo] = useState<any>(null);
  const [sysLoading, setSysLoading] = useState(false);

  const loadSysInfo = async () => {
    setSysLoading(true);
    try {
      const res = await window.ipcRenderer.invoke('tools:get-sys-info');
      if (res.success) {
        setSysInfo(res);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSysLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTool === 'sysinfo') {
      loadSysInfo();
    }
  }, [activeSubTool]);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 GB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return '0h';
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor((seconds % (3600*24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  // ==========================================
  // --- SUBHERRAMIENTA 5: CERTIFICADOS AUTOFIRMADOS ---
  // ==========================================
  const getTodayString = (yearsToAdd = 0) => {
    const d = new Date();
    if (yearsToAdd > 0) d.setFullYear(d.getFullYear() + yearsToAdd);
    return d.toISOString().split('T')[0];
  };

  const [certCommonName, setCertCommonName] = useState('localhost');
  const [certOrganization, setCertOrganization] = useState('');
  const [certCountry, setCertCountry] = useState('');
  const [certDnsNames, setCertDnsNames] = useState('localhost');
  const [certIpAddresses, setCertIpAddresses] = useState('127.0.0.1');
  const [certKeySize, setCertKeySize] = useState<number>(2048);
  const [certValidFrom, setCertValidFrom] = useState(getTodayString(0));
  const [certValidTo, setCertValidTo] = useState(getTodayString(10));
  const [certServerAuth, setCertServerAuth] = useState(true);
  const [certClientAuth, setCertClientAuth] = useState(false);
  const [certCodeSigning, setCertCodeSigning] = useState(false);
  const [certSaveMethod, setCertSaveMethod] = useState<'pem' | 'pfx'>('pfx');
  const [certPassword, setCertPassword] = useState('');
  const [certShowPassword, setCertShowPassword] = useState(false);
  const [certResult, setCertResult] = useState<{ privateKeyPem: string; certificatePem: string; pfxBase64: string } | null>(null);
  const [certLoading, setCertLoading] = useState(false);
  const [certCopiedKey, setCertCopiedKey] = useState(false);
  const [certCopiedCert, setCertCopiedCert] = useState(false);

  const generateCertPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^*';
    let pass = '';
    for (let i = 0; i < 16; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCertPassword(pass);
  };

  const generateCertificate = async () => {
    if (!certCommonName.trim()) return;
    setCertLoading(true);
    setCertResult(null);
    try {
      const dnsArray = certDnsNames.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      const ipArray = certIpAddresses.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      
      const res = await window.ipcRenderer.invoke('tools:generate-certificate', {
        commonName: certCommonName,
        organization: certOrganization,
        country: certCountry,
        dnsNames: dnsArray,
        ipAddresses: ipArray,
        keySize: certKeySize,
        validFrom: certValidFrom + 'T00:00:00Z',
        validTo: certValidTo + 'T23:59:59Z',
        serverAuth: certServerAuth,
        clientAuth: certClientAuth,
        codeSigning: certCodeSigning,
        saveMethod: certSaveMethod,
        password: certPassword
      });
      
      if (res.success) {
        setCertResult(res);
      } else {
        alert('Error al generar certificado: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setCertLoading(false);
    }
  };

  const downloadCertFiles = () => {
    if (!certResult) return;
    if (certSaveMethod === 'pfx' && certResult.pfxBase64) {
      const binaryString = window.atob(certResult.pfxBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/x-pkcs12' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${certCommonName}.pfx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      downloadSshFile(certResult.certificatePem, `${certCommonName}.crt`);
      downloadSshFile(certResult.privateKeyPem, `${certCommonName}.key`);
    }
  };

  // ==========================================
  // --- SUBHERRAMIENTA 6: COMPROBADOR DE SSL ---
  // ==========================================
  const [sslDomain, setSslDomain] = useState('');
  const [sslLoading, setSslLoading] = useState(false);
  const [sslResult, setSslResult] = useState<any>(null);
  const [sslError, setSslError] = useState<string | null>(null);

  // ==========================================
  // --- SUBHERRAMIENTA 7: WAKE ON LAN (WoL) ---
  // ==========================================
  const [wolMac, setWolMac] = useState('');
  const [wolIp, setWolIp] = useState('255.255.255.255');
  const [wolPort, setWolPort] = useState(9);
  const [wolLogs, setWolLogs] = useState<string[]>([]);
  const [wolSending, setWolSending] = useState(false);

  // Formateador automático de MAC (ej: 00:11:22:33:44:55)
  const formatMac = (val: string) => {
    const hex = val.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
    const parts = [];
    for (let i = 0; i < hex.length && i < 12; i += 2) {
      parts.push(hex.substring(i, i + 2));
    }
    return parts.join(':');
  };

  const sendWol = async () => {
    const cleanedMac = wolMac.replace(/[^a-fA-F0-9]/g, '');
    if (cleanedMac.length !== 12) {
      setWolLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Error: Dirección MAC no válida (debe tener 12 dígitos hexadecimales)`]);
      return;
    }

    setWolSending(true);
    setWolLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 📡 Enviando Magic Packet UDP a la MAC ${wolMac}...`]);
    try {
      const res = await window.ipcRenderer.invoke('wol:send', wolMac, wolIp, wolPort);
      if (res.success) {
        setWolLogs(prev => [
          ...prev, 
          `[${new Date().toLocaleTimeString()}] 🚀 Magic Packet enviado exitosamente a través de UDP ${wolIp}:${wolPort}`
        ]);
      } else {
        setWolLogs(prev => [
          ...prev, 
          `[${new Date().toLocaleTimeString()}] ❌ Error del sistema: ${res.error || 'Fallo desconocido'}`
        ]);
      }
    } catch (err: any) {
      setWolLogs(prev => [
        ...prev, 
        `[${new Date().toLocaleTimeString()}] ❌ Error crítico: ${err.message}`
      ]);
    } finally {
      setWolSending(false);
    }
  };

  const checkSSL = async () => {
    if (!sslDomain.trim()) return;
    setSslLoading(true);
    setSslResult(null);
    setSslError(null);
    try {
      const res = await window.ipcRenderer.invoke('net:check-ssl', sslDomain);
      if (res.success) {
        setSslResult(res);
      } else {
        setSslError(res.error || 'Ocurrió un error desconocido');
      }
    } catch (e: any) {
      setSslError(e.message);
    } finally {
      setSslLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[var(--bg-secondary)] border border-[var(--panel-border)] rounded-lg overflow-hidden relative">
      
      {/* ========================================== */}
      {/* VIEW 1: DIAGNÓSTICO DE RED */}
      {/* ========================================== */}
      {activeSubTool === 'network' && (
        <div className="w-full h-full flex flex-col">
          {/* Visual Header / Switcher */}
          <div className="p-3 border-b border-[var(--panel-border)] bg-[var(--bg-primary)]/10 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Compass className="w-4 h-4" />
              Utilidades de Diagnóstico de Red
            </h2>
            
            {/* Buttons Switcher */}
            <div className="flex bg-[var(--sidebar-bar)] border border-[var(--panel-border)] p-1 rounded-lg">
              <button 
                onClick={() => setActiveTool('ping')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTool === 'ping' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-gray-400 border border-transparent'}`}
              >
                Ping Visual
              </button>
              <button 
                onClick={() => setActiveTool('scanner')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTool === 'scanner' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-gray-400 border border-transparent'}`}
              >
                Escáner de Puertos
              </button>
            </div>
          </div>

          {/* TOOL CONTENTS */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTool === 'ping' && (
              <div className="w-full h-full flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3 bg-[var(--bg-primary)]/10 p-3 rounded-lg border border-[var(--panel-border)]">
                  <div className="flex-1 min-w-[200px] flex flex-col gap-1">
                    <label className="text-[10px] text-gray-500 font-semibold uppercase">Host de Destino (IP o Dominio)</label>
                    <input 
                      type="text" 
                      value={pingHost}
                      onChange={e => setPingHost(e.target.value)}
                      placeholder="ej. 1.1.1.1 o google.com"
                      disabled={pingRunning}
                      className="glass-input text-xs py-2"
                    />
                  </div>

                  <div className="flex items-end h-full">
                    {pingRunning ? (
                      <button 
                        onClick={stopPing}
                        className="glass-btn text-xs py-2 bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20 flex items-center"
                      >
                        <Square className="w-3.5 h-3.5" />
                        Detener Ping
                      </button>
                    ) : (
                      <button 
                        onClick={startPing}
                        className="glass-btn glass-btn-accent text-xs py-2 bg-cyan-600 hover:bg-cyan-500"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Iniciar Ping
                      </button>
                    )}
                  </div>

                  {pingRunning && currentLatency !== null && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded bg-cyan-500/10 border border-cyan-500/20 animate-pulse">
                      <span className="text-[9px] text-gray-500 uppercase font-semibold">LATENCIA</span>
                      <span className="text-xs font-mono font-bold text-cyan-400">{currentLatency} ms</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-h-[250px] flex flex-col bg-[var(--sidebar-bar)] border border-[var(--panel-border)] rounded-lg overflow-hidden">
                  <div className="px-3 py-1.5 border-b border-[var(--panel-border)] bg-black/10 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Salida del proceso Ping</span>
                    {pingRunning && <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />}
                  </div>
                  
                  <div 
                    ref={pingOutputRef}
                    className="flex-1 p-3 font-mono text-[10px] overflow-y-auto whitespace-pre-wrap leading-relaxed select-text text-[var(--text-main)]"
                  >
                    {pingOutput.length === 0 ? (
                      <span className="text-gray-600 italic">Introduce un host e inicia el ping para ver el diagnóstico...</span>
                    ) : (
                      pingOutput.join('\n')
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTool === 'scanner' && (
              <div className="w-full h-full flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[var(--bg-primary)]/10 p-4 rounded-lg border border-[var(--panel-border)]">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-gray-500 font-semibold uppercase">Host / IP de Destino</label>
                      <input 
                        type="text" 
                        value={scanHost}
                        onChange={e => setScanHost(e.target.value)}
                        placeholder="ej. 127.0.0.1 o 192.168.1.1"
                        disabled={scanRunning}
                        className="glass-input text-xs py-2"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-gray-500 font-semibold uppercase">Puertos a Escanear (Rango o Lista)</label>
                      <input 
                        type="text" 
                        value={scanPorts}
                        onChange={e => setScanPorts(e.target.value)}
                        placeholder="ej. 20-80 o 22,80,443,3389"
                        disabled={scanRunning}
                        className="glass-input text-xs py-2"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 justify-between">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-gray-500 font-semibold uppercase">Presets Rápidos de Puertos</label>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <button 
                          onClick={() => applyPreset(COMMON_PORTS)}
                          disabled={scanRunning}
                          className="glass-btn text-[9px] py-1 border-white/5 hover:border-cyan-500/20 text-gray-400"
                        >
                          Comunes (10)
                        </button>
                        <button 
                          onClick={() => applyPreset(ADMIN_PORTS)}
                          disabled={scanRunning}
                          className="glass-btn text-[9px] py-1 border-white/5 hover:border-cyan-500/20 text-gray-400"
                        >
                          Administración
                        </button>
                        <button 
                          onClick={() => applyPreset('1-1024')}
                          disabled={scanRunning}
                          className="glass-btn text-[9px] py-1 border-white/5 hover:border-cyan-500/20 text-gray-400"
                        >
                          System (1-1024)
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      {scanRunning ? (
                        <button 
                          onClick={cancelScan}
                          className="glass-btn text-xs py-2 bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20 flex items-center"
                        >
                          <Square className="w-3.5 h-3.5" />
                          Cancelar Escáner
                        </button>
                      ) : (
                        <button 
                          onClick={startScan}
                          className="glass-btn glass-btn-accent text-xs py-2 bg-cyan-600 hover:bg-cyan-500"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Comenzar Escaneo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {scanRunning && (
                  <div className="p-3.5 rounded-lg bg-[var(--sidebar-bar)] border border-[var(--panel-border)] flex flex-col gap-2">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-gray-400 font-bold uppercase">Progreso del Escaneo</span>
                      <span className="text-cyan-400 font-mono font-semibold">{scanProgress.scanned} de {scanProgress.total} puertos ({scanProgress.percentage}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)] transition-all duration-300" style={{ width: `${scanProgress.percentage}%` }} />
                    </div>
                  </div>
                )}

                <div className="flex-1 min-h-[200px] flex flex-col bg-[var(--sidebar-bar)] border border-[var(--panel-border)] rounded-lg overflow-hidden">
                  <div className="px-3 py-1.5 border-b border-[var(--panel-border)] bg-black/10 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Puertos Abiertos Encontrados</span>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold">{scanResults.length} Abiertos</span>
                  </div>
                  
                  {scanResults.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                      <Radio className="w-8 h-8 text-gray-700 animate-pulse mb-2" />
                      <p className="text-[10px] text-gray-500 italic max-w-xs font-normal">
                        {scanRunning ? 'Escaneando en paralelo... Los puertos abiertos aparecerán en tiempo real.' : 'Inicia un escaneo para mapear puertos de red locales o remotos.'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-3 overflow-y-auto max-h-[300px]">
                      {scanResults.map(res => (
                        <div 
                          key={res.port} 
                          className="p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-950/10 flex items-center justify-between animate-scale-in"
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              PUERTO {res.port}
                            </span>
                            <span className="text-[9px] text-gray-400 mt-0.5">{getPortDescription(res.port)}</span>
                          </div>
                          
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono font-semibold uppercase">
                            Open
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* VIEW 2: GENERADOR DE CONTRASEÑAS */}
      {/* ========================================== */}
      {activeSubTool === 'password' && (
        <div className="w-full h-full flex flex-col">
          {/* Header */}
          <div className="p-3 border-b border-[var(--panel-border)] bg-[var(--bg-primary)]/10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-2">
              <Key className="w-4 h-4 text-purple-400" />
              Generador de Contraseñas Seguras
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 max-w-3xl mx-auto w-full">
            {/* Output Box */}
            <div className="p-4 rounded-xl bg-purple-950/5 border border-purple-500/20 flex flex-col gap-3.5 animate-scale-in">
              <div className="flex items-center justify-between gap-3 bg-black/35 rounded-lg border border-white/5 p-3.5 select-text font-mono text-base tracking-wider text-white relative">
                <span className="break-all pr-12">{generatedPassword || 'Cargando...'}</span>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  <button
                    onClick={copyPasswordToClipboard}
                    className="p-2 rounded bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all border border-purple-500/25 active:scale-95"
                    title="Copiar Contraseña"
                  >
                    {copiedPass ? <Check className="w-4 h-4 text-emerald-400 animate-pulse" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={generatePassword}
                    className="p-2 rounded bg-white/5 text-gray-400 hover:bg-white/10 transition-all border border-white/10 active:scale-95"
                    title="Regenerar Contraseña"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Strength HUD */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                  <span className="text-gray-500">NIVEL DE SEGURIDAD</span>
                  <span className={`px-2 py-0.5 rounded font-bold border ${getPasswordStrength().color}`}>
                    {getPasswordStrength().label}
                  </span>
                </div>
                <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${getPasswordStrength().width}`} />
                </div>
              </div>
            </div>

            {/* Customization Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[var(--bg-primary)]/10 border border-[var(--panel-border)] p-4 rounded-xl">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-gray-400">
                    <span>Longitud de Letra</span>
                    <span className="text-cyan-400 font-mono font-bold">{passLength} Caracteres</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="64"
                    value={passLength}
                    onChange={(e) => setPassLength(Number(e.target.value))}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-purple-500 bg-black/40"
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-black/10 border border-white/5">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-200">Excluir similares</span>
                    <span className="text-[9px] text-gray-500">Evitar caracteres ambiguos como l, 1, o, O, 0</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={passExcludeSimilar}
                    onChange={(e) => setPassExcludeSimilar(e.target.checked)}
                    className="w-4 h-4 cursor-pointer accent-purple-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Tipos de Caracteres</label>
                
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center justify-between p-2 rounded bg-black/15 border border-white/5 cursor-pointer hover:bg-black/25">
                    <span className="text-xs text-gray-300">Mayúsculas (A-Z)</span>
                    <input
                      type="checkbox"
                      checked={passUpper}
                      onChange={(e) => setPassUpper(e.target.checked)}
                      className="w-3.5 h-3.5 cursor-pointer accent-purple-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 rounded bg-black/15 border border-white/5 cursor-pointer hover:bg-black/25">
                    <span className="text-xs text-gray-300">Minúsculas (a-z)</span>
                    <input
                      type="checkbox"
                      checked={passLower}
                      onChange={(e) => setPassLower(e.target.checked)}
                      className="w-3.5 h-3.5 cursor-pointer accent-purple-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 rounded bg-black/15 border border-white/5 cursor-pointer hover:bg-black/25">
                    <span className="text-xs text-gray-300">Números (0-9)</span>
                    <input
                      type="checkbox"
                      checked={passNumbers}
                      onChange={(e) => setPassNumbers(e.target.checked)}
                      className="w-3.5 h-3.5 cursor-pointer accent-purple-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 rounded bg-black/15 border border-white/5 cursor-pointer hover:bg-black/25">
                    <span className="text-xs text-gray-300">Símbolos (#$%@)</span>
                    <input
                      type="checkbox"
                      checked={passSymbols}
                      onChange={(e) => setPassSymbols(e.target.checked)}
                      className="w-3.5 h-3.5 cursor-pointer accent-purple-500"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* VIEW 3: GENERADOR CLAVES SSH */}
      {/* ========================================== */}
      {activeSubTool === 'sshkey' && (
        <div className="w-full h-full flex flex-col">
          {/* Header */}
          <div className="p-3 border-b border-[var(--panel-border)] bg-[var(--bg-primary)]/10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <FileKey className="w-4 h-4 text-amber-400" />
              Generador de Claves SSH Nativas
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4 bg-[var(--bg-primary)]/10 border border-[var(--panel-border)] p-4 rounded-xl">
              <div className="flex flex-col gap-1 min-w-[150px]">
                <label className="text-[10px] text-gray-500 font-bold uppercase">Algoritmo de Firma</label>
                <select
                  value={sshKeyType}
                  onChange={(e) => setSshKeyType(e.target.value as any)}
                  className="glass-input text-xs py-1.5"
                >
                  <option value="rsa">RSA (Compatible / Legacy)</option>
                  <option value="ed25519">Ed25519 (Recomendado / Moderno)</option>
                </select>
              </div>

              {sshKeyType === 'rsa' && (
                <div className="flex flex-col gap-1 min-w-[120px]">
                  <label className="text-[10px] text-gray-500 font-bold uppercase">Tamaño de Bits</label>
                  <select
                    value={sshBits}
                    onChange={(e) => setSshBits(Number(e.target.value))}
                    className="glass-input text-xs py-1.5"
                  >
                    <option value={2048}>2048 Bits</option>
                    <option value={4096}>4096 Bits</option>
                  </select>
                </div>
              )}

              <div className="flex items-end h-full mt-auto">
                <button
                  onClick={generateSshKey}
                  disabled={sshGenerating}
                  className="glass-btn glass-btn-accent text-xs py-2 bg-amber-600 hover:bg-amber-500 uppercase flex items-center"
                >
                  {sshGenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Generando Par de Claves...
                    </>
                  ) : (
                    <>
                      <FileKey className="w-3.5 h-3.5 mr-1.5" />
                      Generar Par de Claves
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Results */}
            {sshPrivateKey ? (
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* Private Key PEM */}
                <div className="flex flex-col bg-black/35 rounded-lg border border-[var(--panel-border)] overflow-hidden">
                  <div className="px-3 py-1.5 border-b border-[var(--panel-border)] bg-black/20 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Clave Privada (id_{sshKeyType})</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(sshPrivateKey);
                          setCopiedPriv(true);
                          setTimeout(() => setCopiedPriv(false), 2000);
                        }}
                        className="p-1 rounded hover:bg-white/5 text-amber-400 text-[10px] font-semibold flex items-center gap-1"
                      >
                        {copiedPriv ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        Copiar
                      </button>
                      <button
                        onClick={() => downloadSshFile(sshPrivateKey, `id_${sshKeyType}`)}
                        className="p-1 rounded hover:bg-white/5 text-cyan-400 text-[10px] font-semibold flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        Descargar
                      </button>
                    </div>
                  </div>
                  <textarea
                    readOnly
                    value={sshPrivateKey}
                    className="flex-1 p-3 font-mono text-[9px] bg-transparent text-gray-300 resize-none outline-none leading-normal leading-relaxed select-text min-h-[220px]"
                  />
                </div>

                {/* Public Key SSH */}
                <div className="flex flex-col bg-black/35 rounded-lg border border-[var(--panel-border)] overflow-hidden">
                  <div className="px-3 py-1.5 border-b border-[var(--panel-border)] bg-black/20 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Clave Pública (id_{sshKeyType}.pub)</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(sshPublicKey);
                          setCopiedPub(true);
                          setTimeout(() => setCopiedPub(false), 2000);
                        }}
                        className="p-1 rounded hover:bg-white/5 text-amber-400 text-[10px] font-semibold flex items-center gap-1"
                      >
                        {copiedPub ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        Copiar
                      </button>
                      <button
                        onClick={() => downloadSshFile(sshPublicKey, `id_${sshKeyType}.pub`)}
                        className="p-1 rounded hover:bg-white/5 text-cyan-400 text-[10px] font-semibold flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        Descargar
                      </button>
                    </div>
                  </div>
                  <textarea
                    readOnly
                    value={sshPublicKey}
                    className="flex-1 p-3 font-mono text-[9px] bg-transparent text-gray-300 resize-none outline-none leading-normal leading-relaxed select-text min-h-[220px]"
                  />
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-black/5 rounded-lg border border-dashed border-white/5">
                <FileKey className="w-12 h-12 text-gray-700 mb-3" />
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">¿Listo para generar?</h4>
                <p className="text-[10px] text-gray-500 max-w-sm mt-1 leading-normal font-normal">
                  Haz click en el botón de arriba. Las claves se computan localmente mediante los módulos criptográficos OpenSSL nativos de tu sistema a través de Node.js.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* VIEW 4: INFORMACIÓN DE SISTEMA */}
      {/* ========================================== */}
      {activeSubTool === 'sysinfo' && (
        <div className="w-full h-full flex flex-col">
          {/* Header */}
          <div className="p-3 border-b border-[var(--panel-border)] bg-[var(--bg-primary)]/10 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              Información de Mi Sistema
            </h2>
            
            <button
              onClick={loadSysInfo}
              disabled={sysLoading}
              className="glass-btn text-[10px] py-1 border-emerald-500/20 text-emerald-400 flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${sysLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {sysLoading && !sysInfo ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
                <span className="text-xs text-gray-500 font-mono">Consiguiendo métricas de hardware nativas...</span>
              </div>
            ) : sysInfo ? (
              <div className="flex flex-col gap-4 animate-scale-in">
                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {/* OS Card */}
                  <div className="p-3 bg-[var(--bg-primary)]/20 border border-[var(--panel-border)] rounded-xl flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                      <Cpu className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[9px] text-gray-500 font-bold uppercase">SISTEMA OPERATIVO</span>
                      <span className="text-xs text-white font-bold truncate capitalize">{sysInfo.platform} ({sysInfo.arch})</span>
                      <span className="text-[9px] text-gray-400 mt-0.5 truncate">{sysInfo.type} {sysInfo.release}</span>
                    </div>
                  </div>

                  {/* Hostname Card */}
                  <div className="p-3 bg-[var(--bg-primary)]/20 border border-[var(--panel-border)] rounded-xl flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                      <Radio className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[9px] text-gray-500 font-bold uppercase">NOMBRE DE HOST</span>
                      <span className="text-xs text-white font-bold truncate">{sysInfo.hostname}</span>
                      <span className="text-[9px] text-gray-400 mt-0.5 truncate">Registrado en red local</span>
                    </div>
                  </div>

                  {/* CPU Card */}
                  <div className="p-3 bg-[var(--bg-primary)]/20 border border-[var(--panel-border)] rounded-xl flex items-center gap-3.5 col-span-1 sm:col-span-2">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                      <Cpu className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[9px] text-gray-500 font-bold uppercase">CPU / HILOS PROCESADORES</span>
                      <span className="text-xs text-white font-bold truncate">{sysInfo.cpuModel}</span>
                      <span className="text-[9px] text-gray-400 mt-0.5 truncate">{sysInfo.cores} Cores Físicos / Lógicos @ {(sysInfo.cpuSpeed / 1000).toFixed(2)} GHz</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Uptime & Memory Dashboard */}
                  <div className="lg:col-span-1 flex flex-col gap-4">
                    {/* RAM Memory Monitor */}
                    <div className="p-4 bg-[var(--bg-primary)]/20 border border-[var(--panel-border)] rounded-xl flex flex-col gap-3">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Métrica de Memoria RAM</span>
                      
                      <div className="flex justify-between items-end">
                        <div className="flex flex-col">
                          <span className="text-2xl font-mono font-bold text-white">
                            {((1 - (sysInfo.freeMem / sysInfo.totalMem)) * 100).toFixed(0)}%
                          </span>
                          <span className="text-[9px] text-gray-400 mt-0.5">En uso activo</span>
                        </div>
                        <div className="text-right flex flex-col font-mono text-[9px] text-gray-400">
                          <span>Total: {formatBytes(sysInfo.totalMem)}</span>
                          <span>Disponible: {formatBytes(sysInfo.freeMem)}</span>
                        </div>
                      </div>

                      <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                          style={{ width: `${((1 - (sysInfo.freeMem / sysInfo.totalMem)) * 100).toFixed(0)}%` }} 
                        />
                      </div>
                    </div>

                    {/* Uptime Monitor */}
                    <div className="p-4 bg-[var(--bg-primary)]/20 border border-[var(--panel-border)] rounded-xl flex flex-col gap-2">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Tiempo de Encendido (Uptime)</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-mono font-bold text-white">{formatUptime(sysInfo.uptime)}</span>
                        <span className="text-[9px] text-gray-400 font-semibold px-2 py-0.5 rounded bg-white/5 border border-white/10 uppercase">
                          Activo Continuo
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Network interfaces */}
                  <div className="lg:col-span-2 p-4 bg-[var(--bg-primary)]/20 border border-[var(--panel-border)] rounded-xl flex flex-col gap-3">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-cyan-400" />
                      Mapeo de Interfaces de Red Físicas/Virtuales
                    </span>

                    <div className="flex-1 overflow-y-auto max-h-[220px] pr-1 flex flex-col gap-2.5">
                      {Object.keys(sysInfo.networkInterfaces).map(ifaceName => {
                        const addrs = sysInfo.networkInterfaces[ifaceName];
                        const ipv4 = addrs?.find((a: any) => a.family === 'IPv4' || a.family === 4);
                        if (!ipv4 || ipv4.internal) return null; // Saltar interfaces loopback/internas
                        
                        return (
                          <div key={ifaceName} className="p-3 bg-black/20 rounded-lg border border-white/5 flex flex-col gap-1.5">
                            <span className="text-xs font-bold text-white flex items-center gap-2 truncate">
                              <Radio className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                              {ifaceName}
                            </span>
                            
                            <div className="grid grid-cols-2 gap-2 font-mono text-[9px] text-gray-400">
                              <div className="flex flex-col">
                                <span className="text-[8px] text-gray-500 font-semibold uppercase">Dirección IPv4</span>
                                <span className="text-gray-200 mt-0.5 font-bold">{ipv4.address}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[8px] text-gray-500 font-semibold uppercase">Máscara de Subred</span>
                                <span className="text-gray-300 mt-0.5">{ipv4.netmask}</span>
                              </div>
                              <div className="flex flex-col col-span-2">
                                <span className="text-[8px] text-gray-500 font-semibold uppercase">Dirección Física MAC</span>
                                <span className="text-gray-300 mt-0.5">{ipv4.mac || 'No disponible'}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12">
                <Radio className="w-10 h-10 text-gray-700 animate-pulse mb-3" />
                <span className="text-xs text-gray-500">Haz click en refrescar para obtener los datos.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* VIEW 5: GENERADOR DE CERTIFICADOS AUTOFIRMADOS */}
      {/* ========================================== */}
      {activeSubTool === 'certificate' && (
        <div className="w-full h-full flex flex-col">
          {/* Header */}
          <div className="p-3 border-b border-[var(--panel-border)] bg-[var(--bg-primary)]/10 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              Certificado Autofirmado
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={generateCertificate}
                disabled={certLoading || !certCommonName.trim()}
                className="glass-btn text-[10px] py-1 border-amber-500/20 text-amber-400 flex items-center gap-1 font-bold"
              >
                {certLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                Generar
              </button>
            </div>
          </div>

          {/* Scrollable Container split in two columns */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col lg:flex-row gap-4">
            
            {/* Form Column */}
            <div className="w-full lg:w-1/2 flex flex-col gap-3.5 bg-black/20 border border-[var(--panel-border)] rounded-xl p-4">
              
              {/* Common Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-gray-400 font-bold uppercase">Nombre Común (Common Name)*</label>
                <input
                  type="text"
                  value={certCommonName}
                  onChange={(e) => setCertCommonName(e.target.value)}
                  placeholder="ej. localhost o *.local.app"
                  className="w-full text-xs"
                />
              </div>

              {/* Subject Alt Names (SAN) */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-400 font-bold uppercase">Nombres DNS Alternativos (uno por línea)</label>
                  <textarea
                    value={certDnsNames}
                    onChange={(e) => setCertDnsNames(e.target.value)}
                    placeholder="localhost&#10;*.local.app"
                    rows={3}
                    className="w-full text-xs font-mono p-2 bg-black/40 border border-[var(--panel-border)] rounded text-white"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-400 font-bold uppercase">Direcciones IP Alternativas (uno por línea)</label>
                  <textarea
                    value={certIpAddresses}
                    onChange={(e) => setCertIpAddresses(e.target.value)}
                    placeholder="127.0.0.1&#10;192.168.1.1"
                    rows={3}
                    className="w-full text-xs font-mono p-2 bg-black/40 border border-[var(--panel-border)] rounded text-white"
                  />
                </div>
              </div>

              {/* Optional Org Fields */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-400 font-bold uppercase">Organización (O)</label>
                  <input
                    type="text"
                    value={certOrganization}
                    onChange={(e) => setCertOrganization(e.target.value)}
                    placeholder="ej. SinCracK Lab"
                    className="w-full text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-400 font-bold uppercase">País (C) - 2 letras</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={certCountry}
                    onChange={(e) => setCertCountry(e.target.value.toUpperCase())}
                    placeholder="ej. ES, US, FR"
                    className="w-full text-xs uppercase"
                  />
                </div>
              </div>

              {/* RSA bits & Dates */}
              <div className="grid grid-cols-3 gap-3.5">
                <div className="flex flex-col gap-1.5 col-span-1">
                  <label className="text-[10px] text-gray-400 font-bold uppercase">Clave RSA (bits)</label>
                  <select
                    value={certKeySize}
                    onChange={(e) => setCertKeySize(Number(e.target.value))}
                    className="w-full text-xs bg-black/40 border border-[var(--panel-border)] rounded text-white p-1"
                  >
                    <option value={2048}>2048 bits</option>
                    <option value={4096}>4096 bits</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 col-span-1">
                  <label className="text-[10px] text-gray-400 font-bold uppercase">Válido desde</label>
                  <input
                    type="date"
                    value={certValidFrom}
                    onChange={(e) => setCertValidFrom(e.target.value)}
                    className="w-full text-xs bg-black/40 border border-[var(--panel-border)] rounded text-white p-1"
                  />
                </div>
                <div className="flex flex-col gap-1.5 col-span-1">
                  <label className="text-[10px] text-gray-400 font-bold uppercase">Válido hasta</label>
                  <input
                    type="date"
                    value={certValidTo}
                    onChange={(e) => setCertValidTo(e.target.value)}
                    className="w-full text-xs bg-black/40 border border-[var(--panel-border)] rounded text-white p-1"
                  />
                </div>
              </div>

              {/* Extended Key Usage */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-gray-400 font-bold uppercase">Uso extendido de la clave (Key Usage)</label>
                <div className="grid grid-cols-3 gap-2 py-1.5 bg-black/10 rounded px-2.5 border border-white/5">
                  <label className="flex items-center gap-2 text-[10px] text-gray-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={certServerAuth}
                      onChange={(e) => setCertServerAuth(e.target.checked)}
                      className="cursor-pointer"
                    />
                    Autenticación Servidor
                  </label>
                  <label className="flex items-center gap-2 text-[10px] text-gray-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={certClientAuth}
                      onChange={(e) => setCertClientAuth(e.target.checked)}
                      className="cursor-pointer"
                    />
                    Autenticación Cliente
                  </label>
                  <label className="flex items-center gap-2 text-[10px] text-gray-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={certCodeSigning}
                      onChange={(e) => setCertCodeSigning(e.target.checked)}
                      className="cursor-pointer"
                    />
                    Firma de Código
                  </label>
                </div>
              </div>

              {/* Save Method */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-400 font-bold uppercase">Método de guardado</label>
                  <select
                    value={certSaveMethod}
                    onChange={(e) => setCertSaveMethod(e.target.value as 'pem' | 'pfx')}
                    className="w-full text-xs bg-black/40 border border-[var(--panel-border)] rounded text-white p-1"
                  >
                    <option value="pfx">Guardar en archivo (.pfx / PKCS12)</option>
                    <option value="pem">Separar Cert & Clave (.crt / .key PEM)</option>
                  </select>
                </div>
                
                {/* PFX Password input (only if pfx chosen) */}
                <div className={`flex flex-col gap-1.5 transition-all duration-200 ${certSaveMethod === 'pem' ? 'opacity-30 pointer-events-none' : ''}`}>
                  <label className="text-[10px] text-gray-400 font-bold uppercase">Contraseña del PFX</label>
                  <div className="flex gap-1.5 relative items-center">
                    <input
                      type={certShowPassword ? "text" : "password"}
                      value={certPassword}
                      onChange={(e) => setCertPassword(e.target.value)}
                      placeholder="Sin contraseña o contraseña PFX"
                      className="w-full text-xs pr-16 bg-black/40 border border-[var(--panel-border)] rounded text-white p-1"
                      disabled={certSaveMethod === 'pem'}
                    />
                    <div className="absolute right-1 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCertShowPassword(!certShowPassword)}
                        className="p-1 hover:bg-white/5 rounded text-gray-400 hover:text-white"
                        disabled={certSaveMethod === 'pem'}
                      >
                        {certShowPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={generateCertPassword}
                        className="p-1 hover:bg-white/5 rounded text-amber-400"
                        title="Generar contraseña segura"
                        disabled={certSaveMethod === 'pem'}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Output Preview Column */}
            <div className="w-full lg:w-1/2 flex flex-col bg-black/20 border border-[var(--panel-border)] rounded-xl p-4 min-h-[300px]">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
                Vista Previa del Certificado Generado
                {certResult && (
                  <button
                    onClick={downloadCertFiles}
                    className="glass-btn text-[9px] py-0.5 px-2 border-amber-500/30 text-amber-400 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    Descargar Certificado
                  </button>
                )}
              </span>

              {certLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-3" />
                  <span className="text-xs text-gray-500 font-mono">Firmando criptográficamente el certificado local...</span>
                </div>
              ) : certResult ? (
                <div className="flex-1 flex flex-col gap-3.5 animate-scale-in overflow-hidden">
                  
                  {certSaveMethod === 'pfx' ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border border-white/5 rounded bg-black/10 gap-3">
                      <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <ShieldCheck className="w-6 h-6 text-amber-400" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-white">¡Archivo PFX (PKCS12) Creado Exitosamente!</span>
                        <span className="text-[10px] text-gray-400 max-w-sm mt-1">
                          El certificado y la clave privada han sido empaquetados juntos en un binario PFX cifrado con tu contraseña.
                        </span>
                      </div>
                      {certPassword && (
                        <div className="p-2.5 rounded bg-amber-500/5 border border-amber-500/10 font-mono text-xs flex flex-col gap-1 items-center max-w-xs w-full mt-1.5">
                          <span className="text-[9px] text-gray-500 font-bold uppercase">Contraseña Protegida PFX</span>
                          <span className="text-amber-400 font-bold tracking-wider">{certPassword}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                      {/* Certificate Textarea */}
                      <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                        <div className="flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase">
                          <span>Certificado Público (CRT PEM)</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(certResult.certificatePem);
                              setCertCopiedCert(true);
                              setTimeout(() => setCertCopiedCert(false), 2000);
                            }}
                            className="text-cyan-400 hover:underline flex items-center gap-0.5"
                          >
                            {certCopiedCert ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                            {certCopiedCert ? 'Copiado' : 'Copiar'}
                          </button>
                        </div>
                        <textarea
                          readOnly
                          value={certResult.certificatePem}
                          className="flex-1 font-mono text-[9px] bg-black/40 border border-white/5 rounded p-2 text-gray-300 resize-none overflow-y-auto"
                        />
                      </div>

                      {/* Private Key Textarea */}
                      <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                        <div className="flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase">
                          <span>Clave Privada (KEY PEM)</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(certResult.privateKeyPem);
                              setCertCopiedKey(true);
                              setTimeout(() => setCertCopiedKey(false), 2000);
                            }}
                            className="text-cyan-400 hover:underline flex items-center gap-0.5"
                          >
                            {certCopiedKey ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                            {certCopiedKey ? 'Copiado' : 'Copiar'}
                          </button>
                        </div>
                        <textarea
                          readOnly
                          value={certResult.privateKeyPem}
                          className="flex-1 font-mono text-[9px] bg-black/40 border border-white/5 rounded p-2 text-gray-300 resize-none overflow-y-auto"
                        />
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border border-dashed border-white/10 rounded">
                  <ShieldCheck className="w-10 h-10 text-gray-700 mb-2" />
                  <span className="text-xs text-gray-500">
                    Ajusta los parámetros de la izquierda y haz click en "Generar" para crear tus archivos SSL locales.
                  </span>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* VIEW 6: COMPROBADOR DE SSL */}
      {/* ========================================== */}
      {activeSubTool === 'sslcheck' && (
        <div className="w-full h-full flex flex-col">
          {/* Header & Search */}
          <div className="p-3 border-b border-[var(--panel-border)] bg-[var(--bg-primary)]/10 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              Comprobador de SSL
            </h2>
            <div className="flex items-center gap-1.5 w-[340px]">
              <input
                type="text"
                value={sslDomain}
                onChange={(e) => setSslDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && checkSSL()}
                placeholder="ej: google.com o edibon.com"
                className="w-full text-xs py-1 px-2 bg-black/40 border border-[var(--panel-border)] rounded text-white"
              />
              <button
                onClick={checkSSL}
                disabled={sslLoading || !sslDomain.trim()}
                className="glass-btn text-[10px] py-1 px-3 border-cyan-500/20 text-cyan-400 flex items-center gap-1 font-bold whitespace-nowrap"
              >
                {sslLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Compass className="w-3.5 h-3.5" />
                )}
                Analizar
              </button>
            </div>
          </div>

          {/* Output Dashboard Area */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            
            {sslLoading && !sslResult ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
                <span className="text-xs text-gray-500 font-mono">Conectando a {sslDomain} por TLS seguro en puerto 443...</span>
              </div>
            ) : sslError ? (
              <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex items-start gap-3 animate-scale-in">
                <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-red-400">Error al consultar el certificado SSL</span>
                  <span className="text-[10px] text-gray-400 mt-1">{sslError}</span>
                  <span className="text-[9px] text-gray-500 mt-2 font-mono">
                    Asegúrate de que el dominio existe, no tiene prefijos ftp/ssh y tiene el puerto 443 de HTTPS abierto al público.
                  </span>
                </div>
              </div>
            ) : sslResult ? (
              <div className="flex flex-col gap-4 animate-scale-in">
                
                {/* HUD Banner */}
                {(() => {
                  const isValid = !sslResult.isExpired && sslResult.isDomainMatch;
                  let bgGradient = 'from-green-500/10 to-emerald-500/5 border-green-500/20 text-green-400';
                  let iconColor = 'text-green-400';
                  let iconBg = 'bg-green-500/10 border-green-500/20';
                  let statusTitle = 'Certificado SSL Totalmente Válido y Seguro';
                  let statusDesc = `El dominio ${sslResult.domain} está perfectamente protegido por TLS.`;

                  if (sslResult.isExpired) {
                    bgGradient = 'from-red-500/10 to-rose-500/5 border-red-500/20 text-red-400';
                    iconColor = 'text-red-400';
                    iconBg = 'bg-red-500/10 border-red-500/20';
                    statusTitle = 'Certificado SSL Caducado / Invalido';
                    statusDesc = 'Este certificado está expirado, por lo que el tráfico no es seguro.';
                  } else if (!sslResult.isDomainMatch) {
                    bgGradient = 'from-red-500/10 to-rose-500/5 border-red-500/20 text-red-400';
                    iconColor = 'text-red-400';
                    iconBg = 'bg-red-500/10 border-red-500/20';
                    statusTitle = 'Falta de Coincidencia en Nombre de Dominio';
                    statusDesc = `El nombre de dominio consultado (${sslResult.domain}) no coincide con el CN (${sslResult.subject.commonName}) o SANs.`;
                  } else if (sslResult.daysRemaining < 30) {
                    bgGradient = 'from-amber-500/10 to-orange-500/5 border-amber-500/20 text-amber-400';
                    iconColor = 'text-amber-400';
                    iconBg = 'bg-amber-500/10 border-amber-500/20';
                    statusTitle = 'Expiración Próxima del Certificado';
                    statusDesc = `El certificado caducará pronto en ${sslResult.daysRemaining} días. Considere renovarlo.`;
                  }

                  return (
                    <div className={`p-4 bg-gradient-to-r ${bgGradient} border rounded-xl flex items-center gap-4`}>
                      <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center`}>
                        {isValid ? (
                          <ShieldCheck className={`w-6 h-6 ${iconColor}`} />
                        ) : (
                          <ShieldAlert className={`w-6 h-6 ${iconColor}`} />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white">{statusTitle}</span>
                        <span className="text-[10px] text-gray-400 mt-0.5">{statusDesc}</span>
                        {sslResult.authorized === false && sslResult.authorizationError && (
                          <span className="text-[9px] text-red-400/80 font-mono mt-1">
                            Error de Autoridad: {sslResult.authorizationError}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Info Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Card 1: Subject Details */}
                  <div className="p-4 bg-[var(--bg-primary)]/20 border border-[var(--panel-border)] rounded-xl flex flex-col gap-3">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Server className="w-3.5 h-3.5 text-cyan-400" />
                      Detalles del Sujeto (Subject Info)
                    </span>
                    <div className="flex flex-col gap-2 font-mono text-[10px] text-gray-300">
                      <div className="flex border-b border-white/5 py-1">
                        <span className="w-28 text-gray-500">Common Name:</span>
                        <span className="text-white font-bold">{sslResult.subject.commonName}</span>
                      </div>
                      <div className="flex border-b border-white/5 py-1">
                        <span className="w-28 text-gray-500">Organización:</span>
                        <span>{sslResult.subject.organization || 'Ninguna'}</span>
                      </div>
                      <div className="flex border-b border-white/5 py-1">
                        <span className="w-28 text-gray-500">País / Región:</span>
                        <span>{sslResult.subject.country} {sslResult.subject.state ? `, ${sslResult.subject.state}` : ''}</span>
                      </div>
                      <div className="flex flex-col py-1">
                        <span className="text-gray-500 mb-1">Nombres SANs Soportados:</span>
                        <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto bg-black/20 p-1.5 rounded border border-white/5 text-[9px] text-gray-400">
                          {sslResult.subjectAltNames.length > 0 ? (
                            sslResult.subjectAltNames.map((san: string, i: number) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 font-bold">
                                {san.replace(/^DNS:/i, '')}
                              </span>
                            ))
                          ) : (
                            <span>Sin Subject Alt Names</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Issuer Details */}
                  <div className="p-4 bg-[var(--bg-primary)]/20 border border-[var(--panel-border)] rounded-xl flex flex-col gap-3">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      Entidad Emisora (Issuer Info / CA)
                    </span>
                    <div className="flex flex-col gap-2 font-mono text-[10px] text-gray-300">
                      <div className="flex border-b border-white/5 py-1">
                        <span className="w-28 text-gray-500">Common Name:</span>
                        <span className="text-white font-bold">{sslResult.issuer.commonName}</span>
                      </div>
                      <div className="flex border-b border-white/5 py-1">
                        <span className="w-28 text-gray-500">Organización CA:</span>
                        <span className="text-cyan-400 font-bold">{sslResult.issuer.organization}</span>
                      </div>
                      <div className="flex border-b border-white/5 py-1">
                        <span className="w-28 text-gray-500">País Emisor:</span>
                        <span>{sslResult.issuer.country}</span>
                      </div>
                      <div className="flex border-b border-white/5 py-1">
                        <span className="w-28 text-gray-500">Tipo de Cert:</span>
                        <span>
                          {sslResult.issuer.commonName.toLowerCase().includes('let\'s encrypt') 
                            ? 'CA Gratuita DV (Let\'s Encrypt)' 
                            : sslResult.authorized 
                              ? 'Entidad de Confianza Pública (CA)' 
                              : 'Certificado Autofirmado o Desconocido'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Valdity Period */}
                  <div className="p-4 bg-[var(--bg-primary)]/20 border border-[var(--panel-border)] rounded-xl flex flex-col gap-3">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      Periodo de Validez
                    </span>
                    <div className="flex flex-col gap-2 font-mono text-[10px] text-gray-300">
                      <div className="flex border-b border-white/5 py-1">
                        <span className="w-28 text-gray-500">Válido desde:</span>
                        <span>{new Date(sslResult.validFrom).toLocaleDateString()}</span>
                      </div>
                      <div className="flex border-b border-white/5 py-1">
                        <span className="w-28 text-gray-500">Válido hasta:</span>
                        <span>{new Date(sslResult.validTo).toLocaleDateString()}</span>
                      </div>
                      <div className="flex border-b border-white/5 py-1">
                        <span className="w-28 text-gray-500">Días Restantes:</span>
                        <span className={`font-bold ${sslResult.isExpired ? 'text-red-400' : 'text-emerald-400'}`}>
                          {sslResult.isExpired ? 'CADUCADO' : `${sslResult.daysRemaining} días`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Connection Security */}
                  <div className="p-4 bg-[var(--bg-primary)]/20 border border-[var(--panel-border)] rounded-xl flex flex-col gap-3">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-purple-400" />
                      Seguridad y Cifrado de Enlace
                    </span>
                    <div className="flex flex-col gap-2 font-mono text-[10px] text-gray-300">
                      <div className="flex border-b border-white/5 py-1">
                        <span className="w-28 text-gray-500">Protocolo SSL:</span>
                        <span className="text-purple-400 font-bold">{sslResult.protocol}</span>
                      </div>
                      <div className="flex border-b border-white/5 py-1">
                        <span className="w-28 text-gray-500">Suite de Cifrado:</span>
                        <span className="text-white text-[9px] truncate">{sslResult.cipher}</span>
                      </div>
                      <div className="flex flex-col py-1">
                        <span className="text-gray-500 mb-1">Huella Digital SHA-256 (Fingerprint):</span>
                        <span className="text-[9px] font-mono p-1 bg-black/40 border border-white/5 rounded text-gray-400 break-all">
                          {sslResult.fingerprint256}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 border border-dashed border-white/10 rounded-xl">
                <Globe className="w-12 h-12 text-gray-700 animate-pulse mb-3.5" />
                <span className="text-xs text-gray-500 text-center max-w-sm">
                  Introduce el dominio de un sitio web arriba (ej. google.com) y haz click en "Analizar" para diagnosticar su seguridad SSL/HTTPS nativa.
                </span>
              </div>
            )}

          </div>
        </div>
      )}

      {/* VIEW 7: WAKE ON LAN (WoL) */}
      {activeSubTool === 'wol' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4 select-none">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-400">
                <Power className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider title-font">
                  Wake on LAN (WoL)
                </h2>
                <p className="text-[10px] text-gray-500">
                  Enciende servidores u ordenadores remotos apagados enviando un Magic Packet a través de la red local
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-5 min-h-0">
            {/* PANEL DE CONFIGURACIÓN */}
            <div className="glass-panel p-5 flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400 mb-2 border-b border-white/5 pb-2">
                Configuración del Paquete Mágico
              </h3>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 font-semibold uppercase">
                  Dirección MAC de Destino
                </label>
                <input 
                  type="text"
                  placeholder="00:11:22:33:44:55"
                  value={wolMac}
                  onChange={e => setWolMac(formatMac(e.target.value))}
                  className="glass-input text-xs font-mono font-bold tracking-wider"
                  maxLength={17}
                />
                <span className="text-[8px] text-gray-500 leading-normal">
                  Identificador de hardware único de la tarjeta de red (NIC) que recibirá el paquete.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-1">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] text-gray-500 font-semibold uppercase">
                    IP de Broadcast / Host
                  </label>
                  <input 
                    type="text"
                    value={wolIp}
                    onChange={e => setWolIp(e.target.value)}
                    className="glass-input text-xs font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] text-gray-500 font-semibold uppercase">
                    Puerto UDP
                  </label>
                  <input 
                    type="number"
                    value={wolPort}
                    onChange={e => setWolPort(Number(e.target.value))}
                    className="glass-input text-xs font-mono"
                    min={1}
                    max={65535}
                  />
                </div>
              </div>

              <button 
                onClick={sendWol}
                disabled={wolSending || !wolMac}
                className="w-full glass-btn text-xs py-2.5 font-bold uppercase flex items-center justify-center gap-2 mt-4 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border-orange-500/30 disabled:opacity-50 select-none"
              >
                {wolSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Transmitiendo...
                  </>
                ) : (
                  <>
                    <Power className="w-4 h-4" />
                    Enviar Magic Packet
                  </>
                )}
              </button>
            </div>

            {/* PANEL DE LOGS Y RESULTADOS */}
            <div className="md:col-span-2 glass-panel p-5 flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Consola de Transmisión WoL
                </h3>
                {wolLogs.length > 0 && (
                  <button 
                    onClick={() => setWolLogs([])}
                    className="text-[9px] text-gray-500 hover:text-white uppercase font-semibold transition-colors select-none"
                  >
                    Limpiar Logs
                  </button>
                )}
              </div>

              <div className="flex-1 p-3 bg-black/50 border border-white/5 rounded-lg font-mono text-[10px] text-gray-300 overflow-y-auto leading-relaxed select-text">
                {wolLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-600 font-sans">
                    <Power className="w-8 h-8 mb-2 opacity-30 animate-pulse text-orange-500" />
                    <span>Listo para transmitir. Introduce la MAC arriba y presiona "Enviar".</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {wolLogs.map((log, i) => (
                      <div key={i} className={log.includes('❌') ? 'text-rose-400' : log.includes('🚀') ? 'text-emerald-400' : 'text-gray-300'}>
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
