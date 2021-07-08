const mysql = require('mysql2');
const util = require('util');

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
});

const query = util.promisify(connection.query).bind(connection);

connection.connect(err => {
    if (err) console.log('Error connecting to db', err);
    else console.log('Connected to db as id ' + connection.threadId);
});

const createFunctionsTableIfNotExists = async () => {
    const sql = `CREATE TABLE IF NOT EXISTS functions (
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
    try {
        await query(sql);
    } catch (e) {
        throw e;
    }
}

const insertFunction = async (fnName, fnData, postId, postScore, callback) => {
    fnData.body = fnData.body.replace(/\r/g, ''); //Remove windows line breaks. It messes up sql

    //TODO Only insert if that postId hasnt been added before
    try {
        await query(`INSERT INTO functions (postId, postScore, fnName, fnParams, fnBody, fnIsAsync, fnIsExpression, fnIsGenerator, fnType)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [postId, postScore, fnName, fnData.params, fnData.body, fnData.async, fnData.expression, fnData.generator, fnData.type]);
        callback();
    } catch (e) {
        console.log('Error inserting fn ' + fnName + ' from ' + postId, e);
    }
}

const getFunction = async (fnName) => {
    fnName = fnName.replace(/%/g, '');
    if (fnName.length == 0) return [];
    fnName += '%'; //Make the fnName a prefix
    try {
        let rows = await query(`SELECT * FROM functions WHERE fnName LIKE ?`, [fnName]);
        return rows;
    } catch (e) {
        console.log('Erorr getting function ' + fnName, e);
        return [];
    }
}

module.exports = { createFunctionsTableIfNotExists, insertFunction, getFunction };
