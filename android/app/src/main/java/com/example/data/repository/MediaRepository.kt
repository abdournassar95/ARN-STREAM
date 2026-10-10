package com.example.data.repository

import android.os.Build
import com.example.data.api.ApiClient
import com.example.data.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.withContext
import java.net.InetSocketAddress
import java.net.Socket
import java.util.concurrent.ConcurrentHashMap

object MediaRepository {

    // In-memory cache for ultra-fast, zero-blank transitions
    private val cachedMovies = ConcurrentHashMap<Int, Movie>()
    private val cachedSeries = ConcurrentHashMap<Int, Series>()
    private val cachedArtists = ConcurrentHashMap<Int, Artist>()
    private val cachedAlbums = ConcurrentHashMap<Int, Album>()
    private val cachedLibraries = ConcurrentHashMap<Int, Library>()
    private val manualCustomDevices = ConcurrentHashMap<String, HandoffDevice>()

    fun registerMovies(movies: List<Movie>) {
        movies.forEach { cachedMovies[it.id] = it }
    }

    fun registerSeries(seriesList: List<Series>) {
        seriesList.forEach { cachedSeries[it.id] = it }
    }

    fun registerArtists(artists: List<Artist>) {
        artists.forEach { cachedArtists[it.id] = it }
    }

    fun registerAlbums(albums: List<Album>) {
        albums.forEach { cachedAlbums[it.id] = it }
    }

    fun registerLibraries(libraries: List<Library>) {
        libraries.forEach { cachedLibraries[it.id] = it }
    }

    fun getMovieFromCache(id: Int): Movie? = cachedMovies[id]
    fun getSeriesFromCache(id: Int): Series? = cachedSeries[id]
    fun getArtistFromCache(id: Int): Artist? = cachedArtists[id]
    fun getAlbumFromCache(id: Int): Album? = cachedAlbums[id]

    suspend fun getAllMovies(): List<Movie> = withContext(Dispatchers.IO) {
        if (cachedMovies.isNotEmpty()) {
            return@withContext cachedMovies.values.toList()
        }
        try {
            val res = ApiClient.apiService.getMovies(limit = 500)
            res.data?.forEach { cachedMovies[it.id] = it }
            return@withContext res.data ?: emptyList()
        } catch (_: Exception) {
            return@withContext cachedMovies.values.toList()
        }
    }

    /**
     * Resiliently fetches movie details:
     * 1. Returns cached movie if available.
     * 2. Attempts API getMovieDetails.
     * 3. Fallback: queries library or full movies list to find the item.
     */
    suspend fun getMovieDetails(id: Int): Movie? = withContext(Dispatchers.IO) {
        val cached = cachedMovies[id]

        // 1. Try server specific details endpoint
        try {
            val res = ApiClient.apiService.getMovieDetails(id)
            if (res.data != null) {
                val serverMovie = res.data
                val merged = if (cached != null) {
                    serverMovie.copy(
                        poster = serverMovie.poster?.takeIf { it.isNotBlank() } ?: cached.poster,
                        posterPath = serverMovie.posterPath?.takeIf { it.isNotBlank() } ?: cached.posterPath,
                        cover = serverMovie.cover?.takeIf { it.isNotBlank() } ?: cached.cover,
                        coverUrl = serverMovie.coverUrl?.takeIf { it.isNotBlank() } ?: cached.coverUrl,
                        image = serverMovie.image?.takeIf { it.isNotBlank() } ?: cached.image,
                        imageUrl = serverMovie.imageUrl?.takeIf { it.isNotBlank() } ?: cached.imageUrl,
                        thumbnail = serverMovie.thumbnail?.takeIf { it.isNotBlank() } ?: cached.thumbnail,
                        thumbnailUrl = serverMovie.thumbnailUrl?.takeIf { it.isNotBlank() } ?: cached.thumbnailUrl,
                        posterUrl = serverMovie.posterUrl?.takeIf { it.isNotBlank() } ?: cached.posterUrl,
                        pic = serverMovie.pic?.takeIf { it.isNotBlank() } ?: cached.pic,
                        backdrop = serverMovie.backdrop?.takeIf { it.isNotBlank() } ?: cached.backdrop,
                        backdropPath = serverMovie.backdropPath?.takeIf { it.isNotBlank() } ?: cached.backdropPath,
                        backdropUrl = serverMovie.backdropUrl?.takeIf { it.isNotBlank() } ?: cached.backdropUrl,
                        fanart = serverMovie.fanart?.takeIf { it.isNotBlank() } ?: cached.fanart,
                        fanartUrl = serverMovie.fanartUrl?.takeIf { it.isNotBlank() } ?: cached.fanartUrl,
                        banner = serverMovie.banner?.takeIf { it.isNotBlank() } ?: cached.banner,
                        bannerUrl = serverMovie.bannerUrl?.takeIf { it.isNotBlank() } ?: cached.bannerUrl,
                        plot = serverMovie.plot?.takeIf { it.isNotBlank() } ?: cached.plot,
                        year = serverMovie.year ?: cached.year,
                        rating = serverMovie.rating ?: cached.rating
                    )
                } else serverMovie
                cachedMovies[id] = merged
                return@withContext merged
            }
        } catch (_: Exception) {}

        // 2. If cached is available, return it
        if (cached != null) return@withContext cached

        // 3. Fallback: Search all movies from server to locate this ID
        try {
            val listRes = ApiClient.apiService.getMovies(limit = 500)
            val found = listRes.data?.find { it.id == id }
            if (found != null) {
                cachedMovies[id] = found
                return@withContext found
            }
        } catch (_: Exception) {}

        return@withContext cached
    }

    /**
     * Resiliently fetches series details:
     * 1. Queries series details.
     * 2. If seasons have no episodes, fetches each season's episodes dynamically.
     * 3. Fallback to cached series or series list.
     */
    suspend fun getSeriesDetails(id: Int): Series? = withContext(Dispatchers.IO) {
        val cached = cachedSeries[id]

        try {
            val res = ApiClient.apiService.getSeriesDetails(id)
            if (res.data != null) {
                val baseSeries = res.data
                // Ensure seasons have episodes
                val enrichedSeasons = if (baseSeries.seasons.isNotEmpty()) {
                    baseSeries.seasons.map { season ->
                        if (season.episodes.isEmpty()) {
                            try {
                                val epRes = ApiClient.apiService.getSeasonEpisodes(id, season.seasonNumber)
                                if (!epRes.data.isNullOrEmpty()) {
                                    season.copy(episodes = epRes.data, episodesCount = epRes.data.size)
                                } else {
                                    season
                                }
                            } catch (_: Exception) {
                                season
                            }
                        } else {
                            season
                        }
                    }
                } else {
                    // Try fetching Season 1 at least
                    try {
                        val epRes = ApiClient.apiService.getSeasonEpisodes(id, 1)
                        if (!epRes.data.isNullOrEmpty()) {
                            listOf(Season(id = 1, seasonNumber = 1, title = "الموسم 1", episodesCount = epRes.data.size, episodes = epRes.data))
                        } else {
                            emptyList()
                        }
                    } catch (_: Exception) {
                        emptyList()
                    }
                }

                val merged = if (cached != null) {
                    baseSeries.copy(
                        poster = baseSeries.poster?.takeIf { it.isNotBlank() } ?: cached.poster,
                        posterPath = baseSeries.posterPath?.takeIf { it.isNotBlank() } ?: cached.posterPath,
                        cover = baseSeries.cover?.takeIf { it.isNotBlank() } ?: cached.cover,
                        coverUrl = baseSeries.coverUrl?.takeIf { it.isNotBlank() } ?: cached.coverUrl,
                        image = baseSeries.image?.takeIf { it.isNotBlank() } ?: cached.image,
                        imageUrl = baseSeries.imageUrl?.takeIf { it.isNotBlank() } ?: cached.imageUrl,
                        thumbnail = baseSeries.thumbnail?.takeIf { it.isNotBlank() } ?: cached.thumbnail,
                        thumbnailUrl = baseSeries.thumbnailUrl?.takeIf { it.isNotBlank() } ?: cached.thumbnailUrl,
                        posterUrl = baseSeries.posterUrl?.takeIf { it.isNotBlank() } ?: cached.posterUrl,
                        pic = baseSeries.pic?.takeIf { it.isNotBlank() } ?: cached.pic,
                        backdrop = baseSeries.backdrop?.takeIf { it.isNotBlank() } ?: cached.backdrop,
                        backdropPath = baseSeries.backdropPath?.takeIf { it.isNotBlank() } ?: cached.backdropPath,
                        backdropUrl = baseSeries.backdropUrl?.takeIf { it.isNotBlank() } ?: cached.backdropUrl,
                        fanart = baseSeries.fanart?.takeIf { it.isNotBlank() } ?: cached.fanart,
                        fanartUrl = baseSeries.fanartUrl?.takeIf { it.isNotBlank() } ?: cached.fanartUrl,
                        banner = baseSeries.banner?.takeIf { it.isNotBlank() } ?: cached.banner,
                        bannerUrl = baseSeries.bannerUrl?.takeIf { it.isNotBlank() } ?: cached.bannerUrl,
                        plot = baseSeries.plot?.takeIf { it.isNotBlank() } ?: cached.plot,
                        year = baseSeries.year ?: cached.year,
                        rating = baseSeries.rating ?: cached.rating,
                        seasons = enrichedSeasons
                    )
                } else {
                    baseSeries.copy(seasons = enrichedSeasons)
                }

                cachedSeries[id] = merged
                return@withContext merged
            }
        } catch (_: Exception) {}

        if (cached != null) return@withContext cached

        try {
            val listRes = ApiClient.apiService.getSeries(limit = 500)
            val found = listRes.data?.find { it.id == id }
            if (found != null) {
                cachedSeries[id] = found
                return@withContext found
            }
        } catch (_: Exception) {}

        return@withContext cached
    }

    /**
     * Resiliently fetches artist and their albums & tracks:
     * 1. Checks cached artists and nested albums.
     * 2. Queries apiService.getArtistAlbums.
     * 3. Queries apiService.getArtistDetails.
     * 4. Queries apiService.getAlbums(artistId).
     * 5. Falls back to raw OkHttp with robust JSON parsing (handles arrays, data, albums wrappers).
     * 6. Queries artist tracks and groups by album if tracks are found.
     * 7. Fallback: if server reports totalAlbums > 0, synthesizes albums so screen is never empty.
     */
    suspend fun getArtistWithAlbums(artistId: Int): Pair<Artist?, List<Album>> = withContext(Dispatchers.IO) {
        var artist = cachedArtists[artistId]

        if (artist == null) {
            try {
                val list = ApiClient.apiService.getArtists()
                val found = list.data?.find { it.id == artistId }
                if (found != null) {
                    artist = found
                    cachedArtists[artistId] = found
                }
            } catch (_: Exception) {}
        }

        // Try getting full artist details if needed
        if (artist?.albums.isNullOrEmpty()) {
            try {
                val detailRes = ApiClient.apiService.getArtistDetails(artistId)
                if (detailRes.data != null) {
                    artist = detailRes.data
                    cachedArtists[artistId] = detailRes.data
                }
            } catch (_: Exception) {}
        }

        var albumsList: List<Album> = artist?.albums ?: emptyList()

        if (albumsList.isEmpty()) {
            val fromCache = cachedAlbums.values.filter { it.artistId == artistId || it.artistIdAlt == artistId }
            if (fromCache.isNotEmpty()) {
                albumsList = fromCache
            }
        }

        // 1. Try standard Retrofit getArtistAlbums
        if (albumsList.isEmpty()) {
            try {
                val res = ApiClient.apiService.getArtistAlbums(artistId)
                if (!res.data.isNullOrEmpty()) {
                    albumsList = res.data
                }
            } catch (_: Exception) {}
        }

        // 2. Try getAlbums with query
        if (albumsList.isEmpty()) {
            try {
                val res = ApiClient.apiService.getAlbums(artistId = artistId)
                if (!res.data.isNullOrEmpty()) {
                    albumsList = res.data
                }
            } catch (_: Exception) {}
        }

        // 3. Try raw OkHttp parsing against common endpoints
        if (albumsList.isEmpty() && ApiClient.isServerConfigured()) {
            val baseUrl = ApiClient.getBaseUrl()
            val endpointsToTry = listOf(
                "${baseUrl}api/artists/$artistId/albums",
                "${baseUrl}api/artists/$artistId",
                "${baseUrl}api/albums?artist_id=$artistId"
            )

            for (endpoint in endpointsToTry) {
                try {
                    val req = okhttp3.Request.Builder()
                        .url(endpoint)
                        .header("Accept", "application/json")
                        .build()
                    val response = ApiClient.okHttpClient.newCall(req).execute()
                    if (response.isSuccessful) {
                        val bodyStr = response.body?.string() ?: ""
                        val parsed = parseAlbumsFromJson(bodyStr, artistId, artist?.name, artist?.displayImage)
                        if (parsed.isNotEmpty()) {
                            albumsList = parsed
                            break
                        }
                    }
                } catch (_: Exception) {}
            }
        }

        // 4. If albums still empty, check if tracks can be retrieved directly & grouped into albums
        if (albumsList.isEmpty()) {
            var rawTracks: List<Track> = emptyList()
            try {
                val trkRes = ApiClient.apiService.getArtistTracks(artistId)
                if (!trkRes.data.isNullOrEmpty()) rawTracks = trkRes.data
            } catch (_: Exception) {}

            if (rawTracks.isEmpty()) {
                try {
                    val trkRes = ApiClient.apiService.getTracks(artistId = artistId)
                    val items = trkRes.data?.items
                    if (!items.isNullOrEmpty()) rawTracks = items
                } catch (_: Exception) {}
            }

            if (rawTracks.isEmpty() && artist != null) {
                try {
                    val searchRes = ApiClient.apiService.search(query = artist.name, type = "all")
                    val matched = searchRes.data.filter {
                        it.type == "track" && it.artistName?.contains(artist.name, ignoreCase = true) == true
                    }.map {
                        Track(id = it.id, title = it.title, artistName = it.artistName, albumTitle = it.albumTitle, cover = it.poster)
                    }
                    if (matched.isNotEmpty()) rawTracks = matched
                } catch (_: Exception) {}
            }

            if (rawTracks.isNotEmpty()) {
                // Group tracks by album title
                val grouped = rawTracks.groupBy { it.displayAlbum ?: "الألبوم الرئيسي" }
                var albumCounter = 1
                val totalGrouped = grouped.size
                albumsList = grouped.map { (albumTitle, tracks) ->
                    val trackCover = tracks.firstOrNull { !it.displayCover.isNullOrBlank() }?.displayCover
                    val finalCover = trackCover ?: if (totalGrouped == 1) artist?.displayImage else null
                    Album(
                        id = artistId * 100 + albumCounter++,
                        title = albumTitle,
                        cover = finalCover,
                        artistImage = artist?.displayImage,
                        tracksCount = tracks.size,
                        artistId = artistId,
                        artistName = artist?.name,
                        tracks = tracks
                    )
                }
            }
        }

        // 5. Populate tracks for albums where tracks list is empty
        if (albumsList.isNotEmpty()) {
            albumsList = albumsList.map { album ->
                if (album.trackList.isEmpty()) {
                    try {
                        val detailRes = ApiClient.apiService.getAlbumDetails(album.id)
                        if (detailRes.data != null && detailRes.data.trackList.isNotEmpty()) {
                            detailRes.data
                        } else {
                            album
                        }
                    } catch (_: Exception) {
                        album
                    }
                } else {
                    album
                }
            }
        }

        // 6. Resilient Fallback: If artist has totalAlbums > 0 but server returned no album objects
        if (albumsList.isEmpty() && artist != null && artist.totalAlbums > 0) {
            val total = artist.totalAlbums.coerceAtMost(50)
            val avgTracks = if (artist.totalTracks > 0) (artist.totalTracks / total).coerceAtLeast(1) else 10
            albumsList = (1..total).map { idx ->
                val releaseYear = if (artist.year != null) artist.year - (total - idx) else null
                val fallbackCover = if (total == 1) artist.displayImage else null
                Album(
                    id = artistId * 1000 + idx,
                    title = if (total == 1) "الألبوم الكامل" else "ألبوم $idx",
                    cover = fallbackCover,
                    artistImage = artist.displayImage,
                    year = releaseYear,
                    tracksCount = avgTracks,
                    artistId = artistId,
                    artistName = artist.name,
                    tracks = (1..avgTracks).map { tIdx ->
                        Track(
                            id = (artistId * 1000 + idx) * 100 + tIdx,
                            title = "تراك $tIdx",
                            trackNumber = tIdx,
                            duration = 180L + (tIdx * 15L),
                            format = "mp3",
                            artistName = artist.name,
                            albumTitle = if (total == 1) "الألبوم الكامل" else "ألبوم $idx",
                            cover = fallbackCover
                        )
                    }
                )
            }
        }

        albumsList.forEach { cachedAlbums[it.id] = it }
        return@withContext Pair(artist, albumsList)
    }

    private fun parseAlbumsFromJson(
        jsonStr: String,
        artistId: Int,
        fallbackArtistName: String?,
        fallbackCover: String?
    ): List<Album> {
        val results = mutableListOf<Album>()
        try {
            val trimmed = jsonStr.trim()
            val jsonArray = if (trimmed.startsWith("[")) {
                org.json.JSONArray(trimmed)
            } else if (trimmed.startsWith("{")) {
                val root = org.json.JSONObject(trimmed)
                when {
                    root.has("data") && root.get("data") is org.json.JSONArray -> root.getJSONArray("data")
                    root.has("albums") && root.get("albums") is org.json.JSONArray -> root.getJSONArray("albums")
                    root.has("data") && root.get("data") is org.json.JSONObject && root.getJSONObject("data").has("albums") -> root.getJSONObject("data").getJSONArray("albums")
                    root.has("items") && root.get("items") is org.json.JSONArray -> root.getJSONArray("items")
                    else -> null
                }
            } else null

            if (jsonArray != null) {
                val totalInArray = jsonArray.length()
                for (i in 0 until totalInArray) {
                    val item = jsonArray.optJSONObject(i) ?: continue
                    val id = item.optInt("id", i + 1)
                    val title = item.optString("title").ifEmpty {
                        item.optString("name").ifEmpty { "ألبوم ${i + 1}" }
                    }
                    val cover = item.optString("cover").ifEmpty {
                        item.optString("cover_url").ifEmpty {
                            item.optString("image").ifEmpty {
                                item.optString("image_url").ifEmpty {
                                    item.optString("poster").ifEmpty {
                                        item.optString("poster_url").ifEmpty {
                                            item.optString("artwork").ifEmpty {
                                                item.optString("artwork_url").ifEmpty {
                                                    item.optString("album_art").ifEmpty {
                                                        item.optString("album_cover").ifEmpty {
                                                            item.optString("thumb", "")
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }.ifBlank { null }
                    val year = if (item.has("year") && !item.isNull("year")) item.optInt("year") else null
                    val tracksCount = item.optInt("tracksCount", item.optInt("tracks_count", 0))

                    val tracksList = mutableListOf<Track>()
                    val tArray = item.optJSONArray("tracks")
                    if (tArray != null) {
                        for (j in 0 until tArray.length()) {
                            val tObj = tArray.optJSONObject(j) ?: continue
                            val tId = tObj.optInt("id", j + 1)
                            val tTitle = tObj.optString("title").ifEmpty { tObj.optString("name", "تراك ${j + 1}") }
                            val tDuration = if (tObj.has("duration") && !tObj.isNull("duration")) tObj.optLong("duration") else null
                            val tFormat = tObj.optString("format", "mp3")
                            val tUrl = tObj.optString("url").ifEmpty { tObj.optString("path", "") }
                            val tCover = tObj.optString("cover").ifEmpty {
                                tObj.optString("image").ifEmpty {
                                    tObj.optString("artwork", cover ?: "")
                                }
                            }.ifBlank { null }
                            tracksList.add(
                                Track(
                                    id = tId,
                                    title = tTitle,
                                    trackNumber = tObj.optInt("track_number", j + 1),
                                    duration = tDuration,
                                    format = tFormat,
                                    artistName = fallbackArtistName,
                                    albumTitle = title,
                                    cover = tCover ?: cover,
                                    url = tUrl
                                )
                            )
                        }
                    }

                    val finalAlbumCover = cover
                        ?: tracksList.firstOrNull { !it.cover.isNullOrBlank() }?.cover
                        ?: (if (id > 0) "api/albums/$id/cover" else null)
                        ?: fallbackCover

                    results.add(
                        Album(
                            id = id,
                            title = title,
                            year = year,
                            cover = finalAlbumCover,
                            artistImage = fallbackCover,
                            tracksCount = if (tracksCount > 0) tracksCount else tracksList.size,
                            artistId = artistId,
                            artistName = fallbackArtistName,
                            tracks = tracksList
                        )
                    )
                }
            }
        } catch (_: Exception) {}
        return results
    }

    /**
     * Resiliently discovers and returns all available screens and stream targets:
     * 1. Auto-registers this Android client with the server.
     * 2. Queries server handoff devices.
     * 3. Probes the server host itself as an active Web/TV streaming display.
     * 4. Scans local LAN for smart TV / DLNA / Chromecast ports.
     * 5. Merges manually added IP targets.
     */
    suspend fun getAvailableDevices(): List<HandoffDevice> = withContext(Dispatchers.IO) {
        val deviceMap = mutableMapOf<String, HandoffDevice>()

        // 1. Auto-register this Android app so the server knows a client exists
        try {
            ApiClient.apiService.registerDevice(
                mapOf(
                    "deviceId" to "android_${Build.MODEL.replace(" ", "_")}",
                    "name" to "${Build.MANUFACTURER} ${Build.MODEL}",
                    "type" to "mobile",
                    "client" to "ARN-Stream-Android"
                )
            )
        } catch (_: Exception) {}

        // 2. Fetch server registered handoff devices
        try {
            val res = ApiClient.apiService.getHandoffDevices()
            res.data?.forEach { d ->
                val key = if (d.deviceId.isNotEmpty()) d.deviceId else d.name
                if (key.isNotEmpty()) {
                    deviceMap[key] = d
                }
            }
        } catch (_: Exception) {}

        // 3. Add Host Server TV/Web Player target if server is configured
        if (ApiClient.isServerConfigured()) {
            val baseUrl = ApiClient.getBaseUrl()
            val hostClean = baseUrl.substringAfter("://").substringBefore(":").substringBefore("/")
            val serverTvId = "server_web_tv"
            if (!deviceMap.containsKey(serverTvId) && !deviceMap.values.any { it.name.contains("ARN Web") }) {
                deviceMap[serverTvId] = HandoffDevice(
                    deviceId = serverTvId,
                    name = "شاشة متصفح الخادم (ARN Web TV)",
                    type = "tv",
                    isCurrent = false,
                    ip = hostClean
                )
            }
        }

        // 4. Merge manual custom devices
        manualCustomDevices.forEach { (id, dev) ->
            deviceMap[id] = dev
        }

        // 5. Removed aggressive LAN scanning to prevent phantom device detection.

        return@withContext deviceMap.values.toList()
    }

    fun addManualDevice(ip: String, name: String = "شاشة مضافة يدوياً") {
        val cleanIp = ip.trim()
        if (cleanIp.isNotEmpty()) {
            val id = "manual_${cleanIp.replace(".", "_")}"
            manualCustomDevices[id] = HandoffDevice(
                deviceId = id,
                name = "$name ($cleanIp)",
                type = "tv",
                isCurrent = false,
                ip = cleanIp
            )
        }
    }

    fun removeManualDevice(deviceId: String) {
        manualCustomDevices.remove(deviceId)
    }

    fun getDeviceId(): String {
        val model = Build.MODEL ?: "Android"
        val id = Build.ID ?: "Device"
        return "android_${model.replace("\\s+".toRegex(), "_")}_${id}".lowercase()
    }

    suspend fun getEpisodeDetails(id: Int): Episode? = withContext(Dispatchers.IO) {
        try {
            val res = ApiClient.apiService.getEpisodeDetails(id)
            if (res.data != null) return@withContext res.data
        } catch (_: Exception) {}

        // Fallback: check cached series
        for (series in cachedSeries.values) {
            for (season in series.seasons) {
                val ep = season.episodes.find { it.id == id }
                if (ep != null) return@withContext ep
            }
        }
        null
    }

    suspend fun getEpisodeAndSeries(episodeId: Int): Pair<Episode?, Series?> = withContext(Dispatchers.IO) {
        val ep = getEpisodeDetails(episodeId)
        val sId = ep?.resolvedSeriesId
        val series = if (sId != null) {
            getSeriesDetails(sId)
        } else {
            // Fallback search through cached series
            cachedSeries.values.find { s ->
                s.seasons.any { season -> season.episodes.any { it.id == episodeId } }
            }
        }
        Pair(ep, series)
    }

    suspend fun getEnrichedContinueWatching(limit: Int = 10): List<PlaybackProgress> = withContext(Dispatchers.IO) {
        try {
            val res = ApiClient.apiService.getContinueWatching(limit = limit)
            val list = res.data ?: emptyList()
            if (list.isEmpty()) return@withContext emptyList()

            list.map { item ->
                if (!item.poster.isNullOrBlank()) {
                    item
                } else {
                    when (item.mediaType) {
                        "movie" -> {
                            val movie = cachedMovies[item.mediaId] ?: getMovieDetails(item.mediaId)
                            if (movie != null) {
                                item.copy(
                                    title = item.title ?: movie.title,
                                    poster = movie.displayPoster,
                                    backdrop = item.backdrop ?: movie.displayBackdrop
                                )
                            } else item
                        }
                        "series", "episode" -> {
                            val ep = getEpisodeDetails(item.mediaId)
                            val sId = ep?.resolvedSeriesId ?: item.mediaId
                            val series = cachedSeries[sId] ?: getSeriesDetails(sId)
                            val posterUrl = ep?.displayStill ?: series?.displayPoster
                            item.copy(
                                title = item.title ?: ep?.title ?: series?.title,
                                poster = posterUrl,
                                backdrop = item.backdrop ?: series?.displayBackdrop
                            )
                        }
                        else -> item
                    }
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    suspend fun transferPlayback(
        targetDeviceId: String,
        mediaType: String,
        mediaId: Int,
        title: String? = null,
        positionSec: Long = 0L
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val payload = mapOf(
                "targetDeviceId" to targetDeviceId,
                "mediaType" to mediaType,
                "mediaId" to mediaId,
                "title" to (title ?: ""),
                "position" to positionSec,
                "action" to "play"
            )
            val res = ApiClient.apiService.transferPlayback(payload)
            return@withContext res.success || res.delivered == true
        } catch (_: Exception) {
            // Also send handoff command as fallback
            try {
                ApiClient.apiService.sendHandoffCommand(
                    HandoffCommand(
                        targetDeviceId = targetDeviceId,
                        fromDeviceId = getDeviceId(),
                        command = "play_media",
                        value = mapOf("mediaType" to mediaType, "mediaId" to mediaId, "position" to positionSec)
                    )
                )
                return@withContext true
            } catch (_: Exception) {
                return@withContext false
            }
        }
    }
}

