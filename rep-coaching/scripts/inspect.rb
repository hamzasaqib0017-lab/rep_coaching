#!/usr/bin/env ruby
# frozen_string_literal: true
# Step 1 helper. Look inside a CSV export before writing config.json: its headers, a few sample rows, a guess at
# which column is which, and the distinct values of the stage column, so the user only has to confirm.
#
#   ruby inspect.rb <file.csv>                 crm export (default)
#   ruby inspect.rb <file.csv> --emails        email export
require_relative 'lib'

file = ARGV[0] or RC.die('usage: ruby inspect.rb <file.csv> [--emails]')
RC.die("file not found: #{file}") unless File.exist?(file)
emails = ARGV.include?('--emails')
rows = CSV.read(file, headers: true, encoding: 'bom|utf-8')
heads = rows.headers.compact
RC.die('the file has no header row') if heads.empty?

guess = lambda do |patterns|
  heads.find { |h| patterns.any? { |p| h.downcase.strip =~ p } }
end
fields = if emails
  { 'deal_id' => [/\A(opportunity|opp|deal)[ _]?id\z/, /deal|opportunity/, /\Aid\z/],
    'date' => [/\Adate\z/, /date|sent|time/], 'from' => [/\Afrom\z/, /sender|from/], 'to' => [/\Ato\z/, /recipient|to\z/],
    'subject' => [/subject/], 'body' => [/\Abody\z/, /body|content|message|text|description/] }
else
  { 'deal_id' => [/\A(opportunity|opp|deal|record)[ _]?id\z/, /\bid\z/],
    'owner' => [/\A(opportunity|deal)[ _]?owner\z/, /owner|rep\b|sales ?person/], 'stage' => [/\A(deal )?stage\z/, /stage|status/],
    'close_date' => [/close ?date/, /\bclos(e|ing)\b/, /closed/], 'account' => [/\Aaccount( name)?\z/, /account|company|customer/],
    'division' => [/division|team|segment|region/] }
end
mapping = fields.map { |k, pats| [k, guess.call(pats)] }.to_h

puts "#{File.basename(file)}: #{rows.size} rows, #{heads.size} columns"
puts "\nColumns: #{heads.join(' | ')}"
puts "\nFirst rows:"
rows.first(3).each_with_index { |r, i| puts "  #{i + 1}. " + heads.first(8).map { |h| "#{h}=#{r[h].to_s[0, 30]}" }.join('; ') }
puts "\nSuggested mapping (confirm with the user):"
mapping.each { |k, h| puts format('  %-11s -> %s', k, h ? h.inspect : '(not found, ask the user)') }

unless emails
  if (id = mapping['deal_id'])
    ids = rows.map { |r| r[id].to_s.strip }.reject(&:empty?)
    dup = ids.size - ids.uniq.size
    puts "\nDeal IDs: #{ids.uniq.size} unique#{dup.positive? ? ", #{dup} REPEATED: the export must have one row per deal" : ', none repeated'}"
  end
  if (st = mapping['stage'])
    counts = Hash.new(0)
    rows.each { |r| counts[r[st].to_s.strip] += 1 }
    puts "\nStage values (ask which count as won and which as lost):"
    counts.sort_by { |_, n| -n }.first(25).each { |v, n| puts format('  %6d  %s', n, v.empty? ? '(blank)' : v) }
  end
  if (ow = mapping['owner'])
    owners = rows.map { |r| r[ow].to_s.strip }.reject(&:empty?)
    puts "\nOwners: #{owners.uniq.size} (#{owners.uniq.first(12).join(', ')}#{owners.uniq.size > 12 ? ', …' : ''})"
  end
end
puts "\nSuggested config.json entry:"
puts JSON.pretty_generate((emails ? 'email_columns' : 'columns') => mapping.compact)
