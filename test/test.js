process.env.VUE_LOADER_TEST = true

var path = require('path')
var webpack = require('webpack')
var MemoryFS = require('memory-fs')
var jsdom = require('jsdom')
var expect = require('chai').expect
var rimraf = require('rimraf')
var genId = require('vue-loader/lib/gen-id')
var SourceMapConsumer = require('source-map').SourceMapConsumer
var ExtractTextPlugin = require("extract-text-webpack-plugin")
var compiler = require('vue-loader/lib/template-compiler')
var normalizeNewline = require('normalize-newline')

var hengLoader = require('../src/index.js')

// var loaderPath = 'expose-loader?vueModule!' + path.resolve(__dirname, '../node_modules/vue-loader/index.js')
var loaderPath = 'expose-loader?vueModule!' + path.resolve(__dirname, '../src/index.js') + '!vue-loader'
var mfs = new MemoryFS()
var globalConfig = {
  output: {
    path: '/',
    filename: 'test.build.js'
  },
  module: {
    rules: [{
      test: /\.vue$/,
      loader: loaderPath
    }]
  }
}

function bundle(options, vuxOptions, cb) {
  var vueOptions = options.vue
  delete options.vue
  var config = Object.assign(globalConfig, options)

  // assign vue Options
  if (vueOptions) {
    config.plugins = (config.plugins || []).concat(new webpack.LoaderOptionsPlugin({
      vue: vueOptions
    }))
  }
  let basicVux = {
    options: {
      loaderString: loaderPath,
      rewriteLoaderString: false,
      isWebpack2: true,
      isTest: true
    }
  }

  if (vuxOptions.options) {
    for (let i in vuxOptions.options) {
      basicVux.options[i] = vuxOptions.options[i]
    }
  }

  if (vuxOptions.plugins) {
    basicVux.plugins = vuxOptions.plugins
  }

  config = hengLoader.merge(config, basicVux)

  var webpackCompiler = webpack(config)

  webpackCompiler.outputFileSystem = mfs
  webpackCompiler.run(function(err, stats) {
    expect(err).to.be.null
    if (stats.compilation.errors.length) {
      stats.compilation.errors.forEach(function(err) {
        console.error(err.message)
      })
    }
    expect(stats.compilation.errors).to.be.empty
    cb(mfs.readFileSync('/test.build.js').toString())
  })
}

function test(options, vuxOptions, assert) {
  bundle(options, vuxOptions, function(code) {
    jsdom.env({
      html: '<!DOCTYPE html><html><head></head><body></body></html>',
      src: [code],
      done: function(err, window) {
        if (err) {
          console.log(err[0].data.error.stack)
          expect(err).to.be.null
        }
        assert(window, interopDefault(window.vueModule), window.vueModule)
      }
    })
  })
}

function mockRender(options, data) {
  return options.render.call(Object.assign({
    _v(val) {
      return val
    },
    _self: {},
    $createElement(tag, data, children) {
      if (Array.isArray(data)) {
        children = data
        data = null
      }
      return {
        tag: tag,
        data: data,
        children: children
      }
    },
    _m(index) {
      return options.staticRenderFns[index].call(this)
    },
    _s(str) {
      return String(str)
    }
  }, data))
}

function interopDefault(module) {
  return module ? module.__esModule ? module.default : module : module
}

var parse = require('../src/libs/import-parser')

const str = parse(`<script>
import {
        Group
    } from 'vux';

`, function(opts) {
  // console.log(opts)
})

var themeParse = require('../src/libs/get-less-variables')

var commomMapper = function(opts) {
  const components = opts.components.map(function(one) {
    return one.newName
  })
  return `import { ${components.join(', ')} } from 'heng-ui'`
}

var vuxMapper = function(opts) {
  let str = ''
  opts.components.forEach(function(one) {
    if (one.originalName === 'AlertPlugin') {
      str += `import ${one.newName} from 'heng-ui/src/plugins/Alert'\n`
    } else if (one.originalName === 'ToastPlugin') {
      str += `import ${one.newName} from 'heng-ui/src/plugins/Toast'\n`
    }
  })
  return str
}

describe('vux-loader', function() {

  describe('parse virtual component', function() {
    const parse = require('../src/libs/parse-virtual-component')
    it('basic', function() {
      const source = `<x-icon a="b" c="d" class="e f" slot="icon"></x-icon>`
      const processed = parse(source, 'x-icon', function(query, a) {
        return '<svg ' + query.stringList + '></svg>'
      })
      expect(processed).to.equal('<svg a="b" c="d" class="e f" slot="icon"></svg>')
    })
  })

  describe('parse virtual component with click event', function() {
    const parse = require('../src/libs/parse-virtual-component')
    it('basic', function() {
      const source = `<x-icon a="b" c="d" class="e f" slot="icon" @click.native="handler"></x-icon>`
      const processed = parse(source, 'x-icon', function(query, a) {
        return '<svg ' + query.stringList + '></svg>'
      })
      expect(processed).to.equal('<svg a="b" c="d" class="e f" slot="icon" @click="handler"></svg>')
    })
  })

  describe('lib:get theme variables', function() {
    it('basic', function() {
      const rs = themeParse(path.resolve(__dirname, './vux-fixtures/less-theme-001.less'))
      expect(rs.a).to.equal('b')
    })

    it('ignore comments', function() {
      const rs = themeParse(path.resolve(__dirname, './vux-fixtures/less-theme-002.less'))
      expect(rs.a).to.equal('b')
      expect(rs.c).to.equal('d')
      expect(rs.d).to.equal('e')
      expect(rs.f).to.equal('g')
    })
  })

  describe('lib:import-parser', function() {

    let tests = [{
      title: 'basic',
      string: `import {A,B} from 'heng-ui'`,
      rs: ['A', 'B']
    }, {
      title: 'without space',
      string: `import{A,B} from 'heng-ui'`,
      rs: ['A', 'B']
    }, {
      title: 'without space 2',
      string: `import {A,B}from 'heng-ui'`,
      rs: ['A', 'B']
    }, {
      title: 'without space 3',
      string: `import{A,B}from 'heng-ui'`,
      rs: ['A', 'B']
    }, {
      title: 'do not parse comments',
      string: `// import {A,B} from 'heng-ui'
import { C, D} from 'heng-ui'`,
      rs: `\nimport { C, D } from 'heng-ui'`
    }, {
      title: 'use as',
      string: `import {A,B as C} from 'heng-ui'`,
      rs: ['A', 'C']
    }, {
      title: 'double quote',
      string: `import {A,B} from "heng-ui"`,
      rs: ['A', 'B']
    }, {
      title: 'multi line and single quote',
      string: `import { A,
B } from 'heng-ui'`,
      rs: ['A', 'B']
    }, {
      title: 'multi line and double quote',
      string: `import { A,
B } from "heng-ui"`,
      rs: ['A', 'B']
    }, {
      title: 'no match',
      string: `import {A,B} from 'vvv'`,
      rs: `import {A,B} from 'vvv'`
    }, , {
      title: 'more codes',
      string: `import C from 'XY'
import { D } from 'ZW'
import {A,B} from 'vvv'
import { C }  from 'heng-ui'`,
      rs: `import C from 'XY'
import { D } from 'ZW'
import {A,B} from 'vvv'
import { C } from 'heng-ui'`
    }, {
      title: 'heng-ui test2',
      string: `import {Group,Cell} from 'heng-ui'
import value2name from 'heng-ui/src/filters/value2name'`,
      rs: `import { Group, Cell } from 'heng-ui'
import value2name from 'heng-ui/src/filters/value2name'`
    }, {
      title: 'heng-ui test3',
      string: `import {Group,
Cell} from 'heng-ui'
import value2name from 'heng-ui/src/filters/value2name'`,
      rs: `import { Group, Cell } from 'heng-ui'
import value2name from 'heng-ui/src/filters/value2name'`
    }, {
      title: 'heng-ui test4',
      string: `import { M1, M2 } from 'heng-ui'
import { mapMutations, mapState } from 'vuex'
import { Group, Cell } from 'heng-ui'
import { Group1, Cell1 } from 'heng-ui'
import value2name from 'heng-ui/src/filters/value2name'`,
      rs: `import { M1, M2 } from 'heng-ui'
import { mapMutations, mapState } from 'vuex'
import { Group, Cell } from 'heng-ui'
import { Group1, Cell1 } from 'heng-ui'
import value2name from 'heng-ui/src/filters/value2name'`
    }, {
      title: 'heng-ui test5',
      string: `import {
XX,
YY} from 'heng-ui'`,
      rs: `import { XX, YY } from 'heng-ui'`
    }, {
      title: 'heng-ui test6',
      string: `/**/
import {Divider } from 'heng-ui'`,
      rs: `/**/
import { Divider } from 'heng-ui'`
    }]

    tests.forEach(function(one) {
      it(one.title, function() {
        const rs = parse(one.string, commomMapper, 'heng-ui')
        if (typeof one.rs === 'string') {
          expect(rs).to.equal(one.rs)
        } else {
          expect(rs).to.equal(`import { ${one.rs.join(', ')} } from 'heng-ui'`)
        }
      })
    })

    let hengUITests = [{
      title: 'heng-plugin test1',
      string: `import {AlertPlugin, ToastPlugin} from 'heng-ui'`,
      rs: `import AlertPlugin from 'heng-ui/src/plugins/Alert'
import ToastPlugin from 'heng-ui/src/plugins/Toast'
`
    }, {
      title: 'heng-plugin test2',
      string: `import {AlertPlugin, ToastPlugin} from 'heng-ui'
// import { AlertPlugin } from 'heng-ui'`,
      rs: `import AlertPlugin from 'heng-ui/src/plugins/Alert'
import ToastPlugin from 'heng-ui/src/plugins/Toast'

`
    }, {
      title: 'vux-loader plugin issue #1579 (1)',
      string: `import {
  AlertPlugin,
    ToastPlugin
} from 'heng-ui';`,
      rs: `import AlertPlugin from 'heng-ui/src/plugins/Alert'
import ToastPlugin from 'heng-ui/src/plugins/Toast'
`
    }, {
      title: 'vux-loader plugin issue #1579 (2)',
      string: `import {AlertPlugin,
    ToastPlugin
} from 'heng-ui'`,
      rs: `import AlertPlugin from 'heng-ui/src/plugins/Alert'
import ToastPlugin from 'heng-ui/src/plugins/Toast'
`
    }]

    hengUITests.forEach(function(one) {
      it(one.title, function() {
        const rs = parse(one.string, vuxMapper, 'heng-ui')
        expect(rs).to.equal(one.rs)
      })
    })

  })

  describe('plugin:less-theme', function() {

    it('basic', function(done) {
      test({
        entry: './test/vux-fixtures/less-theme-basic.vue'
      }, {
        plugins: [{
          name: 'less-theme',
          path: './test/vux-fixtures/less-theme-basic.less'
        }]
      }, function(window, module, rawModule) {
        var vnode = mockRender(module, {
          msg: 'hi'
        })
        expect(vnode.tag).to.equal('p')

        var styles = window.document.querySelectorAll('style')
        expect(styles[0].textContent).to.contain('\n.p {\n  color: red;\n}\n')

        done()
      })
    })

  })

  describe('plugin:style-parser', function() {

    it('basic', function(done) {
      test({
        entry: './test/vux-fixtures/style-parser-basic.vue'
      }, {
        plugins: [{
          name: 'less-theme',
          path: './test/vux-fixtures/less-theme-basic.less'
        }, {
          name: 'style-parser',
          fn: function(source) {
            return source.replace('@theme-p-color', 'yellow')
          }
        }]
      }, function(window, module, rawModule) {
        var vnode = mockRender(module, {
          msg: 'hi'
        })
        expect(vnode.tag).to.equal('p')

        var styles = window.document.querySelectorAll('style')
        expect(styles[0].textContent).to.contain('\n.p {\n  color: yellow;\n}\n')

        done()
      })
    })

  })

  describe('plugin:template-feature-switch', function() {

    it('basic', function(done) {
      test({
        entry: './test/vux-fixtures/template-feature-switch-basic.vue'
      }, {
        plugins: [{
          name: 'template-feature-switch',
          features: {
            FEATURE1: true,
            FEATURE2: false
          }
        }]
      }, function(window, module, rawModule) {
        var vnode = mockRender(module, {
          msg: 'hi'
        })

        expect(vnode.tag).to.equal('div')
        expect(vnode.children[0].indexOf('ON FEATURE1') > -1).to.equal(true)
        expect(vnode.children[0].indexOf('OFF FEATURE2') > -1).to.equal(true)
        done()
      })
    })

  })

  describe('one instance', function() {
    it('should throw', function() {
      const webpackConfig = {
        plugins: []
      }
      const merge = function() {
        return hengLoader.merge(webpackConfig, {
          options: {
            env: 'env1'
          },
          plugins: [{
            name: 'test1'
          }, {
            name: 'test1'
          }]
        })
      }
      expect(merge).to.throw(/only one instance is allowed/)
    })
  })

  describe('merge multi times', function() {
    it('should merge options', function() {
      const webpackConfig = {
        plugins: []
      }
      const config1 = hengLoader.merge(webpackConfig, {
        options: {
          env: 'env1'
        }
      })

      expect(config1.plugins[0].options.customUI.options.env).to.equal('env1')

      const config2 = hengLoader.merge(config1, {
        options: {
          env: 'env2'
        }
      })

      expect(config2.plugins[0].options.customUI.options.env).to.equal('env2')
    })

    it('should merge plugins with the same name', function() {
      const webpackConfig = {}
      const config1 = hengLoader.merge(webpackConfig, {
        plugins: [{
          name: 'test1',
          arg: 1
        }]
      })

      expect(config1.plugins[0].options.customUI.plugins.length).to.equal(1)
      expect(config1.plugins[0].options.customUI.plugins[0].arg).to.equal(1)

      const config2 = hengLoader.merge(config1, {
        plugins: [{
          name: 'test1',
          arg: 2
        }]
      })

      expect(config1.plugins[0].options.customUI.plugins.length).to.equal(1)
      expect(config1.plugins[0].options.customUI.plugins[0].arg).to.equal(2)

    })

    it('should delete plugin when env is change', function() {
      const webpackConfig = {}
      const config1 = hengLoader.merge(webpackConfig, {
        options: {
          env: 'env1'
        },
        plugins: [{
          name: 'test1',
          arg: 1,
          envs: ['env1']
        }]
      })

      expect(config1.plugins[0].options.customUI.plugins.length).to.equal(1)

      const config2 = hengLoader.merge(config1, {
        options: {
          env: 'env2'
        }
      })

      expect(config1.plugins[0].options.customUI.plugins.length).to.equal(0)

    })

    it('should merge old plugins', function() {
      const webpackConfig = {}
      const config1 = hengLoader.merge(webpackConfig, {
        options: {
          env: 'env1'
        },
        plugins: [{
          name: 'test1',
          arg: 1,
          envs: ['env1']
        }]
      })

      expect(config1.plugins[0].options.customUI.plugins.length).to.equal(1)

      const config2 = hengLoader.merge(config1, {
        plugins: [{
          name: 'test2'
        }]
      })

      expect(config2.plugins[0].options.customUI.plugins.length).to.equal(2)

      const config3 = hengLoader.merge(config2, {
        plugins: [{
          name: 'test3',
          envs: ['env3']
        }]
      })

      expect(config3.plugins[0].options.customUI.plugins.length).to.equal(2)

    })
  })

  describe('plugin:script-parser', function() {

    it('fn function should work', function(done) {
      test({
        entry: './test/vux-fixtures/script-parser-fn.vue'
      }, {
        plugins: [{
          name: 'script-parser',
          fn: function(source) {
            return source.replace('AAAA', 'BBBB')
          }
        }]
      }, function(window, module, rawModule) {
        var vnode = mockRender(module, {
          msg: 'hi'
        })
        expect(vnode.tag).to.equal('p')
        expect(module.data().msg).to.equal('BBBB')
        done()
      })
    })

    it('fn function should not work with env', function(done) {
      test({
        entry: './test/vux-fixtures/script-parser-fn.vue'
      }, {
        options: {
          env: 'test'
        },
        plugins: [{
          name: 'script-parser',
          envs: ['production'],
          fn: function(source) {
            return source.replace('AAAA', 'BBBB')
          }
        }]
      }, function(window, module, rawModule) {
        var vnode = mockRender(module, {
          msg: 'hi'
        })
        expect(vnode.tag).to.equal('p')
        expect(module.data().msg).to.equal('AAAA')
        done()
      })
    })
  })

  describe('plugin:template-parser', function() {

    it('fn function should work', function(done) {
      test({
        entry: './test/vux-fixtures/template-parser-fn.vue'
      }, {
        plugins: [{
          name: 'template-parser',
          fn: function(source) {
            return source.replace('我们没有底线', '我是有底线的')
          }
        }]
      }, function(window, module, rawModule) {
        var vnode = mockRender(module, {
          msg: 'hi'
        })
        expect(vnode.tag).to.equal('p')
        expect(vnode.children[0]).to.equal('我是有底线的')
        done()
      })
    })

    it('replaceList param should work', function(done) {
      test({
        entry: './test/vux-fixtures/template-parser-fn.vue'
      }, {
        plugins: [{
          name: 'template-parser',
          replaceList: [{
            test: /我们没有/,
            replaceString: ''
          }, {
            test: /底线/,
            replaceString: '底线是什么'
          }]
        }]
      }, function(window, module, rawModule) {
        var vnode = mockRender(module, {
          msg: 'hi'
        })
        expect(vnode.tag).to.equal('p')
        expect(vnode.children[0]).to.equal('底线是什么')
        done()
      })
    })

  })
})
