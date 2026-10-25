# Project guidance

## Architecture

This project serves the user-supplied KhelKhilone homepage as a static Netlify site. It intentionally does not use a framework template because the supplied HTML already defines the complete front-page design.

## Key paths

- `public/index.html`: homepage, with embedded styles, image assets, and browser scripts.
- `netlify.toml`: publishes `public` without a build command.
- `.netlify/results.md`: summary for the current change.

## Conventions

Preserve the supplied branding and layout. Prefer focused edits over replacing the page. Keep new static assets inside `public`. Use root-relative URLs for internal navigation. Keep finished site metadata in the HTML head; do not add an `og:image`, because the platform supplies one.

## Non-obvious decisions

The uploaded HTML was moved out of the upload directory into the published directory. Its embedded assets remain self-contained. Existing WordPress/WooCommerce-style controls do not imply a working backend. Shopify cart/checkout lives in `public/js/store.js` (Storefront API, config in `public/js/config.js`); the newsletter uses Netlify Forms. Keep Admin API tokens out of the project.

Do not run local build, development-server, or test commands in this environment; the platform validates deployment automatically. Never inspect `.git` or expose credentials.


## Update
The site is now served by `server.js` (zero dependencies). The home page is `views/index.template.html` with `{{tokens}}` filled from `data/content.json` (defaults in `defaults.json`); `/admin` is `admin/index.html`. Editable fields are defined in SCHEMA in `server.js`.
