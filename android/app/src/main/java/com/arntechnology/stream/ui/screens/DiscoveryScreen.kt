package com.arntechnology.stream.ui.screens

import android.widget.Toast
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.arntechnology.stream.data.api.NetworkClient
import com.arntechnology.stream.data.discovery.ServerDiscoveryManager
import com.arntechnology.stream.data.local.SessionPreferences
import com.arntechnology.stream.data.model.DiscoveredServer
import com.arntechnology.stream.ui.components.GlassCard
import com.arntechnology.stream.ui.theme.ArnEmerald
import com.arntechnology.stream.ui.theme.DarkBackground
import com.arntechnology.stream.ui.theme.TextPrimary
import com.arntechnology.stream.ui.theme.TextSecondary
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DiscoveryScreen(
    onServerSelected: () -> Unit
) {
    val context = LocalContext.getContext()
    val scope = rememberCoroutineScope()
    val prefs = remember { SessionPreferences(context) }
    
    var isDiscovering by remember { mutableStateOf(false) }
    var servers by remember { mutableStateOf<List<DiscoveredServer>>(emptyList()) }
    var manualIp by remember { mutableStateOf("") }
    var isTesting by remember { mutableStateOf(false) }

    val discoveryManager = remember { ServerDiscoveryManager(context) }

    // Start discovery automatically
    LaunchedEffect(Unit) {
        startDiscovery(
            discoveryManager, 
            onStateChanged = { isDiscovering = it },
            onServerFound = { newServer ->
                if (!servers.any { it.baseUrl == newServer.baseUrl }) {
                    servers = servers + newServer
                }
            }
        )
    }

    Scaffold(
        containerColor = DarkBackground,
        topBar = {
            TopAppBar(
                title = { Text("البحث عن الخادم", color = ArnEmerald, fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DarkBackground),
                actions = {
                    val infiniteTransition = rememberInfiniteTransition(label = "")
                    val angle by infiniteTransition.animateFloat(
                        initialValue = 0f,
                        targetValue = 360f,
                        animationSpec = infiniteRepeatable(
                            animation = tween(1000, easing = LinearEasing)
                        ), label = ""
                    )
                    
                    IconButton(
                        onClick = {
                            servers = emptyList()
                            startDiscovery(
                                discoveryManager, 
                                onStateChanged = { isDiscovering = it },
                                onServerFound = { newServer ->
                                    if (!servers.any { it.baseUrl == newServer.baseUrl }) {
                                        servers = servers + newServer
                                    }
                                }
                            )
                        }
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "تحديث",
                            tint = ArnEmerald,
                            modifier = if (isDiscovering) Modifier.rotate(angle) else Modifier
                        )
                    }
                }
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
            
            Icon(
                imageVector = Icons.Default.Search,
                contentDescription = null,
                tint = ArnEmerald.copy(alpha = 0.5f),
                modifier = Modifier.size(80.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            
            Text(
                text = "جاري البحث عن سيرفرات ARN Stream في شبكتك المحلية...",
                color = TextSecondary,
                fontSize = 14.sp,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(32.dp))

            if (servers.isEmpty()) {
                if (isDiscovering) {
                    CircularProgressIndicator(color = ArnEmerald)
                } else {
                    Text("لم يتم العثور على أي سيرفر.", color = Color.Red, fontSize = 14.sp)
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(servers) { server ->
                        ServerItemCard(
                            server = server,
                            onClick = {
                                scope.launch {
                                    prefs.saveServerUrl(server.baseUrl)
                                    onServerSelected()
                                }
                            }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.weight(if (servers.isEmpty()) 1f else 0.1f))

            // Manual IP Entry
            Text("أو إدخال عنوان IP يدوياً", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = manualIp,
                onValueChange = { manualIp = it },
                placeholder = { Text("مثال: 192.168.1.100:8096") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = ArnEmerald,
                    unfocusedBorderColor = TextSecondary,
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary
                )
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = {
                    if (manualIp.isNotBlank()) {
                        scope.launch {
                            isTesting = true
                            try {
                                val url = if (manualIp.startsWith("http")) manualIp else "http://$manualIp"
                                val client = NetworkClient(context)
                                val api = client.getApiServiceForUrl(url)
                                val response = api.getServerStatus()
                                if (response.isSuccessful) {
                                    prefs.saveServerUrl(url)
                                    onServerSelected()
                                } else {
                                    Toast.makeText(context, "فشل الاتصال بالخادم", Toast.LENGTH_SHORT).show()
                                }
                            } catch (e: Exception) {
                                Toast.makeText(context, "تأكد من العنوان وحاول مجدداً", Toast.LENGTH_SHORT).show()
                            } finally {
                                isTesting = false
                            }
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth().height(50.dp),
                colors = ButtonDefaults.buttonColors(containerColor = ArnEmerald),
                shape = RoundedCornerShape(12.dp),
                enabled = !isTesting
            ) {
                if (isTesting) {
                    CircularProgressIndicator(color = DarkBackground, modifier = Modifier.size(24.dp))
                } else {
                    Text("اتصال يدوي", color = DarkBackground, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }
        }
    }
}

@Composable
fun ServerItemCard(server: DiscoveredServer, onClick: () -> Unit) {
    GlassCard(
        modifier = Modifier
            .fillMaxWidth()
            .height(80.dp)
            .clickable { onClick() },
        cornerRadius = 16.dp
    ) {
        Row(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Dns,
                contentDescription = null,
                tint = ArnEmerald,
                modifier = Modifier.size(32.dp)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column {
                Text(
                    text = server.name,
                    color = TextPrimary,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = server.baseUrl,
                    color = TextSecondary,
                    fontSize = 14.sp
                )
            }
        }
    }
}

private fun kotlinx.coroutines.CoroutineScope.startDiscovery(
    manager: ServerDiscoveryManager,
    onStateChanged: (Boolean) -> Unit,
    onServerFound: (DiscoveredServer) -> Unit
) {
    launch {
        onStateChanged(true)
        try {
            manager.startDiscovery().collect { server ->
                onServerFound(server)
            }
        } finally {
            onStateChanged(false)
        }
    }
}
