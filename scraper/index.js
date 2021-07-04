const puppeteer = require('puppeteer');
const acorn = require('acorn');
const acornWalk = require('acorn-walk');

const scrape = async (url) => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await page.goto(url, {
        waitUntil: 'networkidle0',
    });

    let codes = await page.$$('.lang-js');
    for (const code of codes) {
        const text = await code.evaluate(el => el.innerText);
        const functions = getFunction(text);
        for (const fn in functions) {
            console.log('Name: ' + fn);
            console.log('Type: ' + functions[fn].type);
            console.log('Params: ', functions[fn].params);
            if (functions[fn].async) console.log('Async');
            if (functions[fn].generator) console.log('Generator');
            if (functions[fn].expression) console.log('Expression');
            console.log('Body: ', functions[fn].body);
            console.log('\n\n');
        }
    }

    await browser.close();
}

const getFunction = text => {
    /*text = `
async function asdf() {
    return await abc();
}

function x(b, a = 5, c = 19) {
     return 99*a  ;
}

var f = x => {
    return x*x;
}

const g = (a, x = 3) => {
    return 2*x + 1000*a;
}

let h = function(a, b=3) {
    return a+b;
}


class Thing {
    constructor(abc = 123) {
        this.xyz = abc;
    }

    talk() {
        console.log(this.xyz);
     }
}

const collection = {
  items: [],
  add(...items) {
    this.items.push(...items);
  },
  get(index) {
    return this.items[index];
  }
};

const fn = x => 2*x;
`;*/
    let functions = {};
    let parsed;
    try {
        parsed = acorn.parse(text, { ecmaVersion: 2020 });
    } catch (e) {
        try {
            parsed = acorn.parse(text, { ecmaVersion: 2020, sourceType: 'module' });
        } catch (e2) {
            console.log('Error parsing', e2);
            return {}; //Syntax error in the code, don't attempt to find functions
        }
    }
    debugger;
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

scrape('https://stackoverflow.com/questions/55137051/how-to-get-all-the-function-and-their-arguments-from-a-js-file-javascript');
//scrape('https://stackoverflow.com/questions/1789945/how-to-check-whether-a-string-contains-a-substring-in-javascript?rq=1');
//scrape('https://stackoverflow.com/questions/5767325/how-can-i-remove-a-specific-item-from-an-array');
