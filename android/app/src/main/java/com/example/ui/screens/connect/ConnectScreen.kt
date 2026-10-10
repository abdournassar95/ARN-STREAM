package com.example.ui.screens.connect

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Wifi
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.data.api.ApiClient
import com.example.data.discovery.ServerDiscoveryRepository
import com.example.data.model.DiscoveredServer
import com.example.data.storage.PreferencesManager
import com.example.ui.components.ArnAboutDialog
import com.example.ui.components.CameraQrScannerDialog
import com.example.ui.components.GlassCard
import com.example.ui.theme.*
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch

@Composable
fun ConnectScreen(
    preferencesManager: PreferencesManager,
    onConnected: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val discoveryRepo = remember { ServerDiscoveryRepository(context) }

    var serverUrlInput by remember { mutableStateOf("") }
    var isScanning by remember { mutableStateOf(false) }
    var isConnecting by remember { mutableStateOf(false) }
    var showAboutDialog by remember { mutableStateOf(false) }
    var showCameraScanner by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var successMessage by remember { mutableStateOf<String?>(null) }
    val discoveredServers = remember { mutableStateListOf<DiscoveredServer>() }

    val startDiscovery: () -> Unit = {
        isScanning = true
        errorMessage = null
        discoveredServers.clear()
        coroutineScope.launch {
            try {
                discoveryRepo.discoverServers().collect { server ->
                    if (discoveredServers.none { it.baseUrl == server.baseUrl }) {
                        discoveredServers.add(server)
                    }
                }
            } catch (_: Exception) {}
            isScanning = false
        }
    }

    LaunchedEffect(Unit) {
        val lastUrl = preferencesManager.serverUrl.firstOrNull()
        if (!lastUrl.isNullOrEmpty()) {
            serverUrlInput = lastUrl
        }
        startDiscovery()
    }

    val connectToServer: (String) -> Unit = { url ->
        val raw = url.trim()
        if (raw.isNotEmpty()) {
            isConnecting = true
            errorMessage = null
            successMessage = null
            coroutineScope.launch {
                try {
                    val formatted = if (raw.startsWith("http://") || raw.startsWith("https://")) raw else "http://$raw"
                    val cleanUrl = if (formatted.endsWith("/")) formatted else "$formatted/"
                    ApiClient.updateConfig(cleanUrl)

                    // Verify real server response from auth status or root
                    val statusResponse = try {
                        ApiClient.apiService.getServerStatus()
                    } catch (e: Exception) {
                        null
                    }

                    if (statusResponse?.data != null || statusResponse?.success == true) {
                        preferencesManager.saveServerUrl(cleanUrl)
                        successMessage = "تم الاتصال بنجاح بالخادم!"
                        onConnected()
                    } else {
                        // Check if libraries can be fetched directly (open server)
                        val libRes = runCatching { ApiClient.apiService.getLibraries(nonEmpty = false) }.getOrNull()
                        if (libRes != null) {
                            preferencesManager.saveServerUrl(cleanUrl)
                            successMessage = "تم الاتصال بنجاح بالخادم!"
                            onConnected()
                        } else {
                            errorMessage = "تعذر تأكيد الاتصال بخادم ARN Stream على العنوان المحدد. تأكد أن الخادم قيد التشغيل."
                        }
                    }
                } catch (e: Exception) {
                    errorMessage = "تعذر الاتصال بالخادم: ${e.localizedMessage ?: "تأكد من عنوان الـ IP والمنفذ وأن الخادم يعمل على نفس الشبكة"}"
                } finally {
                    isConnecting = false
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
            .padding(horizontal = 20.dp, vertical = 12.dp)
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            item {
                Spacer(modifier = Modifier.height(10.dp))

                // Brand Emblem
                Box(
                    modifier = Modifier
                        .size(86.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF1E293B))
                        .border(1.5.dp, ArnEmeraldPrimary, CircleShape)
                        .clickable { showAboutDialog = true },
                    contentAlignment = Alignment.Center
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.ic_arn_logo_3d),
                        contentDescription = "ARN Stream",
                        modifier = Modifier.size(68.dp)
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = "الاتصال بخادم ARN Stream",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Black,
                    color = Color.White
                )

                Text(
                    text = "البحث والاتصال الفعلي بالخادم على الشبكة المحلية",
                    fontSize = 13.sp,
                    color = ArnTextSecondary,
                    modifier = Modifier.padding(top = 4.dp)
                )

                Spacer(modifier = Modifier.height(20.dp))

                // Scan QR Button (Opens real live CameraX viewfinder)
                Button(
                    onClick = { showCameraScanner = true },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = ArnEmeraldPrimary)
                ) {
                    Icon(
                        imageVector = Icons.Outlined.QrCodeScanner,
                        contentDescription = null,
                        modifier = Modifier.size(22.dp)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = "مسح رمز QR من شاشة الخادم بالكاميرا",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Discovered Servers Header & Refresh
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Outlined.Wifi,
                            contentDescription = null,
                            tint = ArnEmeraldPrimary,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "الخوادم الحقيقية المكتشفة (${discoveredServers.size})",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (isScanning) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp,
                                color = ArnEmeraldPrimary
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                        }
                        IconButton(
                            onClick = startDiscovery,
                            enabled = !isScanning,
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Refresh,
                                contentDescription = "إعادة البحث",
                                tint = if (isScanning) ArnTextMuted else Color.White
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))
            }

            // Discovered Servers List
            if (discoveredServers.isEmpty()) {
                item {
                    GlassCard(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        backgroundColor = Color(0x0DFFFFFF)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = if (isScanning) "جاري فحص جميع المنافذ والـ SSDP وعناوين الشبكة المحلية..." else "لم يتم العثور على خادم تلقائياً حتى الآن.",
                                color = if (isScanning) ArnEmeraldPrimary else ArnTextSecondary,
                                fontSize = 12.sp,
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "تأكد من تشغيل الخادم على الكمبيوتر، أو أدخل عنوان الـ IP والمنفذ يدوياً بالأسفل.",
                                color = ArnTextMuted,
                                fontSize = 11.sp,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            } else {
                items(discoveredServers) { server ->
                    GlassCard(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        onClick = { connectToServer(server.baseUrl) },
                        backgroundColor = Color(0x1F10B981),
                        borderColor = ArnEmeraldPrimary
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Surface(
                                        shape = CircleShape,
                                        color = ArnEmeraldPrimary,
                                        modifier = Modifier.size(8.dp)
                                    ) {}
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = server.name,
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp
                                    )
                                }
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = server.baseUrl,
                                    color = ArnEmeraldPrimary,
                                    fontSize = 12.sp
                                )
                            }
                            Button(
                                onClick = { connectToServer(server.baseUrl) },
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = ArnEmeraldPrimary),
                                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                            ) {
                                Text("اتصال", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(20.dp))

                // Manual URL Entry Card
                GlassCard(
                    modifier = Modifier.fillMaxWidth(),
                    backgroundColor = Color(0x14FFFFFF)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp)
                    ) {
                        Text(
                            text = "عنوان خادم ARN Stream:",
                            color = Color.White,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        OutlinedTextField(
                            value = serverUrlInput,
                            onValueChange = { serverUrlInput = it },
                            modifier = Modifier.fillMaxWidth(),
                            placeholder = { Text("مثال: http://192.168.1.X:8096", color = ArnTextMuted) },
                            shape = RoundedCornerShape(12.dp),
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = ArnEmeraldPrimary,
                                unfocusedBorderColor = Color(0x33FFFFFF),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            )
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        Button(
                            onClick = { connectToServer(serverUrlInput) },
                            enabled = !isConnecting && serverUrlInput.isNotBlank(),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = ArnColorMovies)
                        ) {
                            if (isConnecting) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    color = Color.White,
                                    strokeWidth = 2.dp
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("جاري فحص الاتصال بالخادم...", color = Color.White)
                            } else {
                                Icon(Icons.Default.Link, contentDescription = null)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("الاتصال بالخادم", fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        }
                    }
                }

                if (errorMessage != null) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = errorMessage ?: "",
                        color = Color(0xFFF87171),
                        fontSize = 12.sp,
                        textAlign = TextAlign.Center,
                        lineHeight = 18.sp
                    )
                }

                if (successMessage != null) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = successMessage ?: "",
                        color = ArnEmeraldPrimary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Developer credit
                Text(
                    text = "ARN Stream • تطوير وبرمجة: عبده رجب نصار (2026)",
                    color = ArnTextMuted,
                    fontSize = 11.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.clickable { showAboutDialog = true }
                )
            }
        }

        // Live CameraX QR Scanner Dialog
        CameraQrScannerDialog(
            isOpen = showCameraScanner,
            onDismiss = { showCameraScanner = false },
            onScanned = { scannedUrl ->
                serverUrlInput = scannedUrl
                connectToServer(scannedUrl)
            }
        )

        // About Dialog
        ArnAboutDialog(
            isOpen = showAboutDialog,
            onDismiss = { showAboutDialog = false }
        )
    }
}
