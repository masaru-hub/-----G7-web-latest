import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple .env parser to load local .env file if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key] && val) {
          process.env[key] = val;
        }
      }
    });
  } catch (err) {
    console.warn('Could not parse .env file:', err);
  }
}

const app = express();
const PORT = 3000;

// API endpoint to safely deliver Firebase config to the client from environment variables
app.get('/api/firebase-config', (req, res) => {
  const apiKey = process.env.VITE_FIREBASE_API_KEY || 
                 process.env.FIREBASE_API_KEY || 
                 process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 
                 'AIzaSyDoUrqEBN4Njyg7HcsAXcXD6XQLa4CnpFA';
                 
  const config = {
    apiKey: apiKey,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || "kiseki-trial.firebaseapp.com",
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "kiseki-trial",
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || "kiseki-trial.firebasestorage.app",
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || "536584906374",
    appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || "1:536584906374:web:2172a118cfd110de661307",
    databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || process.env.FIREBASE_DATABASE_URL || "https://kiseki-trial-default-rtdb.firebaseio.com"
  };
  
  res.json(config);
});

const distPath = path.join(__dirname, 'dist');
const staticDir = fs.existsSync(distPath) && fs.existsSync(path.join(distPath, 'index.html')) ? distPath : __dirname;

// Serve static assets
app.use(express.static(staticDir));

// SPA / static fallback
app.get('*', (req, res) => {
  const indexPath = path.join(staticDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

