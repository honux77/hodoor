import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as pty from 'node-pty';

let mainWindow: BrowserWindow | null = null;
let ptyProcess: pty.IPty | null = null;

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

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  createPtyProcess();

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
