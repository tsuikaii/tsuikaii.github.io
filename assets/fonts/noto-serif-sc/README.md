# Self-hosted Noto Serif SC

The main blog uses Noto Serif SC (中文明朝／宋体) as its default font on desktop
and mobile. The original WOFF2 variable-font subsets come from Google Fonts;
weights 200–900 share the same files. `font.css` uses relative local URLs,
`unicode-range` for loading only the characters needed on each page, and
`font-display: swap` so text remains readable during loading. No Google Fonts
request is made by visitors, and no network download is needed during builds.

- Upstream: https://github.com/notofonts/noto-cjk
- Google Fonts metadata: https://github.com/google/fonts/tree/main/ofl/notoserifsc
- Source stylesheet: https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@200..900&display=swap
- Downloaded: 2026-10-08, using the modern Chrome stylesheet response.
- License: SIL Open Font License 1.1, included in `OFL.txt`.
- `manifest.json` records each original URL, local filename, size and SHA-256.

Keep all subsets and the license together when redistributing or updating.
The system serif fonts in `main.css` remain fallbacks for unsupported characters
and failed font loads. Code blocks retain their monospace font.
