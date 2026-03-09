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
import android.os.CancellationSignal
import android.os.Handler
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
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
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
  private var locationCancellationSignal: CancellationSignal? = null
  private var foregroundStarted = false
  private val networkExecutor: ExecutorService = Executors.newSingleThreadExecutor()
  private val locationHandler = Handler(Looper.getMainLooper())
  private var periodicLocationRunnable: Runnable? = null
  private var wakeLock: PowerManager.WakeLock? = null

  companion object {
    const val ACTION_START = "overlay_location_action_start"
    const val ACTION_STOP = "overlay_location_action_stop"
    const val ACTION_SET_VISIBILITY = "overlay_location_action_set_visibility"
    const val EXTRA_BASE_URL = "extra_base_url"
    const val EXTRA_TOKEN = "extra_token"
    const val EXTRA_USER_ID = "extra_user_id"
    const val EXTRA_OVERLAY_VISIBLE = "extra_overlay_visible"

    private const val PREFS_NAME = "overlay_location_preferences"
    private const val PREF_BASE_URL = "base_url"
    private const val PREF_TOKEN = "token"
    private const val PREF_USER_ID = "user_id"
    private const val PREF_OVERLAY_VISIBLE = "overlay_visible"
    private const val PREF_PENDING_SCREEN = "pending_screen"
    private const val PREF_PENDING_REPORT_ID = "pending_report_id"
    private const val PREF_LAST_REPORT_ID = "last_report_id"
    private const val CHANNEL_ID = "overlay_location_channel"
    private const val NOTIFICATION_ID = 4051
    private const val LOCATION_UPDATE_INTERVAL_MS = 15_000L
    private const val SCREEN_REPORT_CHATS = "ReportChats"
    private const val WAKE_LOCK_TAG = "Responder:OverlayLocationServiceWakeLock"
    private val running = AtomicBoolean(false)

    data class PendingNavigation(
      val screen: String,
      val reportId: Int,
    )

    fun isRunning(): Boolean = running.get()

    fun consumePendingNavigation(context: Context): PendingNavigation? {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val screen = prefs.getString(PREF_PENDING_SCREEN, null)
      val reportId = prefs.getInt(PREF_PENDING_REPORT_ID, 0)
      if (screen.isNullOrBlank() || reportId <= 0) {
        return null
      }

      prefs.edit()
        .remove(PREF_PENDING_SCREEN)
        .remove(PREF_PENDING_REPORT_ID)
        .apply()

      return PendingNavigation(screen, reportId)
    }
  }

  override fun onCreate() {
    super.onCreate()
    running.set(true)
    windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    createNotificationChannel()
    acquirePartialWakeLock()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        stopSelf()
        return START_NOT_STICKY
      }
    }

    persistConfig(intent)

    if (!foregroundStarted) {
      startForeground(NOTIFICATION_ID, createNotification())
      foregroundStarted = true
    }

    if (!canDrawOverlays()) {
      showToast("Enable display over other apps for the floating bubble.")
      stopSelf()
      return START_NOT_STICKY
    }

    startPeriodicLocationUpdates()

    when (intent?.action) {
      ACTION_SET_VISIBILITY -> {
        val requestedVisible = intent.getBooleanExtra(EXTRA_OVERLAY_VISIBLE, !isAppInForeground())
        setOverlayVisiblePreference(requestedVisible)
        applyOverlayVisibility(requestedVisible)
      }
      else -> {
        val shouldShowOverlay = getOverlayVisiblePreference(defaultValue = !isAppInForeground())
        applyOverlayVisibility(shouldShowOverlay)
      }
    }

    return START_STICKY
  }

  override fun onDestroy() {
    stopPeriodicLocationUpdates()
    locationCancellationSignal?.cancel()
    locationCancellationSignal = null
    removeOverlayBubble()
    releasePartialWakeLock()
    networkExecutor.shutdownNow()
    running.set(false)
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun startPeriodicLocationUpdates() {
    if (periodicLocationRunnable != null) {
      return
    }

    periodicLocationRunnable = object : Runnable {
      override fun run() {
        if (!isAppInForeground()) {
          requestAndSendLocation(notifyUser = false)
        }
        locationHandler.postDelayed(this, LOCATION_UPDATE_INTERVAL_MS)
      }
    }

    locationHandler.post(periodicLocationRunnable!!)
  }

  private fun stopPeriodicLocationUpdates() {
    periodicLocationRunnable?.let { locationHandler.removeCallbacks(it) }
    periodicLocationRunnable = null
  }

  private fun isAppInForeground(): Boolean {
    val processInfo = ActivityManager.RunningAppProcessInfo()
    ActivityManager.getMyMemoryState(processInfo)
    return processInfo.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND ||
      processInfo.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE
  }

  private fun getOverlayVisiblePreference(defaultValue: Boolean): Boolean {
    val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return if (prefs.contains(PREF_OVERLAY_VISIBLE)) {
      prefs.getBoolean(PREF_OVERLAY_VISIBLE, defaultValue)
    } else {
      defaultValue
    }
  }

  private fun setOverlayVisiblePreference(visible: Boolean) {
    val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit().putBoolean(PREF_OVERLAY_VISIBLE, visible).apply()
  }

  private fun applyOverlayVisibility(visible: Boolean) {
    if (visible) {
      if (overlayView == null) {
        showOverlayBubble()
      }
      return
    }
    removeOverlayBubble()
  }

  private fun persistConfig(intent: Intent?) {
    val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val editor = sharedPreferences.edit()

    if (intent?.hasExtra(EXTRA_BASE_URL) == true) {
      val value = intent.getStringExtra(EXTRA_BASE_URL)?.trim()?.removeSuffix("/") ?: ""
      editor.putString(PREF_BASE_URL, value)
    }

    if (intent?.hasExtra(EXTRA_TOKEN) == true) {
      val value = intent.getStringExtra(EXTRA_TOKEN)?.trim() ?: ""
      editor.putString(PREF_TOKEN, value)
    }

    if (intent?.hasExtra(EXTRA_USER_ID) == true) {
      val value = intent.getIntExtra(EXTRA_USER_ID, 0)
      if (value > 0) {
        editor.putInt(PREF_USER_ID, value)
      } else {
        editor.remove(PREF_USER_ID)
      }
    }

    editor.apply()
  }

  private fun showOverlayBubble() {
    val wm = windowManager ?: return

    val type =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      } else {
        WindowManager.LayoutParams.TYPE_PHONE
      }

    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      type,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = dp(16)
      y = dp(220)
    }

    val container = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
    }

    val bubbleSize = dp(70)
    val iconPadding = dp(1)

    val overlayIcon = ImageView(this).apply {
      setImageResource(R.drawable.overlay_location_icon)
      scaleType = ImageView.ScaleType.FIT_CENTER
      setPadding(iconPadding, iconPadding, iconPadding, iconPadding)
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(Color.TRANSPARENT)
      }
      layoutParams = LinearLayout.LayoutParams(bubbleSize, bubbleSize)
      elevation = dp(6).toFloat()
      contentDescription = "Open responder app"
      isClickable = true
      isFocusable = true
    }

    container.addView(overlayIcon)

    overlayView = container
    overlayLayoutParams = params
    wm.addView(container, params)

    overlayIcon.setOnClickListener { openResponderApp() }

    setupDragBehavior(overlayIcon, container)
  }

  private fun openResponderApp() {
    clearPendingNavigation()
    launchMainApp()
  }

  private fun launchMainApp() {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName) ?: return
    launchIntent.addFlags(
      Intent.FLAG_ACTIVITY_NEW_TASK or
        Intent.FLAG_ACTIVITY_SINGLE_TOP or
        Intent.FLAG_ACTIVITY_CLEAR_TOP
    )
    startActivity(launchIntent)
  }

  private fun clearPendingNavigation() {
    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .remove(PREF_PENDING_SCREEN)
      .remove(PREF_PENDING_REPORT_ID)
      .apply()
  }

  private fun setupDragBehavior(handleView: View, rootView: View) {
    val params = overlayLayoutParams ?: return
    val wm = windowManager ?: return

    var startX = 0
    var startY = 0
    var touchStartX = 0f
    var touchStartY = 0f
    var moved = false

    handleView.setOnTouchListener { view, event ->
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          startX = params.x
          startY = params.y
          touchStartX = event.rawX
          touchStartY = event.rawY
          moved = false
          true
        }

        MotionEvent.ACTION_MOVE -> {
          val deltaX = (event.rawX - touchStartX).toInt()
          val deltaY = (event.rawY - touchStartY).toInt()
          if (abs(deltaX) > dp(4) || abs(deltaY) > dp(4)) {
            moved = true
          }
          params.x = startX + deltaX
          params.y = startY + deltaY
          wm.updateViewLayout(rootView, params)
          true
        }

        MotionEvent.ACTION_UP -> {
          if (!moved) {
            view.performClick()
          }
          true
        }

        else -> false
      }
    }
  }

  private fun removeOverlayBubble() {
    val wm = windowManager ?: return
    val view = overlayView ?: return

    try {
      wm.removeView(view)
    } catch (_: Exception) {
      // no-op: view is already detached
    } finally {
      overlayView = null
      overlayLayoutParams = null
    }
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val manager = getSystemService(NotificationManager::class.java) ?: return
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Location Overlay",
      NotificationManager.IMPORTANCE_LOW
    ).apply {
      description = "Keeps the floating location bubble active."
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }

  private fun createNotification() = NotificationCompat.Builder(this, CHANNEL_ID)
    .setSmallIcon(R.mipmap.ic_launcher)
    .setContentTitle("Responder overlay running")
    .setContentText("Background location updates stay active while the bubble is shown or hidden.")
    .setPriority(NotificationCompat.PRIORITY_LOW)
    .setOngoing(true)
    .setOnlyAlertOnce(true)
    .setContentIntent(createOpenAppPendingIntent())
    .addAction(
      R.mipmap.ic_launcher,
      "Stop",
      createStopServicePendingIntent()
    )
    .build()

  private fun createOpenAppPendingIntent(): PendingIntent? {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName) ?: return null
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    return PendingIntent.getActivity(this, 9001, launchIntent, flags)
  }

  private fun createStopServicePendingIntent(): PendingIntent {
    val stopIntent = Intent(this, LocationOverlayService::class.java).apply {
      action = ACTION_STOP
    }
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    return PendingIntent.getService(this, 9002, stopIntent, flags)
  }

  private fun canDrawOverlays(): Boolean {
    return if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      true
    } else {
      Settings.canDrawOverlays(this)
    }
  }

  @SuppressLint("MissingPermission")
  private fun requestAndSendLocation(notifyUser: Boolean = true) {
    if (!hasLocationPermission()) {
      if (notifyUser) {
        showToast("Location permission is required.")
      }
      return
    }

    val locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val provider = resolveBestProvider(locationManager)
    if (provider == null) {
      if (notifyUser) {
        showToast("Enable GPS or network location.")
      }
      return
    }

    locationCancellationSignal?.cancel()
    locationCancellationSignal = CancellationSignal()

    LocationManagerCompat.getCurrentLocation(
      locationManager,
      provider,
      locationCancellationSignal,
      ContextCompat.getMainExecutor(this)
    ) { location ->
      val selectedLocation = location ?: getBestLastKnownLocation(locationManager)
      if (selectedLocation == null) {
        if (notifyUser) {
          showToast("Unable to get current location.")
        }
        return@getCurrentLocation
      }
      postLocationToServer(selectedLocation.latitude, selectedLocation.longitude, notifyUser)
    }
  }

  private fun hasLocationPermission(): Boolean {
    val fineGranted = ContextCompat.checkSelfPermission(
      this,
      Manifest.permission.ACCESS_FINE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED
    val coarseGranted = ContextCompat.checkSelfPermission(
      this,
      Manifest.permission.ACCESS_COARSE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED
    return fineGranted || coarseGranted
  }

  @SuppressLint("MissingPermission")
  private fun getBestLastKnownLocation(locationManager: LocationManager): Location? {
    var bestLocation: Location? = null
    val providers = locationManager.getProviders(true)

    for (provider in providers) {
      val location = locationManager.getLastKnownLocation(provider) ?: continue
      if (bestLocation == null || location.accuracy < bestLocation.accuracy) {
        bestLocation = location
      }
    }

    return bestLocation
  }

  private fun resolveBestProvider(locationManager: LocationManager): String? {
    return when {
      locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ->
        LocationManager.GPS_PROVIDER
      locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) ->
        LocationManager.NETWORK_PROVIDER
      else -> null
    }
  }

  private fun postLocationToServer(latitude: Double, longitude: Double, notifyUser: Boolean) {
    networkExecutor.execute {
      val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val baseUrl = sharedPreferences.getString(PREF_BASE_URL, "")?.trim().orEmpty()
      val token = sharedPreferences.getString(PREF_TOKEN, "")?.trim().orEmpty()

      if (baseUrl.isBlank()) {
        if (notifyUser) {
          showToast("Overlay server URL is not configured.")
        }
        return@execute
      }

      val endpoint = "${baseUrl.removeSuffix("/")}/responder/location"
      var connection: HttpURLConnection? = null

      try {
        connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
          requestMethod = "POST"
          connectTimeout = 15_000
          readTimeout = 15_000
          doOutput = true
          setRequestProperty("Accept", "application/json")
          setRequestProperty("Content-Type", "application/json")

          if (token.isNotBlank()) {
            val authHeader = if (token.startsWith("Bearer ")) token else "Bearer $token"
            setRequestProperty("Authorization", authHeader)
          }
        }

        val payload = JSONObject().apply {
          put("lat", latitude)
          put("lng", longitude)
        }.toString()

        connection.outputStream.use { stream ->
          stream.write(payload.toByteArray(Charsets.UTF_8))
        }

        val statusCode = connection.responseCode
        if (statusCode in 200..299 && notifyUser) {
          showToast("Location sent.")
        } else if (statusCode !in 200..299 && notifyUser) {
          showToast("Server rejected location ($statusCode).")
        }
      } catch (_: Exception) {
        if (notifyUser) {
          showToast("Failed to send location.")
        }
      } finally {
        connection?.disconnect()
      }
    }
  }

  private fun showToast(message: String) {
    ContextCompat.getMainExecutor(this).execute {
      Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }
  }

  private fun dp(value: Int): Int {
    return (value * resources.displayMetrics.density).toInt()
  }

  private fun acquirePartialWakeLock() {
    try {
      if (wakeLock?.isHeld == true) {
        return
      }

      val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return
      wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG).apply {
        setReferenceCounted(false)
        acquire()
      }
    } catch (_: Exception) {
      // Ignore wake lock failures and continue with foreground service behavior.
    }
  }

  private fun releasePartialWakeLock() {
    val lock = wakeLock ?: return
    try {
      if (lock.isHeld) {
        lock.release()
      }
    } catch (_: Exception) {
      // Ignore wake lock release failures during shutdown.
    } finally {
      wakeLock = null
    }
  }
}
