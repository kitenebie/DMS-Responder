package com.irosinmobile.responder.overlay

import android.Manifest
import android.annotation.SuppressLint
import android.app.ActivityManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.LinearLayout
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.irosinmobile.responder.R
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.abs

class LocationOverlayService : Service() {
  private var windowManager: WindowManager? = null
  private var overlayView: View? = null
  private var overlayLayoutParams: WindowManager.LayoutParams? = null
  private var foregroundStarted = false
  private var wakeLock: PowerManager.WakeLock? = null
  private var lastMySqlSendTimeMs: Long = 0L
  private var tickCount = 0L

  // Continuously updated by requestLocationUpdates
  @Volatile private var cachedLat: Double = 0.0
  @Volatile private var cachedLng: Double = 0.0
  @Volatile private var hasGpsFix: Boolean = false

  // HandlerThread: dedicated background thread that survives everything
  private var workerThread: HandlerThread? = null
  private var workerHandler: Handler? = null

  // Network pool: fire-and-forget HTTP writes (never blocks the tick)
  private var networkPool: ExecutorService? = null

  // Main handler for UI
  private val mainHandler = Handler(Looper.getMainLooper())

  companion object {
    const val ACTION_START = "overlay_location_action_start"
    const val ACTION_STOP = "overlay_location_action_stop"
    const val ACTION_SET_VISIBILITY = "overlay_location_action_set_visibility"
    const val EXTRA_BASE_URL = "extra_base_url"
    const val EXTRA_TOKEN = "extra_token"
    const val EXTRA_USER_ID = "extra_user_id"
    const val EXTRA_OVERLAY_VISIBLE = "extra_overlay_visible"
    const val EXTRA_FIREBASE_URL = "extra_firebase_url"

    private const val PREFS_NAME = "overlay_location_preferences"
    private const val PREF_BASE_URL = "base_url"
    private const val PREF_TOKEN = "token"
    private const val PREF_USER_ID = "user_id"
    private const val PREF_OVERLAY_VISIBLE = "overlay_visible"
    private const val PREF_PENDING_SCREEN = "pending_screen"
    private const val PREF_PENDING_REPORT_ID = "pending_report_id"
    private const val PREF_LAST_REPORT_ID = "last_report_id"
    private const val PREF_FIREBASE_URL = "firebase_url"
    private const val CHANNEL_ID = "overlay_location_channel"
    private const val NOTIFICATION_ID = 4051
    private const val MYSQL_THROTTLE_MS = 15_000L
    private const val TICK_INTERVAL_MS = 1_000L
    private const val WAKE_LOCK_TAG = "Responder:OverlayLocationServiceWakeLock"
    private const val HARDCODED_FIREBASE_URL = "https://notification-app-c4e8e-default-rtdb.asia-southeast1.firebasedatabase.app"

    private val running = AtomicBoolean(false)

    data class PendingNavigation(val screen: String, val reportId: Int)

    fun isRunning(): Boolean = running.get()

    fun consumePendingNavigation(context: Context): PendingNavigation? {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val screen = prefs.getString(PREF_PENDING_SCREEN, null)
      val reportId = prefs.getInt(PREF_PENDING_REPORT_ID, 0)
      if (screen.isNullOrBlank() || reportId <= 0) return null
      prefs.edit().remove(PREF_PENDING_SCREEN).remove(PREF_PENDING_REPORT_ID).apply()
      return PendingNavigation(screen, reportId)
    }
  }

  // ==========================================================
  // THE TICK RUNNABLE — posts itself forever via postDelayed
  // Even if it throws, it ALWAYS reschedules itself.
  // ==========================================================

  private val tickRunnable = object : Runnable {
    override fun run() {
      try {
        tickCount++
        doTick()
      } catch (t: Throwable) {
        // Catch EVERYTHING — Throwable, not just Exception
        android.util.Log.e("LocationOverlayService", "[TICK #$tickCount] CRASHED: ${t.message}", t)
      } finally {
        // ALWAYS reschedule — this is the key. No matter what happens above,
        // we ALWAYS post the next tick. The loop can NEVER die.
        workerHandler?.postDelayed(this, TICK_INTERVAL_MS)
      }
    }
  }

  // ==========================================================
  // LIFECYCLE
  // ==========================================================

  override fun onCreate() {
    super.onCreate()
    running.set(true)
    windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    createNotificationChannel()
    acquireWakeLock()

    // Create the worker thread
    workerThread = HandlerThread("LocationOverlayWorker").apply { start() }
    workerHandler = Handler(workerThread!!.looper)

    // Create network pool
    networkPool = Executors.newFixedThreadPool(3)

    android.util.Log.i("LocationOverlayService", "=== SERVICE CREATED === workerThread=${workerThread?.isAlive}")
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    android.util.Log.i("LocationOverlayService", "onStartCommand: action=${intent?.action}, hasIntent=${intent != null}")

    if (intent?.action == ACTION_STOP) {
      stopSelf()
      return START_NOT_STICKY
    }

    // Persist config
    if (intent != null) persistConfig(intent)
    ensureFirebaseUrl()

    // Log config
    val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val userId = prefs.getInt(PREF_USER_ID, 0)
    val fbUrl = prefs.getString(PREF_FIREBASE_URL, "")?.trim().orEmpty()
    android.util.Log.i("LocationOverlayService", "[CONFIG] userId=$userId | firebase=${fbUrl.take(50)} | perm=${hasLocationPermission()}")

    if (userId <= 0 && intent == null) {
      android.util.Log.e("LocationOverlayService", "No userId after resurrection. Stopping.")
      stopSelf()
      return START_NOT_STICKY
    }

    // Foreground
    if (!foregroundStarted) {
      startForeground(NOTIFICATION_ID, createNotification())
      foregroundStarted = true
    }

    acquireWakeLock()

    // Ensure worker thread is alive
    if (workerThread?.isAlive != true) {
      workerThread = HandlerThread("LocationOverlayWorker").apply { start() }
      workerHandler = Handler(workerThread!!.looper)
    }

    // Ensure network pool is alive
    if (networkPool == null || networkPool!!.isShutdown) {
      networkPool = Executors.newFixedThreadPool(3)
    }

    // Start requesting GPS updates so getLastKnownLocation always has fresh data
    startGpsUpdates()

    // START THE TICK LOOP
    // Remove any existing callbacks first (prevent duplicates)
    workerHandler?.removeCallbacks(tickRunnable)
    // Post the first tick immediately
    workerHandler?.post(tickRunnable)
    android.util.Log.i("LocationOverlayService", "[TICK] ✅ Tick loop posted. Will fire every ${TICK_INTERVAL_MS}ms FOREVER.")

    // Overlay
    when (intent?.action) {
      ACTION_SET_VISIBILITY -> {
        val v = intent.getBooleanExtra(EXTRA_OVERLAY_VISIBLE, !isAppInForeground())
        setOverlayVisiblePref(v); mainHandler.post { applyOverlay(v) }
      }
      else -> mainHandler.post { applyOverlay(getOverlayVisiblePref(!isAppInForeground())) }
    }

    return START_STICKY
  }

  override fun onDestroy() {
    android.util.Log.i("LocationOverlayService", "=== SERVICE DESTROYED ===")
    workerHandler?.removeCallbacks(tickRunnable)
    stopGpsUpdates()
    workerThread?.quitSafely()
    workerThread = null; workerHandler = null
    networkPool?.shutdownNow(); networkPool = null
    mainHandler.post { removeOverlayBubble() }
    releaseWakeLock()
    running.set(false)
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onTaskRemoved(rootIntent: Intent?) {
    super.onTaskRemoved(rootIntent)
    android.util.Log.i("LocationOverlayService", "onTaskRemoved — continuing.")
    setOverlayVisiblePref(true); mainHandler.post { applyOverlay(true) }
  }

  // ==========================================================
  // doTick() — the actual work done every 1 second
  // ==========================================================

  private fun doTick() {
    if (!hasGpsFix) {
      // Try to seed from getLastKnownLocation
      val seed = getLatestLocation()
      if (seed != null) {
        cachedLat = seed.latitude
        cachedLng = seed.longitude
        hasGpsFix = true
      }
    }

    if (!hasGpsFix) {
      if (tickCount % 5 == 1L) {
        android.util.Log.w("LocationOverlayService", "[TICK #$tickCount] No location. perm=${hasLocationPermission()}")
      }
      return
    }

    val lat = cachedLat
    val lng = cachedLng

    // Firebase write — fire and forget on network pool (NEVER blocks tick)
    val pool = networkPool
    if (pool != null && !pool.isShutdown) {
      pool.execute {
        try {
          writeToFirebase(lat, lng)
        } catch (t: Throwable) {
          android.util.Log.e("LocationOverlayService", "[Firebase] Network thread error: ${t.message}")
        }
      }
    }

    // Server write — throttled
    val now = System.currentTimeMillis()
    if (now - lastMySqlSendTimeMs >= MYSQL_THROTTLE_MS) {
      lastMySqlSendTimeMs = now
      if (pool != null && !pool.isShutdown) {
        pool.execute {
          try {
            writeToServer(lat, lng)
          } catch (t: Throwable) {
            android.util.Log.e("LocationOverlayService", "[Server] Network thread error: ${t.message}")
          }
        }
      }
    }
  }

  // ==========================================================
  // LOCATION
  // ==========================================================


  // ==========================================================
  // GPS UPDATES — keeps cachedLat/Lng always fresh
  // ==========================================================

  private var gpsListener: android.location.LocationListener? = null

  @SuppressLint("MissingPermission")
  private fun startGpsUpdates() {
    if (!hasLocationPermission()) return
    val lm = getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return
    val handler = workerHandler ?: return

    // Already registered
    if (gpsListener != null) return

    gpsListener = object : android.location.LocationListener {
      override fun onLocationChanged(location: Location) {
        cachedLat = location.latitude
        cachedLng = location.longitude
        hasGpsFix = true
      }
      override fun onProviderEnabled(provider: String) {}
      override fun onProviderDisabled(provider: String) {}
      @Deprecated("") override fun onStatusChanged(provider: String?, status: Int, extras: android.os.Bundle?) {}
    }

    // Register on GPS
    if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
      try {
        lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 0L, 0f, gpsListener!!, handler.looper)
        android.util.Log.i("LocationOverlayService", "[GPS] GPS provider registered")
      } catch (_: Throwable) {}
    }

    // Register on Network too
    if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
      try {
        lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 0L, 0f, gpsListener!!, handler.looper)
        android.util.Log.i("LocationOverlayService", "[GPS] Network provider registered")
      } catch (_: Throwable) {}
    }
  }

  private fun stopGpsUpdates() {
    val listener = gpsListener ?: return
    val lm = getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return
    try { lm.removeUpdates(listener) } catch (_: Throwable) {}
    gpsListener = null
  }

  private fun getLatestLocation(): Location? {
    if (!hasLocationPermission()) return null
    val lm = getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return null
    var best: Location? = null
    val providers = try { lm.getProviders(true) } catch (_: Throwable) { emptyList() }
    for (p in providers) {
      val loc = try { lm.getLastKnownLocation(p) } catch (_: Throwable) { null } ?: continue
      if (best == null || loc.time > best.time) best = loc
    }
    return best
  }

  // ==========================================================
  // FIREBASE WRITE
  // ==========================================================

  private fun writeToFirebase(lat: Double, lng: Double) {
    val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val firebaseUrl = (prefs.getString(PREF_FIREBASE_URL, HARDCODED_FIREBASE_URL) ?: HARDCODED_FIREBASE_URL).trim().trimEnd('/')
    val userId = prefs.getInt(PREF_USER_ID, 0)
    if (userId <= 0) { android.util.Log.w("LocationOverlayService", "[Firebase] skip: userId=0"); return }

    val endpoint = "$firebaseUrl/responders/$userId.json"
    val ts = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
      .apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }.format(java.util.Date())
    val payload = """{"location":{"latitude":$lat,"longitude":$lng,"updatedAt":"$ts"},"updatedAt":"$ts"}"""

    var conn: HttpURLConnection? = null
    try {
      conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
        requestMethod = "PUT"; connectTimeout = 30_000; readTimeout = 30_000
        doOutput = true; setRequestProperty("Content-Type", "application/json")
      }
      conn.outputStream.use { it.write(payload.toByteArray()) }
      val code = conn.responseCode
      android.util.Log.i("LocationOverlayService", "[Firebase] ✅ $code | tick#$tickCount | id=$userId | $lat,$lng | $ts")
    } catch (e: Throwable) {
      android.util.Log.e("LocationOverlayService", "[Firebase] ❌ tick#$tickCount | ${e.javaClass.simpleName}: ${e.message}")
    } finally {
      try { conn?.disconnect() } catch (_: Throwable) {}
    }
  }

  // ==========================================================
  // SERVER WRITE
  // ==========================================================

  private fun writeToServer(lat: Double, lng: Double) {
    val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val baseUrl = (prefs.getString(PREF_BASE_URL, "") ?: "").trim().trimEnd('/')
    val token = (prefs.getString(PREF_TOKEN, "") ?: "").trim()
    if (baseUrl.isBlank()) return

    val endpoint = "$baseUrl/responder/location"
    val payload = """{"lat":$lat,"lng":$lng}"""
    var conn: HttpURLConnection? = null
    try {
      conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"; connectTimeout = 30_000; readTimeout = 30_000
        doOutput = true; setRequestProperty("Content-Type", "application/json"); setRequestProperty("Accept", "application/json")
        if (token.isNotBlank()) setRequestProperty("Authorization", if (token.startsWith("Bearer ")) token else "Bearer $token")
      }
      conn.outputStream.use { it.write(payload.toByteArray()) }
      android.util.Log.d("LocationOverlayService", "[Server] ${conn.responseCode} | $lat,$lng")
    } catch (e: Throwable) {
      android.util.Log.e("LocationOverlayService", "[Server] ❌ ${e.message}")
    } finally {
      try { conn?.disconnect() } catch (_: Throwable) {}
    }
  }

  // ==========================================================
  // CONFIG
  // ==========================================================

  private fun persistConfig(intent: Intent?) {
    if (intent == null) return
    val ed = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
    if (intent.hasExtra(EXTRA_BASE_URL)) ed.putString(PREF_BASE_URL, intent.getStringExtra(EXTRA_BASE_URL)?.trim()?.trimEnd('/') ?: "")
    if (intent.hasExtra(EXTRA_TOKEN)) ed.putString(PREF_TOKEN, intent.getStringExtra(EXTRA_TOKEN)?.trim() ?: "")
    if (intent.hasExtra(EXTRA_USER_ID)) { val v = intent.getIntExtra(EXTRA_USER_ID, 0); if (v > 0) ed.putInt(PREF_USER_ID, v) else ed.remove(PREF_USER_ID) }
    if (intent.hasExtra(EXTRA_FIREBASE_URL)) { val v = intent.getStringExtra(EXTRA_FIREBASE_URL)?.trim() ?: ""; ed.putString(PREF_FIREBASE_URL, v.ifBlank { HARDCODED_FIREBASE_URL }) }
    ed.apply()
  }

  private fun ensureFirebaseUrl() {
    val p = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    if ((p.getString(PREF_FIREBASE_URL, "") ?: "").isBlank()) p.edit().putString(PREF_FIREBASE_URL, HARDCODED_FIREBASE_URL).apply()
  }

  // ==========================================================
  // OVERLAY
  // ==========================================================

  private fun showOverlayBubble() {
    if (overlayView != null) return
    val wm = windowManager ?: return
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      else @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
    val params = WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
      type, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN, PixelFormat.TRANSLUCENT
    ).apply { gravity = Gravity.TOP or Gravity.START; x = dp(16); y = dp(220) }

    val container = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER }
    val icon = ImageView(this).apply {
      setImageResource(R.drawable.overlay_location_icon); scaleType = ImageView.ScaleType.FIT_CENTER
      setPadding(dp(1), dp(1), dp(1), dp(1))
      background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(Color.TRANSPARENT) }
      layoutParams = LinearLayout.LayoutParams(dp(70), dp(70)); elevation = dp(6).toFloat(); isClickable = true; isFocusable = true
    }
    container.addView(icon); overlayView = container; overlayLayoutParams = params
    try { wm.addView(container, params) } catch (_: Throwable) { overlayView = null; overlayLayoutParams = null; return }
    icon.setOnClickListener {
      getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().remove(PREF_PENDING_SCREEN).remove(PREF_PENDING_REPORT_ID).apply()
      packageManager.getLaunchIntentForPackage(packageName)?.let { l -> l.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP); startActivity(l) }
    }
    setupDrag(icon, container)
  }

  private fun setupDrag(h: View, r: View) {
    val p = overlayLayoutParams ?: return; val wm = windowManager ?: return
    var sx = 0; var sy = 0; var tx = 0f; var ty = 0f; var m = false
    h.setOnTouchListener { v, e -> when (e.actionMasked) {
      MotionEvent.ACTION_DOWN -> { sx=p.x; sy=p.y; tx=e.rawX; ty=e.rawY; m=false; true }
      MotionEvent.ACTION_MOVE -> { val dx=(e.rawX-tx).toInt(); val dy=(e.rawY-ty).toInt(); if(abs(dx)>dp(4)||abs(dy)>dp(4)) m=true; p.x=sx+dx; p.y=sy+dy; try{wm.updateViewLayout(r,p)}catch(_:Throwable){}; true }
      MotionEvent.ACTION_UP -> { if(!m) v.performClick(); true }
      else -> false
    }}
  }

  private fun removeOverlayBubble() {
    val wm = windowManager ?: return; val v = overlayView ?: return
    try { wm.removeView(v) } catch (_: Throwable) {}; overlayView = null; overlayLayoutParams = null
  }

  private fun applyOverlay(visible: Boolean) { if (visible && canDrawOverlays()) showOverlayBubble() else removeOverlayBubble() }

  // ==========================================================
  // HELPERS
  // ==========================================================

  private fun isAppInForeground(): Boolean = try {
    val pi = ActivityManager.RunningAppProcessInfo(); ActivityManager.getMyMemoryState(pi)
    pi.importance <= ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE
  } catch (_: Throwable) { false }

  private fun getOverlayVisiblePref(d: Boolean): Boolean { val p=getSharedPreferences(PREFS_NAME,Context.MODE_PRIVATE); return if(p.contains(PREF_OVERLAY_VISIBLE)) p.getBoolean(PREF_OVERLAY_VISIBLE,d) else d }
  private fun setOverlayVisiblePref(v: Boolean) { getSharedPreferences(PREFS_NAME,Context.MODE_PRIVATE).edit().putBoolean(PREF_OVERLAY_VISIBLE,v).apply() }
  private fun canDrawOverlays() = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) Settings.canDrawOverlays(this) else true
  private fun hasLocationPermission() = ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED || ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    (getSystemService(NotificationManager::class.java))?.createNotificationChannel(NotificationChannel(CHANNEL_ID,"Location",NotificationManager.IMPORTANCE_LOW).apply{setShowBadge(false)})
  }

  private fun createNotification() = NotificationCompat.Builder(this, CHANNEL_ID)
    .setSmallIcon(R.mipmap.ic_launcher).setContentTitle("Responder active").setContentText("Location → Firebase every 1s")
    .setPriority(NotificationCompat.PRIORITY_LOW).setOngoing(true).setOnlyAlertOnce(true)
    .setContentIntent(packageManager.getLaunchIntentForPackage(packageName)?.let { PendingIntent.getActivity(this,9001,it,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE) })
    .addAction(R.mipmap.ic_launcher,"Stop",PendingIntent.getService(this,9002,Intent(this,LocationOverlayService::class.java).apply{action=ACTION_STOP},PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
    .build()

  private fun acquireWakeLock() { if(wakeLock?.isHeld==true)return; val pm=getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return; wakeLock=pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,WAKE_LOCK_TAG).apply{setReferenceCounted(false);acquire()} }
  private fun releaseWakeLock() { try{if(wakeLock?.isHeld==true)wakeLock?.release()}catch(_:Throwable){}; wakeLock=null }
  private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
}
