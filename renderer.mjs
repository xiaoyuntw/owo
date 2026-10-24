window.addEventListener('DOMContentLoaded', () => {
    // reload button for development
    const reloadBtn = document.getElementById("reload");
    if (reloadBtn != null)
        reloadBtn.addEventListener("click", () => { location.reload(); });
    // start bot test
    const BotStartBtn = document.getElementById('bot-start');
    BotStartBtn.addEventListener('click', async () => {
        BotStartBtn.innerText = await (async () => "bot starting")();
        BotStartBtn.innerText = await window.botAPI.start();
    });
});
export {};
