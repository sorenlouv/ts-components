var express = require('express');
var app = express();
app.use(express.static('src'));
app.use('/build', express.static('build'));

var server = require('http').Server(app);
var PORT = 3000;
server.listen(PORT, function() {
	console.log('Github Dashboard listening at http://localhost:%s', PORT);
});
