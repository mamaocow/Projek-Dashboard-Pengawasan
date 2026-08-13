/**
 * dev-server.js — Local development server for testing.
 * Serves static files from root and handles /api/data and /api/submit endpoints.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Load .env.local
if (fs.existsSync('.env.local')) {
  const envText = fs.readFileSync('.env.local', 'utf8');
  envText.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^"|"$/g, '');
      process.env[key] = val;
    }
  });
}

const dataHandler = require('./api/data.js');
const submitHandler = require('./api/submit.js');
const updateStatusHandler = require('./api/update-status.js');
const deleteHandler = require('./api/delete.js');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;

  // Helper to emulate Vercel serverless response methods
  res.status = function(code) {
    res.statusCode = code;
    return {
      json: function(data) {
        if (!res.headersSent) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        res.end(JSON.stringify(data));
      },
      end: function() {
        res.end();
      }
    };
  };

  // Handle API routes
  if (pathname === '/api/data') {
    return dataHandler(req, res);
  }

  if (pathname === '/api/submit') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        req.body = body ? JSON.parse(body) : {};
      } catch (e) {
        req.body = {};
      }
      return submitHandler(req, res);
    });
    return;
  }

  if (pathname === '/api/update-status') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        req.body = body ? JSON.parse(body) : {};
      } catch (e) {
        req.body = {};
      }
      return updateStatusHandler(req, res);
    });
    return;
  }

  if (pathname === '/api/delete') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        req.body = body ? JSON.parse(body) : {};
      } catch (e) {
        req.body = {};
      }
      return deleteHandler(req, res);
    });
    return;
  }

  // Serve static files
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 500;
      res.end('Error loading file');
      return;
    }
    res.setHeader('Content-Type', contentType);
    res.end(data);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 Local Dashboard Server running at http://localhost:${PORT}\n`);
});
