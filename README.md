# tsuikaii

Welcome to https://tsuikaii.com

## Local development

```bash
npm ci
ruby scripts/generate_gallery_data.rb
bundle exec jekyll serve
```

The main blog displays the original content and has no translation controls or
translation build hook. Its default font is self-hosted Noto Serif SC on desktop
and mobile; see [font assets](assets/fonts/noto-serif-sc/README.md) for source and
license details. Run `npm test` to check the map and retained translation service.
The main blog and film site now show their original content. The former
translation Worker source and tests are retained as historical tooling; see
[translation service notes](docs/multilingual.md).

The photo map uses Mapbox GL JS in a fullscreen globe view. It switches to dark
mode when the system uses a dark appearance. The sun/moon icon overrides the
system appearance for the current visit; opening the page again follows the
system by default. Cluster markers open a thumbnail list of places; selecting a
place flies directly to its photos. The top-right globe button restores the
overview. For local visual checks, `?map-theme=light` or `?map-theme=dark` overrides
the automatic appearance. Drag to explore, scroll or pinch to zoom, and select a
location to open its floating photo panel. For a local preview, create an ignored
`_config.local.yml` containing a Mapbox **public** token:

```yaml
mapbox:
  public_token: "YOUR_MAPBOX_PUBLIC_TOKEN"
  style: "mapbox://styles/mapbox/light-v11"
```

Run `bundle exec jekyll serve --config _config.yml,_config.local.yml` and open
`http://127.0.0.1:4000/gallery-map/`. The token is included in the rendered page
for Mapbox requests; use a public token with appropriate URL restrictions.
The map requires a configured public token.

Production builds read `MAPBOX_PUBLIC_TOKEN` from a Cloudflare Pages build variable.
Use a dedicated public token with only the map's read permissions and URL
restrictions for `https://tsuikaii.com` and `https://tsuikaii.github.io`.
Never use a secret (`sk.`) token: the build rejects it. The public token remains
visible to site visitors in HTML and Mapbox requests; a build variable keeps it
out of Git and build logs, not out of the browser.

## Deployment

Cloudflare Pages builds and deploys the `main` branch of
`tsuikaii/tsuikaii.github.io`. GitHub stores the source repository.

Pages build settings (production and preview):

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Root directory | Repository root |
| Build command | `npm run build:pages` |
| Build output directory | `_site` |
| Build system | v3 |
| `SKIP_DEPENDENCY_INSTALL` | `1` |
| `MAPBOX_PUBLIC_TOKEN` | Existing public `pk.` token |

Ruby and Node versions are pinned in `.ruby-version` and `.node-version`.
The build installs locked Ruby and npm dependencies, runs the tests,
generates gallery data, and builds Jekyll with local font assets.
The production canonical URL stays `https://tsuikaii.com`.
The archived translation Worker is separate from the website builds; its
secrets stay in Worker Secrets and are not needed by Pages.

Pages project: [tsuikaii](https://dash.cloudflare.com/9b5fdc8a73a01db70a0fea0345043dc8/pages/view/tsuikaii).
The Pages hostname is `tsuikaii.pages.dev`. Both `tsuikaii.com` and
`www.tsuikaii.com` are attached to Pages. A Cloudflare Page Rule sends `www`
requests to the canonical apex domain, preserving paths and query parameters.
The old GitHub Pages Actions workflow has been removed and GitHub Pages unpublished.
See [migration notes](docs/cloudflare-pages.md).
