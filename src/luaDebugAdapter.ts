/*
 * Copyright (c) lumbermixalot (Galib F. Arrieta)
 * For complete copyright and license terms please see the LICENSE at the root of this distribution.
 *
 * SPDX-License-Identifier: Apache-2.0 OR MIT
 *
 */

// luaDebugAdapter.ts implements the Debug Adapter that "adapts" or translates the Debug Adapter Protocol (DAP) used by the client (e.g. VS Code)
// into tcp/ip Messages for the O3DE Editor to control the ScriptDebugContext.
//
// The most important class of the Debug Adapter is the LuaDebugSession which implements many DAP requests by talking to the O3DE Editor.

import {
	Logger, logger,
	LoggingDebugSession,
	InitializedEvent, TerminatedEvent, StoppedEvent, BreakpointEvent,
	Thread, Scope, Source, Handles, Breakpoint
} from '@vscode/debugadapter';

import { DebugProtocol } from '@vscode/debugprotocol';

import { Subject } from 'await-notify';
import path from 'path';

import { O3DEInternalEvents, O3DERemoteToolsServer } from './o3deRemoteToolsServer';
import { BreakpointLineInfo, BreakpointManager, BreakpointSourceInfo } from './BreakpointManager';
import { StackFrameManager } from './StackFrameManager';
import { DebugValue as O3DEDebugVariable,  ScriptDebugSetValueResult as O3DEScriptDebugSetValueResult } from './o3deNetClasses/o3deClasses';
import { DebugVariablesManager } from './DebugVariablesManager';


function timeout(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * This interface describes the specific launch attributes
 * (which are not part of the Debug Adapter Protocol).
 * The schema for these attributes lives in the package.json of this extension.
 * The interface should always match this schema.
 */
interface ILaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
	trace?: boolean;
}

interface IAttachRequestArguments extends ILaunchRequestArguments { }

export class LuaDebugSession extends LoggingDebugSession {

	// we don't support multiple threads, so we can use a hardcoded ID for the default thread
	private static threadID = 1;

	private _configurationDone = new Subject();

	private _valuesInHex = false;
	private _useInvalidatedEvent = false;

	private _addressesInHex = true;

	private m_breakpointMgr: BreakpointManager;
	private m_o3deRemoteToolsServer: O3DERemoteToolsServer;
	private m_isAttachedToDebugger = false;
	private m_stackFrameMgr = new StackFrameManager();
	private m_debugVariablesMgr = new DebugVariablesManager();
	private m_variableHandles = new Handles<'locals' | O3DEDebugVariable>();
	private m_cancellationTokens = new Map<number, boolean>();
	private m_setValueResult: O3DEScriptDebugSetValueResult | null = null;

	/**
	 * Creates a new debug adapter that is used for one debug session.
	 * We configure the default implementation of a debug adapter here.
	 */
	public constructor(gameProjectFolder: string, tcpPort: number = 6777) {
		super("lua-debug.txt");

		this.m_breakpointMgr = new BreakpointManager(gameProjectFolder);
		this.m_o3deRemoteToolsServer = new O3DERemoteToolsServer(tcpPort);

		// this debugger uses zero-based lines and columns
		this.setDebuggerLinesStartAt1(false);
		this.setDebuggerColumnsStartAt1(false);
	}

	/**
	 * The 'initialize' request is the first request called by the frontend
	 * to interrogate the features the debug adapter provides.
	 */
	protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {

		// This is used when choosing "Hex" or "Dec" visualization
		// for variables. In such case we may send an InvalidatedEvent
		// to force debug variable refresh.
		if (args.supportsInvalidatedEvent) {
			this._useInvalidatedEvent = true;
		}

		// build and return the capabilities of this debug adapter:
		response.body = response.body || {};

		// the adapter implements the configurationDone request.
		response.body.supportsConfigurationDoneRequest = true;

		// make VS Code use 'evaluate' when hovering over source
		response.body.supportsEvaluateForHovers = false;

		// make VS Code show a 'step back' button
		response.body.supportsStepBack = false;

		// make VS Code support data breakpoints
		response.body.supportsDataBreakpoints = false;

		// make VS Code support completion in REPL
		response.body.supportsCompletionsRequest = false;

		// make VS Code send cancel request
		response.body.supportsCancelRequest = true;

		// make VS Code send the breakpointLocations request
		response.body.supportsBreakpointLocationsRequest = false;

		// make VS Code provide "Step in Target" functionality
		response.body.supportsStepInTargetsRequest = false;

		response.body.supportsExceptionFilterOptions = false;

		// make VS Code send exceptionInfo request
		response.body.supportsExceptionInfoRequest = false;

		// make VS Code send setVariable request
		response.body.supportsSetVariable = true;

		// make VS Code send setExpression request
		response.body.supportsSetExpression = false;

		// make VS Code send disassemble request
		response.body.supportsDisassembleRequest = false;
		response.body.supportsSteppingGranularity = false;
		response.body.supportsInstructionBreakpoints = false;

		// make VS Code able to read and write variable memory
		response.body.supportsReadMemoryRequest = false;
		response.body.supportsWriteMemoryRequest = false;

		response.body.supportSuspendDebuggee = false;
		response.body.supportTerminateDebuggee = true;
		response.body.supportsFunctionBreakpoints = false;
		response.body.supportsDelayedStackTraceLoading = true;
		response.body.supportsRestartRequest = false;
		response.body.supportsRestartFrame = false;

		this.sendResponse(response);

		// since this debug adapter can accept configuration requests like 'setBreakpoint' at any time,
		// we request them early by sending an 'initializeRequest' to the frontend.
		// The frontend will end the configuration sequence by calling 'configurationDone' request.
		this.sendEvent(new InitializedEvent());
	}

	/**
	 * Called at the end of the configuration sequence.
	 * Indicates that all breakpoints etc. have been sent to the DA and that the 'launch' can start.
	 */
	protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
		super.configurationDoneRequest(response, args);

		// notify the launchRequest that configuration has finished
		this._configurationDone.notify();
	}

	// Get's called when the user stops the debugging session
	protected async disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments, request?: DebugProtocol.Request): Promise<void> {
		console.log(`disconnectRequest suspend: ${args.suspendDebuggee}, terminate: ${args.terminateDebuggee}`);
		this.m_o3deRemoteToolsServer.TerminateSession();
	}

	// "Attach" is the only operation this debugger supports. The execution of Lua Scripts and games is completely
	// managed by the O3DE Editor, this debugging only attaches to a running Editor, and to be precise, The Editor
	// is the Tcp Client that connects to this Tcp Server. 
	protected async attachRequest(response: DebugProtocol.AttachResponse, args: IAttachRequestArguments) {
		// make sure to 'Stop' the buffered logging if 'trace' is not set
		logger.setup(args.trace ? Logger.LogLevel.Verbose : Logger.LogLevel.Stop, false);

		// wait 1 second until configuration has finished (and configurationDoneRequest has been called)
		await this._configurationDone.wait(1000);

		// Register for Events from our Tcp Server.
		this.m_o3deRemoteToolsServer.on(O3DEInternalEvents.OnSessionTerminated, () => {
			this.OnDebugSessionTerminated();
        });

		this.m_o3deRemoteToolsServer.on(O3DEInternalEvents.OnAttachedToDebugger, () => {
			this.OnAttachedToDebugger();
        });

		this.m_o3deRemoteToolsServer.on(O3DEInternalEvents.OnBreakpointHit, (editorFilePath: string, line: number) => {
			this.OnBreakpointHit(editorFilePath, line);
        });

		this.m_o3deRemoteToolsServer.on(O3DEInternalEvents.OnCallstackResult, (callstack: string) => {
			this.OnCallstackResult(callstack);
		});

		this.m_o3deRemoteToolsServer.on(O3DEInternalEvents.OnEnumLocalsResult, (localVariableNames: string[]) => {
			this.OnEnumLocalsResult(localVariableNames);
		});

		this.m_o3deRemoteToolsServer.on(O3DEInternalEvents.OnGetValueResult, (variableValue: O3DEDebugVariable) => {
			this.OnGetVariableValue(variableValue);
		});

		this.m_o3deRemoteToolsServer.on(O3DEInternalEvents.OnSetValueResult, (result: O3DEScriptDebugSetValueResult) => {
			this.m_setValueResult = result;
		});

		this.m_o3deRemoteToolsServer.on(O3DEInternalEvents.OnConnectionError, () => {
			this.OnConnectionError();
		});

		// Kick-off the server.
		this.m_o3deRemoteToolsServer.Run();
	}


	protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
		console.log("setBreakPointsRequest");

		const filePath = args.source.path as string;
		const clientLines = args.lines || [];

		if (!filePath)
		{
			console.error("setBreakPointsRequest. Got an undefined args.source.path");
			return;
		}

		if (this.m_isAttachedToDebugger)
		{
			// Get our current list of breakpoints send the remove request, and invalidate locally.
			let bpSourceInfo = this.m_breakpointMgr.GetBreakpointsByVSCodePath(filePath) as BreakpointSourceInfo;
			if (bpSourceInfo)
			{
				this.m_o3deRemoteToolsServer.SendRemoveBreakPointsRequests(bpSourceInfo);
			}	
		}

		this.m_breakpointMgr.AddBreakpoints(filePath, clientLines);

		if (this.m_isAttachedToDebugger)
		{
			setTimeout(() => {
					this.m_o3deRemoteToolsServer.SendAddBreakPointsRequests(this.m_breakpointMgr.GetBreakpointsByVSCodePath(filePath) as BreakpointSourceInfo);	
			}, 0);
		}

		// Report back the actual breakpoint positions with their breakpointId.
		let actualBreakpoints: Breakpoint[] = [];
		let bps = this.m_breakpointMgr.GetBreakpointsByVSCodePath(filePath) as BreakpointSourceInfo;
		for (let line of clientLines)
		{
			let bpLineInfo = bps.GetBreakpointLineInfo(line) as BreakpointLineInfo;
			let vscodeBreakpoint = new Breakpoint(true, line);//, 1, <Source>(args.source));
			vscodeBreakpoint.setId(bpLineInfo?.m_breakpointId);
			actualBreakpoints.push(vscodeBreakpoint);
		}

		response.body = {
			breakpoints: actualBreakpoints
		};
		this.sendResponse(response);
	}


	protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {

		// runtime supports no threads so just return a default thread.
		response.body = {
			threads: [
				new Thread(LuaDebugSession.threadID, "thread 1"),
			]
		};
		this.sendResponse(response);
	}

	protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {

		const startFrame = typeof args.startFrame === 'number' ? args.startFrame : 0;
		const maxLevels = typeof args.levels === 'number' ? args.levels : 1000;
		const endFrame = startFrame + maxLevels;

		console.log(`startFrame=${startFrame}, maxLevels=${maxLevels}, endFrame=${endFrame}`);

		this.m_stackFrameMgr.FillResponse(startFrame, response);

		this.sendResponse(response);
	}

	protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
		this.m_variableHandles.reset();

		response.body = {
			scopes: [
				new Scope("Locals", this.m_variableHandles.create('locals'), true),
				//new Scope("Globals", this.m_variableHandles.create('globals'), true)
			]
		};
		this.sendResponse(response);
	}

	protected async variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments, request?: DebugProtocol.Request): Promise<void> {
		console.log(`Got variables Request! ${request ? `With seq=${request.seq}` : "no request"}`);

		let variables: DebugProtocol.Variable[] = [];

		const v = this.m_variableHandles.get(args.variablesReference);
		if (v === 'locals')
		{
			console.log("variablesRequest: Asking for locals");
			if (request)
			{
				this.m_cancellationTokens.set(request.seq, false);
				variables = await this.FetchLocalVariables(() => !!this.m_cancellationTokens.get(request.seq));
				this.m_cancellationTokens.delete(request.seq);
			}
			else
			{
				variables = await this.FetchLocalVariables();
			}
		} 
		else
		{
			variables = this.m_debugVariablesMgr.GetDebugProtocolVariables((debugVariable: O3DEDebugVariable) => this.m_variableHandles.create(debugVariable), args);
		}

		response.body = {
			variables: variables
		};
		this.sendResponse(response);
	}

	protected async setVariableRequest(response: DebugProtocol.SetVariableResponse, args: DebugProtocol.SetVariableArguments, request?: DebugProtocol.Request): Promise<void> {
		
		// When VSCode asks to update the value of a variable, this variable may be just a property
		// within a long chain of parents of DebugValue variables. We need to send the whole chain
		// of DebugValue variables, all the way to the root because that's what the Lua VM running in
		// the editor needs. For example:
		// Imagine we have the following chain of DebugValue that start with 'self':
		// DebugValue: 'self'                 '{...}'
		// DebugValue:     'Properties'       '{...}'
		// DebugValue:         'speed'        '4.0'
		//
		// When the user attempts to modify the    'speed' to let's say '5.0',
		// this setVariableRequest() function call will have the args.variableReference referring to
		// 'speed', with new proposed value of '5.0'.
		//
		// The DebugVariablesManager mission is to find 'speed' make a copy of it, and set the value
		// of the copy to '5.0', in addition it should recourse up the chain until finding 'self'
		// and send the whole chain via TCP to the remote Lua VM (running in the Editor).
		// Then we wait for an answer of type ScriptDebugSetValueResult, and if successful,
		// We update the value of the variable and send a positive a response back to VSCode.        

		let resultTuple = this.m_debugVariablesMgr.GetModifiedDebugVariableRootCopy(args);
		if (!resultTuple)
		{
			return;
		}

		let [variableReference, rootDebugVariableCopy, debugVariable] = resultTuple;
		let success = false;
		if (request)
		{
			this.m_cancellationTokens.set(request.seq, false);
			success = await this.SendSetValueRequest(rootDebugVariableCopy, () => !!this.m_cancellationTokens.get(request.seq));
			this.m_cancellationTokens.delete(request.seq);
		}
		else
		{
			success = await this.SendSetValueRequest(rootDebugVariableCopy);
		}

		if (success)
		{
			debugVariable.value = args.value;
			this.m_debugVariablesMgr.SetVariableResponseBody(response, variableReference, debugVariable);
			this.sendResponse(response);
		}

	}

	protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
		this.m_debugVariablesMgr.Invalidate();
		this.m_o3deRemoteToolsServer.SendContinueRequest();
		this.sendResponse(response);
	}


	// This is called each time the user clicks "Step Over (F10)".
	protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
		this.m_debugVariablesMgr.Invalidate();
		this.m_o3deRemoteToolsServer.SendStepOverRequest();
		this.sendResponse(response);
	}

	protected stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): void {
		this.m_debugVariablesMgr.Invalidate();
		this.m_o3deRemoteToolsServer.SendStepInRequest();
		this.sendResponse(response);
	}

	protected stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments): void {
		this.m_debugVariablesMgr.Invalidate();
		this.m_o3deRemoteToolsServer.SendStepOutRequest();
		this.sendResponse(response);
	}


	protected cancelRequest(response: DebugProtocol.CancelResponse, args: DebugProtocol.CancelArguments) {
		if (args.requestId) {
			this.m_cancellationTokens.set(args.requestId, true);
		}
	}

	protected customRequest(command: string, response: DebugProtocol.Response, args: any) {
		if (command === 'updateGameProjectPath')
		{
			this.m_breakpointMgr.UpdateProjectPath(args as string);
		}
		else
		{
			super.customRequest(command, response, args);
		}

		//if (command === 'toggleFormatting') {
		//	this._valuesInHex = ! this._valuesInHex;
		//	if (this._useInvalidatedEvent) {
		//		this.sendEvent(new InvalidatedEvent( ['variables'] ));
		//	}
		//	this.sendResponse(response);
		//} else {
		//	super.customRequest(command, response, args);
		//}
	}

	//-- Custom private functions to this Adapter.

	public GetRemoteToolsServer() {
		return this.m_o3deRemoteToolsServer;
	}

	private async FetchLocalVariables(cancelFunc?: () => boolean): Promise<DebugProtocol.Variable[]>
	{
		if (this.m_debugVariablesMgr.HasAllVariableData())
		{
			return this.m_debugVariablesMgr.GetDebugProtocolVariables((debugVariable: O3DEDebugVariable) => this.m_variableHandles.create(debugVariable));
		}
		
		this.m_o3deRemoteToolsServer.SendEnumLocalsRequest();

		while (!this.m_debugVariablesMgr.HasAllVariableData())
		{
			if (cancelFunc && cancelFunc())
			{
				return [];
			}
			await timeout(200);
		}

		return this.m_debugVariablesMgr.GetDebugProtocolVariables((debugVariable: O3DEDebugVariable) => this.m_variableHandles.create(debugVariable));
	}


	private async SendSetValueRequest(updatedO3DEDebugValue: O3DEDebugVariable, cancelFunc?: () => boolean) : Promise<boolean>
	{
		this.m_setValueResult = null;
		this.m_o3deRemoteToolsServer.SendScriptDebugSetValue(updatedO3DEDebugValue);
		while (!this.m_setValueResult)
		{
			if (cancelFunc && cancelFunc())
			{
				return false;
			}
			await timeout(200);
		}
		// We got the answer we were waiting for.
		let result = this.m_setValueResult as O3DEScriptDebugSetValueResult;
		console.log(`SendSetValueRequest name=${result.name}, result=${result.result}`);
		return result.result;
	}


	private OnDebugSessionTerminated()
	{
		setTimeout(() => {
			this.m_isAttachedToDebugger = false;
			this.m_stackFrameMgr.Invalidate();
			this.m_debugVariablesMgr.Invalidate();
			this.m_variableHandles.reset();
			this.m_cancellationTokens.clear()
			this.m_setValueResult = null;
			this.m_o3deRemoteToolsServer.removeAllListeners();
		}, 0);
	}


	// An event coming from o3deRemoteToolsServer
	private OnAttachedToDebugger()
	{
		setTimeout(() => {

			// Validate the breakpoints.
			let bps = this.m_breakpointMgr.GetBreakpoints();
			for (let bpSourceInfo of bps) {
				let bpLines = bpSourceInfo.GetLines().values();
				for (let lineInfo of bpLines)
				{
					this.sendEvent(new BreakpointEvent('changed', { verified: true, id: lineInfo.m_breakpointId } as DebugProtocol.Breakpoint));
				}
			}

			this.m_isAttachedToDebugger = true;
			bps = this.m_breakpointMgr.GetBreakpoints();
			for (let bpSourceInfo of bps) {
				this.m_o3deRemoteToolsServer.SendAddBreakPointsRequests(bpSourceInfo);	
			}
		}, 0);
	}

	private OnBreakpointHit(editorFilePath: string, line: number)
	{
		//Request the callstack.
		this.m_o3deRemoteToolsServer.SendGetCallstackRequest();

		// We are not going to send the DebugProtocol.StoppedEvent because we need the StackFrame
		// information. Once we get the StackFrame information, then we'll send the the StoppedEvent,
		// which will trigger VSCode calling back asking for the StackFrame.
	}

	// This string contains multiple lines that look like:
	//[Lua] @levels/lualocalstest/scripts/entity_mover.lua (54) : DummyFunction(000001AA73D63480, 0)
	//[Lua] @levels/lualocalstest/scripts/entity_mover.lua (20) : FunctionDefinedAtLine[13](000001AA73D63480)
	private OnCallstackResult(callstack: string)
	{
		if (this.m_stackFrameMgr.IsSameCallstack(callstack))
		{
			console.log("OnCallstackResult: Got the same callstack as before.");
			return;
		}

		console.log(`This is the callstack:\n${callstack}`);

		this.m_stackFrameMgr.Update(callstack, (editorFilePath: string) => {
			let isWindows = process.platform === 'win32';
			let vscodeFilePath = this.m_breakpointMgr.GetVscodePathFromEditorPath(editorFilePath);
			if (!vscodeFilePath)
			{
				return new Source("UnknownFile");
			}
			let fileName = isWindows ? path.win32.basename(vscodeFilePath) : path.basename(vscodeFilePath);
			return new Source(fileName, vscodeFilePath);
		});

		// Now that we have stackframe information, let's send the StoppedEvent.
		const stoppedEvent: DebugProtocol.StoppedEvent = new StoppedEvent('breakpoint', 1);
		stoppedEvent.body.hitBreakpointIds = [this.m_breakpointMgr.GetBreakpointHitId()];
		this.sendEvent(stoppedEvent);
	}


	private OnEnumLocalsResult(localVariableNames: string[])
	{
		this.m_debugVariablesMgr.PrepareDebugVariableList(localVariableNames);
		for(let variableName of localVariableNames)
		{
			this.m_o3deRemoteToolsServer.SendGetVariableValueRequest(variableName);
		}
	}

	private OnGetVariableValue(debugVariable: O3DEDebugVariable)
	{
		console.log(`Received variable value for ${debugVariable.name}`);
		let variableReference = this.m_debugVariablesMgr.GetRootVariableReferenceNumber(debugVariable);
		if (variableReference)
		{
			console.log(`Variable with name ${debugVariable.name} already exists!`);
			return;
		}
		this.m_debugVariablesMgr.Update((debugVariable: O3DEDebugVariable) => this.m_variableHandles.create(debugVariable), debugVariable);
	}

	private OnConnectionError()
	{
		setTimeout(() => {
			this.sendEvent(new TerminatedEvent(false));
		}, 0);
	}

}

