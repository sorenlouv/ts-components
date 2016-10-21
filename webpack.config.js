const path = require('path');
const webpack = require('webpack');
const env = JSON.stringify(process.env.NODE_ENV || 'development');
console.log('Current env', env);

const config = {
	entry: './src/index.jsx',
	output: {
		path: path.join(__dirname, 'docs'),
		publicPath: 'docs',
		filename: 'app.js'
	},
	plugins: [
		new webpack.DefinePlugin({
			'process.env.NODE_ENV': env
		})
	],
	module: {
		loaders: [
			{
				test: /\.scss$/,
				loaders: ['style', 'css', 'sass']
			},
			{
				test: /\.json$/,
				loader: 'json'
			},
			{
				test: /\.jsx|.js$/,
				exclude: /node_modules/,
				loaders: ['babel']
			}
		]
	},
	devServer: {
		inline: true
	}
};

if (process.env.NODE_ENV === 'production') {
	config.plugins.push(new webpack.optimize.UglifyJsPlugin({
		compress: { warnings: false },
		output: {
			comments: false
		}
	}));
}

module.exports = config;
