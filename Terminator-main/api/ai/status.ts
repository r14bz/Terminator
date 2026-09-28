import { statusHandler } from '../../server/aiHandlers.js';

export default function handler(req: any, res: any) {
  return statusHandler(req, res);
}
