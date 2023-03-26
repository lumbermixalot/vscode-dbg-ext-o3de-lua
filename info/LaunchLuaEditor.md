>	EditorLib.dll!CCryEditApp::OpenLUAEditor(const char * files) Line 3753	C++
 	ComponentEntityEditorPlugin.dll!SandboxIntegrationManager::LaunchLuaEditor(const char * files) Line 1372	C++
 	EditorLib.dll!AZStd::Internal::INVOKE<void (__cdecl AzToolsFramework::EditorRequests::*)(char const *),AzToolsFramework::EditorRequests * &,char const *,void>(void(AzToolsFramework::EditorRequests::*)(const char *) && f, AzToolsFramework::EditorRequests * & arg0, const char * && <args_0>) Line 178	C++
 	EditorLib.dll!AZStd::invoke<void (__cdecl AzToolsFramework::EditorRequests::*)(char const *),AzToolsFramework::EditorRequests * &,char const *>(void(AzToolsFramework::EditorRequests::*)(const char *) && f, AzToolsFramework::EditorRequests * & <args_0>, const char * && <args_1>) Line 55	C++
 	EditorLib.dll!AZ::EBusEventProcessingPolicy::Call<void (__cdecl AzToolsFramework::EditorRequests::*)(char const *),AzToolsFramework::EditorRequests * &,char const *>(void(AzToolsFramework::EditorRequests::*)(const char *) && func, AzToolsFramework::EditorRequests * & iface, const char * && <args_0>) Line 438	C++
 	EditorLib.dll!AZ::Internal::EBusContainer<AzToolsFramework::EditorRequests,AzToolsFramework::EditorRequests,0,0>::Dispatcher<AZ::EBus<AzToolsFramework::EditorRequests,AzToolsFramework::EditorRequests>>::Broadcast<void (__cdecl AzToolsFramework::EditorRequests::*)(char const *),char const *>(void(AzToolsFramework::EditorRequests::*)(const char *) && func, const char * && <args_0>) Line 1541	C++
 	EditorLib.dll!AzToolsFramework::Components::ScriptEditorComponent::LaunchLuaEditor(const AZ::Data::AssetId & assetId, const AZ::Uuid & __formal) Line 949	C++
 	EditorLib.dll!AZ::AttributeMemberFunction<void (__cdecl AzToolsFramework::Components::ScriptEditorComponent::*)(AZ::Data::AssetId const &,AZ::Uuid const &)>::Invoke(void * instance, const AZ::Data::AssetId & <args_0>, const AZ::Uuid & <args_1>) Line 637	C++
 	EditorLib.dll!AzToolsFramework::PropertyAssetCtrl::OnEditButtonClicked() Line 779	C++
 	EditorLib.dll!QtPrivate::FunctorCall<QtPrivate::IndexesList<>,QtPrivate::List<>,void,void (__cdecl AzToolsFramework::PropertyAssetCtrl::*)(void)>::call(void(AzToolsFramework::PropertyAssetCtrl::*)() f, AzToolsFramework::PropertyAssetCtrl * o, void * * arg) Line 152	C++
 	EditorLib.dll!QtPrivate::FunctionPointer<void (__cdecl AzToolsFramework::PropertyAssetCtrl::*)(void)>::call<QtPrivate::List<>,void>(void(AzToolsFramework::PropertyAssetCtrl::*)() f, AzToolsFramework::PropertyAssetCtrl * o, void * * arg) Line 186	C++
 	EditorLib.dll!QtPrivate::QSlotObject<void (__cdecl AzToolsFramework::PropertyAssetCtrl::*)(void),QtPrivate::List<>,void>::impl(int which, QtPrivate::QSlotObjectBase * this_, QObject * r, void * * a, bool * ret) Line 419	C++
 	[External Code]	
 	EditorLib.dll!CryEditMain(int argc, char * * argv) Line 3996	C++
 	Editor.exe!AZStd::Internal::INVOKE<int (__cdecl*&)(int,char * * const),int &,char * * &>(int(*)(int, char * *) & f, int & <args_0>, char * * & <args_1>) Line 209	C++
 	Editor.exe!AZStd::invoke<int (__cdecl*&)(int,char * * const),int &,char * * &>(int(*)(int, char * *) & f, int & <args_0>, char * * & <args_1>) Line 55	C++
 	Editor.exe!main(int argc, char * * argv) Line 31	C++
 	Editor.exe!WinMain(HINSTANCE__ * __formal, HINSTANCE__ * __formal, char * __formal, int __formal) Line 97	C++
 	[External Code]	


                // The following parameters will be added to the URI:
                // projectPath. Absolute path of the game projec root.
                // enginePath. Absolute path of the engine root. if not specified, it will be assume to be one directory above the game project root.
                // files. A list of files, separated by '|'.
                // Full example using the Uri shown below:
                // "vscode://lumbermixalot.o3de-lua-debug/debug?projectPath=D:\mydir\myproject&enginePath=C:\GIT\o3de&files=D:\mydir\myproject\scripts\something.lua|D:\mydir\myproject\scripts\utils\something2.lua"
                // or
                // "vscode://lumbermixalot.o3de-lua-debug/debug?projectPath=D:\GIT\o3de\AutomatedTesting&files=D:\GIT\o3de\AutomatedTesting\Assets\Scripts\something.lua"

                "vscode://lumbermixalot.o3de-lua-debug/debug?projectPath=D:%5CGIT%5Co3de&enginePath=D:%5CGIT%5CBoneMarrow&files[]=D:/GIT/BoneMarrow/Levels/LuaLocalsTest/Scripts/entity_mover.lua"

                <00:34:39> [Error] (CCryEditApp) - Failed to start external lua debugger with URI: vscode://lumbermixalot.o3de-lua-debug/debug?projectPath=D:%5CGIT%5Co3de&enginePath=D:%5CGIT%5CBoneMarrow&files[]=D:/GIT/BoneMarrow/Levels/LuaLocalsTest/Scripts/entity_mover.lua

    // The "open" command is macOS-specifc, under Linux you may use "xdg-open" and under Windows "start".