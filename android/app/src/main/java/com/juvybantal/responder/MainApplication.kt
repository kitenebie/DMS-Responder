package com.juvybantal.responder
import com.juvybantal.responder.overlay.OverlayLocationPackage

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Application
import android.content.res.Configuration
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactNativeHost

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
      this,
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> {
          val packages = PackageList(this).packages
          packages.add(OverlayLocationPackage())
          return packages
        }


          override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

          override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

          override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      }
  )

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    createNotificationChannels()
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  private fun createNotificationChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val audioAttributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_NOTIFICATION)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()

    val notificationManager = getSystemService(NotificationManager::class.java)
    notificationManager?.createNotificationChannel(
      createNotificationChannel(
        channelId = "high_importance_channel",
        channelName = "High Importance Notifications",
        channelDescription = "Heads-up alerts for responder report notifications",
        soundUri = Uri.parse("android.resource://$packageName/${R.raw.new_notification}"),
        audioAttributes = audioAttributes
      )
    )
    notificationManager?.createNotificationChannel(
      createNotificationChannel(
        channelId = "chat_notifications",
        channelName = "Chat Notifications",
        channelDescription = "Heads-up alerts for responder chat messages",
        soundUri = Uri.parse("android.resource://$packageName/${R.raw.new_message}"),
        audioAttributes = audioAttributes
      )
    )
  }

  private fun createNotificationChannel(
    channelId: String,
    channelName: String,
    channelDescription: String,
    soundUri: Uri,
    audioAttributes: AudioAttributes
  ): NotificationChannel {
    return NotificationChannel(
      channelId,
      channelName,
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      description = channelDescription
      enableVibration(true)
      setShowBadge(true)
      setSound(soundUri, audioAttributes)
    }
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
