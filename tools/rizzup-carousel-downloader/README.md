# RizzUp Carousel Downloader

Script standalone (Node.js + Playwright) che apre una pagina in un vero Chromium, analizza il
DOM e il traffico di rete, individua tutti i video pubblicamente accessibili nella sezione
**"Watch RizzUp In Action"** — comprese le slide del carosello caricate solo dopo swipe/click/
lazy-load — li scarica senza ricodifica e produce un report dettagliato.

Creato perché **questo ambiente cloud (Claude Code on the web) non ha accesso di rete generico**:
la sua policy di egress consente solo registri pacchetti (npm, pypi, GitHub) e l'API Anthropic,
quindi non può raggiungere `rizzupgrowth.com` né alcun altro sito pubblico. Questo script va
eseguito **in locale**, dove hai un browser reale, internet libero e una vera cartella
`~/Downloads`.

## Requisiti

- Node.js >= 18
- `ffmpeg` e `ffprobe` nel PATH di sistema (servono per scaricare eventuali playlist `.m3u8` e
  per verificare risoluzione/durata/integrità di ogni file scaricato):
  - macOS: `brew install ffmpeg`
  - Windows: `winget install ffmpeg` (oppure scaricalo da ffmpeg.org e aggiungilo al PATH)
  - Linux: `sudo apt install ffmpeg` (o equivalente della tua distro)

## Setup

```bash
cd tools/rizzup-carousel-downloader
npm install                 # installa anche il browser Chromium di Playwright (postinstall)
```

## Uso

Esecuzione base (usa l'URL RizzUp con gli UTM forniti, headless, salva in `~/Downloads/RizzUp-videos/`):

```bash
node download-rizzup-videos.mjs
```

Con finestra del browser visibile, per osservare l'analisi mentre avviene:

```bash
node download-rizzup-videos.mjs --headed
```

Solo analisi/enumerazione, senza scaricare nulla (utile per un primo controllo veloce):

```bash
node download-rizzup-videos.mjs --list-only --headed
```

### Opzioni

| Opzione | Descrizione | Default |
|---|---|---|
| `--url <url>` | Pagina da analizzare | URL RizzUp fornito |
| `--out <dir>` | Cartella di destinazione | `~/Downloads/RizzUp-videos` |
| `--headed` | Chromium con finestra visibile | headless |
| `--channel <chrome\|msedge>` | Usa un browser reale già installato invece del Chromium di Playwright | Chromium bundlato |
| `--executable-path <path>` | Percorso esplicito di un binario Chromium/Chrome da usare | — |
| `--carousel-selector <css>` / `--slide-selector <css>` | Forzano manualmente i selettori se l'euristica automatica non individua correttamente il carosello (utile dopo aver ispezionato la pagina con DevTools) | rilevamento automatico |
| `--max-slides <n>` | Numero massimo di slide esplorate | 12 |
| `--timeout <ms>` | Timeout di navigazione | 45000 |
| `--list-only` | Solo enumerazione, nessun download | off |

## Cosa fa, nel dettaglio

1. Apre la pagina in Chromium (reale, non uno scraper HTTP passivo).
2. Prova a chiudere automaticamente banner cookie/consenso comuni (OneTrust, CookieYes, ecc.).
3. Individua il testo "Watch RizzUp In Action" e il carosello associato, riconoscendo i markup
   più comuni (Swiper, Slick, Splide, o pattern generici `*slide*`/`*carousel-item*`).
4. Per ogni slide: la porta in vista, prova un pulsante "next" o lo scroll diretto, avvia
   (in muto, per rispettare le autoplay policy) ogni `<video>` presente e clicca eventuali
   overlay "play".
5. Ad ogni slide, rilegge lo stato del DOM (`video.src/currentSrc/poster/source`), gli `iframe`
   (Vimeo/Wistia/YouTube) e fa scansione testuale degli script per URL video incorporati.
6. In parallelo, intercetta **tutte** le risposte di rete che sembrano media (estensione
   mp4/webm/mov/m3u8/m4s/ts, content-type `video/*` o HLS, oppure `resourceType === 'media'`),
   così da recuperare anche ciò che non compare mai direttamente nel DOM.
7. Salva l'intera sessione di rete in `network-log.har` nella cartella di output, apribile in
   Chrome DevTools per un'ispezione manuale se qualcosa sfugge all'euristica.
8. Scarica:
   - **MP4/WebM/MOV diretti**: file originale, nessuna ricodifica.
   - **M3U8**: legge la master playlist, sceglie la variante a bitrate più alto, esegue
     `ffmpeg -i <url> -c copy <file>.mp4` (remux, non re-encode).
   - **Embed Vimeo**: interroga `player.vimeo.com/video/<id>/config` (lo stesso endpoint
     pubblico che carica il player) per il file progressive MP4 di qualità più alta, o l'HLS
     se non c'è un MP4 diretto. Se il video è privato o con restrizioni di dominio, questo
     fallisce e viene segnalato — **non viene tentato alcun bypass**.
   - **Embed Wistia**: interroga `fast.wistia.com/embed/medias/<id>.json` per l'asset MP4
     pubblico di risoluzione più alta.
   - **Embed YouTube**: viene solo segnalato nel report (non scaricato da questo script).
   - **`blob:` come `currentSrc`**: per prima cosa si cerca la richiesta di rete reale che ha
     originato il blob (mp4/segmenti HLS già intercettati al punto 6). Come ultima risorsa, se
     non emerge nulla, i byte vengono letti direttamente dal browser via
     `fetch(blobUrl) -> arrayBuffer` **nella pagina stessa** (sono esattamente i byte che il
     browser ha già ricevuto legittimamente — non è un bypass, semplicemente non si scarica il
     blob "dall'esterno", che è impossibile per definizione).
9. Verifica ogni file scaricato con `ffprobe` (durata, risoluzione, codec, dimensione) e lo
   segnala come non affidabile se non risulta un file video valido.
10. Rinomina in ordine i video scaricati con successo: `rizzup-video-01.<ext>`,
    `rizzup-video-02.<ext>`, ecc. **L'estensione riflette il container originale** (`.mp4` per
    sorgenti MP4/HLS-remux, `.webm` per sorgenti WebM) invece di forzare sempre `.mp4`, per
    evitare file rinominati in modo fuorviante.
11. Scrive `report.json` con tutti i campi richiesti (URL sorgente, tipo, provider/CDN,
    risoluzione, durata, dimensione, percorso locale, eventuali errori) e stampa lo stesso
    report in console.

## Limiti noti

- Nessun bypass di login, DRM, paywall o restrizioni di dominio: se un video è protetto, viene
  solo segnalato come non scaricabile con il motivo preciso.
- Se il markup reale del carosello non corrisponde a nessuna euristica nota, usa `--headed`
  per osservare visivamente, ispeziona la pagina con DevTools per trovare i selettori giusti e
  passali con `--carousel-selector`/`--slide-selector`.
- Se `ffmpeg`/`ffprobe` non sono installati: i file `.m3u8` non possono essere scaricati e la
  verifica automatica (durata/risoluzione/integrità) viene saltata, ma i file MP4/WebM diretti
  vengono comunque scaricati.
- I segmenti HLS protetti da cookie di sessione (rari per contenuti di marketing pubblici) non
  sono gestiti automaticamente da ffmpeg in questo script.
