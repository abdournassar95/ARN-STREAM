package com.arntechnology.stream.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.arntechnology.stream.data.api.NetworkClient
import com.arntechnology.stream.data.local.SessionPreferences
import com.arntechnology.stream.data.model.LoginRequest
import com.arntechnology.stream.data.model.PublicUser
import com.arntechnology.stream.ui.theme.ArnEmerald
import com.arntechnology.stream.ui.theme.DarkBackground
import com.arntechnology.stream.ui.theme.TextPrimary
import com.arntechnology.stream.ui.theme.TextSecondary
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit
) {
    val context = LocalContext.getContext()
    val scope = rememberCoroutineScope()
    val prefs = remember { SessionPreferences(context) }
    
    var users by remember { mutableStateOf<List<PublicUser>>(emptyList()) }
    var selectedUser by remember { mutableStateOf<PublicUser?>(null) }
    var password by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(true) }
    var isLoggingIn by remember { mutableStateOf(false) }
    var serverUrl by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        serverUrl = prefs.getServerUrl() ?: ""
        try {
            val api = NetworkClient(context).getApiService()
            val response = api.getPublicUsers()
            if (response.isSuccessful) {
                users = response.body()?.data ?: emptyList()
            }
        } catch (e: Exception) {
            Toast.makeText(context, "فشل الاتصال بالخادم لجلب المستخدمين", Toast.LENGTH_SHORT).show()
        } finally {
            isLoading = false
        }
    }

    Scaffold(
        containerColor = DarkBackground,
        topBar = {
            TopAppBar(
                title = { Text("تسجيل الدخول", color = ArnEmerald, fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DarkBackground)
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "اختر حسابك للمتابعة",
                color = TextPrimary,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(32.dp))

            if (isLoading) {
                CircularProgressIndicator(color = ArnEmerald)
            } else if (users.isEmpty()) {
                Text(
                    text = "لم يتم العثور على أي مستخدم في السيرفر، يرجى إنشاء حساب عبر لوحة التحكم.",
                    color = TextSecondary,
                    textAlign = TextAlign.Center
                )
            } else {
                // Users Grid
                LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    items(users) { user ->
                        val isSelected = selectedUser?.id == user.id
                        UserCard(
                            user = user,
                            serverUrl = serverUrl,
                            isSelected = isSelected,
                            onClick = { 
                                selectedUser = user
                                password = ""
                            }
                        )
                    }
                }

                // Login Form (if user is selected)
                if (selectedUser != null) {
                    Spacer(modifier = Modifier.height(24.dp))
                    Text(
                        text = "مرحباً، ${selectedUser?.displayName ?: selectedUser?.username}",
                        color = ArnEmerald,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        placeholder = { Text("رمز الدخول / كلمة المرور") },
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        singleLine = true,
                        leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = ArnEmerald) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = ArnEmerald,
                            unfocusedBorderColor = TextSecondary,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )
                    
                    Spacer(modifier = Modifier.height(24.dp))
                    
                    Button(
                        onClick = {
                            if (password.isNotBlank()) {
                                scope.launch {
                                    isLoggingIn = true
                                    try {
                                        val api = NetworkClient(context).getApiService()
                                        val response = api.login(LoginRequest(selectedUser!!.username, password))
                                        if (response.isSuccessful && response.body()?.data != null) {
                                            val authData = response.body()!!.data!!
                                            prefs.saveAuthSession(
                                                token = authData.token,
                                                userId = authData.user.id,
                                                username = authData.user.username,
                                                displayName = authData.user.displayName
                                            )
                                            onLoginSuccess()
                                        } else {
                                            Toast.makeText(context, "كلمة المرور غير صحيحة", Toast.LENGTH_SHORT).show()
                                        }
                                    } catch (e: Exception) {
                                        Toast.makeText(context, "حدث خطأ أثناء الاتصال", Toast.LENGTH_SHORT).show()
                                    } finally {
                                        isLoggingIn = false
                                    }
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth().height(50.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = ArnEmerald),
                        shape = RoundedCornerShape(12.dp),
                        enabled = !isLoggingIn && password.isNotBlank()
                    ) {
                        if (isLoggingIn) {
                            CircularProgressIndicator(color = DarkBackground, modifier = Modifier.size(24.dp))
                        } else {
                            Text("دخول", color = DarkBackground, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun UserCard(
    user: PublicUser,
    serverUrl: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    val borderColor = if (isSelected) ArnEmerald else Color.Transparent
    val bgColor = if (isSelected) ArnEmerald.copy(alpha = 0.1f) else Color(0xFF1E293B)
    
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(bgColor)
            .border(2.dp, borderColor, RoundedCornerShape(16.dp))
            .clickable { onClick() }
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        if (!user.avatar.isNullOrEmpty()) {
            val avatarUrl = if (user.avatar.startsWith("http")) user.avatar else "$serverUrl${user.avatar}"
            AsyncImage(
                model = avatarUrl,
                contentDescription = user.username,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .size(64.dp)
                    .clip(CircleShape)
            )
        } else {
            Icon(
                imageVector = Icons.Default.AccountCircle,
                contentDescription = null,
                tint = TextSecondary,
                modifier = Modifier.size(64.dp)
            )
        }
        
        Spacer(modifier = Modifier.height(12.dp))
        
        Text(
            text = user.displayName ?: user.username,
            color = TextPrimary,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1
        )
    }
}
