const mysql = require('mysql2');
const util = require('util');

let connection, query;

const createConnection = () => {
    let connection = mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
    });

    query = util.promisify(connection.query).bind(connection);

    connection.connect(err => {
        if (err) console.log('Error connecting to db', err);
        else console.log('Connected to db at ' + Date.now() + ' as id ' + connection.threadId);
    });

    return { connection, query };
}

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
    } catch (e) {
        console.log('Error inserting fn ' + fnName + ' from ' + postId, e);
    }
    callback();
}

const getFunction = async (fnName) => {
    fnName = fnName.replace(/%/g, '');
    if (fnName.length == 0) return [];
    fnName += '%'; //Make the fnName a prefix
    try {
        let rows = await query(`SELECT * FROM functions WHERE fnName LIKE ? AND fnName != 'constructor'`, [fnName]);
        rows = rows.sort((a, b) => {
            if (b.fnName.length != a.fnName.length) return a.fnName.length - b.fnName.length; //Show the closest matches first
            return a.fnBody.length - b.fnBody.length; //Then show the shortest functions. The shorter the function, usually the better it is
        });
        if (rows.length > 15) rows = rows.slice(0, 15);
        return rows;
    } catch (e) {
        console.log('Erorr getting function ' + fnName, e);
        return [];
    }
}

const getUniqueIds = async () => {
    try {
        let ids = await query(`SELECT DISTINCT postId FROM functions`);
        let obj = {};
        for (let post of ids) {
            obj[post.postId] = true;
        }
        return obj;
    } catch (e) {
        console.log('Error getting unique ids', e);
        return {};
    }
}

let con = createConnection();
connection = con.connection;
query = con.query;
setInterval(() => {
    connection.destroy();
    let con = createConnection();
    connection = con.connection;
    query = con.query;
}, 1000*60*10); //Make a new connection every 10 minutes

module.exports = {
    createFunctionsTableIfNotExists,
    insertFunction,
    getFunction,
    getUniqueIds
};
