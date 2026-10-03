# tsuikaii

Welcome to https://tsuikaii.com

## Local development

```bash
npm ci
ruby scripts/generate_gallery_data.rb
bundle exec jekyll serve
```

The build hook prepares local OpenCC assets and trusted translation sources.
See [multilingual setup](docs/multilingual.md) for local translation testing and
Cloudflare Worker configuration. Run `npm test` to check the translation service.

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

Production builds read `MAPBOX_PUBLIC_TOKEN` from a repository Actions Secret.
Use a dedicated public token with only the map's read permissions and URL
restrictions for `https://tsuikaii.com` and `https://tsuikaii.github.io`.
Never use a secret (`sk.`) token: the build rejects it. The public token remains
visible to site visitors in HTML and Mapbox requests; an Actions Secret keeps it
out of Git and build logs, not out of the browser.

## Deployment

Push to the `main` branch of `tsuikaii/tsuikaii.github.io` and enable GitHub Pages with source set to `GitHub Actions`.
