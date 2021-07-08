const app = require('express')();

require('dotenv').config();

const db = require('./db.js');

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT);

app.get('/getFunction/:name', async (req, res) => {
    const fnName = req.params.name;
    const fns = await db.getFunction(fnName);
    res.json(fns);
});


console.log('Server started');
