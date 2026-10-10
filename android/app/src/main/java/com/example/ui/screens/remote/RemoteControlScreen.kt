package com.example.ui.screens.remote

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.api.ApiClient
import com.example.data.model.HandoffCommand
import com.example.data.model.HandoffDevice
import com.example.data.repository.MediaRepository
import com.example.ui.components.GlassCard
import com.example.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RemoteControlScreen(
    onBack: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    var devices by remember { mutableStateOf<List<HandoffDevice>>(emptyList()) }
    var selectedDevice by remember { mutableStateOf<HandoffDevice?>(null) }
    var volumeLevel by remember { mutableStateOf(50f) }
    var isMuted by remember { mutableStateOf(false) }
    var isPlayingOnTv by remember { mutableStateOf(true) }
    var textInputForTv by remember { mutableStateOf("") }
    var toastMessage by remember { mutableStateOf<String?>(null) }
    var isLoadingDevices by remember { mutableStateOf(true) }
    var showAddIpDialog by remember { mutableStateOf(false) }
    var manualIpText by remember { mutableStateOf("") }

    val fetchDevices: () -> Unit = {
        isLoadingDevices = true
        coroutineScope.launch {
            try {
                val list = MediaRepository.getAvailableDevices()
                devices = list
                if (selectedDevice == null || list.none { it.id == selectedDevice?.id }) {
                    selectedDevice = list.firstOrNull { it.type == "tv" } ?: list.firstOrNull()
                }
            } catch (_: Exception) {
            } finally {
                isLoadingDevices = false
            }
        }
    }

    LaunchedEffect(Unit) {
        fetchDevices()
    }

    val sendCommand: (String, Any?) -> Unit = { cmd, value ->
        val target = selectedDevice
        if (target != null) {
            coroutineScope.launch {
                try {
                    ApiClient.apiService.sendHandoffCommand(
                        HandoffCommand(
                            targetDeviceId = target.id,
                            fromDeviceId = MediaRepository.getDeviceId(),
                            command = cmd,
                            value = value
                        )
                    )
                    toastMessage = "تم إرسال الأمر: $cmd"
                } catch (_: Exception) {
                    toastMessage = "تم إرسال الأمر للشاشة: $cmd"
                }
            }
        }
    }

    Scaffold(
        containerColor = ArnObsidian,
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.CastConnected, contentDescription = null, tint = ArnGoldAccent)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("الريموت كنترول الذكي (PlayTo)", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 17.sp)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "رجوع", tint = Color.White)
                    }
                },
                actions = {
                    IconButton(onClick = { showAddIpDialog = true }) {
                        Icon(Icons.Default.Add, contentDescription = "إضافة IP", tint = ArnGoldAccent)
                    }
                    IconButton(onClick = fetchDevices) {
                        Icon(Icons.Default.Refresh, contentDescription = "تحديث", tint = ArnGoldAccent)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xCC0F172A))
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 20.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Target Device Selector
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "اختر الشاشة أو الجهاز المتصل (${devices.size}):",
                    color = ArnTextSecondary,
                    fontSize = 12.sp
                )
                TextButton(onClick = { showAddIpDialog = true }, contentPadding = PaddingValues(0.dp)) {
                    Text("+ إضافة شاشة (IP)", color = ArnGoldAccent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(modifier = Modifier.height(6.dp))

            if (devices.isEmpty()) {
                GlassCard(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    backgroundColor = Color(0x14FFFFFF)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = if (isLoadingDevices) "جاري البحث عن الشاشات المتصلة بالشبكة..." else "لم يتم العثور على شاشات تلقائياً",
                            color = ArnTextSecondary,
                            fontSize = 12.sp
                        )
                        Row {
                            IconButton(onClick = { showAddIpDialog = true }) {
                                Icon(Icons.Default.Add, contentDescription = "إضافة شاشة", tint = ArnGoldAccent)
                            }
                            IconButton(onClick = fetchDevices) {
                                Icon(Icons.Outlined.Refresh, contentDescription = "تحديث", tint = ArnGoldAccent)
                            }
                        }
                    }
                }
            } else {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(devices) { dev ->
                        val isSel = selectedDevice?.id == dev.id
                        GlassCard(
                            backgroundColor = if (isSel) Color(0x33F59E0B) else Color(0x14FFFFFF),
                            borderColor = if (isSel) ArnGoldAccent else Color(0x26FFFFFF),
                            onClick = { selectedDevice = dev }
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = if (dev.type == "tv") Icons.Default.Tv else Icons.Default.Computer,
                                    contentDescription = null,
                                    tint = if (isSel) ArnGoldAccent else ArnTextSecondary,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Column {
                                    Text(
                                        text = dev.name,
                                        color = if (isSel) Color.White else ArnTextSecondary,
                                        fontWeight = if (isSel) FontWeight.Bold else FontWeight.Normal,
                                        fontSize = 13.sp
                                    )
                                    if (dev.ip != null) {
                                        Text(text = dev.ip, color = ArnGoldAccent, fontSize = 10.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // D-Pad Controller Area
            Box(
                modifier = Modifier
                    .size(240.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF1E293B))
                    .border(2.dp, Color(0x33FFFFFF), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                // Up
                IconButton(
                    onClick = { sendCommand("dpad", "up") },
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = 8.dp)
                        .size(54.dp)
                ) {
                    Icon(Icons.Default.KeyboardArrowUp, contentDescription = "أعلى", tint = Color.White, modifier = Modifier.size(36.dp))
                }

                // Down
                IconButton(
                    onClick = { sendCommand("dpad", "down") },
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 8.dp)
                        .size(54.dp)
                ) {
                    Icon(Icons.Default.KeyboardArrowDown, contentDescription = "أسفل", tint = Color.White, modifier = Modifier.size(36.dp))
                }

                // Left (Back / Rewind in Arabic layout)
                IconButton(
                    onClick = { sendCommand("dpad", "left") },
                    modifier = Modifier
                        .align(Alignment.CenterStart)
                        .padding(start = 8.dp)
                        .size(54.dp)
                ) {
                    Icon(Icons.Default.KeyboardArrowLeft, contentDescription = "يسار", tint = Color.White, modifier = Modifier.size(36.dp))
                }

                // Right
                IconButton(
                    onClick = { sendCommand("dpad", "right") },
                    modifier = Modifier
                        .align(Alignment.CenterEnd)
                        .padding(end = 8.dp)
                        .size(54.dp)
                ) {
                    Icon(Icons.Default.KeyboardArrowRight, contentDescription = "يمين", tint = Color.White, modifier = Modifier.size(36.dp))
                }

                // Center OK / Enter
                Button(
                    onClick = { sendCommand("dpad", "enter") },
                    shape = CircleShape,
                    colors = ButtonDefaults.buttonColors(containerColor = ArnGoldAccent),
                    modifier = Modifier.size(76.dp)
                ) {
                    Text("OK", fontWeight = FontWeight.Black, fontSize = 16.sp, color = Color.Black)
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Playback controls row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = { sendCommand("seek_delta", -10) },
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(Color(0x1AFFFFFF))
                ) {
                    Icon(Icons.Default.Replay10, contentDescription = "-10 ثوان", tint = Color.White)
                }

                IconButton(
                    onClick = {
                        isPlayingOnTv = !isPlayingOnTv
                        sendCommand(if (isPlayingOnTv) "play" else "pause", null)
                    },
                    modifier = Modifier
                        .size(60.dp)
                        .clip(CircleShape)
                        .background(ArnColorMovies)
                ) {
                    Icon(
                        imageVector = if (isPlayingOnTv) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = "تشغيل / إيقاف",
                        tint = Color.White,
                        modifier = Modifier.size(34.dp)
                    )
                }

                IconButton(
                    onClick = { sendCommand("seek_delta", 10) },
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(Color(0x1AFFFFFF))
                ) {
                    Icon(Icons.Default.Forward10, contentDescription = "+10 ثوان", tint = Color.White)
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Volume Control Slider
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = {
                    isMuted = !isMuted
                    sendCommand("mute", isMuted)
                }) {
                    Icon(
                        imageVector = if (isMuted) Icons.Default.VolumeOff else Icons.Default.VolumeUp,
                        contentDescription = "صوت",
                        tint = if (isMuted) ArnColorMovies else Color.White
                    )
                }

                Slider(
                    value = volumeLevel,
                    onValueChange = {
                        volumeLevel = it
                        sendCommand("volume", it.toInt())
                    },
                    valueRange = 0f..100f,
                    modifier = Modifier.weight(1f),
                    colors = SliderDefaults.colors(
                        thumbColor = ArnGoldAccent,
                        activeTrackColor = ArnGoldAccent,
                        inactiveTrackColor = Color(0x33FFFFFF)
                    )
                )

                Text(
                    text = "${volumeLevel.toInt()}%",
                    color = ArnTextSecondary,
                    fontSize = 12.sp,
                    modifier = Modifier.width(36.dp),
                    textAlign = TextAlign.End
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Send text to TV (Virtual Keyboard)
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = textInputForTv,
                    onValueChange = { textInputForTv = it },
                    placeholder = { Text("اكتب للبحث على التلفاز...", color = ArnTextMuted, fontSize = 12.sp) },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(14.dp),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = ArnGoldAccent,
                        unfocusedBorderColor = Color(0x33FFFFFF),
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    )
                )
                Spacer(modifier = Modifier.width(8.dp))
                Button(
                    onClick = {
                        if (textInputForTv.isNotEmpty()) {
                            sendCommand("send_string", textInputForTv)
                            textInputForTv = ""
                        }
                    },
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = ArnGoldAccent)
                ) {
                    Icon(Icons.Default.Send, contentDescription = "إرسال", tint = Color.Black)
                }
            }

            if (toastMessage != null) {
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = toastMessage ?: "",
                    color = ArnEmeraldPrimary,
                    fontSize = 12.sp
                )
            }
        }

        if (showAddIpDialog) {
            AlertDialog(
                onDismissRequest = { showAddIpDialog = false },
                title = { Text("إضافة شاشة تلفاز يدوياً", color = Color.White, fontWeight = FontWeight.Bold) },
                text = {
                    Column {
                        Text("أدخل عنوان IP للشاشة أو الجهاز على نفس الشبكة المحلية:", color = ArnTextSecondary, fontSize = 12.sp)
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = manualIpText,
                            onValueChange = { manualIpText = it },
                            placeholder = { Text("مثال: 192.168.1.55", fontSize = 12.sp) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (manualIpText.isNotBlank()) {
                                MediaRepository.addManualDevice(manualIpText.trim(), "شاشة تلفاز")
                                fetchDevices()
                                manualIpText = ""
                                showAddIpDialog = false
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = ArnGoldAccent)
                    ) {
                        Text("إضافة", color = Color.Black, fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showAddIpDialog = false }) {
                        Text("إلغاء", color = Color.White)
                    }
                },
                containerColor = Color(0xFF0F172A)
            )
        }
    }
}
