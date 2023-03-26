/*
 * Copyright (c) lumbermixalot (Galib F. Arrieta)
 * For complete copyright and license terms please see the LICENSE at the root of this distribution.
 *
 * SPDX-License-Identifier: Apache-2.0 OR MIT
 *
 */

import {
StackFrame, Source
} from '@vscode/debugadapter';

import { DebugProtocol } from '@vscode/debugprotocol';

// Represents the information coming from:
// D:\GIT\o3de\Code\Framework\AzCore\AzCore\Script\ScriptContextDebug.h (struct CallstackLine)
class LuaStackTrace
{
    //                        Group1   
    //                        |   |    Group2
    //                        |   |    |   |    Group3
    //                        |   |    |   |    |   |       Group4
    //                        |   |    |   |    |   |       |                       |  Group5  
    //                        |   |    |   |    |   |       |                       |  |      |
    private static REGEX = /\[(\w+)\]\s(\S+)\s\((\d+)\)\s:\s((?:\w+)(?:(?:\[\d+\])?))\(([^()]*)\)/;
    public m_functionType: string; // Group1.  "Lua", "C", "main" or "tail".
    public m_sourceFile: string; // Group2.
    public m_lineCalled: number; // Group3
    public m_functionName: string; // Group4
    public m_functionParams: string[]; // After splitting Group5
    public m_functionNameWithParams: string; // Group4(Group5)
    
    constructor()
    {
        this.m_functionType = "";
        this.m_sourceFile = "";
        this.m_lineCalled = -1;
        this.m_functionName = "";
        this.m_functionParams = [];
        this.m_functionNameWithParams = "";
    }


    // @str looks like: 
    // "[Lua] @levels/lualocalstest/scripts/entity_mover.lua (54) : DummyFunction(000001AA73D63480, 0)"
    // or
	// "[Lua] @levels/lualocalstest/scripts/entity_mover.lua (20) : FunctionDefinedAtLine[13](000001AA73D63480)"
    public static CreateFromString(str: string): LuaStackTrace | null
    {
        let match = LuaStackTrace.REGEX.exec(str);
        let st = new LuaStackTrace();
        if (!match)
        {
            console.error(`LuaStackTrace Failed to regex match: [${str}]`);
            return null;
        }

        st.m_functionType = match[1];
        st.m_sourceFile = match[2];
        st.m_lineCalled = parseInt(match[3]);
        st.m_functionName = match[4];
        st.m_functionNameWithParams = `${match[4]}(${match[5]})`;
        st.m_functionParams = match[5].split(", ");

        return st;
    }

    public ToStackFrame(stackTraceIdx: number, sourcePathFunc: (string) => Source): StackFrame
    {
        let sourceInfo: Source = sourcePathFunc(this.m_sourceFile);
        let sf = new StackFrame(stackTraceIdx, this.m_functionNameWithParams, sourceInfo, this.m_lineCalled);
        return sf;
    }
}

export class StackFrameManager
{
    private m_stackFrames: StackFrame[];
    private m_stackTraces: LuaStackTrace[];
    private m_previousCallstackString: string;

    constructor()
    {
        this.m_stackFrames = [];
        this.m_stackTraces = [];
        this.m_previousCallstackString = "";
    }

    public Invalidate()
    {
        this.m_stackFrames = [];
        this.m_stackTraces = [];
        this.m_previousCallstackString = "";
    }

    public IsSameCallstack(callstack: string)
    {
        return this.m_previousCallstackString === callstack;
    }

    // This string contains multiple lines that look like:
	//[Lua] @levels/lualocalstest/scripts/entity_mover.lua (54) : DummyFunction(000001AA73D63480, 0)
	//[Lua] @levels/lualocalstest/scripts/entity_mover.lua (20) : FunctionDefinedAtLine[13](000001AA73D63480)
    public Update(callstack: string, sourcePathFunc: (string) => Source)
    {
        let lines: string[] = callstack.split('\n');
        
        this.m_stackFrames = [];
        this.m_stackTraces = [];

        let stackTraceIdx = 0;
        for (let line of lines)
        {
            if (line.length < 1)
            {
                continue;
            }
            let callstackTrace = LuaStackTrace.CreateFromString(line) as LuaStackTrace;
            if (!callstackTrace)
            {
                continue;
            }
            this.m_stackTraces.push(callstackTrace);
            this.m_stackFrames.push(callstackTrace.ToStackFrame(stackTraceIdx, sourcePathFunc));
            stackTraceIdx++;
        }
        this.m_previousCallstackString = callstack;
    }

    public FillResponse(startFrame: number, response: DebugProtocol.StackTraceResponse)
    {
        if (startFrame >= this.m_stackFrames.length)
        {
            response.body = {
                stackFrames: [],
                totalFrames: 0
            };
            return;
        }
        response.body = {
			stackFrames: this.m_stackFrames,
			totalFrames: this.m_stackFrames.length
		};
    }

}