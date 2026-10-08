import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  timeout: 15000
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('arn_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      // Don't auto-redirect if checking status
      if (!err.config?.url?.includes('/auth/status')) {
        localStorage.removeItem('arn_auth_token');
        window.location.href = '/login';
      }
    }
    console.error('[API Error]', err.response?.data || err.message);
    return Promise.reject(err);
  }
);

export default client;

// Helpers
export const fetchLibraries = (nonEmpty = false) => client.get('/libraries', { params: { non_empty: nonEmpty } }).then(r => r.data.data);
export const fetchLibrary = (id, params) => client.get(`/libraries/${id}`, { params }).then(r => r.data.data);
export const fetchLanding = () => client.get('/library/landing').then(r => r.data.data);
export const fetchMoviesHome = () => client.get('/library/movies-home').then(r => r.data.data);
export const fetchMusicHome = () => client.get('/library/music-home').then(r => r.data.data);
export const fetchMovies = (params) => client.get('/movies', { params }).then(r => r.data);
export const fetchMovie = (id) => client.get(`/movies/${id}`).then(r => r.data.data);
export const fetchSimilarMovies = (id) => client.get(`/movies/${id}/similar`).then(r => r.data.data);
export const deleteMovieApi = (id) => client.delete(`/movies/${id}`).then(r => r.data);
export const fetchSeriesList = (params) => client.get('/series', { params }).then(r => r.data);
export const fetchSeries = (id) => client.get(`/series/${id}`).then(r => r.data.data);
export const fetchSimilarSeries = (id) => client.get(`/series/${id}/similar`).then(r => r.data.data);
export const deleteSeriesApi = (id) => client.delete(`/series/${id}`).then(r => r.data);
export const scanSingleSeries = (id) => client.post(`/series/${id}/scan`).then(r => r.data);
export const scanSingleSeason = (seasonId) => client.post(`/series/seasons/${seasonId}/scan`).then(r => r.data);
export const fetchArtists = (params) => client.get('/artists', { params }).then(r => r.data.data);
export const fetchArtist = (id) => client.get(`/artists/${id}`).then(r => r.data.data);
export const fetchAlbums = (params) => client.get('/albums', { params }).then(r => r.data.data);
export const fetchAlbum = (id) => client.get(`/albums/${id}`).then(r => r.data.data);
export const deleteAlbumApi = (id) => client.delete(`/albums/${id}`).then(r => r.data);
export const fetchTracks = (params) => client.get('/tracks', { params }).then(r => r.data.data);
export const searchAll = (q, type='all') => client.get('/search', { params: { q, type } }).then(r => r.data.data);
export const fetchSearchSuggestions = (q, limit = 8) => client.get('/search', { params: { q, limit } }).then(r => r.data);
export const searchMetadata = (q, type) => client.get('/metadata/search', { params: { q, type } }).then(r => r.data.data);
export const fetchTmdbKey = () => client.get('/metadata/tmdb-key').then(r => r.data.data);
export const saveTmdbKey = (key) => client.post('/metadata/tmdb-key', { key }).then(r => r.data);
export const updateMetadata = (type, id, payload) => client.put(`/metadata/${type}/${id}`, payload).then(r => r.data);
export const updatePoster = (type, id, formDataOrUrl, imageType = 'poster') => {
  if (typeof formDataOrUrl === 'string') {
    return client.post(`/metadata/${type}/${id}/poster`, { imageUrl: formDataOrUrl, imageType }).then(r => r.data);
  }
  if (formDataOrUrl instanceof FormData && !formDataOrUrl.has('imageType')) {
    formDataOrUrl.append('imageType', imageType);
  }
  return client.post(`/metadata/${type}/${id}/poster`, formDataOrUrl).then(r => r.data);
};
export const updateSeason = (id, payload) => client.put(`/metadata/season/${id}`, payload).then(r => r.data);
export const updateSeasonImage = (id, formDataOrUrl, imageType = 'season_poster') => updatePoster('season', id, formDataOrUrl, imageType);
export const updateArtist = (id, payload) => client.put(`/metadata/artist/${id}`, payload).then(r => r.data);
export const updateArtistImage = (id, formDataOrUrl, imageType = 'poster') => updatePoster('artist', id, formDataOrUrl, imageType);
export const fetchMediaImages = (type, id) => client.get(`/metadata/${type}/${id}/images`).then(r => r.data.data);
export const setPrimaryImage = (imageId) => client.post(`/metadata/images/${imageId}/set-primary`).then(r => r.data);
export const deleteMediaImage = (imageId) => client.delete(`/metadata/images/${imageId}`).then(r => r.data);
export const deleteBackdrop = (type, id) => client.delete(`/metadata/${type}/${id}/backdrop`).then(r => r.data);
export const deletePoster = (type, id) => client.delete(`/metadata/${type}/${id}/poster`).then(r => r.data);
export const fetchContinue = () => client.get('/playback/continue').then(r => r.data.data);
export const savePlayback = (data) => client.post('/playback', data);
export const fetchRating = (type, id) => client.get(`/ratings/${type}/${id}`).then(r => r.data.data);
export const saveRating = (type, id, rating, review) => client.post(`/ratings/${type}/${id}`, { rating, review }).then(r => r.data.data);
export const fetchTags = () => client.get('/tags').then(r => r.data.data);
export const createTag = (payload) => client.post('/tags', payload).then(r => r.data.data);
export const assignTag = (tagId, media_type, media_id) => client.post(`/tags/${tagId}/assign`, { media_type, media_id });
export const unassignTag = (tagId, media_type, media_id) => client.post(`/tags/${tagId}/unassign`, { media_type, media_id });
export const fetchCollections = () => client.get('/collections').then(r => r.data.data);
export const fetchCollection = (id) => client.get(`/collections/${id}`).then(r => r.data.data);
export const createCollection = (payload) => client.post('/collections', payload).then(r => r.data.data);
export const fetchPlaylists = (libraryId) => client.get('/playlists', { params: { libraryId } }).then(r => r.data.data);
export const fetchPlaylist = (id) => client.get(`/playlists/${id}`).then(r => r.data.data);
export const createPlaylist = (payload) => client.post('/playlists', payload).then(r => r.data.data);
export const addTrackToPlaylist = (playlistId, trackId) => client.post(`/playlists/${playlistId}/items`, { track_id: trackId }).then(r => r.data.data);
export const addBatchToPlaylist = (playlistId, payload) => client.post(`/playlists/${playlistId}/batch`, payload).then(r => r.data);
export const triggerScan = () => client.post('/scan').then(r => r.data.data);
export const fetchGeneralSettings = () => client.get('/settings/general').then(r => r.data.data);
export const saveGeneralSettings = (payload) => client.post('/settings/general', payload).then(r => r.data);
export const fetchFolderSettings = () => client.get('/settings/folders').then(r => r.data.data);
export const saveFolderSettings = (folders) => client.post('/settings/folders', folders).then(r => r.data);
export const validateFolderPath = (folderPath) => client.post('/settings/validate-path', { folderPath }).then(r => r.data.data);
export const browseFolders = (path) => client.get('/settings/browse', { params: { path } }).then(r => r.data.data);
export const pickSystemFolder = () => client.post('/settings/pick-folder').then(r => r.data.data);
export const fetchVolumeSettings = () => client.get('/settings/volume').then(r => r.data.data);
export const fetchNetworkInfo = () => client.get('/settings/network').then(r => r.data.data);
export const saveVolumeSettings = (payload) => client.post('/settings/volume', payload).then(r => r.data);
export const clearLibraryData = () => client.post('/settings/clear-data').then(r => r.data.data);
export const createLibrary = (payload) => client.post('/libraries', payload).then(r => r.data.data);
export const updateLibrary = (id, payload) => client.put(`/libraries/${id}`, payload).then(r => r.data.data);
export const deleteLibrary = (id) => client.delete(`/libraries/${id}`).then(r => r.data.data);
export const scanSingleLibrary = (id) => client.post(`/libraries/${id}/scan`).then(r => r.data.data);
export const fetchAvailableCovers = (libraryId) => client.get(`/libraries/${libraryId}/available-covers`).then(r => r.data.data);
export const saveLibraryCustomCovers = (libraryId, covers) => client.put(`/libraries/${libraryId}/custom-covers`, { covers }).then(r => r.data.data);
export const uploadLibraryCover = (libraryId, file) => {
  const formData = new FormData();
  formData.append('image', file);
  return client.post(`/libraries/${libraryId}/upload-cover`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data.data);
};

// Dashboard
export const fetchDashboardStats = () => client.get('/dashboard/stats').then(r => r.data.data);
export const killTranscodeTask = (id) => client.post(`/stream/kill/${encodeURIComponent(id)}`).then(r => r.data);

// Music Enhanced
export const fetchFavorites = (params) => client.get('/tracks/favorites', { params }).then(r => r.data.data);
export const toggleFavorite = (id) => client.post(`/tracks/${id}/favorite`).then(r => r.data.data);
export const rateTrack = (id, rating) => client.post(`/tracks/${id}/rate`, { rating }).then(r => r.data.data);
export const fetchLyrics = (id) => client.get(`/tracks/${id}/lyrics`).then(r => r.data.data);
export const saveLyrics = (id, lyrics) => client.put(`/tracks/${id}/lyrics`, { lyrics }).then(r => r.data.data);
export const recordPlay = (id) => client.post(`/tracks/${id}/play`).then(r => r.data.data);
export const fetchRecentlyPlayed = (params) => client.get('/tracks/recently-played', { params }).then(r => r.data.data);
export const fetchMostPlayed = (params) => client.get('/tracks/most-played', { params }).then(r => r.data.data);
export const fetchSmartPlaylists = () => client.get('/tracks/smart-playlists').then(r => r.data.data);
export const fetchTracksByGenre = (genre, params) => client.get(`/tracks/genre/${encodeURIComponent(genre)}`, { params }).then(r => r.data.data);

// Authentication & Users (RBAC)
export const fetchAuthStatus = () => client.get('/auth/status').then(r => r.data.data);
export const loginApi = (credentials) => client.post('/auth/login', credentials).then(r => r.data.data);
export const setupAdminApi = (payload) => client.post('/auth/setup', payload).then(r => r.data.data);
export const fetchCurrentUser = () => client.get('/auth/me').then(r => r.data.data);
export const changePasswordApi = (payload) => client.put('/auth/password', payload).then(r => r.data.data);
export const updateProfileApi = (payload) => client.put('/auth/profile', payload).then(r => r.data.data);
export const uploadAvatarApi = (formData) => client.post('/auth/avatar', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
}).then(r => r.data.data);
export const fetchPublicUsers = () => client.get('/auth/public-users').then(r => r.data.data);
export const fetchUsersList = () => client.get('/auth/users').then(r => r.data.data);
export const createUserApi = (payload) => client.post('/auth/users', payload).then(r => r.data.data);
export const updateUserApi = (id, payload) => client.put(`/auth/users/${id}`, payload).then(r => r.data.data);
export const deleteUserApi = (id) => client.delete(`/auth/users/${id}`).then(r => r.data.data);

// Media Downloads
export function getDownloadUrl(path, params = {}) {
  const token = localStorage.getItem('arn_auth_token');
  const url = new URL(path.startsWith('/') ? path : `/${path}`, window.location.origin);
  if (token) url.searchParams.set('token', token);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  });
  return url.toString();
}

export function triggerDownload(path, params = {}) {
  const fullUrl = getDownloadUrl(path, params);
  const a = document.createElement('a');
  a.href = fullUrl;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
    } catch {}
  }, 400);
}

// Database Management & Control
export const fetchDatabaseStats = () => client.get('/database/stats').then(r => r.data.data);
export const cleanOrphanedData = () => client.post('/database/clean-orphans').then(r => r.data);
export const cleanMissingFiles = (dryRun = false) => client.post('/database/clean-missing', { dryRun }).then(r => r.data);
export const fetchDuplicates = () => client.get('/database/duplicates').then(r => r.data.data);
export const cleanDuplicates = () => client.post('/database/clean-duplicates').then(r => r.data);
export const vacuumDatabase = () => client.post('/database/vacuum').then(r => r.data);
export const backupDatabaseApi = () => client.post('/database/backup').then(r => r.data);
export const fetchDatabaseBackups = () => client.get('/database/backups').then(r => r.data.data);
export const fetchDatabaseRecords = (params) => client.get('/database/records', { params }).then(r => r.data.data);
export const updateDatabaseRecord = (table, id, payload) => client.put(`/database/records/${table}/${id}`, payload).then(r => r.data);
export const deleteDatabaseRecord = (table, id, deletePhysicalFile = false) => client.delete(`/database/records/${table}/${id}`, { params: { deletePhysicalFile } }).then(r => r.data);
export const checkPathExists = (path) => client.post('/database/check-path', { path }).then(r => r.data.data);
export const batchRemapPaths = (payload) => client.post('/database/batch/paths', payload).then(r => r.data);
export const batchUpdateRecordsLibrary = (payload) => client.post('/database/batch/library', payload).then(r => r.data);
export const batchDeleteDatabaseRecords = (payload) => client.post('/database/batch/delete', payload).then(r => r.data);
export const fetchLibraryContents = (libraryId, params) => client.get(`/database/libraries/${libraryId}/contents`, { params }).then(r => r.data.data);
export const clearLibraryContentsApi = (libraryId) => client.post(`/database/libraries/${libraryId}/clear`).then(r => r.data);
export const createDatabaseUserApi = (payload) => client.post('/database/users', payload).then(r => r.data);

