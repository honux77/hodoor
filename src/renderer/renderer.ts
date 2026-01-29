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

// Create terminal instance (output only)
const terminal = new Terminal({
  cursorBlink: false,
  fontSize: 14,
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  disableStdin: true,
  theme: {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    cursor: '#1e1e1e',
    cursorAccent: '#1e1e1e',
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

// Get input elements
const commandInput = document.getElementById('command-input') as HTMLInputElement;
const promptSpan = document.getElementById('prompt') as HTMLSpanElement;

// Command history
const commandHistory: string[] = [];
let historyIndex = -1;

// Handle command input
commandInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const command = commandInput.value;
    if (command.trim()) {
      commandHistory.push(command);
      historyIndex = commandHistory.length;
      // Display command in output
      terminal.writeln(`\x1b[36m$ ${command}\x1b[0m`);
      window.electronAPI.sendInput(command + '\n');
    } else {
      window.electronAPI.sendInput('\n');
    }
    commandInput.value = '';
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (historyIndex > 0) {
      historyIndex--;
      commandInput.value = commandHistory[historyIndex];
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyIndex < commandHistory.length - 1) {
      historyIndex++;
      commandInput.value = commandHistory[historyIndex];
    } else {
      historyIndex = commandHistory.length;
      commandInput.value = '';
    }
  } else if (e.key === 'c' && e.ctrlKey) {
    window.electronAPI.sendInput('\x03');
  }
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

// Focus input on click anywhere
document.body.addEventListener('click', () => {
  commandInput.focus();
});

// Initial focus
commandInput.focus();
