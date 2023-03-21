# Welcome to vscode-dbg-ext-o3de-lua

World's first VSCode Debugger Extension to debug Lua scripts on the [O3DE Game Engine](https://github.com/o3de/o3de).  
  
## TL;DR

1. Install this extension. Obviously!
2. Run the O3DE Editor.exe, and open a level that references a Lua file of interest. For the sake of this example, let's assume the file you need to debug is located at `C:\GIT\Pacman3000\Scripts\ghost.lua`.
3. In VSCode open the file mentioned above. Set a breakpoint, let's say inside the `OnActivate()` function.
4. On the top right corner of the VSCode window, hit the `Debug File` ![Debug File button](/images/debug_file_button.png?raw=true) button:  
![Debug File button Location](/images/debug_file_button_example.png?raw=true)
5. Because the O3DE Editor.exe is already running, it will automatically connect to this debugger, and in turn this debugger will show the following banner in the bottom-right location of the status bar: `O3DELuaDbg: Editor.exe(Attached)`:  
![Debugger Attached Banner](/images/attached_banner.png?raw=true)   
This banner not only informs us that the O3DE Editor is connected to this debugger, but also that this debugger is attached to the Script Debug Context running in the O3DE Editor.  
6. Now, go back to the O3DE Editor and enter Game Mode (Ctrl+G).  
7. Immediately, you should see VSCode window getting the focus again highlighing the line where the breakpoint hit.  
8. From now on, debug away! `Step Over (F10)`, `Step Into (F11)`, etc ...  
  
  
For more in-depth configurations, visit the [Wiki](https://github.com/lumbermixalot/vscode-dbg-ext-o3de-lua/wiki).  
  
 
  


