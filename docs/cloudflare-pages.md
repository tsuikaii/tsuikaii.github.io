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

1. Verify the production `pages.dev` deployment: home, an article,
   `/category/article/`, `/category/gallery/`, `/gallery-map/`, translation assets,
   and a missing URL's 404.
2. Add `tsuikaii.com` to Pages Custom domains and activate its DNS record.
3. Wait for the domain to show Active and verify HTTPS and site content.
4. Unpublish the old GitHub Pages site and remove `.github/workflows/pages.yml`.

Keep other subdomains and email DNS records intact. If `www.tsuikaii.com` is in
use, migrate its DNS and preserve the redirect to the apex as well.

## Later changes and rollback

Pushes to `main` trigger builds in Cloudflare. Inspect build logs and deployment
status in Workers & Pages. A build failure leaves the last successful deployment
live. Use Pages' deployment rollback to restore a previous successful build.

The historical GitHub cache rule in `cloudflare-blog-cache.md` describes the old
origin. `Blog CDN` was disabled during migration because it forced two-hour
caching over the origin's cache headers. Pages now serves and invalidates static
assets itself. Other media and microsite cache rules are retained.

`tsuikaii.com` and `www.tsuikaii.com` point to `tsuikaii.pages.dev` through proxied
CNAME records. The existing Cloudflare Page Rule for `www.tsuikaii.com/*` now
uses a 301 redirect to `https://tsuikaii.com/$1`, replacing its old `hszhe9.com`
target. It preserves paths and query parameters. Domain redirects are managed
at the zone level because Pages `_redirects` only supports source paths.

GitHub Pages is unpublished and its workflow removed. The final migration push
was verified to trigger a successful Cloudflare `github:push` deployment.
