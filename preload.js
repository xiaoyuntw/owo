"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const botAPI = {
    // Strictly typed invoke method
    start: () => electron_1.ipcRenderer.invoke('botAPI:start')
};
electron_1.contextBridge.exposeInMainWorld('botAPI', botAPI);
window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector);
        if (!element)
            return;
        element.innerText = text;
    };
    for (const type of ['chrome', 'node', 'electron']) {
        replaceText(`${type}-version`, process.versions[type]);
    }
});
