/**
 * https://github.com/NMFR/optimize-css-assets-webpack-plugin
 * MIT LICENSE
 */

var webpackSources = require('webpack-sources')

function OptimizeCssAssetsPlugin(options) {
  options = options || {}
  this.options = Object.assign({
    canPrint: undefined,
    cssProcessor: require('cssnano'),
    assetNameRegExp: /\.css$/g,
    cssProcessorOptions: {
      safe: true,
      zindex: false,
      autoprefixer: false
    }
  }, options)
};

OptimizeCssAssetsPlugin.prototype.print = function() {
  if (this.options.canPrint || (typeof this.options.canPrint === 'undefined' && (process.env.NODE_ENV === 'production' || process.env.__BUILD__))) {
    console.log.apply(console, arguments)
  }
}

OptimizeCssAssetsPlugin.prototype.processCss = function(css) {
  return this.options.cssProcessor.process(css, this.options.cssProcessorOptions)
}

OptimizeCssAssetsPlugin.prototype.createCssAsset = function(css, originalAsset) {
  return new webpackSources.RawSource(css)
}

OptimizeCssAssetsPlugin.prototype.apply = function(compiler) {
  var self = this
  compiler.plugin('emit', function(compilation, compileCallback) {
    self.print('\n\n======== heng-loader: duplicate-style start~  ========')
    self.print('Starting to optimize CSS...')

    var assets = compilation.assets

    var cssAssetNames = Object.keys(assets).filter(
      function(assetName) {
        return assetName.match(self.options.assetNameRegExp)
      }
    )

    var hasErrors = false
    var promises = []

    cssAssetNames.forEach(
      function(assetName) {
        self.print('Processing ' + assetName + '...')
        var asset = assets[assetName]
        var originalCss = asset.source()
        var promise = self.processCss(originalCss)
        promise.then(
          function(result) {
            if (hasErrors) {
              self.print('Skiping ' + assetName + ' because of an error.')
              return
            }
            var processedCss = result.css
            assets[assetName] = self.createCssAsset(processedCss, asset)
            var ratio = ''
            if (originalCss.length) {
              ratio = ', ratio:' + (Math.round(((processedCss.length * 100) / originalCss.length) * 100) / 100) + '%'
            }
            self.print('Processed ' + assetName + ', before: ' + originalCss.length + ', after: ' + processedCss.length + ratio)
          },
          function(err) {
            hasErrors = true
            self.print('Error processing file: ' + assetName)
            console.error(err)
          }
        )
        promises.push(promise)
      }
    )

    Promise.all(promises).then(function() {
      compileCallback()
      self.print('======== heng-loader: duplicate-style done!   ========\n')
    }, compileCallback)
  })
}

module.exports = OptimizeCssAssetsPlugin
