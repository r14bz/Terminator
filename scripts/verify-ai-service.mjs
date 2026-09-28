import assert from 'node:assert/strict';
import { checkAiStatus, sendAiChatMessage, runAiTopologyDiagnosis } from '../src/utils/aiService.ts';

let n = 0;
const ok = (m, c) => { n++; assert.ok(c, m); };
const stub = (status, body) => {
  globalThis.fetch = async () => new Response(body, { status });
};
const rejectsWith = async (fn, re) => {
  try { await fn(); return false; } catch (e) { return re.test(e.message); }
};

// Static host: platform 404 page
stub(404, '<html>404</html>');
ok('chat 404 HTML -> pesan backend tidak tersedia', await rejectsWith(() => sendAiChatMessage([{ role: 'user', content: 'hi' }]), /tidak tersedia/));
ok('diagnose 404 HTML -> pesan backend tidak tersedia', await rejectsWith(() => runAiTopologyDiagnosis({ nodes: [], cables: [], issues: [] }), /tidak tersedia/));
ok('status 404 -> available:false', (await checkAiStatus()).available === false);

// SPA fallback: 200 + index.html
stub(200, '<!doctype html><html></html>');
ok('chat 200 HTML -> bukan error parsing JSON', await rejectsWith(() => sendAiChatMessage([{ role: 'user', content: 'hi' }]), /tidak tersedia/));
ok('status 200 HTML -> available:false', (await checkAiStatus()).available === false);

// Real backend error keeps its own message
stub(500, JSON.stringify({ error: 'Kunci API tidak valid' }));
ok('500 JSON -> pesan server dipertahankan', await rejectsWith(() => sendAiChatMessage([{ role: 'user', content: 'hi' }]), /Kunci API tidak valid/));

// Happy path
stub(200, JSON.stringify({ reply: 'halo', sources: [], model: 'm' }));
const r = await sendAiChatMessage([{ role: 'user', content: 'hi' }]);
ok('sukses -> reply diteruskan', r.reply === 'halo');
stub(200, JSON.stringify({ available: true, model: 'm', searchGroundingSupported: true }));
ok('status valid -> available:true', (await checkAiStatus()).available === true);

console.log(`ok — ${n} assertions passed`);
