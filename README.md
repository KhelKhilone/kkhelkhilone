# KhelKhilone — Cloudflare Pages package

This package adapts the KhelKhilone storefront and content editor for Cloudflare Pages Functions. See **CLOUDFLARE-SETUP.txt** and follow it in order. The KV namespace binding is already configured for the namespace ID supplied by the user.

- Storefront homepage: `/`
- Store: `/shop`
- Admin editor with embedded homepage preview: `/admin/`
- Persistent edited content and uploaded images: Cloudflare KV binding `KK_DATA`
- Runtime: Cloudflare Pages Functions, deployed through Git integration (not dashboard Direct Upload)

The admin editor supports homepage content editing, section ordering, image uploads, and a mouse-based Visual Edit mode. In Visual Edit, click a homepage element, drag it to reposition it, adjust width/height, hide or restore it, save a draft, and publish when ready. Visual changes are stored separately from regular content. Desktop and mobile now have independent visual-layout drafts and published layouts: use the Desktop and Mobile preview buttons in Admin before editing. Saving/publishing stores both responsive layouts independently, so mobile positioning changes do not overwrite desktop positioning. Product/cart/checkout code is not changed by the visual layout feature.

For local testing, copy `.dev.vars.example` to `.dev.vars`, set local-only secrets, then run `npm install` and `npm run dev`. Open `http://127.0.0.1:8788/admin/`. The included KV ID is a test placeholder; create and bind a separate test namespace before deploying. Never point a test deployment at your live KV namespace.

The original `server.js` is retained for local Node.js testing/reference, but Cloudflare Pages uses `functions/[[path]].js` instead.

Shopify setup is still required: in `public/js/config.js`, set `shop` to the store's permanent `*.myshopify.com` domain and use only a public Storefront API token. Never expose a Shopify Admin API token in browser code.

## Header category menu editing and first-paint layout
- Admin now includes a **Header category menu** group. Edit each menu-group heading, edit links as `Label | URL` (one per line), remove a link line, or remove a whole group. Press **Save changes** to persist it in the existing `KK_DATA` content record.
- Published desktop/mobile visual geometry is emitted as server-side CSS so position and size adjustments are present on the first HTML response rather than waiting for the visual editor's browser fetch. Desktop rules apply at 768px and above; mobile rules apply below 768px.
- Keep the production `KK_DATA` binding pointed at the existing namespace to retain saved site content and visual layouts.
