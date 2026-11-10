# Record Store

A small shop for a Discogs vinyl collection. Log in with Discogs, or type a public username, and flip through the records like crates in an independent store.

The name on the neon sign lives in one place: `SHOP_OWNER_NAME` in [`lib/config.ts`](lib/config.ts). Change that line and the sign, the browser title, and the door all follow.

## 1. Register a Discogs app

1. Open [Discogs developer settings](https://www.discogs.com/settings/developers) and create an application.
2. Set the callback URL to `http://localhost:3000/api/auth/callback`.

Discogs uses that exact URL when it sends the user back after they approve access. The consumer secret stays on the server. The browser never sees it.

## 2. Add the keys

```bash
cp .env.local.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.local.example .env.local
```

Fill in:

- `DISCOGS_CONSUMER_KEY` and `DISCOGS_CONSUMER_SECRET` from the Discogs app
- `SESSION_SECRET`, at least 32 characters
- `APP_URL=http://localhost:3000`

## 3. Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). **Log in with Discogs** walks through OAuth and lands in the shop. **Just browse a username** loads a public collection with the app key and secret, without signing anyone in.

The server logs the Discogs identity response when a login finishes. Look for `[record-store] Discogs identity:` in the terminal.

## 4. Deploy to Vercel

1. Import the project in Vercel.
2. Add the same environment variables. Set `APP_URL` to the production origin, for example `https://your-shop.vercel.app`, with no trailing slash.
3. In the Discogs app settings, add the production callback URL: `https://your-shop.vercel.app/api/auth/callback`.
4. Redeploy.

The barcode scanner uses the phone camera. Browsers only allow that on a secure page, so `http://localhost` works on the computer you are using, and a phone needs HTTPS. Test the scanner on the deployed site, or through a tunnel such as ngrok.

Local collections are cached in memory on the server for a few minutes. A new serverless instance starts with an empty cache, which is expected. Very large collections make several Discogs requests. The shop reads `X-Discogs-Ratelimit-Remaining`, slows down when the budget gets low, and retries if Discogs answers with 429. On Vercel the collection route allows up to 60 seconds. A collection of many thousands of records may need a plan with a longer function duration.

## Shop views

- **Crates** groups sleeves by genre. Drag a crate sideways, or swipe it on a phone.
- **Wall** hangs the twelve newest additions above the rest.
- **Shelves** shows spines in alphabetical order. Names that start with “The” are filed by the next word.
- **Dig for something** opens a random record from whatever is currently on the table.
- Price sort looks up marketplace lows for the first 36 matches so the shop does not hammer Discogs. Opening a record always loads its current low price and how many copies are for sale.
