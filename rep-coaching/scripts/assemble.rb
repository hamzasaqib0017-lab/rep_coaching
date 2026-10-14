#!/usr/bin/env ruby
# frozen_string_literal: true
# Step 4. Validate every score file, build the master table, combine call + email evidence per deal, roll up per
# rep (each deal counted once), learn the engine weights, and gather each rep's evidence from their own calls.
#
#   ruby assemble.rb <run-folder>
#
# Reads  workspace/deals.json, workspace/scores/calls/*.json, workspace/scores/emails/*.json
# Writes workspace/master.csv (one CRM row per deal + one row per call) and workspace/app_data.json
require_relative 'lib'

dir = RC.run_dir(ARGV)
cfg = RC.config(dir)
content = RC.content(dir, cfg)
deals = RC.read_json(RC.ws(dir, 'deals.json')) or RC.die('workspace/deals.json missing: run prepare.rb first')
aliases = cfg['rep_aliases'] || {}
excluded = cfg['exclude_reps'] || []
deals.each_value { |d| d['owner'] = aliases[d['owner']] || d['owner'] }
errors = []

# ── call scores ──
calls = RC.score_records(dir, 'calls', errors).map do |f, j|
  id = j['deal_id'].to_s
  errors << "#{File.basename(f)}: deal_id #{id.inspect} is not in the CRM export" unless deals.key?(id)
  date = j['call_date'].to_s
  errors << "#{File.basename(f)}: call_date #{date.inspect} must be YYYY-MM-DD" unless date =~ /\A\d{4}-\d{2}-\d{2}\z/ && (Date.parse(date) rescue false)
  sc = {}
  RC::KEYS.each do |k|
    s = j.dig('scores', k) or (errors << "#{File.basename(f)}: missing skill #{k}"; next)
    v = RC.int_score(s['score'])
    errors << "#{File.basename(f)}: #{k} score #{s['score'].inspect} must be a whole number 0-5" if v == :bad || v.nil?
    errors << "#{File.basename(f)}: #{k} has no reason" if s['reason'].to_s.strip.empty?
    sc[k] = { 'score' => (v.is_a?(Integer) ? v : 0), 'reason' => s['reason'].to_s.strip, 'note' => s['note'].to_s.strip }
  end
  { 'call_id' => (j['call_id'] || File.basename(f, '.json')), 'deal_id' => id, 'call_date' => date, 'scores' => sc }
end.compact

# ── email scores (one per deal thread) ──
emails = {}
RC.score_records(dir, 'emails', errors).each do |f, j|
  id = j['deal_id'].to_s
  errors << "emails/#{File.basename(f)}: deal_id #{id.inspect} is not in the CRM export" unless deals.key?(id)
  sc = {}
  RC::KEYS.each do |k|
    s = j.dig('scores', k) or (errors << "emails/#{File.basename(f)}: missing skill #{k}"; next)
    v = RC.int_score(s['score'])
    errors << "emails/#{File.basename(f)}: #{k} score #{s['score'].inspect} must be a whole number 0-5" if v == :bad || v.nil?
    sc[k] = { 'score' => (v.is_a?(Integer) ? v : 0), 'reason' => s['reason'].to_s.strip }
  end
  emails[id] = sc
end

# ── the key: deal ID + call date appears once ──
calls.group_by { |c| [c['deal_id'], c['call_date']] }.each do |(id, date), cs|
  errors << "two or more calls on deal #{id} share the date #{date} (#{cs.map { |c| c['call_id'] }.join(', ')}); the key deal ID + call date must be unique" if cs.size > 1
end

unless errors.empty?
  File.write(RC.ws(dir, 'score_errors.txt'), errors.join("\n") + "\n")
  RC.die("#{errors.size} problem(s) in the score files; nothing was built. See workspace/score_errors.txt. First: #{errors.first}")
end

# ── master table: one CRM row per deal, one row per call ──
cols = %w[deal_id call_date row_type owner account stage outcome] + RC::KEYS.flat_map { |k| ["#{k}_score", "#{k}_reason", "#{k}_note"] }
calls_by_deal = calls.group_by { |c| c['deal_id'] }
CSV.open(RC.ws(dir, 'master.csv'), 'w') do |csv|
  csv << cols
  deals.each_value do |d|
    csv << [d['deal_id'], '', 'crm', d['owner'], d['account'], d['stage'], d['outcome']] + [''] * (RC::KEYS.size * 3)
    (calls_by_deal[d['deal_id']] || []).sort_by { |c| c['call_date'] }.each do |c|
      csv << [d['deal_id'], c['call_date'], 'call', d['owner'], d['account'], '', ''] +
             RC::KEYS.flat_map { |k| [c['scores'][k]['score'], c['scores'][k]['reason'], c['scores'][k]['note']] }
    end
  end
end

# ── per deal: average the deal's calls, then combine with its email thread ──
per_deal = {}
deals.each_value do |d|
  cs = calls_by_deal[d['deal_id']] || []
  em = emails[d['deal_id']]
  next if cs.empty? && em.nil?
  dims = RC::KEYS.map do |k|
    call = cs.empty? ? nil : (cs.sum { |c| c['scores'][k]['score'] }.to_f / cs.size).round
    email = em && em[k] ? em[k]['score'] : nil
    [k, { 'call' => call, 'email' => email, 'combined' => RC.combined(call, email) }]
  end.to_h
  per_deal[d['deal_id']] = dims
end

# ── per rep: average across their scored deals (a deal with three calls still counts once) ──
avg = ->(a) { a.empty? ? nil : a.sum.to_f / a.size }
owners = per_deal.keys.map { |id| deals[id]['owner'] }.uniq.reject { |o| o.empty? || excluded.include?(o) }
reps = owners.map do |o|
  mine = per_deal.select { |id, _| deals[id]['owner'] == o }
  # keyed by display label: the page looks skills up by label ('Economic Buyer'), not by key
  scores = content['dims'].map { |d| [d['label'], avg.call(mine.values.map { |dm| dm[d['key']]['combined'] }.compact).round(2)] }.to_h
  m = avg.call(mine.values.map { |dm| avg.call(RC::MEDDIC_KEYS.map { |k| dm[k]['combined'] }.compact) }.compact).round(2)
  s = avg.call(mine.values.map { |dm| avg.call(RC::SANDLER_KEYS.map { |k| dm[k]['combined'] }.compact) }.compact).round(2)
  owned = deals.values.select { |d| d['owner'] == o }
  { 'rep' => o, 'division' => owned.map { |d| d['division'] }.compact.reject(&:empty?).first || 'Sales',
    'opps' => owned.size, 'with_calls' => owned.count { |d| calls_by_deal.key?(d['deal_id']) }, 'scored' => mine.size,
    'm' => m, 's' => s, 'scores' => scores }
end.sort_by { |r| -(r['m'] + r['s']) }
RC.die('no rep has a scored deal yet: score some calls or email threads first') if reps.empty?

# ── engine weights ──
closed = per_deal.keys.select { |id| deals[id]['outcome'] != 'open' }
won_ids = closed.select { |id| deals[id]['outcome'] == 'won' }
lost_ids = closed.select { |id| deals[id]['outcome'] == 'lost' }
diff = RC::KEYS.map do |k|
  w = avg.call(won_ids.map { |id| per_deal[id][k]['combined'] }.compact)
  l = avg.call(lost_ids.map { |id| per_deal[id][k]['combined'] }.compact)
  [k, w && l ? w - l : nil]
end.to_h
enough = closed.size >= cfg['min_closed_deals'].to_i && won_ids.size >= 10 && lost_ids.size >= 10
weights = {}
mode = cfg['weights']
note = nil
if mode.is_a?(Hash)
  RC::KEYS.each { |k| weights[k] = (mode[k] || mode[content['dims'].find { |d| d['key'] == k }['label']] || 0).to_f }
  mode = 'fixed'
  note = 'These weights were set in config.json, not learned from this data.'
elsif mode == 'learn' && enough
  [RC::MEDDIC_KEYS, RC::SANDLER_KEYS].each do |ks|
    raw = ks.map { |k| [k, [diff[k] || 0, 0].max] }.to_h
    tot = raw.values.sum
    ks.each { |k| weights[k] = tot.positive? ? (raw[k] / tot * 100).round(1) : (100.0 / ks.size).round(1) }
  end
  mode = 'learned'
  note = "Learned from #{closed.size} closed deals (#{won_ids.size} won, #{lost_ids.size} lost): each skill's weight is how much higher it scored on won deals than on lost ones, scaled to add up to 100 inside each framework. Directional, not a full statistical model."
else
  RC::MEDDIC_KEYS.each { |k| weights[k] = (100.0 / 6).round(1) }
  RC::SANDLER_KEYS.each { |k| weights[k] = (100.0 / 7).round(1) }
  note = "Equal weights: only #{closed.size} closed #{closed.size == 1 ? 'deal has' : 'deals have'} scores (#{won_ids.size} won, #{lost_ids.size} lost), fewer than the #{cfg['min_closed_deals']} closed (with at least 10 won and 10 lost) needed to learn weights. Every skill counts the same until there is more history." if mode == 'learn'
  note ||= 'Equal weights, as set in config.json.'
  mode = 'equal'
end

# per-call averages on won vs lost deals, and win rate when a skill was weak vs strong
call_mean = lambda do |ids, k|
  cs = ids.flat_map { |id| calls_by_deal[id] || [] }
  cs.size >= 5 ? (cs.sum { |c| c['scores'][k]['score'] }.to_f / cs.size).round(2) : nil
end
win_rate = lambda do |ids|
  ids.size >= 5 ? (ids.count { |id| deals[id]['outcome'] == 'won' } * 100.0 / ids.size).round : nil
end

dims = content['dims'].map do |d|
  k = d['key']
  weak = closed.select { |id| (c = per_deal[id][k]['combined']) && c < 4 }
  strong = closed.select { |id| (c = per_deal[id][k]['combined']) && c >= 6 }
  won_m = call_mean.call(won_ids, k)
  lost_m = call_mean.call(lost_ids, k)
  {
    'fw' => d['fw'], 'key' => k, 'label' => d['label'], 'letter' => d['letter'], 'weight' => weights[k],
    'question' => d['question'], 'look_for' => d['look_for'], 'ex' => d['anchors'], 'plain' => d['plain'],
    'reason' => d['weight_reason'], 'won' => won_m && format('%.2f', won_m), 'lost' => lost_m && format('%.2f', lost_m),
    'anti' => (weights[k].zero? && diff[k].to_f.negative?), 'weak_wr' => win_rate.call(weak), 'strong_wr' => win_rate.call(strong),
    'weak_n' => weak.size, 'strong_n' => strong.size
  }
end

# ── evidence from each rep's own calls ──
rows_for = ->(cs, k) { cs.map { |c| { 'date' => c['call_date'], 'account' => deals[c['deal_id']]['account'].to_s, 'score' => c['scores'][k]['score'], 'what' => c['scores'][k]['reason'], 'note' => c['scores'][k]['note'] } } }
ev = reps.map do |r|
  mine = calls.select { |c| deals[c['deal_id']]['owner'] == r['rep'] }
  [r['rep'], content['dims'].map do |d|
    rows = rows_for.call(mine, d['key'])
    lows = rows.sort { |a, b| [a['score'], b['date']] <=> [b['score'], a['date']] }.uniq { |x| x['account'] }.first(2)
    [d['label'], { 'n' => rows.size, 'absent' => rows.count { |x| x['score'] <= 1 }, 'strong' => rows.count { |x| x['score'] >= 4 },
                   'avg' => rows.empty? ? nil : (rows.sum { |x| x['score'] }.to_f / rows.size).round(1), 'worst' => lows,
                   'best' => rows.max_by { |x| [x['score'], x['date']] } }]
  end.to_h]
end.to_h
ex = content['dims'].map do |d|
  rows = calls.map { |c| rows_for.call([c], d['key']).first.merge('rep' => deals[c['deal_id']]['owner']) }
  [d['label'], rows.sort { |a, b| [b['score'], b['date']] <=> [a['score'], a['date']] }.uniq { |x| x['rep'] }.first(4).map { |x| x.reject { |kk, _| kk == 'note' } }]
end.to_h

# ── a sample deal for the Build Your Own tab ──
rep_names = reps.map { |r| r['rep'] }
pick = calls_by_deal.find do |id, cs|
  cs.size >= 2 && cs.map { |c| c['call_date'] }.uniq.size == cs.size && rep_names.include?(deals[id]['owner']) &&
    per_deal[id]['economic_buyer']['email']
end || calls_by_deal.find { |id, _| rep_names.include?(deals[id]['owner']) }
sample = nil
if pick
  id, cs = pick
  cs = cs.sort_by { |c| c['call_date'] }.first(2)
  eb = per_deal[id]['economic_buyer']
  sample = { 'id' => id, 'account' => deals[id]['account'].to_s, 'owner' => deals[id]['owner'], 'stage' => deals[id]['stage'],
             'calls' => cs.map { |c| { 'date' => c['call_date'], 'eb' => c['scores']['economic_buyer']['score'], 'eb_why' => c['scores']['economic_buyer']['reason'],
                                      'eb_note' => c['scores']['economic_buyer']['note'], 'ps' => c['scores']['postsell']['score'] } },
             'eb_call' => eb['call'], 'eb_email' => eb['email'], 'eb_email_why' => emails.dig(id, 'economic_buyer', 'reason'),
             'rep_deals' => per_deal.count { |did, _| deals[did]['owner'] == deals[id]['owner'] } }
end

dates = closed.map { |id| Date.parse(deals[id]['close_date']) rescue nil }.compact
period = dates.empty? ? nil : [dates.min, dates.max].map { |dt| dt.strftime('%b %Y') }.uniq.join(' – ')
company = (content['company'] || {}).merge(cfg['company'])
app = {
  'generated_at' => Time.now.strftime('%Y-%m-%d %H:%M'), 'company' => company,
  'footer' => cfg['footer'] || "Built from #{company['name']} calls, emails and CRM data.",
  'reps' => reps, 'dims' => dims, 'ev' => ev, 'ex' => ex, 'overlaps' => content['overlaps'] || [],
  'history' => { 'period' => period, 'deals' => closed.size, 'won' => won_ids.size, 'lost' => lost_ids.size,
                 'base_wr' => closed.empty? ? nil : (won_ids.size * 100.0 / closed.size).round, 'calls' => calls.size,
                 'emails' => emails.size, 'weights_mode' => mode, 'note' => note },
  'sample' => sample,
  'counts' => { 'calls' => calls.size, 'deals' => deals.size, 'threads' => emails.size, 'reps' => reps.size, 'scored' => per_deal.size },
  'content' => content['dims'].map { |d| [d['label'], d.slice('what', 'fix', 'questions', 'why_low', 'how_extend', 'practice')] }.to_h
}
RC.write_json(RC.ws(dir, 'app_data.json'), app)
puts "master table: #{deals.size} CRM rows + #{calls.size} call rows (workspace/master.csv)"
puts "scored deals: #{per_deal.size} (#{closed.size} closed: #{won_ids.size} won, #{lost_ids.size} lost); reps: #{reps.size}; email threads: #{emails.size}"
puts "engine weights: #{mode}. #{note}"
puts 'next: run build_app.rb'
