const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

window.React = require('react');
window.ReactDOM = require('react-dom');

// Expose IPC communication interface
window.ldtElectronAPI = {
  send: (name, params) => ipcRenderer.send(name, params),
  invoke: (name, params) => ipcRenderer.invoke(name, params),
  on: (key, listener) => ipcRenderer.on(key, listener),
  once: (key, listener) => ipcRenderer.once(key, listener),
  off: (key, listener) => ipcRenderer.off(key, listener),
  ipcRenderer: {
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    sendSync: (channel, ...args) => ipcRenderer.sendSync(channel, ...args),
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, func) => {
      ipcRenderer.on(channel, func);
    },
    off: (channel, func) => {
      ipcRenderer.off(channel, func);
    },
    once: (channel, func) => {
      ipcRenderer.once(channel, (event, ...args) => func(...args));
    },
    removeAllListeners: (channel) => {
      ipcRenderer.removeAllListeners(channel);
    }
  }
};

// Expose necessary process information
window.process = {
  platform: process.platform,
  env: {
    NODE_ENV: process.env.NODE_ENV,
    // Add other required environment variables
  },
  versions: {
    node: process.versions.node,
    electron: process.versions.electron
  }
};
