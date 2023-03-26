/*
 * Copyright (c) lumbermixalot (Galib F. Arrieta)
 * For complete copyright and license terms please see the LICENSE at the root of this distribution.
 *
 * SPDX-License-Identifier: Apache-2.0 OR MIT
 *
 */

// C:\GIT\o3de\Code\Framework\AzNetworking\AzNetworking\AutoGen\CorePackets.AutoPackets.xml

export abstract class O3DEPacketBase
{
    static readonly MaxUint8 = (1 << 8) - 1;
    static readonly MaxUint16 = (1 << 16) - 1;

    protected m_isValid: boolean;
    protected m_sizeInBytes: number;

    constructor()
    {
        this.m_isValid = false;
        this.m_sizeInBytes = 0;
    }

    public IsValid(): boolean {
        return this.m_isValid;
    }

    public GetSizeInBytes(): number {
        return this.m_sizeInBytes;
    }

    abstract GetPacketType(): number;
    abstract WriteToBuffer(bufferView: Uint8Array);

    // See C:\GIT\o3de\Code\Framework\AzNetworking\AzNetworking\Serialization\NetworkInputSerializer.cpp
    //         template <typename ORIGINAL_TYPE>
    // bool NetworkInputSerializer::SerializeBoundedValue(ORIGINAL_TYPE minValue, ORIGINAL_TYPE maxValue, ORIGINAL_TYPE inputValue)
    public static ParseAZStdString(dataView: DataView, stringOffset: number) : [string, number]
    {
        let stringSize: number = dataView.getUint32(stringOffset);
        let stringSize2: number = dataView.getUint8(stringOffset + 4);
        let stringSize2Size: number = 1;

        if (stringSize > O3DEPacketBase.MaxUint8)
        {
            stringSize2 = dataView.getUint16(stringOffset + 4);
            stringSize2Size = 2;
        }
        else if (stringSize > O3DEPacketBase.MaxUint16)
        {
            console.error(`We do not support deserialization of AZStd::string larger than ${O3DEPacketBase.MaxUint16}`);
            throw new Error(`We do not support deserialization of AZStd::string larger than ${O3DEPacketBase.MaxUint16}`);
        }

        let stringView = new Uint8Array(dataView.buffer, dataView.byteOffset + stringOffset + 4 + stringSize2Size);
        let dec = new TextDecoder();
        let str = dec.decode(stringView);
        if (stringSize != str.length)
        {
            console.error(`stringSize=${stringSize}, but str.length=${str.length}`);
            throw new Error(`stringSize=${stringSize}, but str.length=${str.length}`);
        }
        let totalBytesRead = 4 + stringSize2Size + stringSize;
        return [str, totalBytesRead];
    }

    public static CalculateAZStdStringByteSize(str: string) : number 
    {
        let stringSize = str.length;
        let stringSize2Size = stringSize <= O3DEPacketBase.MaxUint16 ? 1 : 2;
        return 4 + stringSize2Size + stringSize;
    }

    // Returns the byte count written to @dataView. Which should match @CalculateAZStdStringByteSize()
    public static WriteAZStdString(dataView: DataView, stringOffset: number, str: string) : number
    {
        let stringSize = str.length;
        dataView.setUint32(stringOffset, stringSize);
        let writtenBytesCount = 4;
        if (stringSize <= O3DEPacketBase.MaxUint8)
        {
            dataView.setUint8(stringOffset, stringSize);
            writtenBytesCount += 1;
        } 
        else if (stringSize <= O3DEPacketBase.MaxUint16)
        {
            dataView.setUint16(stringOffset, stringSize);
            writtenBytesCount += 2;
        }
        else
        {
            console.error(`We do not support serialization of AZStd::string larger than ${O3DEPacketBase.MaxUint16}`);
            throw new Error(`We do not support serialization of AZStd::string larger than ${O3DEPacketBase.MaxUint16}`);
        }
        let enc = new TextEncoder();
        let strAsBuffer = enc.encode(str);
        let bufferView  = new Uint8Array(dataView.buffer, dataView.byteOffset + writtenBytesCount);
        bufferView.set(strAsBuffer);
        writtenBytesCount += stringSize;
        return writtenBytesCount;
    }
}