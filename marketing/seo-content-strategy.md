# CAME COMPANY — Strategia SEO Digital PR & Social Report

Data: 2026-08-18
Mercato: Italia, lingua italiana
Metodo: ricerca di mercato pubblica (WebSearch), nessun accesso diretto a `camecompany.com` o a Google Keyword Planner/Search Console da questo ambiente.

Versione presentata: `seo-digital-pr-strategy.html` (pubblicata come Artifact), dati keyword in `keywords-digital-pr.csv`.

## Ambito

**Incluso:** comunicati stampa / ufficio stampa online, articoli sponsorizzati / guest post, Digital PR e posizionamento editoriale, report e analisi su profili social.

**Escluso:** pacchetti follower, like, visualizzazioni, commenti, interazioni ed eventuali recensioni a pagamento. Questa esclusione vale per qualunque canale di acquisizione (SEO/content incluso), non solo per Google Ads — la vendita di engagement/recensioni fittizie è vietata dalla policy Google Ads "Enabling dishonest behavior" ed è comunque fuori da quello che questo lavoro costruisce, indipendentemente dal canale.

## Perché queste due linee

Comunicati stampa, articoli sponsorizzati, Digital PR e report/analisi social sono prodotti reali e distinti dal resto del catalogo, venduti apertamente da concorrenti diretti sullo stesso mercato italiano (Kynetic, Notiziabile, Press AI, PosizioneUno, Linking Agency, OpenRANK). Il blog di CAME COMPANY ha già contenuti coerenti con questo posizionamento:

- "Differenze tra articoli sponsorizzati e articoli giornalistici nella pubblicità editoriale"
- "Guida pratica per articoli sponsorizzati su magazine internazionali affidabili"
- "Strategie vincenti per pubblicare comunicati stampa su giornali online affidabili"

Il piano editoriale sotto rinforza e amplia questo filone esistente. Dove un titolo in calendario sovrappone un contenuto già pubblicato, va trattato come refresh/consolidamento (aggiornare, interlinkare, non duplicare).

## Architettura keyword

Quattro cluster (dettaglio completo in `keywords-digital-pr.csv`):

- **A — Ufficio stampa & comunicati stampa**: intento prevalentemente commerciale/transazionale, MOFU-BOFU.
- **B — Articoli sponsorizzati & guest post**: commerciale, con un avvertimento editoriale — vendere visibilità/autorevolezza è legittimo, promettere manipolazione del ranking ("primo posto garantito") no. Rischio reputazionale e attrito con le spam policy di Google Search sui link a pagamento.
- **C — Digital PR & posizionamento editoriale**: prevalentemente informational/TOFU, contenuti pillar per link earning.
- **D — Report & analisi social**: mix informational/commercial, con un tool di audit gratuito come magnete lead-gen verso il report a pagamento.

I volumi sono stimati per fascia qualitativa (alto/medio/basso) dal panorama competitivo osservato via ricerca web, non da Keyword Planner — l'ambiente non ha accesso API a Google Ads/Keyword Planner. Da ricalibrare con dati reali appena disponibili.

## Calendario editoriale — 12 settimane

| Sett. | Titolo | Cluster | Keyword target | Obiettivo |
|---|---|---|---|---|
| 1 | Quanto costa un ufficio stampa online nel 2026: guida ai prezzi in Italia | A | ufficio stampa online prezzi | conversione |
| 2 | Come pubblicare un comunicato stampa su testate italiane: guida passo passo | A | pubblicare comunicato stampa online | conversione |
| 3 | Comunicato stampa efficace: struttura, esempi e errori da evitare | A | come scrivere un comunicato stampa efficace | autorevolezza |
| 4 | Articoli sponsorizzati: quanto costano e su quali testate pubblicare | B | articoli sponsorizzati prezzo | conversione |
| 5 | Backlink da testate giornalistiche: cosa sono e come sceglierli senza rischi SEO | B | backlink testate giornalistiche | autorevolezza |
| 6 | Guest post SEO in Italia: come funziona e differenza con gli articoli sponsorizzati | B | guest post seo italia | conversione |
| 7 | Cos'è la Digital PR e perché ne ha bisogno la tua azienda nel 2026 | C | cos'è la digital pr | autorevolezza / link magnet |
| 8 | PMI e Digital PR: 7 strategie per guadagnare visibilità senza ufficio stampa interno | C | strategia digital pr pmi | conversione |
| 9 | Audit gratuito del tuo profilo Instagram: come leggere i dati che contano | D | audit gratuito instagram | lead-gen (tool) |
| 10 | Come leggere gli insight di Instagram (e i 5 errori più comuni) | D | come leggere insight instagram | autorevolezza |
| 11 | Analisi competitor sui social: la guida pratica per capire chi vince nel tuo settore | D | analisi competitor social media | conversione |
| 12 | Come funziona il posizionamento su Google News: guida per aziende e professionisti | C | posizionamento google news | autorevolezza |

Ogni pezzo linka la pagina servizio pertinente con anchor text descrittivo; ogni pagina servizio richiama 2-3 guide correlate.

## Raccomandazioni on-page & tecniche

- **Title/meta**: keyword primaria a sinistra nel title; meta description con un dato concreto (prezzo, numero testate, tempistica) invece di aggettivi non verificabili.
- **Schema**: `Article`/`BlogPosting` sulle guide, `Organization` a livello sito; per l'idoneità a Google News, byline coerente, dateline, sitemap news dedicata.
- **E-E-A-T**: bio autore con credenziali reali, portfolio pubblico e verificabile delle testate su cui sono stati effettivamente pubblicati articoli.
- **Interlinking**: nessun articolo isolato senza un percorso verso una pagina di conversione.

## Verificato contro il sitemap reale (2026-08-18)

L'utente ha incollato il contenuto di `it-us/sitemap_pages_1.xml`. Mancano ancora `sitemap_collections_1.xml` e `sitemap_blogs_1.xml` (l'URL commerciale esatto del servizio Digital PR/comunicati stampa non è tra le pagine statiche — è probabilmente in una collection).

**Conferma diretta della classificazione RED.** La sitemap contiene, senza ambiguità: `perche-comprare-follower-per-instagram`, `perche-comprare-like-per-instagram`, `come-comprare-like-per-tiktok`, `perche-comprare-follower-tik-tok`, le pagine di configurazione ordine per piattaforma (`link-post-instagram`, `link-video-tiktok`, `link-twitch`, `link-youtube`, `link-facebook`, `link-spotify`), e una guida per rendere pubblico un account Instagram (passaggio necessario per ricevere follower/like acquistati). Le pagine `link-*` sono quasi certamente ciò che il proxy `insta-check.js` di questo repository serve realmente: la validazione del link/username incollato durante l'ordine.

Riscontro più diretto: esiste `importante-aggiornamento-sull-algoritmo-di-instagram-cosa-significa-per-i-nostri-servizi-e-come-adeguarsi` — una pagina che spiega come i servizi si adattano ai cambiamenti dell'algoritmo anti-fake-engagement di Instagram. Non più un'inferenza dal nome del repository: è testo pubblicato dal sito stesso, coerente col pattern "adeguarsi per evitare i blocchi".

**Nuovo cluster E — Strumenti gratuiti (già live).** Suite di tool generici, slegati dal prodotto follower/engagement: `generatore-qr-code-gratis-illimitato`, `compressore-immagini-online-gratis-illimitato`, `generatore-di-hashtag-per-social-gratuito`, `trascrizione-audio-ai-gratis-illimitata`, `metadata-remover-gratis-online`, `generatore-di-testi-fantasia`, `generatore-contenuti-social-gratis`, `pulitore-testo-invisibile-gratis`, `generatore-link-whatsapp-personalizzati`, `generatore-di-link-per-google`. Aggiunti a `keywords-digital-pr.csv`.

**Cluster D corretto.** Il tool per la settimana 9 del calendario ("Audit gratuito Instagram") esiste già: `/pages/analizza-profilo-instagram`, `/pages/analizza-engagement`, `/pages/simulatore-di-crescita-camecompany`. Il contenuto deve linkarli, non descriverne uno ipotetico.

**Igiene tecnica.** Pagine che sembrano test/duplicati mai ripuliti, da noindexare o rimuovere: `prova-1`, `verifica`, `aaa`, `o-12`, `menu2`, `copia-di-trasporti`, `copia-di-assistenza-clienti-istantanea`, `copia-di-app-ios`.

**Da chiarire con l'utente.** Pagine senza relazione apparente con social media o Digital PR: `accesso_rete`, `accesso-rete-bar`, `accesso-rete-pubblica`, `accesso-rete-3-0/4-0/5-0`, `macchinette`, `trasporti-mobilita`. Non c'è contenuto sufficiente per capire cosa siano; se appartengono a un'altra attività sullo stesso store Shopify vanno escluse da questo piano.

## Collezioni reali verificate (2026-08-18)

L'utente ha incollato anche `it-us/sitemap_collections_1.xml` (~80 collezioni). La maggioranza — follower, like, commenti, visualizzazioni, iscritti, condivisioni, retweet, reazioni, salvataggi, impression, membri, su Instagram/TikTok/Facebook/YouTube/X/Spotify/Telegram/WhatsApp/LinkedIn/Twitch/Threads/Snapchat, spesso segmentati "italiani" vs "internazionali" — conferma quantitativamente l'esclusione: non è un segmento del catalogo, è la maggioranza.

**URL commerciali reali** da usare per interlinking nel calendario editoriale, al posto dei placeholder:
- `/collections/articoli-press-custom` ("Digital PR e Articoli") — cluster B/C
- `/collections/analisi-report-social` ("Analisi e Report Social") — cluster D

**Due nuove esclusioni confermate:**
- `traffico-web`, `traffico-web-geo-target`, `traffico-web-mirato` — traffico web fittizio, esplicitamente "invalid clicks" nella policy Google Ads.
- `onlyfans` — crescita iscritti/engagement per creator OnlyFans, stessa logica delle altre.

**Da trattare con cautela, distinto da Digital PR e Articoli:** `backlink-e-link-building` — vendita di backlink a fini di ranking, collezione separata da `articoli-press-custom`. Se venduta come "compra posizionamento" è link scheme secondo le spam policies di Google Search (non solo Ads policy). Nessun contenuto di acquisizione costruito per questa finché non è chiaro come viene presentata.

**Da verificare:** `content-pack-service` ("Content Pack") — nome insufficiente per classificare; se è creazione contenuti/copywriting per clienti potrebbe essere un'altra linea conforme da aggiungere.

## Limiti residui

Non c'è ancora accesso API a Keyword Planner o Search Console — le fasce di volume restano stime qualitative da ricerca pubblica. Mancano `sitemap_collections_1.xml` e `sitemap_blogs_1.xml` per: individuare l'URL commerciale esatto del servizio Digital PR, ed evitare duplicati nel calendario editoriale rispetto agli articoli già pubblicati.
