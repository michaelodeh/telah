// Importing express module
const express = require('express');
const app = express();

app.use(express.json());

app.get('/',
	(req, res) => {
		res.sendFile(__dirname + '/index.html');
	});

app.post('/',
	(req, res) => {
        res.send(req.body)
        return 
		const { username, password } = req.body;
		const { authorization } = req.headers;
		res.send(
			{
				username,
				password,
				authorization,
			});
	});

app.listen(3000,
	() => {
		console.log(
			'Our express server is up on port 3000'
		);
	});
