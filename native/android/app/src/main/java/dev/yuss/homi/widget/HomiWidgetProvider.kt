package dev.yuss.homi.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import dev.yuss.homi.R
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class HomiWidgetProvider : AppWidgetProvider() {
    private val executor = Executors.newCachedThreadPool()

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        appWidgetIds.forEach { appWidgetId ->
            executor.execute { updateWidget(context, appWidgetManager, appWidgetId) }
        }
    }

    private fun updateWidget(
        context: Context,
        manager: AppWidgetManager,
        widgetId: Int,
    ) {
        val preferences = context.getSharedPreferences("homi_widget_$widgetId", Context.MODE_PRIVATE)
        val baseUrl = preferences.getString("base_url", null)
        val apiKey = preferences.getString("api_key", null)
        val homeId = preferences.getString("home_id", null)
        val kind = preferences.getString("kind", "NEXT_MAINTENANCE") ?: "NEXT_MAINTENANCE"

        val views = RemoteViews(context.packageName, R.layout.homi_widget)
        if (baseUrl.isNullOrBlank() || apiKey.isNullOrBlank() || homeId.isNullOrBlank()) {
            views.setTextViewText(R.id.homi_widget_title, "Connect Homi")
            views.setTextViewText(R.id.homi_widget_value, "Tap to configure")
            views.setTextViewText(R.id.homi_widget_subtitle, "A widgets:read API key is required")
            views.setOnClickPendingIntent(
                R.id.homi_widget_root,
                configurationIntent(context, widgetId),
            )
            manager.updateAppWidget(widgetId, views)
            return
        }

        try {
            val endpoint = URL(
                "${baseUrl.trimEnd('/')}/api/v1/widgets/summary" +
                    "?homeId=${Uri.encode(homeId)}&kind=${Uri.encode(kind)}"
            )
            val connection = endpoint.openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.connectTimeout = 15_000
            connection.readTimeout = 15_000
            connection.setRequestProperty("Authorization", "Bearer $apiKey")
            connection.setRequestProperty("Accept", "application/json")
            if (connection.responseCode != 200) error("HTTP ${connection.responseCode}")
            val payload = connection.inputStream.bufferedReader().use { it.readText() }
            val widget = JSONObject(payload).getJSONObject("widget")
            val data = widget.getJSONObject("data")
            val title = data.getString("title")
            val value = data.getString("value")
            val subtitle = data.getString("subtitle")
            val path = data.getString("url")

            views.setTextViewText(R.id.homi_widget_title, title)
            views.setTextViewText(R.id.homi_widget_value, value)
            views.setTextViewText(R.id.homi_widget_subtitle, subtitle)
            views.setOnClickPendingIntent(
                R.id.homi_widget_root,
                openHomiIntent(context, baseUrl, path, widgetId),
            )
        } catch (error: Exception) {
            views.setTextViewText(R.id.homi_widget_title, "Homi unavailable")
            views.setTextViewText(R.id.homi_widget_value, "Tap to retry")
            views.setTextViewText(R.id.homi_widget_subtitle, error.message ?: "Connection failed")
            views.setOnClickPendingIntent(
                R.id.homi_widget_root,
                refreshIntent(context, widgetId),
            )
        }
        manager.updateAppWidget(widgetId, views)
    }

    private fun configurationIntent(context: Context, widgetId: Int): PendingIntent {
        val intent = Intent(context, HomiWidgetConfigurationActivity::class.java).apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
        }
        return PendingIntent.getActivity(
            context,
            widgetId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun refreshIntent(context: Context, widgetId: Int): PendingIntent {
        val intent = Intent(context, HomiWidgetProvider::class.java).apply {
            action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, intArrayOf(widgetId))
        }
        return PendingIntent.getBroadcast(
            context,
            widgetId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun openHomiIntent(
        context: Context,
        baseUrl: String,
        path: String,
        widgetId: Int,
    ): PendingIntent {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(baseUrl.trimEnd('/') + path)).apply {
            setPackage(context.packageName)
        }
        return PendingIntent.getActivity(
            context,
            widgetId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }
}
