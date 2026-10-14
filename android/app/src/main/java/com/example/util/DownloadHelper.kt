package com.example.util

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.webkit.CookieManager
import android.webkit.MimeTypeMap
import android.webkit.URLUtil
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.core.content.FileProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.net.URLDecoder
import java.util.concurrent.TimeUnit
import java.util.regex.Pattern

object DownloadHelper {

    private const val CHANNEL_ID = "arn_downloads_channel"
    private const val CHANNEL_NAME = "تنزيلات ARN Stream"

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    fun downloadFile(
        context: Context,
        url: String,
        userAgent: String?,
        contentDisposition: String?,
        mimetype: String?
    ) {
        val appContext = context.applicationContext

        CoroutineScope(Dispatchers.IO).launch {
            // 1. Resolve filename and mime type
            var resolvedName: String? = extractFileNameFromDisposition(contentDisposition)
            var resolvedMime = mimetype
            val cookies = CookieManager.getInstance().getCookie(url)

            val headRequest = Request.Builder()
                .url(url)
                .head()
                .apply {
                    if (!cookies.isNullOrEmpty()) addHeader("cookie", cookies)
                    if (!userAgent.isNullOrEmpty()) addHeader("User-Agent", userAgent)
                }
                .build()

            try {
                httpClient.newCall(headRequest).execute().use { response ->
                    val respDisp = response.header("Content-Disposition")
                    val respType = response.header("Content-Type")

                    if (!respDisp.isNullOrEmpty()) {
                        val name = extractFileNameFromDisposition(respDisp)
                        if (!name.isNullOrEmpty()) resolvedName = name
                    }
                    if (!respType.isNullOrEmpty() && (resolvedMime.isNullOrEmpty() || resolvedMime == "application/octet-stream")) {
                        resolvedMime = respType.split(";")[0].trim()
                    }
                }
            } catch (_: Exception) {
            }

            if (resolvedName.isNullOrEmpty() || resolvedName!!.endsWith(".bin", ignoreCase = true)) {
                val candidateName = extractFileNameFromUrl(url)
                if (!candidateName.isNullOrEmpty()) resolvedName = candidateName
            }

            var finalFileName = resolvedName ?: URLUtil.guessFileName(url, contentDisposition, resolvedMime)
            if (finalFileName.endsWith(".bin", ignoreCase = true) || !finalFileName.contains(".")) {
                val extension = getExtensionFromMime(resolvedMime) ?: "mp4"
                finalFileName = if (finalFileName.contains(".")) {
                    finalFileName.substringBeforeLast(".") + ".$extension"
                } else {
                    "$finalFileName.$extension"
                }
            }

            finalFileName = sanitizeFileName(finalFileName)
            val finalMime = resolvedMime ?: getMimeFromExtension(finalFileName) ?: "video/mp4"

            withContext(Dispatchers.Main) {
                Toast.makeText(appContext, "جاري تنزيل: $finalFileName", Toast.LENGTH_SHORT).show()
            }

            // 2. Perform direct streaming download and write to MediaStore (Zero permission required on Android 10+)
            val notificationId = (System.currentTimeMillis() % 100000).toInt()
            val notificationManager = appContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            createNotificationChannel(notificationManager)

            val notifBuilder = NotificationCompat.Builder(appContext, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentTitle(finalFileName)
                .setContentText("جاري التنزيل...")
                .setOngoing(true)
                .setProgress(100, 0, true)
                .setPriority(NotificationCompat.PRIORITY_LOW)

            notificationManager?.notify(notificationId, notifBuilder.build())

            var outputStream: OutputStream? = null
            var savedFileUri: Uri? = null
            var legacyFile: File? = null

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val values = ContentValues().apply {
                        put(MediaStore.Downloads.DISPLAY_NAME, finalFileName)
                        put(MediaStore.Downloads.MIME_TYPE, finalMime)
                        put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/ARN_Stream")
                        put(MediaStore.Downloads.IS_PENDING, 1)
                    }

                    val collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                    savedFileUri = appContext.contentResolver.insert(collection, values)
                    if (savedFileUri != null) {
                        outputStream = appContext.contentResolver.openOutputStream(savedFileUri)
                    }
                } else {
                    val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                    val arnDir = File(downloadsDir, "ARN_Stream").apply { mkdirs() }
                    legacyFile = File(arnDir, finalFileName)
                    outputStream = FileOutputStream(legacyFile)
                }

                if (outputStream == null) {
                    throw IllegalStateException("تعذر إنشاء ملف في مجلد التنزيلات")
                }

                val getRequest = Request.Builder()
                    .url(url)
                    .apply {
                        if (!cookies.isNullOrEmpty()) addHeader("cookie", cookies)
                        if (!userAgent.isNullOrEmpty()) addHeader("User-Agent", userAgent)
                        addHeader("Accept-Encoding", "identity")
                    }
                    .build()

                httpClient.newCall(getRequest).execute().use { response ->
                    if (!response.isSuccessful) {
                        throw IllegalStateException("استجاب الخادم برمز خطأ: ${response.code}")
                    }

                    val body = response.body ?: throw IllegalStateException("محتوى الملف فارغ")
                    val totalBytes = body.contentLength()
                    val inputStream: InputStream = body.byteStream()

                    val buffer = ByteArray(32 * 1024)
                    var bytesRead: Int
                    var totalRead = 0L
                    var lastUpdate = System.currentTimeMillis()

                    while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                        outputStream.write(buffer, 0, bytesRead)
                        totalRead += bytesRead

                        val now = System.currentTimeMillis()
                        if (now - lastUpdate > 800) {
                            lastUpdate = now
                            if (totalBytes > 0) {
                                val progress = ((totalRead * 100) / totalBytes).toInt()
                                notifBuilder.setProgress(100, progress, false)
                                    .setContentText("$progress% (${formatSize(totalRead)} / ${formatSize(totalBytes)})")
                            } else {
                                notifBuilder.setProgress(100, 0, true)
                                    .setContentText("تم تنزيل ${formatSize(totalRead)}")
                            }
                            notificationManager?.notify(notificationId, notifBuilder.build())
                        }
                    }
                    outputStream.flush()
                }

                // Finalize MediaStore entry
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && savedFileUri != null) {
                    val updateValues = ContentValues().apply {
                        put(MediaStore.Downloads.IS_PENDING, 0)
                    }
                    appContext.contentResolver.update(savedFileUri, updateValues, null, null)
                } else if (legacyFile != null) {
                    MediaScannerConnection.scanFile(
                        appContext,
                        arrayOf(legacyFile.absolutePath),
                        arrayOf(finalMime),
                        null
                    )
                }

                // Show completed notification
                val viewIntent = Intent(Intent.ACTION_VIEW).apply {
                    if (savedFileUri != null) {
                        setDataAndType(savedFileUri, finalMime)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    } else if (legacyFile != null) {
                        val uri = FileProvider.getUriForFile(appContext, "${appContext.packageName}.provider", legacyFile)
                        setDataAndType(uri, finalMime)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }

                val pendingIntent = PendingIntent.getActivity(
                    appContext,
                    notificationId,
                    viewIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
                )

                val completeNotif = NotificationCompat.Builder(appContext, CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.stat_sys_download_done)
                    .setContentTitle("اكتمل التنزيل بنجاح")
                    .setContentText(finalFileName)
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .build()

                notificationManager?.notify(notificationId, completeNotif)

                withContext(Dispatchers.Main) {
                    Toast.makeText(appContext, "اكتمل تنزيل: $finalFileName في مجلد التنزيلات", Toast.LENGTH_LONG).show()
                }

            } catch (e: Exception) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && savedFileUri != null) {
                    try { appContext.contentResolver.delete(savedFileUri, null, null) } catch (_: Exception) {}
                }
                notificationManager?.cancel(notificationId)

                withContext(Dispatchers.Main) {
                    Toast.makeText(appContext, "فشل التنزيل: ${e.localizedMessage ?: "خطأ بالاتصال"}", Toast.LENGTH_LONG).show()
                }
            } finally {
                try { outputStream?.close() } catch (_: Exception) {}
            }
        }
    }

    private fun createNotificationChannel(notificationManager: NotificationManager?) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && notificationManager != null) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "إشعارات تقدم واكتمال تنزيلات ARN Stream"
            }
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun formatSize(bytes: Long): String {
        val mb = bytes / (1024.0 * 1024.0)
        return String.format(java.util.Locale.US, "%.1f MB", mb)
    }

    private fun extractFileNameFromDisposition(contentDisposition: String?): String? {
        if (contentDisposition.isNullOrEmpty()) return null
        try {
            val utf8Matcher = Pattern.compile("filename\\*=(?:UTF-8|utf-8)''([^;\\r\\n]+)").matcher(contentDisposition)
            if (utf8Matcher.find()) {
                val encoded = utf8Matcher.group(1)
                if (!encoded.isNullOrEmpty()) {
                    return URLDecoder.decode(encoded, "UTF-8").trim('\"', ' ')
                }
            }

            val matcher = Pattern.compile("filename=[\"']?([^\"';\\r\\n]+)[\"']?").matcher(contentDisposition)
            if (matcher.find()) {
                val name = matcher.group(1)
                if (!name.isNullOrEmpty()) {
                    return URLDecoder.decode(name, "UTF-8").trim('\"', ' ')
                }
            }
        } catch (_: Exception) {
        }
        return null
    }

    private fun extractFileNameFromUrl(url: String): String? {
        try {
            val uri = Uri.parse(url)
            for (param in listOf("filename", "file", "title", "name", "download")) {
                val value = uri.getQueryParameter(param)
                if (!value.isNullOrBlank()) {
                    return URLDecoder.decode(value, "UTF-8").trim()
                }
            }

            val lastSegment = uri.lastPathSegment
            if (!lastSegment.isNullOrBlank() && lastSegment.contains(".")) {
                return URLDecoder.decode(lastSegment, "UTF-8").trim()
            }
        } catch (_: Exception) {
        }
        return null
    }

    private fun getExtensionFromMime(mime: String?): String? {
        if (mime.isNullOrBlank()) return null
        val cleanMime = mime.split(";")[0].trim().lowercase()
        return when (cleanMime) {
            "video/mp4" -> "mp4"
            "video/x-matroska" -> "mkv"
            "video/webm" -> "webm"
            "audio/mpeg", "audio/mp3" -> "mp3"
            "audio/mp4", "audio/m4a" -> "m4a"
            "audio/flac" -> "flac"
            "audio/ogg" -> "ogg"
            "application/zip" -> "zip"
            "application/x-rar-compressed" -> "rar"
            "application/x-7z-compressed" -> "7z"
            else -> MimeTypeMap.getSingleton().getExtensionFromMimeType(cleanMime)
        }
    }

    private fun getMimeFromExtension(fileName: String): String? {
        val ext = fileName.substringAfterLast(".", "").lowercase()
        return when (ext) {
            "mp4" -> "video/mp4"
            "mkv" -> "video/x-matroska"
            "webm" -> "video/webm"
            "mp3" -> "audio/mpeg"
            "m4a" -> "audio/mp4"
            "flac" -> "audio/flac"
            "zip" -> "application/zip"
            else -> MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext)
        }
    }

    private fun sanitizeFileName(name: String): String {
        return name.replace(Regex("[\\\\/:*?\"<>|]"), "_")
            .trim()
            .ifEmpty { "arn_stream_media_${System.currentTimeMillis()}.mp4" }
    }
}
