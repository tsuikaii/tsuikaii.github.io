#!/usr/bin/env bash
set -euo pipefail

# Pages skips automatic dependency installation so the lockfiles control both
# package managers, including the Bundler version used to create Gemfile.lock.
export JEKYLL_ENV=production
export BUNDLE_PATH="${BUNDLE_PATH:-vendor/bundle}"
bundler_version="$(awk '/^BUNDLED WITH$/{getline; gsub(/^[[:space:]]+/, ""); print}' Gemfile.lock)"
gem install bundler --version "$bundler_version" --no-document
bundle "_${bundler_version}_" install
npm ci
npm test
npm run build

# Prevent a successful deployment of an incomplete build.
test -s _site/index.html
test -s _site/404.html
test -s _site/gallery-map/index.html
