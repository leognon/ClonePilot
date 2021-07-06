const mysql = require('mysql');

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

connection.connect(err => {
    if (err) console.log('Error connecting to db', err);
    else console.log('Connected to db as id ' + connection.threadId);
});

const createFunctionsTableIfNotExists = () => {
    const query = `CREATE TABLE IF NOT EXISTS functions (
        id INT AUTO_INCREMENT,
        postId int NOT NULL,
        postScore int,
        fnName varchar(512) NOT NULL,
        fnParams varchar(512),
        fnBody varchar(8000) NOT NULL,
        fnIsAsync BOOLEAN,
        fnIsExpression BOOLEAN,
        fnIsGenerator BOOLEAN,
        fnType varchar(255),
        PRIMARY KEY (id)
    )`;
    connection.query(query, (err, results) => {
        if (err) throw err;
    });
}

const insertFunction = (fnName, fnData, postId, postScore) => {
    fnName = mysql.escape(fnName);
    fnData.params = mysql.escape(fnData.params);
    fnData.body = mysql.escape(fnData.body.replace(/\r/g, '')); //Remove windows line breaks. It messes up sql
    fnData.async = mysql.escape(fnData.async);
    fnData.expression = mysql.escape(fnData.expression);
    fnData.generator = mysql.escape(fnData.generator);
    fnData.type = mysql.escape(fnData.type);
    postId = mysql.escape(postId);
    postScore = mysql.escape(postScore);

    const query = `INSERT INTO functions
        (postId, postScore, fnName, fnParams, fnBody, fnIsAsync, fnIsExpression, fnIsGenerator, fnType)
        VALUES (${postId}, ${postScore}, ${fnName}, ${fnData.params}, ${fnData.body},
        ${fnData.async}, ${fnData.expression}, ${fnData.generator}, ${fnData.type})`;
    connection.query(query, (err, results) => {
        if (err) throw err;
    });
}
 
//connection.end();
createFunctionsTableIfNotExists();

module.exports = { insertFunction };
