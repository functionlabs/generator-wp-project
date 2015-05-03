/*global describe, beforeEach, it*/
'use strict';

var path    = require('path');
var helpers = require('yeoman-generator').test;


describe('wp-project generator', function () {
    this.timeout(1000000);
    beforeEach(function (done) {
        helpers.testDirectory(path.join(__dirname, 'temp'), function (err) {
            if (err) {
                return done(err);
            }

            this.app = helpers.createGenerator('wp-project:app', [
                '../../app'
            ]);
            done();
        }.bind(this));
    });

    it('creates expected files', function (done) {
        var expected = [
            'package.json',
            '.gitignore',
            'composer.json',
            'gruntfile.coffee',
            'index.php',
            'package.json',
            'wp-content/themes/test-theme/config.rb',
            'wp-content/themes/test-theme/functions.php',
            'wp-content/themes/test-theme/index.php',
            'wp-content/themes/test-theme/sass/style.scss',
            'wp-content/themes/test-theme/js/script.js'
        ];

        helpers.mockPrompt(this.app, {
            'projectName': 'Test Project',
            'projectSlug': 'test-project',
            'generateTheme': true,
            'themeName': 'Test Theme'
        });
        this.app.options['skip-install'] = true;
        this.app.run({}, function () {
            helpers.assertFiles(expected);
            done();
        });
    });
});
