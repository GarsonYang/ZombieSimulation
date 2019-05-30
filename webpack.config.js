const webpack = require('webpack');
const path = require('path');

//where to output build files
const OUT_DIRECTORY = '/build'

module.exports = {
  //file to start with
  entry: [
    './src/index.ts', 
  ],

  //where compiled code should go
  output: {
    filename: "bundle.js", //combine it into this file
    path: path.resolve(__dirname, OUT_DIRECTORY), //in this folder (`__dirname`)
    publicPath: OUT_DIRECTORY //where server will look for output
  },

  resolve: {
    // Add '.ts' as resolvable extensions.
    extensions: ["*", ".webpack.js", ".web.js", ".js", ".ts"]
  },  

  module: {
    rules: [
      {
        test: /\.ts$/, //send `.ts` files through the loader
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },

  //enable source maps for debugging
  devtool: 'inline-source-map',

  //enable jQuery in all modules
  plugins: [
      new webpack.ProvidePlugin({
          $: "jquery",
          jQuery: "jquery"
      })
  ],

  // Enable sourcemaps for debugging webpack's output
  devtool: "source-map",
}