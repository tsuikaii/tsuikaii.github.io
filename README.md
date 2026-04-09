# tsuikaii

A Jekyll blog for GitHub Pages.

## Local development

```bash
bundle install
bundle exec jekyll serve
```

## New post template

Copy `post-template.md` into `_posts/` and rename it with this format:

```bash
cp post-template.md _posts/2026-04-10-my-post.md
```

Then edit:

- `title`: the post title
- `date`: publish time
- `categories`: one of `article`, `album`, `music`, `poetry`
- `excerpt`: the card summary shown on list pages

## Deployment

Push to the `main` branch of `tsuikaii/tsuikaii.github.io` and enable GitHub Pages with source set to `GitHub Actions`.
