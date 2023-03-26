/*
 * Copyright (c) lumbermixalot (Galib F. Arrieta)
 * For complete copyright and license terms please see the LICENSE at the root of this distribution.
 *
 * SPDX-License-Identifier: Apache-2.0 OR MIT
 *
 */

import { DebugProtocol } from '@vscode/debugprotocol';

import { DebugValue as O3DEDebugVariable } from './o3deNetClasses/o3deClasses';

// From ~\.o3de\3rdParty\packages\Lua-5.4.4-rev1-windows\Lua\include\Lua\lua.h
enum O3DELuaTypes
{
    LUA_TNIL = 0,
    LUA_TBOOLEAN = 1,
    LUA_TLIGHTUSERDATA = 2,
    LUA_TNUMBER	= 3,
    LUA_TSTRING = 4,
    LUA_TTABLE = 5,
    LUA_TFUNCTION = 6,
    LUA_TUSERDATA = 7,
    LUA_TTHREAD = 8,
    LUA_NUMTYPES = 9
}

const g_LuaTypesStr: string[] = [ 
    "nil",
    "bool",
    "luserdata",
    "number",
    "str",
    "table",
    "function",
    "userdata",
    "thread"
];

function GetLuaTypeAsString(luaType: number)
{
    if ((luaType < 0) || (luaType >= O3DELuaTypes.LUA_NUMTYPES))
    {
        return "N/A";
    }
    return g_LuaTypesStr[luaType];
}

function GetPresentationHint(variableValue: O3DEDebugVariable, isParentUserData: boolean = false, isMember: boolean = false) : DebugProtocol.VariablePresentationHint
{
    let kind: string = "";
    let attributes: string[] = [];
    let visibility: string = 'public';

    if (variableValue.name.startsWith("_"))
    {
        visibility = 'private';
    }

    // The O3DE Lua VM doesn't know how to update the value
    // of properties from an object (userdata) that is actually
    // a C++ object. The code in: /o3de/Code/Framework/AzCore/AzCore/Script/ScriptContextDebug.cpp
    // does a rudimentary algorithm that only works well for native LUA primitives and tables.
    // But userdata changes would require some intelligence in ScriptContextDebug.cpp to communicate
    // changes to the C++ objects. This is why we force here as 'readonly' the
    // properties of userdata elements.
    if (isParentUserData || (variableValue.flags & 1))
    {
        attributes.push('readonly');
    }
    
    switch(variableValue.type)
    {
        case O3DELuaTypes.LUA_TNIL:
            kind = isMember ? 'property' : 'data';
            break;
        case O3DELuaTypes.LUA_TBOOLEAN:
            kind = isMember ? 'property' : 'data';
            break;
        case O3DELuaTypes.LUA_TLIGHTUSERDATA:
            kind = isMember ? 'property' : 'data';
            break;
        case O3DELuaTypes.LUA_TNUMBER:
            kind = isMember ? 'property' : 'data';
            break;
        case O3DELuaTypes.LUA_TSTRING:
            kind = isMember ? 'property' : 'data';
            break;
        case O3DELuaTypes.LUA_TTABLE:
            kind = isMember ? 'property' : 'data';
            break;
        case O3DELuaTypes.LUA_TFUNCTION:
            kind = 'method';
            break;
        case O3DELuaTypes.LUA_TUSERDATA:
            kind = isMember ? 'property' : 'data';
            break;
        case O3DELuaTypes.LUA_TTHREAD:
            kind = isMember ? 'property' : 'data';
            break;
    }

    let hint: DebugProtocol.VariablePresentationHint = {
        kind: kind,
        attributes: attributes,
        visibility: visibility,
        lazy: false
    };

    return hint;
}

export class DebugVariablesManager
{
    private m_rootLocalVariablesMap: Map<string, number | null>;
    private m_rootLocalVariablesList: DebugProtocol.Variable[];

    // Contains all the variables and their children mapped
    // to a unique number (aka variableReference). 
    private m_referencedVariablesMap: Map<number, O3DEDebugVariable>;

    // Key: The variableReference number of an O3DEDebugVariable.
    // Value: The variableReference number of its parent O3DEDebugVariable.
    // If a key is not found here, it means the O3DEDebugVariable is a root variable.
    private m_childToParentMap: Map<number, number>;

    
    constructor()
    {
        this.m_rootLocalVariablesMap = new Map<string, number | null>();
        this.m_rootLocalVariablesList = [];

        this.m_referencedVariablesMap = new Map<number, O3DEDebugVariable>();
        this.m_childToParentMap = new Map<number, number>();
    }

    public HasAllVariableData()
    {
        if (this.m_rootLocalVariablesList.length < 1)
        {
            return false;
        }
        return this.m_rootLocalVariablesList.length == this.m_rootLocalVariablesMap.size;
    }

    public Invalidate()
    {
        this.m_rootLocalVariablesMap.clear();
        this.m_rootLocalVariablesList = [];

        this.m_referencedVariablesMap.clear();
        this.m_childToParentMap.clear();
    }

    public GetRootVariableReferenceNumber(debugVariable: O3DEDebugVariable): number | null
    {
        return this.m_rootLocalVariablesMap.get(debugVariable.name) as number | null;
    }

    public PrepareDebugVariableList(variableNames: string[])
    {
        this.Invalidate();
        for (let varName of variableNames)
        {
            this.m_rootLocalVariablesMap.set(varName, null);
        }
    }

    private GetO3deDebugVariableAsDebugProtocolVariable(variableReference: number, debugVariable: O3DEDebugVariable, parentVariable: O3DEDebugVariable | undefined) : DebugProtocol.Variable
    {
        let isParentUserData = parentVariable ?
                               (parentVariable.type == O3DELuaTypes.LUA_TUSERDATA)
                               || (parentVariable.type == O3DELuaTypes.LUA_TLIGHTUSERDATA) 
                               : false;
        let isMember = parentVariable ? true : false;
        let dpVariable: DebugProtocol.Variable = {
            name: debugVariable.name,
            value: debugVariable.value,
            type: GetLuaTypeAsString(debugVariable.type),
            variablesReference: variableReference,
            namedVariables:  debugVariable.elements.length,
            presentationHint: GetPresentationHint(debugVariable, isParentUserData, isMember),
        };

        return dpVariable;
    }

    public Update(varRefGenFunc: (debugVariable: O3DEDebugVariable) => number, debugVariable: O3DEDebugVariable)
    {
        if (!this.m_rootLocalVariablesMap.has(debugVariable.name))
        {
            console.error(`DebugVariablesManager Was not prepared to receive variable with name=${debugVariable.name}`);
            return;
        }

        let variableReference: number = varRefGenFunc(debugVariable);
        this.m_rootLocalVariablesMap.set(debugVariable.name, variableReference);
        this.m_referencedVariablesMap.set(variableReference, debugVariable);
        debugVariable.__vscodePrivate = variableReference;

        let dpVariable = this.GetO3deDebugVariableAsDebugProtocolVariable(variableReference, debugVariable, undefined);

        this.m_rootLocalVariablesList.push(dpVariable);     
    }

    public GetDebugProtocolVariables(varRefGenFunc: (debugVariable: O3DEDebugVariable) => number, args?: DebugProtocol.VariablesArguments) : DebugProtocol.Variable[]
    {
        if (!args)
        {
            return this.m_rootLocalVariablesList;
        }

        console.log(`GetDebugProtocolVariables: variablesReference=${args.variablesReference}, \
                    start=${args.start ? args.start : 0}, count=${args.count ? args.count : "MAX"}, \
                    filter=${args.filter ? args.filter : "NoFilter"}, \
                    format=${args.format ? (args.format.hex ? "HEX" : "DEC") : "NoFormat"}`);
        
        if (!this.m_referencedVariablesMap.has(args.variablesReference))
        {
            console.error(`GetDebugProtocolVariables Error: I don't have a variableReference=${args.variablesReference}`);
            return [];
        }

        let retList: DebugProtocol.Variable[] = [];
        let parentDVvariableReference = args.variablesReference;
        let parentDV = this.m_referencedVariablesMap.get(parentDVvariableReference) as O3DEDebugVariable;
        for (let dv of parentDV.elements)
        {
            let newVariableReference = varRefGenFunc(dv);
            let dpVariable = this.GetO3deDebugVariableAsDebugProtocolVariable(newVariableReference, dv, parentDV);
            retList.push(dpVariable);

            this.m_referencedVariablesMap.set(newVariableReference, dv);
            dv.__vscodePrivate = newVariableReference;
            this.m_childToParentMap.set(newVariableReference, parentDVvariableReference);
        }
        return retList;
    }

    private NewDebugVariableShallowCopy(debugVariable: O3DEDebugVariable)
    {
        let newCopy = new O3DEDebugVariable(undefined);
        newCopy.name = debugVariable.name;
        newCopy.value = debugVariable.value;
        newCopy.type = debugVariable.type;
        newCopy.flags = debugVariable.flags;
        newCopy.elements = [];
        newCopy.__vscodePrivate = debugVariable.__vscodePrivate;
        return newCopy;
    }

    private IsReadOnly(debugVariable: O3DEDebugVariable): boolean
    {
        switch(debugVariable.type)
        {
            case O3DELuaTypes.LUA_TLIGHTUSERDATA:
            case O3DELuaTypes.LUA_TTABLE:
            case O3DELuaTypes.LUA_TFUNCTION:
            case O3DELuaTypes.LUA_TUSERDATA:
            case O3DELuaTypes.LUA_TTHREAD:
            return true;
        }
        return false;
    }

    // args.referenceVariable is the number of the parent property
    // while args.name is the name of the actual sub property that is being modified.
    public GetModifiedDebugVariableRootCopy(args: DebugProtocol.SetVariableArguments): [number, O3DEDebugVariable, O3DEDebugVariable] | null
    {
        // Get the O3DEDebugVariable.
        let debugVariable: O3DEDebugVariable | null = null;
        let debugVariableReference: number = 0;
        let parentVariableReference = args.variablesReference;
        let parentDebugVariable = this.m_referencedVariablesMap.get(parentVariableReference) as O3DEDebugVariable;
        if (!parentDebugVariable)
        {
            // The user is trying to modify a root variable that doesn't have a parent.
            // Let's get the variableReference, by name, from the pool of root variables.
            debugVariableReference = this.m_rootLocalVariablesMap.get(args.name) as number;
            if (!debugVariableReference)
            {
                console.error(`It's a tragedy, a root variable with name=${args.name} is invalid`);
                return null;
            }
            debugVariable = this.m_referencedVariablesMap.get(debugVariableReference) as O3DEDebugVariable;
        }
        else
        {
            // Find the actual debugVariable by searching for children's name
            for (let childDebugVariable of parentDebugVariable.elements)
            {
                if (childDebugVariable.name == args.name)
                {
                    debugVariable = childDebugVariable;
                    break;
                }
            }

            if (!debugVariable)
            {
                console.error(`For variable with name=${parentDebugVariable.name} couldn't find a child with name ${args.name}.`);
                return null;
            }

        }

        if (this.IsReadOnly(debugVariable))
        {
            console.error(`${debugVariable.name} is readonly`);
            return null;
        } 
        else if (parentDebugVariable)
        {
            if ((parentDebugVariable.type == O3DELuaTypes.LUA_TUSERDATA)
                 || (parentDebugVariable.type == O3DELuaTypes.LUA_TLIGHTUSERDATA))
            {
                console.error(`${debugVariable.name} is readonly because it is property of a userdata variable.`);
                return null;
            }
        }

        // Make a shallow copy of the child
        let newCopy = this.NewDebugVariableShallowCopy(debugVariable as O3DEDebugVariable);
        newCopy.value = args.value; // The copy has the new proposed value.

        // Is this a root variable? If yes, we are mostly done here.
        if (!parentDebugVariable)
        {
            return [debugVariableReference, newCopy, debugVariable];
        }

        // Make a shallow copy of the parent and link it with the copy of the child.
        let parentCopy = this.NewDebugVariableShallowCopy(parentDebugVariable as O3DEDebugVariable);
        parentCopy.elements.push(newCopy);

        newCopy = parentCopy;

        // Recurse up the chain.
        let hasParent = true;
        let childReference = parentVariableReference;
        while (hasParent)
        {
            let parentReference = this.m_childToParentMap.get(childReference);
            if (parentReference === undefined)
            {
                hasParent = false;
                continue;
            }
            let parentDebugValue = this.m_referencedVariablesMap.get(parentReference) as O3DEDebugVariable;
            let child = newCopy;
            newCopy = this.NewDebugVariableShallowCopy(parentDebugValue);
            newCopy.elements.push(child);
            childReference = parentReference;
        }

        return [debugVariable.__vscodePrivate as number, newCopy, debugVariable];
    }

    public SetVariableResponseBody(response:DebugProtocol.SetVariableResponse, variableReference: number, debugVariable: O3DEDebugVariable)
    {
        response.body = {
            value: debugVariable.value,
            type: GetLuaTypeAsString(debugVariable.type),
            variablesReference: variableReference,
            namedVariables:  debugVariable.elements.length,
        };
    }
}