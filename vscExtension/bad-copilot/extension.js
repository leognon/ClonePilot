const vscode = require('vscode');
const axios = require('axios');

function activate(context) {
	let selectedEditor;
	let selectedRange;
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

			selectedEditor = editor;
			selectedRange = selection;

			// Get the word within the selection
			const word = document.getText(selection);

			try {
				const response = await axios.get(`http://127.0.0.1:3000/getFunction/${word}`);
				const fns = response.data.sort((a, b) => b.postScore - a.postScore);
				await openVirtualDoc(fns);
			} catch (err) {
				console.log('Error sending request', err);
			}
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
			const lineNum = content.split('\n').length;
			const formattedFn = formatFunction(fns[i]);
			codelensProvider.addPosition(lineNum, fns[i]);
			content += formattedFn.postHeader + formattedFn.keywords + formattedFn.header + formattedFn.body;
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
		const postHeader = `//===== From https://stackoverflow.com/q/${fn.postId} =====\n`;
		const keywords = (fn.fnIsAsync ? 'async ' : '') + 'function ';
		const header = fn.fnName + '(' + fn.fnParams.replace(/,/g, ', ') + ') ';
		const body = (fn.fnIsExpression ? '{\n' : '') + fn.fnBody + (fn.fnIsExpression ? '\n}' : '');
		//TODO Indentation is off

		return {
			postHeader,
			keywords,
			header,
			body
		};
	}

	const chooseOption = vscode.commands.registerCommand('bad-copilot.chooseOption', fn => {
		if (selectedEditor) {
			try {
				selectedEditor.edit(editBuilder => {
					const formatted = formatFunction(fn);
					editBuilder.replace(selectedRange, formatted.header + formatted.body);
				});
			} catch (e) {
				//The editor isn't open
			}
		}
		//Close copilot window. The hide function is deprecated, so it must be shown then closed as the active editor.
		vscode.window.showTextDocument(myScheme, {
				preview: true,
				preserveFocus: false
			})
			.then(() => {
				return vscode.commands.executeCommand('workbench.action.closeActiveEditor');
			});
	});
	context.subscriptions.push(chooseOption);

	const codelensProvider = new class {
		constructor() {
			this.codelenses = [];
		}
		addPosition(lineNum, fn) {
			const range = new vscode.Range(lineNum, 0, lineNum, 0);
			this.codelenses.push(new vscode.CodeLens(range, {
				title: 'Choose option',
				command: 'bad-copilot.chooseOption',
				arguments: [
					fn
				],
				tooltip: 'Select'
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