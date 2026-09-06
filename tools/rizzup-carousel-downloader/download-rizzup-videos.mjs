#!/usr/bin/env node
/**
 * Analizza la pagina rizzupgrowth.com (o un'altra URL passata con --url), individua tutti i
 * video nella sezione "Watch RizzUp In Action" (incluse le slide del carosello caricate solo
 * dopo swipe/click/lazy-load), li scarica senza ricodifica e produce un report dettagliato.
 *
 * Uso rapido:
 *   npm install
 *   npx playwright install chromium
 *   node download-rizzup-videos.mjs
 *
 * Vedi README.md per tutte le opzioni.
 *
 * Rispetta i limiti richiesti: nessun bypass di login/DRM/paywall. Se un contenuto è privato
 * o protetto viene solo segnalato nel report, mai forzato.
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const DEFAULT_URL =
  'https://rizzupgrowth.com/?utm_medium=paid&utm_source=ig&utm_id=120247947298460534&utm_content=120247982830830534&utm_term=120247947298440534&utm_campaign=120247947298460534';
const SECTION_TEXT = /watch\s+rizzup\s+in\s+action/i;

const MEDIA_EXT_RE = /\.(mp4|webm|mov|m3u8|m4s|ts|mpd)(\?|$)/i;
const MEDIA_CT_RE = /^video\/|application\/vnd\.apple\.mpegurl|application\/x-mpegurl|application\/dash\+xml/i;

const CONSENT_SELECTORS = [
  '#onetrust-accept-btn-handler',
  '.cky-btn-accept',
  '.cc-btn.cc-allow',
  'button:has-text("Accetta tutti")',
  'button:has-text("Accetta")',
  'button:has-text("Consenti tutti")',
  'button:has-text("Accept all")',
  'button:has-text("Accept")',
  'button:has-text("I agree")',
  'button:has-text("OK")',
];

const NEXT_SELECTORS = [
  '.swiper-button-next',
  '.slick-next',
  '.splide__arrow--next',
  '[data-carousel-next]',
  'button[aria-label*="next" i]',
  'a[aria-label*="next" i]',
  '[class*="next" i][class*="arrow" i]',
  '[class*="carousel"] [class*="next" i]',
];

const SLIDE_SELECTOR_CANDIDATES = [
  '.swiper-slide',
  '.slick-slide',
  '.splide__slide',
  '[role="group"][aria-roledescription="slide" i]',
  '[class*="carousel-item" i]',
  '[class*="carousel__slide" i]',
  '[class*="slide" i]',
];

function parseArgs(argv) {
  const opts = {
    url: DEFAULT_URL,
    out: path.join(os.homedir(), 'Downloads', 'RizzUp-videos'),
    headed: false,
    channel: null,
    executablePath: null,
    carouselSelector: null,
    slideSelector: null,
    maxSlides: 12,
    timeout: 45000,
    listOnly: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') opts.url = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--headed') opts.headed = true;
    else if (a === '--channel') opts.channel = argv[++i];
    else if (a === '--executable-path') opts.executablePath = argv[++i];
    else if (a === '--carousel-selector') opts.carouselSelector = argv[++i];
    else if (a === '--slide-selector') opts.slideSelector = argv[++i];
    else if (a === '--max-slides') opts.maxSlides = parseInt(argv[++i], 10);
    else if (a === '--timeout') opts.timeout = parseInt(argv[++i], 10);
    else if (a === '--list-only') opts.listOnly = true;
    else if (a === '--help') {
      printHelp();
      process.exit(0);
    }
  }
  return opts;
}

function printHelp() {
  console.log(`
Opzioni:
  --url <url>               URL da analizzare (default: pagina RizzUp con gli utm forniti)
  --out <dir>                Cartella di destinazione (default: ~/Downloads/RizzUp-videos)
  --headed                    Avvia Chromium con finestra visibile invece che headless
  --channel <chrome|msedge>   Usa un browser reale installato invece del Chromium di Playwright
  --executable-path <path>    Percorso esplicito di un binario Chromium/Chrome da usare
  --carousel-selector <css>   Forza il selettore del contenitore del carosello
  --slide-selector <css>      Forza il selettore delle singole slide
  --max-slides <n>            Numero massimo di slide da esplorare (default 12)
  --timeout <ms>              Timeout di navigazione (default 45000)
  --list-only                 Solo analisi/enumerazione, nessun download
`);
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function identifyProvider(url) {
  const h = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  })();
  if (/cloudflarestream\.com|videodelivery\.net/i.test(h)) return 'Cloudflare Stream';
  if (/cloudinary\.com/i.test(h)) return 'Cloudinary';
  if (/b-cdn\.net|bunnycdn\.com/i.test(h)) return 'BunnyCDN';
  if (/vimeo\.com|vimeocdn\.com/i.test(h)) return 'Vimeo';
  if (/mux\.com/i.test(h)) return 'Mux';
  if (/wistia\.(com|net)/i.test(h)) return 'Wistia';
  if (/cdn\.shopify\.com|shopifycdn\.com/i.test(h)) return 'Shopify CDN';
  if (/amazonaws\.com|s3[.-]/i.test(h)) return 'AWS S3';
  if (/\/wp-content\/uploads\//i.test(url)) return 'WordPress uploads';
  if (/youtube\.com|youtu\.be|ytimg\.com/i.test(h)) return 'YouTube';
  if (h) return `CDN/host: ${h}`;
  return 'sconosciuto';
}

function classifyType(url, contentType) {
  if (/\.m3u8(\?|$)/i.test(url) || /mpegurl/i.test(contentType || '')) return 'M3U8 (HLS)';
  if (/\.mpd(\?|$)/i.test(url) || /dash\+xml/i.test(contentType || '')) return 'MPD (DASH)';
  if (/\.webm(\?|$)/i.test(url) || /webm/i.test(contentType || '')) return 'WebM';
  if (/\.mov(\?|$)/i.test(url)) return 'MOV';
  if (/\.mp4(\?|$)/i.test(url) || /mp4/i.test(contentType || '')) return 'MP4';
  if (/\.(ts|m4s)(\?|$)/i.test(url)) return 'Segmento HLS/DASH (non è il file finale)';
  if (url.startsWith('blob:')) return 'blob (estratto dal browser)';
  return 'sconosciuto';
}

async function dismissConsent(page) {
  for (const sel of CONSENT_SELECTORS) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1000 })) {
        await el.click({ timeout: 2000 });
        await sleep(300);
        return true;
      }
    } catch {
      /* selettore assente, si prova il prossimo */
    }
  }
  return false;
}

async function locateCarousel(page, opts) {
  if (opts.carouselSelector && opts.slideSelector) {
    const slides = page.locator(opts.carouselSelector).locator(opts.slideSelector);
    const count = await slides.count();
    return { slides, count, selectorUsed: opts.slideSelector, headingFound: true };
  }

  let headingFound = false;
  try {
    const heading = page.getByText(SECTION_TEXT).first();
    await heading.scrollIntoViewIfNeeded({ timeout: 8000 });
    headingFound = true;
  } catch {
    console.warn('  ! Testo "Watch RizzUp In Action" non trovato: proseguo cercando un carosello nella pagina.');
  }

  for (const sel of opts.slideSelector ? [opts.slideSelector] : SLIDE_SELECTOR_CANDIDATES) {
    const locator = page.locator(sel);
    const count = await locator.count();
    if (count >= 2) {
      return { slides: locator, count, selectorUsed: sel, headingFound };
    }
  }

  return { slides: page.locator('video'), count: await page.locator('video').count(), selectorUsed: 'video', headingFound };
}

async function collectVideoStateFromDOM(page) {
  return page.evaluate(() => {
    return [...document.querySelectorAll('video')].map((v, index) => ({
      index,
      src: v.src || null,
      currentSrc: v.currentSrc || null,
      poster: v.poster || null,
      duration: Number.isFinite(v.duration) ? v.duration : null,
      videoWidth: v.videoWidth || null,
      videoHeight: v.videoHeight || null,
      sources: [...v.querySelectorAll('source')].map((s) => s.src),
      dataSrc: v.getAttribute('data-src'),
      dataVideo: v.getAttribute('data-video'),
    }));
  });
}

async function collectIframes(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('iframe')].map((f) => f.src).filter(Boolean)
  );
}

async function scanScriptsForUrls(page) {
  return page.evaluate(() => {
    const re = /https?:\/\/[^\s"'<>\\]+\.(mp4|webm|m3u8|mov)(\?[^\s"'<>\\]*)?/gi;
    const found = new Set();
    for (const s of document.querySelectorAll('script')) {
      const text = s.textContent || '';
      for (const m of text.matchAll(re)) found.add(m[0]);
    }
    for (const m of document.documentElement.outerHTML.matchAll(re)) found.add(m[0]);
    return [...found];
  });
}

async function advanceToSlide(page, slidesLocator, index) {
  for (const sel of NEXT_SELECTORS) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 500 })) {
        await btn.click({ timeout: 1500 });
        await sleep(400);
        return 'next-button';
      }
    } catch {
      /* prova il prossimo selettore */
    }
  }
  try {
    const slide = slidesLocator.nth(index);
    await slide.scrollIntoViewIfNeeded({ timeout: 3000 });
    await slide.click({ timeout: 1500, trial: false }).catch(() => {});
    return 'scroll-into-view';
  } catch {
    return 'failed';
  }
}

async function tryPlayVideosInPage(page) {
  await page.evaluate(() => {
    for (const v of document.querySelectorAll('video')) {
      try {
        v.muted = true;
        const p = v.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch {
        /* autoplay bloccato: non è un errore fatale, serve solo a innescare il caricamento */
      }
    }
    const playButtons = document.querySelectorAll(
      '[class*="play" i][class*="button" i], [aria-label*="play" i], [class*="play-btn" i]'
    );
    for (const b of playButtons) {
      try {
        b.click();
      } catch {
        /* ignora */
      }
    }
  });
}

async function extractBlobViaPage(page, blobUrl) {
  const base64 = await page.evaluate(async (url) => {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }, blobUrl);
  return Buffer.from(base64, 'base64');
}

async function httpGet(context, url, extraHeaders = {}) {
  try {
    const response = await context.request.get(url, {
      headers: { Referer: extraHeaders.referer || '', 'User-Agent': UA, ...extraHeaders },
      timeout: 30000,
    });
    const ok = response.ok();
    const buffer = ok ? await response.body() : null;
    return { ok, status: response.status(), buffer, headers: response.headers() };
  } catch (e) {
    return { ok: false, status: 0, error: e.message };
  }
}

function parseMasterPlaylist(text, baseUrl) {
  if (!text.includes('#EXT-X-STREAM-INF')) return null;
  const lines = text.split('\n');
  const variants = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
      const bwMatch = lines[i].match(/BANDWIDTH=(\d+)/);
      const resMatch = lines[i].match(/RESOLUTION=(\d+x\d+)/);
      const uriLine = lines[i + 1]?.trim();
      if (uriLine && !uriLine.startsWith('#')) {
        variants.push({
          bandwidth: bwMatch ? parseInt(bwMatch[1], 10) : 0,
          resolution: resMatch ? resMatch[1] : null,
          uri: new URL(uriLine, baseUrl).toString(),
        });
      }
    }
  }
  variants.sort((a, b) => b.bandwidth - a.bandwidth);
  return variants.length ? variants : null;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    p.stderr.on('data', (d) => (stderr += d.toString()));
    p.on('error', (e) => reject(new Error(e.code === 'ENOENT' ? 'ffmpeg non trovato nel PATH locale' : e.message)));
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg terminato con codice ${code}: ${stderr.slice(-1500)}`))));
  });
}

function runFfprobe(filePath) {
  return new Promise((resolve) => {
    const p = spawn('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    p.on('error', () => resolve(null));
    p.stdout.on('data', (d) => (stdout += d.toString()));
    p.on('close', (code) => {
      if (code !== 0) return resolve(null);
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve(null);
      }
    });
  });
}

async function probeFile(filePath) {
  const stat = fs.statSync(filePath);
  const data = await runFfprobe(filePath);
  if (!data) {
    // ffprobe non installato/non eseguibile: nessun verdetto, NON equivale a "file corrotto".
    return { sizeBytes: stat.size, duration: null, width: null, height: null, codec: null, available: false, verified: null };
  }
  const vStream = data.streams?.find((s) => s.codec_type === 'video');
  const duration = data.format?.duration ? parseFloat(data.format.duration) : null;
  return {
    sizeBytes: stat.size,
    duration,
    width: vStream?.width || null,
    height: vStream?.height || null,
    codec: vStream?.codec_name || null,
    available: true,
    verified: !!vStream && !!duration && duration > 0,
  };
}

async function downloadDirectFile(context, url, destPath, refererUrl) {
  const res = await httpGet(context, url, { referer: refererUrl });
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}${res.error ? ' - ' + res.error : ''}` };
  fs.writeFileSync(destPath, res.buffer);
  return { ok: true };
}

async function resolveVimeoEmbed(context, iframeUrl, refererUrl) {
  const idMatch = iframeUrl.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (!idMatch) return { ok: false, error: 'ID Vimeo non riconosciuto nell\'URL embed' };
  const configUrl = `https://player.vimeo.com/video/${idMatch[1]}/config`;
  const res = await httpGet(context, configUrl, { referer: refererUrl });
  if (!res.ok) return { ok: false, error: `config Vimeo non accessibile (HTTP ${res.status}) - probabilmente privato o con restrizioni di dominio` };
  let json;
  try {
    json = JSON.parse(res.buffer.toString('utf8'));
  } catch {
    return { ok: false, error: 'config Vimeo non parsabile' };
  }
  const progressive = json?.request?.files?.progressive;
  if (progressive?.length) {
    progressive.sort((a, b) => (b.width || 0) - (a.width || 0));
    const best = progressive[0];
    return { ok: true, url: best.url, type: 'MP4', resolution: `${best.width}x${best.height}`, provider: 'Vimeo' };
  }
  const hlsCdn = json?.request?.files?.hls?.cdns;
  if (hlsCdn) {
    const first = Object.values(hlsCdn)[0];
    if (first?.url) return { ok: true, url: first.url, type: 'M3U8 (HLS)', resolution: null, provider: 'Vimeo' };
  }
  return { ok: false, error: 'nessun file progressive/HLS pubblico trovato nella config Vimeo' };
}

async function resolveWistiaEmbed(context, iframeUrl) {
  const idMatch = iframeUrl.match(/wistia\.(?:com|net)\/(?:embed\/(?:iframe|medias)\/)?([a-zA-Z0-9]+)/);
  if (!idMatch) return { ok: false, error: 'ID Wistia non riconosciuto nell\'URL embed' };
  const jsonUrl = `https://fast.wistia.com/embed/medias/${idMatch[1]}.json`;
  const res = await httpGet(context, jsonUrl, {});
  if (!res.ok) return { ok: false, error: `metadata Wistia non accessibile (HTTP ${res.status})` };
  let json;
  try {
    json = JSON.parse(res.buffer.toString('utf8'));
  } catch {
    return { ok: false, error: 'metadata Wistia non parsabile' };
  }
  const assets = json?.media?.assets?.filter((a) => a.type?.includes('mp4') || a.type === 'original');
  if (!assets?.length) return { ok: false, error: 'nessun asset mp4 pubblico nel metadata Wistia (video privato/password protetto?)' };
  assets.sort((a, b) => (b.width || 0) - (a.width || 0));
  const best = assets[0];
  return { ok: true, url: best.url, type: 'MP4', resolution: `${best.width}x${best.height}`, provider: 'Wistia' };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  fs.mkdirSync(opts.out, { recursive: true });
  const harPath = path.join(opts.out, 'network-log.har');

  console.log(`Apro ${opts.url}`);
  console.log(`Output: ${opts.out}`);

  const launchOpts = { headless: !opts.headed };
  if (opts.channel) launchOpts.channel = opts.channel;
  if (opts.executablePath) launchOpts.executablePath = opts.executablePath;
  const browser = await chromium.launch(launchOpts);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    userAgent: UA,
    recordHar: { path: harPath, content: 'embed' },
  });
  const page = await context.newPage();

  let currentSlide = -1;
  const networkCandidates = [];
  page.on('response', (response) => {
    const url = response.url();
    const ct = response.headers()['content-type'] || '';
    const rt = response.request().resourceType();
    if (MEDIA_EXT_RE.test(url) || MEDIA_CT_RE.test(ct) || rt === 'media') {
      networkCandidates.push({
        url,
        contentType: ct,
        contentLength: response.headers()['content-length'] || null,
        status: response.status(),
        resourceType: rt,
        slideIndex: currentSlide,
        ts: Date.now(),
      });
    }
  });

  try {
    await page.goto(opts.url, { waitUntil: 'networkidle', timeout: opts.timeout }).catch(async () => {
      console.warn('  ! networkidle non raggiunto in tempo, proseguo con load state "load".');
      await page.goto(opts.url, { waitUntil: 'load', timeout: opts.timeout });
    });
  } catch (e) {
    console.error(`Impossibile caricare la pagina: ${e.message}`);
    await browser.close();
    process.exit(1);
  }

  await dismissConsent(page);
  await sleep(1000);

  const { slides, count, selectorUsed, headingFound } = await locateCarousel(page, opts);
  const slidesTotal = Math.min(count || 0, opts.maxSlides) || (count || 0);
  console.log(`Sezione "Watch RizzUp In Action" trovata: ${headingFound}`);
  console.log(`Selettore slide usato: ${selectorUsed} — slide rilevate: ${count} (esplorerò ${slidesTotal})`);

  const domVideoSightings = new Map();
  const iframeSightings = new Set();
  const scriptUrlSightings = new Set();
  // I blob: vanno letti SUBITO, sulla stessa `page` che li ha creati: un blob: URL non è
  // risolvibile da un'altra pagina/documento, nemmeno stessa origine, nemmeno riaprendo la
  // stessa URL — quindi non può essere rimandato a una fase successiva post-chiusura pagina.
  const resolvedBlobs = [];
  const blobsSeen = new Set();
  let blobCounter = 0;

  async function sampleCurrentState(slideIdx) {
    const vids = await collectVideoStateFromDOM(page);
    for (const v of vids) {
      const key = v.currentSrc || v.src || (v.poster ? `noSrcPoster:${v.poster}` : `noSrc:idx${v.index}:slide${slideIdx}`);
      if (!domVideoSightings.has(key)) domVideoSightings.set(key, { ...v, firstSeenSlide: slideIdx });
      for (const s of v.sources) {
        if (!domVideoSightings.has(s)) domVideoSightings.set(s, { src: s, firstSeenSlide: slideIdx, fromSourceTag: true });
      }
      if (v.currentSrc?.startsWith('blob:') && !blobsSeen.has(v.currentSrc)) {
        blobsSeen.add(v.currentSrc);
        blobCounter++;
        try {
          const buf = await extractBlobViaPage(page, v.currentSrc);
          const tmpPath = path.join(opts.out, `_pending_blob_${blobCounter}.mp4`);
          fs.writeFileSync(tmpPath, buf);
          console.log(`  * blob: estratto dalla slide ${slideIdx + 1} (${buf.length} byte) - ${v.currentSrc}`);
          resolvedBlobs.push({ kind: 'blob', tmpPath, slideIndex: slideIdx, url: v.currentSrc, ok: true, type: 'blob (estratto)', provider: 'browser (in-memory)' });
        } catch (e) {
          console.warn(`  ! blob non estraibile (slide ${slideIdx + 1}): ${e.message}`);
          resolvedBlobs.push({ kind: 'blob', url: v.currentSrc, slideIndex: slideIdx, ok: false, error: `blob non estraibile dal browser: ${e.message}` });
        }
      }
    }
    for (const f of await collectIframes(page)) iframeSightings.add(f);
    for (const u of await scanScriptsForUrls(page)) scriptUrlSightings.add(u);
  }

  currentSlide = 0;
  await sampleCurrentState(0);
  await tryPlayVideosInPage(page);
  await sleep(1200);
  await sampleCurrentState(0);

  for (let i = 1; i < slidesTotal; i++) {
    currentSlide = i;
    const method = await advanceToSlide(page, slides, i);
    console.log(`  -> Slide ${i + 1}/${slidesTotal} (metodo: ${method})`);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await sleep(900);
    await tryPlayVideosInPage(page);
    await sleep(1200);
    await sampleCurrentState(i);
  }

  await page.close();

  console.log(`\nVideo distinti individuati nel DOM: ${domVideoSightings.size}`);
  console.log(`Iframe individuati: ${iframeSightings.size}`);
  console.log(`Richieste di rete media candidate: ${networkCandidates.length}`);

  // Costruisce la lista unificata di candidati da scaricare
  const candidates = [];
  const seenUrls = new Set();

  for (const [, v] of domVideoSightings.entries()) {
    // Mai usare il poster come URL da scaricare: è una thumbnail, non il video (vedi punto 14).
    const url = v.currentSrc || v.src;
    if (!url || seenUrls.has(url)) continue;
    if (url.startsWith('blob:')) continue; // già estratti live in sampleCurrentState()
    if (/^https?:/.test(url)) {
      seenUrls.add(url);
      candidates.push({ kind: 'direct', url, slideIndex: v.firstSeenSlide, source: 'dom' });
    }
  }
  for (const c of networkCandidates) {
    if (seenUrls.has(c.url)) continue;
    if (c.url.startsWith('blob:')) continue; // già estratti live in sampleCurrentState(); non è un URL http fetchabile dall'esterno
    if (/\.(ts|m4s)(\?|$)/i.test(c.url)) continue; // segmenti singoli: si scarica la playlist/master, non il singolo segmento
    seenUrls.add(c.url);
    candidates.push({ kind: 'direct', url: c.url, slideIndex: c.slideIndex, source: 'network', contentType: c.contentType });
  }
  for (const u of scriptUrlSightings) {
    if (seenUrls.has(u)) continue;
    seenUrls.add(u);
    candidates.push({ kind: 'direct', url: u, slideIndex: null, source: 'script' });
  }
  for (const f of iframeSightings) {
    if (/vimeo\.com/i.test(f)) candidates.push({ kind: 'vimeo', url: f, slideIndex: null });
    else if (/wistia\.(com|net)/i.test(f)) candidates.push({ kind: 'wistia', url: f, slideIndex: null });
    else if (/youtube\.com|youtu\.be/i.test(f)) candidates.push({ kind: 'youtube', url: f, slideIndex: null });
  }

  console.log(`\nCandidati totali da valutare/scaricare: ${candidates.length}`);
  if (opts.listOnly) {
    console.log(JSON.stringify(candidates, null, 2));
    await context.close();
    await browser.close();
    return;
  }

  const results = [...resolvedBlobs];
  let n = 0;
  for (const cand of candidates) {
    n++;
    const label = `[${n}/${candidates.length}]`;
    try {
      if (cand.kind === 'direct') {
        if (cand.url.startsWith('blob:')) throw new Error('URL blob: non fetchabile dall\'esterno della pagina (avrebbe dovuto essere già estratto live)');
        const type = classifyType(cand.url, cand.contentType);
        const provider = identifyProvider(cand.url);
        if (type === 'M3U8 (HLS)') {
          console.log(`${label} HLS: ${cand.url}`);
          const masterRes = await httpGet(context, cand.url, { referer: opts.url });
          let mediaUrl = cand.url;
          let resolution = null;
          if (masterRes.ok) {
            const text = masterRes.buffer.toString('utf8');
            const variants = parseMasterPlaylist(text, cand.url);
            if (variants) {
              mediaUrl = variants[0].uri;
              resolution = variants[0].resolution;
            }
          }
          const tmpName = `_pending_${results.length + 1}.mp4`;
          const tmpPath = path.join(opts.out, tmpName);
          await runFfmpeg([
            '-y',
            '-headers',
            `Referer: ${opts.url}\r\nUser-Agent: ${UA}\r\n`,
            '-i',
            mediaUrl,
            '-c',
            'copy',
            tmpPath,
          ]);
          results.push({ ...cand, tmpPath, type: 'M3U8 (HLS) -> remux MP4', provider, resolutionHint: resolution, ok: true });
        } else if (type === 'MP4' || type === 'WebM' || type === 'MOV') {
          console.log(`${label} File diretto (${type}): ${cand.url}`);
          const ext = type === 'WebM' ? 'webm' : type === 'MOV' ? 'mov' : 'mp4';
          const tmpPath = path.join(opts.out, `_pending_${results.length + 1}.${ext}`);
          const dl = await downloadDirectFile(context, cand.url, tmpPath, opts.url);
          if (!dl.ok) throw new Error(dl.error);
          results.push({ ...cand, tmpPath, type, provider, ok: true });
        } else {
          console.log(`${label} Ignorato (tipo non video riconosciuto): ${cand.url}`);
          results.push({ ...cand, type, provider, ok: false, error: 'tipo non riconosciuto come video scaricabile' });
        }
      } else if (cand.kind === 'vimeo') {
        console.log(`${label} Embed Vimeo: ${cand.url}`);
        const r = await resolveVimeoEmbed(context, cand.url, opts.url);
        if (!r.ok) throw new Error(r.error);
        const ext = r.type === 'M3U8 (HLS)' ? null : 'mp4';
        if (r.type === 'M3U8 (HLS)') {
          const tmpPath = path.join(opts.out, `_pending_${results.length + 1}.mp4`);
          await runFfmpeg(['-y', '-headers', `Referer: ${opts.url}\r\nUser-Agent: ${UA}\r\n`, '-i', r.url, '-c', 'copy', tmpPath]);
          results.push({ ...cand, tmpPath, type: r.type, provider: r.provider, resolutionHint: r.resolution, ok: true });
        } else {
          const tmpPath = path.join(opts.out, `_pending_${results.length + 1}.${ext}`);
          const dl = await downloadDirectFile(context, r.url, tmpPath, opts.url);
          if (!dl.ok) throw new Error(dl.error);
          results.push({ ...cand, tmpPath, type: r.type, provider: r.provider, resolutionHint: r.resolution, ok: true });
        }
      } else if (cand.kind === 'wistia') {
        console.log(`${label} Embed Wistia: ${cand.url}`);
        const r = await resolveWistiaEmbed(context, cand.url);
        if (!r.ok) throw new Error(r.error);
        const tmpPath = path.join(opts.out, `_pending_${results.length + 1}.mp4`);
        const dl = await downloadDirectFile(context, r.url, tmpPath, opts.url);
        if (!dl.ok) throw new Error(dl.error);
        results.push({ ...cand, tmpPath, type: r.type, provider: r.provider, resolutionHint: r.resolution, ok: true });
      } else if (cand.kind === 'youtube') {
        console.log(`${label} Embed YouTube rilevato: ${cand.url} - estrazione non inclusa in questo script`);
        results.push({ ...cand, ok: false, type: 'YouTube embed', provider: 'YouTube', error: 'estrazione YouTube non implementata qui: usare yt-dlp separatamente se il video è pubblico' });
      }
    } catch (e) {
      console.warn(`${label} FALLITO: ${e.message}`);
      results.push({ ...cand, ok: false, error: e.message });
    }
  }

  await context.close();
  await browser.close();

  // Deduplica per contenuto: lo stesso video può essere osservato più volte con URL diversi
  // (es. sia come richiesta di rete grezza sia come blob: estratto dallo stesso video) — si
  // confronta l'hash dei byte scaricati, non gli URL, per evitare di contare/salvare due volte
  // lo stesso video.
  const hashToResult = new Map();
  for (const r of results) {
    if (!r.ok || !r.tmpPath || !fs.existsSync(r.tmpPath)) continue;
    const hash = crypto.createHash('sha256').update(fs.readFileSync(r.tmpPath)).digest('hex');
    if (hashToResult.has(hash)) {
      const original = hashToResult.get(hash);
      (original.alsoSeenAs = original.alsoSeenAs || []).push(r.url);
      fs.unlinkSync(r.tmpPath);
      r.duplicateOf = original.url;
    } else {
      hashToResult.set(hash, r);
    }
  }

  // Verifica con ffprobe e rinomina in ordine
  const finalReport = [];
  let videoCounter = 0;
  for (const r of results) {
    if (r.duplicateOf) continue; // stesso contenuto binario di un altro risultato: non ricontare
    if (!r.ok || !r.tmpPath) {
      finalReport.push({
        sourceUrl: r.url || null,
        type: r.type || 'n/d',
        provider: r.provider || identifyProvider(r.url || ''),
        slideIndex: r.slideIndex,
        ok: false,
        error: r.error || 'sconosciuto',
        localPath: null,
      });
      continue;
    }
    videoCounter++;
    const ext = path.extname(r.tmpPath);
    const finalName = `rizzup-video-${String(videoCounter).padStart(2, '0')}${ext}`;
    const finalPath = path.join(opts.out, finalName);
    fs.renameSync(r.tmpPath, finalPath);
    const probe = await probeFile(finalPath);
    // "ok" riflette il download riuscito; ffprobe assente non equivale a file corrotto.
    const looksCorrupt = probe.available && !probe.verified;
    const entry = {
      sourceUrl: r.url,
      alsoSeenAs: r.alsoSeenAs && r.alsoSeenAs.length ? r.alsoSeenAs : undefined,
      type: r.type,
      provider: r.provider,
      slideIndex: r.slideIndex,
      ok: !looksCorrupt,
      localPath: finalPath,
      sizeBytes: probe.sizeBytes,
      durationSeconds: probe.duration,
      resolution: probe.width && probe.height ? `${probe.width}x${probe.height}` : r.resolutionHint || null,
      codec: probe.codec,
      ffprobeVerified: probe.available ? probe.verified : null,
    };
    if (looksCorrupt) {
      entry.error = 'scaricato ma ffprobe non rileva un flusso video valido: il file è probabilmente corrotto o incompleto';
    } else if (!probe.available) {
      entry.warning = 'ffprobe non installato in locale: verifica automatica (durata/risoluzione/integrità) saltata, ma il file è stato scaricato correttamente';
    }
    finalReport.push(entry);
  }

  fs.writeFileSync(path.join(opts.out, 'report.json'), JSON.stringify({
    pageUrl: opts.url,
    analyzedAt: new Date().toISOString(),
    carouselSlidesTotal: count,
    slidesExplored: slidesTotal,
    slideSelectorUsed: selectorUsed,
    videosFound: finalReport.filter((r) => r.ok).length,
    videosFailed: finalReport.filter((r) => !r.ok).length,
    videos: finalReport,
  }, null, 2));

  printReport(count, slidesTotal, finalReport, opts.out);
}

function fmtBytes(b) {
  if (!b) return 'n/d';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = b;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(2)} ${units[i]}`;
}

function fmtDuration(s) {
  if (!s && s !== 0) return 'n/d';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function printReport(slidesTotal, slidesExplored, finalReport, outDir) {
  console.log('\n================ REPORT FINALE ================');
  console.log(`Slide totali nel carosello rilevate: ${slidesTotal} (esplorate: ${slidesExplored})`);
  console.log(`Video trovati e scaricati con successo: ${finalReport.filter((r) => r.ok).length}`);
  console.log(`Video NON scaricati: ${finalReport.filter((r) => !r.ok).length}`);
  console.log('-------------------------------------------------');
  for (const r of finalReport) {
    if (r.ok) {
      console.log(`\n✔ ${path.basename(r.localPath)}`);
      console.log(`  Sorgente: ${r.sourceUrl}`);
      if (r.alsoSeenAs) console.log(`  Stesso contenuto visto anche come: ${r.alsoSeenAs.join(', ')}`);
      console.log(`  Tipo: ${r.type} | Provider: ${r.provider}`);
      console.log(`  Risoluzione: ${r.resolution || 'n/d'} | Durata: ${fmtDuration(r.durationSeconds)} | Dimensione: ${fmtBytes(r.sizeBytes)}`);
      console.log(`  Percorso: ${r.localPath}`);
      if (r.warning) console.log(`  ATTENZIONE: ${r.warning}`);
    } else if (r.localPath) {
      console.log(`\n✘ Scaricato ma corrotto/non riproducibile — Sorgente: ${r.sourceUrl || 'n/d'}`);
      console.log(`  Motivo: ${r.error}`);
      console.log(`  Percorso (da verificare manualmente): ${r.localPath}`);
    } else {
      console.log(`\n✘ Non scaricato — Sorgente: ${r.sourceUrl || 'n/d'}`);
      console.log(`  Motivo: ${r.error}`);
    }
  }
  console.log(`\nReport machine-readable: ${path.join(outDir, 'report.json')}`);
  console.log(`Log di rete completo (HAR): ${path.join(outDir, 'network-log.har')}`);
  console.log('==================================================\n');
}

main().catch((e) => {
  console.error('Errore fatale:', e);
  process.exit(1);
});
