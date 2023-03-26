/*
 * Copyright (c) lumbermixalot (Galib F. Arrieta)
 * For complete copyright and license terms please see the LICENSE at the root of this distribution.
 *
 * SPDX-License-Identifier: Apache-2.0 OR MIT
 *
 */

import * as Net from 'net';

import { O3DETcpHeader } from './o3deNetClasses/o3deTcpHeader';
import { O3DEPacketRemoteToolsConnect } from './o3deNetClasses/o3dePacketRemoteToolsConnect';
import { O3DEPacketInitiateConnection } from './o3deNetClasses/o3dePacketInitiateConnection';
import * as AZCRC32 from './o3deCrc32';
import { O3DESerializationContext } from './o3deNetClasses/o3deSerializationContext';
import { O3DENetObject, O3DEObjectStream } from './o3deNetClasses/o3deObjectStreamSerDes';
import * as O3DE from './o3deNetClasses/o3deClasses';


//import { EventEmitter } from 'stream';
import { EventEmitter } from 'events';
import { O3DEPacketRemoteToolsMessage } from './o3deNetClasses/o3dePacketRemoteToolsMessage';
import { BreakpointSourceInfo } from './BreakpointManager';

export namespace O3DEInternalEvents
{
    export const OnWaitingForConnection = "OnWaitingForConnection"; //on(O3DEInternalEvents.OnWaitingForConnection, ()
    export const OnConnectedToEditor = "OnConnectedToEditor"; //on(O3DEInternalEvents.OnConnectedToEditor, (msgObj: O3DEPacketRemoteToolsConnect ))
    export const OnAttachedToDebugger = "OnAttachedToDebugger"; // on(O3DEInternalEvents.OnAttachedToDebugger, ())
    export const OnSessionTerminated = "OnSessionTerminated"; //on(O3DEInternalEvents.OnSessionTerminated, (void)
    export const OnBreakpointHit = "OnBreakpointHit"; //on(O3DEInternalEvents.OnBreakpointHit, (editorFilePath: string, line: number)
    export const OnCallstackResult = "OnCallstackResult"; //on(O3DEInternalEvents.OnCallstackResult, (callstack: string)
    export const OnEnumLocalsResult = "OnEnumLocalsResult"; //on(O3DEInternalEvents.OnEnumLocalsResult, (localVariableNames: string[])
    export const OnGetValueResult = "OnGetValueResult"; //on(O3DEInternalEvents.OnEnumLocalsResult, (variableValue: O3DE.DebugValue)
    export const OnSetValueResult = "OnSetValueResult"; //on(O3DEInternalEvents.OnSetValueResult, (result: O3DEScriptDebugSetValueResult)
    export const OnConnectionError = "OnConnectionError"; //on(O3DEInternalEvents.OnConnectionError, ()
}

const g_o3deSC = new O3DESerializationContext();

export class O3DETcpSession extends EventEmitter
{
    private m_sendBuffer: Uint8Array;
    private m_persistentId: number;
    private m_terminatedByUser: boolean;
    constructor(public m_socket: Net.Socket) {
        super();
        this.m_terminatedByUser = false;
        this.m_sendBuffer = new Uint8Array(64 * 1024);
        this.m_persistentId = AZCRC32.AZ_CRC32_STR("LuaRemoteTools");
    }

    Start()
    {
        this.m_socket.on('end', () => {
            this.OnConnectionError();
        });
        this.m_socket.on('error', () => {
            this.OnConnectionError();
        });
        this.m_socket.on('close', () => {
            this.OnConnectionError();
        });
        
        this.m_socket.on('data', (data: Buffer) => {
            this.OnMsgReceived(data)
        });
    }

    Terminate()
    {
        this.m_terminatedByUser = true;
        this.m_socket.destroy();
        this.removeAllListeners();
    }

    OnSessionEnded()
    {
        console.log("O3DETcpSession ended");
    }

    OnConnectionError()
    {
        if (this.m_terminatedByUser)
        {
            return;
        }

        this.sendEvent(O3DEInternalEvents.OnConnectionError);
        this.m_terminatedByUser = true;
    }

    OnMsgReceived(buffer: Buffer)
    {
        console.log(`Received message of length ${buffer.length}`);

        if (buffer.length == 239)
        {
            console.log("got the message!");
        }

        //let my32: number = AZCRC32.AZ_CRC32_STR("ScriptDebugAgent");
        //console.log(`AZ my32 ${my32}=0x${my32.toString(16)}`);
    
        // We need to parse the @data buffer in terms of chunks.
        let pendingBytes: number = buffer.length;
        let bufferView = new Uint8Array(buffer.buffer);
        let totalBytesRead = 0;
        while (pendingBytes > 0)
        {
            if (pendingBytes < O3DETcpHeader.HeaderSize)
            {
                console.error(`Invalid pendingBytes=${pendingBytes}, was expecting at least ${O3DETcpHeader.HeaderSize}`);
                break;
            }

            let msgHeader = new O3DETcpHeader(bufferView);
            totalBytesRead += O3DETcpHeader.HeaderSize;
            bufferView = new Uint8Array(buffer.buffer, totalBytesRead);
            //let subMessageSize = O3DETcpHeader.HeaderSize + msgHeader.GetPacketSize();
            switch (msgHeader.GetPacketType())
            {
                case O3DEPacketInitiateConnection.PacketType:
                    console.log(`Got O3DEPacketInitiateConnection : ${msgHeader.GetPacketType()}`);
                    break;
                case O3DEPacketRemoteToolsConnect.PacketType:
                    let remoteToolsConnect = new O3DEPacketRemoteToolsConnect(msgHeader, bufferView);
                    this.OnO3DEPacketToolsConnect(remoteToolsConnect);
                    break;
                case O3DEPacketRemoteToolsMessage.PacketType:
                    let remoteToolsMessage = new O3DEPacketRemoteToolsMessage(msgHeader, bufferView);
                    this.OnO3DEPacketToolsMessage(remoteToolsMessage);
                    break;
                default:
                    console.log(`Unknown message type: ${msgHeader.GetPacketType()}`);
                    break;
            }
            totalBytesRead += msgHeader.GetPacketSize();
            bufferView = new Uint8Array(buffer.buffer, totalBytesRead);
            pendingBytes = buffer.length - bufferView.byteOffset;
        }

    }

    OnO3DEPacketToolsConnect(msg: O3DEPacketRemoteToolsConnect)
    {
        console.log(`Got connection message:\n${JSON.stringify(msg)}`);
        this.sendEvent(O3DEInternalEvents.OnConnectedToEditor, msg);

        // Send a request to attach to the ScriptDebugAgent.
        let sdr = new O3DE.ScriptDebugRequest(undefined);
        sdr.MsgId = BigInt(AZCRC32.AZ_CRC32_STR("ScriptDebugAgent"));
        sdr.request = AZCRC32.AZ_CRC32_STR("AttachDebugger");
        sdr.context = "Default";

        let objStream = new O3DEObjectStream(g_o3deSC);
        let byteCount = objStream.WriteToBuffer(sdr, this.m_sendBuffer);
        let messageBufferToSend = new Uint8Array(this.m_sendBuffer.buffer, 0, byteCount);

        this.SendMessageToO3DEEditor("ScriptDebugRequest", messageBufferToSend);

        console.log(`Sent message to attach to the debugger.`);
    }

    OnO3DEPacketToolsMessage(msg: O3DEPacketRemoteToolsMessage)
    {
        if (msg.HasCompleteMessage())
        {
            let objStream = new O3DEObjectStream(g_o3deSC);
            let netObject: O3DENetObject | null = objStream.CreateInstanceFromBuffer(msg.GetMsgBufferView());
            if (!netObject)
            {
                let msg = "OnO3DEPacketToolsMessage Error: Got invalid message";
                console.error(msg);
                throw new Error(msg);
            }
            switch (netObject.GetUuid())
            {
                case O3DE.ScriptDebugAck.UUID:
                    let scriptDebugAck = new O3DE.ScriptDebugAck(netObject.GetElementsForSerialization()); 
                    this.OnScriptDebugAck(scriptDebugAck);
                    break;
                case O3DE.ScriptDebugAckBreakpoint.UUID:
                    let scriptDebugAckBreakpoint = new O3DE.ScriptDebugAckBreakpoint(netObject.GetElementsForSerialization()); 
                    this.OnScriptDebugAckBreakpoint(scriptDebugAckBreakpoint);
                    break;
                case O3DE.ScriptDebugCallStackResult.UUID:
                    let scriptDebugCalllstackResult = new O3DE.ScriptDebugCallStackResult(netObject.GetElementsForSerialization()); 
                    this.OnScriptDebugCallstackResult(scriptDebugCalllstackResult);
                    break;
                case O3DE.ScriptDebugEnumLocalsResult.UUID:
                    let scriptDebugEnumLocalsResult = new O3DE.ScriptDebugEnumLocalsResult(netObject.GetElementsForSerialization()); 
                    this.OnScriptDebugEnumLocalsResult(scriptDebugEnumLocalsResult);
                    break;
                case O3DE.ScriptDebugGetValueResult.UUID:
                    let scriptDebugGetValueResult = new O3DE.ScriptDebugGetValueResult(netObject.GetElementsForSerialization()); 
                    this.OnScriptDebugGetValueResult(scriptDebugGetValueResult);
                    break;
                case O3DE.ScriptDebugSetValueResult.UUID:
                    let scriptDebugSetValueResult = new O3DE.ScriptDebugSetValueResult(netObject.GetElementsForSerialization()); 
                    this.OnScriptDebugSetValueResult(scriptDebugSetValueResult);
                    break;
                default:
                    console.error(`Can not handle net object with uuid=${netObject.GetUuid()}`);
                    break;
            }
        }
        else
        {
            console.error("Error. Incomplete messages not supported!");
        }
    }

    OnScriptDebugAck(scriptDebugAck: O3DE.ScriptDebugAck)
    {
        console.log(`Got scriptDebugAck: request=${scriptDebugAck.request},0x${scriptDebugAck.request.toString(16)}. AckCode=${scriptDebugAck.ackCode}`);
        if (scriptDebugAck.request == AZCRC32.AZ_CRC32_STR("AttachDebugger"))
        {
            if (scriptDebugAck.ackCode == AZCRC32.AZ_CRC32_STR("Ack"))
            {
                this.sendEvent(O3DEInternalEvents.OnAttachedToDebugger);
                console.log("Fully attached!");
            }
        }
    }

    OnScriptDebugAckBreakpoint(scriptDebugAckBreakpoint: O3DE.ScriptDebugAckBreakpoint)
    {
        if (scriptDebugAckBreakpoint.id == AZCRC32.AZ_CRC32_STR("AddBreakpoint"))
        {
            console.log(`Got scriptDebugAckBreakpoint: AddBreakpoint, moduleName=${scriptDebugAckBreakpoint.moduleName}, line=${scriptDebugAckBreakpoint.line}`);
        }
        else if (scriptDebugAckBreakpoint.id == AZCRC32.AZ_CRC32_STR("BreakpointHit"))
        {
            console.log(`Got scriptDebugAckBreakpoint: BreakpointHit, moduleName=${scriptDebugAckBreakpoint.moduleName}, line=${scriptDebugAckBreakpoint.line}`);
            this.sendEvent(O3DEInternalEvents.OnBreakpointHit, scriptDebugAckBreakpoint.moduleName, scriptDebugAckBreakpoint.line);

        }
        else if (scriptDebugAckBreakpoint.id == AZCRC32.AZ_CRC32_STR("RemoveBreakpoint"))
        {
            console.log(`Got scriptDebugAckBreakpoint: RemoveBreakpoint, moduleName=${scriptDebugAckBreakpoint.moduleName}, line=${scriptDebugAckBreakpoint.line}`);
        }
        else
        {
            console.log(`Got scriptDebugAckBreakpoint: id=${scriptDebugAckBreakpoint.id}, moduleName=${scriptDebugAckBreakpoint.moduleName}, line=${scriptDebugAckBreakpoint.line}`);
        }
    }


    OnScriptDebugCallstackResult(scriptDebugCalllstackResult: O3DE.ScriptDebugCallStackResult)
    {
        this.sendEvent(O3DEInternalEvents.OnCallstackResult, scriptDebugCalllstackResult.callstack);
    }

    OnScriptDebugEnumLocalsResult(scriptDebugEnumLocalsResult:  O3DE.ScriptDebugEnumLocalsResult)
    {
        console.log(`Got OnScriptDebugEnumLocalsResult:\n${scriptDebugEnumLocalsResult.names}`);
        this.sendEvent(O3DEInternalEvents.OnEnumLocalsResult, scriptDebugEnumLocalsResult.names);
    }

    OnScriptDebugGetValueResult(scriptDebugGetValueResult: O3DE.ScriptDebugGetValueResult)
    {
        console.log(`Got OnScriptDebugGetValueResult:\n${scriptDebugGetValueResult.value.name}`);
        this.sendEvent(O3DEInternalEvents.OnGetValueResult, scriptDebugGetValueResult.value);
    }

    OnScriptDebugSetValueResult(scriptDebugSetValueResult: O3DE.ScriptDebugSetValueResult)
    {
        console.log(`Got OnScriptDebugSetValueResult:\n${scriptDebugSetValueResult.name}, ${scriptDebugSetValueResult.result}`);
        this.sendEvent(O3DEInternalEvents.OnSetValueResult, scriptDebugSetValueResult);
    }

    OnMessageSentError(err: Error | undefined, dbgClassName: string, msgLength: number)
    {
        if (err)
        {
            console.error(`Failed to send message of type ${dbgClassName} and size ${msgLength}`);
        }
    }


    public SendBreakPointsRequests(op: string, breakpointInfo: BreakpointSourceInfo)
    {
        let lineMap = breakpointInfo.GetLines();
        for (let bpLineInfo of lineMap.values())
        {
            let sdbr = new O3DE.ScriptDebugBreakpointRequest(undefined);
            sdbr.MsgId = BigInt(AZCRC32.AZ_CRC32_STR("ScriptDebugAgent"));
            sdbr.request = AZCRC32.AZ_CRC32_STR(op);
            sdbr.context = breakpointInfo.m_editorFilePath;
            sdbr.line = bpLineInfo.m_line;

            let objStream = new O3DEObjectStream(g_o3deSC);
            let byteCount = objStream.WriteToBuffer(sdbr, this.m_sendBuffer);
            let messageBufferToSend = new Uint8Array(this.m_sendBuffer.buffer, 0, byteCount);
    
            this.SendMessageToO3DEEditor(`ScriptDebugBreakpointRequest::${op}`, messageBufferToSend);
        }
    }

    public SendScriptDebugRequest(request: string, context: string = "Default")
    {
        let sdr = new O3DE.ScriptDebugRequest(undefined);
        sdr.MsgId = BigInt(AZCRC32.AZ_CRC32_STR("ScriptDebugAgent"));
        sdr.request = AZCRC32.AZ_CRC32_STR(request);
        sdr.context = context;

        let objStream = new O3DEObjectStream(g_o3deSC);
        let byteCount = objStream.WriteToBuffer(sdr, this.m_sendBuffer);
        let messageBufferToSend = new Uint8Array(this.m_sendBuffer.buffer, 0, byteCount);

        this.SendMessageToO3DEEditor(`ScriptDebugRequest::${request}`, messageBufferToSend);
    }

    public SendScriptDebugSetValue(debugValue: O3DE.DebugValue)
    {
        let sdsv = new O3DE.ScriptDebugSetValue(undefined);
        sdsv.MsgId = BigInt(AZCRC32.AZ_CRC32_STR("ScriptDebugAgent"));
        sdsv.value = debugValue;

        let objStream = new O3DEObjectStream(g_o3deSC);
        let byteCount = objStream.WriteToBuffer(sdsv, this.m_sendBuffer);
        let messageBufferToSend = new Uint8Array(this.m_sendBuffer.buffer, 0, byteCount);

        this.SendMessageToO3DEEditor(`ScriptDebugSetValue`, messageBufferToSend);
    }

    private SendMessageToO3DEEditor(dbgInfo: string, msgBufferView: Uint8Array)
    {
        // This may never occur, but technically a single O3DEPacketRemoteToolsMessage
        // object can only hold a maximum amount of bytes, so we may need to send
        // several of these messages.
        let bytesSentCount = 0;
        while (bytesSentCount < msgBufferView.length)
        {
            let packetSize = Math.min(O3DEPacketRemoteToolsMessage.RemoteToolsMaxBufferSize, msgBufferView.length - bytesSentCount);
            let o3dePacketMsg = new O3DEPacketRemoteToolsMessage(this.m_persistentId, msgBufferView, bytesSentCount, packetSize);
            let rtmBuffer = o3dePacketMsg.GetBuffer();

            // Let's send the header.
            let msgHeader = new O3DETcpHeader(O3DEPacketRemoteToolsMessage.PacketType, rtmBuffer.length);
            let headerBuffer = new Uint8Array(O3DETcpHeader.HeaderSize);
            msgHeader.WriteToBuffer(headerBuffer);
            this.m_socket.write(headerBuffer, (err) => {
                console.error(`Sent Header For ${dbgInfo}, offset=${bytesSentCount}, packetSize=${packetSize}, totalBufferSize=${rtmBuffer.length}, WrappedMessageSize=${msgBufferView.length}`);
                this.OnMessageSentError(err, typeof O3DETcpHeader, O3DETcpHeader.HeaderSize);
            });

            this.m_socket.write(rtmBuffer, (err) => {
                console.error(`Send Message For ${dbgInfo}, offset=${bytesSentCount}, packetSize=${packetSize}, totalBufferSize=${rtmBuffer.length}, WrappedMessageSize=${msgBufferView.length}`);
                this.OnMessageSentError(err, dbgInfo, msgBufferView.length);
            });

            bytesSentCount += packetSize;
        }

        console.log(`Sent [${dbgInfo}] message`);
    }

    private sendEvent(event: string, ... args: any[]): void {
		setTimeout(() => {
			this.emit(event, ...args);
		}, 0);
	}

}

export class O3DERemoteToolsServer extends EventEmitter
{
    private m_tcpSession: O3DETcpSession | null;
    private m_netServer: Net.Server | null;

    constructor(public m_port: number)
    {
        super();
        this.m_netServer = null;
        this.m_tcpSession = null;
    }

    Run() {
        const IP = "127.0.0.1";
        const BACKLOG = 1; // Only one client is supported.
        this.m_netServer = Net.createServer((socket) => {
            console.log(`Accepted connection from client localPort=${socket.localPort}, remotePort=${socket.remotePort}`);
            this.m_tcpSession = new O3DETcpSession(socket);

            this.m_tcpSession.on(O3DEInternalEvents.OnConnectedToEditor, (msgObj: O3DEPacketRemoteToolsConnect ) => {
                this.sendEvent(O3DEInternalEvents.OnConnectedToEditor, msgObj);
            });

            this.m_tcpSession.on(O3DEInternalEvents.OnAttachedToDebugger, () => {
                this.sendEvent(O3DEInternalEvents.OnAttachedToDebugger);
            });

            this.m_tcpSession.on(O3DEInternalEvents.OnBreakpointHit, (editorFilePath: string, line: number) => {
                this.sendEvent(O3DEInternalEvents.OnBreakpointHit, editorFilePath, line);
            });

            this.m_tcpSession.on(O3DEInternalEvents.OnCallstackResult, (callstack: string) => {
                this.sendEvent(O3DEInternalEvents.OnCallstackResult, callstack);
            });

            this.m_tcpSession.on(O3DEInternalEvents.OnEnumLocalsResult, (localVariableNames: string[]) => {
                this.sendEvent(O3DEInternalEvents.OnEnumLocalsResult, localVariableNames);
            });

            this.m_tcpSession.on(O3DEInternalEvents.OnGetValueResult, (variableValue: O3DE.DebugValue) => {
                this.sendEvent(O3DEInternalEvents.OnGetValueResult, variableValue);
            });

            this.m_tcpSession.on(O3DEInternalEvents.OnSetValueResult, (result: O3DE.ScriptDebugSetValueResult) => {
                this.sendEvent(O3DEInternalEvents.OnSetValueResult, result);
            });

            this.m_tcpSession.on(O3DEInternalEvents.OnConnectionError, () => {
                this.sendEvent(O3DEInternalEvents.OnConnectionError);
            });

            this.m_tcpSession.Start();
        });
        this.m_netServer.listen(this.m_port, IP, BACKLOG);
        this.sendEvent(O3DEInternalEvents.OnWaitingForConnection);
    }

    TerminateSession() {
        if (!this.m_tcpSession)
        {
            return;
        }

        this.m_netServer?.close();
        this.m_tcpSession.Terminate();
        this.sendEvent(O3DEInternalEvents.OnSessionTerminated);
        this.m_netServer = null;
        this.m_tcpSession = null;
    }

	private sendEvent(event: string, ... args: any[]): void {
		setTimeout(() => {
			this.emit(event, ...args);
		}, 0);
	}

    public SendAddBreakPointsRequests(breakpointInfo: BreakpointSourceInfo)
    {
        this.m_tcpSession?.SendBreakPointsRequests("AddBreakpoint", breakpointInfo);
    }

    public SendRemoveBreakPointsRequests(breakpointInfo: BreakpointSourceInfo)
    {
        this.m_tcpSession?.SendBreakPointsRequests("RemoveBreakpoint", breakpointInfo);
    }

    public SendGetCallstackRequest()
    {
        this.m_tcpSession?.SendScriptDebugRequest("GetCallstack");
    }

    public SendStepOverRequest()
    {
        this.m_tcpSession?.SendScriptDebugRequest("StepOver");
    }

    public SendStepInRequest()
    {
        this.m_tcpSession?.SendScriptDebugRequest("StepIn");
    }

    public SendStepOutRequest()
    {
        this.m_tcpSession?.SendScriptDebugRequest("StepOut");
    }

    public SendContinueRequest()
    {
        this.m_tcpSession?.SendScriptDebugRequest("Continue");
    }

    public SendEnumLocalsRequest()
    {
        this.m_tcpSession?.SendScriptDebugRequest("EnumLocals");
    }

    public SendGetVariableValueRequest(variableName: string)
    {
        this.m_tcpSession?.SendScriptDebugRequest("GetValue", variableName);
    }

    public SendScriptDebugSetValue(debugValue: O3DE.DebugValue)
    {
        this.m_tcpSession?.SendScriptDebugSetValue(debugValue);
    }
}