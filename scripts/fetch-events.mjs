/**
 * fetch-events.mjs
 * Kommunity DevOps Türkiye sayfasından event verilerini çeker ve
 * assets/data/events.json dosyasına yazar.
 *
 * Çalıştırma: node scripts/fetch-events.mjs
 * Gereksinimler: npm install puppeteer
 */

import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '..', 'assets', 'data', 'events.json');

const UPCOMING_URL = 'https://kommunity.com/devops-turkiye/events';
const PAST_URL = 'https://kommunity.com/devops-turkiye/events/past';

/** Platform'a göre sistem Chrome path'ini döner */
function findChrome() {
  const platform = process.platform;
  if (platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  if (platform === 'linux') {
    // GitHub Actions ubuntu'da chromium veya google-chrome
    const linuxPaths = [
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ];
    return linuxPaths[0];
  }
  return null; // Windows: Puppeteer kendi bulur
}

/** Bir Kommunity events sayfasından event listesini çeker */
async function scrapeEvents(page, url) {
  console.log(`Fetching: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });

  // Kommunity SPA'nın render etmesini bekle
  await page.waitForSelector('[class*="event"]', { timeout: 30_000 }).catch(() => {
    console.warn('  Warning: event selector not found, page may have changed structure');
  });

  const events = await page.evaluate(() => {
    const results = [];
    const links = new Set();

    document.querySelectorAll('a[href*="/events/"]').forEach(el => {
      const href = el.getAttribute('href') || '';
      // Sadece gerçek event linkleri
      if (
        href.includes('/events/') &&
        !href.endsWith('/events') &&
        !href.endsWith('/events/past') &&
        !href.endsWith('/events/upcoming') &&
        !links.has(href)
      ) {
        links.add(href);

        const titleEl =
          el.querySelector('h2, h3, [class*="title"], [class*="name"]') || el;
        const title = titleEl.textContent.trim().replace(/\s+/g, ' ');

        const dateEl = el.querySelector('[class*="date"], time');
        const dateText = dateEl ? dateEl.textContent.trim() : '';

        const locEl = el.querySelector('[class*="location"], [class*="venue"]');
        const location = locEl ? locEl.textContent.trim() : '';

        const imgEl = el.querySelector('img');
        const image = imgEl ? imgEl.src : '';

        if (title && title.length > 3) {
          results.push({
            title,
            url: href.startsWith('http') ? href : `https://kommunity.com${href}`,
            date: dateText,
            location,
            image,
          });
        }
      }
    });

    return results;
  });

  return events;
}

function parseDate(dateStr) {
  if (!dateStr) return null;

  // Kommunity formatı: "Wed, Jun 03 at 5:30 PM"
  const kommunityMatch = dateStr.match(/(\w{3}),\s+(\w{3})\s+(\d{1,2})/);
  if (kommunityMatch) {
    const [, , month, day] = kommunityMatch;
    const timeMatch = dateStr.match(/at\s+(\d{1,2}):(\d{2})\s+(AM|PM)/i);
    let hour = 0, minute = 0;
    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10);
      minute = parseInt(timeMatch[2], 10);
      if (timeMatch[3].toUpperCase() === 'PM' && hour !== 12) hour += 12;
      if (timeMatch[3].toUpperCase() === 'AM' && hour === 12) hour = 0;
    }
    const now = new Date();
    const currentYear = now.getFullYear();
    // En yakın geçmiş tarihi bul (past events için)
    const candidates = [currentYear, currentYear - 1, currentYear - 2].map(year =>
      new Date(`${month} ${day} ${year} ${hour}:${minute}:00`)
    ).filter(d => !isNaN(d.getTime()));
    if (candidates.length > 0) {
      // Şimdiden önce olan en son tarihi seç
      const past = candidates.filter(d => d <= now);
      if (past.length > 0) return past[0].toISOString();
      return candidates[0].toISOString(); // Hepsi gelecekteyse ilkini al
    }
  }

  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function main() {
  const chromePath = findChrome();
  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };
  if (chromePath) {
    launchOptions.executablePath = chromePath;
    console.log(`Using Chrome: ${chromePath}`);
  }

  const browser = await puppeteer.launch(launchOptions);

  try {
    const [upcomingPage, pastPage] = await Promise.all([
      browser.newPage(),
      browser.newPage(),
    ]);

    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    await Promise.all([
      upcomingPage.setUserAgent(ua),
      pastPage.setUserAgent(ua),
    ]);

    const [upcoming, past] = await Promise.all([
      scrapeEvents(upcomingPage, UPCOMING_URL),
      scrapeEvents(pastPage, PAST_URL),
    ]);

    const output = {
      updated_at: new Date().toISOString(),
      upcoming: upcoming.map(e => ({ ...e, parsed_date: parseDate(e.date) })),
      past: past.map(e => ({ ...e, parsed_date: parseDate(e.date) })),
    };

    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

    console.log(`✅ events.json yazıldı: ${OUTPUT_PATH}`);
    console.log(`   Upcoming: ${upcoming.length} event`);
    console.log(`   Past:     ${past.length} event`);
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('❌ Hata:', err.message);
  process.exit(1);
});
