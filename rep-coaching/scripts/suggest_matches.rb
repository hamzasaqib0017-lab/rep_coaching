#!/usr/bin/env ruby
# frozen_string_literal: true
# Step 2 helper, for transcripts whose file names carry no deal ID. Reads each unmatched transcript, finds which CRM
# account names it mentions, and proposes a deal. Nothing is linked until the user approves: they review
# workspace/suggested_map.csv, fix or delete rows, and save it as the file named in config.json transcript_map_csv.
#
#   ruby suggest_matches.rb <run-folder>        (run prepare.rb first, so workspace/deals.json exists)
require_relative 'lib'

dir = RC.run_dir(ARGV)
cfg = RC.config(dir)
deals = RC.read_json(RC.ws(dir, 'deals.json')) or RC.die('workspace/deals.json missing: run prepare.rb first')
tdir = RC.path(dir, cfg['transcripts_dir']) or RC.die('config.json transcripts_dir is not set')
pattern = Regexp.new(cfg['deal_id_pattern'] || '\A.*--(.+?)\.txt\z')
mapped = {}
if (mp = RC.path(dir, cfg['transcript_map_csv'])) && File.exist?(mp)
  CSV.foreach(mp, headers: true) { |r| mapped[r['file'].to_s.strip] = r['deal_id'].to_s.strip }
end

# Account names to look for: drop very short or generic names, and common company suffixes.
SUFFIX = /[,.]?\s+(inc|llc|ltd|limited|corp|corporation|co|company|group|plc|gmbh)\.?\z/i
norm = ->(s) { s.to_s.strip.sub(SUFFIX, '').strip }
by_account = Hash.new { |h, k| h[k] = [] }
deals.each_value { |d| by_account[norm.call(d['account'])] << d unless norm.call(d['account']).size < 4 }
RC.die('the CRM export has no account names to match on (map columns.account in config.json)') if by_account.empty?
names = by_account.keys.sort_by { |n| -n.size }

rows = []
Dir[File.join(tdir, '**', '*.txt')].sort.each do |f|
  base = File.basename(f)
  m = base.match(pattern)
  next if mapped.key?(base) || (m && deals.key?(m[1]))
  text = File.read(f, encoding: 'bom|utf-8').scrub
  date = text[/\b(20\d\d-\d\d-\d\d)\b/, 1]
  hits = names.map { |n| [n, text.scan(/(?<![A-Za-z0-9])#{Regexp.escape(n)}(?![A-Za-z0-9])/i).size] }.select { |_, c| c.positive? }
  hits = hits.sort_by { |n, c| [-c, -n.size] }
  if hits.empty?
    rows << [base, '', '', 0, 'none', 'no CRM account name found in the text']
    next
  end
  account, count = hits.first
  cands = by_account[account]
  # Several deals on one account: prefer the deal that was still open on the call date and closes soonest after it
  # (a deal that closed before the call is a poor fit); with no dates to compare, prefer a deal that is open now.
  call_day = (Date.parse(date) rescue nil)
  pick = cands.min_by do |d|
    cd = (Date.parse(d['close_date'].to_s) rescue nil)
    if call_day && cd
      gap = (cd - call_day).to_i
      [gap.negative? ? 1 : 0, gap.abs, d['outcome'] == 'open' ? 0 : 1]
    else
      [2, 0, d['outcome'] == 'open' ? 0 : 1]
    end
  end
  tie = hits.size > 1 && hits[1][1] == count
  conf = if tie || count == 1 then 'low'
         elsif cands.size > 1 then 'medium'
         else 'high'
         end
  others = (cands - [pick]).map { |d| d['deal_id'] } + hits[1, 2].to_a.map { |n, c| "#{n} (#{c} mentions)" }
  rows << [base, pick['deal_id'], pick['account'], count, conf, others.join('; ')]
end

out = RC.ws(dir, 'suggested_map.csv')
CSV.open(out, 'w') do |csv|
  csv << %w[file deal_id account mentions confidence other_candidates]
  rows.each { |r| csv << r }
end
tally = rows.group_by { |r| r[4] }.transform_values(&:size)
puts "#{rows.size} unmatched transcripts read: #{%w[high medium low none].map { |k| "#{tally[k] || 0} #{k}" }.join(', ')}"
puts "suggestions: #{out}"
puts 'next: show the user the list (medium, low and none rows first), let them correct or delete rows, then save it as'
puts "      the file named in config.json transcript_map_csv (e.g. transcript_map.csv) and run prepare.rb again"
