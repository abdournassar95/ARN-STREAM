package com.example.ui.screens.web

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.pm.ActivityInfo
import android.graphics.Bitmap
import android.net.Uri
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.*
import android.widget.FrameLayout
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
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

private fun Context.findActivity(): Activity? {
    var ctx = this
    while (ctx is ContextWrapper) {
        if (ctx is Activity) return ctx
        ctx = ctx.baseContext
    }
    return null
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebClientScreen(
    preferencesManager: PreferencesManager,
    onSwitchServer: () -> Unit
) {
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val coroutineScope = rememberCoroutineScope()

    var targetUrl by remember { mutableStateOf<String?>(null) }
    var webViewInstance by remember { mutableStateOf<WebView?>(null) }
    var isPageLoading by remember { mutableStateOf(true) }
    var loadProgress by remember { mutableIntStateOf(0) }
    var connectionError by remember { mutableStateOf<String?>(null) }
    var showExitDialog by remember { mutableStateOf(false) }
    var showMenuSheet by remember { mutableStateOf(false) }
    var showAboutDialog by remember { mutableStateOf(false) }

    // Fullscreen video state
    var isFullscreenVideo by remember { mutableStateOf(false) }
    var customVideoView by remember { mutableStateOf<View?>(null) }
    var customViewCallback by remember { mutableStateOf<WebChromeClient.CustomViewCallback?>(null) }

    // File upload callback
    var fileUploadCallback by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }
    val fileChooserLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uriResult = if (result.resultCode == Activity.RESULT_OK) {
            val clipData = result.data?.clipData
            if (clipData != null && clipData.itemCount > 0) {
                Array(clipData.itemCount) { clipData.getItemAt(it).uri }
            } else {
                result.data?.data?.let { arrayOf(it) }
            }
        } else {
            null
        }
        fileUploadCallback?.onReceiveValue(uriResult)
        fileUploadCallback = null
    }

    // Load initial server URL from Preferences
    LaunchedEffect(Unit) {
        val saved = preferencesManager.serverUrl.firstOrNull()
        if (!saved.isNullOrEmpty()) {
            val formatted = if (saved.startsWith("http://") || saved.startsWith("https://")) saved else "http://$saved"
            targetUrl = if (formatted.endsWith("/")) formatted else "$formatted/"
        } else {
            onSwitchServer()
        }
    }

    // Fullscreen video helpers
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

    // Back Button Handler
    BackHandler {
        when {
            isFullscreenVideo -> {
                exitFullscreenVideo()
            }
            webViewInstance?.canGoBack() == true -> {
                webViewInstance?.goBack()
            }
            else -> {
                showExitDialog = true
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ArnObsidian)
    ) {
        if (targetUrl != null) {
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
                            setSupportZoom(false)
                            builtInZoomControls = false
                            displayZoomControls = false
                            cacheMode = WebSettings.LOAD_DEFAULT
                            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                            userAgentString = "${settings.userAgentString} ARNStreamAndroidClient/1.0"
                        }

                        CookieManager.getInstance().apply {
                            setAcceptCookie(true)
                            setAcceptThirdPartyCookies(this@apply, true)
                        }

                        webViewClient = object : WebViewClient() {
                            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                super.onPageStarted(view, url, favicon)
                                isPageLoading = true
                                connectionError = null
                            }

                            override fun onPageFinished(view: WebView?, url: String?) {
                                super.onPageFinished(view, url)
                                isPageLoading = false
                            }

                            override fun onReceivedError(
                                view: WebView?,
                                errorCode: Int,
                                description: String?,
                                failingUrl: String?
                            ) {
                                super.onReceivedError(view, errorCode, description, failingUrl)
                                if (failingUrl == targetUrl || failingUrl?.startsWith(targetUrl.orEmpty()) == true) {
                                    connectionError = description ?: "تعذر الاتصال بالخادم"
                                }
                            }

                            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                                val reqUrl = request?.url?.toString() ?: return false
                                return if (reqUrl.startsWith("http://") || reqUrl.startsWith("https://")) {
                                    false
                                } else {
                                    try {
                                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(reqUrl))
                                        ctx.startActivity(intent)
                                        true
                                    } catch (_: Exception) {
                                        true
                                    }
                                }
                            }
                        }

                        webChromeClient = object : WebChromeClient() {
                            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                                super.onProgressChanged(view, newProgress)
                                loadProgress = newProgress
                                if (newProgress >= 100) {
                                    isPageLoading = false
                                }
                            }

                            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                                super.onShowCustomView(view, callback)
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
                                super.onHideCustomView()
                                val view = customVideoView ?: return
                                rootContainer.removeView(view)
                                visibility = View.VISIBLE
                                exitFullscreenVideo()
                            }

                            override fun onShowFileChooser(
                                webView: WebView?,
                                filePathCallback: ValueCallback<Array<Uri>>?,
                                fileChooserParams: FileChooserParams?
                            ): Boolean {
                                fileUploadCallback?.onReceiveValue(null)
                                fileUploadCallback = filePathCallback
                                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                                    type = "*/*"
                                    addCategory(Intent.CATEGORY_OPENABLE)
                                }
                                try {
                                    fileChooserLauncher.launch(intent)
                                } catch (_: Exception) {
                                    fileUploadCallback?.onReceiveValue(null)
                                    fileUploadCallback = null
                                    return false
                                }
                                return true
                            }
                        }

                        loadUrl(targetUrl!!)
                    }

                    rootContainer.addView(webView)
                    webViewInstance = webView
                    rootContainer
                },
                update = {
                    // Retain state
                }
            )
        }

        // Top subtle Loading Progress Bar
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

        // Sleek Floating Control Pill (Visible unless in fullscreen video)
        if (!isFullscreenVideo) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .statusBarsPadding()
                    .padding(top = 8.dp, end = 12.dp)
            ) {
                IconButton(
                    onClick = { showMenuSheet = true },
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(Color(0xCC0F172A))
                        .border(1.dp, Color(0x33FFFFFF), CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.Default.MoreVert,
                        contentDescription = "خيارات ARN Stream",
                        tint = Color.White,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }

        // Connection Error Overlay
        if (connectionError != null && !isFullscreenVideo) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xE6090D16))
                    .statusBarsPadding()
                    .navigationBarsPadding()
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Surface(
                    shape = RoundedCornerShape(24.dp),
                    color = Color(0xFF0F172A),
                    modifier = Modifier
                        .fillMaxWidth(0.9f)
                        .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(24.dp))
                ) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .clip(CircleShape)
                                .background(Color(0x26EF4444)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.CloudOff,
                                contentDescription = null,
                                tint = Color(0xFFEF4444),
                                modifier = Modifier.size(36.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Text(
                            text = "تعذر الاتصال بالخادم",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            text = "تأكد من تشغيل خادم ARN Stream وتواجد الهاتف على نفس شبكة الـ Wi-Fi.",
                            fontSize = 14.sp,
                            color = Color(0xFF94A3B8),
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(24.dp))

                        Button(
                            onClick = {
                                connectionError = null
                                webViewInstance?.reload()
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = ArnEmeraldPrimary),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("إعادة المحاولة", fontWeight = FontWeight.Bold, color = Color.Black)
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        OutlinedButton(
                            onClick = onSwitchServer,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Default.Dns, contentDescription = null, tint = Color.White)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("تغيير الخادم / إعادة البحث", color = Color.White)
                        }
                    }
                }
            }
        }
    }

    // Options Bottom Sheet
    if (showMenuSheet) {
        ModalBottomSheet(
            onDismissRequest = { showMenuSheet = false },
            containerColor = Color(0xFF0F172A),
            tonalElevation = 8.dp,
            shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp)
            ) {
                Text(
                    text = "خيارات ARN Stream",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    modifier = Modifier.padding(bottom = 16.dp)
                )

                // Reload Page
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .clickable {
                            showMenuSheet = false
                            webViewInstance?.reload()
                        }
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = null, tint = ArnEmeraldPrimary)
                    Spacer(modifier = Modifier.width(16.dp))
                    Text("تحديث الصفحة", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                }

                // Switch Server
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .clickable {
                            showMenuSheet = false
                            onSwitchServer()
                        }
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Dns, contentDescription = null, tint = ArnGoldAccent)
                    Spacer(modifier = Modifier.width(16.dp))
                    Text("تغيير الخادم والاتصال", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                }

                // About Dialog
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .clickable {
                            showMenuSheet = false
                            showAboutDialog = true
                        }
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Outlined.Info, contentDescription = null, tint = Color(0xFF38BDF8))
                    Spacer(modifier = Modifier.width(16.dp))
                    Text("حول التطبيق والمطور", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                }

                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }

    // Exit & Switch Server Dialog
    if (showExitDialog) {
        AlertDialog(
            onDismissRequest = { showExitDialog = false },
            title = {
                Text(
                    text = "الخروج من ARN Stream",
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            },
            text = {
                Text(
                    text = "هل تريد إغلاق التطبيق أم تغيير الخادم والبحث عن خادم آخر؟",
                    color = Color(0xFF94A3B8)
                )
            },
            containerColor = Color(0xFF0F172A),
            confirmButton = {
                TextButton(
                    onClick = {
                        showExitDialog = false
                        activity?.finish()
                    }
                ) {
                    Text("إغلاق التطبيق", color = Color(0xFFEF4444), fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                Row {
                    TextButton(
                        onClick = {
                            showExitDialog = false
                            onSwitchServer()
                        }
                    ) {
                        Text("تغيير الخادم", color = ArnGoldAccent)
                    }
                    TextButton(onClick = { showExitDialog = false }) {
                        Text("إلغاء", color = Color(0xFF94A3B8))
                    }
                }
            }
        )
    }

    // ARN About Dialog
    ArnAboutDialog(
        isOpen = showAboutDialog,
        onDismiss = { showAboutDialog = false }
    )
}
