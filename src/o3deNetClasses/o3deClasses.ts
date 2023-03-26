/*
* Copyright (c) lumbermixalot (Galib F. Arrieta)
* For complete copyright and license terms please see the LICENSE at the root of this distribution.
*
* SPDX-License-Identifier: Apache-2.0 OR MIT
*
*/
///This File Was auto generated with O3DESerializationContestAutogen.
//Do Not Modify as it may get replaced.

export class RemoteToolsMessage {
    public static readonly UUID: string = "{8512328C-949D-4F0C-B48D-77C26C207443}";
    public MsgId: bigint; // cpp (offset, size) = (24, 8)

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        if (!elements) return;
        this.MsgId = elements[0];
    }

    public GetUuid(): string {
        return RemoteToolsMessage.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return [
              this.MsgId
        ];
    }

}


export class DebugValue {
    public static readonly UUID: string = "{C32D1E88-2B8B-432C-91BC-D0B4B135279D}";
    public name: string; // cpp (offset, size) = (0, 24)
    public value: string; // cpp (offset, size) = (24, 24)
    public type: number; // cpp (offset, size) = (48, 1)
    public flags: number; // cpp (offset, size) = (80, 1)
    public elements: DebugValue[]; // cpp (offset, size) = (88, 32)

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        if (!elements) return;
        this.name = elements[0];
        this.value = elements[1];
        this.type = elements[2];
        this.flags = elements[3];
        this.elements = elements[4].map(x => new DebugValue(x));
    }

    public GetUuid(): string {
        return DebugValue.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return [
              this.name
            , this.value
            , this.type
            , this.flags
            , this.elements
        ];
    }

}


export class ScriptDebugSetValue extends RemoteToolsMessage {
    public static readonly UUID: string = "{11E0E012-BD54-457D-A44B-FDDA55736ED3}";
    public value: DebugValue; // cpp (offset, size) = (64, 128)

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        super(elements);
        if (!elements) return;
        this.value = new DebugValue(elements[1]);
    }

    public GetUuid(): string {
        return ScriptDebugSetValue.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return super.GetElementsForSerialization().concat([
              this.value
        ]);
    }

}


export class ScriptUserMethodInfo {
    public static readonly UUID: string = "{32FE4B43-2C23-4AB4-9374-3D13CF050002}";
    public name: string; // cpp (offset, size) = (0, 24)
    public info: string; // cpp (offset, size) = (24, 24)

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        if (!elements) return;
        this.name = elements[0];
        this.info = elements[1];
    }

    public GetUuid(): string {
        return ScriptUserMethodInfo.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return [
              this.name
            , this.info
        ];
    }

}


export class ScriptUserEBusMethodInfo extends ScriptUserMethodInfo {
    public static readonly UUID: string = "{FD805F6C-8612-41CF-85FE-3B97683C98F2}";
    public category: string; // cpp (offset, size) = (48, 24)

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        super(elements);
        if (!elements) return;
        this.category = elements[2];
    }

    public GetUuid(): string {
        return ScriptUserEBusMethodInfo.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return super.GetElementsForSerialization().concat([
              this.category
        ]);
    }

}


export class ScriptUserEBusInfo {
    public static readonly UUID: string = "{2376407E-1621-4D7F-B4AD-DE04A81A2616}";
    public name: string; // cpp (offset, size) = (0, 24)
    public events: ScriptUserEBusMethodInfo[]; // cpp (offset, size) = (24, 32)
    public canBroadcast: boolean; // cpp (offset, size) = (56, 1)
    public canQueue: boolean; // cpp (offset, size) = (57, 1)
    public hasHandler: boolean; // cpp (offset, size) = (58, 1)

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        if (!elements) return;
        this.name = elements[0];
        this.events = elements[1].map(x => new ScriptUserEBusMethodInfo(x));
        this.canBroadcast = elements[2];
        this.canQueue = elements[3];
        this.hasHandler = elements[4];
    }

    public GetUuid(): string {
        return ScriptUserEBusInfo.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return [
              this.name
            , this.events
            , this.canBroadcast
            , this.canQueue
            , this.hasHandler
        ];
    }

}


export class ScriptDebugRegisteredEBusesResult extends RemoteToolsMessage {
    public static readonly UUID: string = "{D2B5D77C-09F3-476D-A611-49B0A1B9EDFB}";
    public EBusses: ScriptUserEBusInfo[]; // cpp (offset, size) = (64, 32)

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        super(elements);
        if (!elements) return;
        this.EBusses = elements[1].map(x => new ScriptUserEBusInfo(x));
    }

    public GetUuid(): string {
        return ScriptDebugRegisteredEBusesResult.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return super.GetElementsForSerialization().concat([
              this.EBusses
        ]);
    }

}


export class AZ_Uuid {
    public static readonly UUID: string = "{E152C105-A133-4D03-BBF8-3D4B2FBA3E2A}";

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        if (!elements) return;
    }

    public GetUuid(): string {
        return AZ_Uuid.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return [
        ];
    }

}


export class ScriptUserPropertyInfo {
    public static readonly UUID: string = "{6CD9F5BE-B2CD-41BB-9DA5-1B053548CF56}";
    public name: string; // cpp (offset, size) = (0, 24)
    public isRead: boolean; // cpp (offset, size) = (24, 1)
    public isWrite: boolean; // cpp (offset, size) = (25, 1)

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        if (!elements) return;
        this.name = elements[0];
        this.isRead = elements[1];
        this.isWrite = elements[2];
    }

    public GetUuid(): string {
        return ScriptUserPropertyInfo.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return [
              this.name
            , this.isRead
            , this.isWrite
        ];
    }

}


export class ScriptUserClassInfo {
    public static readonly UUID: string = "{08B32F99-2EA2-4ABE-A05F-1AA32EF44B15}";
    public name: string; // cpp (offset, size) = (0, 24)
    public type: AZ_Uuid; // cpp (offset, size) = (32, 16)
    public methods: ScriptUserMethodInfo[]; // cpp (offset, size) = (48, 32)
    public properties: ScriptUserPropertyInfo[]; // cpp (offset, size) = (80, 32)

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        if (!elements) return;
        this.name = elements[0];
        this.type = elements[1];
        this.methods = elements[2].map(x => new ScriptUserMethodInfo(x));
        this.properties = elements[3].map(x => new ScriptUserPropertyInfo(x));
    }

    public GetUuid(): string {
        return ScriptUserClassInfo.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return [
              this.name
            , this.type
            , this.methods
            , this.properties
        ];
    }

}


export class ScriptDebugRegisteredClassesResult extends RemoteToolsMessage {
    public static readonly UUID: string = "{7DF455AB-9AB1-4A95-B906-5DB1D1087EBB}";
    public classes: ScriptUserClassInfo[]; // cpp (offset, size) = (64, 32)

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        super(elements);
        if (!elements) return;
        this.classes = elements[1].map(x => new ScriptUserClassInfo(x));
    }

    public GetUuid(): string {
        return ScriptDebugRegisteredClassesResult.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return super.GetElementsForSerialization().concat([
              this.classes
        ]);
    }

}


export class ScriptDebugRequest extends RemoteToolsMessage {
    public static readonly UUID: string = "{2137E01A-F2AE-4137-A17E-6B82F3B7E4DE}";
    public request: number; // cpp (offset, size) = (64, 4)
    public context: string; // cpp (offset, size) = (72, 24)

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        super(elements);
        if (!elements) return;
        this.request = elements[1];
        this.context = elements[2];
    }

    public GetUuid(): string {
        return ScriptDebugRequest.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return super.GetElementsForSerialization().concat([
              this.request
            , this.context
        ]);
    }

}


export class ScriptDebugAckExecute extends RemoteToolsMessage {
    public static readonly UUID: string = "{F5B24F7E-85DA-4FE8-B720-AABE35CE631D}";
    public moduleName: string; // cpp (offset, size) = (64, 24)
    public result: boolean; // cpp (offset, size) = (88, 1)

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        super(elements);
        if (!elements) return;
        this.moduleName = elements[1];
        this.result = elements[2];
    }

    public GetUuid(): string {
        return ScriptDebugAckExecute.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return super.GetElementsForSerialization().concat([
              this.moduleName
            , this.result
        ]);
    }

}


export class ScriptDebugAck extends RemoteToolsMessage {
    public static readonly UUID: string = "{0CA1671A-BAFD-499C-B2CD-7B7E3DD5E2A8}";
    public request: number; // cpp (offset, size) = (64, 4)
    public ackCode: number; // cpp (offset, size) = (68, 4)

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        super(elements);
        if (!elements) return;
        this.request = elements[1];
        this.ackCode = elements[2];
    }

    public GetUuid(): string {
        return ScriptDebugAck.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return super.GetElementsForSerialization().concat([
              this.request
            , this.ackCode
        ]);
    }

}


export class ScriptDebugEnumLocalsResult extends RemoteToolsMessage {
    public static readonly UUID: string = "{201701DD-0B74-4886-AB84-93BDB338A8DD}";
    public names: string[]; // cpp (offset, size) = (64, 32)

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        super(elements);
        if (!elements) return;
        this.names = elements[1];
    }

    public GetUuid(): string {
        return ScriptDebugEnumLocalsResult.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return super.GetElementsForSerialization().concat([
              this.names
        ]);
    }

}


export class ScriptDebugBreakpointRequest extends ScriptDebugRequest {
    public static readonly UUID: string = "{707F97AB-1CA0-4191-82E0-FFE9C9D0F788}";
    public line: number; // cpp (offset, size) = (96, 4)

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        super(elements);
        if (!elements) return;
        this.line = elements[3];
    }

    public GetUuid(): string {
        return ScriptDebugBreakpointRequest.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return super.GetElementsForSerialization().concat([
              this.line
        ]);
    }

}


export class ScriptDebugCallStackResult extends RemoteToolsMessage {
    public static readonly UUID: string = "{B2606AC6-F966-4991-8144-BA6117F4A54E}";
    public callstack: string; // cpp (offset, size) = (64, 24)

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        super(elements);
        if (!elements) return;
        this.callstack = elements[1];
    }

    public GetUuid(): string {
        return ScriptDebugCallStackResult.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return super.GetElementsForSerialization().concat([
              this.callstack
        ]);
    }

}


export class ScriptDebugRegisteredGlobalsResult extends RemoteToolsMessage {
    public static readonly UUID: string = "{CEE4E889-0249-4D59-9D56-CD4BD159E411}";
    public methods: ScriptUserMethodInfo[]; // cpp (offset, size) = (64, 32)
    public properties: ScriptUserPropertyInfo[]; // cpp (offset, size) = (96, 32)

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        super(elements);
        if (!elements) return;
        this.methods = elements[1].map(x => new ScriptUserMethodInfo(x));
        this.properties = elements[2].map(x => new ScriptUserPropertyInfo(x));
    }

    public GetUuid(): string {
        return ScriptDebugRegisteredGlobalsResult.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return super.GetElementsForSerialization().concat([
              this.methods
            , this.properties
        ]);
    }

}


export class ScriptDebugAckBreakpoint extends RemoteToolsMessage {
    public static readonly UUID: string = "{D9644B8A-92FD-43B6-A579-77E123A72EC2}";
    public id: number; // cpp (offset, size) = (64, 4)
    public moduleName: string; // cpp (offset, size) = (72, 24)
    public line: number; // cpp (offset, size) = (96, 4)

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        super(elements);
        if (!elements) return;
        this.id = elements[1];
        this.moduleName = elements[2];
        this.line = elements[3];
    }

    public GetUuid(): string {
        return ScriptDebugAckBreakpoint.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return super.GetElementsForSerialization().concat([
              this.id
            , this.moduleName
            , this.line
        ]);
    }

}


export class ScriptDebugSetValueResult extends RemoteToolsMessage {
    public static readonly UUID: string = "{2E2BD168-1805-43D6-8602-FDE14CED8E53}";
    public name: string; // cpp (offset, size) = (64, 24)
    public result: boolean; // cpp (offset, size) = (88, 1)

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        super(elements);
        if (!elements) return;
        this.name = elements[1];
        this.result = elements[2];
    }

    public GetUuid(): string {
        return ScriptDebugSetValueResult.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return super.GetElementsForSerialization().concat([
              this.name
            , this.result
        ]);
    }

}


export class AZ_Component {
    public static readonly UUID: string = "{EDFCB2CF-F75D-43BE-B26B-F35821B29247}";
    public Id: bigint; // cpp (offset, size) = (16, 8)

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        if (!elements) return;
        this.Id = elements[0];
    }

    public GetUuid(): string {
        return AZ_Component.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return [
              this.Id
        ];
    }

}


export class ScriptDebugAgent extends AZ_Component {
    public static readonly UUID: string = "{624A7BE2-3C7E-4119-AEE2-1DB2BDB6CC89}";

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        super(elements);
        if (!elements) return;
    }

    public GetUuid(): string {
        return ScriptDebugAgent.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return super.GetElementsForSerialization().concat([
        ]);
    }

}


export class ScriptDebugEnumContextsResult extends RemoteToolsMessage {
    public static readonly UUID: string = "{8CE74569-9B7D-4993-AFE8-38BB8CE419F5}";
    public names: string[]; // cpp (offset, size) = (64, 32)

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        super(elements);
        if (!elements) return;
        this.names = elements[1];
    }

    public GetUuid(): string {
        return ScriptDebugEnumContextsResult.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return super.GetElementsForSerialization().concat([
              this.names
        ]);
    }

}


export class ScriptDebugGetValueResult extends RemoteToolsMessage {
    public static readonly UUID: string = "{B10720F1-B8FE-476F-A39D-6E80711580FD}";
    public value: DebugValue; // cpp (offset, size) = (64, 128)

    public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.

    public constructor(elements: any[] | undefined) {
        super(elements);
        if (!elements) return;
        this.value = new DebugValue(elements[1]);
    }

    public GetUuid(): string {
        return ScriptDebugGetValueResult.UUID;
    }

    public GetElementsForSerialization(): any[] {
        return super.GetElementsForSerialization().concat([
              this.value
        ]);
    }

}


