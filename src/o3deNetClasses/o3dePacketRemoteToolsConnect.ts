/*
 * Copyright (c) lumbermixalot (Galib F. Arrieta)
 * For complete copyright and license terms please see the LICENSE at the root of this distribution.
 *
 * SPDX-License-Identifier: Apache-2.0 OR MIT
 *
 */

// The data layout and functionality of this class was extracted from:
// Data Sources D:\GIT\o3de\Gems\RemoteTools\Code\Source\AutoGen\RemoteTools.AutoPackets.xml
// D:/GIT/o3de/Code/Framework/AzNetworking/AzNetworking/AutoGen/AutoPackets_Header.jinja;
// \GIT\O3DE\build\External\RemoteTools-91827215\Code\Azcg\Generated\RemoteTools.Private.Static\Source\AutoGen\RemoteTools.AutoPackets.h
//
// The O3DE Editor.exe sends this message to this debugger extension to connect.
import { O3DETcpHeader } from "./o3deTcpHeader";
import { O3DEPacketBase } from "./o3dePacketBase";

export class O3DEPacketRemoteToolsConnect extends O3DEPacketBase
{
    static readonly PacketType: number = 7;

    static readonly CapabilitiesOffset: number = 0;
    static readonly CapabilitiesSize: number = 4;

    static readonly PersistenIdOffset: number = O3DEPacketRemoteToolsConnect.CapabilitiesOffset + O3DEPacketRemoteToolsConnect.CapabilitiesSize;
    static readonly PersistenIdSize: number = 4;

    static readonly DisplayNameSizeOffset: number = O3DEPacketRemoteToolsConnect.PersistenIdOffset + O3DEPacketRemoteToolsConnect.PersistenIdSize;

    public m_capabilities: number; // uint32_t
    public m_persistentId: number; // uint32_t
    public m_displayName: string; // AZStd::string

    constructor();
    constructor(header: O3DETcpHeader, bufferView: Uint8Array);
    constructor(capabilities: number, persistentId: number, displayName: string);

    constructor(...args: any[])
    {
        super();

        this.m_capabilities = 0;
        this.m_persistentId = 0;
        this.m_displayName = "";

        if (args.length == 2)
        {
            let header: O3DETcpHeader = args[0];
            let bufferView: Uint8Array = args[1];

            if (header.GetPacketSize() > bufferView.byteLength)
            {
                console.error(`Can not create O3DEPacketRemoteToolsConnect. Was expecting buffer size to be at least ${header.GetPacketSize()}, but got ${bufferView.byteLength}`);
                return;
            }
            this.ReadFromBuffer(bufferView);
        }
        else
        {
            let capabilities: number = args[0]
            let persistentId: number = args[1]
            let displayName: string = args[2]
            
            this.m_capabilities = capabilities;
            this.m_persistentId = persistentId;
            this.m_displayName = displayName;

            this.m_isValid = true;
            this.m_sizeInBytes = O3DEPacketRemoteToolsConnect.DisplayNameSizeOffset + O3DEPacketBase.CalculateAZStdStringByteSize(this.m_displayName);
        }
    }

    GetPacketType(): number {
        return O3DEPacketRemoteToolsConnect.PacketType;
    }

    GetSizeInBytes(): number {
        return this.m_sizeInBytes;
    }

    IsValid(): boolean {
        return this.m_isValid;
    }

    WriteToBuffer(bufferView: Uint8Array) {
        let dataView = new DataView(bufferView.buffer, bufferView.byteOffset);
        dataView.setUint32(O3DEPacketRemoteToolsConnect.CapabilitiesOffset, this.m_capabilities);
        dataView.setUint32(O3DEPacketRemoteToolsConnect.PersistenIdOffset, this.m_persistentId);
        O3DEPacketBase.WriteAZStdString(dataView, O3DEPacketRemoteToolsConnect.DisplayNameSizeOffset, this.m_displayName);
    }

    private ReadFromBuffer(bufferView: Uint8Array)
    {
        let dataView = new DataView(bufferView.buffer, bufferView.byteOffset);
        let capabilities: number = dataView.getUint32(O3DEPacketRemoteToolsConnect.CapabilitiesOffset);
        let persistentId: number = dataView.getUint32(O3DEPacketRemoteToolsConnect.PersistenIdOffset);

        let [displayName, bytesReadFromDisplayName] = O3DEPacketBase.ParseAZStdString(dataView, O3DEPacketRemoteToolsConnect.DisplayNameSizeOffset);

        this.m_capabilities = capabilities;
        this.m_persistentId = persistentId;
        this.m_displayName = displayName;

        this.m_isValid = true;
        this.m_sizeInBytes = O3DEPacketRemoteToolsConnect.DisplayNameSizeOffset + bytesReadFromDisplayName;
    }

}