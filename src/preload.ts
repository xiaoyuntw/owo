import { contextBridge, ipcRenderer } from 'electron'

const botAPI = {
    // Strictly typed invoke method
    start: () => ipcRenderer.invoke('botAPI:start')
};

contextBridge.exposeInMainWorld('botAPI', botAPI)

window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector: string, text: string) => {
        const element = document.getElementById(selector)
        if (!element) return
        element.innerText = text
    }

    for (const type of ['chrome', 'node', 'electron']) {
        replaceText(`${type}-version`, process.versions[type]!)
    }
})

declare global {
    interface Window {
        botAPI: typeof botAPI;
    }
}