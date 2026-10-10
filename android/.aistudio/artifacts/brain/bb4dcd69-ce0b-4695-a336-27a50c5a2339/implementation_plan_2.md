# Implementation Plan: Fix Login Error & Add Album Cover

## 1. Fix Login Issue
- **Investigation:** Analyze `ProfileLoginScreen.kt` to identify why login fails despite correct credentials.
- **Action:** Add logging to capture server error responses.
- **Potential Fix:** Ensure that `ApiClient.setToken` is called correctly and that the `LoginRequest` format matches the server's expectation.

## 2. Display Album Cover in Music Player
- **Investigation:** `AudioPlayerScreen.kt` uses `track?.cover` to display the album artwork using `AsyncImage`.
- **Action:** Verify the backend data model and API response to ensure the `cover` field is populated with a valid image URL. If `cover` is null, I will add logic to fallback to an artist image or a generic placeholder icon.

## 3. Redirect to Home on Success
- **Investigation:** The `ProfileLoginScreen` currently calls `onLoginSuccess()`.
- **Action:** Ensure the callback is correctly hooked up in `AppNavigation.kt` to navigate to the "home" destination and pop the login screen from the backstack, ensuring the user lands on the Home screen after a successful login.

Please review this plan. If you agree, I will proceed with implementation.
