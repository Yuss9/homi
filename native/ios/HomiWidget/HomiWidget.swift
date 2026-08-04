import AppIntents
import SwiftUI
import WidgetKit

private let appGroup = "group.dev.yuss.homi"

struct HomiWidgetPayload: Decodable {
    struct Widget: Decodable {
        struct Home: Decodable { let id: String; let name: String }
        struct DataValue: Decodable {
            let title: String
            let value: String
            let subtitle: String
            let url: String
        }
        let kind: String
        let home: Home
        let data: DataValue
        let refreshedAt: String
    }
    let widget: Widget
}

enum HomiWidgetKind: String, AppEnum {
    case nextMaintenance = "NEXT_MAINTENANCE"
    case homeHealth = "HOME_HEALTH"
    case openRepairs = "OPEN_REPAIRS"
    case monthlyCosts = "MONTHLY_COSTS"
    case quickAction = "QUICK_ACTION"

    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Homi widget")
    static let caseDisplayRepresentations: [Self: DisplayRepresentation] = [
        .nextMaintenance: "Next maintenance",
        .homeHealth: "Home Health",
        .openRepairs: "Open repairs",
        .monthlyCosts: "Monthly costs",
        .quickAction: "Quick action",
    ]
}

struct HomiWidgetIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Homi widget"
    static let description = IntentDescription("Choose which connected Homi summary appears on the home screen.")

    @Parameter(title: "Content", default: .nextMaintenance)
    var kind: HomiWidgetKind
}

struct HomiWidgetEntry: TimelineEntry {
    let date: Date
    let title: String
    let value: String
    let subtitle: String
    let destination: URL?
    let connected: Bool
}

struct HomiWidgetProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> HomiWidgetEntry {
        HomiWidgetEntry(
            date: .now,
            title: "Next maintenance",
            value: "Ventilation filter",
            subtitle: "Tomorrow",
            destination: URL(string: "homi://maintenance"),
            connected: true
        )
    }

    func snapshot(for configuration: HomiWidgetIntent, in context: Context) async -> HomiWidgetEntry {
        await load(configuration: configuration) ?? placeholder(in: context)
    }

    func timeline(for configuration: HomiWidgetIntent, in context: Context) async -> Timeline<HomiWidgetEntry> {
        let entry = await load(configuration: configuration) ?? HomiWidgetEntry(
            date: .now,
            title: "Connect Homi",
            value: "Open the app",
            subtitle: "Add a widgets:read API key in Companion settings.",
            destination: URL(string: "homi://settings/widgets"),
            connected: false
        )
        return Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(15 * 60)))
    }

    private func load(configuration: HomiWidgetIntent) async -> HomiWidgetEntry? {
        guard
            let defaults = UserDefaults(suiteName: appGroup),
            let baseURL = defaults.string(forKey: "homi.baseURL"),
            let apiKey = defaults.string(forKey: "homi.apiKey"),
            let homeID = defaults.string(forKey: "homi.homeID"),
            var components = URLComponents(string: baseURL + "/api/v1/widgets/summary")
        else { return nil }

        components.queryItems = [
            URLQueryItem(name: "homeId", value: homeID),
            URLQueryItem(name: "kind", value: configuration.kind.rawValue),
        ]
        guard let url = components.url else { return nil }
        var request = URLRequest(url: url)
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 15

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
            let payload = try JSONDecoder().decode(HomiWidgetPayload.self, from: data)
            let destination = URL(string: "homi://open?path=" + payload.widget.data.url.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)!)
            return HomiWidgetEntry(
                date: .now,
                title: payload.widget.data.title,
                value: payload.widget.data.value,
                subtitle: payload.widget.data.subtitle,
                destination: destination,
                connected: true
            )
        } catch {
            return nil
        }
    }
}

struct HomiWidgetView: View {
    var entry: HomiWidgetProvider.Entry

    var body: some View {
        Link(destination: entry.destination ?? URL(string: "homi://")!) {
            VStack(alignment: .leading, spacing: 7) {
                HStack {
                    Text("⌂ Homi")
                        .font(.caption.weight(.semibold))
                    Spacer()
                    Image(systemName: entry.connected ? "checkmark.circle.fill" : "exclamationmark.circle")
                        .foregroundStyle(entry.connected ? .green : .orange)
                }
                Text(entry.title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Text(entry.value)
                    .font(.headline)
                    .lineLimit(2)
                    .minimumScaleFactor(0.75)
                Text(entry.subtitle)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                Spacer(minLength: 0)
            }
            .containerBackground(.fill.tertiary, for: .widget)
        }
    }
}

struct HomiWidget: Widget {
    let kind = "HomiWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: HomiWidgetIntent.self,
            provider: HomiWidgetProvider()
        ) { entry in
            HomiWidgetView(entry: entry)
        }
        .configurationDisplayName("Homi")
        .description("Home Health, maintenance, repairs, costs or a quick action.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}

@main
struct HomiWidgetBundle: WidgetBundle {
    var body: some Widget { HomiWidget() }
}
