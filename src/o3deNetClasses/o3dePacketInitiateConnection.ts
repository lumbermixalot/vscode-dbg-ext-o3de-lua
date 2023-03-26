/*
 * Copyright (c) lumbermixalot (Galib F. Arrieta)
 * For complete copyright and license terms please see the LICENSE at the root of this distribution.
 *
 * SPDX-License-Identifier: Apache-2.0 OR MIT
 *
 */

import { O3DEPacketBase } from "./o3dePacketBase";

export class O3DEPacketInitiateConnection extends O3DEPacketBase
{
    static readonly PacketType = 1;

    GetPacketType(): number {
        return O3DEPacketInitiateConnection.PacketType;
    }

    public GetSizeInBytes(): number {
        return 4;
    }

    WriteToBuffer(bufferView: Uint8Array) {
        throw new Error("Method not implemented.");
    }
    
}