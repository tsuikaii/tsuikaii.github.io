#!/usr/bin/env ruby

require "cgi"
require "date"
require "time"
require "yaml"

ROOT = File.expand_path("..", __dir__)
POSTS_DIR = File.join(ROOT, "_posts")
OUTPUT_PATH = File.join(ROOT, "_data", "gallery.yml")
LOCATION_PATH = File.join(ROOT, "_data", "gallery_locations.yml")
POST_URL_PATTERN = /\A(\d{4})-(\d{2})-(\d{2})-(.+)\z/
SOURCE_LABELS = {
  "local" => "本地 assets",
  "flickr" => "Flickr",
  "r2" => "R2",
  "remote" => "远程图片"
}.freeze

def extract_front_matter(raw)
  match = raw.match(/\A---\s*\n(.*?)\n---\s*\n/m)
  raise "Missing front matter" unless match

  front_matter = YAML.safe_load(match[1], permitted_classes: [Date, Time], aliases: true) || {}
  body = raw[match[0].length..] || ""
  [front_matter, body]
end

def load_location_metadata
  return {} unless File.exist?(LOCATION_PATH)

  YAML.safe_load(File.read(LOCATION_PATH, encoding: "UTF-8"), permitted_classes: [Date, Time], aliases: true) || {}
end

def extract_attr(tag, attr_name)
  return nil unless tag

  pattern = /
    #{Regexp.escape(attr_name)}
    \s*=\s*
    (?:
      "([^"]*)"
      |
      '([^']*)'
    )
  /imx

  match = tag.match(pattern)
  value = match && (match[1] || match[2])
  value && CGI.unescapeHTML(value.strip)
end

def normalize_src(value)
  return nil if value.nil? || value.strip.empty?

  cleaned = CGI.unescapeHTML(value.strip)
  return cleaned if cleaned.match?(%r{\Ahttps?://}i)
  return cleaned if cleaned.start_with?("/")

  "/#{cleaned.sub(%r{\A\./}, "")}"
end

def clean_text(value)
  return "" if value.nil?

  CGI.unescapeHTML(
    value
      .gsub(/<br\s*\/?>/i, "\n")
      .gsub(%r{</p>}i, "\n")
      .gsub(/<[^>]+>/, " ")
      .gsub(/[[:space:]]+/, " ")
      .strip
  )
end

def detect_source(src)
  return "remote" if src.nil? || src.empty?
  return "flickr" if src.include?("live.staticflickr.com")
  return "r2" if src.include?("assets.hszhe9.com")
  return "local" if src.start_with?("/assets/")

  "remote"
end

def caption_from_segment(segment)
  return nil if segment.nil? || segment.empty?

  segment.lines.each do |line|
    stripped = line.strip
    next if stripped.empty?
    next if stripped.start_with?("<")
    next if stripped.start_with?("{%")
    next if stripped.start_with?("###")

    text = clean_text(stripped)
    next if text.empty?

    return text
  end

  nil
end

def build_photo(src:, full_src:, caption:, alt:)
  normalized_src = normalize_src(src)
  normalized_full_src = normalize_src(full_src) || normalized_src
  normalized_caption = clean_text(caption)
  normalized_alt = clean_text(alt)
  final_caption = normalized_caption.empty? ? normalized_alt : normalized_caption
  final_alt = normalized_alt.empty? ? final_caption : normalized_alt
  source_type = detect_source(normalized_full_src || normalized_src)

  return nil unless normalized_src

  {
    "src" => normalized_src,
    "full_src" => normalized_full_src,
    "caption" => final_caption.empty? ? "未命名" : final_caption,
    "alt" => final_alt.empty? ? final_caption : final_alt,
    "source_type" => source_type,
    "source_label" => SOURCE_LABELS[source_type]
  }
end

def extract_figure_photos(body)
  photos = []
  remainder = body.gsub(/<figure\b[^>]*>.*?<\/figure>/im) do |figure|
    img_tag = figure[/<img\b[^>]*>/im]
    next "" unless img_tag

    caption = figure[/<figcaption\b[^>]*>(.*?)<\/figcaption>/im, 1]
    photo = build_photo(
      src: extract_attr(img_tag, "src"),
      full_src: extract_attr(img_tag, "data-full-src"),
      caption: caption,
      alt: extract_attr(img_tag, "alt")
    )
    photos << photo if photo
    ""
  end

  [photos, remainder]
end

def extract_inline_photos(body)
  photos = []

  body.to_enum(:scan, /<img\b[^>]*>/im).each do
    tag = Regexp.last_match(0)
    following = body[Regexp.last_match.end(0)..] || ""
    boundary = following.match(/<img\b|<figure\b|<\/div>|^###\s+/im)
    segment = boundary ? following[0...boundary.begin(0)] : following

    photo = build_photo(
      src: extract_attr(tag, "src"),
      full_src: extract_attr(tag, "data-full-src"),
      caption: caption_from_segment(segment),
      alt: extract_attr(tag, "alt")
    )
    photos << photo if photo
  end

  photos
end

def normalize_categories(categories)
  case categories
  when Array
    categories.compact.map(&:to_s)
  when nil
    []
  else
    categories.to_s.split(/\s+/)
  end
end

def build_post_url(path, categories, date)
  filename = File.basename(path, File.extname(path))
  match = filename.match(POST_URL_PATTERN)
  return "/" unless match

  category = categories.first
  prefix = category && !category.empty? ? "/#{category}" : ""
  "#{prefix}/#{date.strftime("%Y/%m/%d")}/#{match[4]}/"
end

location_metadata = load_location_metadata

entries = Dir.glob(File.join(POSTS_DIR, "*.*")).sort.filter_map do |path|
  raw = File.read(path, encoding: "UTF-8")
  front_matter, body = extract_front_matter(raw)
  figure_photos, remainder = extract_figure_photos(body)
  inline_photos = extract_inline_photos(remainder)
  photos = (figure_photos + inline_photos).compact
  next if photos.empty?

  title = front_matter["title"].to_s
  categories = normalize_categories(front_matter["categories"])
  date = Time.parse(front_matter["date"].to_s)
  location = location_metadata[title]

  {
    "title" => title,
    "excerpt" => front_matter["excerpt"].to_s.strip,
    "date" => date.iso8601,
    "date_display" => date.strftime("%Y年%-m月%-d日"),
    "url" => build_post_url(path, categories, date),
    "category" => categories.first.to_s,
    "photo_count" => photos.size,
    "photos" => photos,
    "location" => location && location.dup
  }
end

entries.sort_by! { |entry| entry["date"] }
entries.reverse!

source_counts = { "local" => 0, "flickr" => 0, "r2" => 0, "remote" => 0 }
all_photos = []

entries.each do |entry|
  entry["photos"].each do |photo|
    source_counts[photo["source_type"]] += 1 if source_counts.key?(photo["source_type"])
    all_photos << photo.merge(
      "post_title" => entry["title"],
      "post_url" => entry["url"],
      "post_date" => entry["date"],
      "post_date_display" => entry["date_display"]
    )
  end
end

data = {
  "generated_at" => Time.now.iso8601,
  "total_posts" => entries.size,
  "total_photos" => entries.sum { |entry| entry["photo_count"] },
  "source_counts" => source_counts,
  "entries" => entries,
  "photos" => all_photos
}

yaml = YAML.dump(data)
File.write(OUTPUT_PATH, "# This file is generated by scripts/generate_gallery_data.rb.\n#{yaml}", encoding: "UTF-8")
