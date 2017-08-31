'use strict'

const utils = require('loader-utils')
const parseXIcon = require('../libs/parse-x-icon')

module.exports = function (source) {
  this.cacheable()
  const _this = this
  const uiConfig = this.customUI || utils.getLoaderConfig(this, 'customUI')

  if (!uiConfig.plugins || !uiConfig.plugins.length) {
    return source
  }

  if (uiConfig.options.useUI && source.indexOf('</x-icon>') > -1) {
    source = parseXIcon(source, uiConfig)
  }

  uiConfig.plugins.forEach(function (plugin) {
    // style-parser
    if (plugin.name === 'before-template-compiler-parser') {
      if (plugin.fn) {
        source = plugin.fn.call(_this, source)
      }
    }
  })

  return source
}
