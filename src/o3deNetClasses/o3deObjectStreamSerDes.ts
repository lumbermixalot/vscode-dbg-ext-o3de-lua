/*
 * Copyright (c) lumbermixalot (Galib F. Arrieta)
 * For complete copyright and license terms please see the LICENSE at the root of this distribution.
 *
 * SPDX-License-Identifier: Apache-2.0 OR MIT
 *
 */

// This class contains the Serialization & Deserialization
// algorithms used by AZ::ObjectStream.
// o3de\Code\Framework\AzCore\AzCore\Serialization\ObjectStream.cpp
// In particular for Writing:
// ObjectStreamImpl:
// static ObjectStream* Create(IO::GenericStream* stream, SerializeContext& sc, DataStream::StreamType fmt);
// bool WriteClass(const void* classPtr, const Uuid& classId, const SerializeContext::ClassData* classData) override;
// bool WriteElement(const void* elemPtr, const SerializeContext::ClassData* classData, const SerializeContext::ClassElement* classElement);
// bool CloseElement();
// Finalize()
//
// For Reading:
// bool LoadClass(IO::GenericStream& stream, SerializeContext::DataElementNode& convertedClassElement, const SerializeContext::ClassData* parentClassInfo, void* parentClassPtr, int flags);
// bool ReadElement(SerializeContext& sc, const SerializeContext::ClassData*& cd, SerializeContext::DataElement& element, const SerializeContext::ClassData* parent, bool nextLevel, bool isTopElement);
// void SkipElement();

import { AZ_CRC32_STR } from "../o3deCrc32";
import { O3DESerializationContext, O3DEClassData, O3DEClassElement, O3DEDynamicSerializableField, IO3DEClassSerializer } from "./o3deSerializationContext";

export interface O3DENetObject
{
    GetUuid(): string;
    GetElementsForSerialization(): any[];
}

// This class is used during CreateInstanceFromBuffer
class O3DENetObjectHolder implements O3DENetObject
{
    public m_uuid: string;
    public m_elements: any[];

    constructor()
    {
        this.m_uuid = "";
        this.m_elements = [];
    }

    GetUuid() : string
    {
        return this.m_uuid;
    }

    GetElementsForSerialization(): any[]
    {
        return this.m_elements
    }
}

// These are written with every data element. Note that the size can be
// encoded in the flags if it is < 7 (this optimizes the common case 
// of size=4). If new flags are required, they will need to be packed
// into the extra size field
const enum eBinaryFlags
{
    ST_BINARYFLAG_MASK              = 0xF8, // upper-5 bits of a byte
    ST_BINARY_VALUE_SIZE_MASK       = 0x7,  // lower 3 bits of a byte. If ST_BINARYFLAG_EXTRA_SIZE_FIELD is set, contains the size of the size field, otherwise contains the size of the value chunk.
    ST_BINARYFLAG_ELEMENT_HEADER    = 1 << 3,
    ST_BINARYFLAG_HAS_VALUE         = 1 << 4,
    ST_BINARYFLAG_EXTRA_SIZE_FIELD  = 1 << 5,
    ST_BINARYFLAG_HAS_NAME          = 1 << 6,
    ST_BINARYFLAG_HAS_VERSION       = 1 << 7,
    ST_BINARYFLAG_ELEMENT_END       = 0
};


enum eDataType
{
    DT_TEXT,        ///< data points to a string representation of the data
    DT_BINARY,      ///< data points to a binary representation of the data in native endian
    DT_BINARY_BE,   ///< data points to a binary representation of the data in big endian
};


class O3DEDataElement
{
    public m_name: string;         ///< Name of the parameter, they must be unique with in the scope of the class.
    public m_nameCrc: number;      ///< u32 CRC32 of name
    public m_dataType: eDataType;     ///< What type of data, if we have any.
    public m_uuid: string;  ///< Reference ID, the meaning can change depending on what are we referencing.
    public m_version: number;  ///< unsigned int Version of data in the stream. This can be the current version or older. Newer version will be handled internally.
    public m_dataSize: number; ///< size_t Size of the data pointed by "data" in bytes.
    public m_dataAsBuffer: Uint8Array | null; // Used only when loading class instances from a stream.

    constructor() {
        this.m_name = "";
        this.m_nameCrc = 0;
        this.m_dataType = eDataType.DT_BINARY;
        this.m_uuid = "";
        this.m_version = 0;
        this.m_dataSize = 0;
        this.m_dataAsBuffer = null; 
    }
}

export class O3DEObjectStream
{
    static readonly s_binaryStreamTag: number = 0;
    static readonly s_objectStreamVersion: number = 3;

    private m_dataView: DataView;
    private m_writeOffset: number;
    private m_readOffset: number;
    private m_netObjectHolder: O3DENetObjectHolder | null;
    private m_sc: O3DESerializationContext;

    constructor(sc: O3DESerializationContext)
    {
        this.m_writeOffset = 0;
        this.m_readOffset = 0;
        this.m_netObjectHolder = null;
        this.m_sc = sc;
    }

    public WriteToBuffer(o3deObject: O3DENetObject, bufferView: Uint8Array) : number
    {
        this.m_writeOffset = 0;
        this.m_dataView = new DataView(bufferView.buffer, bufferView.byteOffset);

        this.WriteHeader();
        this.WriteClass(o3deObject, o3deObject.GetUuid());
        this.WriteEndOfHeader();

        return this.m_writeOffset;
    }

    public CreateInstanceFromBuffer(bufferView: Uint8Array) : O3DENetObject | null
    {
        this.m_readOffset = 0;
        this.m_dataView = new DataView(bufferView.buffer, bufferView.byteOffset);
        this.m_netObjectHolder = new O3DENetObjectHolder();

        if (!this.ReadHeader())
        {
            return null;
        }

        let deserializedElements: any[] = []
        if (!this.ReadClass(null, deserializedElements))
        {
            return null;
        }

        return this.m_netObjectHolder;
    }

    // Returns the number of bytes written as header data.
    private WriteHeader()
    {
        this.m_dataView?.setUint8(this.m_writeOffset, O3DEObjectStream.s_binaryStreamTag);
        this.m_writeOffset += 1;
        this.m_dataView?.setUint32(this.m_writeOffset, O3DEObjectStream.s_objectStreamVersion);
        this.m_writeOffset += 4;
    }

    private ReadHeader() : boolean
    {
        let streamTag: number = this.m_dataView?.getUint8(this.m_readOffset);
        if (streamTag != O3DEObjectStream.s_binaryStreamTag)
        {
            console.error(`Was expecting streamTag to be ${O3DEObjectStream.s_binaryStreamTag}, instead got ${streamTag}`);
            return false;
        }
        this.m_readOffset += 1;

        let version: number = this.m_dataView?.getUint32(this.m_readOffset);
        if (version != O3DEObjectStream.s_objectStreamVersion)
        {
            console.error(`Was expecting streamVersion to be ${O3DEObjectStream.s_objectStreamVersion}, instead got ${version}`);
            return false;
        } 
        this.m_readOffset += 4;

        return true;
    }

    private WriteClass(o3deObject: O3DENetObject, o3deClassUuid: string, o3deClassData: O3DEClassData | null = null) : boolean
    {
        return this.WriteEnumerateInstanceRecursive(o3deObject, o3deClassUuid, o3deClassData, null);
    }

    private ReadClass(parentClassInfo: O3DEClassData | null, deserializedElements: any[]): boolean
    {
        while (true)
        {
            let classData: O3DEClassData | null = null;
            let dataElement: O3DEDataElement | null = null;
            let resultTuple = this.ReadElement();
            if (resultTuple == null)
            {
                // we have reached the end of this branch, so exit the loop
                break;
            }
            [ classData, dataElement] = resultTuple;
            
            let classElement: O3DEClassElement | null = null;
            let classIsContainer = classData.containerTypes.length > 0;
            let parentClassIsContainer = false;

            // Let's find the ClassElement.
            if (parentClassInfo)
            {
                parentClassIsContainer = parentClassInfo.containerTypes.length > 0;
                if (!parentClassIsContainer)
                {
                    for (let i in parentClassInfo.elements)
                    {
                        let childElement = parentClassInfo.elements[i];
                        if (childElement.nameCrc === dataElement.m_nameCrc)
                        {
                            if (childElement.uuid === dataElement.m_uuid)
                            {
                                classElement = childElement;
                            }
                            break;
                        }
                    }
                    if ( classElement == null )
                    {
                        continue;
                    }
                }
            }
            else
            {
                let numClassElements = classData.elements.length;
                let lastClassElement = classData.elements[numClassElements - 1];
                let numElementsToDeserialize = lastClassElement.elementIndex + 1;
                deserializedElements = Array(numElementsToDeserialize).fill(null).map((u, i) => u);
                this.m_netObjectHolder.m_uuid = classData.uuid;
                this.m_netObjectHolder.m_elements = deserializedElements;
            }

            // Let's just read the data.
            let classSerializer: IO3DEClassSerializer | null = this.m_sc.GetClassSerializer(classData);
            if (classSerializer)
            {
                let dataValue: any = classSerializer.ReadDataFromBufferView(classData, dataElement.m_dataAsBuffer);
                if (parentClassIsContainer)
                {
                    deserializedElements.push(dataValue);
                }
                else
                {
                    deserializedElements[classElement.elementIndex] = dataValue;
                }
            }
            else if (parentClassIsContainer)
            {
                let numClassElements = classData.elements.length;
                let lastClassElement = classData.elements[numClassElements - 1];
                let numElementsToDeserialize = lastClassElement.elementIndex + 1;
                let newArray = Array(numElementsToDeserialize).fill(null).map((u, i) => u);
                deserializedElements.push(newArray);
                this.ReadClass(classData, newArray);
                continue;
            }
            
            if (classIsContainer)
            {
                if (!classElement)
                {
                    console.error("Disaster 1!");
                }
                let newArray = [];
                deserializedElements[classElement.elementIndex] = newArray;
                this.ReadClass(classData, newArray);
            }
            else
            {
                // Let's check first if we found a new non primitive element.
                if (parentClassInfo && (classData.elements.length > 0))
                {
                    if (classElement && !(classElement.isBaseClass))
                    {
                        let numClassElements = classData.elements.length;
                        let lastClassElement = classData.elements[numClassElements - 1];
                        let numElementsToDeserialize = lastClassElement.elementIndex + 1;
                        let newArray = Array(numElementsToDeserialize).fill(null).map((u, i) => u);
                        deserializedElements[classElement.elementIndex] = newArray;
                        this.ReadClass(classData, newArray);
                        continue;
                    }
                }

                // Just keep adding elements
                this.ReadClass(classData, deserializedElements);
            }

            if (!parentClassInfo)
            {
                parentClassInfo = classData;
            }
        }

        return true;
    }

    // const SerializeContext::ClassData*& cd, SerializeContext::DataElement& element,
    // const SerializeContext::ClassData* parent, bool nextLevel, bool isTopElement
    private ReadElement() : [O3DEClassData, O3DEDataElement] | null
    {
        let flagsSize: number = this.m_dataView?.getUint8(this.m_readOffset);
        this.m_readOffset += 1;

        if (flagsSize == eBinaryFlags.ST_BINARYFLAG_ELEMENT_END)
        {
            return null;
        }

        if (!(flagsSize & eBinaryFlags.ST_BINARYFLAG_ELEMENT_HEADER))
        {
            let msg = "ReadClass Error: the flags must be an element header.";
            console.error(msg);
            throw new Error(msg);
        }

        let dataElement = new O3DEDataElement();
        if (flagsSize & eBinaryFlags.ST_BINARYFLAG_HAS_NAME)
        {
            dataElement.m_nameCrc =  this.m_dataView?.getUint32(this.m_readOffset);
            this.m_readOffset += 4;
        }

        if (flagsSize & eBinaryFlags.ST_BINARYFLAG_HAS_VERSION)
        {
            dataElement.m_version = this.m_dataView?.getUint8(this.m_readOffset);
            this.m_readOffset += 1;
        }

        dataElement.m_uuid = O3DESerializationContext.GetUuidFromDataView(this.m_dataView, this.m_readOffset);
        let classData: O3DEClassData|null  = this.m_sc.FindClassData(dataElement.m_uuid);
        if (!classData)
        {
            let msg = `ReadClass Error: Got an unknown uuid=${dataElement.m_uuid}`;
            console.error(msg);
            throw new Error(msg);
        }
        this.m_readOffset += 16;

        if (flagsSize & eBinaryFlags.ST_BINARYFLAG_HAS_VALUE)
        {
            if (flagsSize & eBinaryFlags.ST_BINARYFLAG_EXTRA_SIZE_FIELD)
            {
                let bytesToRead = flagsSize & eBinaryFlags.ST_BINARY_VALUE_SIZE_MASK;
                switch (bytesToRead)
                {
                    case 1:
                        dataElement.m_dataSize = this.m_dataView?.getUint8(this.m_readOffset);
                        break;
                    case 2:
                        dataElement.m_dataSize = this.m_dataView?.getUint16(this.m_readOffset);
                        break;
                    case 4:
                        dataElement.m_dataSize = this.m_dataView?.getUint32(this.m_readOffset);
                        break;
                    default:
                        let msg = `ReadClass Error: Invalid bytesToRead=${bytesToRead}`;
                        console.error(msg);
                        throw new Error(msg);
                }
                this.m_readOffset += bytesToRead;
            }
            else
            {
                dataElement.m_dataSize = flagsSize & eBinaryFlags.ST_BINARY_VALUE_SIZE_MASK;
            }
            
            if (dataElement.m_dataSize > 0)
            {
                dataElement.m_dataAsBuffer = new Uint8Array(dataElement.m_dataSize);
                let tmpView = new Uint8Array(this.m_dataView.buffer, this.m_readOffset, dataElement.m_dataSize);
                dataElement.m_dataAsBuffer.set(tmpView);
                this.m_readOffset += dataElement.m_dataSize;
            }
        }

        return [classData, dataElement];

    } // End of ReadElement


    private WriteEnumerateInstanceRecursive(data: any, o3deClassUuid: string
        , o3deClassData: O3DEClassData | null, o3deClassElement: O3DEClassElement | null) : boolean
    {
        let dataClassInfo = o3deClassData;

        if (!dataClassInfo)
        {
            dataClassInfo = this.m_sc.FindClassData(o3deClassUuid);
        }

        if (!dataClassInfo)
        {
            console.error(`Failed to find ClassData for uuid:${o3deClassUuid}`);
            return false;
        }

        this.WriteElement(data, dataClassInfo, o3deClassElement);
        let keepEnumeratingSiblings = true;

        if (dataClassInfo.containerTypes.length > 0)
        {
            this.WriteContainer(data, dataClassInfo);
        }
        else 
        {
            let numClassElements = dataClassInfo.elements.length;
            if (numClassElements > 0)
            {
                let o3deObject = <O3DENetObject>data;
                let objectElements: any[] = o3deObject.GetElementsForSerialization();
                for (let i = 0; i < numClassElements; i++)
                {
                    let classElement: O3DEClassElement = dataClassInfo.elements[i];
                    let elementClassInfo: O3DEClassData = this.m_sc.FindClassData(classElement.uuid);
                    if (classElement.isBaseClass)
                    {
                        keepEnumeratingSiblings = this.WriteEnumerateInstanceRecursive(data, classElement.uuid, elementClassInfo, classElement);
                    }
                    else
                    {
                        let elementObject: any = objectElements[classElement.elementIndex];
                        //let elementClassInfo: O3DEClassData = ce.m_genericClassInfo ? ce.m_genericClassInfo.GetClassData() : this.m_sc.FindClassData(ce.m_typeId, dataClassInfo, ce.m_nameCrc);
                        keepEnumeratingSiblings = this.WriteEnumerateInstanceRecursive(elementObject, classElement.uuid, elementClassInfo, classElement);
                    }
                    if (!keepEnumeratingSiblings)
                    {
                        break;
                    }    
                }
            }

            if (dataClassInfo.uuid === O3DEDynamicSerializableField.UUID)
            {
                console.error("O3DEDynamicSerializableField not supported yet!");
            }
        }

        keepEnumeratingSiblings = this.WriteEndOfElement();
        return keepEnumeratingSiblings;
    }

    private WriteContainer(data: any,  o3deClassData: O3DEClassData) : boolean
    {
        let o3deClassElement: O3DEClassElement = {
            name: "element",
            nameCrc: AZ_CRC32_STR("element"),
            isBaseClass: false,
            uuid: o3deClassData.containerTypes[0],
            cppOffset: 0,
            cppSize: 0,
            elementIndex: 0
        };
        let dataAsArray = data as any[];
        let dataIdx = 0;
        for (let dataObj of dataAsArray)
        {
            o3deClassElement.elementIndex = dataIdx;
            this.WriteEnumerateInstanceRecursive(dataObj, o3deClassData.containerTypes[0], null, o3deClassElement);
            dataIdx++;
        }

        return true;
    }

    private WriteElement(data: any, o3deClassData: O3DEClassData | null, o3deClassElement: O3DEClassElement | null) : boolean
    {
        let dataElement = new O3DEDataElement();
        if (o3deClassElement)
        {
            dataElement.m_name = o3deClassElement.name;
            dataElement.m_nameCrc = o3deClassElement.nameCrc;
        }

        dataElement.m_uuid = o3deClassData?.uuid;
        dataElement.m_version = o3deClassData?.version;
        dataElement.m_dataSize = 0;

        let classSerializer: IO3DEClassSerializer | null = this.m_sc.GetClassSerializer(o3deClassData);
        if (classSerializer)
        {
            // Figure out how many bytes will eventually
            // be written.
            dataElement.m_dataSize = classSerializer.GetSerializedSize(data);
        }

        let flagsSize = eBinaryFlags.ST_BINARYFLAG_ELEMENT_HEADER;
        if (dataElement.m_nameCrc)
        {
            flagsSize |= eBinaryFlags.ST_BINARYFLAG_HAS_NAME;
        }
        if (classSerializer)
        {
            flagsSize |= eBinaryFlags.ST_BINARYFLAG_HAS_VALUE;
            if (dataElement.m_dataSize < 8)
            {
                flagsSize |= dataElement.m_dataSize;
            }
            else
            {
                flagsSize |= eBinaryFlags.ST_BINARYFLAG_EXTRA_SIZE_FIELD;
                if (dataElement.m_dataSize < 0x100)
                {
                    flagsSize |= 1; //sizeof(u8);
                }
                else if (dataElement.m_dataSize < 0x10000)
                {
                    flagsSize |= 2; //sizeof(u16);
                }
                else if (dataElement.m_dataSize < 0x100000000)
                {
                    flagsSize |= 4; //sizeof(u32);
                }
                else
                {
                    console.error(`We don't have enough bits to store a value size of ${dataElement.m_dataSize}`);
                    return false;
                }
            }
        }
        if (dataElement.m_version)
        {
            flagsSize |= eBinaryFlags.ST_BINARYFLAG_HAS_VERSION;
        }
        this.m_dataView?.setUint8(this.m_writeOffset, flagsSize);
        this.m_writeOffset += 1;

        // Write name
        if (dataElement.m_nameCrc)
        {
            //u32 nameCrc = element.m_nameCrc;
            //AZStd::endian_swap(nameCrc);
            this.m_dataView?.setUint32(this.m_writeOffset, dataElement.m_nameCrc);
            this.m_writeOffset += 4
        }

        // Write version
        if (dataElement.m_version)
        {
            if (dataElement.m_version >= 0x100)
            {
                console.error("element.version is too high for the current binary format!");
                return false;
            }
            this.m_dataView?.setUint8(this.m_writeOffset, dataElement.m_version);
            this.m_writeOffset += 1;
        }

        // Write Uuid
        let uuidAsBufferView = O3DESerializationContext.GetBufferViewFromUuid(dataElement.m_uuid);
        for (let i = 0; i < uuidAsBufferView.byteLength; i++)
        {
            this.m_dataView?.setUint8(this.m_writeOffset, uuidAsBufferView[i]);
            this.m_writeOffset++;
        }

        // Write value
        if (classSerializer)
        {
            // Write extra size field if necessary
            if (flagsSize & eBinaryFlags.ST_BINARYFLAG_EXTRA_SIZE_FIELD)
            {
                let sizeBytes = flagsSize & eBinaryFlags.ST_BINARY_VALUE_SIZE_MASK;
                switch (sizeBytes)
                {
                    case 1: //sizeof(u8):
                    {
                        this.m_dataView?.setUint8(this.m_writeOffset, dataElement.m_dataSize);
                        break;
                    }
                    case 2: //sizeof(u16):
                    {
                        this.m_dataView?.setUint16(this.m_writeOffset, dataElement.m_dataSize);
                        break;
                    }
                    case 4: //sizeof(u32):
                    {
                        this.m_dataView?.setUint32(this.m_writeOffset, dataElement.m_dataSize);
                        break;
                    }
                }
                this.m_writeOffset += sizeBytes;
            }

            if (dataElement.m_dataSize)
            {
                classSerializer.WriteToDataView(data, this.m_dataView, this.m_writeOffset);
                this.m_writeOffset += dataElement.m_dataSize;
            }

        }
        return true;

    } // End of WriteElement

    private WriteEndOfElement() : boolean
    {
        this.m_dataView?.setUint8(this.m_writeOffset, eBinaryFlags.ST_BINARYFLAG_ELEMENT_END);
        this.m_writeOffset += 1;
        return true;
    }

    private WriteEndOfHeader() : boolean
    {
        return this.WriteEndOfElement();
    }

 }
 