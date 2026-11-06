import { spawn } from 'node:child_process';
import fs from 'node:fs';

async function main() {
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--window-size=1440,900',
    '--disable-gpu',
    '--no-sandbox',
  ]);

  await new Promise((r) => setTimeout(r, 1500));

  try {
    const verRes = await fetch('http://127.0.0.1:9222/json/version');
    const ver = await verRes.json();
    const ws = new WebSocket(ver.webSocketDebuggerUrl);

    await new Promise((resolve) => {
      ws.onopen = resolve;
    });

    let msgId = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const handler = (evt) => {
          const data = JSON.parse(evt.data);
          if (data.id === id) {
            ws.removeEventListener('message', handler);
            if (data.error) reject(data.error);
            else resolve(data.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    // Create target
    const { targetId } = await send('Target.createTarget', { url: 'http://localhost:5173' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

    function sendSession(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const handler = (evt) => {
          const data = JSON.parse(evt.data);
          if (data.id === id) {
            ws.removeEventListener('message', handler);
            if (data.error) reject(data.error);
            else resolve(data.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, sessionId, method, params }));
      });
    }

    await sendSession('Page.enable');
    await sendSession('Runtime.enable');

    // Wait for load
    await new Promise((r) => setTimeout(r, 2000));

    fs.mkdirSync('/tmp/portfolio-inspect', { recursive: true });

    // Function to capture screenshot after evaluating scroll
    async function capture(name, scrollY) {
      if (scrollY !== undefined) {
        await sendSession('Runtime.evaluate', {
          expression: `window.scrollTo({ top: ${scrollY}, behavior: 'instant' }); window.__lenis?.scrollTo(${scrollY}, { immediate: true });`,
        });
        await new Promise((r) => setTimeout(r, 600));
      }
      const { data } = await sendSession('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(`/tmp/portfolio-inspect/${name}.png`, Buffer.from(data, 'base64'));
      console.log(`Saved /tmp/portfolio-inspect/${name}.png`);
    }

    await capture('01_hero_scroll_0', 0);
    await capture('02_hero_scroll_250', 250);
    await capture('03_hero_scroll_600', 600);
    await capture('04_biometrics_stats_1200', 1200);
    await capture('05_projects_c_filters_2200', 2200);
    await capture('06_beat_mixer_3200', 3200);
    await capture('07_timeline_4200', 4200);
    await capture('08_terminal_downlinks_5200', 5200);

    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(console.error);
