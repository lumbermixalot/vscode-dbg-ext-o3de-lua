
/*
 * Copyright (c) lumbermixalot (Galib F. Arrieta)
 * For complete copyright and license terms please see the LICENSE at the root of this distribution.
 *
 * SPDX-License-Identifier: Apache-2.0 OR MIT
 *
 */

// Encapsulates the data and behavior as descirbed in:
// \GIT\o3de\Code\Framework\AzNetworking\AzNetworking\PacketLayer\IPacketHeader.h 
export class O3DETcpHeader
{
    static readonly FlagsOffset = 0;
    static readonly FlagsSize = 1;

    static readonly TypeOffset = O3DETcpHeader.FlagsOffset + O3DETcpHeader.FlagsSize;
    static readonly TypeSize = 2;

    static readonly PacketSizeOffset = O3DETcpHeader.TypeOffset + O3DETcpHeader.TypeSize;
    static readonly PacketSizeSize = 2;

    static readonly HeaderSize = O3DETcpHeader.PacketSizeOffset + O3DETcpHeader.PacketSizeSize;


    private m_packetFlags: number; // One byte
    private m_packetType: number; // Two bytes
    private m_packetSize: number; // Two bytes

    constructor();
    constructor(bufferView: Uint8Array);
    constructor(packetType: number, payloadSize: number);

    constructor(...args: any[])
    {
        this.m_packetFlags = 0;
        this.m_packetType = 0;
        this.m_packetSize = 0;

        if (args.length == 1)
        {
            let bufferView: Uint8Array = args[0];
            this.ReadFromBuffer(bufferView);
        }
        else
        {
            let packetType: number = args[0];
            let payloadSize: number = args[1];

            const MaxUint16 = ((1 << 16) - 1);
            if (packetType > MaxUint16) {
                throw new Error("Invalid Packet Type.");
            }
            this.m_packetType = packetType;
    
            if ((payloadSize + O3DETcpHeader.HeaderSize) > MaxUint16) {
                throw new Error("Invalid Packet Size.");
            }
    
            this.m_packetFlags = 0;
            this.m_packetType = packetType;
            this.m_packetSize = payloadSize;
        }
    }

    GetPacketType() : number
    {
        return this.m_packetType;
    }

    GetPacketSize() : number
    {
        return this.m_packetSize;
    }

    private ReadFromBuffer(bufferView: Uint8Array)
    {
        let dataView = new DataView(bufferView.buffer, bufferView.byteOffset);

        this.m_packetFlags = dataView.getUint8(O3DETcpHeader.FlagsOffset);
        this.m_packetType = dataView.getUint16(O3DETcpHeader.TypeOffset);
        this.m_packetSize = dataView.getUint16(O3DETcpHeader.PacketSizeOffset);
    }

    WriteToBuffer(bufferView: Uint8Array)
    {
        let dataView = new DataView(bufferView.buffer, bufferView.byteOffset);
        dataView.setUint8(O3DETcpHeader.FlagsOffset, this.m_packetFlags);
        dataView.setUint16(O3DETcpHeader.TypeOffset, this.m_packetType);
        dataView.setUint16(O3DETcpHeader.PacketSizeOffset, this.m_packetSize);
    }

}