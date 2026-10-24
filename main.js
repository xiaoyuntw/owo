"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const main_1 = require("electron/main");
const node_path_1 = __importDefault(require("node:path"));
// const __dirname = import.meta.dirname
const bot_js_1 = require("./discord/bot.js");
const createWindow = () => {
    const win = new main_1.BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: node_path_1.default.join(__dirname, 'preload.js')
        }
    });
    win.loadFile('index.html');
    const contents = win.webContents;
    // console.log(contents)
};
main_1.app.whenReady().then(() => {
    main_1.ipcMain.handle('botAPI:start', bot_js_1.startBot);
    createWindow();
    main_1.app.on('activate', () => {
        if (main_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
main_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        main_1.app.quit();
});
