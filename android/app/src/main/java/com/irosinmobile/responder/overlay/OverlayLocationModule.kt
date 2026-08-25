package com.irosinmobile.responder.overlay

import android.Manifest
import android.app.ActivityManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

class OverlayLocationModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "OverlayLocationModule"

  @ReactMethod
  fun isOverlayPermissionGranted(promise: Promise) {
    promise.resolve(true)
  }

  @ReactMethod
  fun openOverlayPermissionSettings(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      promise.resolve(true)
      return
    }

    try {
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:${reactContext.packageName}")
      ).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject(
        "OVERLAY_SETTINGS_ERROR",
        "Unable to open overlay permission settings.",
        error
      )
    }
  }

  @ReactMethod
  fun startOverlay(options: ReadableMap?, promise: Promise) {
    if (!hasAnyLocationPermission()) {
      promise.reject(
        "LOCATION_PERMISSION_DENIED",
        "Location permission is required before starting the background tracking."
      )
      return
    }

    if (
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE &&
      !isAppInForeground() &&
      !hasBackgroundLocationPermission()
    ) {
      promise.reject(
        "OVERLAY_BACKGROUND_LOCATION_REQUIRED",
        "Open the app first or grant 'Allow all the time' location permission."
      )
      return
    }

    try {
      val intent = Intent(reactContext, LocationOverlayService::class.java).apply {
        action = LocationOverlayService.ACTION_START
        if (options?.hasKey("baseUrl") == true && !options.isNull("baseUrl")) {
          putExtra(LocationOverlayService.EXTRA_BASE_URL, options.getString("baseUrl"))
        }
        if (options?.hasKey("token") == true) {
          putExtra(LocationOverlayService.EXTRA_TOKEN, options.getString("token"))
        }
        if (options?.hasKey("userId") == true && !options.isNull("userId")) {
          putExtra(LocationOverlayService.EXTRA_USER_ID, options.getInt("userId"))
        }
        if (options?.hasKey("firebaseUrl") == true && !options.isNull("firebaseUrl")) {
          putExtra(LocationOverlayService.EXTRA_FIREBASE_URL, options.getString("firebaseUrl"))
        }
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        reactContext.startForegroundService(intent)
      } else {
        reactContext.startService(intent)
      }
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("OVERLAY_START_ERROR", "Failed to start overlay service.", error)
    }
  }

  @ReactMethod
  fun stopOverlay(promise: Promise) {
    try {
      val stopped = reactContext.stopService(Intent(reactContext, LocationOverlayService::class.java))
      promise.resolve(stopped)
    } catch (error: Exception) {
      promise.reject("OVERLAY_STOP_ERROR", "Failed to stop overlay service.", error)
    }
  }

  @ReactMethod
  fun isOverlayRunning(promise: Promise) {
    promise.resolve(LocationOverlayService.isRunning())
  }

  @ReactMethod
  fun setOverlayVisible(visible: Boolean, promise: Promise) {
    try {
      val intent = Intent(reactContext, LocationOverlayService::class.java).apply {
        action = LocationOverlayService.ACTION_SET_VISIBILITY
        putExtra(LocationOverlayService.EXTRA_OVERLAY_VISIBLE, visible)
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        reactContext.startForegroundService(intent)
      } else {
        reactContext.startService(intent)
      }

      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("OVERLAY_VISIBILITY_ERROR", "Failed to update overlay visibility.", error)
    }
  }

  @ReactMethod
  fun consumePendingNavigation(promise: Promise) {
    try {
      val pendingNavigation = LocationOverlayService.consumePendingNavigation(reactContext)
      if (pendingNavigation == null) {
        promise.resolve(null)
        return
      }

      val result = Arguments.createMap().apply {
        putString("screen", pendingNavigation.screen)
        putInt("reportId", pendingNavigation.reportId)
      }
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("OVERLAY_PENDING_NAV_ERROR", "Failed to read pending overlay navigation.", error)
    }
  }

  private fun hasAnyLocationPermission(): Boolean {
    val fineGranted = ContextCompat.checkSelfPermission(
      reactContext,
      Manifest.permission.ACCESS_FINE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED

    val coarseGranted = ContextCompat.checkSelfPermission(
      reactContext,
      Manifest.permission.ACCESS_COARSE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED

    return fineGranted || coarseGranted
  }

  private fun hasBackgroundLocationPermission(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      return hasAnyLocationPermission()
    }

    return ContextCompat.checkSelfPermission(
      reactContext,
      Manifest.permission.ACCESS_BACKGROUND_LOCATION
    ) == PackageManager.PERMISSION_GRANTED
  }

  private fun isAppInForeground(): Boolean {
    val processInfo = ActivityManager.RunningAppProcessInfo()
    ActivityManager.getMyMemoryState(processInfo)
    return processInfo.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND ||
      processInfo.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE
  }
}
