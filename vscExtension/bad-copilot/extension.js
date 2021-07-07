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
	const myProvider = new class {
		provideTextDocumentContent(uri) {
			return uri.path;
		}
	}();
	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(myScheme, myProvider));

	const openVirtualDoc = async (fns) => {
		let content = `/* Bad Copilot found ${fns.length} functions */\n\n`;
		for (let i = 0; i < fns.length; i++) {
			content += formatFunction(fns[i]);
			if (i < fns.length - 1) content += '\n\n';
		}
		let uri = vscode.Uri.parse(myScheme + ':' + content);
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
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}