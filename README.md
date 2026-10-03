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

## Deployment

Push to the `main` branch of `tsuikaii/tsuikaii.github.io` and enable GitHub Pages with source set to `GitHub Actions`.
