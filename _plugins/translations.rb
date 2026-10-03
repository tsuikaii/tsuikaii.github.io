# API credentials never enter the site output. Also runs during serve rebuilds.
Jekyll::Hooks.register :site, :post_write do |site|
  script = File.join(site.source, "scripts", "build-translations.mjs")
  success = system("node", script, site.dest)
  raise "Translation assets failed to build. Run npm ci first." unless success
end
