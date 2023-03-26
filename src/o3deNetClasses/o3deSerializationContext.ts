/*
 * Copyright (c) lumbermixalot (Galib F. Arrieta)
 * For complete copyright and license terms please see the LICENSE at the root of this distribution.
 *
 * SPDX-License-Identifier: Apache-2.0 OR MIT
 *
 */

import o3deClasses from "./o3de_classes.json"

export interface O3DEClassElement {
    name: string;
    nameCrc: number;
    isBaseClass: boolean;
    uuid: string;
    cppOffset: number;
    cppSize: number;
    elementIndex: number;
}

export interface O3DEClassData {
    name: string;
    uuid: string;
    version: number;
    containerTypes: string[];
    typeSize: number;
    elements: O3DEClassElement[];
}

export interface IO3DEClassSerializer {
    // Returns the number of bytes stored in the internal buffer
    GetSerializedSize(data: any) : number;
    WriteToDataView(data: any, dataView: DataView, offset: number);
    ReadDataFromBufferView(classData: O3DEClassData, bufferView: Uint8Array) : any
}

export abstract class O3DEDynamicSerializableField {
    static readonly UUID = "{D761E0C2-A098-497C-B8EB-EA62F5ED896B}";
}

class SCStringSerializer implements IO3DEClassSerializer {

    GetSerializedSize(data: any) : number
    {
        let str: string = <string>(data);
        return str.length;
    }

    WriteToDataView(data: any, dataView: DataView, offset: number)
    {
        let str: string = <string>(data);
        if (str.length < 1)
        {
            return; //An empty string.
        }
        let enc = new TextEncoder();
        let strAsBuffer = enc.encode(str);
        let bufferView = new Uint8Array(dataView.buffer, offset);
        bufferView.set(strAsBuffer);
    }

    ReadDataFromBufferView(classData: O3DEClassData, bufferView: Uint8Array | null) : any
    {
        if (!bufferView)
        {
            return "";
        }
        
        let dec = new TextDecoder();
        let str = dec.decode(bufferView);
        return str;
    }
}

class SCNumberSerializer implements IO3DEClassSerializer {
    public m_numBytes: number;

    constructor()
    {
        this.m_numBytes = 0;
    }

    GetSerializedSize(data: any) : number
    {
        return this.m_numBytes;
    }

    WriteToDataView(data: any, dataView: DataView, offset: number)
    {
        switch (this.m_numBytes)
        {
            case 1: //sizeof(u8):
            {
                //u8 size = static_cast<u8>(element.m_dataSize);
                //m_stream->Write(sizeBytes, &size);
                dataView.setUint8(offset, <number>data);
                break;
            }
            case 2: //sizeof(u16):
            {
                dataView.setUint16(offset, <number>data);
                break;
            }
            case 4: //sizeof(u32):
            {
                dataView.setUint32(offset, <number>data);
                break;
            }
            case 8: //sizeof(AZ::u64)
            {
                dataView.setBigUint64(offset, BigInt(data));
                break;
            }
        }
    }
    
    ReadDataFromBufferView(classData: O3DEClassData, bufferView: Uint8Array) : any
    {
        if (classData.typeSize != bufferView.byteLength)
        {
            let msg = `ReadDataFromBufferView Error: for class ${classData.name}, ${classData.uuid} was expecting buffer size = ${classData.typeSize}, but got ${bufferView.byteLength}`;
            console.error(msg);
            throw new Error(msg);
        }

        let dataView = new DataView(bufferView.buffer);

        switch (this.m_numBytes)
        {
            case 1: //sizeof(u8):
            {
                //u8 size = static_cast<u8>(element.m_dataSize);
                //m_stream->Write(sizeBytes, &size);
                return dataView.getUint8(0);
            }
            case 2: //sizeof(u16):
            {
                return dataView.getUint16(0);
            }
            case 4: //sizeof(u32):
            {
                return dataView.getUint32(0);
            }
            case 8: //sizeof(AZ::u64)
            {
                return dataView.getBigUint64(0);
            }
        }

        let msg = `ReadDataFromBufferView Error: for class ${classData.name}, ${classData.uuid}  got unsupported buffer size = ${classData.typeSize}`;
        console.error(msg);
        throw new Error(msg);
    }
}

// Serves as the database of serializable classes that come from O3DE
// and required for sending/receiving messages between Editor.exe
// and this VSCode Debugger Extension.
export class O3DESerializationContext
{
    private m_classMap: Map<string, O3DEClassData>; // uuid to object map
    private m_stringSerializer: SCStringSerializer;
    private m_numberSerializer: SCNumberSerializer;

    public constructor()
    {
        this.m_classMap = this.GetClassMap(o3deClasses.classes);
        this.m_stringSerializer = new SCStringSerializer();
        this.m_numberSerializer = new SCNumberSerializer();
    }

    public FindClassData(uuid: string): O3DEClassData
    {
        return this.m_classMap.get(uuid);
    }

    public static GetNewClassElement() : O3DEClassElement {
        return {
            name: "",
            nameCrc: 0,
            isBaseClass: false,
            uuid: "",
            cppOffset: 0,
            cppSize: 0,
            elementIndex: -1
        };
    }

    private GetClassMap(classList: O3DEClassData[]) : Map<string, O3DEClassData>
    {
        const classMap: Map<string, O3DEClassData> = new Map();
        for (let classData of classList)
        {
            classMap.set(classData.uuid, classData);
        }
        return classMap;
    }

    private IsString(o3deClassData: O3DEClassData) : boolean
    {
        if (o3deClassData.name === "AZStd::string")
        {
            return true;
        }
        else if (o3deClassData?.name.startsWith("AZStd::basic_string"))
        {
            return true;
        }
        return false;
    }


    private IsPrimitive(o3deClassData: O3DEClassData) : boolean
    {
        if (o3deClassData.typeSize > 8)
        {
            return false;
        }
        if (o3deClassData.containerTypes.length > 0)
        {
            return false;
        }

        if (o3deClassData.elements.length > 0)
        {
            return false;
        }

        return true;
    }

    public GetClassSerializer(o3deClassData: O3DEClassData) : IO3DEClassSerializer | null
    {
        if (this.IsPrimitive(o3deClassData))
        {
            this.m_numberSerializer.m_numBytes = o3deClassData.typeSize;
            return this.m_numberSerializer;
        }
        if (this.IsString(o3deClassData))
        {
            return this.m_stringSerializer;
        }
        return null;
    }

    // @uuid is a string like "{624A7BE2-3C7E-4119-AEE2-1DB2BDB6CC89}"
    public static GetBufferViewFromUuid(uuid: string): Uint8Array
    {
        let buff = new Uint8Array(16);
        for (let byteIdx = 0, offset=1; byteIdx < 4; offset += 2, byteIdx++)
        {
            buff[byteIdx] = parseInt(uuid.substring(offset, offset+2), 16);
        }
        for (let byteIdx = 4, offset=10; byteIdx < 6; offset += 2, byteIdx++)
        {
            buff[byteIdx] = parseInt(uuid.substring(offset, offset+2), 16);
        }
        for (let byteIdx = 6, offset=15; byteIdx < 8; offset += 2, byteIdx++)
        {
            buff[byteIdx] = parseInt(uuid.substring(offset, offset+2), 16);
        }
        for (let byteIdx = 8, offset=20; byteIdx < 10; offset += 2, byteIdx++)
        {
            buff[byteIdx] = parseInt(uuid.substring(offset, offset+2), 16);
        }
        for (let byteIdx = 10, offset=25; byteIdx < 16; offset += 2, byteIdx++)
        {
            buff[byteIdx] = parseInt(uuid.substring(offset, offset+2), 16);
        }  
        return buff;
    }

    // returns a string like "{624A7BE2-3C7E-4119-AEE2-1DB2BDB6CC89}"
    public static GetUuidFromDataView(dataView: DataView, offset: number) : string
    {
        let uuid: string = "{";

        for (let i = 0; i < 16; i++)
        {
            let byte = dataView.getUint8(offset + i);
            let byteStr = byte.toString(16).toUpperCase();
            if (byte < 16)
            {
                byteStr = `0${byteStr}`;
            }
            uuid += byteStr;
            switch(i)
            {
                case 3:
                case 5:
                case 7:
                case 9:
                    uuid += "-";
                    break;    
            }
        }

        uuid += "}";
        return uuid;
    }
}
