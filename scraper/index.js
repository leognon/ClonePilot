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
            console.log('FUNCTION: ', fn, ' PARAMS: ', functions[fn].params, 'BODY: ', functions[fn].body);
        }
    }

    await browser.close();
}

const getFunction = text => {
    /*text = `
    function x(a) {
        console.log(a+123);
        const y = () => {
            console.log(456);
         }
         let z = function() {
            console.log(89);
         }

         return 99;
    `;*/

    let functions = {};
    let parsed;
    try {
        parsed = acorn.parse(text, { ecmaVersion: 2020 });
    } catch (e) {
        return {}; //Syntax error in the code, don't attempt to find functions
    }
    //Help from https://stackoverflow.com/questions/55137051/how-to-get-all-the-function-and-their-arguments-from-a-js-file-javascript
    acornWalk.simple(parsed, {
        FunctionDeclaration(node) {
            const name = node.id.name;
            const params = node.params.map(p => p.name);
            const body = text.slice(node.body.start, node.body.end);
            functions[name] = {
                params, body
            }
        },
        VariableDeclarator(node) {
            if (node.init.type == 'ArrowFunctionExpression' || node.init.type == 'FunctionExpression') {
                const name = node.id.name;
                const params = node.init.params.map(p => p.name);
                const body = text.slice(node.init.body.start, node.init.body.end);
                functions[name] = {
                    params, body
                }
            }
        }
    });
    //TODO async function, generator functions, expression?
    
    return functions;
}

scrape('https://stackoverflow.com/questions/55137051/how-to-get-all-the-function-and-their-arguments-from-a-js-file-javascript');
//scrape('https://stackoverflow.com/questions/1789945/how-to-check-whether-a-string-contains-a-substring-in-javascript?rq=1');
//scrape('https://stackoverflow.com/questions/5767325/how-can-i-remove-a-specific-item-from-an-array');
