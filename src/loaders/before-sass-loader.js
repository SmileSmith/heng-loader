'user strict'

const utils = require('loader-utils')

module.exports = function (source) {
  this.cacheable()
  const _this = this
  const uiConfig = this.customeUI || utils.getLoaderConfig(this, 'customeUI')

  if (!uiConfig.plugins || !uiConfig.plugins.length) {
    return source
  }

  uiConfig.plugins.forEach(function(plugin) {
    if (plugin.name === 'before-sass-loader') {
      if (plugin.fn) {
        source = plugin.fn.call(_this, source)
      }
    }
  })

  return source
}
