import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as pty from 'node-pty';
import * as http from 'http';
import * as url from 'url';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

let mainWindow: BrowserWindow | null = null;
let ptyProcess: pty.IPty | null = null;

// Google OAuth2 setup
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const TOKEN_PATH = path.join(app.getPath('userData'), 'google-token.json');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3000/oauth2callback'
);

function getShell(): string {
  if (process.platform === 'win32') {
    return 'powershell.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Open DevTools
  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createPtyProcess(): void {
  const shell = getShell();
  const cwd = os.homedir();

  ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: cwd,
    env: process.env as { [key: string]: string },
  });

  ptyProcess.onData((data: string) => {
    if (mainWindow) {
      mainWindow.webContents.send('terminal:data', data);
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    console.log(`Terminal process exited with code ${exitCode}`);
  });
}

// Load saved token
function loadToken(): boolean {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      oauth2Client.setCredentials(token);
      return true;
    }
  } catch (err) {
    console.error('Error loading token:', err);
  }
  return false;
}

// Save token
function saveToken(token: any): void {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
}

// Start OAuth flow
async function startOAuthFlow(): Promise<boolean> {
  return new Promise((resolve) => {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    // Create temporary server to receive callback
    const server = http.createServer(async (req, res) => {
      const parsedUrl = url.parse(req.url || '', true);

      if (parsedUrl.pathname === '/oauth2callback') {
        const code = parsedUrl.query.code as string;

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Authentication successful!</h1><p>You can close this window.</p></body></html>');

        server.close();

        try {
          const { tokens } = await oauth2Client.getToken(code);
          oauth2Client.setCredentials(tokens);
          saveToken(tokens);

          if (mainWindow) {
            mainWindow.webContents.send('calendar:auth-success');
          }
          resolve(true);
        } catch (err) {
          console.error('Error getting token:', err);
          resolve(false);
        }
      }
    });

    server.listen(3000, () => {
      shell.openExternal(authUrl);
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      server.close();
      resolve(false);
    }, 120000);
  });
}

// Get today's events from all calendars
async function getTodayEvents(): Promise<any[]> {
  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // Get all calendars the user has access to
    const calendarList = await calendar.calendarList.list();
    const calendars = calendarList.data.items || [];

    console.log(`Found ${calendars.length} calendars`);

    // Fetch events from all calendars
    const allEvents: any[] = [];

    for (const cal of calendars) {
      if (!cal.id) continue;

      try {
        const response = await calendar.events.list({
          calendarId: cal.id,
          timeMin: startOfDay.toISOString(),
          timeMax: endOfDay.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
        });

        const events = response.data.items || [];
        // Add calendar info to each event
        events.forEach((event: any) => {
          event.calendarName = cal.summary;
          event.calendarColor = cal.backgroundColor;
        });

        allEvents.push(...events);
        console.log(`Calendar "${cal.summary}": ${events.length} events`);
      } catch (calErr) {
        console.error(`Error fetching from calendar ${cal.summary}:`, calErr);
      }
    }

    // Sort all events by start time
    allEvents.sort((a, b) => {
      const aTime = a.start.dateTime || a.start.date;
      const bTime = b.start.dateTime || b.start.date;
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    });

    return allEvents;
  } catch (err: any) {
    console.error('Error fetching events:', err);

    // If token expired, try to refresh
    if (err.code === 401) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        saveToken(credentials);
        return getTodayEvents();
      } catch (refreshErr) {
        console.error('Error refreshing token:', refreshErr);
        throw refreshErr;
      }
    }
    throw err;
  }
}

// IPC handlers
ipcMain.on('terminal:input', (_event, data: string) => {
  if (ptyProcess) {
    ptyProcess.write(data);
  }
});

ipcMain.on('terminal:resize', (_event, cols: number, rows: number) => {
  if (ptyProcess) {
    ptyProcess.resize(cols, rows);
  }
});

// Calendar IPC handlers
ipcMain.handle('calendar:check-auth', async () => {
  return loadToken();
});

ipcMain.handle('calendar:auth', async () => {
  return startOAuthFlow();
});

ipcMain.handle('calendar:get-events', async () => {
  console.log('calendar:get-events called');
  try {
    const events = await getTodayEvents();
    console.log('Events fetched:', events.length, 'events');
    console.log('Events:', JSON.stringify(events, null, 2));
    return { success: true, events };
  } catch (err: any) {
    console.error('Error in get-events:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('calendar:logout', async () => {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      fs.unlinkSync(TOKEN_PATH);
    }
    oauth2Client.revokeCredentials();
    return true;
  } catch (err) {
    console.error('Error logging out:', err);
    return false;
  }
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  createPtyProcess();
  loadToken();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      createPtyProcess();
    }
  });
});

app.on('window-all-closed', () => {
  if (ptyProcess) {
    ptyProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (ptyProcess) {
    ptyProcess.kill();
  }
});
