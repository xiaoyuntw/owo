export interface IpcChannels {
    // 'channel-name': (arguments) => ReturnType
    'bot:start': () => Promise<string>;
}