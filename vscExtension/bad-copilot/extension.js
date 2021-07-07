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
				const bestFn = fns[0];
				const params = bestFn.params;
				const body = bestFn.body;
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
		constructor() {
			// emitter and its event
			// onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
			// onDidChange = this.onDidChangeEmitter.event;
		}

		provideTextDocumentContent(uri) {
			// simply invoke cowsay, use uri-path as text
			console.log('Provide with URI: ', uri);
			return 'abc' + uri.path; //cowsay.say({ text: uri.path });
		}
	};
	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(myScheme, myProvider));

	context.subscriptions.push(vscode.commands.registerCommand('bad-copilot.openVirtual', async () => {
		const uri = vscode.Uri.parse(myScheme + ':' + 'asdf');
		console.log('URI: ', uri);
		const doc = await vscode.workspace.openTextDocument(uri); // calls back into the provider
		await vscode.window.showTextDocument(doc, {
			viewColumn: vscode.ViewColumn.Beside,
			preview: true,
			preserveFocus: true,
		});
	}));
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}