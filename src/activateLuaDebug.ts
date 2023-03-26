/*
 * Copyright (c) lumbermixalot (Galib F. Arrieta)
 * For complete copyright and license terms please see the LICENSE at the root of this distribution.
 *
 * SPDX-License-Identifier: Apache-2.0 OR MIT
 *
 */

'use strict';

import path from 'path';
import fs  from 'fs';

import * as vscode from 'vscode';
import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode';
import { LuaDebugSession } from './luaDebugAdapter';
import { O3DEStatusBarItem } from './o3deStatusBarItem';

let g_o3deStatusBarItem: O3DEStatusBarItem;
let g_factory: InlineDebugAdapterFactory;


// Recursively travels up the chain of directories until finding project.json
function DiscoverGameProjectPath(directory: string): string
{
	if (directory.length < 3)
	{
		return "";
	}
	let testFile = path.join(directory, "project.json");
	if (fs.existsSync(testFile))
	{
		return directory;
	}
	let sepLocation = directory.lastIndexOf(path.sep);
	let parentDir = directory.substring(0, sepLocation);
	return DiscoverGameProjectPath(parentDir);
}

export function activateLuaDebug(context: vscode.ExtensionContext, factory?: vscode.DebugAdapterDescriptorFactory) {

	context.subscriptions.push(
		vscode.commands.registerCommand('lumbermixalot.o3de-lua-debug.debugEditorContents', (resource: vscode.Uri) => {
			let targetResource = resource;
			if (!targetResource && vscode.window.activeTextEditor) {
				targetResource = vscode.window.activeTextEditor.document.uri;
			}
			if (targetResource) {
				let sepLocation = targetResource.fsPath.lastIndexOf(path.sep);
				let parentDir = targetResource.fsPath.substring(0, sepLocation);
				vscode.debug.startDebugging(undefined, {
					type: 'O3DELua',
					name: 'Debug File',
					request: 'attach',
					gameProjectPath: DiscoverGameProjectPath(parentDir)
				});
			}
		}),
		vscode.commands.registerCommand('lumbermixalot.o3de-lua-debug.toggleFormatting', (variable) => {
			const ds = vscode.debug.activeDebugSession;
			if (ds) {
				ds.customRequest('toggleFormatting');
			}
		}),
		vscode.commands.registerCommand('lumbermixalot.o3de-lua-debug.updateGameProjectPath', (projectPath: string) => {
			g_factory.UpdateGameProjectPath(projectPath);
		})
	);

	// register a configuration provider for 'O3DELua' debug type
	const provider = new MyConfigurationProvider();
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('O3DELua', provider));

	if (!factory) {
		factory = new InlineDebugAdapterFactory();
		g_factory = factory as InlineDebugAdapterFactory;
	}
	context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('O3DELua', factory));
	if ('dispose' in factory) {
		context.subscriptions.push(factory);
	}

	g_o3deStatusBarItem = new O3DEStatusBarItem(context);

}

class MyConfigurationProvider implements vscode.DebugConfigurationProvider {

	/**
	 * Massage a debug configuration just before a debug session is being launched,
	 * e.g. add all missing attributes to the debug configuration.
	 */
	resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {

		// if launch.json is missing or empty
		if (!config.type && !config.request && !config.name) {
			const editor = vscode.window.activeTextEditor;
			if (editor && editor.document.languageId === 'lua') {
				config.type = 'O3DELua';
				config.name = 'Attach';
				config.request = 'attach';
			}
		}

		return config;
	}
}

// vscode has a known issue where on some APIs an absolute path would be reported
// as: "D:\blah..." but in breakpoint APIs the path would appear as: "d:\blah...".
// Because this is a debugger extension the "Fix" is to set the drive Letter to lower case.
function FixPathHelper(somePath: string) : string
{
	let isWindows = process.platform === 'win32';
	if (!isWindows)
	{
		return somePath;
	}
	let fixedDriveLetter = somePath.replace(/^[A-Z]:/, (match, offset) => {
		return match.toLowerCase();
	});

	return fixedDriveLetter.replace(/\//g, "\\");
}

function IsValidO3DEGameProject(projectPath: string) : boolean
{
	if (!projectPath || projectPath.length < 1)
	{
		return false;
	}
	let projectJson = path.join(projectPath, "project.json");
	return fs.existsSync(projectJson);
}

class InlineDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {
	private m_gameProjectPath: string | undefined;

	constructor()
	{
	}

	async createDebugAdapterDescriptor(_session: vscode.DebugSession): Promise<ProviderResult<vscode.DebugAdapterDescriptor>> {
		let debugConfig = _session.configuration;

		let tcpListenPort = vscode.workspace.getConfiguration().get('tcpListenPort') as number;
		let defaultGameProjectPath = vscode.workspace.getConfiguration().get('gameProjectPath') as string;

		if (debugConfig.tcpListenPort)
		{
			tcpListenPort = debugConfig.tcpListenPort;
		}

		let gameProjectPath = this.m_gameProjectPath as string;
		if (!gameProjectPath)
		{
			if (debugConfig.gameProjectPath && debugConfig.gameProjectPath.length > 0)
			{
				if (IsValidO3DEGameProject(debugConfig.gameProjectPath))
				{
					gameProjectPath = FixPathHelper(debugConfig.gameProjectPath);
				}
				else
				{
					if (IsValidO3DEGameProject(defaultGameProjectPath))
					{
						let msg = `The game project from the configuration:\n${debugConfig.gameProjectPath}\nis not valid. `;
						msg += `Would you use the one from the default settings:\n${defaultGameProjectPath}?`;
						await vscode.window.showInformationMessage(msg, "Yes", "No").then(answer => {
							if (answer === "Yes") {
						    	gameProjectPath = defaultGameProjectPath;
						  	}
						});
					}
					else
					{
						let msg = `Both, the provided game project:\n${debugConfig.gameProjectPath}\n`;
						msg += `and the default:\n${defaultGameProjectPath}\n don't appear to be valid O3DE Game Projects.\n`;
						msg + "Can not proceed with this debug session."
						await vscode.window.showInformationMessage(msg, "Ok");
						return;
					}
				}
			}
			else
			{
				let msg = "Please specify a valid 'gameProjectPath' in 'launch.json' or in this extension settings 'gameProjectPath'\n";
				await vscode.window.showInformationMessage(msg, "Ok");
				return;
			}
		}

		let o3deDebugSession = new LuaDebugSession(gameProjectPath, tcpListenPort as number);
		
		let o3deRemoteToolsServer = o3deDebugSession.GetRemoteToolsServer();
		g_o3deStatusBarItem.RegisterRemoteToolsEvents(o3deRemoteToolsServer);
		
		return new vscode.DebugAdapterInlineImplementation(o3deDebugSession);
	}

	// This function is called when we get an Uri activation event, typically
	// triggered by the O3DE Editor.exe when users click on open lua script button
	// in the Lua Script Component.
	UpdateGameProjectPath(gameProjectPath: string)
	{
		this.m_gameProjectPath = FixPathHelper(gameProjectPath);
		const ds = vscode.debug.activeDebugSession;
		if (ds) {
			ds.customRequest('updateGameProjectPath', this.m_gameProjectPath);
		}
	}

}
