# heng-loader

A webpack loader for processing .vue file before vue-loader forked By vux-loader

``` bash
module.exports = hengUILoader.merge(webpackConfig,{
  plugins: [{
    name: 'custom-ui',
    moduleName: 'heng-ui', // Your UI lib name
    mapPath: './lib/components/map.json' // mapJson to modular load
  },{
    name: 'progress-bar'
  },{
    name: 'sass-theme',
    path: './src/theme.scss'
  }]
})
```
