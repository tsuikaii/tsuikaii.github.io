# Cloudflare Pages deployment

The main blog uses Cloudflare Pages Git integration with
`tsuikaii/tsuikaii.github.io`, production branch `main`. GitHub retains the source;
Cloudflare runs the build and serves the generated `_site` directory.

Use the build settings in the repository README. `SKIP_DEPENDENCY_INSTALL=1`
allows `scripts/build-pages.sh` to install the exact Bundler version from
`Gemfile.lock` before installing gems. Set the existing Mapbox public token as
`MAPBOX_PUBLIC_TOKEN` for both production and preview builds. Never supply the
translation API key to Pages: the translation service has its own Worker.

## Domain cutover

1. Verify the production `pages.dev` deployment: home, an article, `/archive/`,
   `/gallery/`, `/gallery-map/`, translation assets, and a missing URL's 404.
2. Add `tsuikaii.com` to Pages Custom domains and activate its DNS record.
3. Wait for the domain to show Active and verify HTTPS and site content.
4. Unpublish the old GitHub Pages site and remove `.github/workflows/pages.yml`.

Keep other subdomains and email DNS records intact. If `www.tsuikaii.com` is in
use, migrate its DNS and preserve the redirect to the apex as well.

## Later changes and rollback

Pushes to `main` trigger builds in Cloudflare. Inspect build logs and deployment
status in Workers & Pages. A build failure leaves the last successful deployment
live. Use Pages' deployment rollback to restore a previous successful build.

The historical GitHub cache rules in `cloudflare-blog-cache.md` describe the old
origin. Pages serves static assets itself; do not add a new Cache Everything
rule as part of this migration. Check existing zone rules during cutover so a
cached GitHub response does not mask the new deployment.
