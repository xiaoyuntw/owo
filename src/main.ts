import { app, BrowserWindow, ipcMain } from 'electron/main'
import path from 'node:path'

// const __dirname = import.meta.dirname
import { startBot } from './discord/bot.js'

const createWindow = (): void => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    })

    win.loadFile('index.html')

    const contents = win.webContents
    // console.log(contents)
}

app.whenReady().then(() => {
    ipcMain.handle('botAPI:start', startBot)
    createWindow()
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})