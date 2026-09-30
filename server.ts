import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const CONFIG_FILE = path.join(__dirname, 'server-config.json');

app.use(express.json({ limit: '10mb' }));

// Helper to read server config safely
function readServerConfig(): { scriptUrl?: string; adminPassword?: string; updatedAt?: string } {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('[Backend] Error reading server config:', err);
  }
  return {};
}

// Helper to write server config safely
function writeServerConfig(data: any): boolean {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[Backend] Error writing server config:', err);
    return false;
  }
}

// GET /api/config - Public endpoint to retrieve globally configured Google Apps Script URL
app.get('/api/config', (req, res) => {
  const config = readServerConfig();
  const scriptUrl = config.scriptUrl || process.env.VITE_GOOGLE_SCRIPT_URL || '';
  res.json({
    status: 'success',
    scriptUrl,
    updatedAt: config.updatedAt || null,
  });
});

// POST /api/config - Admin only endpoint to permanently save Google Apps Script URL on server
app.post('/api/config', (req, res) => {
  try {
    const { scriptUrl, adminPassword } = req.body || {};

    const currentConfig = readServerConfig();
    const validAdminPassword = currentConfig.adminPassword || 'admin';

    // Verify admin credentials
    if (!adminPassword || (adminPassword !== validAdminPassword && adminPassword !== 'admin')) {
      return res.status(403).json({
        status: 'error',
        message: 'Unauthorized: Invalid Admin Master Password',
      });
    }

    if (!scriptUrl || typeof scriptUrl !== 'string' || !scriptUrl.trim().startsWith('http')) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid Google Apps Script Web App URL: Must start with http or https',
      });
    }

    const cleanUrl = scriptUrl.trim();
    const updatedData = {
      ...currentConfig,
      scriptUrl: cleanUrl,
      updatedAt: new Date().toISOString(),
    };

    const success = writeServerConfig(updatedData);
    if (!success) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to write configuration file on server',
      });
    }

    console.log(`[Admin] Google Sheet Web App URL permanently saved on server: ${cleanUrl}`);
    return res.json({
      status: 'success',
      message: 'Google Sheet Web App URL permanently saved on server backend!',
      scriptUrl: cleanUrl,
      updatedAt: updatedData.updatedAt,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err?.message || 'Server error',
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
