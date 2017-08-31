'use strict'

const utils = require('loader-utils')

module.exports = function (source) {
  this.cacheable()
  const _this = this
  const uiConfig = this.customUI || utils.getLoaderConfig(this, 'customUI')

  if (!uiConfig.plugins || !uiConfig.plugins.length) {
    return source
  }

  uiConfig.plugins.forEach(function (plugin) {
    // style-parser
    if (plugin.name === 'style-parser') {
      if (plugin.fn) {
        source = plugin.fn.call(_this, source)
      }
    }
  })

  return source
}
