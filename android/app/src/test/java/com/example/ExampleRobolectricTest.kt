package com.example

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import kotlinx.coroutines.flow.first

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ExampleRobolectricTest {

  @Test
  fun `read string from context`() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val appName = context.getString(R.string.app_name)
    assertEquals("ARN Stream", appName)
  }

  @Test
  fun `toggle and retrieve favorite media items in PreferencesManager`() = kotlinx.coroutines.test.runTest {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val prefsManager = com.example.data.storage.PreferencesManager(context)

    val movieItem = com.example.data.model.FavoriteMediaItem(
      id = 101,
      type = "movie",
      title = "Inception",
      poster = "/posters/inception.jpg",
      rating = 8.8,
      year = 2010
    )

    // 1. Initially not favorite
    val isInitiallyFav = prefsManager.isFavorite("movie", 101).first()
    org.junit.Assert.assertFalse(isInitiallyFav)

    // 2. Toggle to add
    val addedResult = prefsManager.toggleFavorite(movieItem)
    org.junit.Assert.assertTrue(addedResult)

    val isNowFav = prefsManager.isFavorite("movie", 101).first()
    org.junit.Assert.assertTrue(isNowFav)

    val allFavs = prefsManager.favoriteItems.first()
    assertEquals(1, allFavs.size)
    assertEquals("Inception", allFavs[0].title)

    // 3. Toggle again to remove
    val removedResult = prefsManager.toggleFavorite(movieItem)
    org.junit.Assert.assertFalse(removedResult)

    val isFinallyFav = prefsManager.isFavorite("movie", 101).first()
    org.junit.Assert.assertFalse(isFinallyFav)
  }
}
