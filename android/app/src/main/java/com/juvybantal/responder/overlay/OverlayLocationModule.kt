package com.juvybantal.responder.overlay

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
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
    val granted =
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
        true
      } else {
        Settings.canDrawOverlays(reactContext)
      }
    promise.resolve(granted)
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
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactContext)) {
      promise.reject(
        "OVERLAY_PERMISSION_DENIED",
        "Overlay permission is required before starting the floating bubble."
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
}
