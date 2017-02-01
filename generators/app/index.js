'use strict';

var yeoman  = require('yeoman-generator');
var chalk   = require('chalk');
var yosay   = require('yosay');
var _       = require('lodash');
var fs      = require('fs');
var html    = require("html-wiring");
var _s      = require('underscore.string');
var path    = require('path');
var mkdirp  = require('mkdirp');

module.exports = yeoman.Base.extend({
  prompting: function () {
    // Have Yeoman greet the user.
    this.log(yosay(
      'Welcome to the lovely ' + chalk.red('generator-wp-project') + ' generator!'
    ));

    var prompts = [
      {
        name: 'projectName',
        message: 'What is the full name of your project (i.e. \'Company Blog\')?'
      },
      {
        name: 'projectSlug',
        message: 'What is the project slug (repository name)?',
        default: function(answers) {
          return _s.slugify(answers.projectName);
        },
        filter: function(projectSlug) {
          return _s.slugify(projectSlug);
        }
      },
      {
        name: 'projectAuthorSlug',
        message: 'What is the project author slug (repository owner)?',
        default: function(answers) {
          return 'functionlabs';
        },
        filter: function(projectAuthorSlug) {
          return _s.slugify(projectAuthorSlug);
        }
      },
      {
          name: 'projectGitRepoUrl',
          message: 'What is the Git Repository URL?',
          default: function(answers) {
            var owner = _s.slugify(answers.projectAuthorSlug),
                slug = _s.slugify(answers.projectSlug)
            return 'git@github.com:' + owner + '/' + slug + '.git';
          }
      },
      {
        name: 'generateTheme',
        type: 'confirm',
        message: 'Would you like to generate a theme from a template theme?',
        default: true
      },
      {
        name: 'themeName',
        message: 'What would you like to name the theme?',
        default: function(answers) {
          return answers.projectName;
        },
        when: function(answers) {
          return answers.generateTheme;
        }
      },
      {
        name: 'themeBase',
        type: 'list',
        message: 'What base theme would you like to use?',
        default: 0,
        choices: [
          'skeleton',
          'storefront',
          'underscores'
        ],
        when: function(answers) {
          return answers.generateTheme;
        }
      }
    ];

    return this.prompt(prompts).then(function (answers) {
      this.projectName = answers.projectName;
      this.projectSlug = answers.projectSlug;
      this.projectAuthorSlug = answers.projectAuthorSlug;
      this.projectGitRepoUrl = answers.projectGitRepoUrl;
      this.generateTheme = answers.generateTheme;
      if(this.generateTheme) {
        this.themeName = answers.themeName;
        this.themeSlug = _s.slugify(this.themeName);
        this.themeUnderScored = this.themeSlug.replace(/\-/g, '_');
        this.themeTextDomain = this.themeUnderScored;
        this.themeBase = answers.themeBase;
        var themeNameParts = _.split(this.themeUnderScored, '_');
        themeNameParts = themeNameParts.map(function(part){
          return _.upperFirst(part);
        });
        this.themeClass = _.join(themeNameParts, '_');
      } else {
        //default to project based names for templates, may change so these are additional questions in the future
        this.themeName = answers.projectName;
        this.themeSlug = _s.slugify(this.themeName);
      }

    }.bind(this));
  },

  writing: {

    fetchTheme: function() {
      if(!this.generateTheme) return;

      var themeConfig = require('./theme_configs/' + this.themeBase ),
          done = this.async(),
          themeDir = path.join('tmp', this.themeSlug);

      //setup string replacements
      this.replacements = []
      for(var i = 0; i < themeConfig.replacements.length; i++ ) {
        this.replacements.push(
          {
            find: new RegExp(themeConfig.replacements[i].find, "g"),
            replace: _.template(themeConfig.replacements[i].replace)(this)
          }
        );
      }

      if(themeConfig.url.substring(0, 4) === 'git@') {
        this.spawnCommand('git', ['clone', themeConfig.url, themeDir])
          .on('exit', function(err) {
            if(err) {
              return done(err);
            }
            return done();
          });
      } else {
        this.tarball(themeConfig.url, themeDir, function(err) {
          if(err) {
            done(err);
          }
          // need to move files to match git clone
          done();
        });
      }

    },

    setupConfigFiles: function() {
      var defaultContent,
          themeContent,
          line,
          replaceValue,
          themeDir = path.join('tmp', this.themeSlug);

      if(fs.existsSync(themeDir + '/package.json')) {
        themeContent = this.fs.read(themeDir + '/package.json');
        //need to replace the theme strings with the project names
        for(var i =0; i < this.replacements.length; i++) {
          themeContent = themeContent.replace(this.replacements[i].find, this.replacements[i].replace);
        }

        fs.writeFileSync('package.json', themeContent);
      } else {

        this.fs.copyTpl( this.templatePath('_package.json'),
          this.destinationPath('package.json'),
          this
        );

      }

      if(fs.existsSync(themeDir + '/composer.json')) {
        //merge the two
        defaultContent = _.template(this.fs.read(__dirname + '/templates/_composer.json'))(this);
        defaultContent = JSON.parse( defaultContent );
        themeContent = JSON.parse( this.fs.read( themeDir + '/composer.json') );
        _.merge(defaultContent.require, themeContent.require);
        _.merge(defaultContent['require-dev'], themeContent['require-dev']);
        defaultContent.repositories = _.uniqBy(_.union(themeContent.repositories || [], defaultContent.repositories), 'url');
        fs.writeFileSync('composer.json', JSON.stringify(defaultContent, null, 4));
      } else {
        this.template('_composer.json', 'composer.json');
      }

      if(fs.existsSync(themeDir + '/.gitignore') ) {
        defaultContent = this.fs.read( __dirname + '/templates/gitignore');
        themeContent = this.fs.read( themeDir + '/.gitignore' );
        themeContent = themeContent.split('\n');
        if(themeContent.length + 0) {
          defaultContent += '\n#Theme Ignored Files';
          for(var i = 0; i < themeContent.length; i++) {
            line = themeContent[i].replace(/^\s\s*/, '').replace(/\s\s*$/, '').replace(this.themeBase, this.themeSlug);
            if(line.length === 0) {
              continue;
            }
            if(line.charAt(0) !== '#') {
              if( line.charAt(0) === '/' ){
                line = line.slice(1);
              }
              line = path.join('wp-content/themes/', this.themeSlug, '/') + line;
            }
            defaultContent += '\n' + line;
          }
        }
        fs.writeFileSync('.gitignore', defaultContent);
      } else {
        this.copy('gitignore', '.gitignore');
      }

      if( fs.existsSync(themeDir + '/bower.json') ){
        themeContent = this.fs.read(themeDir + '/bower.json');
        //need to replace the theme strings with the project names
        for(var i =0; i < this.replacements.length; i++) {
          themeContent = themeContent.replace(this.replacements[i].find, this.replacements[i].replace);
        }

        fs.writeFileSync('bower.json', themeContent);
      }

      if( ! ( fs.existsSync(themeDir + '/Gruntfile.js')
        || fs.existsSync(themeDir + '/gruntfile.js')
        || fs.existsSync(themeDir + '/Gruntfile.coffee')
        || fs.existsSync(themeDir + '/gruntfile.coffee') ) ) {
          this.fs.copyTpl( this.templatePath('_Gruntfile.coffee'),
            this.destinationPath('Gruntfile.coffee'),
            this
          );
      }

      this.copy('index.php', 'index.php');
      mkdirp('wp-content');
      //setup object-cache symlink
      try {
        fs.unlinkSync('wp-content/object-cache.php');
      } catch(e) {}

      fs.symlinkSync('drop-ins/memcached/object-cache.php', 'wp-content/object-cache.php');
    },

    createTheme: function() {
      var themeDir = path.join('wp-content/themes/', this.themeSlug),
          files = this.expandFiles('**/*', { cwd: path.join('tmp', this.themeSlug), dot: true}),
          me = this,
          gruntfileRegex = /^[G,g]runtfile\.[js,coffee]/,
          pathsRegex = /[',"][^'"\s]*\/[^'"\s]*['"]/g,
          themePath = 'wp-content/themes/' + this.themeSlug + '/',
          ignoreFiles = [
            /^.git\//,
            /^LICENSE$/,
            /^.DS_Store$/,
            /^README$/,
            /^README.md$/,
            /^.gitignore$/,
            /^jshintrc$/,
            /^composer.json$/,
            /^composer.lock$/,
            /^package.json$/
          ];

      if(this.generateTheme) {
        var themeConfig = require('./theme_configs/' + this.themeBase );
      } else {
        return;
      }


      files = _.filter(files, function(file) {
        return !ignoreFiles.some(function(regex) {
          return regex.test(file);
        });
      });

      files.forEach(function(file) {
        var fileContents,
            defaultContent,
            themeComposer,
            filePath = path.join(themeDir, file),
            tmpFilePath = path.join('tmp', this.themeSlug, file),
            newFileName = file;

        if(ignoreFiles.indexOf(file) !== -1) {
          return;
        }

        fileContents = this.fs.read(tmpFilePath);

        //copy the file and make replacements
        for(var i =0; i < me.replacements.length; i++) {
          fileContents = fileContents.replace(me.replacements[i].find, me.replacements[i].replace);
        }

        if ( gruntfileRegex.test( file ) ) {
          fileContents = fileContents.replace( pathsRegex, function(match) {
            match = match.replace(/['"]/g, '');
            if( match.substring(0, 5) === 'root/' ) {
              return "'" + match.substring(5) + "'";
            }
            if( match.substring(0, 2) === './' ) {
              return "'" + themePath + match.substring(2) + "'";
            }
            if( match.charAt(0) === '!' ) {
              return "'!" + themePath + match.substring(1) + "'";
            } else {
              return "'" + themePath + match + "'";
            }
          });
          //we're directly using fs to avoid the duplicate checks
          fs.writeFileSync(file, fileContents);
          return;
        }

        for(var i =0; i < me.replacements.length; i++) {
          newFileName = newFileName.replace(me.replacements[i].find, me.replacements[i].replace);
        }

        if( newFileName !== file ){
            filePath = path.join(themeDir, newFileName);
        }

        // rename files if they contain any of the replacement strings as well
        me.write(filePath, fileContents);
      }, me);

    },

    cleanupTheme: function() {
      if(!this.generateTheme) return;
      var exec = require('child_process').exec;
      var done = this.async();

      exec('rm -rf ./tmp', done);
    }

  },

  install: function () {
    this.installDependencies({
      skipInstall: this.options['skip-install'],
      bower: false
    });
  },

  end: function(){
    yosay(chalk.green('\nBuilding the project for the first time...\n\n'));
    this.spawnCommand('grunt');
  }
});
