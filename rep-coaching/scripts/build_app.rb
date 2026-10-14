#!/usr/bin/env ruby
# frozen_string_literal: true
# Step 5. Pour workspace/app_data.json into the page template and write one self-contained HTML file
# (no server, no internet needed to open it).
#
#   ruby build_app.rb <run-folder>
require_relative 'lib'
require 'cgi'

dir = RC.run_dir(ARGV)
cfg = RC.config(dir)
app = RC.read_json(RC.ws(dir, 'app_data.json')) or RC.die('workspace/app_data.json missing: run assemble.rb first')

content = app.delete('content')
lib = content.transform_values { |c| { 'what' => c['what'], 'fix' => c['fix'], 'qs' => c['questions'] || [] } }
ins = content.transform_values { |c| c.slice('why_low', 'how_extend', 'practice') }
# </script> inside a JSON string would end the script tag early; escape the slash.
js = ->(o) { JSON.generate(o).gsub('</', '<\/') }
data_js = "const APP = #{js.call(app)};\nconst DIM_CONTENT_LIB = #{js.call(lib)};\nconst DIM_INSIGHTS = #{js.call(ins)};"

gl = JSON.parse(File.read(File.join(RC::ASSETS, 'glossary.json'))).map { |t| t.merge('w' => '') }
gl_js = File.read(File.join(RC::ASSETS, 'glossary.js'))
{ 'const GL = __GLOSSARY_JSON__;' => "const GL = #{js.call(gl)};",
  "tip.children[2].textContent = 'Appears in: ' + g.w;" => "tip.children[2].textContent = '';" }.each do |from, to|
  RC.die("glossary.js anchor missing: #{from}") unless gl_js.include?(from)
  gl_js = gl_js.sub(from) { to }
end
gl_css = File.read(File.join(RC::ASSETS, 'glossary.css')) + "\n#gl-tip .gl-tip-where:empty{display:none}\n"

name = app['company']['name'].to_s
html = File.read(File.join(RC::ASSETS, 'template.html'))
{ '{{COMPANY}}' => CGI.escapeHTML(name), '{{INITIAL}}' => CGI.escapeHTML(name[0].to_s.upcase),
  '{{FOOTER}}' => CGI.escapeHTML(app['footer'].to_s) }.each { |k, v| html = html.gsub(k) { v } }
{ '/*__GLOSSARY_CSS__*/' => gl_css, '/*__DATA__*/' => data_js,
  '/*__APP_JS__*/' => File.read(File.join(RC::ASSETS, 'app.js')), '/*__GLOSSARY_JS__*/' => gl_js }.each do |ph, text|
  RC.die("template placeholder missing: #{ph}") unless html.include?(ph)
  html = html.sub(ph) { text }
end
RC.die('a template placeholder was left unfilled') if html.include?('/*__') || html.include?('{{')
out = File.join(dir, cfg['output'])
File.write(out, html)
puts "wrote #{out} (#{(html.bytesize / 1024.0).round} KB): #{app['reps'].size} reps, #{app['counts']['calls']} calls"
puts 'next: run check.rb'
