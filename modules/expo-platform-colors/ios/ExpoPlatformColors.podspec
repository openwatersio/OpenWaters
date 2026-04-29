require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoPlatformColors'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = 'MIT'
  s.author         = 'Open Waters'
  s.homepage       = 'https://openwaters.io'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }

  s.dependency 'ExpoModulesCore'

  s.static_framework = true
  s.source_files = '**/*.{h,m,swift}'
end
