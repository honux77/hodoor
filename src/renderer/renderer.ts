import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

declare global {
  interface Window {
    electronAPI: {
      sendInput: (data: string) => void;
      resize: (cols: number, rows: number) => void;
      onData: (callback: (data: string) => void) => void;
      removeAllListeners: () => void;
    };
  }
}

// Create terminal instance
const terminal = new Terminal({
  cursorBlink: true,
  fontSize: 14,
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  theme: {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    cursor: '#ffffff',
    cursorAccent: '#000000',
    selectionBackground: '#264f78',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#ffffff',
  },
});

// Create fit addon for auto-resizing
const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);

// Open terminal in container
const terminalContainer = document.getElementById('terminal');
if (terminalContainer) {
  terminal.open(terminalContainer);
  fitAddon.fit();
}

// Handle terminal input
terminal.onData((data) => {
  window.electronAPI.sendInput(data);
});

// Handle data from main process
window.electronAPI.onData((data) => {
  terminal.write(data);
});

// Handle window resize
window.addEventListener('resize', () => {
  fitAddon.fit();
  window.electronAPI.resize(terminal.cols, terminal.rows);
});

// Initial resize notification
setTimeout(() => {
  fitAddon.fit();
  window.electronAPI.resize(terminal.cols, terminal.rows);
}, 100);

// Focus terminal
terminal.focus();
