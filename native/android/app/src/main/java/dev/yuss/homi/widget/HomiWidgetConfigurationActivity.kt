package dev.yuss.homi.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.Spinner
import dev.yuss.homi.R

class HomiWidgetConfigurationActivity : Activity() {
    private var widgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(RESULT_CANCELED)
        setContentView(R.layout.homi_widget_configuration)
        widgetId = intent.getIntExtra(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID,
        )
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        val kinds = linkedMapOf(
            "Next maintenance" to "NEXT_MAINTENANCE",
            "Home Health" to "HOME_HEALTH",
            "Open repairs" to "OPEN_REPAIRS",
            "Monthly costs" to "MONTHLY_COSTS",
            "Quick action" to "QUICK_ACTION",
        )
        val spinner = findViewById<Spinner>(R.id.homi_widget_kind)
        spinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, kinds.keys.toList())
        val preferences = getSharedPreferences("homi_widget_$widgetId", MODE_PRIVATE)
        findViewById<EditText>(R.id.homi_widget_url).setText(preferences.getString("base_url", ""))
        findViewById<EditText>(R.id.homi_widget_api_key).setText(preferences.getString("api_key", ""))
        findViewById<EditText>(R.id.homi_widget_home_id).setText(preferences.getString("home_id", ""))

        findViewById<Button>(R.id.homi_widget_save).setOnClickListener {
            preferences.edit()
                .putString("base_url", findViewById<EditText>(R.id.homi_widget_url).text.toString().trim())
                .putString("api_key", findViewById<EditText>(R.id.homi_widget_api_key).text.toString().trim())
                .putString("home_id", findViewById<EditText>(R.id.homi_widget_home_id).text.toString().trim())
                .putString("kind", kinds.values.elementAt(spinner.selectedItemPosition))
                .apply()
            val manager = AppWidgetManager.getInstance(this)
            HomiWidgetProvider().onUpdate(this, manager, intArrayOf(widgetId))
            setResult(
                RESULT_OK,
                intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId),
            )
            finish()
        }
    }
}
