'use strict'

/* 首先首先，这个是FORKvux-loader的项目，Copyright (c) 2016-present, Airyland
 * 非常感谢！！ 下面说明此loader的功能
 * 模块的两个功能
 * 1、loader方法，也就是如何处理source，详情见webpack-loader相关知识
 * 2、merge方法，一般我们放在webpack配置中，合并两者的配置，导出最终完整的config
 * 2017-08-31
 */

const path = require('path')
const fs = require('fs')
const utils = require('loader-utils')
const yaml = require('js-yaml')
const _ = require('lodash')

var webpack = require('webpack')

const scriptLoader = path.join(__dirname, './loaders/script-loader.js')
const styleLoader = path.join(__dirname, './loaders/style-loader.js')
const templateLoader = path.join(__dirname, './loaders/template-loader.js')
const jsLoader = path.join(__dirname, './loaders/js-loader.js')
const afterLessLoader = path.join(__dirname, './loaders/after-less-loader.js')
const beforeTemplateCompilerLoader = path.join(__dirname, './loaders/before-template-compiler-loader.js')

const projectRoot = process.cwd()

const getLessVariables = require('./libs/get-less-variables')
  /**
   * Plugins
   */
const HtmlBuildCallbackPlugin = require('../plugins/html-build-callback')
const DuplicateStyle = require('../plugins/duplicate-style')

/* 导出loader处理函数
 * 导出最终完整的config
 * 2017-08-31
 */

module.exports = function(source) {
  // 下面都是在各个阶段需要插入的文本，修改source
  const SCRIPT = utils.stringifyRequest(this, scriptLoader).replace(/"/g, '')
  const STYLE = utils.stringifyRequest(this, styleLoader).replace(/"/g, '')
  const AFTER_LESS_STYLE = utils.stringifyRequest(this, afterLessLoader).replace(/"/g, '')
  const TEMPLATE = utils.stringifyRequest(this, templateLoader).replace(/"/g, '')
  const BEFORE_TEMPLATE_COMPILER = utils.stringifyRequest(this, beforeTemplateCompilerLoader).replace(/"/g, '')

  this.cacheable()
  if (!source) return source
  const config = this.customUI || utils.getLoaderConfig(this, 'customUI')
  if (!config) {
    return source
  }

  let variables = ''
  var lessThemes = config.plugins.filter(function(plugin) {
    return plugin.name === 'less-theme'
  })

  if (lessThemes.length) {
    const lessThemePath = path.join(config.options.projectRoot, lessThemes[0].path)
    this.addDependency(lessThemePath)
    variables = getLessVariables(lessThemes[0].path)
  }

  var sassThemes = config.plugins.filter(function(plugin) {
    return plugin.name === 'sass-theme'
  })

  // TODO SASS主题文件处理
  if (sassThemes.length) {
    const sassThemePath = path.join(config.options.projectRoot, sassThemes[0].path)
    this.addDependency(sassThemePath)
  }

  source = addScriptLoader(source, SCRIPT)
  source = addStyleLoader(source, STYLE, variables, AFTER_LESS_STYLE)
  source = addTemplateLoader(source, TEMPLATE, BEFORE_TEMPLATE_COMPILER)

  return source
}

const _addScriptLoader = function(content, SCRIPT) {
  // get script type
  // content例如： require("!!babel-loader!../../../../vue-loader/lib/selector?type=script&index=0!./Button.vue")"
  if (/type=script/.test(content)) {
    // split loaders
    var loaders = content.split('!')
    loaders = loaders.map(function(item) {
      if (/type=script/.test(item)) {
        item = SCRIPT + '!' + item
      }
      return item
    }).join('!')
    content = loaders
  } else if (/require\("!!babel-loader/.test(content)) {
    content = content.replace('!!babel-loader!', `!!babel-loader!${SCRIPT}!`)
  }
  return content
}

function addScriptLoader(source, SCRIPT) {
  var rs = source
  if (rs.indexOf('import __vue_script__ from') === -1) {
    rs = rs.replace(/require\("(.*)"\)/g, function(content) {
      return _addScriptLoader(content, SCRIPT)
    })
  } else {
    // for vue-loader@13
    rs = rs.replace(/import\s__vue_script__\sfrom\s"(.*?)"/g, function(content) {
      return _addScriptLoader(content, SCRIPT)
    })
  }
  return rs
}

const _addTemplateLoader = function(content, TEMPLATE, BEFORE_TEMPLATE_COMPILER) {
  // get script type
  if (/type=template/.test(content)) {
    // split loaders
    var loaders = content.split('!')
    loaders = loaders.map(function(item) {
      if (/type=template/.test(item)) {
        item = TEMPLATE + '!' + item
      }
      if (item.indexOf('template-compiler/index') !== -1) {
        item = item + '!' + BEFORE_TEMPLATE_COMPILER
      }
      return item
    }).join('!')
    content = loaders
  }
  return content
}

function addTemplateLoader(source, TEMPLATE, BEFORE_TEMPLATE_COMPILER) {
  var rs = source.replace(/\\"/g, '__VUX__')
  if (rs.indexOf('import __vue_template__ from') === -1) {
    rs = rs.replace(/require\("(.*)"\)/g, function(content) {
      return _addTemplateLoader(content, TEMPLATE, BEFORE_TEMPLATE_COMPILER)
    })
  } else {
    // for vue-loader@13
    rs = rs.replace(/import\s__vue_template__\sfrom\s"(.*?)"/g, function(content) {
      return _addTemplateLoader(content, TEMPLATE, BEFORE_TEMPLATE_COMPILER)
    })
  }

  rs = rs.replace(/__VUX__/g, '\\"')
  return rs
}

function addStyleLoader(source, STYLE, variables, AFTER_LESS_STYLE) {
  let rs = source.replace(/require\("(.*)"\)/g, function(content) {
    if (/type=style/.test(content)) {
      var loaders = content.split('!')
      loaders = loaders.map(function(item) {
        if (/type=style/.test(item)) {
          item = STYLE + '!' + item
        }
        if (/less-loader/.test(item)) {
          if (variables) {
            var params = {
              modifyVars: variables
            }
            if (/sourceMap/.test(item)) {
              params.sourceMap = true
            }
            params = JSON.stringify(params).replace(/"/g, "'")
            item = item.split('?')[0] + '?' + params
          }

          item = AFTER_LESS_STYLE + '!' + item
        }
        return item
      }).join('!')

      content = loaders
    }
    return content
  })
  return rs
}

/* 导出Merge函数
 * 合并uiConfig 和原本webpackConfig的配置
 * 导出最终完整的config
 * 2017-08-31
 */

module.exports.merge = function(oldConfig, uiConfig) {
  oldConfig = Object.assign({
    plugins: []
  }, oldConfig)

  let config = Object.assign({
    module: {},
    plugins: []
  }, oldConfig)

  if (!uiConfig) {
    uiConfig = {
      options: {},
      plugins: []
    }
  }

  if (!uiConfig.options) {
    uiConfig.options = {
      buildEnvs: ['production']
    }
  }

  const buildEnvs = uiConfig.options.buildEnvs || ['production']
  if (buildEnvs.indexOf(process.env.NODE_ENV) !== -1) {
    process.env.__BUILD__ = true
  } else {
    process.env.__BUILD__ = false
  }

  if (process.env.__BUILD__ === false && (process.env.NODE_ENV !== 'production' && !process.env.VUE_ENV && !/build\/build/.test(process.argv) && !/webpack\.prod/.test(process.argv))) {
    require('./libs/report')
  }

  if (!uiConfig.plugins) {
    uiConfig.plugins = []
  }

  if (uiConfig.plugins.length) {
    uiConfig.plugins = uiConfig.plugins.map(function(plugin) {
      if (typeof plugin === 'string') {
        return {
          name: plugin
        }
      }
      return plugin
    })
  }

  // check multi plugin instance
  const pluginGroup = _.groupBy(uiConfig.plugins, function(plugin) {
    return plugin.name
  })
  for (let group in pluginGroup) {
    if (pluginGroup[group].length > 1) {
      throw (`only one instance is allowed. plugin name: ${group}`)
    }
  }

  // filter plugins by env
  if (uiConfig.options.env && uiConfig.plugins.length) {
    uiConfig.plugins = uiConfig.plugins.filter(function(plugin) {
      return typeof plugin.envs === 'undefined' || (typeof plugin.envs === 'object' && plugin.envs.length && plugin.envs.indexOf(uiConfig.options.env) > -1)
    })
  }

  if (!uiConfig.options.projectRoot) {
    uiConfig.options.projectRoot = projectRoot
  }

  config.module.rules = config.module.rules || []

  const customUIConfig = getFirstPlugin('custom-ui', uiConfig.plugins)
  if (customUIConfig) {
    uiConfig.options.useUI = {
      name: customUIConfig.moduleName,
      mapPath: customUIConfig.mapPath
    }
  }

  /**
   * ======== set plugins ========
   */
  // for webpack@2.x, options should be provided with LoaderOptionsPlugin
  config.plugins = config.plugins || []
  config.plugins.forEach(function(plugin, index) {
    if (plugin.constructor.name === 'LoaderOptionsPlugin' && plugin.options.customUI) {
      config.plugins.splice(index, 1)
    }
  })
  config.plugins.push(new webpack.LoaderOptionsPlugin({
    customUI: uiConfig
  }))

  if (hasPlugin('inline-manifest', uiConfig.plugins)) {
    var InlineManifestWebpackPlugin = require('inline-manifest-webpack-plugin')
    config.plugins.push(new InlineManifestWebpackPlugin({
      name: 'webpackManifest'
    }))
  }

  if (hasPlugin('progress-bar', uiConfig.plugins)) {
    const ProgressBarPlugin = require('progress-bar-webpack-plugin')
    const pluginConfig = getFirstPlugin('progress-bar', uiConfig.plugins)
    config.plugins.push(new ProgressBarPlugin(pluginConfig.options || {}))
  }

  if (uiConfig.options.useUI) {
    // ======== read custome-ui map data ========
    let mapPath = path.resolve(uiConfig.options.projectRoot, 'node_modules/heng-ui/', uiConfig.options.useUI.mapPath)
    const maps = require(mapPath)
    config.plugins.push(new webpack.LoaderOptionsPlugin({
      uiMaps: maps
    }))

    // ======== read custome-ui locales and set globally ========
    let vuxLocalesPath = path.resolve(uiConfig.options.projectRoot, 'node_modules/heng-ui/src/locales/all.yml')
    try {
      const vuxLocalesContent = fs.readFileSync(vuxLocalesPath, 'utf-8')
      let vuxLocalesJson = yaml.safeLoad(vuxLocalesContent)

      config.plugins.push(new webpack.LoaderOptionsPlugin({
        vuxLocales: vuxLocalesJson
      }))
    } catch (e) {}
  }

  /**
   * ======== append heng-loader ========
   */
  let loaderString = uiConfig.options.loaderString || 'heng-loader!vue-loader'
  const rewriteConfig = uiConfig.options.rewriteLoaderString
  if (typeof rewriteConfig === 'undefined' || rewriteConfig === true) {
    let hasAppendHengLoader = false
    config.module.rules.forEach(function(rule) {
      const hasVueLoader = rule.use && _.isArray(rule.use) && rule.use.length && rule.use.filter(function(one) {
        return one.loader === 'vue-loader'
      }).length === 1
      if (rule.loader === 'vue' || rule.loader === 'vue-loader' || hasVueLoader) {
        if (!rule.options && !rule.query && !hasVueLoader) {
          rule.loader = loaderString
        } else if ((rule.options || rule.query) && !hasVueLoader) {
          delete rule.loader
          rule.use = [
            'heng-loader',
            {
              loader: 'vue-loader',
              options: rule.options,
              query: rule.query
            }
          ]
          delete rule.options
          delete rule.query
        } else if (hasVueLoader) {
          rule.use.unshift('heng-loader')
        }
        hasAppendHengLoader = true
      }
    })
    if (!hasAppendHengLoader) {
      config.module.rules.push({
        test: /\.vue$/,
        loader: loaderString
      })
    }
  }

  /**
   * ======== append js-loader ========
   */
  config.module.rules.forEach(function(rule) {
    if (rule.loader === 'babel' || rule.loader === 'babel-loader' || (/babel/.test(rule.loader) && !/!/.test(rule.loader))) {
      if (rule.query || rule.options) {
        let options
        if (rule.options) {
          options = rule.options
          delete rule.options
        } else {
          options = rule.query
          delete rule.query
        }
        rule.use = [jsLoader, {
          loader: 'babel-loader',
          options: options
        }]
        delete rule.loader
      } else {
        rule.loader = 'babel-loader!' + jsLoader
      }
    }
  })

  /**
   * ======== set ui bable to compile js source ========
   */
  if (uiConfig.options.useUI) {
    if (typeof uiConfig.options.vuxSetBabel === 'undefined' || uiConfig.options.vuxSetBabel === true) {
      config.module.rules.push(getBabelLoader(uiConfig.options.projectRoot, uiConfig.options.useUI.name))
    }
  }

  // set done plugin
  if (hasPlugin('build-done-callback', uiConfig.plugins)) {
    const callbacks = uiConfig.plugins.filter(function(one) {
      return one.name === 'build-done-callback'
    }).map(function(one) {
      return one.fn
    })
    config.plugins.push(new DonePlugin(callbacks))
  }

  // duplicate styles
  if (hasPlugin('duplicate-style', uiConfig.plugins)) {
    let plugin = getFirstPlugin('duplicate-style', uiConfig.plugins)
    let options = plugin.options || {}
    config.plugins.push(new DuplicateStyle(options))
  }

  if (hasPlugin('build-emit-callback', uiConfig.plugins)) {
    config.plugins = config.plugins || []
    const callbacks = uiConfig.plugins.filter(function(one) {
      return one.name === 'build-emit-callback'
    }).map(function(one) {
      return one.fn
    })
    if (callbacks.length) {
      config.plugins.push(new EmitPlugin(callbacks[0]))
    }
  }

  if (hasPlugin('html-build-callback', uiConfig.plugins)) {
    let pluginConfig = getFirstPlugin('html-build-callback', uiConfig.plugins)
    config.plugins.push(new HtmlBuildCallbackPlugin(pluginConfig))
  }

  return config
}

function hasPlugin(name, list) {
  const match = list.filter(function(one) {
    return one.name === name
  })
  return match.length > 0
}

function getFirstPlugin(name, list) {
  const match = list.filter(function(one) {
    return one.name === name
  })
  return match[0]
}

/**
 * use babel so component's js can be compiled
 */
function getBabelLoader(projectRoot, name) {
  name = name || 'heng-ui'
  if (!projectRoot) {
    projectRoot = path.resolve(__dirname, '../../../')
    if (/\.npm/.test(projectRoot)) {
      projectRoot = path.resolve(projectRoot, '../../../')
    }
  }

  const componentPath = fs.realpathSync(projectRoot + `/node_modules/${name}/`) // https://github.com/webpack/webpack/issues/1643
  const regex = new RegExp(`node_modules.*${name}.src.*?js$`)

  return {
    test: regex,
    loader: 'babel-loader',
    include: componentPath
  }
}

/** build done callback **/

function DonePlugin(callbacks) {
  this.callbacks = callbacks || function() {}
    // Setup the plugin instance with options...
}

DonePlugin.prototype.apply = function(compiler) {
  let callbacks = this.callbacks
  compiler.plugin('done', function() {
    callbacks.forEach(function(fn) {
      fn()
    })
  })
}

/** emit plugin **/
function EmitPlugin(callback) {
  this.callback = callback
}

EmitPlugin.prototype.apply = function(compiler) {
  let callback = this.callback
  compiler.plugin('emit', function(compilation, cb) {
    callback(compilation, cb)
  })
}
