#!/usr/bin/env ruby
# frozen_string_literal: true
# Step 4. Read the CRM export, link each transcript and email thread to its deal, report how well everything links
# up, and list what still needs scoring. Safe to re-run: anything already scored is skipped.
#
#   ruby prepare.rb <run-folder>                 everything
#   ruby prepare.rb <run-folder> --only D-1042   the trial run: queue just this one deal's call(s) and emails
#
# Writes workspace/deals.json, workspace/link_report.json, workspace/queue_calls.json, workspace/queue_emails.json,
# workspace/unmatched_transcripts.txt and workspace/threads/*.txt.
require_relative 'lib'

dir = RC.run_dir(ARGV)
cfg = RC.config(dir)
only = (i = ARGV.index('--only')) ? ARGV[i + 1] : nil
col = cfg['columns'] || {}
%w[deal_id owner stage].each do |k|
  RC.die("config.json columns.#{k} is required (the CSV header for it). Run inspect.rb on the export to see the headers.") unless col[k]
end
safe = ->(id) { id.to_s.gsub(/[^A-Za-z0-9_.-]+/, '_') }

# ── deals ──
deals_csv = RC.path(dir, cfg['deals_csv']) or RC.die('config.json deals_csv is required')
RC.die("deals file not found: #{deals_csv}") unless File.exist?(deals_csv)
rows = CSV.read(deals_csv, headers: true, encoding: 'bom|utf-8')
missing = col.values.compact.reject { |h| rows.headers.include?(h) }
RC.die("these mapped columns are not in #{File.basename(deals_csv)}: #{missing.join(', ')}. Headers are: #{rows.headers.compact.join(', ')}") unless missing.empty?
deals = {}
dupes = []
rows.each do |r|
  id = r[col['deal_id']].to_s.strip
  next if id.empty?
  dupes << id if deals.key?(id)
  deals[id] = {
    'deal_id' => id, 'account' => (r[col['account']].to_s.strip if col['account']), 'owner' => r[col['owner']].to_s.strip,
    'stage' => r[col['stage']].to_s.strip, 'close_date' => (r[col['close_date']].to_s.strip if col['close_date']),
    'division' => (r[col['division']].to_s.strip if col['division'])
  }
  deals[id]['outcome'] = RC.outcome(deals[id]['stage'], cfg)
end
RC.die("deal IDs repeat in the CRM export (it must have one row per deal): #{dupes.uniq.first(10).join(', ')}") unless dupes.empty?
RC.die('the CRM export has no deals (is the deal ID column empty?)') if deals.empty?
RC.die("--only #{only}: that deal ID is not in the CRM export") if only && !deals.key?(only)
RC.write_json(RC.ws(dir, 'deals.json'), deals)

# ── transcripts → deals: an approved map first, then the deal ID in the file name ──
map = {}
if (mp = RC.path(dir, cfg['transcript_map_csv']))
  RC.die("transcript_map_csv not found: #{mp}") unless File.exist?(mp)
  CSV.foreach(mp, headers: true, encoding: 'bom|utf-8') do |r|
    f = r['file'].to_s.strip
    id = r['deal_id'].to_s.strip
    next if f.empty? || id.empty?
    RC.die("transcript map: deal #{id.inspect} (for #{f}) is not in the CRM export") unless deals.key?(id)
    map[f] = id
  end
end
scored = RC.score_records(dir, 'calls', [])
scored_calls = scored.map { |f, j| j['call_id'] || File.basename(f, '.json') }
queue_calls = []
unmatched = []
linked = Hash.new { |h, k| h[k] = [] }
transcripts = 0
if (tdir = RC.path(dir, cfg['transcripts_dir']))
  RC.die("transcripts folder not found: #{tdir}") unless Dir.exist?(tdir)
  pattern = Regexp.new(cfg['deal_id_pattern'] || '\A.*--(.+?)\.txt\z')   # default: the text after the last "--"
  Dir[File.join(tdir, '**', '*.txt')].sort.each do |f|
    transcripts += 1
    base = File.basename(f)
    call_id = safe.call(File.basename(f, '.txt'))
    m = base.match(pattern)
    id = map[base] || (m && m[1])
    unless id && deals.key?(id)
      unmatched << "#{base}  (deal ID read: #{id.inspect})"
      next
    end
    linked[id] << call_id
    next if scored_calls.include?(call_id) || (only && id != only)
    queue_calls << { 'call_id' => call_id, 'deal_id' => id, 'account' => deals[id]['account'], 'owner' => deals[id]['owner'], 'file' => f }
  end
end
# calls already scored count as linked too (for example a run whose scores were produced elsewhere)
scored.each { |f, j| linked[j['deal_id']] |= [j['call_id'] || File.basename(f, '.json')] if deals.key?(j['deal_id']) }
File.write(RC.ws(dir, 'unmatched_transcripts.txt'), unmatched.join("\n") + "\n")

# ── emails → one thread per deal: a CSV export, or one .txt per deal ──
threads = {}
if (ecsv = RC.path(dir, cfg['emails_csv']))
  RC.die("emails file not found: #{ecsv}") unless File.exist?(ecsv)
  ec = cfg['email_columns'] || {}
  %w[deal_id body].each { |k| RC.die("config.json email_columns.#{k} is required. Run inspect.rb on the export with --emails.") unless ec[k] }
  by_deal = Hash.new { |h, k| h[k] = [] }
  CSV.foreach(ecsv, headers: true, encoding: 'bom|utf-8') do |r|
    id = r[ec['deal_id']].to_s.strip
    by_deal[id] << r if deals.key?(id)
  end
  by_deal.each do |id, mails|
    mails = mails.sort_by { |m| ec['date'] ? m[ec['date']].to_s : '' }
    threads[id] = mails.map do |m|
      head = %w[date from to subject].map { |k| ec[k] ? "#{k.capitalize}: #{m[ec[k]]}" : nil }.compact.join("\n")
      "#{head}\n\n#{m[ec['body']]}\n"
    end.join("\n-----\n\n")
  end
end
if (edir = RC.path(dir, cfg['emails_dir']))
  RC.die("emails folder not found: #{edir}") unless Dir.exist?(edir)
  epat = Regexp.new(cfg['email_deal_id_pattern'] || '\A.*--(.+?)\.txt\z')
  Dir[File.join(edir, '**', '*.txt')].sort.each do |f|
    m = File.basename(f).match(epat)
    id = m && m[1]
    next unless id && deals.key?(id)
    threads[id] = [threads[id], File.read(f, encoding: 'bom|utf-8').scrub].compact.join("\n-----\n\n")
  end
end
scored_emails = RC.score_records(dir, 'emails', []).map { |_, j| j['deal_id'].to_s }
queue_emails = []
threads.each do |id, text|
  File.write(RC.ws(dir, 'threads', "#{safe.call(id)}.txt"), text)
  next if scored_emails.include?(id) || (only && id != only)
  queue_emails << { 'deal_id' => id, 'thread_file' => RC.ws(dir, 'threads', "#{safe.call(id)}.txt"), 'owner' => deals[id]['owner'] }
end
email_deals = (threads.keys + scored_emails).uniq.select { |id| deals.key?(id) }

# ── link report ──
call_deals = linked.keys
both = call_deals & email_deals
trial = (both.empty? ? call_deals : both).sort_by { |id| [deals[id]['outcome'] == 'open' ? 1 : 0, -linked[id].size, id] }.first(5)
report = { 'deals' => deals.size, 'closed' => deals.values.count { |d| d['outcome'] != 'open' }, 'transcripts' => transcripts,
           'transcripts_linked' => transcripts - unmatched.size, 'unmatched' => unmatched.size, 'deals_with_calls' => call_deals.size,
           'deals_with_emails' => email_deals.size, 'deals_with_both' => both.size, 'trial_candidates' => trial,
           'queue_calls' => queue_calls.size, 'queue_emails' => queue_emails.size, 'only' => only }
# validate the trial deal before anything is written, so a refused --only run leaves the queues untouched
RC.die("--only #{only}: that deal has no linked transcript, so it cannot be the trial deal. Pick one of: #{trial.join(', ')}") if only && !linked.key?(only)
RC.write_json(RC.ws(dir, 'link_report.json'), report)
RC.write_json(RC.ws(dir, 'queue_calls.json'), queue_calls)
RC.write_json(RC.ws(dir, 'queue_emails.json'), queue_emails)

puts 'Link report'
puts "  CRM export:    #{deals.size} deals (#{report['closed']} closed, #{deals.size - report['closed']} open), #{deals.values.map { |d| d['owner'] }.uniq.size} owners"
puts "  Transcripts:   #{transcripts} found, #{report['transcripts_linked']} linked to a deal, #{unmatched.size} not linked" + (unmatched.any? ? ' (see workspace/unmatched_transcripts.txt)' : '')
puts "  Email threads: #{email_deals.size} deals"
puts "  Deals with a call: #{call_deals.size}   with emails: #{email_deals.size}   with both: #{both.size}"
puts "  Good trial deals: #{trial.map { |id| "#{id} (#{deals[id]['account']}, #{deals[id]['owner']})" }.join('; ')}" if trial.any?

if call_deals.empty? && !cfg['allow_no_transcripts']
  why = if !cfg['transcripts_dir'] then 'no transcripts_dir is set in config.json'
        elsif transcripts.zero? then "no .txt files were found in #{cfg['transcripts_dir']}"
        else 'none of the transcripts could be linked to a deal: the deal IDs in their file names do not match the CRM export'
        end
  RC.die("no call is linked to any deal, so there is nothing to coach from (#{why}). " \
         'Fix the file names, set deal_id_pattern, or run suggest_matches.rb to propose matches for the user to approve.')
end
if only
  puts "  Trial mode: queued #{queue_calls.size} call(s) and #{queue_emails.size} email thread(s) for #{only} only"
end
puts "  To score: #{queue_calls.size} calls, #{queue_emails.size} email threads"
puts(queue_calls.empty? && queue_emails.empty? ? 'next: run assemble.rb' : 'next: score the queues (references/scoring.md), then run assemble.rb')
