# Graph Report - responder  (2026-10-16)

## Corpus Check
- 67 files · ~319,645 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 26 file(s) not represented in the graph (top: .xml 12, .log 3, (none) 2)

## Summary
- 718 nodes · 1428 edges · 47 communities (28 shown, 19 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1c677e70`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- getTheme
- MainApplication.kt
- Icon
- expo
- dependencies
- package.json
- locationService
- OverlayLocationModule.kt
- mapService
- MapScreen.tsx
- LocationOverlayService
- AppContent
- Map.tsx
- locationService
- OverlayLocationService.ts
- GoogleMapScreen.tsx
- routeStore.ts
- FirebaseNotificationService
- App.tsx
- mockData.ts
- auth.ts
- locationService.ts
- ScreenContent.tsx
- axios.tsx
- devDependencies
- axios.js
- assetService
- mapService.ts
- LocationListener
- @react-native-async-storage/async-storage
- scripts
- compilerOptions
- metro.config.js
- Ponytail, lazy senior dev mode
- eslint.config.js
- Ponytail

## God Nodes (most connected - your core abstractions)
1. `Icon()` - 72 edges
2. `LocationOverlayService` - 37 edges
3. `AppContent()` - 36 edges
4. `getTheme()` - 31 edges
5. `locationService` - 30 edges
6. `react-native` - 26 edges
7. `react` - 25 edges
8. `mapService` - 24 edges
9. `locationService` - 17 edges
10. `expo` - 16 edges

## Surprising Connections (you probably didn't know these)
- `AppContent()` --calls--> `ActionBar()`  [EXTRACTED]
  App.tsx → components/ActionBar.tsx
- `AppContent()` --calls--> `ChatScreen()`  [EXTRACTED]
  App.tsx → components/ChatScreen.tsx
- `AppContent()` --calls--> `FullscreenMapScreen()`  [EXTRACTED]
  App.tsx → components/FullscreenMapScreen.tsx
- `AppContent()` --calls--> `HistoryScreen()`  [EXTRACTED]
  App.tsx → components/HistoryScreen.tsx
- `AppContent()` --calls--> `Icon()`  [EXTRACTED]
  App.tsx → components/Icon.tsx

## Import Cycles
- None detected.

## Communities (47 total, 19 thin omitted)

### Community 0 - "getTheme"
Cohesion: 0.05
Nodes (63): CameraCaptureModal(), CameraCaptureModalProps, styles, ChatModal(), ChatModalProps, styles, ChatScreen(), ChatScreenProps (+55 more)

### Community 1 - "MainApplication.kt"
Cohesion: 0.07
Nodes (4): MainActivity, DefaultReactActivityDelegate, MainApplication, OverlayLocationPackage

### Community 2 - "Icon"
Cohesion: 0.09
Nodes (40): ActionBar(), ActionBarProps, styles, AlertIcon(), BikeIcon(), BoltIcon(), CameraIcon(), CarIcon() (+32 more)

### Community 3 - "expo"
Cohesion: 0.05
Nodes (37): backgroundColor, foregroundImage, adaptiveIcon, googleServicesFile, package, permissions, projectId, tsconfigPaths (+29 more)

### Community 4 - "dependencies"
Cohesion: 0.05
Nodes (37): dependencies, axios, babel-preset-expo, expo, expo-audio, expo-background-task, expo-camera, expo-constants (+29 more)

### Community 5 - "package.json"
Cohesion: 0.07
Nodes (27): main, name, private, version, @babel/core, babel-preset-expo, eslint-config-prettier, expo-camera (+19 more)

### Community 9 - "MapScreen.tsx"
Cohesion: 0.17
Nodes (21): distanceMeters(), distanceToPolyline(), headingDelta(), isValidLatLng(), MapScreen, normalizeIncidentCoords(), RouteGeometry, styles (+13 more)

### Community 12 - "AppContent"
Cohesion: 0.19
Nodes (16): App(), AppContent(), QuickAccess(), QuickAccessProps, formatTime(), getTimestamp(), statusIconNames, StatusTracker() (+8 more)

### Community 13 - "Map.tsx"
Cohesion: 0.18
Nodes (15): FullscreenMapScreen(), FullscreenMapScreenProps, styles, GoogleMapScreenProps, IncidentDetailsProps, IncomingModalProps, hasViewManager(), isGoogleMapsAvailable() (+7 more)

### Community 15 - "OverlayLocationService.ts"
Cohesion: 0.21
Nodes (14): ip, consumePendingOverlayNavigation(), isOverlayLocationServiceRunning(), isOverlayLocationSupported(), isOverlayPermissionGranted(), openOverlayPermissionSettings(), overlayModule, OverlayNativeModule (+6 more)

### Community 16 - "GoogleMapScreen.tsx"
Cohesion: 0.17
Nodes (13): createGoogleMapHtml(), DEFAULT_LOCATION, GOOGLE_DARK_MAP_STYLES, GoogleMapScreen, MapMessage, normalizeCoordinates(), styles, expo-constants (+5 more)

### Community 17 - "routeStore.ts"
Cohesion: 0.19
Nodes (14): CachedRoute, decodePolyline(), inFlightRoutes, isQuotaResponse(), requestOpenRouteService(), requestOsrmRoute(), routeCache, RouteGeometry (+6 more)

### Community 19 - "App.tsx"
Cohesion: 0.23
Nodes (10): EMPTY_CHAT_PEER_TYPING, ResponderChatParticipant, ResponderChatTypingSession, Stack, styles, goBack(), navigate(), navigationRef (+2 more)

### Community 20 - "mockData.ts"
Cohesion: 0.22
Nodes (11): DestinationState, useDestinationStore, zustand, fetchChatMessages(), fetchIncomingIncident(), getResponderChatPeerTyping(), parseBooleanFlag(), parseOptionalId() (+3 more)

### Community 21 - "auth.ts"
Cohesion: 0.24
Nodes (11): getCredentials(), getDeviceId(), getStoredUser(), isLoggedIn(), login(), logout(), refreshLogin(), LoginForm() (+3 more)

### Community 22 - "locationService.ts"
Cohesion: 0.15
Nodes (10): AssetCacheEntry, DEFAULT_LOCATION, LocationCoords, LocationState, DEFAULT_LOCATION, LocationCoords, LocationState, axios (+2 more)

### Community 23 - "ScreenContent.tsx"
Cohesion: 0.20
Nodes (11): defaultConfig, formatDate(), formatTime(), MOCK_CHAT_MESSAGES, MOCK_HISTORICAL_INCIDENTS, MOCK_INCOMING_INCIDENT, ScreenContent(), ScreenContentProps (+3 more)

### Community 24 - "axios.tsx"
Cohesion: 0.22
Nodes (8): api, LocationPayload, sendLocation(), sendLocationOnce(), stopLocationUpdates(), expo-notifications, @react-native-firebase/messaging, NotificationCallbacks

### Community 25 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, @babel/core, eslint, eslint-config-expo, eslint-config-prettier, prettier, prettier-plugin-tailwindcss, tailwindcss (+3 more)

### Community 26 - "axios.js"
Cohesion: 0.24
Nodes (5): Background(), api, ip, expo-background-task, expo-task-manager

### Community 29 - "mapService.ts"
Cohesion: 0.22
Nodes (8): CacheEntry, GeofenceData, ReportData, ReportDetail, ReportMapMarker, RetryConfig, RouteResponse, react-native-leaflet-view

### Community 31 - "@react-native-async-storage/async-storage"
Cohesion: 0.25
Nodes (6): Theme, ThemeContext, ThemeContextType, ThemeProvider(), ThemeProviderProps, @react-native-async-storage/async-storage

### Community 32 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, android, format, ios, lint, prebuild, start, web

### Community 33 - "compilerOptions"
Cohesion: 0.29
Nodes (6): expo/tsconfig.base, compilerOptions, baseUrl, paths, strict, extends

### Community 36 - "metro.config.js"
Cohesion: 0.33
Nodes (5): config, { getDefaultConfig }, { withNativeWind }, expo, nativewind

### Community 37 - "Ponytail, lazy senior dev mode"
Cohesion: 0.40
Nodes (4): Before you write, Lean agent workflow, Ponytail, lazy senior dev mode, The smallest complete change

### Community 38 - "eslint.config.js"
Cohesion: 0.40
Nodes (4): { defineConfig }, expoConfig, eslint, eslint-config-expo

### Community 39 - "Ponytail"
Cohesion: 0.40
Nodes (4): Before you write, Levels, Ponytail, The smallest complete change

## Knowledge Gaps
- **20 isolated node(s):** `@react-native-firebase/app`, `@react-native-firebase/database`, `babel-preset-expo`, `expo-dev-client`, `expo-device` (+15 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 279 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **What connects `@react-native-firebase/app`, `@react-native-firebase/database`, `babel-preset-expo` to the rest of the system?**
  _20 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `getTheme` be split into smaller, more focused modules?**
  _Cohesion score 0.05450165612767239 - nodes in this community are weakly interconnected._
- **Why does `expo-location` connect `locationService.ts` to `GoogleMapScreen.tsx`, `MapScreen.tsx`, `App.tsx`, `package.json`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Should `MainApplication.kt` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Why does `react-native` connect `getTheme` to `Icon`, `package.json`, `MapScreen.tsx`, `AppContent`, `Map.tsx`, `OverlayLocationService.ts`, `GoogleMapScreen.tsx`, `App.tsx`, `auth.ts`, `locationService.ts`, `ScreenContent.tsx`, `axios.tsx`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Should `Icon` be split into smaller, more focused modules?**
  _Cohesion score 0.09059233449477352 - nodes in this community are weakly interconnected._