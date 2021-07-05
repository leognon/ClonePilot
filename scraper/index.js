const csv = require('csv-parser');
const parser = require('node-html-parser');
const fs = require('fs');
const acorn = require('acorn');
const acornWalk = require('acorn-walk');

const gotRow = row => {
    const body = row.Body;
    console.log(`--------------------PARSING ROW ${row.Id}---------------------`);
    const fns = scrape(body);
    console.log(fns);
    console.log('--------------------DONE ROW---------------------');
}

const scrape = bodyText => {
    const root = parser.parse(bodyText);
    let codes = root.querySelectorAll('.lang-js');
    const fns = {};
    for (const code of codes) {
        //Because the <code> is stored in a <pre> it is not parsed the first time. It must be parsed again to get the actual inner text
        const text = parser.parse(code.innerText).text; //The .text gets the unescaped version of the html
        const gotFunctions = getFunction(text);
        for (const fn in gotFunctions) {
            fns[fn] = gotFunctions[fn];
        }
    }
    return fns;
}

const getFunction = text => {
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
        let stringParams = params.map(p => text.slice(p.start, p.end));
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
            addFunction(node.id.name, node.params, node.body, node.async, node.generator, node.expression, 'FunctionDeclaration');
        },
        VariableDeclarator(node) {
            if (node.init.type == 'ArrowFunctionExpression' || node.init.type == 'FunctionExpression') {
                addFunction(node.id.name, node.init.params, node.init.body, node.init.async, node.init.generator, node.init.expression, node.init.type);
            }
        },
        MethodDefinition(node) {
            addFunction(node.key.name, node.value.params, node.value.body, node.value.async, node.value.generator, node.value.expression, 'MethodDefinition');
        }
    });
    
    return functions;
}

fs.createReadStream('./stackDownload/QueryResults.csv').pipe(csv()).on('data', gotRow)
