import type { NetworkNode, CableConnection, DiagnosticIssue } from '../types/network';

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sources?: Array<{ title: string; uri: string }>;
  isError?: boolean;
}

export interface AiTopologyContext {
  summary?: string;
  nodes?: NetworkNode[];
  cables?: CableConnection[];
  issues?: DiagnosticIssue[];
  opticalStats?: Array<{
    nodeId: string;
    nodeName: string;
    rxPowerDbm?: number | null;
    status?: string;
  }>;
  selectedDevice?: any;
}

export interface AiStatusInfo {
  available: boolean;
  provider?: 'openrouter' | 'opencode' | 'gemini' | string;
  providerName?: string;
  model: string;
  searchGroundingSupported: boolean;
  availableModels?: Array<{ id: string; name: string }>;
}

export async function checkAiStatus(): Promise<AiStatusInfo> {
  try {
    const res = await fetch('/api/ai/status');
    if (!res.ok) {
      return {
        available: false,
        provider: 'gemini',
        providerName: 'Google Gemini',
        model: 'gemini-3.8-flash',
        searchGroundingSupported: false,
        availableModels: [],
      };
    }
    return await res.json();
  } catch {
    return {
      available: false,
      provider: 'gemini',
      providerName: 'Google Gemini',
      model: 'gemini-3.8-flash',
      searchGroundingSupported: false,
      availableModels: [],
    };
  }
}

export async function sendAiChatMessage(
  messages: Array<{ role: 'user' | 'model' | 'assistant'; content: string }>,
  context?: AiTopologyContext,
  enableSearch: boolean = true,
  model?: string
): Promise<{ reply: string; sources: Array<{ title: string; uri: string }>; model?: string }> {
  const formattedMessages = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : m.role,
    content: m.content,
  }));

  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: formattedMessages,
      context,
      enableSearch,
      model,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}: Gagal memproses permintaan AI.`);
  }

  return {
    reply: data.reply || '',
    sources: data.sources || [],
    model: data.model,
  };
}

export async function runAiTopologyDiagnosis(
  topology: {
    nodes: NetworkNode[];
    cables: CableConnection[];
    issues: DiagnosticIssue[];
    opticalResults?: Record<string, any>;
  },
  focusNodeId?: string,
  userQuery?: string
): Promise<{ report: string; sources: Array<{ title: string; uri: string }> }> {
  const res = await fetch('/api/ai/diagnose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topology,
      focusNodeId,
      userQuery,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}: Gagal menjalankan diagnosa AI.`);
  }

  return {
    report: data.report || '',
    sources: data.sources || [],
  };
}
