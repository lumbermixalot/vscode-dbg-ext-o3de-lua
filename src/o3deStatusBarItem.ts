/*
 * Copyright (c) lumbermixalot (Galib F. Arrieta)
 * For complete copyright and license terms please see the LICENSE at the root of this distribution.
 *
 * SPDX-License-Identifier: Apache-2.0 OR MIT
 *
 */

import * as vscode from 'vscode';
import { O3DEInternalEvents, O3DERemoteToolsServer } from './o3deRemoteToolsServer';
import { O3DEPacketRemoteToolsConnect } from './o3deNetClasses/o3dePacketRemoteToolsConnect';

export class O3DEStatusBarItem
{
    private m_statusBarItem: vscode.StatusBarItem;
    private m_connectMsgObj: O3DEPacketRemoteToolsConnect | null;
    private m_isAttached: boolean;

    constructor(context: vscode.ExtensionContext)
    {
        // register a command that is invoked when the status bar
	    // item is selected
	    const myCommandId = 'o3de-debug.SayHello';
	    context.subscriptions.push(vscode.commands.registerCommand(myCommandId, () => {
            let message = this.m_connectMsgObj ? `Capabilities: 0x${this.m_connectMsgObj.m_capabilities.toString(16)}, PersistentId: 0x${this.m_connectMsgObj.m_persistentId.toString(16)}` : "Not Connected!";
	    	vscode.window.showInformationMessage(message);
	    }));

        this.m_statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.m_statusBarItem.command = myCommandId;
        this.m_statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        context.subscriptions.push(this.m_statusBarItem);
        this.m_connectMsgObj = null;
        this.m_isAttached = false;
    }

    public RegisterRemoteToolsEvents(o3deRemoteToolsServer: O3DERemoteToolsServer)
    {
        o3deRemoteToolsServer.on(O3DEInternalEvents.OnConnectedToEditor, (msgObj: O3DEPacketRemoteToolsConnect) => {
            this.m_connectMsgObj = msgObj;
            this.m_statusBarItem.text = `O3DELuaDbg: ${msgObj.m_displayName}(${this.m_isAttached ? "Attached" : "Dettached"})`;
            this.m_statusBarItem.show();
        });

        o3deRemoteToolsServer.on(O3DEInternalEvents.OnAttachedToDebugger, () => {
            this.m_isAttached = true
            let msgObj = this.m_connectMsgObj;
            this.m_statusBarItem.text = `O3DELuaDbg: ${msgObj.m_displayName}(${this.m_isAttached ? "Attached" : "Dettached"})`;
            this.m_statusBarItem.show();
        });

        o3deRemoteToolsServer.on(O3DEInternalEvents.OnSessionTerminated, () => {
            this.m_connectMsgObj = null
            this.m_statusBarItem.text = "";
            this.m_statusBarItem.hide();
        });

        o3deRemoteToolsServer.on(O3DEInternalEvents.OnWaitingForConnection, () => {
            this.m_statusBarItem.text = `O3DELuaDbg: Waiting For Editor.exe`;
            this.m_statusBarItem.show();
        });
    }
}