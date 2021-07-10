const csv = require('csv-parser');
const parser = require('node-html-parser');
const fs = require('fs');
const acorn = require('acorn');
const acornWalk = require('acorn-walk');

require('dotenv').config();

const db = require('./db.js');

let total = 0;
let numInserted = 0;
let startTime = Date.now();

setInterval(() => {
    console.log('At ' + (Date.now()-startTime) + ' inserted ' + numInserted +  'out of ' + total);
}, 10000);

//If multiple CSVs are used separately, duplicate posts may be inserted. This ensures no duplicates are inserted. It will still work if there are multiple functions in a post
let alreadyInsertedIds = {};

const parsePost = row => {
    const postId = row.Id;
    if (alreadyInsertedIds.hasOwnProperty(postId)) {
        return;
    }
    const postScore = row.Score;
    const body = row.Body;
    const fns = getFunctionsFromPost(body);
    for (const fnName in fns) {
        if (fnName.length >= 3) {
            total++;
            db.insertFunction(fnName, fns[fnName], postId, postScore, () => {
                numInserted++;
                if (numInserted % 100 == 0) {
                    const msPassed = Date.now()-startTime;
                    console.log(`Inserted ${numInserted}/${total} after ${Math.floor(msPassed/1000)}s`);
                    console.log(`Expected time: ${Math.floor(total/numInserted * msPassed/1000)}s`);
                }
            });
        }
    }
}

const getFunctionsFromPost = bodyText => {
    const root = parser.parse(bodyText);
    let codes = root.querySelectorAll('.lang-js');
    const fns = {};
    for (const code of codes) {
        //Because the <code> is stored in a <pre> it is not parsed the first time. It must be parsed again to get the actual inner text
        const text = parser.parse(code.innerText).text; //The .text gets the unescaped version of the html
        const gotFunctions = getFunctionsFromCode(text);
        for (const fn in gotFunctions) {
            fns[fn] = gotFunctions[fn];
        }
    }
    return fns;
}

const getFunctionsFromCode = text => {
    let functions = {};
    let parsed;
    try {
        parsed = acorn.parse(text, { ecmaVersion: 2020 });
    } catch (e) {
        try {
            parsed = acorn.parse(text, { ecmaVersion: 2020, sourceType: 'module' });
        } catch (e2) {
            //console.log('Error parsing', e2);
            return {}; //Syntax error in the code, don't attempt to find functions
        }
    }

    //Help from https://stackoverflow.com/questions/55137051/how-to-get-all-the-function-and-their-arguments-from-a-js-file-javascript
    function addFunction(name, params, body, async, generator, expression, type) {
        let stringParams = params.map(p => text.slice(p.start, p.end)).toString();
        let stringBody = text.slice(body.start, body.end);
        //if (body[0] !== '{') body = '{\n' + body; //If it is an expression, it wont have {} in the body
        //if (body[body.length-1] !== '}') body += '\n}';
        functions[name] = {
            params: stringParams,
            body: stringBody,
            async, expression, generator, type
        }
    }

    acornWalk.simple(parsed, {
        FunctionDeclaration(node) {
            if (node.id)
                addFunction(node.id.name, node.params, node.body, node.async, node.generator, node.expression, 'FunctionDeclaration');
        },
        VariableDeclarator(node) {
            if (node.init && (node.init.type == 'ArrowFunctionExpression' || node.init.type == 'FunctionExpression')) {
                addFunction(node.id.name, node.init.params, node.init.body, node.init.async, node.init.generator, node.init.expression, node.init.type);
            }
        },
        MethodDefinition(node) {
            addFunction(node.key.name, node.value.params, node.value.body, node.value.async, node.value.generator, node.value.expression, 'MethodDefinition');
        }
    });
    
    return functions;
}

const populate = async (fileName) => {
    await db.createFunctionsTableIfNotExists();
    alreadyInsertedIds = await db.getUniqueIds();
    fs.createReadStream(fileName).pipe(csv()).on('data', parsePost).on('end', () => console.log('Done parsing'));
}
 
/* id 0 - 4212 is from QueryResults50K
 * id 4213 - 5411 is from QueryResults29KViewCountOver50K
 * id 5411 - 5836 is from QueryResults42KviewsOver25K
 * id 5835 - 6110 is  from 50K-1
 * id 6111 - 9318 from 50K-2
 * id 9319 - 14066 from 50K-3
 * Essentially none from 50K-4
 */

populate('./stackDownload/allAnswers/50K-4.csv');
