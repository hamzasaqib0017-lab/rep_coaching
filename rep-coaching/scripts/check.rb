#!/usr/bin/env ruby
# frozen_string_literal: true
# Step 6. Safety checks. Nothing should be shared until this passes.
#   Table: one CRM row per deal; deal ID + call date never repeats; every call belongs to a real deal;
#          every score is a whole number 0-5.
#   Page:  no unfilled placeholders; every rep appears; and, when Google Chrome or Chromium is installed, the
#          page is opened headless and every tab is counted, with zero script errors allowed.
#
#   ruby check.rb <run-folder>          (set CHROME=/path/to/chrome to point at a browser explicitly)
require_relative 'lib'
require 'open3'
require 'tmpdir'

dir = RC.run_dir(ARGV)
cfg = RC.config(dir)
fails = []
ok = ->(msg) { puts "  ok    #{msg}" }
bad = ->(msg) { puts "  FAIL  #{msg}"; fails << msg }

puts 'table'
master = RC.ws(dir, 'master.csv')
if File.exist?(master)
  rows = CSV.read(master, headers: true)
  crm = rows.select { |r| r['row_type'] == 'crm' }
  calls = rows.select { |r| r['row_type'] == 'call' }
  ids = crm.map { |r| r['deal_id'] }
  ids.size == ids.uniq.size ? ok.call("one CRM row per deal (#{ids.size})") : bad.call("#{ids.size - ids.uniq.size} deal IDs have more than one CRM row")
  keys = calls.map { |r| [r['deal_id'], r['call_date']] }
  keys.size == keys.uniq.size ? ok.call("deal ID + call date unique (#{calls.size} calls)") : bad.call("#{keys.size - keys.uniq.size} repeated deal ID + call date keys")
  orphans = calls.map { |r| r['deal_id'] }.uniq - ids
  orphans.empty? ? ok.call('every call belongs to a deal in the CRM') : bad.call("calls on unknown deals: #{orphans.first(5).join(', ')}")
  nonint = calls.flat_map { |r| RC::KEYS.map { |k| r["#{k}_score"] } }.reject { |v| v =~ /\A[0-5]\z/ }
  nonint.empty? ? ok.call('every score is a whole number 0-5') : bad.call("#{nonint.size} scores are not whole numbers 0-5, e.g. #{nonint.first.inspect}")
else
  bad.call('workspace/master.csv missing: run assemble.rb')
end

puts 'data'
app = RC.read_json(RC.ws(dir, 'app_data.json'))
if app
  app['reps'].any? ? ok.call("#{app['reps'].size} reps with scores") : bad.call('no reps with scores')
  app['dims'].size == 13 ? ok.call('13 skills') : bad.call("#{app['dims'].size} skills, expected 13")
  %w[meddic sandler].each do |fw|
    tot = app['dims'].select { |d| d['fw'] == fw }.sum { |d| d['weight'].to_f }
    next ok.call("#{fw} weights add to #{tot.round(1)}") if (tot - 100).abs <= 0.6
    msg = "#{fw} weights add to #{tot.round(1)}, not 100"
    app['history']['weights_mode'] == 'fixed' ? puts("  note  #{msg} (fixed in config.json)") : bad.call(msg)
  end
else
  bad.call('workspace/app_data.json missing: run assemble.rb')
end

puts 'page'
out = File.join(dir, cfg['output'])
if File.exist?(out)
  html = File.read(out)
  html.include?('{{') || html.include?('/*__') ? bad.call('unfilled template placeholder in the page') : ok.call('all placeholders filled')
  html.bytesize < 16_000_000 ? ok.call("size #{(html.bytesize / 1024.0).round} KB") : bad.call('page is over 16 MB')
  missing = (app ? app['reps'].map { |r| r['rep'] } : []).reject { |n| html.include?(JSON.generate(n)[1..-2]) }
  missing.empty? ? ok.call('every rep is in the page') : bad.call("reps missing from the page: #{missing.join(', ')}")

  chrome = [ENV['CHROME'], '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].compact.find { |c| File.executable?(c) }
  if chrome && app
    probe = <<~'JS'
      <script>window.__errs=[];addEventListener('error',e=>__errs.push(e.message));</script>
    JS
    count = <<~'JS'
      <script>setTimeout(()=>{const o={};['start','frameworks','weights','team','coaching','build'].forEach(t=>{__coach.show(t);o[t]=document.querySelector('.tab-panel.active').innerText.length;});
      o.bad=[...document.querySelectorAll('.tab-panel')].filter(p=>/\bNaN\b|\bundefined\b/.test(p.innerText)).map(p=>p.id);o.chips=document.querySelectorAll('.chip').length;o.heat=document.querySelectorAll('#heat td').length;o.cards=document.querySelectorAll('.coach-card').length;
      o.errs=window.__errs;const p=document.createElement('pre');p.id='rc-probe';p.textContent=JSON.stringify(o);document.body.appendChild(p);},1500)</script>
    JS
    Dir.mktmpdir do |tmp|
      f = File.join(tmp, 'probe.html')
      File.write(f, html.sub('<head>') { "<head>#{probe}" }.sub('</body>') { "#{count}</body>" })
      dom, = Open3.capture2(chrome, '--headless=new', '--disable-gpu', '--no-sandbox', '--virtual-time-budget=8000', '--dump-dom', "file://#{f}", err: File::NULL)
      res = dom[%r{<pre id="rc-probe">(.*?)</pre>}m, 1]
      if res.nil?
        bad.call('the page did not finish drawing in the browser')
      else
        o = JSON.parse(res.gsub('&amp;', '&').gsub('&lt;', '<').gsub('&gt;', '>').gsub('&quot;', '"'))
        n = app['reps'].size
        o['errs'].empty? ? ok.call('browser: zero script errors') : bad.call("browser script errors: #{o['errs'].first(3).join(' | ')}")
        o['bad'].empty? ? ok.call('browser: no NaN or undefined values on any tab') : bad.call("browser: NaN or undefined shown on #{o['bad'].join(', ')}")
        empty = %w[start frameworks weights team coaching build].select { |t| o[t].to_i < 300 }
        empty.empty? ? ok.call('browser: all six tabs drew content') : bad.call("browser: tabs with almost no content: #{empty.join(', ')}")
        o['chips'] == n ? ok.call("browser: #{n} rep buttons") : bad.call("browser: #{o['chips']} rep buttons, expected #{n}")
        o['heat'] == (n + 1) * 14 ? ok.call("browser: team grid #{o['heat']} cells") : bad.call("browser: team grid #{o['heat']} cells, expected #{(n + 1) * 14}")
        o['cards'] == 3 ? ok.call('browser: 3 coached priority cards') : bad.call("browser: #{o['cards']} priority cards, expected 3")
      end
    end
  else
    puts '  skip  browser check (no Chrome or Chromium found; set CHROME=/path/to/browser to enable it)'
  end
else
  bad.call("#{cfg['output']} missing: run build_app.rb")
end

if fails.empty?
  puts "\nALL CHECKS PASSED"
else
  puts "\n#{fails.size} CHECK(S) FAILED"
  exit 1
end
