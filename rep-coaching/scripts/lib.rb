# frozen_string_literal: true
# Shared helpers for the rep-coaching scripts. Ruby standard library only; nothing here touches the network.
require 'csv'
require 'json'
require 'date'
require 'fileutils'

$stdout.sync = true   # keep normal output and errors in the order they happen

module RC
  SKILL_DIR = File.expand_path('..', __dir__)
  ASSETS    = File.join(SKILL_DIR, 'assets')
  MEDDIC_KEYS  = %w[metrics economic_buyer decision_criteria decision_process identify_pain champion].freeze
  SANDLER_KEYS = %w[rapport upfront_contract pain budget decision fulfillment postsell].freeze
  KEYS = (MEDDIC_KEYS + SANDLER_KEYS).freeze

  module_function

  def die(msg)
    warn "ERROR: #{msg}"
    exit 1
  end

  # The run folder holds config.json and receives workspace/ and the finished page.
  def run_dir(argv)
    dir = argv[0] or die('usage: ruby <script>.rb <run-folder>')
    dir = File.expand_path(dir)
    die("no config.json in #{dir}") unless File.exist?(File.join(dir, 'config.json'))
    dir
  end

  def config(dir)
    c = JSON.parse(File.read(File.join(dir, 'config.json')))
    c['company'] ||= {}
    c['company']['name'] ||= 'Your Company'
    c['won_stages'] ||= ['Closed Won']
    c['lost_stages'] ||= ['Closed Lost']
    c['weights'] ||= 'learn'
    c['min_closed_deals'] ||= 40
    c['output'] ||= 'rep_coaching.html'
    c
  rescue JSON::ParserError => e
    die("config.json is not valid JSON: #{e.message}")
  end

  def path(dir, rel)
    return nil if rel.nil? || rel.to_s.empty?
    File.expand_path(rel, dir)
  end

  def ws(dir, *parts)
    p = File.join(dir, 'workspace', *parts)
    FileUtils.mkdir_p(File.dirname(p))
    p
  end

  def read_json(p, default = nil)
    File.exist?(p) ? JSON.parse(File.read(p)) : default
  end

  # Write to a temp file, then rename, so a crash never leaves half a file behind.
  def write_json(p, obj)
    FileUtils.mkdir_p(File.dirname(p))
    tmp = "#{p}.tmp"
    File.write(tmp, JSON.pretty_generate(obj))
    File.rename(tmp, p)
  end

  def content(dir, cfg)
    custom = path(dir, cfg['content'])
    file = custom && File.exist?(custom) ? custom : File.join(ASSETS, 'content.json')
    c = JSON.parse(File.read(file))
    keys = c['dims'].map { |d| d['key'] }
    die("content file #{file} must define exactly these 13 skills: #{KEYS.join(', ')}") unless keys.sort == KEYS.sort
    c
  end

  # Call and email evidence compound: agreeing sources push the score higher than either alone.
  # Single-source deals get that source's score scaled to 0-10, with no penalty.
  def combined(call, email)
    return nil if call.nil? && email.nil?
    return (email * 2.0).round(1) if call.nil?
    return (call * 2.0).round(1) if email.nil?
    ((1 - (1 - call / 5.0) * (1 - email / 5.0)) * 10).round(1)
  end

  # Read scores loosely ("2", "2.0", 2.0), but only ever keep whole numbers 0-5.
  def int_score(v)
    return nil if v.nil? || v.to_s.strip.empty?
    f = Float(v.to_s) rescue (return :bad)
    return :bad unless f == f.round && f >= 0 && f <= 5
    f.to_i
  end

  # Every score record of one kind ("calls" or "emails"), as [label, record] pairs: one JSON file per item in
  # workspace/scores/<kind>/, plus any bundled workspace/scores/<kind>.jsonl (one record per line, with call_id).
  def score_records(dir, kind, errors)
    out = []
    Dir[ws(dir, "scores", kind, "*.json")].sort.each do |f|
      out << [f, JSON.parse(File.read(f))]
    rescue JSON::ParserError
      errors << "#{File.basename(f)}: not valid JSON"
    end
    bundle = ws(dir, "scores", "#{kind}.jsonl")
    if File.exist?(bundle)
      File.foreach(bundle).with_index(1) do |line, i|
        next if line.strip.empty?
        j = JSON.parse(line)
        out << ["#{kind}.jsonl line #{i}", j]
      rescue JSON::ParserError
        errors << "#{kind}.jsonl line #{i}: not valid JSON"
      end
    end
    out
  end

  def outcome(stage, cfg)
    return 'won' if cfg['won_stages'].include?(stage)
    return 'lost' if cfg['lost_stages'].include?(stage)
    'open'
  end
end
