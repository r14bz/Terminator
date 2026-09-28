import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Sparkles,
  Bot,
  User,
  ExternalLink,
  Copy,
  Check,
  RotateCcw,
  Globe,
  Radio,
  Minimize2,
  Maximize2,
  Cpu,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import type { NetworkNode, CableConnection, DiagnosticIssue } from '../types/network';
import {
  sendAiChatMessage,
  runAiTopologyDiagnosis,
  checkAiStatus,
  type AiChatMessage,
  type AiTopologyContext,
  type AiStatusInfo,
} from '../utils/aiService';

interface NetworkAIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: NetworkNode[];
  cables: CableConnection[];
  issues: DiagnosticIssue[];
  opticalResults: Map<string, any>;
  initialPrompt?: string;
  selectedNode?: NetworkNode | null;
  onFocusNode?: (nodeId: string) => void;
}

export const NetworkAIChatModal: React.FC<NetworkAIChatModalProps> = ({
  isOpen,
  onClose,
  nodes,
  cables,
  issues,
  opticalResults,
  initialPrompt,
  selectedNode,
}) => {
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Halo! Saya **TERMINATOR AI**, asisten spesialis teknisi jaringan ISP & FTTH.

Saya siap membantu Anda:
- 🔍 **Mendiagnosa masalah topologi** (kabel putus, redaman optik tinggi, loop switch, IP conflict).
- ⚡ **Menghitung & audit redaman optik** GPON ITU-T G.984 (-8 s/d -27 dBm).
- 💻 **Membuat konfigurasi CLI** (MikroTik RouterOS v6/v7, Cisco, ONT ZTE/Huawei, OLT).
- 🌐 **Mencari solusi vendor & standar terkini** menggunakan Google Search Grounding.

Ada yang bisa saya bantu dengan topologi Anda saat ini?`,
      timestamp: Date.now(),
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [includeTopology, setIncludeTopology] = useState(true);
  const [enableSearch, setEnableSearch] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatusInfo>({
    available: false,
    provider: 'openrouter',
    providerName: 'OpenRouter AI',
    model: 'deepseek/deepseek-chat',
    searchGroundingSupported: false,
    availableModels: [],
  });
  const [selectedModel, setSelectedModel] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      checkAiStatus().then((res) => {
        setAiStatus(res);
        if (!selectedModel) {
          setSelectedModel(res.model);
        }
      });
      scrollToBottom();
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  // Handle initial prompt injection (e.g. from troubleshooting issue or node inspector)
  useEffect(() => {
    if (isOpen && initialPrompt) {
      handleSend(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialPrompt]);

  const buildTopologyContext = (): AiTopologyContext => {
    const opticalStats: any[] = [];
    nodes.forEach((n) => {
      const opt = opticalResults.get(n.id);
      if (opt) {
        opticalStats.push({
          nodeId: n.id,
          nodeName: n.name,
          rxPowerDbm: opt.rxPowerDbm,
          status: opt.status,
        });
      }
    });

    return {
      summary: `Topologi Terminator dengan ${nodes.length} node dan ${cables.length} sambungan kabel`,
      nodes,
      cables,
      issues,
      opticalStats,
      selectedDevice: selectedNode
        ? {
            id: selectedNode.id,
            name: selectedNode.name,
            type: selectedNode.type,
            model: selectedNode.model,
            ipConfig: selectedNode.ipConfig,
            ports: selectedNode.ports?.map((p) => ({
              name: p.name,
              medium: p.medium,
              status: p.status,
              connectedCableId: p.connectedCableId,
            })),
          }
        : undefined,
    };
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    const userMsg: AiChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      const context = includeTopology ? buildTopologyContext() : undefined;
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await sendAiChatMessage(
        history,
        context,
        enableSearch,
        selectedModel || aiStatus.model
      );

      const assistantMsg: AiChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        sources: res.sources,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: AiChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Gagal mendapatkan respon AI:** ${err?.message || 'Terjadi gangguan koneksi ke Gemini API.'}`,
        timestamp: Date.now(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunFullDiagnosis = async () => {
    if (isLoading) return;
    setIsLoading(true);

    const promptText = 'Jalankan diagnosa menyeluruh terhadap topologi jaringan ini.';
    const userMsg: AiChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: promptText,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const optRecord: Record<string, any> = {};
      opticalResults.forEach((val, key) => {
        optRecord[key] = val;
      });

      const res = await runAiTopologyDiagnosis({
        nodes,
        cables,
        issues,
        opticalResults: optRecord,
      });

      const assistantMsg: AiChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.report,
        sources: res.sources,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: AiChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Diagnosa Gagal:** ${err?.message || 'Tidak dapat memproses diagnosa AI.'}`,
        timestamp: Date.now(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-2 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden transition-all duration-200 ${
          isMaximized
            ? 'h-[96vh] w-[96vw]'
            : 'h-[88vh] w-full max-w-3xl sm:h-[85vh]'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between border-b border-slate-200 px-4 py-3 text-white transition-colors ${
            aiStatus.provider === 'openrouter'
              ? 'bg-linear-to-r from-slate-950 via-purple-950 to-slate-900'
              : 'bg-linear-to-r from-slate-900 via-sky-950 to-slate-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl border shadow-xs ${
                aiStatus.provider === 'openrouter'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-400/30'
                  : 'bg-sky-500/20 text-sky-400 border-sky-400/30'
              }`}
            >
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold tracking-tight text-white leading-tight">
                  TERMINATOR AI
                </h2>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                    aiStatus.provider === 'openrouter'
                      ? 'bg-purple-500/30 border-purple-400/50 text-purple-200'
                      : aiStatus.provider === 'opencode'
                      ? 'bg-emerald-500/30 border-emerald-400/50 text-emerald-200'
                      : 'bg-sky-500/30 border-sky-400/40 text-sky-200'
                  }`}
                >
                  {aiStatus.providerName} ({selectedModel || aiStatus.model})
                </span>
                {aiStatus.searchGroundingSupported && (
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    <Globe className="h-3 w-3" />
                    Google Search
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300">
                Konsultan & Troubleshooter Jaringan FTTH, MikroTik, Switch & IP
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-slate-300">
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="rounded-lg p-1.5 hover:bg-white/10 hover:text-white transition-colors"
              title={isMaximized ? 'Perkecil jendela' : 'Perbesar jendela'}
            >
              {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 hover:bg-white/10 hover:text-white transition-colors"
              title="Tutup AI Asisten"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* OpenRouter Model Switcher Sub-Bar */}
        {aiStatus.provider === 'openrouter' && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-200 bg-purple-50/90 px-4 py-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-purple-600 animate-pulse" />
              <span className="font-bold text-purple-950 text-[11px]">
                Pilihan Model OpenRouter:
              </span>
              <select
                value={selectedModel || aiStatus.model}
                onChange={(e) => setSelectedModel(e.target.value)}
                aria-label="Pilih Model OpenRouter"
                className="rounded-lg border border-purple-300 bg-white px-2 py-1 text-xs font-semibold text-purple-900 shadow-2xs focus:ring-2 focus:ring-purple-400 focus:outline-hidden"
              >
                <option value="deepseek/deepseek-chat">DeepSeek V3 (Chat & Cepat - Rekomendasi)</option>
                <option value="liquid/lfm-2.5-2.6b:free">Liquid LFM 2.6B (Free Tier)</option>
                <option value="google/gemma-4-26b-a4b-it:free">Google Gemma 4 (Free Tier)</option>
                <option value="meta-llama/llama-3.3-70b-instruct">Meta Llama 3.3 70B</option>
                <option value="openai/gpt-4o-mini">OpenAI GPT-4o Mini</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-purple-800 font-semibold bg-purple-100/70 px-2 py-0.5 rounded-full border border-purple-200">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>OpenRouter API Key Aktif</span>
            </div>
          </div>
        )}

        {/* Live Topology Context Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-medium text-[11px]">
              Topologi Terpantau: <strong>{nodes.length}</strong> Perangkat, <strong>{cables.length}</strong> Kabel
            </span>
            {issues.length > 0 ? (
              <span className="flex items-center gap-1 rounded-md bg-rose-100 text-rose-800 px-1.5 py-0.5 text-[10px] font-bold">
                <AlertTriangle className="h-3 w-3" />
                {issues.length} Masalah
              </span>
            ) : (
              <span className="rounded-md bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[10px] font-semibold">
                ✓ Normal
              </span>
            )}
            {selectedNode && (
              <span className="hidden md:inline rounded-md bg-sky-100 text-sky-800 px-1.5 py-0.5 text-[10px] font-medium">
                Aktif: {selectedNode.name} ({selectedNode.type})
              </span>
            )}
          </div>

          {/* Quick Action Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            <button
              onClick={handleRunFullDiagnosis}
              disabled={isLoading}
              className="flex items-center gap-1 rounded-lg border border-sky-300 bg-sky-50 px-2 py-1 text-[11px] font-bold text-sky-700 hover:bg-sky-100 transition-colors shadow-2xs whitespace-nowrap disabled:opacity-50"
            >
              <Cpu className="h-3 w-3 text-sky-600" />
              <span>Diagnosa Penuh AI</span>
            </button>
            <button
              onClick={() => handleSend('Bagaimana status redaman optik dBm pada topologi ini menurut standar ITU-T G.984?')}
              disabled={isLoading}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs whitespace-nowrap disabled:opacity-50"
            >
              <Radio className="h-3 w-3 text-purple-600" />
              <span>Cek Redaman (dBm)</span>
            </button>
            <button
              onClick={() => handleSend('Berikan contoh script konfigurasi MikroTik RouterOS yang aman untuk topologi ini.')}
              disabled={isLoading}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs whitespace-nowrap disabled:opacity-50"
            >
              <Lightbulb className="h-3 w-3 text-amber-600" />
              <span>Script MikroTik</span>
            </button>
          </div>
        </div>

        {/* Chat Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/60">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-2xs">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`group relative max-w-[85%] rounded-2xl p-4 text-xs shadow-2xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-sky-600 text-white rounded-tr-xs'
                    : msg.isError
                    ? 'bg-rose-50 text-rose-900 border border-rose-200 rounded-tl-xs'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs'
                }`}
              >
                {/* Content with rich markdown styling */}
                <div className="prose prose-xs max-w-none text-xs space-y-2 whitespace-pre-wrap break-words leading-relaxed font-sans">
                  {msg.content}
                </div>

                {/* Grounding Sources (Google Search) */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200/80">
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      <Globe className="h-3 w-3 text-sky-600" />
                      <span>Sumber Referensi (Google Search Grounding):</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.map((source, idx) => (
                        <a
                          key={idx}
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-sky-700 hover:bg-sky-100 hover:text-sky-900 transition-colors border border-slate-200/70"
                          title={source.uri}
                        >
                          <span className="truncate max-w-[200px]">{source.title || source.uri}</span>
                          <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-70" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Copy button */}
                <button
                  onClick={() => handleCopy(msg.content, msg.id)}
                  className={`absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 rounded-md p-1 transition-opacity ${
                    msg.role === 'user'
                      ? 'bg-sky-700/80 text-white hover:bg-sky-800'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                  title="Salin teks jawaban"
                >
                  {copiedId === msg.id ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>

              {msg.role === 'user' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white shadow-2xs">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start items-center">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-2xs animate-pulse">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl rounded-tl-xs bg-white border border-slate-200 p-3.5 shadow-2xs flex items-center gap-2.5 text-xs text-slate-500">
                <span className="flex h-2 w-2 rounded-full bg-sky-600 animate-ping" />
                <span>TERMINATOR AI sedang menganalisa topologi & mencari referensi...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Footer & Input Controls */}
        <div className="border-t border-slate-200 bg-white p-3 sm:p-4 space-y-2">
          {/* Toggles */}
          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 gap-2">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeTopology}
                  onChange={(e) => setIncludeTopology(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>Sertakan Data Topologi Aktif</span>
              </label>

              {aiStatus.searchGroundingSupported && (
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={enableSearch}
                    onChange={(e) => setEnableSearch(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span className="flex items-center gap-1">
                    <Globe className="h-3 w-3 text-sky-600" />
                    Google Search Grounding
                  </span>
                </label>
              )}
            </div>

            <button
              onClick={() =>
                setMessages([
                  {
                    id: 'welcome-reset',
                    role: 'assistant',
                    content: 'Riwayat percakapan telah dibersihkan. Silakan tanyakan hal lain terkait topologi atau konfigurasi Anda!',
                    timestamp: Date.now(),
                  },
                ])
              }
              className="flex items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors"
              title="Bersihkan percakapan"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Bersihkan Chat</span>
            </button>
          </div>

          {/* Text Input Row */}
          <div className="relative flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tanya kendala jaringan, perbaikan optical power, VLAN, MikroTik CLI... (Enter kirim, Shift+Enter baris baru)"
              rows={2}
              className="flex-1 resize-none rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 disabled:bg-slate-100 transition-all"
              disabled={isLoading}
            />

            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white hover:bg-sky-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-sm transition-all"
              title="Kirim pesan"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
