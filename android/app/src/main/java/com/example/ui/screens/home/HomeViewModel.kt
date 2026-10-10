package com.example.ui.screens.home

import androidx.compose.runtime.mutableStateListOf
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.api.ApiClient
import com.example.data.discovery.ServerDiscoveryRepository
import com.example.data.model.*
import com.example.data.repository.MediaRepository
import com.example.data.storage.PreferencesManager
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch

class HomeViewModel(
    private val preferencesManager: PreferencesManager,
    private val discoveryRepo: ServerDiscoveryRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    private val _discoveredServers = mutableStateListOf<DiscoveredServer>()
    val discoveredServers: List<DiscoveredServer> get() = _discoveredServers

    init {
        checkInitialConnection()
    }

    private fun checkInitialConnection() {
        viewModelScope.launch {
            val savedUrl = preferencesManager.serverUrl.firstOrNull()
            if (!savedUrl.isNullOrEmpty()) {
                _uiState.value = _uiState.value.copy(connectedServerUrl = savedUrl)
                ApiClient.updateConfig(savedUrl)
                fetchRealData()
            } else {
                runDiscovery()
            }
        }
    }

    fun selectLibrary(id: Int) {
        _uiState.value = _uiState.value.copy(selectedLibraryId = id)
    }

    fun fetchRealData() {
        if (!ApiClient.isServerConfigured()) return

        _uiState.value = _uiState.value.copy(isLoading = true, loadError = null)
        viewModelScope.launch {
            try {
                // 1. Fetch real libraries from server
                val libRes = ApiClient.apiService.getLibraries(nonEmpty = false)
                val realLibs = libRes.data ?: emptyList()
                
                var selectedId = _uiState.value.selectedLibraryId
                if (selectedId == null && realLibs.isNotEmpty()) {
                    selectedId = realLibs.first().id
                }

                // 2. Concurrently fetch actual items for each real library
                val moviesMap = mutableMapOf<Int, List<Movie>>()
                val seriesMap = mutableMapOf<Int, List<Series>>()
                val artistsMap = mutableMapOf<Int, List<Artist>>()
                val postersMap = mutableMapOf<Int, List<String>>()

                coroutineScope {
                    realLibs.map { lib ->
                        async {
                            try {
                                val t = lib.type.lowercase()
                                val extractedPosters = mutableListOf<String>()

                                if (!lib.customCovers.isNullOrBlank()) {
                                    val covers = lib.customCovers.split(",", ";").map { it.trim() }.filter { it.isNotEmpty() }
                                    extractedPosters.addAll(covers)
                                }

                                when {
                                    t.contains("show") || t.contains("series") || t.contains("tv") -> {
                                        val res = ApiClient.apiService.getSeries(libraryId = lib.id, limit = 500)
                                        val seriesList = res.data ?: emptyList()
                                        if (seriesList.isNotEmpty()) {
                                            synchronized(seriesMap) { seriesMap[lib.id] = seriesList }
                                            extractedPosters.addAll(seriesList.mapNotNull { it.displayPoster ?: it.displayBackdrop })
                                        } else {
                                            val fallback = ApiClient.apiService.getLibraryDetails(lib.id, limit = 500)
                                            val fallbackItems = fallback.data?.items ?: emptyList()
                                            if (fallbackItems.isNotEmpty()) {
                                                synchronized(moviesMap) { moviesMap[lib.id] = fallbackItems }
                                                extractedPosters.addAll(fallbackItems.mapNotNull { it.displayPoster ?: it.displayBackdrop })
                                            }
                                        }
                                    }
                                    t.contains("music") || t.contains("quran") || t.contains("audio") -> {
                                        val artistRes = ApiClient.apiService.getArtists(libraryId = lib.id, limit = 500)
                                        val aList = artistRes.data ?: emptyList()
                                        if (aList.isNotEmpty()) {
                                            synchronized(artistsMap) { artistsMap[lib.id] = aList }
                                            extractedPosters.addAll(aList.mapNotNull { it.displayImage ?: it.image ?: it.poster })
                                        }
                                        try {
                                            val albRes = ApiClient.apiService.getAlbums(libraryId = lib.id, limit = 500)
                                            if (!albRes.data.isNullOrEmpty()) {
                                                MediaRepository.registerAlbums(albRes.data)
                                                extractedPosters.addAll(albRes.data.mapNotNull { it.displayCover })
                                            }
                                        } catch (_: Exception) {}
                                    }
                                    else -> {
                                        val res = ApiClient.apiService.getMovies(libraryId = lib.id, limit = 500)
                                        val mList = res.data ?: emptyList()
                                        if (mList.isNotEmpty()) {
                                            synchronized(moviesMap) { moviesMap[lib.id] = mList }
                                            extractedPosters.addAll(mList.mapNotNull { it.displayPoster ?: it.displayBackdrop })
                                        } else {
                                            val fallback = ApiClient.apiService.getLibraryDetails(lib.id, limit = 500)
                                            val fallbackItems = fallback.data?.items ?: emptyList()
                                            if (fallbackItems.isNotEmpty()) {
                                                synchronized(moviesMap) { moviesMap[lib.id] = fallbackItems }
                                                extractedPosters.addAll(fallbackItems.mapNotNull { it.displayPoster ?: it.displayBackdrop })
                                            }
                                        }
                                    }
                                }

                                synchronized(postersMap) {
                                    postersMap[lib.id] = extractedPosters.distinct().filter { it.isNotBlank() }
                                }
                            } catch (_: Exception) {}
                        }
                    }.awaitAll()
                }

                MediaRepository.registerLibraries(realLibs)
                MediaRepository.registerMovies(moviesMap.values.flatten())
                MediaRepository.registerSeries(seriesMap.values.flatten())
                MediaRepository.registerArtists(artistsMap.values.flatten())

                // 3. Fetch real continue watching with enriched posters
                val continueWatching = MediaRepository.getEnrichedContinueWatching()

                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    libraries = realLibs,
                    selectedLibraryId = selectedId,
                    libraryMoviesMap = moviesMap,
                    librarySeriesMap = seriesMap,
                    libraryArtistsMap = artistsMap,
                    libraryPostersMap = postersMap,
                    continueWatching = continueWatching
                )

            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    loadError = "فشل في جلب البيانات من الخادم: ${e.localizedMessage ?: "تأكد من عمل الخادم"}"
                )
            }
        }
    }

    fun connectToUrl(rawUrl: String) {
        val trimmed = rawUrl.trim()
        if (trimmed.isEmpty()) return

        _uiState.value = _uiState.value.copy(isConnectingServer = true, connectError = null)
        viewModelScope.launch {
            try {
                val formatted = if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) trimmed else "http://$trimmed"
                val cleanUrl = if (formatted.endsWith("/")) formatted else "$formatted/"
                ApiClient.updateConfig(cleanUrl)

                // Verify server
                val statusRes = try { ApiClient.apiService.getServerStatus() } catch (_: Exception) { null }
                val libRes = try { ApiClient.apiService.getLibraries(nonEmpty = false) } catch (_: Exception) { null }

                if (statusRes?.data != null || libRes?.data != null || statusRes?.success == true) {
                    preferencesManager.saveServerUrl(cleanUrl)
                    _uiState.value = _uiState.value.copy(connectedServerUrl = cleanUrl, isConnectingServer = false)
                    fetchRealData()
                } else {
                    _uiState.value = _uiState.value.copy(connectError = "الخادم لم يُرجع استجابة صالحة. تأكد من العنوان والمنفذ.", isConnectingServer = false)
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(connectError = "تعذر الاتصال بالخادم: ${e.localizedMessage ?: "تأكد من عنوان الـ IP والمنفذ"}", isConnectingServer = false)
            }
        }
    }

    fun runDiscovery() {
        _uiState.value = _uiState.value.copy(isDiscoveryRunning = true)
        _discoveredServers.clear()
        viewModelScope.launch {
            try {
                discoveryRepo.discoverServers().collect { server ->
                    if (_discoveredServers.none { it.baseUrl == server.baseUrl }) {
                        _discoveredServers.add(server)
                    }
                }
            } catch (_: Exception) {}
            _uiState.value = _uiState.value.copy(isDiscoveryRunning = false)
        }
    }
}

data class HomeUiState(
    val connectedServerUrl: String? = null,
    val libraries: List<Library> = emptyList(),
    val selectedLibraryId: Int? = null,
    val libraryMoviesMap: Map<Int, List<Movie>> = emptyMap(),
    val librarySeriesMap: Map<Int, List<Series>> = emptyMap(),
    val libraryArtistsMap: Map<Int, List<Artist>> = emptyMap(),
    val libraryPostersMap: Map<Int, List<String>> = emptyMap(),
    val continueWatching: List<PlaybackProgress> = emptyList(),
    val isLoading: Boolean = false,
    val loadError: String? = null,
    val isConnectingServer: Boolean = false,
    val connectError: String? = null,
    val isDiscoveryRunning: Boolean = false
)
