const vscode = require('vscode');
const axios = require('axios');

function activate(context) {
	let selectedEditor; //The editor to insert the completion into
	let selectedRange; //The range to insert the completion into

	//A command to open the ClonePilot window
	context.subscriptions.push(vscode.commands.registerCommand('clone-pilot.openClonePilot', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showInformationMessage('Please open an editor to use ClonePilot.');
			return;
		}

		const document = editor.document;
		let selection = editor.selection;

		if (editor.selection.isEmpty) { //If nothing is highlited, get the word at the cursor
			const cursorWordRange = editor.document.getWordRangeAtPosition(editor.selection.active);
			if (!cursorWordRange) {
				vscode.window.showInformationMessage('Please select or place your cursor on a word to use ClonePilot');
				return; //Cursor not on a word
			}

			selection = new vscode.Selection(cursorWordRange.start.line, cursorWordRange.start.character, cursorWordRange.end.line, cursorWordRange.end.character);
		}

		selectedEditor = editor; //Save to be used when the completion is inserted
		selectedRange = selection;

		const word = document.getText(selection); //The word in the selection
		await openClonePilot(word); //TODO Make a loading window pop up

	}));

	const myScheme = 'clonePilot';
	const textDocumentProvider = new class { //Provides a text document for the window
		async provideTextDocumentContent(uri) {
			const queryParams = uri.query.split('=');
			if (queryParams.length < 2) return 'Something went wrong. Make sure a word is selected.';
			const word = queryParams[1]; //Gets asdf from 'word=asdf'
			try {
				const response = await axios.get(`http://127.0.0.1:3000/getFunction/${word}`); //Get the functions for that word
				const fns = response.data.sort((a, b) => b.postScore - a.postScore); //Show the highset score first
				const content = getClonePilotText(fns, word);
				return content;
			} catch (err) {
				console.log('Error sending request', err);
				return 'There was an error sending the request\n' + err;
			}
		}
	}();
	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(myScheme, textDocumentProvider));

	//Open the ClonePilot window to display the functions
	const openClonePilot = async (word) => {
		//A uri to send to the document
		let uri = vscode.Uri.parse(`${myScheme}:Clone Pilot?word=${word}`, true); //TODO Don't pass the content through the URI. If there is a ? it will be in the query part
		const doc = await vscode.workspace.openTextDocument(uri); // calls back into the provider
		await vscode.window.showTextDocument(doc, {
			viewColumn: vscode.ViewColumn.Beside,
			preview: true, //Don't replace the current window
			preserveFocus: true,
		});
		vscode.languages.setTextDocumentLanguage(doc, "javascript"); //Enables syntax highlighting
	}

	const getClonePilotText = (fns, word) => {
		codelensProvider.clearPositions(); //Reset the codelens
		let content = `/* Clone Pilot found ${fns.length} functions for ${word} */\n\n`;
		for (let i = 0; i < fns.length; i++) {
			const lineNum = content.split('\n').length; //The line to insert the codelens on
			const formattedFn = formatFunction(fns[i]);
			codelensProvider.addPosition(lineNum, fns[i]); //Add a codelens on that line
			content += formattedFn.postHeader + formattedFn.keywords + formattedFn.header + formattedFn.body; //Display the entire function in the ClonePilot window
			if (i < fns.length - 1) content += '\n\n';
		}
		return content;
	}

	const formatFunction = fn => {
		const postHeader = `//===== From https://stackoverflow.com/q/${fn.postId} =====\n`;
		const keywords = (fn.fnIsAsync ? 'async ' : '') + 'function ';
		const header = fn.fnName + '(' + fn.fnParams.replace(/,/g, ', ') + ') ';
		const body = (fn.fnIsExpression ? '{\n' : '') + fn.fnBody + (fn.fnIsExpression ? '\n}' : '');
		//TODO Indentation is messed up

		return {
			postHeader,
			keywords,
			header,
			body
		};
	}

	//When the user clicks on a codelens for a function
	context.subscriptions.push(vscode.commands.registerCommand('clone-pilot.chooseOption', fn => {
		if (!selectedEditor) return;
		try {
			selectedEditor.edit(editBuilder => {
				const formatted = formatFunction(fn);
				editBuilder.replace(selectedRange, formatted.header + formatted.body); //Insert the function into the text
			});
			//Close the ClonePilot window. The hide function is deprecated, so it must be shown then closed as the active editor.
			vscode.window.showTextDocument(myScheme, {
					preview: true,
					preserveFocus: false
				})
				.then(() => {
					return vscode.commands.executeCommand('workbench.action.closeActiveEditor');
				});
		} catch (e) {
			//The editor isn't open
		}
	}));

	const codelensProvider = new class { //Keeps track of and provides codelenses
		constructor() {
			this.codelenses = [];
		}
		addPosition(lineNum, fn) {
			const range = new vscode.Range(lineNum, 0, lineNum, 0); //Display it on that line
			this.codelenses.push(new vscode.CodeLens(range, {
				title: 'Use function',
				command: 'clone-pilot.chooseOption',
				arguments: [
					fn
				],
				tooltip: 'Insert this function into your code'
			}));
		}
		clearPositions() {
			this.codelenses = [];
		}

		provideCodeLenses(document) {
			return this.codelenses;
		}

		//TODO Use resolveCodeLens() instead of making the command in addPosition?
	}();
	context.subscriptions.push(vscode.languages.registerCodeLensProvider({
		scheme: myScheme //Only adds codelens to ClonePilot windows
	}, codelensProvider));
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}