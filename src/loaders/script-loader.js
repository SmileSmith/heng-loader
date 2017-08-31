'use strict'

const utils = require('loader-utils')

module.exports = function (source) {
  this.cacheable()
  const _this = this
  const uiConfig = this.customUI || utils.getLoaderConfig(this, 'customUI')
  if (!uiConfig.plugins || !uiConfig.plugins.length) {
    return source
  }

  if (uiConfig.plugins.length) {
    uiConfig.plugins.forEach(function (plugin) {
      // script-parser
      if (plugin.name === 'script-parser') {
        if (plugin.fn) {
          source = plugin.fn.call(_this, source)
        }
      }
    })
  }

  if (uiConfig.options.useUI && (new RegExp(`}\\s+from(.*?)('|")*${uiConfig.options.useUI.name}`)).test(source)) {
    const maps = this.uiMaps || utils.getLoaderConfig(this, 'uiMaps')
    const parser = require('../libs/import-parser')
    source = parser(source, function (opts) {
      let str = ''
      opts.components.forEach(function (component) {
        let file = `${uiConfig.options.useUI.name}/${maps[component.originalName]}`
        str += `import ${component.newName} from '${file}'\n`
      })
      return str
    }, uiConfig.options.useUI.name)
  }

  return source
}
