package com.example.ui.screens.connect

import android.Manifest
import android.content.pm.PackageManager
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.example.data.model.DiscoveredServer
import com.example.data.network.NetworkDiscoveryManager
import com.example.data.storage.PreferencesManager
import com.example.ui.components.ArnAboutDialog
import com.example.ui.components.QrCameraScannerDialog
import com.example.ui.theme.*
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch

@Composable
fun ConnectScreen(
    preferencesManager: PreferencesManager,
    onServerConnected: (String) -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val focusManager = LocalFocusManager.current

    val discoveryManager = remember { NetworkDiscoveryManager(context) }

    var ipAddressInput by remember { mutableStateOf("") }
    var portInput by remember { mutableStateOf("8096") }
    var isTestingConnection by remember { mutableStateOf(false) }
    var connectionFeedback by remember { mutableStateOf<String?>(null) }
    var isFeedbackSuccess by remember { mutableStateOf(false) }

    var isScanningNetwork by remember { mutableStateOf(false) }
    var scanProgress by remember { mutableIntStateOf(0) }
    var scanTotal by remember { mutableIntStateOf(0) }
    val discoveredServers = remember { mutableStateListOf<DiscoveredServer>() }
    val recentServers = remember { mutableStateListOf<String>() }

    var showAboutDialog by remember { mutableStateOf(false) }
    var showLiveCameraScanner by remember { mutableStateOf(false) }

    // Load recent servers
    LaunchedEffect(Unit) {
        val recents = preferencesManager.recentServers.firstOrNull() ?: emptyList()
        recentServers.clear()
        recentServers.addAll(recents)

        // Pre-fill last server if available
        val lastServer = preferencesManager.serverUrl.firstOrNull()
        if (!lastServer.isNullOrEmpty()) {
            val clean = lastServer.removePrefix("http://").removePrefix("https://")
            val parts = clean.split(":")
            if (parts.isNotEmpty()) ipAddressInput = parts[0]
            if (parts.size > 1) portInput = parts[1]
        }
    }

    val connectToServer: (String) -> Unit = { targetUrl ->
        coroutineScope.launch {
            isTestingConnection = true
            connectionFeedback = "جاري فحص الاتصال بالخادم..."
            isFeedbackSuccess = false

            val (success, message) = discoveryManager.testServerConnection(targetUrl)
            isTestingConnection = false
            connectionFeedback = message
            isFeedbackSuccess = success

            if (success) {
                preferencesManager.saveServerUrl(targetUrl)
                onServerConnected(targetUrl)
            }
        }
    }

    val startNetworkScan: () -> Unit = {
        if (!isScanningNetwork) {
            coroutineScope.launch {
                isScanningNetwork = true
                discoveredServers.clear()
                discoveryManager.scanLocalSubnet(
                    onProgress = { cur, tot ->
                        scanProgress = cur
                        scanTotal = tot
                    },
                    onServerFound = { server ->
                        if (discoveredServers.none { it.ip == server.ip && it.port == server.port }) {
                            discoveredServers.add(server)
                        }
                    }
                )
                isScanningNetwork = false
            }
        }
    }

    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            showLiveCameraScanner = true
        } else {
            Toast.makeText(context, "يلزم إذن الكاميرا لمسح كود QR الخاص بالخادم", Toast.LENGTH_SHORT).show()
        }
    }

    Scaffold(
        modifier = Modifier
            .fillMaxSize()
            .testTag("connect_screen"),
        containerColor = ArnObsidian,
        topBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(46.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(ArnNavySurface)
                            .border(1.5.dp, ArnEmeraldPrimary, RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        androidx.compose.foundation.Image(
                            painter = androidx.compose.ui.res.painterResource(id = com.example.R.drawable.img_arn_launcher_icon),
                            contentDescription = "ARN Stream Icon",
                            modifier = Modifier
                                .fillMaxSize()
                                .clip(RoundedCornerShape(12.dp))
                        )
                    }

                    Column {
                        Text(
                            text = "ARN Stream",
                            style = MaterialTheme.typography.titleMedium,
                            color = ArnTextPrimary,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "ربط خادم الوسائط",
                            style = MaterialTheme.typography.labelSmall,
                            color = ArnGoldAccent
                        )
                    }
                }

                IconButton(
                    onClick = { showAboutDialog = true },
                    modifier = Modifier.testTag("about_dialog_trigger")
                ) {
                    Icon(
                        imageVector = Icons.Default.Info,
                        contentDescription = "حول المنصة",
                        tint = ArnTextSecondary
                    )
                }
            }
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            // Header Hero Banner Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = ArnNavyCard),
                    border = CardDefaults.outlinedCardBorder().copy(brush = Brush.linearGradient(listOf(ArnBorder, ArnEmeraldPrimary.copy(alpha = 0.2f))))
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.WifiTethering,
                                contentDescription = null,
                                tint = ArnEmeraldGlow,
                                modifier = Modifier.size(28.dp)
                            )
                            Text(
                                text = "الاكتشاف الذكي والربط بالشبكة",
                                style = MaterialTheme.typography.titleMedium,
                                color = ArnTextPrimary,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        Text(
                            text = "قم بالاتصال بخادم ARN Stream Media Server في شبكتك المنزلية أو عبر الإنترنت للاستمتاع بالأفلام والمسلسلات وبث 4K في ثوانٍ.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = ArnTextSecondary,
                            lineHeight = 22.sp
                        )

                        Row(
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Button(
                                onClick = startNetworkScan,
                                enabled = !isScanningNetwork,
                                modifier = Modifier
                                    .weight(1f)
                                    .testTag("scan_network_button"),
                                colors = ButtonDefaults.buttonColors(containerColor = ArnEmeraldPrimary),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                if (isScanningNetwork) {
                                    CircularProgressIndicator(
                                        color = Color.Black,
                                        modifier = Modifier.size(18.dp),
                                        strokeWidth = 2.dp
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("جاري الفحص...", color = Color.Black, fontWeight = FontWeight.Bold)
                                } else {
                                    Icon(Icons.Default.Radar, contentDescription = null, tint = Color.Black)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("فحص الشبكة", color = Color.Black, fontWeight = FontWeight.Bold)
                                }
                            }

                            OutlinedButton(
                                onClick = {
                                    if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                                        showLiveCameraScanner = true
                                    } else {
                                        cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                                    }
                                },
                                modifier = Modifier.testTag("scan_qr_button"),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = ArnGoldAccent),
                                border = androidx.compose.foundation.BorderStroke(1.dp, ArnGoldAccent),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(Icons.Default.QrCodeScanner, contentDescription = null, tint = ArnGoldAccent)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("رمز QR", fontWeight = FontWeight.Bold)
                            }
                        }

                        if (isScanningNetwork) {
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                LinearProgressIndicator(
                                    progress = { if (scanTotal > 0) scanProgress.toFloat() / scanTotal else 0f },
                                    modifier = Modifier.fillMaxWidth(),
                                    color = ArnEmeraldPrimary,
                                    trackColor = ArnNavySurface
                                )
                                Text(
                                    text = "تم فحص $scanProgress من أصل $scanTotal عنوان محلي...",
                                    fontSize = 11.sp,
                                    color = ArnTextMuted
                                )
                            }
                        }
                    }
                }
            }

            // Discovered Servers Section
            if (discoveredServers.isNotEmpty()) {
                item {
                    Text(
                        text = "السيرفرات المكتشفة على الشبكة (${discoveredServers.size})",
                        style = MaterialTheme.typography.titleMedium,
                        color = ArnEmeraldGlow,
                        fontWeight = FontWeight.Bold
                    )
                }

                items(discoveredServers) { server ->
                    Surface(
                        onClick = { connectToServer(server.url) },
                        color = ArnNavyCard,
                        shape = RoundedCornerShape(16.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, ArnEmeraldPrimary.copy(alpha = 0.4f)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("discovered_server_${server.ip}")
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(42.dp)
                                        .clip(CircleShape)
                                        .background(ArnEmeraldPrimary.copy(alpha = 0.2f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.CheckCircle,
                                        contentDescription = null,
                                        tint = ArnEmeraldPrimary,
                                        modifier = Modifier.size(24.dp)
                                    )
                                }
                                Column {
                                    Text(
                                        text = server.name,
                                        color = ArnTextPrimary,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "${server.ip}:${server.port}",
                                        color = ArnTextSecondary,
                                        fontSize = 12.sp
                                    )
                                }
                            }

                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text(
                                    text = "${server.latencyMs}ms",
                                    color = ArnGoldAccent,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Icon(Icons.Default.ChevronLeft, contentDescription = null, tint = ArnTextMuted)
                            }
                        }
                    }
                }
            }

            // Manual Connection Section
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = ArnNavyCard),
                    border = CardDefaults.outlinedCardBorder().copy(brush = Brush.linearGradient(listOf(ArnBorder, ArnBorder)))
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Text(
                            text = "الاتصال اليدوي بعنوان الخادم",
                            style = MaterialTheme.typography.titleMedium,
                            color = ArnTextPrimary,
                            fontWeight = FontWeight.Bold
                        )

                        Text(
                            text = "أدخل عنوان IP أو النطاق ومنفذ الخادم (الافتراضي: 8096)",
                            style = MaterialTheme.typography.bodyMedium,
                            color = ArnTextSecondary
                        )

                        OutlinedTextField(
                            value = ipAddressInput,
                            onValueChange = { ipAddressInput = it },
                            label = { Text("عنوان الخادم (IP أو Domain)") },
                            placeholder = { Text("مثال: 10.133.9.152 أو stream.arn.local") },
                            leadingIcon = {
                                Icon(Icons.Default.Computer, contentDescription = null, tint = ArnEmeraldPrimary)
                            },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Uri,
                                imeAction = ImeAction.Next
                            ),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = ArnEmeraldPrimary,
                                unfocusedBorderColor = ArnBorder,
                                focusedLabelColor = ArnEmeraldPrimary,
                                cursorColor = ArnEmeraldPrimary
                            ),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("server_ip_input")
                        )

                        OutlinedTextField(
                            value = portInput,
                            onValueChange = { portInput = it },
                            label = { Text("المنفذ (Port)") },
                            placeholder = { Text("8096") },
                            leadingIcon = {
                                Icon(Icons.Default.Numbers, contentDescription = null, tint = ArnGoldAccent)
                            },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Number,
                                imeAction = ImeAction.Done
                            ),
                            keyboardActions = KeyboardActions(
                                onDone = {
                                    focusManager.clearFocus()
                                    if (ipAddressInput.isNotBlank()) {
                                        val port = portInput.ifBlank { "8096" }
                                        connectToServer("http://$ipAddressInput:$port")
                                    }
                                }
                            ),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = ArnGoldAccent,
                                unfocusedBorderColor = ArnBorder,
                                focusedLabelColor = ArnGoldAccent,
                                cursorColor = ArnGoldAccent
                            ),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("server_port_input")
                        )

                        Button(
                            onClick = {
                                focusManager.clearFocus()
                                val port = portInput.ifBlank { "8096" }
                                val fullUrl = if (ipAddressInput.startsWith("http://") || ipAddressInput.startsWith("https://")) {
                                    "$ipAddressInput:$port"
                                } else {
                                    "http://$ipAddressInput:$port"
                                }
                                connectToServer(fullUrl)
                            },
                            enabled = ipAddressInput.isNotBlank() && !isTestingConnection,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp)
                                .testTag("connect_button"),
                            colors = ButtonDefaults.buttonColors(containerColor = ArnEmeraldPrimary),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            if (isTestingConnection) {
                                CircularProgressIndicator(
                                    color = Color.Black,
                                    strokeWidth = 2.dp,
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("جاري اختبار الاتصال...", color = Color.Black, fontWeight = FontWeight.Bold)
                            } else {
                                Icon(Icons.Default.Login, contentDescription = null, tint = Color.Black)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("اتصال بالخادم الآن", color = Color.Black, fontWeight = FontWeight.Bold)
                            }
                        }

                        // Feedback message
                        if (connectionFeedback != null) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (isFeedbackSuccess) ArnEmeraldPrimary.copy(alpha = 0.15f) else ArnError.copy(alpha = 0.15f))
                                    .padding(12.dp)
                            ) {
                                Text(
                                    text = connectionFeedback!!,
                                    color = if (isFeedbackSuccess) ArnEmeraldGlow else ArnError,
                                    fontSize = 13.sp,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                    }
                }
            }

            // Recent Servers Section
            if (recentServers.isNotEmpty()) {
                item {
                    Text(
                        text = "السيرفرات السابقة",
                        style = MaterialTheme.typography.titleMedium,
                        color = ArnTextPrimary,
                        fontWeight = FontWeight.Bold
                    )
                }

                items(recentServers) { url ->
                    Surface(
                        onClick = { connectToServer(url) },
                        color = ArnNavySurface,
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("recent_server_item")
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Icon(Icons.Default.History, contentDescription = null, tint = ArnGoldAccent)
                                Text(
                                    text = url,
                                    color = ArnTextPrimary,
                                    fontSize = 14.sp
                                )
                            }
                            Icon(Icons.Default.ArrowForwardIos, contentDescription = null, tint = ArnTextMuted, modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }

            // Quick default helpers
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "عناوين افتراضية سريعة للتجربة:",
                        color = ArnTextMuted,
                        fontSize = 12.sp
                    )
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        SuggestionChip(
                            onClick = {
                                ipAddressInput = "10.133.9.152"
                                portInput = "8096"
                            },
                            label = { Text("10.133.9.152") },
                            colors = SuggestionChipDefaults.suggestionChipColors(
                                labelColor = ArnEmeraldGlow,
                                containerColor = ArnNavySurface
                            )
                        )
                        SuggestionChip(
                            onClick = {
                                ipAddressInput = "192.168.1.100"
                                portInput = "8096"
                            },
                            label = { Text("192.168.1.100") },
                            colors = SuggestionChipDefaults.suggestionChipColors(
                                labelColor = ArnGoldAccent,
                                containerColor = ArnNavySurface
                            )
                        )
                    }
                }
            }
        }
    }

    // Live Camera QR Scanner Dialog
    if (showLiveCameraScanner) {
        QrCameraScannerDialog(
            onDismiss = { showLiveCameraScanner = false },
            onQrCodeDetected = { scannedUrl ->
                showLiveCameraScanner = false
                val normalized = com.example.util.UrlParser.normalizeServerUrl(scannedUrl)
                connectToServer(normalized)
            }
        )
    }

    ArnAboutDialog(isOpen = showAboutDialog, onDismiss = { showAboutDialog = false })
}
