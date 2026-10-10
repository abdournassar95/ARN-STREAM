# Implementation Plan: UI Improvements & Fixes

## 1. Fix "Quran" Label in Audio Player
- **Issue:** The player incorrectly shows "القرآن الكريم" (The Holy Quran) when playing music.
- **Action:** In `AudioPlayerScreen.kt` (lines 105-110), I will update the label logic to dynamically display "القرآن الكريم" if the track belongs to a Quran library or album, otherwise, I'll use "مكتبة الصوتيات والموسيقى" or similar for general music.

## 2. Enhance Album Art in Music Player
- **Issue:** The album cover should be larger and more prominent.
- **Action:** In `AudioPlayerScreen.kt`, I will increase the size of the artwork `Box` and its contained `AsyncImage` to better fit the screen. I will also look into adding a smooth `animateContentSize` or scale animation to make the artwork transitions feel more professional.

## 3. Resolve "Uniform Album Art" Issue
- **Issue:** All albums appear to have the same cover (the artist's image).
- **Action:** In `ArtistDetailsScreen.kt` (lines 324-350), I will re-examine the logic used to determine the `albumCover`. It currently falls back to `artist?.displayImage` if `album.displayCover` is null. I will investigate why `album.displayCover` is consistently null and ensure the backend is queried for specific album covers rather than defaulting to the artist image.

Please review this plan. If you agree, I will proceed with implementation.
