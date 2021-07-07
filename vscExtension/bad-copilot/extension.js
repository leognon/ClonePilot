const vscode = require('vscode');
const axios = require('axios');

function activate(context) {
	const disposable = vscode.commands.registerCommand('bad-copilot.insertCompletion', async () => {
		// Get the active text editor
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const document = editor.document;
			let selection = editor.selection;

			if (editor.selection.isEmpty) {
				const cursorWordRange = editor.document.getWordRangeAtPosition(editor.selection.active);
				if (!cursorWordRange) {
					console.log('No cursor word range');
					return;
				}

				selection = new vscode.Selection(cursorWordRange.start.line, cursorWordRange.start.character, cursorWordRange.end.line, cursorWordRange.end.character);
			}

			// Get the word within the selection
			const word = document.getText(selection);

			try {
				const response = await axios.get(`http://127.0.0.1:3000/getFunction/${word}`);
				const fns = response.data.sort((a, b) => b.postScore - a.postScore);
				await openVirtualDoc(fns);
			} catch (err) {
				console.log('Error sending request', err);
			}

			// vscode.window.showInformationMessage(word);

			//const reversed = word.split('').reverse().join('');
			// editor.edit(editBuilder => {
			// editBuilder.replace(selection, reversed);
			// });
		}
	});
	context.subscriptions.push(disposable);


	const myScheme = 'badCopilot';
	const textDocumentProvider = new class {
		provideTextDocumentContent(uri) {
			return uri.path;
		}
	}();
	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(myScheme, textDocumentProvider));

	const openVirtualDoc = async (fns) => {
		codelensProvider.clearPositions();
		let content = `/* Bad Copilot found ${fns.length} functions */\n\n`;
		for (let i = 0; i < fns.length; i++) {
			const numLines = content.split('\n').length;
			codelensProvider.addPosition(numLines);
			content += formatFunction(fns[i]);
			if (i < fns.length - 1) content += '\n\n';
		}
		let uri = vscode.Uri.parse(myScheme + ':' + content); //TODO Don't pass the content through the URI. If there is a ? it will be in the query part
		const doc = await vscode.workspace.openTextDocument(uri); // calls back into the provider
		await vscode.window.showTextDocument(doc, {
			viewColumn: vscode.ViewColumn.Beside,
			preview: true,
			preserveFocus: true,
		});
		vscode.languages.setTextDocumentLanguage(doc, "javascript");
	}

	const formatFunction = fn => {
		const header = `//===== From https://stackoverflow.com/q/${fn.postId} =====\n`;
		let formattedFn = '';
		if (fn.fnIsAsync) formattedFn += 'async ';
		formattedFn += 'function ';
		formattedFn += fn.fnName;
		formattedFn += '(' + fn.fnParams.replace(/,/g, ', ') + ') ';
		if (fn.fnIsExpression) formattedFn += '{\n'; //Add curly brackets
		formattedFn += fn.fnBody;
		if (fn.fnIsExpression) formattedFn += '\n}';
		//TODO Indentation is off

		return header + formattedFn;
	}

	const chooseOption = vscode.commands.registerCommand('bad-copilot.chooseOption', lineNum => {
		console.log('Choose!', lineNum);
	});
	context.subscriptions.push(chooseOption);

	const codelensProvider = new class {
		constructor() {
			this.codelenses = [];
		}
		addPosition(lineNum) {
			const range = new vscode.Range(lineNum, 0, lineNum, 0);
			this.codelenses.push(new vscode.CodeLens(range, {
				title: 'Choose option',
				command: 'bad-copilot.chooseOption',
				arguments: [
					lineNum
				],
				tooltip: 'Select'
			}));
		}
		clearPositions() {
			this.codelenses = [];
		}

		provideCodeLenses(document) {
			console.log('Providing code lens');
			return this.codelenses;
		}
	}();

	vscode.languages.registerCodeLensProvider({
		scheme: myScheme //Only adds codelens to my scheme
	}, codelensProvider); //TODO Make disposable

	// commands.registerCommand("codelens-sample.enableCodeLens", () => {
	//     workspace.getConfiguration("codelens-sample").update("enableCodeLens", true, true);
	// });

	// commands.registerCommand("codelens-sample.disableCodeLens", () => {
	//     workspace.getConfiguration("codelens-sample").update("enableCodeLens", false, true);
	// });
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}