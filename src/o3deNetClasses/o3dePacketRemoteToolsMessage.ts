/*
 * Copyright (c) lumbermixalot (Galib F. Arrieta)
 * For complete copyright and license terms please see the LICENSE at the root of this distribution.
 *
 * SPDX-License-Identifier: Apache-2.0 OR MIT
 *
 */

import { O3DETcpHeader } from "./o3deTcpHeader"
import { O3DEPacketBase } from "./o3dePacketBase"

// Messagges sent and received will be split into several O3DEPacketRemoteToolsMessage packets.
// The value of m_totalSize must be the same across all O3DEPacketRemoteToolsMessage packets
// that represent a single message.
// Typically most messages would fit into a single O3DEPacketRemoteToolsMessage.
export class O3DEPacketRemoteToolsMessage extends O3DEPacketBase
{
    static readonly PacketType: number = 8;

    static readonly RemoteToolsMaxBufferSize = 16384 - 384;

    private m_messageBufferSize: number; //uint32_t
    private m_messageBuffer: Uint8Array; // The size must match m_messageBufferSize
    private m_totalSize: number; //uint32_t
    private m_persistentId: number; //uint32_t

    private m_sendBuffer: Uint8Array | null;

    constructor();
    constructor(header: O3DETcpHeader, bufferView: Uint8Array);
    constructor(persistentId: number, msgBufferView: Uint8Array, offset: number, numBytes: number);

    constructor(...args: any[])
    {
        super();

        // Will be created when GetBuffer is called.
        this.m_sendBuffer = null;
        if (args.length == 2)
        {
            let header: O3DETcpHeader = args[0];
            let bufferView: Uint8Array = args[1];

            if (header.GetPacketSize() > bufferView.byteLength)
            {
                console.error(`Can not create O3DEPacketRemoteToolsMessage. Was expecting buffer size to be at least ${header.GetPacketSize()}, but got ${bufferView.byteLength}`);
                return;
            }
            this.ReadFromBuffer(bufferView);
        }
        else if (args.length == 4)
        {
            let persistentId: number = args[0];
            let msgBufferView: Uint8Array = args[1];
            let offset: number = args[2];
            let numBytes: number = args[3];

            this.m_messageBufferSize = numBytes;
            this.m_messageBuffer= new Uint8Array(msgBufferView.buffer, offset, numBytes);
            this.m_totalSize = msgBufferView.length;
            this.m_persistentId = persistentId;

            this.m_sizeInBytes = 4/*this message size*/ + this.m_messageBufferSize + 4/* total message size*/ + 4/*persistentId*/;
            this.m_isValid = true;
        }
    }


    GetPacketType(): number
    {
        return O3DEPacketRemoteToolsMessage.PacketType;
    }

    GetBuffer(): Uint8Array
    {
        if (this.m_sendBuffer) {
            return this.m_sendBuffer;
        }

        this.m_sendBuffer = new Uint8Array(this.m_sizeInBytes);
        this.WriteToBuffer(this.m_sendBuffer);
        return this.m_sendBuffer;
    }

    GetMsgBufferView(): Uint8Array
    {
        return this.m_messageBuffer;
    }


    public HasCompleteMessage(): boolean {
        if (!this.IsValid())
        {
            return false;
        }
        return this.m_messageBufferSize == this.m_totalSize;
    }

    public WriteToBuffer(bufferView: Uint8Array)
    {
        if (!this.IsValid())
        {
            console.error("Invalid O3DEPacketRemoteToolsMessage");
            throw new Error("Invalid O3DEPacketRemoteToolsMessage");
        }

        let dataView = new DataView(bufferView.buffer, bufferView.byteOffset);
        let offset = 0;
        dataView.setUint32(offset, this.m_messageBufferSize);
        offset += 4;
        bufferView.set(this.m_messageBuffer, offset);
        offset += this.m_messageBufferSize;
        dataView.setUint32(offset, this.m_totalSize);
        offset += 4;
        dataView.setUint32(offset, this.m_persistentId);
    }

    private ReadFromBuffer(bufferView: Uint8Array)
    {
        let dataView = new DataView(bufferView.buffer, bufferView.byteOffset);

        let offset = 0;
        this.m_messageBufferSize = dataView.getUint16(0);
        offset += 2;

        let bufferSize2 = dataView.getUint16(offset);
        offset += 2

        if (this.m_messageBufferSize != bufferSize2)
        {
            let msg = `Invalid buffer sizes: ${this.m_messageBufferSize} != ${bufferSize2}`;
            console.error(msg);
            throw new Error(msg);
        }
        
        this.m_messageBuffer = new Uint8Array(this.m_messageBufferSize);
        this.m_messageBuffer.set(new Uint8Array(bufferView.buffer, bufferView.byteOffset + offset, this.m_messageBufferSize));
        offset += this.m_messageBufferSize

        this.m_totalSize = dataView.getUint32(offset);
        offset += 4;

        this.m_persistentId = dataView.getUint32(offset);
        offset += 4;

        this.m_isValid = true;
        this.m_sizeInBytes = offset;
    }
}