/*
 * Copyright (c) lumbermixalot (Galib F. Arrieta)
 * For complete copyright and license terms please see the LICENSE at the root of this distribution.
 *
 * SPDX-License-Identifier: Apache-2.0 OR MIT
 *
 */

// This application serves one purpose only.
// It generates ../src/o3deNetClasses/o3deClasses.ts from
// ./o3de_classes.json
//
// Also, ./o3de_classes.json was generated with this Gem:
// https://github.com/lumbermixalot/SerializationContextExporter

import o3deClasses from "./o3de_classes.json";
import path from 'path';
import fs from 'fs';

const TAB: string = "    ";

interface O3DEClassElement {
    name: string;
    nameCrc: number;
    isBaseClass: boolean;
    uuid: string;
    cppOffset: number;
    cppSize: number;
    elementIndex: number;
}

interface O3DEClassData {
    name: string;
    uuid: string;
    version: number;
    containerTypes: string[]; // Only when this is a container like AZStd::vector.
    typeSize: number;
    elements: O3DEClassElement[];
}


// Depth-first topological sort
class TopoSorter {
    private m_L: O3DEClassData[];
    private m_unmarkedNodes: Map<string, O3DEClassData>;
    private m_permanentMarkNodes: Map<string, O3DEClassData>;
    private m_temporaryMarkNodes: Map<string, O3DEClassData>;
    private readonly m_classMap: Map<string, O3DEClassData>;

    constructor(classList: O3DEClassData[], classMap: Map<string, O3DEClassData>)
    {
        this.m_L = [];
        this.m_unmarkedNodes = new Map<string, O3DEClassData>();
        for (let o3deClassData of classList)
        {
            this.m_unmarkedNodes.set(o3deClassData.uuid, o3deClassData);
        }
        this.m_permanentMarkNodes = new Map<string, O3DEClassData>();
        this.m_temporaryMarkNodes = new Map<string, O3DEClassData>();
        this.m_classMap = classMap;
    }

    public Sort() : O3DEClassData[] {
        while (this.m_unmarkedNodes.size > 0)
        {
            // Select an unmarked node
            let o3deClassData = this.m_unmarkedNodes.values().next().value;
            this.VisitFunc(o3deClassData);
        }
        return this.m_L;
    }

    private VisitFunc(o3deClassData: O3DEClassData) {
        if (this.m_permanentMarkNodes.has(o3deClassData.uuid))
        {
            return;
        }
        if (this.m_temporaryMarkNodes.has(o3deClassData.uuid))
        {
            console.error(`Not A DAG because of name=${o3deClassData.name}, uuid=${o3deClassData.uuid}`);
            return;
        }

        // mark n with a temporary mark
        this.m_temporaryMarkNodes.set(o3deClassData.uuid, o3deClassData);

        for (let templateTypeUuid of o3deClassData.containerTypes)
        {
            let elementClassData = this.m_classMap.get(templateTypeUuid);
            this.VisitFunc(elementClassData);
        }

        for (let o3deClassElement of o3deClassData.elements)
        {
            let elementClassData = this.m_classMap.get(o3deClassElement.uuid);
            this.VisitFunc(elementClassData);
        }
        this.m_temporaryMarkNodes.delete(o3deClassData.uuid);
        this.m_permanentMarkNodes.set(o3deClassData.uuid, o3deClassData);
        this.m_unmarkedNodes.delete(o3deClassData.uuid)
        this.m_L.push(o3deClassData);
    };

}

class O3DEClassGen
{
    private m_classList: O3DEClassData[];
    private m_classMap: Map<string, O3DEClassData>; // uuid to object map
    private m_exportedClasses: Set<string>; // uuid of exported classes.
    static readonly AZSTD_STRING = "AZStd_string";
    static readonly AZSTD_BASIC_STRING = "AZStd_basic_string";
    static readonly AZSTD_VECTOR_PREFIX = "AZStd_vector_";

    
    constructor()
    {
        this.m_classMap = this.GetClassMap(o3deClasses.classes);
        let topoSorter = new TopoSorter(o3deClasses.classes, this.m_classMap);
        this.m_classList = topoSorter.Sort();
        this.m_exportedClasses = new Set();
    }

    // Returns the number of generated files
    public GenerateFileWithClasses(outputFolderPath: string): number
    {
        let outputFileName = path.join(outputFolderPath, "o3deClasses") + ".ts";
        let outputFd = fs.openSync(outputFileName, 'w', 0o666);

        fs.writeSync(outputFd, "\
/*\n\
* Copyright (c) lumbermixalot (Galib F. Arrieta)\n\
* For complete copyright and license terms please see the LICENSE at the root of this distribution.\n\
*\n\
* SPDX-License-Identifier: Apache-2.0 OR MIT\n\
*\n\
*/\n\
///This File Was auto generated with O3DESerializationContestAutogen.\n//Do Not Modify as it may get replaced.\n\n");

        for (let O3DEClassData of this.m_classList)
        {
            let writtenBytes = this.AddClassToFile(outputFd, O3DEClassData);
            if (writtenBytes < 1)
            {
                console.debug(`The class ${O3DEClassData.name} is a primitive\n`);
                continue;
            }
            this.m_exportedClasses.add(O3DEClassData.uuid);
            //break;
        }
        return this.m_exportedClasses.size;
    }

    private GetClassMap(classList: O3DEClassData[]) : Map<string, O3DEClassData>
    {
        const classMap: Map<string, O3DEClassData> = new Map();
        for (let O3DEClassData of classList)
        {
            classMap.set(O3DEClassData.uuid, O3DEClassData);
        }
        return classMap
    }

    // If there's no subclass it returns an empty string
    private GetSubClassName(o3deClassData: O3DEClassData) : [string, string]
    {
        if (o3deClassData.elements.length < 1)
        {
            return ["", ""];
        }

        if (!(o3deClassData.elements[0].isBaseClass))
        {
            return ["", ""];
        }

        let uuid = o3deClassData.elements[0].uuid;
        if (!this.m_classMap.has(uuid))
        {
            console.error(`class element with uuid ${uuid} not found`)
            return ["", ""];
        }

        let className = this.m_classMap.get(uuid).name.replace("::", "_");

        return [ className, uuid ];
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

    private IsClass(o3deClassData: O3DEClassData) : boolean
    {
        if (o3deClassData.containerTypes.length > 0)
        {
            return false;
        }

        if (o3deClassData.elements.length < 1)
        {
            return false;
        }

        return true;
    }

    private IsVector(o3deClassData: O3DEClassData) : boolean
    {
        let className = o3deClassData?.name;
        if (o3deClassData?.containerTypes.length > 0)
        {
            if (!className.startsWith("AZStd::vector"))
            {
                console.error(`Container of type ${className} is not supported`);
                return false;
            }
            return true;
        }
        return false;
    }

    private IsVectorOfClasses(o3deClassData: O3DEClassData) : boolean
    {
        if (!this.IsVector(o3deClassData))
        {
            return false;
        }

        let typeClassData = this.m_classMap.get(o3deClassData.containerTypes[0]) as O3DEClassData;
        if (!this.IsClass(typeClassData))
        {
            return false;
        }
        return true;
    }

    private GetVectorClassName(o3deClassData: O3DEClassData) : string
    {
        //let templatedClassData = this.m_classMap.get(o3deClassData.containerTypes[0]);
        //return `${O3DEClassGen.AZSTD_VECTOR_PREFIX}${templatedClassData?.name}`;
        let typeScriptTypeName = this.GetTypeScriptTypeName(o3deClassData.containerTypes[0]);
        return `${typeScriptTypeName}[]`;
    }

    private GetTypeScriptTypeName(uuid: string) : string
    {
        let o3deClassData = this.m_classMap.get(uuid) as O3DEClassData;
        if (this.IsVector(o3deClassData))
        {
            return this.GetVectorClassName(o3deClassData);
        }
        if (this.IsString(o3deClassData))
        {
            return "string";
        }

        if (!this.IsPrimitive(o3deClassData))
        {
            return o3deClassData?.name.replace("::", "_");
        }

        switch (o3deClassData?.name)
        {
            case "bool":
                return "boolean";

            case "unsigned int":
            case "int":
            case "unsigned char":
            case "char":
                return "number";

            case "AZ::u64":
                return "bigint";
        }

        console.error(`Can not determine typescript type for ${o3deClassData.name}`);
        return "undefined";
    }

    private GenerateClassString(o3deClassData: O3DEClassData) : string
    {
        let genString = "";

        // Does it inherit from some other class?
        let [subclassName, subclassUuid] = this.GetSubClassName(o3deClassData);

        let className = this.GetTypeScriptTypeName(o3deClassData.uuid);

        genString += `export class ${className}`;
        
        if (subclassName != "")
        {
            genString += ` extends ${subclassName}`;
        }
        genString += ` {\n`;

        let tabs = TAB;
        let members = o3deClassData.elements;
        let memberCount = members.length;
        let startIdx = subclassName == "" ? 0 : 1;

        genString += `${tabs}public static readonly UUID: string = "${o3deClassData.uuid}";\n`;

        // This string will have the block of code that encodes
        // a function that prepares all the data of an instance of
        // the class we are generating for writing to the wire.
        let prepareFuncString: string = `${tabs}public GetElementsForSerialization(): any[] {\n`;
        if (startIdx > 0)
        {
            // This is a subclass.
            prepareFuncString += `${tabs}${tabs}return super.GetElementsForSerialization().concat([\n`;
        }
        else
        {
            // This is not a subclass.
            prepareFuncString += `${tabs}${tabs}return [\n`;
        }

    
        let constructorFuncString = `${tabs}public constructor(elements: any[] | undefined) {\n`;
        if (startIdx > 0) // Needs to call super
        {
            constructorFuncString += `${tabs}${tabs}super(elements);\n`;
        }
        constructorFuncString += `${tabs}${tabs}if (!elements) return;\n`;

        let isFirstElement = true;
        for (let i = startIdx; i < memberCount; i++)
        {
            let member = members[i];
            let typeName = this.GetTypeScriptTypeName(member.uuid);

            let elementClassData = this.m_classMap.get(member.uuid) as O3DEClassData;
            if (this.IsClass(elementClassData))
            {
                constructorFuncString += `${tabs}${tabs}this.${member.name} = new ${elementClassData.name}(elements[${member.elementIndex}]);\n`;
            }
            else if (this.IsVectorOfClasses(elementClassData))
            {
                let typeClassData = this.m_classMap.get(elementClassData.containerTypes[0]) as O3DEClassData;
                constructorFuncString += `${tabs}${tabs}this.${member.name} = elements[${member.elementIndex}].map(x => new ${typeClassData.name}(x));\n`;
            }
            else
            {
                constructorFuncString += `${tabs}${tabs}this.${member.name} = elements[${member.elementIndex}];\n`;
            }

            genString += `${tabs}public ${member.name}: ${typeName}; // cpp (offset, size) = (${member.cppOffset}, ${member.cppSize})\n`;
            prepareFuncString += `${tabs}${tabs}${tabs}`;
            if (isFirstElement)
            {
                prepareFuncString += `  `;
            }
            else
            {
                prepareFuncString += `, `;
            }
            isFirstElement = false;
            prepareFuncString += `this.${member.name}\n`;

        }

        genString += `\n${tabs}public __vscodePrivate: any; // Added for vscode debugger extension book-keeping purposes. Never serialized nor deserialized.\n`;

        constructorFuncString += `${tabs}}\n\n`;

        prepareFuncString += `${tabs}${tabs}]${startIdx > 0 ? ")" : ""};\n${tabs}}\n\n`;

        genString += `\n${constructorFuncString}`;

        genString += `${tabs}public GetUuid(): string {\n`;
        genString += `${tabs}${tabs}return ${className}.UUID;\n`;
        genString += `${tabs}}\n\n`;
        
        genString += prepareFuncString;

        genString += "}\n\n\n";

        return genString;
    }

    // Returns the path of the generated file.
    private AddClassToFile(outputFd: number, o3deClassData: O3DEClassData): number
    {
        if (this.IsPrimitive(o3deClassData) || this.IsString(o3deClassData) || this.IsVector(o3deClassData))
        {
            return 0; // This is ok.
        }
        let classAsStr: string = "";
        try {
            classAsStr = this.GenerateClassString(o3deClassData);
        } catch (err) {
            console.error(err);
            throw err;
        }
        return fs.writeSync(outputFd, classAsStr);
    }
}

let classGen = new O3DEClassGen();
let outputFolderPath: string = "../src/o3deNetClasses";
let fileCount = classGen.GenerateFileWithClasses(outputFolderPath);
console.debug(`Generated ${fileCount} class files.`);





