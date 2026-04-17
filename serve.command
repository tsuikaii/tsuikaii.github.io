#!/bin/bash

set -euo pipefail

cd "$(dirname "$0")"
ruby scripts/generate_gallery_data.rb
exec bundle exec jekyll serve

sleep 1

open http://127.0.0.1:4000
