const express = require('express');
const app = express();
app.use(express.static('docs'));

const server = require('http').Server(app);
const PORT = 3000;
server.listen(PORT, function () {
	console.log('Github Dashboard listening at http://localhost:%s', PORT);
});
