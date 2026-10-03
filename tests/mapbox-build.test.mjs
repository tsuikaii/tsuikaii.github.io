import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const plugin = fileURLToPath(new URL('../_plugins/mapbox.rb', import.meta.url));
const harness = `
require 'json'
module Jekyll
  module Hooks
    def self.register(*args, &block)
      @hook = block
    end
    def self.run(site)
      @hook.call(site)
    end
  end
end
load ARGV.fetch(0)
site = Struct.new(:config).new({'mapbox' => {'public_token' => 'pk.local-fixture', 'style' => 'light-style'}})
begin
  Jekyll::Hooks.run(site)
  puts JSON.generate(site.config)
rescue => error
  warn error.message
  exit 1
end
`;

function buildConfig(token) {
  const env = { ...process.env };
  delete env.MAPBOX_PUBLIC_TOKEN;
  if (token !== undefined) env.MAPBOX_PUBLIC_TOKEN = token;
  return spawnSync('ruby', ['-e', harness, plugin], { env, encoding: 'utf8' });
}

test('build injects the public environment token without replacing map styles', () => {
  const result = buildConfig('pk.build-fixture');
  assert.equal(result.status, 0);
  const config = JSON.parse(result.stdout);
  assert.equal(config.mapbox.public_token, 'pk.build-fixture');
  assert.equal(config.mapbox.style, 'light-style');
});

test('local builds retain local configuration when no deployment token is provided', () => {
  const result = buildConfig();
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).mapbox.public_token, 'pk.local-fixture');
});

test('missing and private deployment tokens fail without printing credentials', () => {
  for (const token of ['', 'sk.private-fixture', 'invalid-fixture']) {
    const result = buildConfig(token);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /must contain a Mapbox public token/);
    if (token) assert(!result.stderr.includes(token));
  }
});
