module.exports = {
  runtimeCompiler: true,
  chainWebpack: config => {
    // webgl model Loader
    config.module
      .rule('glb')
      .test(/\.glb$/)
      .use('file-loader')
        .loader('file-loader')
        .end()
  },
  devServer: {
    proxy: "https://api.coinex.com"
  }
}
