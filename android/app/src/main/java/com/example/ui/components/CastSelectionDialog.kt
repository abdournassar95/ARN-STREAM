package com.example.ui.components

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.animation.*
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
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.example.data.api.ApiClient
import com.example.data.model.HandoffDevice
import com.example.data.repository.MediaRepository
import com.example.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun CastSelectionDialog(
    mediaTitle: String? = null,
    mediaType: String? = null,
    mediaId: Int? = null,
    streamUrl: String? = null,
    currentPositionSec: Long = 0L,
    onDismiss: () -> Unit,
    onOpenRemote: ((HandoffDevice) -> Unit)? = null
) {
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current
    val coroutineScope = rememberCoroutineScope()

    var activeTab by remember { mutableStateOf(0) } // 0: Screens, 1: External Apps, 2: Web TV, 3: Add IP
    var devices by remember { mutableStateOf<List<HandoffDevice>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var isCasting by remember { mutableStateOf(false) }
    var castStatusMessage by remember { mutableStateOf<String?>(null) }
    var manualIpInput by remember { mutableStateOf("") }
    var manualNameInput by remember { mutableStateOf("") }

    val resolvedStreamUrl = remember(streamUrl, mediaType, mediaId) {
        if (!streamUrl.isNullOrBlank()) streamUrl
        else if (mediaType != null && mediaId != null) {
            ApiClient.getFullMediaUrl("api/stream/$mediaType/$mediaId")
        } else {
            ApiClient.getBaseUrl()
        }
    }

    val refreshDevices: () -> Unit = {
        isLoading = true
        coroutineScope.launch {
            devices = MediaRepository.getAvailableDevices()
            isLoading = false
        }
    }

    LaunchedEffect(Unit) {
        refreshDevices()
    }

    fun launchExternalCastApp() {
        try {
            val uri = Uri.parse(resolvedStreamUrl)
            val mimeType = if (mediaType == "audio" || mediaType == "track") "audio/*" else "video/*"
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, mimeType)
                putExtra(Intent.EXTRA_TITLE, mediaTitle ?: "ARN Stream")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val chooser = Intent.createChooser(intent, "اختر تطبيق البث أو المشغل الخارجي (Web Video Caster / VLC)")
            chooser.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            context.startActivity(chooser)
            Toast.makeText(context, "جاري فتح مشغل أو تطبيق البث للشاشة...", Toast.LENGTH_SHORT).show()
            onDismiss()
        } catch (e: Exception) {
            Toast.makeText(context, "تعذر فتح مشغل خارجي: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            shape = RoundedCornerShape(26.dp),
            color = Color(0xFF0B1120),
            modifier = Modifier
                .fillMaxWidth(0.94f)
                .widthIn(max = 500.dp)
                .padding(12.dp)
                .border(1.2.dp, Color(0x3310B981), RoundedCornerShape(26.dp))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
            ) {
                // Dialog Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(42.dp)
                                .clip(CircleShape)
                                .background(ArnEmeraldPrimary.copy(alpha = 0.2f))
                                .border(1.dp, ArnEmeraldPrimary.copy(alpha = 0.5f), CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Cast,
                                contentDescription = "بث",
                                tint = ArnEmeraldPrimary,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "البث الذكي للشاشات (Smart Cast)",
                                fontWeight = FontWeight.Black,
                                color = Color.White,
                                fontSize = 16.sp
                            )
                            Text(
                                text = if (!mediaTitle.isNullOrEmpty()) "المحتوى: $mediaTitle" else "بث الوسائط إلى الشاشات والأجهزة",
                                color = ArnTextSecondary,
                                fontSize = 11.sp,
                                maxLines = 1
                            )
                        }
                    }

                    IconButton(
                        onClick = { refreshDevices() },
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(Color(0x1AFFFFFF))
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "إعادة البحث",
                            tint = ArnGoldAccent,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Mode Tabs
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFF161F30))
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    val tabs = listOf("الشاشات", "بث خارجي", "متصفح TV", "+ إضافة IP")
                    tabs.forEachIndexed { idx, title ->
                        val isSelected = activeTab == idx
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isSelected) ArnEmeraldPrimary else Color.Transparent)
                                .clickable { activeTab = idx }
                                .padding(vertical = 7.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = title,
                                color = if (isSelected) Color.White else ArnTextSecondary,
                                fontSize = 11.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Cast Status / Feedback Message
                if (castStatusMessage != null) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = ArnEmeraldPrimary.copy(alpha = 0.15f),
                        border = androidx.compose.foundation.BorderStroke(1.dp, ArnEmeraldPrimary.copy(alpha = 0.5f)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 12.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = ArnEmeraldPrimary, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = castStatusMessage ?: "",
                                color = Color.White,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                // Tab Content
                when (activeTab) {
                    0 -> {
                        // TAB 0: Discovered Smart Screens
                        if (isLoading) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(160.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    CircularProgressIndicator(color = ArnEmeraldPrimary, modifier = Modifier.size(32.dp))
                                    Spacer(modifier = Modifier.height(10.dp))
                                    Text("جاري فحص الشاشات على الشبكة والخادم...", color = ArnTextSecondary, fontSize = 12.sp)
                                }
                            }
                        } else if (devices.isEmpty()) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 16.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Icon(Icons.Outlined.Tv, contentDescription = null, tint = ArnTextSecondary, modifier = Modifier.size(40.dp))
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text("لم يتم العثور على شاشات متصلة بالخادم تلقائياً", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        "يمكنك استخدام تبويب 'بث خارجي' للبث لأي شاشة، أو إضافة IP الشاشة يدوياً",
                                        color = ArnTextSecondary,
                                        fontSize = 11.sp,
                                        textAlign = TextAlign.Center
                                    )
                                    Spacer(modifier = Modifier.height(12.dp))
                                    Button(
                                        onClick = { activeTab = 1 },
                                        colors = ButtonDefaults.buttonColors(containerColor = ArnEmeraldPrimary),
                                        shape = RoundedCornerShape(10.dp)
                                    ) {
                                        Text("تجربة البث الخارجي", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        } else {
                            Text(
                                text = "الشاشات والأجهزة الجاهزة (${devices.size}):",
                                color = Color.White,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(bottom = 6.dp)
                            )
                            LazyColumn(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .heightIn(max = 240.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                items(devices) { device ->
                                    val isManual = device.id.startsWith("manual_")
                                    Surface(
                                        shape = RoundedCornerShape(14.dp),
                                        color = Color(0xFF161F30),
                                        border = androidx.compose.foundation.BorderStroke(
                                            1.dp,
                                            if (device.isCurrent) ArnEmeraldPrimary else Color(0x33FFFFFF)
                                        ),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(12.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                modifier = Modifier.weight(1f)
                                            ) {
                                                Icon(
                                                    imageVector = if (device.type == "tv") Icons.Outlined.Tv else Icons.Outlined.Cast,
                                                    contentDescription = null,
                                                    tint = ArnGoldAccent,
                                                    modifier = Modifier.size(24.dp)
                                                )
                                                Spacer(modifier = Modifier.width(10.dp))
                                                Column {
                                                    Text(
                                                        text = device.name,
                                                        color = Color.White,
                                                        fontWeight = FontWeight.Bold,
                                                        fontSize = 13.sp
                                                    )
                                                    Text(
                                                        text = if (device.ip != null) "جاهز • IP: ${device.ip}" else "متصل بالخادم",
                                                        color = ArnEmeraldPrimary,
                                                        fontSize = 11.sp
                                                    )
                                                }
                                            }

                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                if (isManual) {
                                                    IconButton(
                                                        onClick = {
                                                            MediaRepository.removeManualDevice(device.id)
                                                            refreshDevices()
                                                        },
                                                        modifier = Modifier.size(32.dp)
                                                    ) {
                                                        Icon(Icons.Default.Delete, contentDescription = "حذف", tint = Color.Red.copy(alpha = 0.7f), modifier = Modifier.size(16.dp))
                                                    }
                                                    Spacer(modifier = Modifier.width(4.dp))
                                                }

                                                Button(
                                                    onClick = {
                                                        if (mediaType != null && mediaId != null) {
                                                            isCasting = true
                                                            coroutineScope.launch {
                                                                val ok = MediaRepository.transferPlayback(
                                                                    targetDeviceId = device.id,
                                                                    mediaType = mediaType,
                                                                    mediaId = mediaId,
                                                                    title = mediaTitle,
                                                                    positionSec = currentPositionSec
                                                                )
                                                                isCasting = false
                                                                castStatusMessage = if (ok) "تم إرسال أمر التشغيل بنجاح إلى: ${device.name}" else "تم إرسال إشارة البث للشاشة"
                                                                delay(900)
                                                                onOpenRemote?.invoke(device)
                                                                onDismiss()
                                                            }
                                                        } else {
                                                            onOpenRemote?.invoke(device)
                                                            onDismiss()
                                                        }
                                                    },
                                                    colors = ButtonDefaults.buttonColors(containerColor = ArnEmeraldPrimary),
                                                    shape = RoundedCornerShape(10.dp),
                                                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                                                ) {
                                                    Text("بث الآن", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    1 -> {
                        // TAB 1: External Cast Apps (Web Video Caster, BubbleUPnP, VLC)
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 6.dp)
                        ) {
                            Surface(
                                shape = RoundedCornerShape(16.dp),
                                color = Color(0xFF161F30),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x33FFFFFF)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Default.Share, contentDescription = null, tint = ArnEmeraldPrimary, modifier = Modifier.size(24.dp))
                                        Spacer(modifier = Modifier.width(10.dp))
                                        Text(
                                            text = "بث فوري عبر تطبيقات التلفاز والمشغلات",
                                            fontWeight = FontWeight.Bold,
                                            color = Color.White,
                                            fontSize = 13.sp
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = "يدعم الإرسال الفوري لجميع شاشات التلفاز الذكية (Samsung Tizen, LG webOS, Android TV, Apple TV, Roku, Chromecast) عبر تطبيقات مثل Web Video Caster أو VLC أو المشغلات الخارجية.",
                                        color = ArnTextSecondary,
                                        fontSize = 11.sp,
                                        lineHeight = 16.sp
                                    )
                                    Spacer(modifier = Modifier.height(14.dp))
                                    Button(
                                        onClick = { launchExternalCastApp() },
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = ButtonDefaults.buttonColors(containerColor = ArnEmeraldPrimary),
                                        shape = RoundedCornerShape(10.dp)
                                    ) {
                                        Icon(Icons.Outlined.CastConnected, contentDescription = null, modifier = Modifier.size(18.dp))
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text("فتح قائمة البث الخارجية", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            OutlinedButton(
                                onClick = {
                                    clipboardManager.setText(AnnotatedString(resolvedStreamUrl))
                                    Toast.makeText(context, "تم نسخ رابط البث المباشر للذاكرة!", Toast.LENGTH_SHORT).show()
                                },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(10.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x4DFFFFFF))
                            ) {
                                Icon(Icons.Default.ContentCopy, contentDescription = null, tint = ArnGoldAccent, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("نسخ رابط البث المباشر (Stream URL)", color = Color.White, fontSize = 12.sp)
                            }
                        }
                    }

                    2 -> {
                        // TAB 2: Web TV Browser Link
                        val webTvUrl = remember {
                            val base = ApiClient.getBaseUrl().trimEnd('/')
                            if (base.isNotEmpty()) "$base/tv" else "http://127.0.0.1:8096/tv"
                        }
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 6.dp)
                        ) {
                            Surface(
                                shape = RoundedCornerShape(16.dp),
                                color = Color(0xFF161F30),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x33FFFFFF)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Outlined.Language, contentDescription = null, tint = ArnGoldAccent, modifier = Modifier.size(24.dp))
                                        Spacer(modifier = Modifier.width(10.dp))
                                        Text(
                                            text = "عرض عبر متصفح الشاشة الذكية (Web TV)",
                                            fontWeight = FontWeight.Bold,
                                            color = Color.White,
                                            fontSize = 13.sp
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = "افتح المتصفح على شاشة التلفاز واكتب الرابط التالي لتحويل الشاشة إلى مستقبل بث متكامل:",
                                        color = ArnTextSecondary,
                                        fontSize = 11.sp
                                    )
                                    Spacer(modifier = Modifier.height(10.dp))
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = Color(0xFF0F172A),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Text(
                                            text = webTvUrl,
                                            color = ArnEmeraldPrimary,
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.padding(10.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(12.dp))
                                    Button(
                                        onClick = {
                                            clipboardManager.setText(AnnotatedString(webTvUrl))
                                            Toast.makeText(context, "تم نسخ رابط التلفاز للذاكرة!", Toast.LENGTH_SHORT).show()
                                        },
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = ButtonDefaults.buttonColors(containerColor = ArnGoldAccent),
                                        shape = RoundedCornerShape(10.dp)
                                    ) {
                                        Icon(Icons.Default.ContentCopy, contentDescription = null, tint = Color.Black, modifier = Modifier.size(16.dp))
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text("نسخ رابط متصفح التلفاز", color = Color.Black, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                    }
                                }
                            }
                        }
                    }

                    3 -> {
                        // TAB 3: Add Manual IP
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 6.dp)
                        ) {
                            Text("أدخل عنوان IP للشاشة الذكية على شبكتك:", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(8.dp))
                            OutlinedTextField(
                                value = manualNameInput,
                                onValueChange = { manualNameInput = it },
                                label = { Text("اسم الشاشة (اختياري: مثلاً شاشة الصالة)", fontSize = 11.sp) },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = ArnEmeraldPrimary,
                                    unfocusedBorderColor = Color(0x33FFFFFF),
                                    focusedTextColor = Color.White,
                                    unfocusedTextColor = Color.White
                                )
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            OutlinedTextField(
                                value = manualIpInput,
                                onValueChange = { manualIpInput = it },
                                label = { Text("عنوان IP (مثال: 192.168.1.55)", fontSize = 11.sp) },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = ArnEmeraldPrimary,
                                    unfocusedBorderColor = Color(0x33FFFFFF),
                                    focusedTextColor = Color.White,
                                    unfocusedTextColor = Color.White
                                )
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Button(
                                onClick = {
                                    val ip = manualIpInput.trim()
                                    if (ip.isNotEmpty()) {
                                        val name = if (manualNameInput.isNotBlank()) manualNameInput.trim() else "شاشة ذكية ($ip)"
                                        MediaRepository.addManualDevice(ip, name)
                                        refreshDevices()
                                        activeTab = 0
                                        manualIpInput = ""
                                        manualNameInput = ""
                                        Toast.makeText(context, "تم حفظ الشاشة وإضافتها للقائمة!", Toast.LENGTH_SHORT).show()
                                    } else {
                                        Toast.makeText(context, "يرجى إدخال عنوان IP صالح", Toast.LENGTH_SHORT).show()
                                    }
                                },
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(containerColor = ArnEmeraldPrimary),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("حفظ الشاشة والبدء", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Footer close button
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("إغلاق", color = ArnTextSecondary, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}
