var gulp = require('gulp');
var gutil = require('gulp-util');
var bower = require('bower');
var concat = require('gulp-concat');
var sass = require('gulp-sass');
var minifyCss = require('gulp-minify-css');
var rename = require('gulp-rename');
var sh = require('shelljs');
var ngAnnotate = require('gulp-ng-annotate');
var replace = require('gulp-replace');
var gulpif = require('gulp-if');
var uglify = require('gulp-uglify');
var templateCache = require('gulp-angular-templatecache');
var inject = require('gulp-inject');
var htmlreplace = require('gulp-html-replace');
var bowerFiles = require('main-bower-files');

var outline = require('./outline.json');
var endpoints = require('./endpoints.json');

var paths = {
  sass: ['./scss/**/*.scss']
};

var jsBundle = outline.dist + '/js/' + outline.name + '.min.js';
var cssBundle = outline.dist + '/css/' + outline.name + '.min.css';

var args = require('yargs')
  .alias('p', 'prod')
  .alias('i', 'int')
  .default('prod', false)
  .default('int', false)
  .argv;

gulp.task('default', ['sass']);
gulp.task('build', ['templateCache', 'style', 'script', 'index']);

gulp.task('sass', function(done) {
  gulp.src('./scss/ionic.app.scss')
    .pipe(sass())
    .on('error', sass.logError)
    .pipe(gulp.dest('./www/css/'))
    .pipe(minifyCss({
      keepSpecialComments: 0
    }))
    .pipe(rename({ extname: '.min.css' }))
    .pipe(gulp.dest('./www/css/'))
    .on('end', done);
});

gulp.task('watch', function() {
  gulp.watch(paths.sass, ['sass']);
  gulp.watch(outline.src + '/**/*.js', ['script', 'templateCache']);
  gulp.watch(outline.src + '/**/*.css', ['style']);
  gulp.watch(outline.src + '/**/*.html', ['index', 'templateCache']);
  gulp.watch(outline.src + '/lib/**/*.{js,css}', ['index', 'reload-browser']);
});

gulp.task('install', ['git-check'], function() {
  return bower.commands.install()
    .on('log', function(data) {
      gutil.log('bower', gutil.colors.cyan(data.id), data.message);
    });
});

gulp.task('git-check', function(done) {
  if (!sh.which('git')) {
    console.log(
      '  ' + gutil.colors.red('Git is not installed.'),
      '\n  Git, the version control system, is required to download Ionic.',
      '\n  Download git here:', gutil.colors.cyan('http://git-scm.com/downloads') + '.',
      '\n  Once git is installed, run \'' + gutil.colors.cyan('gulp install') + '\' again.'
    );
    process.exit(1);
  }
  done();
});

gulp.task('style', StyleTask);

function StyleTask () {
  return gulp.src(outline.src + '/**/*.css')
              .pipe(concat(outline.name + '.min.css'))
              .pipe(minifyCss())
              .pipe(gulp.dest(outline.dist + '/css/'));
}

gulp.task('script', ScriptTask);

function ScriptTask () {
  return injectEndpoints(gulp.src(outline.src + '/**/*.js'))
      .pipe(concat(outline.name + '.min.js'))
      .pipe(ngAnnotate())
      .pipe(replace('GR-APP-TITLE', outline.name))
      .pipe(gulpif(args.prod, uglify()))
      .pipe(gulp.dest(outline.dist + '/js/'));
}

function injectEndpoints (inputStream) {
  var env;
  if (args.prod || args.int)
    env = 'prod';
  else
    env = 'dev';

  var outputStream = inputStream;
  for (var key in endpoints[env]) {
    if (endpoints[env].hasOwnProperty(key)) {
      outputStream = outputStream.pipe(replace(key, endpoints[env][key]));
    }
  }
  return outputStream;
}

gulp.task('index', IndexTask);

function IndexTask () {
  var defaultInjectionOptions = {
    addRootSlash: false,
    ignorePath: '/' + outline.dist,
    name: 'inject'
  };

  var bowerInjectionOptions = {
    addRootSlash: false,
    ignorePath: '/' + outline.dist,
    name: 'bower'
  };

  return gulp.src(outline.src + '/index.html')
        .pipe(htmlreplace({'appTitle': outline.name, 'templatingCache': 'js/templates.js'}))
        .pipe(inject(gulp.src(bowerFiles(), {read: false}), bowerInjectionOptions))
        .pipe(inject(gulp.src(jsBundle, {read: false}), defaultInjectionOptions))
        .pipe(inject(gulp.src(cssBundle, {read: false}), defaultInjectionOptions))
        .pipe(gulp.dest(outline.dist));
}

gulp.task('templateCache', TemplateCache);

function TemplateCache () {
  return gulp.src(outline.src + '/**/*.html')
    .pipe(templateCache({standalone:true})).on('error', gutil.log)
    .pipe(gulp.dest(outline.dist + '/js'));
}