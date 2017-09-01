'use strict'

const utils = require('loader-utils')
const path = require('path')

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
    if (plugin.name === 'sass-theme') {
      let reg = new RegExp(`@import(.*?)('|")*${uiConfig.options.useUI.name}`)
      if (uiConfig.options.useUI && (reg).test(source)) {
        const sassThemePath = path.join(uiConfig.options.projectRoot, plugin.path).replace(/\\/g,'\\\\')
        _this.addDependency(sassThemePath)
        source = source.replace(reg, function(match) {
          return `@import '${sassThemePath}';\n` + match
        })
      }
    }
  })

  return source
}
