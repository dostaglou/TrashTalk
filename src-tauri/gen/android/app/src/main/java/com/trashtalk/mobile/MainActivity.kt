package com.trashtalk.mobile

import android.graphics.Color
import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    window.statusBarColor = Color.TRANSPARENT
    window.navigationBarColor = Color.TRANSPARENT
    WindowCompat.getInsetsController(window, window.decorView).apply {
      // The header is dark and continuous with the transparent status bar.
      isAppearanceLightStatusBars = false
      // The app's bottom surface is light, so Android gesture/navigation icons stay dark.
      isAppearanceLightNavigationBars = true
    }
    super.onCreate(savedInstanceState)
  }
}
