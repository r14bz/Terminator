import { diagnoseHandler } from '../../server/aiHandlers.js';

export const config = { maxDuration: 60 };

export default function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return diagnoseHandler(req, res);
}
