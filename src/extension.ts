/*
 * Copyright (c) lumbermixalot (Galib F. Arrieta)
 * For complete copyright and license terms please see the LICENSE at the root of this distribution.
 *
 * SPDX-License-Identifier: Apache-2.0 OR MIT
 *
 */

'use strict';

import * as vscode from 'vscode';
import * as querystring from 'querystring';

import { activateLuaDebug } from './activateLuaDebug';


class UriHandler implements vscode.UriHandler {

	private disposables: vscode.Disposable[] = [];
  
	constructor () {
  		this.disposables.push ( vscode.window.registerUriHandler ( this ) );
	}
  
	dispose () {
	  this.disposables.forEach ( disposable => disposable.dispose () );
	  this.disposables = [];
	}
  
	handleUri ( uri: vscode.Uri )
	{
		// Open all the lua files.
		let parsedUrlQuery = querystring.parse(uri.query);

		if (parsedUrlQuery.projectPath)
		{
			vscode.commands.executeCommand('lumbermixalot.o3de-lua-debug.updateGameProjectPath', parsedUrlQuery.projectPath as string);
		}

		let fileList = parsedUrlQuery["files[]"] as string | string[];
		if (fileList.length > 0)
		{
			if (typeof fileList === "string")
			{
				fileList = [fileList]
			}
			for (let filePath of fileList)
			{
				vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath));
			}
		}

	}
}

export function activate(context: vscode.ExtensionContext) {

	new UriHandler();

	// run the debug adapter inside the extension and directly talk to it
	activateLuaDebug(context);
}

export function deactivate() {
	// nothing to do
}



