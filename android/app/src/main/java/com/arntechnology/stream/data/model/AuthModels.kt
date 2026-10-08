package com.arntechnology.stream.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ServerStatusResponse(
    val data: ServerStatusData? = null
)

@Serializable
data class ServerStatusData(
    val initialized: Boolean = false,
    val authenticated: Boolean = false,
    val user: User? = null,
    val hasLibraries: Boolean = false
)

@Serializable
data class User(
    val id: Int,
    val username: String,
    @SerialName("display_name") val displayName: String? = null,
    val role: String = "user",
    val avatar: String? = null,
    @SerialName("can_download") val canDownload: Int? = 1,
    @SerialName("can_cast") val canCast: Int? = 1,
    @SerialName("allowed_libraries") val allowedLibraries: List<Int>? = null
)

@Serializable
data class PublicUser(
    val id: Int,
    val username: String,
    @SerialName("display_name") val displayName: String? = null,
    val avatar: String? = null
)

@Serializable
data class PublicUsersResponse(
    val data: List<PublicUser> = emptyList()
)

@Serializable
data class LoginRequest(
    val username: String,
    val password: String
)

@Serializable
data class AuthResponse(
    val data: AuthData? = null,
    val error: ApiError? = null
)

@Serializable
data class AuthData(
    val token: String,
    val user: User,
    val message: String? = null
)

@Serializable
data class ApiError(
    val code: String? = null,
    val message: String? = null
)
