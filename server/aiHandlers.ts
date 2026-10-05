import { GoogleGenAI } from '@google/genai';

/**
 * Logika AI bersama. Dipakai oleh:
 *  - server.ts            -> Express (npm run dev / npm start, AI Studio)
 *  - api/ai/*.ts          -> Vercel Serverless Functions
 * Handler memakai bentuk (req, res) yang kompatibel dengan Express maupun Vercel.
 */

// Klien Gemini dibuat lazy agar tidak crash saat GEMINI_API_KEY kosong
let _ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!_ai) {
    _ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return _ai;
}

// Helper to determine AI configuration (Gemini vs OpenRouter vs OpenCode)
function getAiConfig() {
  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  const openrouterKey =
    process.env.OPENROUTER_API_KEY ||
    (process.env.OPENCODE_API_KEY?.startsWith('sk-or-v1-') ? process.env.OPENCODE_API_KEY : '') ||
    (process.env.AI_PROVIDER?.toLowerCase().trim() === 'openrouter'
      ? process.env.OPENCODE_API_KEY || process.env.CUSTOM_AI_API_KEY
      : '') ||
    '';

  const opencodeApiKey =
    process.env.OPENCODE_API_KEY || process.env.CUSTOM_AI_API_KEY || '';

  const openrouterBaseUrl = (
    process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
  ).replace(/\/+$/, '');

  let opencodeBaseUrl = (
    process.env.OPENCODE_BASE_URL ||
    (process.env.OPENROUTER_BASE_URL && !process.env.OPENROUTER_BASE_URL.includes('openrouter.ai')
      ? process.env.OPENROUTER_BASE_URL
      : 'https://opencode.ai/zen/v1')
  ).replace(/\/+$/, '');

  if (opencodeBaseUrl.includes('api.opencode.ai')) {
    opencodeBaseUrl = 'https://opencode.ai/zen/v1';
  }

  const rawModel = (
    process.env.OPENROUTER_MODEL ||
    process.env.OPENCODE_MODEL ||
    ''
  ).trim();

  // Provider determination
  const explicitProvider = process.env.AI_PROVIDER?.toLowerCase().trim();
  let provider: 'openrouter' | 'opencode' | 'gemini' = 'gemini';

  if (
    explicitProvider === 'openrouter' ||
    openrouterKey ||
    opencodeApiKey.startsWith('sk-or-v1-') ||
    process.env.OPENROUTER_BASE_URL?.includes('openrouter.ai')
  ) {
    provider = 'openrouter';
  } else if (
    explicitProvider === 'opencode' ||
    (opencodeApiKey && !opencodeApiKey.startsWith('sk-or-v1-'))
  ) {
    provider = 'opencode';
  } else if (explicitProvider === 'gemini') {
    provider = 'gemini';
  } else if (geminiApiKey) {
    provider = 'gemini';
  }

  const isOpenrouter = provider === 'openrouter';
  const isOpencode = provider === 'opencode';
  const isGemini = provider === 'gemini';

  let activeModel = rawModel;
  if (isOpenrouter) {
    if (!activeModel || activeModel.toLowerCase() === 'all') {
      activeModel = 'deepseek/deepseek-chat';
    }
  } else if (isOpencode) {
    if (!activeModel || activeModel.toLowerCase() === 'all') {
      activeModel = 'big-pickle';
    }
  } else {
    activeModel = 'gemini-3.8-flash';
  }

  const activeApiKey = isOpenrouter
    ? openrouterKey || opencodeApiKey
    : isOpencode
    ? opencodeApiKey
    : geminiApiKey;

  const isAvailable = Boolean(activeApiKey);
  const providerName = isOpenrouter
    ? 'OpenRouter AI'
    : isOpencode
    ? 'OpenCode AI'
    : 'Google Gemini';

  const baseUrl = isOpenrouter
    ? openrouterBaseUrl
    : isOpencode
    ? opencodeBaseUrl
    : '';

  return {
    provider,
    providerName,
    isOpenrouter,
    isOpencode,
    isGemini,
    isAvailable,
    activeApiKey,
    activeModel,
    baseUrl,
    openrouterBaseUrl,
    opencodeBaseUrl,
    geminiApiKey,
  };
}
// Helper to call OpenAI-compatible API (OpenRouter or OpenCode)
async function callOpenAICompatibleChat({
  messages,
  systemInstruction,
  config,
  overrideModel,
}: {
  messages: Array<{ role: string; content: string }>;
  systemInstruction: string;
  config: ReturnType<typeof getAiConfig>;
  overrideModel?: string;
}): Promise<{ reply: string; usedModel: string; sources: Array<{ title: string; uri: string }> }> {
  const modelToUse = overrideModel || config.activeModel;
  const formattedMessages = [
    { role: 'system', content: systemInstruction },
    ...messages.map((m) => ({
      role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
  ];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.activeApiKey}`,
  };

  if (config.isOpenrouter) {
    headers['HTTP-Referer'] = 'https://aistudio.google.com';
    headers['X-Title'] = 'TERMINATOR Network Simulator';
  }

  // List of models to try in case the selected one is busy/rate-limited on free tier
  const modelsToTry = [modelToUse];
  if (config.isOpenrouter) {
    const freeFallbacks = [
      'deepseek/deepseek-chat',
      'liquid/lfm-2.5-2.6b:free',
      'google/gemma-4-26b-a4b-it:free',
    ];
    for (const fb of freeFallbacks) {
      if (!modelsToTry.includes(fb)) {
        modelsToTry.push(fb);
      }
    }
  }

  let lastError: any = null;

  for (const currentModel of modelsToTry) {
    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: currentModel,
          messages: formattedMessages,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let parsedError = errorText;
        try {
          const jsonErr = JSON.parse(errorText);
          parsedError = jsonErr.error?.message || jsonErr.error || errorText;
        } catch {}

        if (
          response.status === 403 &&
          (errorText.includes('FreeTierError') || errorText.includes('free tier'))
        ) {
          throw new Error(
            `OpenCode FreeTierError: Model '${currentModel}' dibatasi khusus untuk OpenCode CLI.`
          );
        }

        if (response.status === 404 && errorText.includes('No such model')) {
          throw new Error(`Model '${currentModel}' tidak ditemukan di ${config.providerName}.`);
        }

        throw new Error(`${config.providerName} (${response.status}): ${parsedError}`);
      }

      const data = (await response.json()) as any;
      const reply =
        data.choices?.[0]?.message?.content ||
        `Tidak ada respon dari ${config.providerName}.`;

      return {
        reply,
        usedModel: currentModel,
        sources: [],
      };
    } catch (err: any) {
      lastError = err;
      if (modelsToTry.indexOf(currentModel) < modelsToTry.length - 1) {
        console.log(
          `Model ${currentModel} failed on ${config.providerName} (${err.message}), trying fallback ${modelsToTry[modelsToTry.indexOf(currentModel) + 1]}...`
        );
        continue;
      }
    }
  }

  throw lastError;
}
  // Intelligent Rule-Based Offline Network Diagnostic Engine
  // Ensures the simulator NEVER fails, even during API rate-limits (429) or upstream outages
  function generateOfflineExpertResponse({
    messages,
    context,
    isDiagnose = false,
    topology,
    causeNotice,
  }: {
    messages?: Array<{ role: string; content: string }>;
    context?: any;
    isDiagnose?: boolean;
    topology?: any;
    causeNotice?: string;
  }): string {
    const lastUserMsg =
      messages && messages.length > 0
        ? messages[messages.length - 1].content
        : topology?.userQuery || 'Diagnosa dan optimasi jaringan FTTH/IP';

    const nodes = context?.nodes || topology?.nodes || [];
    const cables = context?.cables || topology?.cables || [];
    const issues = context?.issues || topology?.issues || [];
    const optical = context?.opticalStats || topology?.opticalResults || [];

    let res = `> 💡 **TERMINATOR AI (Mesin Diagnosa Jaringan Terintegrasi)**\n`;
    if (causeNotice) {
      res += `> *${causeNotice}*\n\n`;
    } else {
      res += `> *Analisa otomatis berbasis arsitektur telekomunikasi ISP & standar ITU-T G.984.*\n\n`;
    }

    res += `### 📡 Ringkasan Evaluasi Topologi\n`;
    res += `- **Total Perangkat Aktif**: ${nodes.length} node (${nodes.map((n: any) => n.name || n.type).slice(0, 5).join(', ')}${nodes.length > 5 ? '...' : ''})\n`;
    res += `- **Jalur Kabel Terpasang**: ${cables.length} link kabel\n`;

    const brokenCables = cables.filter((c: any) => c.isBroken);
    if (brokenCables.length > 0) {
      res += `- ⚠️ **Kabel Putus / Link Down Terdeteksi**: ${brokenCables.length} jalur kabel mengalami kerusakan fisik atau sambungan putus!\n`;
    }

    if (issues && issues.length > 0) {
      res += `\n### 🔍 Masalah Terdeteksi (${issues.length} Temuan):\n`;
      issues.forEach((iss: any, idx: number) => {
        res += `${idx + 1}. **[${iss.severity?.toUpperCase() || 'PERINGATAN'}] ${iss.title}** (${iss.category || 'Jaringan'})\n`;
        if (iss.cause) res += `   - *Penyebab*: ${iss.cause}\n`;
        if (iss.solution) res += `   - *Solusi Saran*: ${iss.solution}\n`;
      });
    } else {
      res += `- ✅ **Status Diagnosa**: Tidak ditemukan anomali kritis. Jalur transmisi topologi stabil.\n`;
    }

    res += `\n### 🛠️ Panduan & Solusi Teknis Lapangan:\n`;
    res += `Terkait pertanyaan Anda: *"${lastUserMsg}"*\n\n`;

    const lowerMsg = lastUserMsg.toLowerCase();
    if (
      lowerMsg.includes('redaman') ||
      lowerMsg.includes('dbm') ||
      lowerMsg.includes('fiber') ||
      lowerMsg.includes('ont') ||
      lowerMsg.includes('olt') ||
      lowerMsg.includes('gpon') ||
      lowerMsg.includes('odc') ||
      lowerMsg.includes('odp')
    ) {
      res += `#### Standar Redaman Optik FTTH GPON (ITU-T G.984):
1. **Nilai Optimal Daya Terima (Rx Power)**:
   - Rentang ideal: \`-18 dBm\` s/d \`-24 dBm\`
   - Rentang toleransi operasi: \`-8 dBm\` (maksimum) s/d \`-27 dBm\` (batas sensitivitas)
   - Status Kritis / Loss: Bila \`< -27 dBm\` (koneksi terputus/LOS) atau \`> -8 dBm\` (overload optik).
2. **Kalkulasi Redaman Elemen Pasif FTTH**:
   - Kabel Drop Core: Redaman rata-rata ~0.35 dB/km pada 1310/1490nm.
   - Sambungan Fast Connector / Fusion Splice: ~0.2 s/d 0.5 dB per titik.
   - Splitter PLC ODC/ODP:
     * Splitter 1:2 = ~3.5 dB
     * Splitter 1:4 = ~7.2 dB
     * Splitter 1:8 = ~10.5 dB
     * Splitter 1:16 = ~13.8 dB
3. **Langkah Penanganan Lapangan (Troubleshooting Redaman)**:
   - Bersihkan ujung adapter SC/UPC dengan optical pen cleaner atau alkohol isopropil 99%.
   - Cek bending radius kabel FO (pastikan radius lekukan > 30 mm untuk mencegah macrobending loss).
   - Gunakan VFL (Visual Fault Locator) untuk melacak kebocoran laser di sepanjang tarikan drop core.
`;
    } else if (
      lowerMsg.includes('mikrotik') ||
      lowerMsg.includes('router') ||
      lowerMsg.includes('ip') ||
      lowerMsg.includes('nat') ||
      lowerMsg.includes('dhcp') ||
      lowerMsg.includes('vlan') ||
      lowerMsg.includes('subnet')
    ) {
      res += `#### Rekomendasi Skrip Konfigurasi MikroTik RouterOS:
\`\`\`routeros
# 1. Konfigurasi Alamat IP Interface Gateway
/ip address
add address=192.168.10.1/24 interface=ether2-LAN comment="Gateway LAN Utama"

# 2. Setup DHCP Server Otomatis untuk Klien
/ip pool
add name=pool-lan ranges=192.168.10.10-192.168.10.200
/ip dhcp-server
add address-pool=pool-lan interface=ether2-LAN name=dhcp-lan disabled=no
/ip dhcp-server network
add address=192.168.10.0/24 gateway=192.168.10.1 dns-server=8.8.8.8,1.1.1.1 comment="Network LAN"

# 3. Setup NAT Masquerade Akses Internet
/ip firewall nat
add chain=srcnat out-interface=ether1-WAN action=masquerade comment="NAT Internet WAN"

# 4. Default Gateway Routing
/ip route
add gateway=192.168.1.1 comment="Default Gateway ISP"
\`\`\`
`;
    } else {
      res += `1. **Pemeriksaan Layer 1 & 2 (Media Fisik & Tautan Kabel)**:
   - Pastikan tipe kabel sesuai port: Fiber SC/UPC untuk port optik, RJ45 Cat5e/6 untuk Ethernet/LAN.
   - Periksa port interface dalam kondisi aktif (*Link Up*) dan tidak ada kabel yang berstatus *broken*.
2. **Pemeriksaan Layer 3 (Pengalamatan IP & Routing)**:
   - Pastikan setiap perangkat yang berada dalam satu segmen LAN memiliki subnet mask yang sama.
   - Pastikan Gateway mengarah tepat ke IP router/interface router aktif.
3. **Uji Konektivitas**:
   - Jalankan fitur Ping di simulator untuk menguji transit paket data dan memastikan tidak ada paket loss.
`;
    }

    res += `\n*Tips: Anda dapat menanyakan panduan konfigurasi perangkat spesifik (MikroTik, Switch L2/L3, OLT ZTE C320, Cisco, atau ONT).*`;
    return res;
  }
// Helper to run generation with fallback between supported 2026 models
async function generateWithGeminiFallback(options: {
  contents: any;
  config: any;
}) {
  const primaryModel = 'gemini-3.8-flash';
  const backupModel = 'gemini-3.1-flash-lite';

  try {
    return await getGeminiClient().models.generateContent({
      model: primaryModel,
      contents: options.contents,
      config: options.config,
    });
  } catch (err: any) {
    const isQuota =
      err?.status === 429 ||
      err?.message?.includes('429') ||
      err?.message?.includes('quota') ||
      err?.message?.includes('RESOURCE_EXHAUSTED');

    // If quota is exhausted on the API key, other models on the same key will also fail with 429.
    // Throw immediately to allow instant fallback to the offline expert diagnostic engine.
    if (isQuota) {
      throw err;
    }

    console.log(`Primary model (${primaryModel}) unavailable, trying backup (${backupModel})...`);
    try {
      return await getGeminiClient().models.generateContent({
        model: backupModel,
        contents: options.contents,
        config: options.config,
      });
    } catch (backupErr: any) {
      throw backupErr;
    }
  }
}
export function statusHandler(_req: any, res: any) {
  const cfg = getAiConfig();
  res.json({
    available: cfg.isAvailable,
    provider: cfg.provider,
    providerName: cfg.providerName,
    model: cfg.activeModel,
    searchGroundingSupported: cfg.isGemini,
    availableModels: cfg.isOpenrouter
      ? [
          { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3 (Rekomendasi Utama)' },
          { id: 'liquid/lfm-2.5-2.6b:free', name: 'Liquid LFM 2.6B (Free Tier)' },
          { id: 'google/gemma-4-26b-a4b-it:free', name: 'Google Gemma 4 (Free Tier)' },
          { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Meta Llama 3.3 70B' },
          { id: 'openai/gpt-4o-mini', name: 'OpenAI GPT-4o Mini' },
        ]
      : [],
  });
}
  export async function chatHandler(req: any, res: any) {
    try {
      const { messages, context, enableSearch = true, model } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Daftar pesan (messages) diperlukan.' });
      }

      const cfg = getAiConfig();

      if (!cfg.isAvailable) {
        return res.status(503).json({
          error: `Kunci API belum terpasang untuk provider ${cfg.providerName}. Mohon periksa file .env atau Secrets.`,
        });
      }

      // Format topology context into system instruction
      let contextBrief = '';
      if (context) {
        contextBrief = `
KONTEN TOPOLOGI JARINGAN SAAT INI DARI KANVAS TERMINATOR:
- Ringkasan: ${context.summary || 'Topologi aktif pengguna'}
- Jumlah Node Perangkat: ${context.nodesCount ?? (context.nodes ? context.nodes.length : 'N/A')}
- Jumlah Kabel: ${context.cablesCount ?? (context.cables ? context.cables.length : 'N/A')}
`;
        if (context.issues && context.issues.length > 0) {
          contextBrief += `- Masalah Diagnosa Terdeteksi (${context.issues.length} issue):
${context.issues
  .map(
    (iss: any, idx: number) =>
      `  ${idx + 1}. [${iss.severity?.toUpperCase() || 'INFO'}] ${iss.title} (${iss.category}): Penyebab: "${iss.cause}", Solusi saran: "${iss.solution}"`
  )
  .join('\n')}
`;
        } else {
          contextBrief += `- Status Diagnosa: Tidak ada masalah kritis atau peringatan terdeteksi (Kondisi Optimal).\n`;
        }

        if (context.selectedDevice) {
          contextBrief += `- Perangkat yang sedang dipilih/diinspeksi pengguna: ${JSON.stringify(context.selectedDevice, null, 2)}\n`;
        }

        if (context.nodes && Array.isArray(context.nodes)) {
          contextBrief += `- Daftar Perangkat di Topologi:\n${context.nodes
            .map(
              (n: any) =>
                `  • [ID: ${n.id}] Tipe: ${n.type}, Nama: "${n.name}", Model: "${n.model || '-'}", IP: ${n.ipConfig?.ip || 'N/A'}, Subnet: ${n.ipConfig?.subnet || 'N/A'}`
            )
            .join('\n')}\n`;
        }

        if (context.opticalStats && Array.isArray(context.opticalStats)) {
          contextBrief += `- Data Redaman Optik (dBm):\n${context.opticalStats
            .map(
              (o: any) =>
                `  • Node ${o.nodeName || o.nodeId}: Power Rx ${o.rxPowerDbm ?? '-'} dBm (Status: ${o.status || 'OK'})`
            )
            .join('\n')}\n`;
        }
      }

      const systemInstruction = `Anda adalah "TERMINATOR AI", Asisten & Konsultan Senior Network & FTTH Engineer spesialis jaringan telekomunikasi dan ISP.
Anda memiliki keahlian mendalam dalam:
1. Fiber To The Home (FTTH), GPON, OLT (ZTE C320, Huawei MA5608T, FiberHome), ODC, ODP, splitter ratio (1:4, 1:8, 1:16), batas redaman ITU-T G.984 (-8 dBm hingga -27 dBm).
2. Routing & Switching: MikroTik RouterOS (v6 & v7), Cisco IOS, Ruijie, VLAN 802.1Q, Bridge, Loop Protection (RSTP/MSTP), PPPoE Server/Client, Hotspot, NAT, Firewall Filter.
3. Troubleshooting & Pemecahan Masalah Jaringan: Diagnosa kabel putus, redaman tinggi (macrobending/kotor), loop switch, IP conflict, gateway unreachable, MTU, DNS.
4. Memberikan perintah konfigurasi CLI / skrip yang tepat, aman, dan langsung dapat dieksekusi oleh teknisi lapangan.

PANDUAN MENJAWAB:
- Berbicaralah dalam Bahasa Indonesia teknis yang profesional, ramah, dan solutif ala teknisi jaringan senior.
- Jika pengguna menanyakan tentang topologi yang ada, gunakan data konteks topologi terkini yang disertakan di bawah.
- Berikan langkah-langkah praktis dan terstruktur (1, 2, 3...) beserta perintah CLI (format code block markdown) bila relevan.
- Jika pengguna menanyakan perbaikan masalah (troubleshoot), jelaskan akar masalah (root cause), risiko yang mungkin terjadi, dan langkah mitigasinya.

${contextBrief}`;

      // Route to OpenRouter or OpenCode if configured
      if (cfg.isOpenrouter || cfg.isOpencode) {
        try {
          const result = await callOpenAICompatibleChat({
            messages,
            systemInstruction,
            config: cfg,
            overrideModel: model,
          });
          return res.json({
            reply: result.reply,
            sources: result.sources || [],
            provider: cfg.provider,
            providerName: cfg.providerName,
            model: result.usedModel || cfg.activeModel,
          });
        } catch (apiErr: any) {
          console.log(`${cfg.providerName} chat attempt notice:`, apiErr.message);
          // If Gemini is available, seamlessly fall back to Gemini so user is never blocked
          if (cfg.geminiApiKey) {
            console.log('Falling back to Google Gemini for chat response...');
            try {
              const contents = messages.map((m: { role: string; content: string }) => ({
                role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
                parts: [{ text: m.content }],
              }));
              const tools: any[] = [];
              if (enableSearch) {
                tools.push({ googleSearch: {} });
              }

              const response = await generateWithGeminiFallback({
                contents,
                config: {
                  systemInstruction,
                  tools: tools.length > 0 ? tools : undefined,
                },
              });

              const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
              const sources: Array<{ title: string; uri: string }> = [];
              for (const chunk of rawChunks) {
                if (chunk.web?.uri) {
                  sources.push({
                    title: chunk.web.title || chunk.web.uri,
                    uri: chunk.web.uri,
                  });
                }
              }

              const notice = `> ⚠️ **Info Provider (${cfg.providerName})**: ${apiErr.message}\n> *Permintaan otomatis dialihkan menggunakan model Google Gemini:*\n\n`;
              return res.json({
                reply: notice + (response.text || ''),
                sources,
                provider: 'gemini',
                providerName: 'Google Gemini',
                model: 'gemini-3.8-flash',
              });
            } catch (geminiErr: any) {
              console.log('Gemini fallback notice:', geminiErr?.message);
            }
          }
          const offlineReply = generateOfflineExpertResponse({
            messages,
            context,
            causeNotice: `${cfg.providerName}: ${apiErr.message}. Menampilkan analisis otomatis offline simulator:`,
          });
          return res.json({
            reply: offlineReply,
            sources: [],
            provider: cfg.provider,
            providerName: cfg.providerName,
            model: cfg.activeModel,
          });
        }
      }

      // Default: Google Gemini with search grounding
      const contents = messages.map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const tools: any[] = [];
      if (enableSearch) {
        tools.push({ googleSearch: {} });
      }

      const response = await generateWithGeminiFallback({
        contents,
        config: {
          systemInstruction,
          tools: tools.length > 0 ? tools : undefined,
        },
      });

      const replyText = response.text || 'Maaf, tidak ada respon yang dihasilkan.';

      // Extract search grounding citations if available
      const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources: Array<{ title: string; uri: string }> = [];

      for (const chunk of rawChunks) {
        if (chunk.web?.uri) {
          sources.push({
            title: chunk.web.title || chunk.web.uri,
            uri: chunk.web.uri,
          });
        }
      }

      res.json({
        reply: replyText,
        sources,
      });
    } catch (err: any) {
      console.log('Serving offline response in /api/ai/chat:', err?.message || err);
      // Resilience: Deliver instant expert diagnostic response rather than breaking the UI
      const isQuotaErr =
        err?.message?.includes('429') ||
        err?.message?.includes('quota') ||
        err?.message?.includes('RESOURCE_EXHAUSTED');
      const offlineReply = generateOfflineExpertResponse({
        messages: req.body?.messages,
        context: req.body?.context,
        causeNotice: isQuotaErr
          ? 'Batas kuota API (Rate Limit / Quota) pada penyedia cloud saat ini tercapai. Jawaban di bawah disajikan secara offline oleh Mesin Diagnosa Terintegrasi Simulator.'
          : `Layanan AI eksternal sedang mengalami kendala (${err?.message?.slice(0, 90)}). Jawaban di bawah dianalisis langsung oleh Mesin Diagnosa Jaringan Simulator.`,
      });
      res.json({
        reply: offlineReply,
        sources: [],
      });
    }
  }
  export async function diagnoseHandler(req: any, res: any) {
    try {
      const { topology, focusNodeId, userQuery } = req.body;

      if (!topology) {
        return res.status(400).json({ error: 'Data topologi diperlukan untuk diagnosa.' });
      }

      const cfg = getAiConfig();

      if (!cfg.isAvailable) {
        return res.status(503).json({
          error: `Kunci API belum terpasang untuk provider ${cfg.providerName}.`,
        });
      }

      const prompt = `Lakukan audit dan diagnosa jaringan mendalam secara komprehensif terhadap topologi berikut:

DATA TOPOLOGI:
- Total Node: ${topology.nodes?.length || 0}
- Total Kabel: ${topology.cables?.length || 0}
- Perangkat Terdaftar: ${JSON.stringify(
        (topology.nodes || []).map((n: any) => ({
          id: n.id,
          name: n.name,
          type: n.type,
          m