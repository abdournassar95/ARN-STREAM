package com.example.ui.screens.home

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import kotlinx.coroutines.launch
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Dns
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Wifi
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.data.api.ApiClient
import com.example.data.discovery.ServerDiscoveryRepository
import com.example.data.model.*
import com.example.data.storage.PreferencesManager
import com.example.ui.screens.home.HomeViewModel
import com.example.ui.screens.home.HomeViewModelFactory
import com.example.ui.components.*
import com.example.ui.theme.*
import com.example.data.repository.MediaRepository

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    user: User?,
    preferencesManager: PreferencesManager,
    onNavigateToMedia: (type: String, id: Int) -> Unit,
    onNavigateToPlayer: (type: String, id: Int) -> Unit,
    onNavigateToAudioPlayer: () -> Unit,
    onNavigateToLibrary: (libraryId: Int) -> Unit,
    onNavigateToLiveTv: () -> Unit,
    onNavigateToRemote: () -> Unit,
    onSwitchProfile: () -> Unit,
    onNavigateToConnect: () -> Unit,
    onNavigateToArtist: (artistId: Int) -> Unit = {},
    onNavigateToMyList: () -> Unit = {}
) {
    val context = LocalContext.current
    val favorites by preferencesManager.favoriteItems.collectAsStateWithLifecycle(initialValue = emptyList())
    val discoveryRepo = remember { ServerDiscoveryRepository(context) }
    val viewModel: HomeViewModel = viewModel(
        factory = HomeViewModelFactory(preferencesManager, discoveryRepo)
    )
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val discoveredServers = viewModel.discoveredServers

    val connectedServerUrl by remember(uiState) { derivedStateOf { uiState.connectedServerUrl } }
    val libraries by remember(uiState) { derivedStateOf { uiState.libraries } }
    val selectedLibraryId by remember(uiState) { derivedStateOf { uiState.selectedLibraryId } }
    val libraryMoviesMap by remember(uiState) { derivedStateOf { uiState.libraryMoviesMap } }
    val librarySeriesMap by remember(uiState) { derivedStateOf { uiState.librarySeriesMap } }
    val libraryArtistsMap by remember(uiState) { derivedStateOf { uiState.libraryArtistsMap } }
    val libraryPostersMap by remember(uiState) { derivedStateOf { uiState.libraryPostersMap } }
    val continueWatching by remember(uiState) { derivedStateOf { uiState.continueWatching } }
    val isLoading by remember(uiState) { derivedStateOf { uiState.isLoading } }
    val loadError by remember(uiState) { derivedStateOf { uiState.loadError } }
    val isConnectingServer by remember(uiState) { derivedStateOf { uiState.isConnectingServer } }
    val connectError by remember(uiState) { derivedStateOf { uiState.connectError } }
    val isDiscoveryRunning by remember(uiState) { derivedStateOf { uiState.isDiscoveryRunning } }
    
    // Remaining local UI state
    var showAboutDialog by remember { mutableStateOf(false) }
    var showCameraScanner by remember { mutableStateOf(false) }
    var showSearchOverlay by remember { mutableStateOf(false) }
    var showLibraryQuickSheet by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    var manualServerInput by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    val coroutineScope = rememberCoroutineScope()
    
    val fetchRealData = viewModel::fetchRealData
    val connectToUrl = viewModel::connectToUrl
    val runDiscovery = viewModel::runDiscovery

    LaunchedEffect(Unit) {
        // ViewModel handles initial fetch and discovery in its init block
    }

    // Featured item picked from the first real movie
    val featuredMovie = libraryMoviesMap.values.firstOrNull()?.firstOrNull()

    Scaffold(
        containerColor = ArnObsidian,
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        topBar = {
            DynamicHeaderCapsule(
                user = user,
                serverUrl = connectedServerUrl,
                onServerClick = onNavigateToConnect,
                onSearchClick = { showSearchOverlay = true },
                onCastClick = { onNavigateToRemote() },
                onInfoClick = { showAboutDialog = true },
                onProfileClick = onSwitchProfile
            )
        },
        bottomBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xF2090D16))
            ) {
                MiniPlayerCapsule(
                    onExpandPlayer = onNavigateToAudioPlayer,
                    applyNavigationBarsPadding = false
                )
                ArnBottomNavBar(
                    currentTab = "home",
                    onTabSelected = { tab ->
                        when (tab) {
                            "home" -> {
                                coroutineScope.launch {
                                    listState.animateScrollToItem(0)
                                }
                            }
                            "libraries" -> {
                                showLibraryQuickSheet = true
                            }
                            "my_list" -> onNavigateToMyList()
                            "live_tv" -> onNavigateToLiveTv()
                        }
                    }
                )
            }
        }
    ) { innerPadding ->
        LazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // If NOT connected to a server yet or server not configured
            if (!ApiClient.isServerConfigured() || (connectedServerUrl == null && libraries.isEmpty())) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        GlassCard(
                            modifier = Modifier.fillMaxWidth(),
                            cornerRadius = 24.dp,
                            backgroundColor = Color(0x1F10B981),
                            borderColor = ArnEmeraldPrimary
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(20.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Surface(
                                    shape = CircleShape,
                                    color = Color(0xFF1E293B),
                                    modifier = Modifier.size(64.dp)
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Icon(
                                            imageVector = Icons.Outlined.Dns,
                                            contentDescription = null,
                                            tint = ArnEmeraldPrimary,
                                            modifier = Modifier.size(34.dp)
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.height(14.dp))

                                Text(
                                    text = "الواجهة الرئيسية لخادم ARN Stream",
                                    fontSize = 19.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Color.White,
                                    textAlign = TextAlign.Center
                                )

                                Spacer(modifier = Modifier.height(6.dp))

                                Text(
                                    text = "تطبيق ARN Stream متصل بالخادم الفعلي مباشرة بدون أي وسائط أو مكتبات وهمية. اختر طريقة الاتصال بخادمك لعرض مكتباتك وبياناتك الحقيقية:",
                                    fontSize = 12.sp,
                                    color = ArnTextSecondary,
                                    textAlign = TextAlign.Center,
                                    lineHeight = 18.sp
                                )

                                Spacer(modifier = Modifier.height(18.dp))

                                // Button: Live Camera QR Scanner
                                Button(
                                    onClick = { showCameraScanner = true },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(48.dp),
                                    shape = RoundedCornerShape(14.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = ArnEmeraldPrimary)
                                ) {
                                    Icon(Icons.Outlined.QrCodeScanner, contentDescription = null, modifier = Modifier.size(20.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("مسح رمز QR من شاشة الخادم بالكاميرا", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                }

                                Spacer(modifier = Modifier.height(12.dp))

                                // Button: Auto discovery
                                OutlinedButton(
                                    onClick = runDiscovery,
                                    enabled = !isDiscoveryRunning,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(46.dp),
                                    shape = RoundedCornerShape(14.dp),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x4DFFFFFF)),
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
                                ) {
                                    if (isDiscoveryRunning) {
                                        CircularProgressIndicator(modifier = Modifier.size(18.dp), color = ArnEmeraldPrimary, strokeWidth = 2.dp)
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text("جاري البحث في الشبكة المحلية...")
                                    } else {
                                        Icon(Icons.Outlined.Wifi, contentDescription = null, modifier = Modifier.size(18.dp), tint = ArnEmeraldPrimary)
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text("البحث التلقائي عن الخوادم في الشبكة")
                                    }
                                }

                                Spacer(modifier = Modifier.height(18.dp))

                                // Manual URL input
                                OutlinedTextField(
                                    value = manualServerInput,
                                    onValueChange = { manualServerInput = it },
                                    placeholder = { Text("مثال: http://192.168.1.X:8096", color = ArnTextMuted, fontSize = 12.sp) },
                                    singleLine = true,
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = ArnEmeraldPrimary,
                                        unfocusedBorderColor = Color(0x33FFFFFF),
                                        focusedTextColor = Color.White,
                                        unfocusedTextColor = Color.White
                                    )
                                )

                                Spacer(modifier = Modifier.height(10.dp))

                                Button(
                                    onClick = { connectToUrl(manualServerInput) },
                                    enabled = !isConnectingServer && manualServerInput.isNotBlank(),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(44.dp),
                                    shape = RoundedCornerShape(12.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = ArnColorMovies)
                                ) {
                                    if (isConnectingServer) {
                                        CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text("جاري الاتصال بالخادم...", color = Color.White)
                                    } else {
                                        Text("الاتصال بهذا العنوان", fontWeight = FontWeight.Bold, color = Color.White)
                                    }
                                }

                                if (connectError != null) {
                                    Spacer(modifier = Modifier.height(10.dp))
                                    Text(
                                        text = connectError ?: "",
                                        color = Color(0xFFF87171),
                                        fontSize = 11.sp,
                                        textAlign = TextAlign.Center
                                    )
                                }
                            }
                        }

                        // Discovered Servers Row / List
                        if (discoveredServers.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "الخوادم الحقيقية المكتشفة في الشبكة (${discoveredServers.size}):",
                                color = Color.White,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.fillMaxWidth()
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            for (srv in discoveredServers) {
                                GlassCard(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp),
                                    onClick = { connectToUrl(srv.baseUrl) },
                                    backgroundColor = Color(0x2610B981),
                                    borderColor = ArnEmeraldPrimary
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(text = srv.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                            Text(text = srv.baseUrl, color = ArnEmeraldPrimary, fontSize = 11.sp)
                                        }
                                        Button(
                                            onClick = { connectToUrl(srv.baseUrl) },
                                            shape = RoundedCornerShape(10.dp),
                                            colors = ButtonDefaults.buttonColors(containerColor = ArnEmeraldPrimary),
                                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                                        ) {
                                            Text("اتصال", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } else if (isLoading && libraries.isEmpty() && libraryMoviesMap.isEmpty() && librarySeriesMap.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(300.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = ArnEmeraldPrimary)
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "جاري جلب المكتبات والوسائط الفعلية من الخادم...",
                                color = ArnTextSecondary,
                                fontSize = 13.sp,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            } else if (loadError != null && libraries.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Default.CloudOff,
                                contentDescription = null,
                                tint = ArnColorMovies,
                                modifier = Modifier.size(54.dp)
                            )
                            Spacer(modifier = Modifier.height(14.dp))
                            Text(
                                text = loadError ?: "",
                                color = Color.White,
                                fontSize = 14.sp,
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(
                                onClick = fetchRealData,
                                colors = ButtonDefaults.buttonColors(containerColor = ArnEmeraldPrimary),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(Icons.Outlined.Refresh, contentDescription = null)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("إعادة المحاولة")
                            }
                        }
                    }
                }
            } else {
                // 1. Real Server Library Capsules (strictly from server)
                if (libraries.isNotEmpty()) {
                    item {
                        LibraryTabsCapsule(
                            libraries = libraries,
                            selectedLibraryId = selectedLibraryId,
                            onSelectAll = { viewModel.selectLibrary(0) },
                            onSelectLibrary = { lib ->
                                if (lib.type == "live") {
                                    onNavigateToLiveTv()
                                } else {
                                    viewModel.selectLibrary(lib.id)
                                }
                            }
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                    }
                }

                // 2. Real Featured Hero Banner (if movie exists)
                if (featuredMovie != null) {
                    item {
                        val backdropUrl = ApiClient.getFullMediaUrl(featuredMovie.backdrop ?: featuredMovie.poster)
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(310.dp)
                                .padding(horizontal = 16.dp, vertical = 6.dp)
                                .clip(RoundedCornerShape(26.dp))
                                .border(1.dp, Color(0x33E50914), RoundedCornerShape(26.dp))
                                .clickable { onNavigateToMedia("movie", featuredMovie.id) }
                        ) {
                            AsyncImage(
                                model = backdropUrl,
                                contentDescription = featuredMovie.title,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )

                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(
                                        Brush.verticalGradient(
                                            colors = listOf(
                                                Color(0x22000000),
                                                Color(0x99090D16),
                                                Color(0xF5090D16)
                                            ),
                                            startY = 40f
                                        )
                                    )
                            )

                            Column(
                                modifier = Modifier
                                    .align(Alignment.BottomStart)
                                    .padding(18.dp)
                            ) {
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = ArnColorMovies
                                ) {
                                    Text(
                                        text = "مميز من الخادم",
                                        color = Color.White,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                    )
                                }

                                Spacer(modifier = Modifier.height(8.dp))

                                Text(
                                    text = featuredMovie.title,
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Color.White
                                )

                                if (!featuredMovie.plot.isNullOrEmpty()) {
                                    Text(
                                        text = featuredMovie.plot,
                                        fontSize = 12.sp,
                                        color = ArnTextSecondary,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis,
                                        modifier = Modifier.padding(vertical = 4.dp)
                                    )
                                }

                                Spacer(modifier = Modifier.height(10.dp))

                                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Button(
                                        onClick = { onNavigateToPlayer("movie", featuredMovie.id) },
                                        colors = ButtonDefaults.buttonColors(containerColor = ArnColorMovies),
                                        shape = RoundedCornerShape(12.dp)
                                    ) {
                                        Icon(Icons.Default.PlayArrow, contentDescription = null)
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text("مشاهدة الآن", fontWeight = FontWeight.Bold)
                                    }

                                    OutlinedButton(
                                        onClick = { onNavigateToMedia("movie", featuredMovie.id) },
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x4DFFFFFF)),
                                        shape = RoundedCornerShape(12.dp)
                                    ) {
                                        Icon(Icons.Default.Info, contentDescription = null, tint = ArnTextSecondary)
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text("التفاصيل")
                                    }
                                }
                            }
                        }
                    }
                }

                // 3. Real Continue Watching Section
                if (continueWatching.isNotEmpty()) {
                    item {
                        SectionHeader(
                            title = "مواصلة المشاهدة والاستماع",
                            emoji = "⏳",
                            color = ArnGoldAccent
                        )
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            items(continueWatching) { item ->
                                val progress = if (item.duration > 0) item.position.toFloat() / item.duration.toFloat() else 0.5f
                                val posterUrl = ApiClient.getFullMediaUrl(item.poster ?: item.backdrop)
                                val isAudioTrack = item.mediaType == "track"
                                MediaPosterCard(
                                    title = item.title ?: "عمل غير مكتمل",
                                    posterUrl = posterUrl,
                                    progressPercentage = progress,
                                    subtitle = "متبقي ${((item.duration - item.position) / 60).coerceAtLeast(0)} دقيقة",
                                    cardWidth = 135.dp,
                                    cardHeight = if (isAudioTrack) 135.dp else 202.dp,
                                    isSquare = isAudioTrack,
                                    onClick = {
                                        if (isAudioTrack) {
                                            onNavigateToAudioPlayer()
                                        } else {
                                            onNavigateToPlayer(item.mediaType, item.mediaId)
                                        }
                                    }
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(14.dp))
                    }
                }

                // My List (قائمتي) Section
                if (favorites.isNotEmpty()) {
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp, vertical = 6.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.Favorite,
                                    contentDescription = null,
                                    tint = Color(0xFFEF4444),
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "قائمتي (${favorites.size})",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Color.White
                                )
                            }

                            TextButton(
                                onClick = onNavigateToMyList,
                                modifier = Modifier.testTag("home_my_list_view_all_button")
                            ) {
                                Text(
                                    text = "عرض الكل",
                                    color = Color(0xFFEF4444),
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                                    contentDescription = null,
                                    tint = Color(0xFFEF4444),
                                    modifier = Modifier.size(15.dp)
                                )
                            }
                        }

                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            items(favorites, key = { "${it.type}_${it.id}" }) { item ->
                                val posterUrl = ApiClient.getFullMediaUrl(item.poster)
                                MediaPosterCard(
                                    title = item.title,
                                    posterUrl = posterUrl,
                                    rating = item.rating,
                                    subtitle = if (item.type == "movie") "فيلم" else "مسلسل",
                                    cardWidth = 135.dp,
                                    cardHeight = 202.dp,
                                    isSquare = false,
                                    accentColor = if (item.type == "movie") ArnColorMovies else ArnColorShows,
                                    onClick = { onNavigateToMedia(item.type, item.id) }
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                    }
                }

                // 4. Dynamic Media Rows for Libraries (Fluid In-Page Browsing)
                if (selectedLibraryId != null && selectedLibraryId != 0) {
                    // Focused Library View
                    val focusedLib = libraries.find { it.id == selectedLibraryId }
                    if (focusedLib != null) {
                        val libType = focusedLib.type.lowercase()
                        val themeColor = getLibraryColor(libType)
                        val movies = libraryMoviesMap[focusedLib.id] ?: emptyList()
                        val series = librarySeriesMap[focusedLib.id] ?: emptyList()
                        val artists = libraryArtistsMap[focusedLib.id] ?: emptyList()

                        item(key = "focus_header_${focusedLib.id}") {
                            GlassCard(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp, vertical = 6.dp),
                                backgroundColor = themeColor.copy(alpha = 0.15f),
                                borderColor = themeColor.copy(alpha = 0.45f)
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(14.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text(getLibraryEmoji(libType), fontSize = 24.sp)
                                        Spacer(modifier = Modifier.width(10.dp))
                                        Column {
                                            Text(
                                                text = focusedLib.name,
                                                fontSize = 16.sp,
                                                fontWeight = FontWeight.Black,
                                                color = Color.White
                                            )
                                            Text(
                                                text = "عرض خاص بمكتبة ${focusedLib.name}",
                                                fontSize = 11.sp,
                                                color = ArnTextSecondary
                                            )
                                        }
                                    }

                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        OutlinedButton(
                                            onClick = { viewModel.selectLibrary(0) },
                                            shape = RoundedCornerShape(10.dp),
                                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x4DFFFFFF)),
                                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                                        ) {
                                            Text("الكل", fontSize = 11.sp, color = Color.White)
                                        }

                                        Button(
                                            onClick = { onNavigateToLibrary(focusedLib.id) },
                                            colors = ButtonDefaults.buttonColors(containerColor = themeColor),
                                            shape = RoundedCornerShape(10.dp),
                                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)
                                        ) {
                                            Text("فتح المكتبة", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                        }

                        if (movies.isNotEmpty()) {
                            item(key = "focus_movies_${focusedLib.id}") {
                                SectionHeader(
                                    title = "أفلام ${focusedLib.name}",
                                    emoji = "🎬",
                                    color = themeColor,
                                    onViewAll = { onNavigateToLibrary(focusedLib.id) }
                                )
                                LazyRow(
                                    contentPadding = PaddingValues(horizontal = 16.dp),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    items(movies, key = { "f_m_${it.id}" }) { movie ->
                                        val posterUrl = ApiClient.getFullMediaUrl(movie.displayPoster ?: movie.displayBackdrop)
                                        MediaPosterCard(
                                            title = movie.title,
                                            posterUrl = posterUrl,
                                            rating = movie.rating,
                                            resolution = movie.resolution,
                                            subtitle = if (movie.year != null) "${movie.year}" else null,
                                            cardWidth = 135.dp,
                                            cardHeight = 202.dp,
                                            isSquare = false,
                                            accentColor = themeColor,
                                            onClick = { onNavigateToMedia("movie", movie.id) }
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(16.dp))
                            }
                        }

                        if (series.isNotEmpty()) {
                            item(key = "focus_series_${focusedLib.id}") {
                                SectionHeader(
                                    title = "مسلسلات ${focusedLib.name}",
                                    emoji = "📺",
                                    color = themeColor,
                                    onViewAll = { onNavigateToLibrary(focusedLib.id) }
                                )
                                LazyRow(
                                    contentPadding = PaddingValues(horizontal = 16.dp),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    items(series, key = { "f_s_${it.id}" }) { ser ->
                                        val posterUrl = ApiClient.getFullMediaUrl(ser.displayPoster ?: ser.displayBackdrop)
                                        MediaPosterCard(
                                            title = ser.title,
                                            posterUrl = posterUrl,
                                            rating = ser.rating,
                                            resolution = "${ser.seasonsCount} مواسم",
                                            subtitle = if (ser.year != null) "${ser.year}" else null,
                                            cardWidth = 135.dp,
                                            cardHeight = 202.dp,
                                            isSquare = false,
                                            accentColor = themeColor,
                                            onClick = { onNavigateToMedia("series", ser.id) }
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(16.dp))
                            }
                        }

                        if (artists.isNotEmpty()) {
                            item(key = "focus_artists_${focusedLib.id}") {
                                SectionHeader(
                                    title = "أعمال وفناني ${focusedLib.name}",
                                    emoji = "🎵",
                                    color = themeColor,
                                    onViewAll = { onNavigateToLibrary(focusedLib.id) }
                                )
                                LazyRow(
                                    contentPadding = PaddingValues(horizontal = 16.dp),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    items(artists, key = { "f_a_${it.id}" }) { artist ->
                                        val imageUrl = ApiClient.getFullMediaUrl(artist.displayImage)
                                        MediaPosterCard(
                                            title = artist.name,
                                            posterUrl = imageUrl,
                                            subtitle = "${artist.totalTracks} تراك",
                                            resolution = "${artist.totalAlbums} ألبوم",
                                            cardWidth = 135.dp,
                                            cardHeight = 135.dp,
                                            isSquare = true,
                                            accentColor = themeColor,
                                            onClick = { onNavigateToArtist(artist.id) }
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(16.dp))
                            }
                        }
                    }
                } else {
                    // All Libraries View: Render Content Rows per Library
                    libraries.forEach { lib ->
                        val libType = lib.type.lowercase()
                        val themeColor = getLibraryColor(libType)
                        val movies = libraryMoviesMap[lib.id] ?: emptyList()
                        val series = librarySeriesMap[lib.id] ?: emptyList()
                        val artists = libraryArtistsMap[lib.id] ?: emptyList()

                        if (movies.isNotEmpty()) {
                            item(key = "row_m_${lib.id}") {
                                SectionHeader(
                                    title = lib.name,
                                    emoji = getLibraryEmoji(lib.type),
                                    color = themeColor,
                                    onViewAll = { onNavigateToLibrary(lib.id) }
                                )
                                LazyRow(
                                    contentPadding = PaddingValues(horizontal = 16.dp),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    items(movies.take(15), key = { "m_${lib.id}_${it.id}" }) { movie ->
                                        val posterUrl = ApiClient.getFullMediaUrl(movie.displayPoster ?: movie.displayBackdrop)
                                        MediaPosterCard(
                                            title = movie.title,
                                            posterUrl = posterUrl,
                                            rating = movie.rating,
                                            resolution = movie.resolution,
                                            subtitle = if (movie.year != null) "${movie.year}" else null,
                                            cardWidth = 135.dp,
                                            cardHeight = 202.dp,
                                            isSquare = false,
                                            accentColor = themeColor,
                                            onClick = { onNavigateToMedia("movie", movie.id) }
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(16.dp))
                            }
                        }

                        if (series.isNotEmpty()) {
                            item(key = "row_s_${lib.id}") {
                                SectionHeader(
                                    title = lib.name,
                                    emoji = getLibraryEmoji(lib.type),
                                    color = themeColor,
                                    onViewAll = { onNavigateToLibrary(lib.id) }
                                )
                                LazyRow(
                                    contentPadding = PaddingValues(horizontal = 16.dp),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    items(series.take(15), key = { "s_${lib.id}_${it.id}" }) { ser ->
                                        val posterUrl = ApiClient.getFullMediaUrl(ser.displayPoster ?: ser.displayBackdrop)
                                        MediaPosterCard(
                                            title = ser.title,
                                            posterUrl = posterUrl,
                                            rating = ser.rating,
                                            resolution = "${ser.seasonsCount} مواسم",
                                            subtitle = if (ser.year != null) "${ser.year}" else null,
                                            cardWidth = 135.dp,
                                            cardHeight = 202.dp,
                                            isSquare = false,
                                            accentColor = themeColor,
                                            onClick = { onNavigateToMedia("series", ser.id) }
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(16.dp))
                            }
                        }

                        if (artists.isNotEmpty()) {
                            item(key = "row_a_${lib.id}") {
                                SectionHeader(
                                    title = lib.name,
                                    emoji = getLibraryEmoji(lib.type),
                                    color = themeColor,
                                    onViewAll = { onNavigateToLibrary(lib.id) }
                                )
                                LazyRow(
                                    contentPadding = PaddingValues(horizontal = 16.dp),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    items(artists.take(15), key = { "a_${lib.id}_${it.id}" }) { artist ->
                                        val imageUrl = ApiClient.getFullMediaUrl(artist.displayImage)
                                        MediaPosterCard(
                                            title = artist.name,
                                            posterUrl = imageUrl,
                                            subtitle = "${artist.totalTracks} تراك",
                                            resolution = "${artist.totalAlbums} ألبوم",
                                            cardWidth = 135.dp,
                                            cardHeight = 135.dp,
                                            isSquare = true,
                                            accentColor = themeColor,
                                            onClick = { onNavigateToArtist(artist.id) }
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(16.dp))
                            }
                        }
                    }
                }

                // 5. Server Libraries Overview Grid
                if (libraries.isNotEmpty()) {
                    item(key = "home_libraries_grid") {
                        LibraryGrid(
                            libraries = libraries,
                            postersMap = libraryPostersMap,
                            onLibraryClick = { lib ->
                                if (lib.type == "live") {
                                    onNavigateToLiveTv()
                                } else {
                                    onNavigateToLibrary(lib.id)
                                }
                            }
                        )
                        Spacer(modifier = Modifier.height(18.dp))
                    }
                }

                // If connected but server libraries are empty
                if (libraries.isEmpty() || (libraryMoviesMap.isEmpty() && librarySeriesMap.isEmpty() && libraryArtistsMap.isEmpty())) {
                    item {
                        GlassCard(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 20.dp),
                            backgroundColor = Color(0x0DFFFFFF)
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(24.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Icon(
                                    imageVector = Icons.Default.FolderOpen,
                                    contentDescription = null,
                                    tint = ArnEmeraldPrimary,
                                    modifier = Modifier.size(48.dp)
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                Text(
                                    text = "الخادم متصل بنجاح، وجاري مزامنة المكتبات.",
                                    color = Color.White,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    textAlign = TextAlign.Center
                                )
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = "أضف وسائط إلى مكتبات خادم ARN Stream لتظهر هنا مباشرة.",
                                    color = ArnTextSecondary,
                                    fontSize = 12.sp,
                                    textAlign = TextAlign.Center
                                )
                                Spacer(modifier = Modifier.height(16.dp))
                                Button(
                                    onClick = fetchRealData,
                                    colors = ButtonDefaults.buttonColors(containerColor = ArnEmeraldPrimary)
                                ) {
                                    Icon(Icons.Outlined.Refresh, contentDescription = null)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("تحديث المحتوى الآن")
                                }
                            }
                        }
                    }
                }
            }
        }

        // Search Overlay
        if (showSearchOverlay) {
            SearchOverlay(
                query = searchQuery,
                onQueryChange = { searchQuery = it },
                onClose = { showSearchOverlay = false },
                onNavigateToMedia = onNavigateToMedia
            )
        }

        // Live Camera QR Scanner Dialog
        CameraQrScannerDialog(
            isOpen = showCameraScanner,
            onDismiss = { showCameraScanner = false },
            onScanned = { scannedUrl ->
                connectToUrl(scannedUrl)
            }
        )

        // About Dialog
        ArnAboutDialog(
            isOpen = showAboutDialog,
            onDismiss = { showAboutDialog = false }
        )

        // Quick Library Selector BottomSheet
        if (showLibraryQuickSheet) {
            ModalBottomSheet(
                onDismissRequest = { showLibraryQuickSheet = false },
                containerColor = Color(0xFF0F172A),
                scrimColor = Color.Black.copy(alpha = 0.65f),
                dragHandle = { BottomSheetDefaults.DragHandle(color = Color(0x66FFFFFF)) },
                modifier = Modifier.testTag("library_quick_sheet")
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .padding(horizontal = 20.dp, vertical = 8.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = ArnEmeraldPrimary.copy(alpha = 0.2f),
                                modifier = Modifier.size(34.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        imageVector = Icons.Default.VideoLibrary,
                                        contentDescription = null,
                                        tint = ArnEmeraldPrimary,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text(
                                    text = "مكتبات الخادم السريعة",
                                    fontSize = 17.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Color.White
                                )
                                Text(
                                    text = "اختر مكتبة للانتقال الفوري إليها",
                                    fontSize = 11.sp,
                                    color = ArnTextSecondary
                                )
                            }
                        }

                        IconButton(onClick = { showLibraryQuickSheet = false }) {
                            Icon(
                                imageVector = Icons.Outlined.Close,
                                contentDescription = "إغلاق",
                                tint = Color.White
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    LazyVerticalGrid(
                        columns = GridCells.Adaptive(minSize = 140.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 380.dp)
                    ) {
                        items(libraries, key = { "sheet_${it.id}" }) { lib ->
                            val themeColor = getLibraryColor(lib.type)
                            val countText = when {
                                lib.moviesCount > 0 -> "${lib.moviesCount} فيلم"
                                lib.showsCount > 0 -> "${lib.showsCount} مسلسل"
                                lib.tracksCount > 0 -> "${lib.tracksCount} مقطع"
                                else -> "تصفح المكتبة"
                            }
                            Surface(
                                shape = RoundedCornerShape(16.dp),
                                color = Color(0xFF1E293B),
                                border = androidx.compose.foundation.BorderStroke(1.dp, themeColor.copy(alpha = 0.45f)),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .testTag("quick_sheet_lib_${lib.id}")
                                    .clickable {
                                        showLibraryQuickSheet = false
                                        if (lib.type == "live") {
                                            onNavigateToLiveTv()
                                        } else {
                                            onNavigateToLibrary(lib.id)
                                        }
                                    }
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Surface(
                                        shape = RoundedCornerShape(10.dp),
                                        color = themeColor.copy(alpha = 0.2f),
                                        modifier = Modifier.size(38.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Text(getLibraryEmoji(lib.type), fontSize = 18.sp)
                                        }
                                    }
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = lib.name,
                                            color = Color.White,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 13.sp,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Text(
                                            text = countText,
                                            color = ArnTextSecondary,
                                            fontSize = 11.sp
                                        )
                                    }
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                }
            }
        }
    }
}

@Composable
fun SectionHeader(
    title: String,
    emoji: String,
    color: Color,
    onViewAll: (() -> Unit)? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(emoji, fontSize = 18.sp)
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = title,
                fontSize = 17.sp,
                fontWeight = FontWeight.Black,
                color = Color.White
            )
        }

        if (onViewAll != null) {
            TextButton(onClick = onViewAll) {
                Text(
                    text = "عرض الكل",
                    color = color,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
fun LibraryGrid(
    libraries: List<Library>,
    postersMap: Map<Int, List<String>>,
    onLibraryClick: (Library) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = ArnEmeraldPrimary.copy(alpha = 0.2f),
                    modifier = Modifier.size(32.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Default.FolderOpen,
                            contentDescription = null,
                            tint = ArnEmeraldPrimary,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Text(
                        text = "مكتبات الخادم",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black
                    )
                    Text(
                        text = "${libraries.size} مكتبات متوفرة",
                        color = ArnTextSecondary,
                        fontSize = 11.sp
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 150.dp),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = 3000.dp)
        ) {
            items(libraries, key = { it.id }) { lib ->
                val posters = postersMap[lib.id] ?: emptyList()
                LibraryCard(
                    library = lib,
                    posters = posters,
                    onClick = { onLibraryClick(lib) }
                )
            }
        }
    }
}

@Composable
fun LibraryCard(
    library: Library,
    posters: List<String>,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val themeColor = getLibraryColor(library.type)
    val primaryPoster = posters.firstOrNull()?.let { ApiClient.getFullMediaUrl(it) }
    val secondaryPoster = posters.getOrNull(1)?.let { ApiClient.getFullMediaUrl(it) }

    val countText = when {
        library.moviesCount > 0 -> "${library.moviesCount} فيلم"
        library.showsCount > 0 -> "${library.showsCount} مسلسل"
        library.tracksCount > 0 -> "${library.tracksCount} مقطع"
        posters.isNotEmpty() -> "${posters.size} وسائط"
        else -> "استعراض المكتبة"
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(180.dp)
            .clip(RoundedCornerShape(22.dp))
            .background(Color(0xFF1E293B))
            .border(1.5.dp, themeColor.copy(alpha = 0.5f), RoundedCornerShape(22.dp))
            .clickable(onClick = onClick)
    ) {
        // Poster artwork background
        if (!primaryPoster.isNullOrEmpty()) {
            AsyncImage(
                model = primaryPoster,
                contentDescription = library.name,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )

            // If there's a second poster, show a small thumbnail layered over it in the top corner
            if (!secondaryPoster.isNullOrEmpty()) {
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = Color.Black,
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x66FFFFFF)),
                    shadowElevation = 8.dp,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(10.dp)
                        .size(width = 46.dp, height = 64.dp)
                ) {
                    AsyncImage(
                        model = secondaryPoster,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }

            // Dark gradient overlay for text readability
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(
                                Color(0x33000000),
                                Color(0x99090D16),
                                Color(0xF5090D16)
                            ),
                            startY = 40f
                        )
                    )
            )
        } else {
            // Elegant gradient when no poster is loaded yet
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.linearGradient(
                            colors = listOf(
                                themeColor.copy(alpha = 0.35f),
                                Color(0xFF0F172A),
                                Color(0xFF090D16)
                            )
                        )
                    )
            ) {
                // Watermark icon
                Text(
                    text = getLibraryEmoji(library.type),
                    fontSize = 54.sp,
                    modifier = Modifier
                        .align(Alignment.Center)
                        .alpha(0.35f)
                )
            }
        }

        // Top category badge
        Surface(
            shape = RoundedCornerShape(8.dp),
            color = themeColor.copy(alpha = 0.35f),
            border = androidx.compose.foundation.BorderStroke(1.dp, themeColor.copy(alpha = 0.6f)),
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(10.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Text(
                    text = getLibraryEmoji(library.type),
                    fontSize = 11.sp
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = when (library.type.lowercase()) {
                        "movies", "movie" -> "أفلام"
                        "shows", "series", "tv" -> "مسلسلات"
                        "music" -> "صوتيات"
                        "quran" -> "قرآن كريم"
                        "live" -> "بث مباشر"
                        else -> library.type
                    },
                    color = Color.White,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        // Bottom text: Name and Item count
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .fillMaxWidth()
                .padding(12.dp)
        ) {
            Text(
                text = library.name,
                color = Color.White,
                fontWeight = FontWeight.Black,
                fontSize = 15.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(4.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = countText,
                    color = ArnTextSecondary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium
                )

                Surface(
                    shape = CircleShape,
                    color = themeColor.copy(alpha = 0.35f),
                    modifier = Modifier.size(24.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(12.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun SearchOverlay(
    query: String,
    onQueryChange: (String) -> Unit,
    onClose: () -> Unit,
    onNavigateToMedia: (type: String, id: Int) -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    var searchResults by remember { mutableStateOf<List<SearchResultItem>>(emptyList()) }
    var isSearching by remember { mutableStateOf(false) }

    LaunchedEffect(query) {
        if (query.trim().length >= 2) {
            isSearching = true
            try {
                val res = ApiClient.apiService.search(query.trim())
                if (!res.data.isNullOrEmpty()) {
                    searchResults = res.data.map { item ->
                        SearchResultItem(
                            id = item.id,
                            title = item.title,
                            type = item.type,
                            poster = item.poster,
                            subtitle = when (item.type) {
                                "track" -> item.artistName ?: item.albumTitle
                                "artist" -> "فنان"
                                else -> item.year?.toString()
                            }
                        )
                    }
                } else {
                    searchResults = emptyList()
                }
            } catch (_: Exception) {
            } finally {
                isSearching = false
            }
        } else {
            searchResults = emptyList()
            isSearching = false
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xF5090D16))
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(16.dp)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = query,
                    onValueChange = onQueryChange,
                    placeholder = { Text("ابحث في الأفلام، المسلسلات، التلاوات...", color = ArnTextMuted) },
                    singleLine = true,
                    leadingIcon = {
                        Icon(Icons.Default.Search, contentDescription = null, tint = ArnEmeraldPrimary)
                    },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = ArnEmeraldPrimary,
                        unfocusedBorderColor = Color(0x33FFFFFF),
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    )
                )

                Spacer(modifier = Modifier.width(8.dp))

                IconButton(onClick = onClose) {
                    Icon(Icons.Outlined.Close, contentDescription = "إغلاق", tint = Color.White)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            if (isSearching) {
                Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = ArnEmeraldPrimary)
                }
            } else if (query.trim().length >= 2 && searchResults.isEmpty()) {
                Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    Text("لم يتم العثور على نتائج مطابقة في الخادم", color = ArnTextSecondary, fontSize = 13.sp)
                }
            } else {
                LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(searchResults) { item ->
                        GlassCard(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            onClick = {
                                onClose()
                                onNavigateToMedia(item.type, item.id)
                            }
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                AsyncImage(
                                    model = ApiClient.getFullMediaUrl(item.poster),
                                    contentDescription = item.title,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier
                                        .size(48.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Text(text = item.title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                    Text(
                                        text = "${if (item.type == "movie") "فيلم" else if (item.type == "series") "مسلسل" else "صوتيات"} • ${item.subtitle ?: ""}",
                                        color = ArnTextSecondary,
                                        fontSize = 11.sp
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

data class SearchResultItem(
    val id: Int,
    val title: String,
    val type: String,
    val poster: String?,
    val subtitle: String?
)
