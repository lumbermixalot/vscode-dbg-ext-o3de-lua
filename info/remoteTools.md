The Editor, in this file: C:\GIT\o3de\Gems\RemoteTools\Code\Source\Utilities\RemoteToolsJoinThread.cpp
Has a dedicated thread running: `void RemoteToolsJoinThread::OnUpdate([[maybe_unused]] AZ::TimeMs updateRateMs)`. 

About PersistentId...
    static const AZ::Name LuaToolsName = AZ::Name::FromStringLiteral("LuaRemoteTools", nullptr);
    static constexpr AZ::Crc32 LuaToolsKey("LuaRemoteTools"); == m_value = 975059818 == key = {m_value=0x3a1e3b6a }
    static constexpr uint16_t LuaToolsPort = 6777;


the LuadIDE processes all received messages in:
C:\GIT\o3de\Code\Tools\LuaIDE\Source\LUA\LUADebuggerComponent.cpp
    void Component::OnSystemTick()

It attempts to connect to port 6777 where the lua debugger is supposed to be.

As soon as it connects it sends this message to the LuaIDE:
RemoteToolsPackets::RemoteToolsConnect 

All messages betwween C:\GIT\o3de\Code\Framework\AzFramework\AzFramework\Script\ScriptRemoteDebugging.cpp
and LuaIDE are listed here (subclasses of RemoteToolsMessage):
C:\GIT\o3de\Code\Framework\AzFramework\AzFramework\Script\ScriptDebugMsgReflection.h

This file lists all commands and responses:
C:\GIT\o3de\Code\Framework\AzFramework\AzFramework\Script\ScriptRemoteDebugging.h


Editor                                                    |   O3DELuaDbg
CorePackets::InitiateConnectionPacket() ->                |
CorePackets::InitiateConnectionPacket() ->                |
RemoteToolsPackets::RemoteToolsConnect ->                 |
  --- FROM ScriptRemoteDebugging.cpp--                    |   -- FROM LUADebuggerComponent.cpp ---- 
                                                          |   <- ScriptDebugRequest(AZ_CRC_CE("EnumContexts"))
ScriptDebugEnumContextsResult ->                          |
                                                          |   <- ScriptDebugRequest(AZ_CRC_CE("AttachDebugger"), scriptContextName)
ScriptDebugAck(AZ_CRC("AttachDebugger", AZ_CRC("Ack")) -> | 
                                                          | <- ScriptDebugRequest(AZ_CRC("EnumRegisteredClasses"),scriptContextName)
                                                          | <- ScriptDebugRequest(AZ_CRC_CE("EnumRegisteredEBuses"), scriptContextName)
                                                          | <- ScriptDebugRequest(AZ_CRC_CE("EnumRegisteredGlobals"), scriptContextName)
ScriptDebugRegisteredClassesResult ->                     |
ScriptDebugRegisteredEBusesResult ->                      |
ScriptDebugRegisteredGlobalsResult ->                     |

Later when I set a breakpoint
                                                          | <- ScriptDebugBreakpointRequest(AZ_CRC_CE("AddBreakpoint"), relativePath.c_str(), static_cast<AZ::u32>(lineNumber)));
                                                          |     relativePath = "@levels/goal_9ks_1kd/scripts/static_obj_spawner.luac"
                                                          |     lineNumber = 0x12
ScriptDebugAckBreakpoint ->                               |
response->m_moduleName =                                  |
 "@levels/goal_9ks_1kd/scripts/static_obj_spawner.luac"   |

   --- The user enters game mode ---
ScriptDebugAckBreakpoint response; ->                     |
    response.m_id = AZ_CRC("BreakpointHit", 0xf1a38e0b);  |
                                                          | <- ScriptDebugRequest(AZ_CRC_CE("GetCallstack"))
 ScriptDebugCallStackResult response; ->                  |
    -- When the user clicks step over ---
                                                          | <- AzFramework::ScriptDebugRequest(AZ_CRC_CE("StepOver"))
 ScriptDebugAck(request->m_request, AZ_CRC("Ack")) ->     |
 ScriptDebugAckBreakpoint response;         ->            |
    response.m_id = AZ_CRC("BreakpointHit", 0xf1a38e0b);  |
                                                          | <- ScriptDebugRequest(AZ_CRC_CE("GetCallstack"))
                                                          | <- ScriptDebugRequest(AZ_CRC_CE("EnumLocals"))
 ScriptDebugCallStackResult response;  ->                 |
                                                          | <- ScriptDebugRequest(AZ_CRC_CE("EnumLocals"))
 ScriptDebugEnumLocalsResult response;  ->                |
 ScriptDebugCallStackResult response; ->                  |
 ScriptDebugEnumLocalsResult response; ->                 |
                                                          | <- ScriptDebugRequest(AZ_CRC_CE("GetValue"), varName.c_str())
                                                          |     varName == "self"
 ScriptDebugGetValueResult response; value = "{...}" ->   |
          -- When the use clicks Continue --
                                                          | <- ScriptDebugRequest(AZ_CRC_CE("Continue"))
  ScriptDebugAck(request->m_request, AZ_CRC("Ack")) ->    |
                                                          |
                                                          |
                                                          |
                                                          | <- ScriptDebugBreakpointRequest(AZ_CRC_CE("RemoveBreakpoint"), relativePath.c_str(),
                                                          |      static_cast<AZ::u32>(lineNumber)));
ScriptDebugAckBreakpoint response; ->                     |



-------------------------------------------------------------------
Transformation Steps of a AzFramework::ScriptDebugRequest:

ScriptDebugRequest subclasses AzFramework::RemoteToolsMessage
m_remoteTools->SendRemoteToolsMessage(targetInfo, AzFramework::ScriptDebugRequest(AZ_CRC_CE("AttachDebugger"), scriptContextName));
        ScriptDebugRequest(AZ::u32 request, const char* context)
            : RemoteToolsMessage(AZ_CRC("ScriptDebugAgent", 0xb6be0836))
            , m_request(request)
            , m_context(context) {}

The message in AzFramework::ScriptDebugRequest(AZ_CRC_CE("AttachDebugger"), scriptContextName)
gets packaged as a OutboundToolingDatum datum.
m_outboxThread->PushOutboxMessage(
            networkInterface, static_cast<AzNetworking::ConnectionId>(target.GetNetworkId()), AZStd::move(datum));

C:\GIT\o3de\Gems\RemoteTools\Code\Source\Utilities\RemoteToolsOutboxThread.cpp
void RemoteToolsOutboxThread::OnUpdate([[maybe_unused]] AZ::TimeMs updateRateMs)

Here the datum is converted to
RemoteTools::RemoteToolsPackets::RemoteToolsMessage
    RemoteTools::RemoteToolsMessageBuffer m_messageBuffer;
        uint32_t size
        uint8_t* bytes;
    uint32_t m_size = 0;
    uint32_t m_persistentId = 0;


------------------------------------------------------------------------------


How a message is deserialized:

D:\GIT\o3de\Gems\RemoteTools\Code\Source\RemoteToolsSystemComponent.cpp
bool RemoteToolsSystemComponent::HandleRequest() {

 AZ::ObjectStream::LoadBlocking();

}



D:\GIT\o3de\Code\Framework\AzCore\AzCore\Serialization\ObjectStream.cpp
    /*static*/ bool ObjectStream::LoadBlocking(IO::GenericStream* stream, SerializeContext& sc, const ClassReadyCB& readyCB, const FilterDescriptor& filterDesc, const InplaceLoadRootInfoCB& inplaceRootInfo)
    {
        AZ_Assert(stream != nullptr, "You are trying to serialize from a NULL stream!");
        ObjectStreamInternal::ObjectStreamImpl objectStream(stream, &sc, readyCB, CompletionCB(), filterDesc, 0, inplaceRootInfo);

        // This runs and completes (not asynchronous).
        return objectStream.Start();
    }


 bool ObjectStreamImpl::Start()
 {
    LoadClass(m_inStream, convertedClassElement, nullptr, nullptr, m_flags) && result;
 }


 bool ObjectStreamImpl::LoadClass(IO::GenericStream& stream, SerializeContext::DataElementNode& convertedClassElement, const SerializeContext::ClassData* parentClassInfo, void* parentClassPtr, int flags)
 {
    while (true)
    {
        if (!ReadElement(*m_sc, classData, element, parentClassInfo, nextLevel, parentClassInfo == nullptr))
        {break;}

        const SerializeContext::ClassElement* classElement = nullptr;
        SerializeContext::IDataContainer* classContainer = nullptr;
        if (parentClassInfo)
        {
            if (parentClassInfo->m_container)
            {
                classElement = blah
                classContainer = blah
            }
            else
            {
                for (size_t i = 0; i < parentClassInfo->m_elements.size(); ++i)
                {
                    // Used for conversion
                }
            }
        }

        StorageAddressElement storageElement{ nullptr, nullptr, result, classContainer, currentContainerElementIndex };
        
        if(GetElementStorageAddress(storageElement, classElement, element, classData, parentClassPtr) !=StorageAddressResult::Success)
        {
            continue;
        }

        void* dataAddress = storageElement.m_dataAddress;
        void* reserveAddress = storageElement.m_reserveAddress; // Stores the dataAddress

        // Serializable leaf element.
        if (classData->m_serializer)
        {
            // Wrap the stream
            IO::GenericStream* currentStream = &m_inStream;
            IO::MemoryStream memStream(m_inStream.GetData()->data(), 0, element.m_dataSize);
            currentStream = &memStream;

            if (element.m_byteStream.GetLength() > 0)
            {
                currentStream = &element.m_byteStream;
            }

            currentStream->Seek(0, IO::GenericStream::ST_SEEK_BEGIN);

            // read the class value
            if (dataAddress == nullptr || 
                !classData->m_serializer->Load(dataAddress, *currentStream, element.m_version, element.m_dataType == SerializeContext::DataElement::DT_BINARY_BE))
            {
                // ERROR
            }
        }

        // Read child nodes
        result = LoadClass(stream, *convertedNode, classData, dataAddress, flags) && result;

        if (classContainer)
        {
            classContainer->StoreElement(parentClassPtr, reserveAddress);
        }

    }
 }

 bool ObjectStreamImpl::ReadElement(SerializeContext& sc, const SerializeContext::ClassData*& cd, SerializeContext::DataElement& element, const SerializeContext::ClassData* parent, bool nextLevel, bool isTopElement)
 {

 }
        {
