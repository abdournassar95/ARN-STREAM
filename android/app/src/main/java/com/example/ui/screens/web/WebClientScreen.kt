package com.example.ui.screens.web

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ContextWrapper
import android.content.pm.ActivityInfo
import android.graphics.Bitmap
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.*
import android.widget.FrameLayout
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.example.data.storage.PreferencesManager
import com.example.ui.components.ArnAboutDialog
import com.example.ui.theme.*
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch

@SuppressLint("SetJavaScriptEnabled")
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WebClientScreen(
    preferencesManager: PreferencesManager,
    initialUrl: String? = null,
    onSwitchServer: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    val activity = remember(context) {
        var ctx = context
        while (ctx is ContextWrapper) {
            if (ctx is Activity) break
            ctx = ctx.baseContext
        }
        ctx as? Activity
    }

    var targetUrl by remember { mutableStateOf<String?>(initialUrl) }
    var webViewInstance by remember { mutableStateOf<WebView?>(null) }
    var isPageLoading by remember { mutableStateOf(true) }
    var loadProgress by remember { mutableIntStateOf(0) }
    var connectionError by remember { mutableStateOf<String?>(null) }
    var showExitDialog by remember { mutableStateOf(false) }
    var showMenuSheet by remember { mutableStateOf(false) }
    var showAboutDialog by remember { mutableStateOf(false) }

    var isFullscreenVideo by remember { mutableStateOf(false) }
    var customVideoView by remember { mutableStateOf<View?>(null) }
    var customViewCallback by remember { mutableStateOf<WebChromeClient.CustomViewCallback?>(null) }

    LaunchedEffect(Unit) {
        if (targetUrl.isNullOrEmpty()) {
            val saved = preferencesManager.serverUrl.firstOrNull()
            if (!saved.isNullOrEmpty()) {
                val formatted = if (saved.startsWith("http://") || saved.startsWith("https://")) saved else "http://$saved"
                targetUrl = if (formatted.endsWith("/")) formatted else "$formatted/"
            } else {
                onSwitchServer()
            }
        } else {
            val raw = targetUrl!!
            val formatted = if (raw.startsWith("http://") || raw.startsWith("https://")) raw else "http://$raw"
            targetUrl = if (formatted.endsWith("/")) formatted else "$formatted/"
        }
    }

    val exitFullscreenVideo: () -> Unit = {
        customViewCallback?.onCustomViewHidden()
        customViewCallback = null
        customVideoView = null
        isFullscreenVideo = false
        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        activity?.window?.let { win ->
            win.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            WindowInsetsControllerCompat(win, win.decorView).show(WindowInsetsCompat.Type.systemBars())
        }
    }

    BackHandler {
        when {
            isFullscreenVideo -> exitFullscreenVideo()
            webViewInstance?.canGoBack() == true -> webViewInstance?.goBack()
            else -> showExitDialog = true
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ArnObsidian)
            .testTag("web_client_screen")
    ) {
        if (targetUrl != null) {
            // Apply statusBarsPadding ONLY when NOT in fullscreen video mode
            // This prevents the web page header from being covered by the status bar!
            Box(
                modifier = if (!isFullscreenVideo) {
                    Modifier
                        .fillMaxSize()
                        .statusBarsPadding()
                } else {
                    Modifier.fillMaxSize()
                }
            ) {
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { ctx ->
                        val rootContainer = FrameLayout(ctx).apply {
                            layoutParams = ViewGroup.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                            )
                        }

                        val webView = WebView(ctx).apply {
                            layoutParams = ViewGroup.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                            )
                            setLayerType(View.LAYER_TYPE_HARDWARE, null)
                            setBackgroundColor(0xFF090D16.toInt())

                            settings.apply {
                                javaScriptEnabled = true
                                domStorageEnabled = true
                                databaseEnabled = true
                                mediaPlaybackRequiresUserGesture = false
                                allowFileAccess = true
                                allowContentAccess = true
                                useWideViewPort = true
                                loadWithOverviewMode = true
                                cacheMode = WebSettings.LOAD_DEFAULT
                                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                                userAgentString = "${settings.userAgentString} ARNStreamAndroidClient/1.0"
                            }

                            CookieManager.getInstance().setAcceptCookie(true)
                            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)

                            setDownloadListener { url, userAgent, contentDisposition, mimetype, _ ->
                                com.example.util.DownloadHelper.downloadFile(
                                    context = ctx,
                                    url = url,
                                    userAgent = userAgent,
                                    contentDisposition = contentDisposition,
                                    mimetype = mimetype
                                )
                            }

                            webViewClient = object : WebViewClient() {
                                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                                    val reqUrl = request?.url?.toString() ?: return false
                                    // Check if the URL points directly to downloadable media/archive files
                                    val lower = reqUrl.lowercase()
                                    if (lower.contains("/download") ||
                                        lower.endsWith(".mp4") || lower.endsWith(".mkv") || lower.endsWith(".avi") ||
                                        lower.endsWith(".mp3") || lower.endsWith(".m4a") || lower.endsWith(".flac") ||
                                        lower.endsWith(".zip") || lower.endsWith(".rar") || lower.endsWith(".7z")
                                    ) {
                                        com.example.util.DownloadHelper.downloadFile(
                                            context = ctx,
                                            url = reqUrl,
                                            userAgent = settings.userAgentString,
                                            contentDisposition = null,
                                            mimetype = null
                                        )
                                        return true
                                    }
                                    return false
                                }

                                override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                    isPageLoading = true
                                    connectionError = null
                                }

                                override fun onPageFinished(view: WebView?, url: String?) {
                                    isPageLoading = false
                                }

                                override fun onReceivedError(
                                    view: WebView?,
                                    errorCode: Int,
                                    description: String?,
                                    failingUrl: String?
                                ) {
                                    if (failingUrl == targetUrl || failingUrl?.startsWith(targetUrl.orEmpty()) == true) {
                                        connectionError = description ?: "تعذر الاتصال بالخادم"
                                    }
                                }
                            }

                            webChromeClient = object : WebChromeClient() {
                                override fun onProgressChanged(view: WebView?, newProgress: Int) {
                                    loadProgress = newProgress
                                    if (newProgress >= 100) isPageLoading = false
                                }

                                override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                                    if (view == null) return
                                    customVideoView = view
                                    customViewCallback = callback
                                    isFullscreenVideo = true
                                    visibility = View.GONE
                                    rootContainer.addView(
                                        view,
                                        FrameLayout.LayoutParams(
                                            ViewGroup.LayoutParams.MATCH_PARENT,
                                            ViewGroup.LayoutParams.MATCH_PARENT
                                        )
                                    )
                                    activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                                    activity?.window?.let { win ->
                                        win.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                                        val insetsController = WindowInsetsControllerCompat(win, win.decorView)
                                        insetsController.hide(WindowInsetsCompat.Type.systemBars())
                                        insetsController.systemBarsBehavior =
                                            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                                    }
                                }

                                override fun onHideCustomView() {
                                    val view = customVideoView ?: return
                                    rootContainer.removeView(view)
                                    visibility = View.VISIBLE
                                    exitFullscreenVideo()
                                }
                            }

                            loadUrl(targetUrl!!)
                        }
                        rootContainer.addView(webView)
                        webViewInstance = webView
                        rootContainer
                    }
                )
            }
        }

        // Top progress indicator
        if (isPageLoading && loadProgress in 1..99 && !isFullscreenVideo) {
            LinearProgressIndicator(
                progress = { loadProgress / 100f },
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter)
                    .statusBarsPadding(),
                color = ArnEmeraldPrimary,
                trackColor = Color.Transparent
            )
        }

        // Floating Server Settings Button (Positioned at bottom-start corner so it never covers web header icons or back arrows)
        if (!isFullscreenVideo) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .navigationBarsPadding()
                    .padding(start = 16.dp, bottom = 24.dp)
            ) {
                FloatingActionButton(
                    onClick = { showMenuSheet = true },
                    containerColor = ArnNavyCard.copy(alpha = 0.9f),
                    contentColor = ArnEmeraldGlow,
                    shape = CircleShape,
                    modifier = Modifier
                        .size(44.dp)
                        .border(1.dp, ArnBorder, CircleShape)
                        .testTag("open_menu_button")
                ) {
                    Icon(
                        imageVector = Icons.Default.Dns,
                        contentDescription = "خيارات الخادم",
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }

        // Connection Error Fallback
        if (connectionError != null && !isFullscreenVideo) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(ArnObsidian.copy(alpha = 0.96f))
                    .statusBarsPadding()
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier.widthIn(max = 420.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.WifiOff,
                        contentDescription = "انقطاع الاتصال",
                        tint = ArnError,
                        modifier = Modifier.size(64.dp)
                    )

                    Text(
                        text = "تعذر الاتصال بخادم ARN Stream",
                        style = MaterialTheme.typography.titleLarge,
                        color = ArnTextPrimary,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center
                    )

                    Text(
                        text = "تأكد من تشغيل الخادم على العنوان:\n${targetUrl ?: ""}\nوأن الهاتف متصل بنفس الشبكة المحلية.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = ArnTextSecondary,
                        textAlign = TextAlign.Center
                    )

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Button(
                            onClick = {
                                connectionError = null
                                webViewInstance?.reload()
                            },
                            modifier = Modifier
                                .weight(1f)
                                .testTag("retry_connection_button"),
                            colors = ButtonDefaults.buttonColors(containerColor = ArnEmeraldPrimary),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = null, tint = Color.Black)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("إعادة المحاولة", color = Color.Black, fontWeight = FontWeight.Bold)
                        }

                        OutlinedButton(
                            onClick = onSwitchServer,
                            modifier = Modifier
                                .weight(1f)
                                .testTag("switch_server_button"),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = ArnGoldAccent),
                            border = androidx.compose.foundation.BorderStroke(1.dp, ArnGoldAccent),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.Dns, contentDescription = null, tint = ArnGoldAccent)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("تغيير الخادم", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }

    // Modal Bottom Sheet Menu
    if (showMenuSheet) {
        ModalBottomSheet(
            onDismissRequest = { showMenuSheet = false },
            containerColor = ArnNavyCard,
            shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp)
                    .navigationBarsPadding(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = "خيارات منصة ARN Stream",
                    style = MaterialTheme.typography.titleMedium,
                    color = ArnTextPrimary,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 6.dp)
                )

                Surface(
                    onClick = {
                        showMenuSheet = false
                        webViewInstance?.reload()
                    },
                    color = ArnNavySurface,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("menu_refresh_button")
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null, tint = ArnEmeraldPrimary)
                        Text("تحديث الصفحة الحالية", color = ArnTextPrimary, fontWeight = FontWeight.Medium)
                    }
                }

                Surface(
                    onClick = {
                        showMenuSheet = false
                        onSwitchServer()
                    },
                    color = ArnNavySurface,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("menu_switch_server_button")
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Icon(Icons.Default.SettingsEthernet, contentDescription = null, tint = ArnGoldAccent)
                        Text("تغيير خادم البث والبحث في الشبكة", color = ArnTextPrimary, fontWeight = FontWeight.Medium)
                    }
                }

                Surface(
                    onClick = {
                        showMenuSheet = false
                        showAboutDialog = true
                    },
                    color = ArnNavySurface,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("menu_about_button")
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Icon(Icons.Default.Info, contentDescription = null, tint = ArnEmeraldGlow)
                        Text("حول ARN Stream والشركة المطورة", color = ArnTextPrimary, fontWeight = FontWeight.Medium)
                    }
                }

                Surface(
                    onClick = {
                        showMenuSheet = false
                        coroutineScope.launch {
                            preferencesManager.clearServerUrl()
                            onSwitchServer()
                        }
                    },
                    color = ArnNavySurface,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("menu_forget_server_button")
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Icon(Icons.Default.DeleteOutline, contentDescription = null, tint = ArnError)
                        Text("نسخ الخادم والخروج من الحساب", color = ArnError, fontWeight = FontWeight.Medium)
                    }
                }
            }
        }
    }

    // Exit or change server dialog
    if (showExitDialog) {
        AlertDialog(
            onDismissRequest = { showExitDialog = false },
            title = {
                Text("الخروج من ARN Stream", color = Color.White, fontWeight = FontWeight.Bold)
            },
            text = {
                Text(
                    "هل تريد إغلاق التطبيق أم تغيير خادم الوسائط والبحث عن خادم آخر؟",
                    color = ArnTextSecondary
                )
            },
            containerColor = ArnNavyCard,
            shape = RoundedCornerShape(18.dp),
            confirmButton = {
                TextButton(
                    onClick = {
                        showExitDialog = false
                        activity?.finish()
                    },
                    modifier = Modifier.testTag("exit_app_button")
                ) {
                    Text("إغلاق التطبيق", color = ArnError, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                Row {
                    TextButton(
                        onClick = {
                            showExitDialog = false
                            onSwitchServer()
                        },
                        modifier = Modifier.testTag("dialog_switch_server_button")
                    ) {
                        Text("تغيير الخادم", color = ArnGoldAccent)
                    }
                    TextButton(onClick = { showExitDialog = false }) {
                        Text("إلغاء", color = ArnTextMuted)
                    }
                }
            }
        )
    }

    ArnAboutDialog(isOpen = showAboutDialog, onDismiss = { showAboutDialog = false })
}
