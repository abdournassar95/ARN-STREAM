package com.example.ui.screens.login

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.data.api.ApiClient
import com.example.data.model.LoginRequest
import com.example.data.model.PublicUser
import com.example.data.storage.PreferencesManager
import com.example.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun ProfileLoginScreen(
    preferencesManager: PreferencesManager,
    onLoginSuccess: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    var publicUsers by remember { mutableStateOf<List<PublicUser>>(emptyList()) }
    var selectedUser by remember { mutableStateOf<PublicUser?>(null) }
    var usernameInput by remember { mutableStateOf("") }
    var passwordInput by remember { mutableStateOf("") }
    var isLoadingUsers by remember { mutableStateOf(true) }
    var isAuthenticating by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        isLoadingUsers = true
        try {
            val response = ApiClient.apiService.getPublicUsers()
            if (!response.data.isNullOrEmpty()) {
                publicUsers = response.data
                selectedUser = response.data.firstOrNull()
                usernameInput = response.data.first().username
            }
        } catch (_: Exception) {
            // Server might require manual login
        } finally {
            isLoadingUsers = false
        }
    }

    val doLogin: () -> Unit = {
        val targetUsername = selectedUser?.username ?: usernameInput.trim()
        if (targetUsername.isEmpty()) {
            errorMessage = "يرجى إدخال اسم المستخدم"
        } else {
            isAuthenticating = true
            errorMessage = null
            coroutineScope.launch {
                try {
                    val response = ApiClient.apiService.login(LoginRequest(targetUsername, passwordInput))
                    val data = response.data
                    if (data != null && data.token.isNotEmpty()) {
                        ApiClient.setToken(data.token)
                        preferencesManager.saveAuth(data.token, data.user.id, data.user.displayName)
                        onLoginSuccess()
                    } else {
                        errorMessage = response.message ?: "فشل تسجيل الدخول. تأكد من اسم المستخدم وكلمة المرور."
                    }
                } catch (e: Exception) {
                    android.util.Log.e("ProfileLoginScreen", "Login error", e)
                    errorMessage = "خطأ في الاتصال بالخادم: ${e.localizedMessage ?: "تأكد من صحة البيانات"}"
                } finally {
                    isAuthenticating = false
                }
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(ArnObsidian, Color(0xFF0F172A), ArnDeepVoid)
                )
            )
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 24.dp, vertical = 12.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = "تسجيل الدخول إلى الخادم",
                fontSize = 24.sp,
                fontWeight = FontWeight.Black,
                color = Color.White
            )

            Text(
                text = "خادم ARN Stream المتصل",
                fontSize = 13.sp,
                color = ArnEmeraldPrimary,
                modifier = Modifier.padding(top = 4.dp)
            )

            Spacer(modifier = Modifier.height(30.dp))

            // If public profiles exist on the server
            if (publicUsers.isNotEmpty()) {
                Text(
                    text = "اختر الملف الشخصي:",
                    color = ArnTextSecondary,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(bottom = 12.dp)
                )

                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    items(publicUsers) { user ->
                        val isSelected = selectedUser?.id == user.id
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.clickable {
                                selectedUser = user
                                usernameInput = user.username
                            }
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(80.dp)
                                    .clip(RoundedCornerShape(18.dp))
                                    .background(Color(0xFF1E293B))
                                    .border(
                                        width = if (isSelected) 3.dp else 1.dp,
                                        color = if (isSelected) ArnEmeraldPrimary else Color(0x33FFFFFF),
                                        shape = RoundedCornerShape(18.dp)
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                if (!user.avatar.isNullOrEmpty()) {
                                    val fullAvatarUrl = ApiClient.getFullMediaUrl(user.avatar)
                                    AsyncImage(
                                        model = fullAvatarUrl,
                                        contentDescription = user.displayName,
                                        modifier = Modifier.fillMaxSize()
                                    )
                                } else {
                                    Text(
                                        text = user.displayName.firstOrNull()?.toString() ?: "U",
                                        color = Color.White,
                                        fontSize = 28.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            Text(
                                text = user.displayName,
                                color = if (isSelected) Color.White else ArnTextSecondary,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                fontSize = 13.sp
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))
            } else if (!isLoadingUsers) {
                // Manual Username field
                OutlinedTextField(
                    value = usernameInput,
                    onValueChange = { usernameInput = it },
                    placeholder = { Text("اسم المستخدم (Username)", color = ArnTextMuted) },
                    leadingIcon = {
                        Icon(imageVector = Icons.Default.Person, contentDescription = null, tint = ArnEmeraldPrimary)
                    },
                    modifier = Modifier.fillMaxWidth(0.9f),
                    shape = RoundedCornerShape(14.dp),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = ArnEmeraldPrimary,
                        unfocusedBorderColor = Color(0x33FFFFFF),
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    )
                )

                Spacer(modifier = Modifier.height(14.dp))
            }

            // Password Field
            OutlinedTextField(
                value = passwordInput,
                onValueChange = { passwordInput = it },
                placeholder = { Text("كلمة المرور", color = ArnTextMuted) },
                visualTransformation = PasswordVisualTransformation(),
                leadingIcon = {
                    Icon(imageVector = Icons.Default.Lock, contentDescription = null, tint = ArnEmeraldPrimary)
                },
                modifier = Modifier.fillMaxWidth(0.9f),
                shape = RoundedCornerShape(14.dp),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = ArnEmeraldPrimary,
                    unfocusedBorderColor = Color(0x33FFFFFF),
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White
                )
            )

            Spacer(modifier = Modifier.height(18.dp))

            Button(
                onClick = doLogin,
                enabled = !isAuthenticating,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = ArnEmeraldPrimary),
                modifier = Modifier
                    .fillMaxWidth(0.9f)
                    .height(48.dp)
            ) {
                if (isAuthenticating) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("جاري تسجيل الدخول...", color = Color.White)
                } else {
                    Text(
                        text = "دخول",
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        fontSize = 15.sp
                    )
                }
            }

            if (errorMessage != null) {
                Spacer(modifier = Modifier.height(14.dp))
                Text(
                    text = errorMessage ?: "",
                    color = Color(0xFFF87171),
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}
