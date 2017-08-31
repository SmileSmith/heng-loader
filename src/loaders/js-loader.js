'use strict'

const utils = require('loader-utils')

module.exports = function (source) {
  this.cacheable()
  const _this = this
  const uiConfig = this.customUI || utils.getLoaderConfig(this, 'customUI')

  if (uiConfig.options.useUI && (new RegExp(`}\\s+from(.*?)('|")*${uiConfig.options.useUI.name}`)).test(source)) {
    const parser = require('../libs/import-parser')
    const maps = this.uiMaps || utils.getLoaderConfig(this, 'uiMaps')
    source = parser(source, function (opts) {
      let str = ''
      opts.components.forEach(function (component) {
        let file = `${uiConfig.options.useUI.name}/${maps[component.originalName]}`
        str += `import ${component.newName} from '${file}'\n`
      })
      return str
    }, uiConfig.options.useUI.name)
  }

  if (uiConfig.plugins.length) {
    uiConfig.plugins.forEach(function (plugin) {
      // js-parser
      if (plugin.name === 'js-parser') {
        if (plugin.fn) {
          if (plugin.test && plugin.test.test(_this.resourcePath)) {
            source = plugin.fn.call(_this, source)
          } else if (!plugin.test) {
            source = plugin.fn.call(_this, source)
          }
        }
      }
    })
  }

  return source
}
