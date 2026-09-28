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

/**
 * Read a fetch Response as JSON without assuming the server that answered is
 * the Express app in server.ts.
 *
 * On a static host (this project's Vercel deployment only runs `vite build`;
 * server.ts is never started there) a POST to /api/ai/* is answered by the
 * platform itself: a 404/405 page, or index.html via an SPA fallback. Calling
 * `res.json()` straight on that throws "Unexpected token '<' ..." -- an error
 * that names a parsing problem instead of the real one, that the AI backend
 * simply isn't there. Report that instead.
 */
async function readAiJson(res: Response, fallbackMessage: string): Promise<any> {
  const raw = await res.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (data === null) {
    const backendMissing = res.status === 404 || res.status === 405 || res.ok;
    throw new Error(
      backendMissing
        ? 'Layanan AI tidak tersedia di deployment ini (server backend tidak berjalan). ' +
            'Fitur AI hanya aktif saat dijalankan dengan `npm run dev` / `npm start`, ' +
            'atau setelah endpoint /api/ai dipasang sebagai serverless function.'
        : `HTTP ${res.status}: ${fallbackMessage}`
    );
  }

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}: ${fallbackMessage}`);
  }
  return data;
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
    const info = await res.json();
    return info && typeof info.available === 'boolean'
      ? info
      : {
          available: false,
          provider: 'gemini',
          providerName: 'Google Gemini',
          model: 'gemini-3.8-flash',
          searchGroundingSupported: false,
          availableModels: [],
        };
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

  const data = await readAiJson(res, 'Gagal memproses permintaan AI.');

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

  const data = await readAiJson(res, 'Gagal menjalankan diagnosa AI.');

  return {
    report: data.report || '',
    sources: data.sources || [],
  };
}
