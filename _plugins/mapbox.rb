# frozen_string_literal: true

# Inject the browser's public token at build time; never accept a secret token.
Jekyll::Hooks.register :site, :after_init do |site|
  next unless ENV.key?("MAPBOX_PUBLIC_TOKEN")

  token = ENV.fetch("MAPBOX_PUBLIC_TOKEN").strip
  raise "MAPBOX_PUBLIC_TOKEN must contain a Mapbox public token (pk.)." unless token.start_with?("pk.")

  site.config["mapbox"] ||= {}
  site.config["mapbox"]["public_token"] = token
end
