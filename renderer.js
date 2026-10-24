function doSomething() {
    return "meow";
}
// Instead of: export default doSomething;
module.exports = doSomething;
window.addEventListener('DOMContentLoaded', () => {
    const event_test = document.getElementById('event-test');
    event_test.addEventListener('click', async () => {
        event_test.innerText = await window.botAPI.start();
    });
});
export {};
//# sourceMappingURL=renderer.js.map