#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/to-webp.sh [options] <file-or-directory>...

Options:
  -o, --output-dir DIR   Write converted files under DIR
  -q, --quality N        WebP quality (default: 82)
  -w, --width PX         Resize to width PX, keep aspect ratio
  -h, --help             Show this help

Examples:
  scripts/to-webp.sh assets/images/photo.jpg
  scripts/to-webp.sh -q 80 -w 1800 /Users/me/Downloads/album
  scripts/to-webp.sh -q 80 -w 1800 -o assets/images/eind /Users/me/Downloads/eind-1.jpg
EOF
}

if ! command -v cwebp >/dev/null 2>&1; then
  echo "Error: cwebp is not installed. Try: brew install webp" >&2
  exit 1
fi

quality=82
width=""
output_dir=""
inputs=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -o|--output-dir)
      output_dir="$2"
      shift 2
      ;;
    -q|--quality)
      quality="$2"
      shift 2
      ;;
    -w|--width)
      width="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      inputs+=("$1")
      shift
      ;;
  esac
done

if [[ ${#inputs[@]} -eq 0 ]]; then
  usage >&2
  exit 1
fi

mkdir -p "${output_dir:-.}"

declare -a cwebp_args
cwebp_args=(-q "$quality" -mt)
if [[ -n "$width" ]]; then
  cwebp_args+=(-resize "$width" 0)
fi

convert_file() {
  local src="$1"
  local root="$2"
  local rel dest

  if [[ -n "$output_dir" ]]; then
    if [[ -d "$root" ]]; then
      rel="${src#"$root"/}"
    else
      rel="$(basename "$src")"
    fi
    dest="$output_dir/${rel%.*}.webp"
  else
    dest="${src%.*}.webp"
  fi

  mkdir -p "$(dirname "$dest")"
  echo "Converting: $src -> $dest"
  cwebp "${cwebp_args[@]}" "$src" -o "$dest" >/dev/null
}

for input in "${inputs[@]}"; do
  if [[ -f "$input" ]]; then
    convert_file "$input" "$input"
    continue
  fi

  if [[ -d "$input" ]]; then
    while IFS= read -r file; do
      convert_file "$file" "$input"
    done < <(find "$input" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) | sort)
    continue
  fi

  echo "Skipping missing path: $input" >&2
done
