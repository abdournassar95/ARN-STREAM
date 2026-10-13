import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

import LoadingSpinner from './components/shared/LoadingSpinner.jsx';
import ProtectedRoute from './components/shared/ProtectedRoute.jsx';
import { useSettingsStore } from './store/useSettingsStore';
import { useAuthStore } from './store/useAuthStore';
import { usePlayerStore } from './store/usePlayerStore';
import ErrorBoundary from './components/shared/ErrorBoundary.jsx';
import DeviceHandoffListener from './components/shared/DeviceHandoffListener.jsx';
import DeviceHandoffModal from './components/shared/DeviceHandoffModal.jsx';
import RemoteControlBanner from './components/shared/RemoteControlBanner.jsx';
import FullRemoteControlModal from './components/shared/FullRemoteControlModal.jsx';
import MiniPlayer from './components/music/MiniPlayer.jsx';
import SplashScreen from './components/shared/SplashScreen.jsx';
import { syncAuthCookie } from './api/client.js';

syncAuthCookie();

// Safely import lazy components with automatic page reload if chunk hash changed after an update
const lazyRetry = (componentImport) =>
  lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      const isChunkError =
        error?.message?.includes('dynamically imported module') ||
        error?.message?.includes('Loading chunk') ||
        error?.message?.includes('Failed to fetch');

      if (isChunkError && typeof window !== 'undefined') {
        const hasReloaded = sessionStorage.getItem('arn_chunk_reloaded');
        if (!hasReloaded) {
          sessionStorage.setItem('arn_chunk_reloaded', 'true');
          window.location.reload();
          return new Promise(() => {}); // hold suspense while reloading
        }
      }
      throw error;
    }
  });

const Landing = lazyRetry(() => import('./pages/Landing.jsx'));
const Login = lazyRetry(() => import('./pages/Login.jsx'));
const MoviesHome = lazyRetry(() => import('./pages/movies/Home.jsx'));
const Library = lazyRetry(() => import('./pages/Library.jsx'));
const MovieDetails = lazyRetry(() => import('./pages/movies/MovieDetails.jsx'));
const Series = lazyRetry(() => import('./pages/movies/Series.jsx'));
const SeriesDetails = lazyRetry(() => import('./pages/movies/SeriesDetails.jsx'));
const VideoPlayer = lazyRetry(() => import('./pages/movies/Player.jsx'));
const MusicHome = lazyRetry(() => import('./pages/music/Home.jsx'));
const Artists = lazyRetry(() => import('./pages/music/Artists.jsx'));
const Albums = lazyRetry(() => import('./pages/music/Albums.jsx'));
const Artist = lazyRetry(() => import('./pages/music/Artist.jsx'));
const Album = lazyRetry(() => import('./pages/music/Album.jsx'));
const SearchPage = lazyRetry(() => import('./pages/Search.jsx'));
const Collections = lazyRetry(() => import('./pages/Collections.jsx'));
const PlaylistDetail = lazyRetry(() => import('./pages/PlaylistDetail.jsx'));
const Dashboard = lazyRetry(() => import('./pages/Dashboard.jsx'));
const Favorites = lazyRetry(() => import('./pages/music/Favorites.jsx'));
const RecentlyPlayed = lazyRetry(() => import('./pages/music/RecentlyPlayed.jsx'));
const MostPlayed = lazyRetry(() => import('./pages/music/MostPlayed.jsx'));
const SmartPlaylists = lazyRetry(() => import('./pages/music/SmartPlaylists.jsx'));
const LiveTv = lazyRetry(() => import('./pages/LiveTv.jsx'));

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,   // 5 min — landing/movies/music home data rarely changes
      gcTime: 30 * 60 * 1000,     // 30 min — keep cached data in memory longer
      refetchOnWindowFocus: false, // don't refetch when tab regains focus
      refetchOnReconnect: true    // do refetch when network reconnects
    }
  }
});

function PageTitleUpdater() {
  const location = useLocation();
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  useEffect(() => {
    const path = location.pathname;
    let title = 'ARN Stream';
    if (path === '/') title = isAr ? 'الرئيسية | ARN Stream' : 'Home | ARN Stream';
    else if (path.startsWith('/movies')) title = isAr ? 'الأفلام | ARN Stream' : 'Movies | ARN Stream';
    else if (path.startsWith('/series')) title = isAr ? 'المسلسلات | ARN Stream' : 'Series | ARN Stream';
    else if (path.startsWith('/music')) title = isAr ? 'الموسيقى والصوتيات | ARN Stream' : 'Music | ARN Stream';
    else if (path.startsWith('/watch')) title = isAr ? 'مشاهدة | ARN Stream' : 'Watching | ARN Stream';
    else if (path.startsWith('/library')) title = isAr ? 'المكتبة | ARN Stream' : 'Library | ARN Stream';
    else if (path.startsWith('/search')) title = isAr ? 'البحث | ARN Stream' : 'Search | ARN Stream';
    else if (path.startsWith('/dashboard')) title = isAr ? 'لوحة التحكم | ARN Stream' : 'Dashboard | ARN Stream';
    else if (path.startsWith('/collections')) title = isAr ? 'المجموعات | ARN Stream' : 'Collections | ARN Stream';
    else if (path.startsWith('/live')) title = isAr ? 'البث المباشر | ARN Stream' : 'Live TV | ARN Stream';
    else if (path.startsWith('/login')) title = isAr ? 'تسجيل الدخول | ARN Stream' : 'Login | ARN Stream';

    document.title = title;
  }, [location.pathname, isAr]);

  return null;
}

function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    // Reset scroll positions immediately across window and all document containers
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
      document.documentElement.scrollLeft = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
      document.body.scrollLeft = 0;
    }
    const mainEl = document.querySelector('main');
    if (mainEl) mainEl.scrollTop = 0;
  }, [pathname, search]);

  return null;
}

function SearchWrapper() {
  return <SearchPage />;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-transition min-h-screen">
      <Routes location={location}>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={<ProtectedRoute><Landing /></ProtectedRoute>} />
        <Route path="/library/:id" element={<ProtectedRoute><Library /></ProtectedRoute>} />
        <Route path="/movies" element={<ProtectedRoute><MoviesHome /></ProtectedRoute>} />
        <Route path="/movies/:id" element={<ProtectedRoute><MovieDetails /></ProtectedRoute>} />
        <Route path="/series" element={<ProtectedRoute><Series /></ProtectedRoute>} />
        <Route path="/series/:id" element={<ProtectedRoute><SeriesDetails /></ProtectedRoute>} />
        <Route path="/watch/:type/:id" element={<ProtectedRoute><VideoPlayer /></ProtectedRoute>} />
        <Route path="/music" element={<ProtectedRoute><MusicHome /></ProtectedRoute>} />
        <Route path="/music/artists" element={<ProtectedRoute><Artists /></ProtectedRoute>} />
        <Route path="/music/albums" element={<ProtectedRoute><Albums /></ProtectedRoute>} />
        <Route path="/music/artist/:id" element={<ProtectedRoute><Artist /></ProtectedRoute>} />
        <Route path="/music/album/:id" element={<ProtectedRoute><Album /></ProtectedRoute>} />
        <Route path="/music/playlist/:id" element={<ProtectedRoute><PlaylistDetail /></ProtectedRoute>} />
        <Route path="/music/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
        <Route path="/music/recently-played" element={<ProtectedRoute><RecentlyPlayed /></ProtectedRoute>} />
        <Route path="/music/most-played" element={<ProtectedRoute><MostPlayed /></ProtectedRoute>} />
        <Route path="/music/smart-playlists" element={<ProtectedRoute><SmartPlaylists /></ProtectedRoute>} />
        <Route path="/collections" element={<ProtectedRoute><Collections /></ProtectedRoute>} />
        <Route path="/collections/:id" element={<ProtectedRoute><Collections /></ProtectedRoute>} />
        <Route path="/live" element={<ProtectedRoute><LiveTv /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><SearchWrapper /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute requireAdmin={true}><Dashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}

export default function App() {
  const { i18n } = useTranslation();
  const { theme } = useSettingsStore();
  const { checkAuth } = useAuthStore();
  const currentTrack = usePlayerStore(s => s.currentTrack);
  
  useEffect(() => {
    checkAuth();
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('arn_chunk_reloaded');
    }
  }, []);

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  }, [i18n.language]);

  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (!isDark) {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
  }, [theme]);

  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <ScrollToTop />
        <PageTitleUpdater />
        <ErrorBoundary>
          <div className={currentTrack ? "pb-[80px] sm:pb-[96px]" : ""}>
            <Suspense fallback={<LoadingSpinner />}>
              <AnimatedRoutes />
            </Suspense>
          </div>
          <MiniPlayer />
          <DeviceHandoffListener />
          <DeviceHandoffModal />
          <RemoteControlBanner />
          <FullRemoteControlModal />
          <SplashScreen />
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

