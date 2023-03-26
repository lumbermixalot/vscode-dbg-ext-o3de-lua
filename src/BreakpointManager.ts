/*
 * Copyright (c) lumbermixalot (Galib F. Arrieta)
 * For complete copyright and license terms please see the LICENSE at the root of this distribution.
 *
 * SPDX-License-Identifier: Apache-2.0 OR MIT
 *
 */

import path from 'path';
import fs  from 'fs';

import * as AZCRC32 from './o3deCrc32';

export class BreakpointLineInfo
{
    // Required by VSCode. This is a Crc32 hash of the filename + line
    public readonly m_breakpointId: number;

    public readonly m_line: number;

    constructor(breakpointId: number, lineNumber: number)
    {
        this.m_breakpointId = breakpointId;
        this.m_line = lineNumber;
    }
}

export class BreakpointSourceInfo
{
    public readonly m_vscodeFilePath: string; // Absolute Path of the file as reported by VSCode.
    public readonly m_editorFilePath: string; // Game project relative Path as neeed by O3DE Editor.exe.

    private m_lines: Map<number, BreakpointLineInfo>; // Map of line numbers where the breakpoints are located.
    
    constructor(vscodeFilePath: string, editorFilePath: string)
    {
        this.m_vscodeFilePath = vscodeFilePath;
        this.m_editorFilePath = editorFilePath;
        this.m_lines = new Map<number, BreakpointLineInfo>();
    }

    public GetBreakpointLineInfo(lineNumber: number) : BreakpointLineInfo | undefined
    {
        return this.m_lines.get(lineNumber);
    }


    public AddLine(lineNumber: number)
    {
        let breakpointId = AZCRC32.AZ_CRC32_STR(`${this.m_vscodeFilePath}${lineNumber}`);
        this.m_lines.set(lineNumber, new BreakpointLineInfo(breakpointId, lineNumber));
    }

    public ClearLines()
    {
        this.m_lines.clear();
    }

    public GetLines() : Map<number, BreakpointLineInfo>
    {
        return this.m_lines;
    }
}


// Manages all breakpoints, across all files. Also
// provides lua file path translation services
// between Absolute paths as provided by VSCode and
// relative paths as required by O3DE Editor.exe.
// Remarks: 
// 1- For a file with this Path: "d:\\GIT\\BoneMarrow\\Levels\\LuaLocalsTest\\Scripts\\entity_mover.lua"
//    The O3DE Editor needs  "@levels/lualocalstest/scripts/entity_mover.lua".
// 2- For a file with this Path: "d:\\GIT\\BoneMarrow\\Scripts\\entity_mover.lua"
//    The O3DE Editor needs  @scripts/entity_mover.lua"
// 3- For a file with this path: "d:\\GIT\\BoneMarrow\\Assets\\Crop\\Damn\\entity_mover.lua"
//    The O3DE Editor needs  "@assets/crop/damn/entity_mover.lua"
// 4- "d:\\GIT\\BoneMarrow\\Random\\entity_mover.lua"
//    The O3DE Editor needs  "@random/entity_mover.lua"
// 5- "d:\\GIT\\BoneMarrow\\entity_mover.lua"
//    The O3DE Editor needs  "@entity_mover.lua"
export class BreakpointManager
{

    public m_gameProjectPath: string;
    // These two maps contain the same information,
    // except that the key of this one is the filePath as VSCode understand it.
    private m_vscodeBreakpoints: Map<string, BreakpointSourceInfo>;

    // Key: Subdirectory name, in lower case,
    //      under the game project path.
    // Value: Absolute path of the subdirectory.
    // Examples. Assume game project path = "c:\GIT\MyGame"
    // Key: "@scripts", Value: "c:\GIT\MyGame\Scripts"
    // key: "@assets", Value: "c:\GIT\MyGame\Assets"
    private m_directoryAliasMap: Map<string, string>

    private readonly m_aliasRegex = /^(@\w+)/;

    // Key: An aliased file path like: "@levels/lualocalstest/scripts/entity_mover.lua"
    // Value: An absolute file path that preserves the casing as reported by the file system.
    //        Example: "d:\GIT\BoneMarrow\Levels\LuaLocalsTest\Scripts\entity_mover.lua"
    private m_fileAliasToAbsoluteMap: Map<string, string>

    constructor(gameProjectPath: string)
    {
        this.m_gameProjectPath = gameProjectPath;
        this.m_vscodeBreakpoints = new Map<string, BreakpointSourceInfo>();
        this.m_directoryAliasMap = new Map<string, string>();
        this.m_fileAliasToAbsoluteMap = new Map<string, string>();
        this.ReloadAliasMap();
    }

    public UpdateProjectPath(gameProjectPath: string)
    {
        this.m_gameProjectPath = gameProjectPath;
        this.ReloadAliasMap();
    }

    public AddBreakpoints(vsCodeFilePath: string, lines: number[])
    {
		let breakpointInfo = this.m_vscodeBreakpoints.get(vsCodeFilePath);
		if (!breakpointInfo)
		{
            let editorFilePath = this.GetEditorFilePath(vsCodeFilePath);
			breakpointInfo = new BreakpointSourceInfo(vsCodeFilePath, editorFilePath);
			for (let lineNumber of lines)
			{
				breakpointInfo.AddLine(lineNumber);
			}
			this.m_vscodeBreakpoints.set(vsCodeFilePath, breakpointInfo);
		}
		else
		{
			breakpointInfo.ClearLines();
			for (let lineNumber of lines)
			{
				breakpointInfo.AddLine(lineNumber);
			}
		}
    }

    // Recursively searches inside @folderAliasAbsolutePath, for the real file name of the lower cased
    // string @afterFolderAlias. This is very important so this vscode extension works well on OSes
    // where the filesystem is case sensitive.
    public DiscoveverRealFilePath(folderAliasAbsolutePath: string, afterFolderAlias: string) : string
    {
        let firstComponent = afterFolderAlias;
        let indexOfFileSep = afterFolderAlias.indexOf('/');
        if (indexOfFileSep == 0)
        {
            let msg = `DiscoveverRealFilePath error: <${afterFolderAlias}> should not start with '/'`;
            console.error(msg)
            throw new Error(msg);
        }
        else if (indexOfFileSep > 0)
        {
            firstComponent = afterFolderAlias.substring(0, indexOfFileSep);
        }

        // Now get all files in the current directory and if there's a match, and it's a directory, we'll
        // keep recursing.
        for (let dirent of fs.readdirSync(folderAliasAbsolutePath, { withFileTypes: true })
        .filter((item) => !item.name.startsWith(".")))
        {
            let componentLowerCased = dirent.name.toLowerCase();
            if (componentLowerCased === firstComponent)
            {
                if (dirent.isFile())
                {
                    // Found it!
                    return path.join(folderAliasAbsolutePath, dirent.name);
                }

                let newParentFolder = path.join(folderAliasAbsolutePath, dirent.name);
                let newSubFolderAlias = afterFolderAlias.substring(indexOfFileSep + 1);
                // Keep the recursion going.
                return this.DiscoveverRealFilePath(newParentFolder, newSubFolderAlias);
            }
        }
        //Bad news!
        let msg = `DiscoveverRealFilePath Error: Unexpected situation: parent=<${folderAliasAbsolutePath}>, child=<${afterFolderAlias}>`;
        console.error(msg);
        throw new Error(msg);
        return "";
    }


    // The Editor here, referes as O3DE Editor.exe, that when debugging produces
    // filepaths relative to the game project using the "@subfolder" as the first
    // component of the relative file path.
    // Returns the absolute path of the file.
    public GetVscodePathFromEditorPath(editorFilePath: string): string | undefined
    {
        let vsCodeFilePath = this.m_fileAliasToAbsoluteMap.get(editorFilePath);
        if (vsCodeFilePath)
        {
            return vsCodeFilePath;
        }
        let match = this.m_aliasRegex.exec(editorFilePath);
        if (!match)
        {
            console.error(`Failed to regex match folder alias name for ${editorFilePath}`);
            return undefined;
        }
        let folderAlias = match[1];
        let folderAliasAbsolutePath = this.m_directoryAliasMap.get(folderAlias);
        if (!folderAliasAbsolutePath)
        {
            console.error(`The alias folder ${folderAlias} from ${editorFilePath} was not found!`);
            return undefined;
        }

        let afterFolderAlias = editorFilePath.substring(folderAlias.length + 1 /* 1 to skip file separator*/)
        vsCodeFilePath = this.DiscoveverRealFilePath(folderAliasAbsolutePath, afterFolderAlias);
        this.m_fileAliasToAbsoluteMap.set(editorFilePath, vsCodeFilePath);
        return vsCodeFilePath;
    }

    public GetBreakpoints() : BreakpointSourceInfo[]
    {
        let breakpoints: BreakpointSourceInfo[] = [];
        for (let bp of this.m_vscodeBreakpoints.values())
        {
            breakpoints.push(bp);
        }
        return breakpoints;
    }

    public GetBreakpointHitId(): number
    {
        return 0;
    }

    public GetBreakpointsByVSCodePath(vsCodeFilePath: string): BreakpointSourceInfo | undefined
    {
        return this.m_vscodeBreakpoints.get(vsCodeFilePath);
    }

    private GetEditorFilePath(vsCodeFilePath: string): string
    {
        if (!vsCodeFilePath.startsWith(this.m_gameProjectPath))
        {
            let msg = `The file ${vsCodeFilePath} doesn't belong to Game Project at ${this.m_gameProjectPath}`;
            console.error(msg);
            throw new Error(msg);
        }

        let charsToRemove = this.m_gameProjectPath.length + 1;
        let editorFilePath = vsCodeFilePath.substring(charsToRemove);
        editorFilePath = `@${editorFilePath.toLowerCase()}`;
        let pathComponents = editorFilePath.split(path.sep);
        editorFilePath = pathComponents.join('/');
        return editorFilePath;
    }

    private ReloadAliasMap()
    {
        this.m_fileAliasToAbsoluteMap.clear();
        this.m_directoryAliasMap.clear();
        for (let dirent of fs.readdirSync(this.m_gameProjectPath, { withFileTypes: true })
        .filter((item) => item.isDirectory() && !item.name.startsWith(".")))
        {
            let aliasName = `@${dirent.name.toLowerCase()}`;
            let fullPath = path.join(this.m_gameProjectPath, dirent.name)
            //console.log(`ReloadAliasMap: found ${aliasName}=${fullPath}`)
            this.m_directoryAliasMap.set(aliasName, fullPath);
        }
    }


}