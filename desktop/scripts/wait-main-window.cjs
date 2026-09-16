module.exports = async function waitMainWindow(desktop) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const page = desktop.windows().find((page) => !page.isClosed() && /\/offline\.html$|^https:\/\/playcrew\.vercel\.app/.test(page.url()));
    if (page) return page;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Main PlayCrew window did not load');
};
