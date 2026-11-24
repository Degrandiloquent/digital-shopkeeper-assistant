// Headless Chrome, with --no-sandbox so the suite also runs inside containers and CI.
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage')
    ],
    reporters: ['progress'],
    browsers: ['ChromeHeadlessCI'],
    customLaunchers: {
      ChromeHeadlessCI: { base: 'ChromeHeadless', flags: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] }
    },
    restartOnFileChange: false,
    singleRun: true
  });
};
