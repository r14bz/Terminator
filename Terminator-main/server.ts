import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { statusHandler, chatHandler, diagnoseHandler } from './server/aiHandlers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '15mb' }));

  // Endpoint AI (logika ada di server/aiHandlers.ts, dipakai juga oleh api/ai/* di Vercel)
  app.get('/api/ai/status', statusHandler);
  app.post('/api/ai/chat', chatHandler);
  app.post('/api/ai/diagnose', diagnoseHandler);

  // Direct ZIP download endpoint for GitHub export
  app.get(['/api/download-zip', '/terminator-network-simulator.zip'], (_req, res) => {
    const zipPath = path.join(__dirname, 'terminator-network-simulator.zip');
    const publicZip = path.join(__dirname, 'public', 'terminator-network-simulator.zip');
    const targetFile = fs.existsSync(zipPath) ? zipPath : fs.existsSync(publicZip) ? publicZip : null;

    if (targetFile) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="terminator-network-simulator.zip"');
      res.sendFile(targetFile);
    } else {
      res.status(404).send('File terminator-network-simulator.zip belum tersedia.');
    }
  });

  // Mount Vite middleware in development or serve static files in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Terminator Network Simulator server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
