# frozen_string_literal: true

require "cgi"
require "uri"

module Tsuikaii
  module ImageOptimization
    ASSET_HOST = "assets.hszhe9.com"
    INLINE_WIDTHS = [800, 1200].freeze
    INLINE_QUALITY = 75
    INLINE_SIZES = "(min-width: 48em) min(84rem, calc(100vw - 6rem)), calc(100vw - 3.2rem)"

    module_function

    def attribute(tag, name)
      match = tag.match(/\b#{Regexp.escape(name)}\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
      match && CGI.unescapeHTML(match[1] || match[2])
    end

    def add_attribute(tag, name, value)
      return tag if tag.match?(/\b#{Regexp.escape(name)}\s*=/i)

      tag.sub(/\s*\/?>\z/) do |ending|
        closing = ending.include?("/") ? " />" : ">"
        %( #{name}="#{CGI.escapeHTML(value)}"#{closing})
      end
    end

    def source_asset_url(tag)
      source = attribute(tag, "data-full-src") || attribute(tag, "src")
      return unless source

      match = source.match(%r{\Ahttps://#{Regexp.escape(ASSET_HOST)}(?:/cdn-cgi/image/[^/]+)?(/.*)\z}i)
      match && "https://#{ASSET_HOST}#{match[1]}"
    end

    def transformed_url(asset_url, width, quality)
      "https://#{ASSET_HOST}/cdn-cgi/image/width=#{width},quality=#{quality},format=auto#{URI.parse(asset_url).path}"
    end

    def optimize_tag(tag, index)
      loading = index < 2 ? "eager" : "lazy"
      optimized = add_attribute(tag, "loading", loading)
      optimized = add_attribute(optimized, "decoding", "async")
      if index.zero?
        optimized = add_attribute(optimized, "fetchpriority", "high")
      elsif index >= 2
        optimized = add_attribute(optimized, "fetchpriority", "low")
      end

      asset_url = source_asset_url(optimized)
      return optimized unless asset_url

      srcset = INLINE_WIDTHS.map do |width|
        "#{transformed_url(asset_url, width, INLINE_QUALITY)} #{width}w"
      end.join(", ")

      optimized = add_attribute(optimized, "srcset", srcset)
      add_attribute(optimized, "sizes", INLINE_SIZES)
    end

    def optimize_post(document)
      index = -1
      document.content = document.content.gsub(/<img\b[^>]*>/im) do |tag|
        index += 1
        optimize_tag(tag, index)
      end
    end
  end
end

Jekyll::Hooks.register :posts, :post_convert do |document|
  Tsuikaii::ImageOptimization.optimize_post(document)
end
