import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Send data to terminal
  sendInput: (data: string) => {
    ipcRenderer.send('terminal:input', data);
  },

  // Resize terminal
  resize: (cols: number, rows: number) => {
    ipcRenderer.send('terminal:resize', cols, rows);
  },

  // Receive data from terminal
  onData: (callback: (data: string) => void) => {
    ipcRenderer.on('terminal:data', (_event, data) => {
      callback(data);
    });
  },

  // Remove listeners
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('terminal:data');
    ipcRenderer.removeAllListeners('calendar:auth-success');
  },

  // Calendar API
  calendar: {
    checkAuth: () => ipcRenderer.invoke('calendar:check-auth'),
    auth: () => ipcRenderer.invoke('calendar:auth'),
    getEvents: () => ipcRenderer.invoke('calendar:get-events'),
    logout: () => ipcRenderer.invoke('calendar:logout'),
    onAuthSuccess: (callback: () => void) => {
      ipcRenderer.on('calendar:auth-success', () => callback());
    },
  },
});
