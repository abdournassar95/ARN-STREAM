package com.arntechnology.stream.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class DiscoveredDevicesResponse(
    val data: List<ConnectedDevice> = emptyList()
)

@Serializable
data class ConnectedDevice(
    val id: String,
    val name: String,
    val type: String, // tv, mobile, tablet, desktop, dlna_renderer
    val isDlna: Boolean = false,
    val currentMedia: DeviceCurrentMedia? = null
)

@Serializable
data class DeviceCurrentMedia(
    val id: Int? = null,
    val title: String? = null,
    val type: String? = null,
    val poster: String? = null,
    val duration: Long? = null
)

@Serializable
data class RegisterDeviceRequest(
    val deviceId: String,
    val name: String,
    val type: String = "mobile",
    val userName: String? = null,
    val userDisplayName: String? = null
)

@Serializable
data class RemoteCommandRequest(
    val targetDeviceId: String,
    val fromDeviceId: String,
    val command: String, // play, pause, seek, seek_delta, volume, mute, speed, dpad, send_string
    val value: String? = null
)

@Serializable
data class HandoffTransferRequest(
    val targetDeviceId: String,
    val fromDeviceId: String,
    val fromDeviceName: String? = null,
    val media: HandoffMediaPayload
)

@Serializable
data class HandoffMediaPayload(
    val id: Int,
    val title: String,
    val type: String, // movie, episode, track
    val currentTime: Double = 0.0,
    val duration: Double = 0.0,
    val poster: String? = null
)

@Serializable
data class GenericSuccessResponse(
    val success: Boolean = true,
    val message: String? = null
)
