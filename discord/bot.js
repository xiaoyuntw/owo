"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startBot = void 0;
const discord_js_1 = require("discord.js");
const config_json_1 = require("./config.json");
const client = new discord_js_1.Client({ intents: [discord_js_1.GatewayIntentBits.Guilds] });
client.once(discord_js_1.Events.ClientReady, (readyClient) => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});
const startBot = () => {
    return client.login(config_json_1.token)
        .then(() => "bot ready")
        .catch(error => error.toString());
};
exports.startBot = startBot;
