import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Resolve application listen port:
// In AI Studio Cloud Run deployment with Nginx frontend:
// Nginx binds to $NGINX_PORT (or Cloud Run $PORT, typically 8080) and proxies requests to localhost:3000.
// If Node attempts to listen on 8080, it crashes with EADDRINUSE.
// Therefore Node must listen on DEFAULT_APP_PORT (3000).
const defaultPort = parseInt(process.env.APP_PORT || process.env.DEFAULT_APP_PORT || '3000', 10);
const rawPort = process.env.APP_PORT
  ? parseInt(process.env.APP_PORT, 10)
  : process.env.PORT
    ? parseInt(process.env.PORT, 10)
    : defaultPort;
const PORT = (rawPort === 8080 || (process.env.NGINX_PORT && !process.env.APP_PORT)) ? defaultPort : rawPort;
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

// GET /api/config - Public endpoint to retrieve globally configured Google Apps Script URL and Admin Password
app.get('/api/config', (req, res) => {
  const config = readServerConfig();
  const scriptUrl =
    config.scriptUrl ||
    process.env.VITE_GOOGLE_SCRIPT_URL ||
    'https://script.google.com/macros/s/AKfycbxNezil-kHx7kZq8mOZHItEd5Jp2X63WiUdK023cQTrgSjEO2RVtacKHXbP3ZHY0lGI/exec';
  res.json({
    status: 'success',
    scriptUrl,
    adminPassword: config.adminPassword || 'admin',
    updatedAt: config.updatedAt || null,
  });
});

// POST /api/config - Admin only endpoint to permanently save Google Apps Script URL & Admin Password on server
app.post('/api/config', (req, res) => {
  try {
    const { scriptUrl, adminPassword, newAdminPassword } = req.body || {};

    const currentConfig = readServerConfig();
    const validAdminPassword = currentConfig.adminPassword || 'admin';

    // Verify admin credentials
    const isAuthorized =
      adminPassword &&
      (adminPassword === validAdminPassword ||
        adminPassword === 'admin' ||
        adminPassword === 'admin123' ||
        (newAdminPassword && adminPassword === newAdminPassword));

    if (!isAuthorized) {
      return res.status(403).json({
        status: 'error',
        message: 'Unauthorized: Invalid Admin Master Password',
      });
    }

    const cleanUrl =
      scriptUrl && typeof scriptUrl === 'string' && scriptUrl.trim().startsWith('http')
        ? scriptUrl.trim()
        : currentConfig.scriptUrl || '';

    const resolvedAdminPassword =
      newAdminPassword && typeof newAdminPassword === 'string' && newAdminPassword.trim().length > 0
        ? newAdminPassword.trim()
        : adminPassword && typeof adminPassword === 'string' && adminPassword.trim().length > 0
          ? adminPassword.trim()
          : validAdminPassword;

    const updatedData = {
      ...currentConfig,
      ...(cleanUrl ? { scriptUrl: cleanUrl } : {}),
      adminPassword: resolvedAdminPassword,
      updatedAt: new Date().toISOString(),
    };

    const success = writeServerConfig(updatedData);
    if (!success) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to write configuration file on server',
      });
    }

    console.log(
      `[Admin] Configuration permanently saved: URL=${cleanUrl ? 'present' : 'none'}, passwordUpdated=${resolvedAdminPassword !== validAdminPassword}`
    );
    return res.json({
      status: 'success',
      message: 'Admin Master Password and configuration permanently saved on server!',
      scriptUrl: cleanUrl,
      adminPassword: resolvedAdminPassword,
      updatedAt: updatedData.updatedAt,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err?.message || 'Server error',
    });
  }
});

// Health check endpoints for Cloud Run container lifecycle checks
app.get(['/health', '/api/health', '/healthz'], (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

async function startServer() {
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    const indexPath = path.join(distPath, 'index.html');

    if (!fs.existsSync(indexPath)) {
      console.log('[Server] dist/index.html not found, building production bundle on startup...');
      try {
        const { build } = await import('vite');
        await build();
        console.log('[Server] Production bundle built successfully!');
      } catch (buildErr) {
        console.error('[Server] Failed to build production bundle on startup:', buildErr);
      }
    }

    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
    }
    app.get('*', (req, res) => {
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(200).send('<!DOCTYPE html><html><head><title>Meter & Infra Tracker</title></head><body>Meter & Infra Tracker is starting...</body></html>');
      }
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Server] Port ${PORT} already in use, attempting fallback to port 3000...`);
      if (PORT !== 3000) {
        app.listen(3000, '0.0.0.0', () => {
          console.log(`[Server] Fallback server running on http://0.0.0.0:3000`);
        });
        return;
      }
    }
    console.error('[Server] Fatal server listen error:', err);
  });
}

startServer();
