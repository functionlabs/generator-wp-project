#
# <%= projectName %>
# <%= projectGitRepoUrl %>
#

'use strict'

module.exports = (grunt) ->
  # Project configuration.
  grunt.initConfig
  'imagemin':
    'theme':
      'files': [ {
        'expand': true
        'cwd': 'wp-content/themes/<%= themeSlug %>/'
        'src': '**/*.{png,jpg}'
        'dest': 'wp-content/themes/<%= themeSlug %>/'
      } ]
    'watch': 'images':
      'files': 'wp-content/themes/<%= themeSlug %>/images/**/*.{png,jpg,gif}'
      'tasks': [ 'imagemin' ]
    'build':
      'production': [ 'composer:install:no-dev:optimize-autoloader' ]
      'uat': [ 'composer:install:no-dev:optimize-autoloader' ]
      'staging': [ 'composer:install' ]
      'development': [ 'composer:install' ]

  # load the tasks
  grunt.loadNpmTasks 'grunt'
  grunt.loadNpmTasks 'grunt-coffeelint'
  grunt.loadNpmTasks 'grunt-contrib-coffee'
  grunt.loadNpmTasks 'grunt-contrib-compass'
  grunt.loadNpmTasks 'grunt-contrib-concat'
  grunt.loadNpmTasks 'grunt-contrib-imagemin'
  grunt.loadNpmTasks 'grunt-contrib-jshint'
  grunt.loadNpmTasks 'grunt-contrib-uglify'
  grunt.loadNpmTasks 'grunt-contrib-watch'
  grunt.loadNpmTasks 'grunt-peon-build'
  grunt.loadNpmTasks 'grunt-composer'
  grunt.loadNpmTasks 'grunt-shell'
  grunt.loadNpmTasks 'grunt-hub'

  # set the default task as the development build
  grunt.registerTask 'default', [ 'build:development' ]
