'use strict';


var util    = require('util');
var path    = require('path');
var yeoman  = require('yeoman-generator');
var _       = require('lodash');
var fs      = require('fs');
var chalk   = require('chalk');
_.str = require('underscore.string');
_.mixin(_.str.exports());

var WPProjectGenerator = module.exports = function WPProjectGenerator(args, options) {
  yeoman.generators.Base.apply(this, arguments);

  this.on('end', function () {
    this.installDependencies({
      skipInstall: options['skip-install'],
      bower: false,
      callback: function() {
        console.log(chalk.green('\nBuilding the project for the first time...\n\n'));
        this.spawnCommand('grunt', ['build:development']);
      }.bind(this)
    });
  });

};

util.inherits(WPProjectGenerator, yeoman.generators.Base);

WPProjectGenerator.prototype.askFor = function askFor() {
  var cb = this.async();

  var prompts = [
    {
      name: 'projectName',
      message: 'What is the full name of your project (i.e. \'Company Blog\')?'
    },
    {
      name: 'projectSlug',
      message: 'What is the project slug (repository name)?',
      default: function(answers) {
        return _.slugify(answers.projectName);
      },
      filter: function(projectSlug) {
        return _.slugify(projectSlug);
      }
    },
    {
      name: 'projectAuthorSlug',
      message: 'What is the project author slug (repository owner)?',
      default: function(answers) {
        return 'functionlabs';
      },
      filter: function(projectAuthorSlug) {
        return _.slugify(projectAuthorSlug);
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
      choices: function() {
        var files = fs.readdirSync(__dirname + '/theme_configs/');
        var options = [];

        for(var i in files) {
          options.push( files[i].slice(0, -5) );
        }
        return options;
      },
      when: function(answers) {
        return answers.generateTheme;
      }
    }
  ];

  this.prompt(prompts, function (props) {
    this.projectName = props.projectName;
    this.projectSlug = props.projectSlug;
    this.projectAuthorSlug = props.projectAuthorSlug;
    this.generateTheme = props.generateTheme;
    if(this.generateTheme) {
      this.themeName = props.themeName;
      this.themeSlug = _.slugify(this.themeName);
      this.themeUnderScored = this.themeSlug.replace(/\-/g, '_');
      this.themeTextDomain = this.themeUnderScored;
      this.themeBase = props.themeBase;
    } else {
      //default to project based names for templates, may change so these are additional questions in the future
      this.themeName = props.projectName;
      this.themeSlug = _.slugify(this.themeName);
    }
    cb();
  }.bind(this));
};

WPProjectGenerator.prototype.fetchTheme = function fetchTheme() {
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
        replace: _.template(themeConfig.replacements[i].replace, this)
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
      done();
    });
  }

};

WPProjectGenerator.prototype.setupConfigFiles = function setupConfigFiles() {
  var defaultContent,
      themeContent,
      line,
      replaceValue,
      themeDir = path.join('tmp', this.themeSlug);

  if(fs.existsSync(themeDir + '/package.json')) {
    themeContent = this.readFileAsString(themeDir + '/package.json');
    //need to replace the theme strings with the project names
    for(var i =0; i < this.replacements.length; i++) {
      replaceValue = this.replacements[i].replace.replace(this.themeName, this.projectName);
      replaceValue = replaceValue.replace(this.themeSlug, this.projectSlug);
      themeContent = themeContent.replace(this.replacements[i].find, replaceValue);
    }

    fs.writeFileSync('package.json', themeContent);
  } else {
    this.template('_package.json', 'package.json');
  }

  if(fs.existsSync(themeDir + '/composer.json')) {
    //merge the two
    defaultContent = _.template(this.readFileAsString(__dirname + '/templates/_composer.json'), this);
    defaultContent = JSON.parse( defaultContent );
    themeContent = JSON.parse( this.readFileAsString( themeDir + '/composer.json') );
    _.merge(defaultContent.require, themeContent.require);
    _.merge(defaultContent['require-dev'], themeContent['require-dev']);
    defaultContent.repositories = _.uniq(_.union(themeContent.repositories || [], defaultContent.repositories), 'url');
    fs.writeFileSync('composer.json', JSON.stringify(defaultContent, null, 4));
  } else {
    this.template('_composer.json', 'composer.json');
  }

  if(fs.existsSync(themeDir + '/.gitignore') ) {
    defaultContent = this.readFileAsString( __dirname + '/templates/gitignore');
    themeContent = this.readFileAsString( themeDir + '/.gitignore' );
    themeContent = themeContent.split('\n');
    if(themeContent.length + 0) {
      defaultContent += '\n#Theme Ignored Files';
      for(var i = 0; i < themeContent.length; i++) {
        line = themeContent[i].replace(/^\s\s*/, '').replace(/\s\s*$/, '').replace(this.themeBase, this.themeSlug);
        if(line.length === 0) {
          continue;
        }
        if(line.charAt(0) !== '#') {
          line = path.join('wp-content/themes/', this.themeSlug, '/') + line;
        }
        defaultContent += '\n' + line;
      }
    }
    fs.writeFileSync('.gitignore', defaultContent);
  } else {
    this.copy('gitignore', '.gitignore');
  }

  if( ! ( fs.existsSync(themeDir + '/Gruntfile.js')
    || fs.existsSync(themeDir + '/gruntfile.js')
    || fs.existsSync(themeDir + '/Gruntfile.coffee')
    || fs.existsSync(themeDir + '/gruntfile.coffee') ) ) {
    this.template('_Gruntfile.coffee', 'Gruntfile.coffee');
  }

  this.copy('index.php', 'index.php');
  this.mkdir('wp-content');
  //setup object-cache symlink
  try {
    fs.unlinkSync('wp-content/object-cache.php');
  } catch(e) {}
  fs.symlinkSync('drop-ins/memcached/object-cache.php', 'wp-content/object-cache.php');
};




WPProjectGenerator.prototype.createTheme = function createTheme() {
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
        tmpFilePath = path.join('tmp', this.themeSlug, file);

    if(ignoreFiles.indexOf(file) !== -1) {
      return;
    }

    fileContents = me.readFileAsString(tmpFilePath);

    //copy the file and make replacements
    for(var i =0; i < me.replacements.length; i++) {
      fileContents = fileContents.replace(me.replacements[i].find, me.replacements[i].replace);
    }

    if ( gruntfileRegex.test( file ) ) {
      fileContents = _.template(fileContents, me);
      fileContents = fileContents.replace( pathsRegex, function(match) {
        match = match.replace(/['"]/g, '');
        if( match.substring(0, 2) === './' ) {
          return '"' + themePath + match.substring(2) + '"';
        }
        if( match.charAt(0) === '!' ) {
          return '"!' + themePath + match.substring(1) + '"';
        } else {
          return '"' + themePath + match + '"';
        }
      });
      //we're directly using fs to avoid the duplicate checks
      fs.writeFileSync(file, fileContents);
      return;
    }


    me.write(filePath, fileContents);
  }, me);

};

WPProjectGenerator.prototype.cleanupTheme = function cleanupTheme() {
  if(!this.generateTheme) return;
  var exec = require('child_process').exec;
  var done = this.async();

  exec('rm -rf ./tmp', done);
};
