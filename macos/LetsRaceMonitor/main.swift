import Darwin
import AppKit
import Foundation
import os

struct MonitorSnapshot: Decodable {
    struct Cycle: Decodable { let state: String; let heldRaces: Int; let sourceFailures: Int; let unreadableSources: Int?; let seconds: Int?; let aiCostUsd: Double? }
    struct AI: Decodable { let lastRunAt: Double?; let month: String; let spentUsd: Double; let monthCapUsd: Double; let dayCapUsd: Double; let schedule: String }
    struct Counters: Decodable { let reads: Int?; let created: Int?; let updated: Int?; let failed: Int?; let leads: Int?; let queued: Int? }
    struct Problem: Decodable { let url: String?; let error: String? }
    struct Total: Decodable { let season: String; let total: Int; let essentials: Int? }
    struct Result: Decodable { let problems: [Problem]?; let reads: Int?; let created: Int?; let updated: Int?; let failed: Int?; let deferred: Int?; let unreadable: Int?; let leads: Int?; let queued: Int?; let at: Double? }
    struct Server: Decodable {
        struct Job: Decodable {
            struct Summary: Decodable { let problems: [Problem]?; let count: Int?; let created: Int?; let updated: Int?; let failed: Int?; let unreadable: Int?; let deferred: Int?; let queued: Int? }
            let key: String; let started_at: String; let finished_at: String?; let status: String; let summary: Summary
        }
        struct Budget: Decodable { let spentUsd: Double; let monthCapUsd: Double }
        struct Health: Decodable { let sources: Int; let due: Int; let reads24h: Int; let ok24h: Int; let failed24h: Int }
        let health: Health?; let attentionSources: Int?; let unreadableSources: Int?; let brokenSources: Int?; let reviewCandidates: Int?
        let at: String?; let checkedAt: String?; let error: String?; let jobs: [Job]?; let budget: Budget?; let due: Int?
    }
    struct Browser: Decodable { let status: String?; let issue: String?; let log: String?; let read: Int?; let written: Int?; let created: Int?; let updated: Int?; let at: String?; let lastReadAt: String?; let lastReadCount: Int? }
    struct System: Decodable {
        struct RunningProcess: Decodable { let pid: Int; let cpu: Double; let name: String }
        let cpuPercent: Int?; let memoryFreePercent: Int?; let processes: [RunningProcess]
    }
    let at: String; let pid: Int; let root: String; let data: String
    struct EditionCoverage: Decodable { let season: Int?; let races: Int; let withEdition: Int }
    let pipelineMode: String?; let cycleResult: Cycle?; let editionCoverage: EditionCoverage?
    let status: String; let paused: Bool; let childPid: Int?
    let stage: String?; let startedAt: Double?; let lastOutputAt: Double?
    let lastFinishedAt: Double?; let lastExitCode: Int?; let nextRunAt: Double
    let logPath: String?; let lastError: String?; let counters: Counters
    let totals: [Total]; let catalogueAt: String?; let estimates: [String: [Double]]?
    let serverRequestRunning: Bool?; let serverRequestError: String?
    let activeTask: String?; let pendingTasks: [String]?
    let lastResult: Result?; let lastActivityResult: Result?; let recent: Result?; let server: Server?
    let browser: Browser?; let ai: AI; let system: System; let countries: [String]
}

/// The owner sees one honest state; technical queues are not owner decisions.
struct MonitorOverview: Codable {
    struct State: Codable { let title: String; let detail: String; let tone: String }
    struct LastRun: Codable { let at: Double; let created: Int; let updated: Int; let failed: Int }
    let state: State
    let lastRun: LastRun?
    let reviewTitle: String
    let reviewDetail: String

    init(snapshot: MonitorSnapshot?, now: Date = Date()) {
        func date(_ value: String?) -> Date? {
            guard let value else { return nil }
            let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            return formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
        }
        func fresh(_ value: String?, within seconds: Double) -> Bool {
            guard let value = date(value) else { return false }
            let age = now.timeIntervalSince(value)
            return age >= -60 && age < seconds
        }
        let server = snapshot?.server
        let serverFresh = server?.error == nil && fresh(server?.checkedAt, within: 900)
        let job = server?.jobs?.first { $0.key == "server-free" }
        var runs: [LastRun] = []
        if let result = snapshot?.lastResult, let at = result.at {
            runs.append(LastRun(at: at, created: result.created ?? 0, updated: result.updated ?? 0, failed: result.failed ?? 0))
        }
        if snapshot?.pipelineMode != "local-new-races", let job, let finished = date(job.finished_at), job.status != "running" {
            runs.append(LastRun(at: finished.timeIntervalSince1970 * 1000, created: job.summary.created ?? 0, updated: job.summary.updated ?? 0, failed: job.summary.failed ?? 0))
        }
        if snapshot?.pipelineMode != "local-new-races", let browser = snapshot?.browser, let at = date(browser.at), (browser.read ?? 0) > 0 {
            runs.append(LastRun(at: at.timeIntervalSince1970 * 1000, created: browser.created ?? 0, updated: browser.updated ?? 0, failed: browser.status == "failed" ? 1 : 0))
        }
        lastRun = runs.max { $0.at < $1.at }
        if snapshot?.pipelineMode == "local-new-races" {
            reviewTitle = "Nové závody automaticky, sporné nálezy zvlášť"
            reviewDetail = snapshot?.cycleResult.map { "\($0.heldRaces) nálezů zůstává jen na Macu: proběhlé závody, vyjížďky a možné duplicity. Není to nic, co bys měl řešit. U existujících závodů se doplňují jen prázdné údaje." } ?? "První výsledek se doplní po dokončení nového průchodu. Změny existujících závodů se zatím neodesílají."
        } else if serverFresh, let waiting = server?.reviewCandidates {
            reviewTitle = waiting > 0 ? "Podklady čekají na ověření" : "Není připravená žádná otázka pro tebe"
            let pending = waiting == 1 ? "1 podklad čeká na kontrolu." : (2...4).contains(waiting) ? "\(waiting) podklady čekají na kontrolu." : "\(waiting) podkladů čeká na kontrolu."
            reviewDetail = waiting > 0
                ? pending + " Jejich samostatné vyřizování ještě není zapnuté. Další sken nemusíš spouštět ručně."
                : "Běžné kontroly se spouštějí samy. Podrobnosti najdeš níže."
        } else {
            reviewTitle = "Čekající podklady teď nelze ověřit"
            reviewDetail = "Poslední známé počty jsou v podrobnostech. Nedostupný přehled neznamená, že je fronta prázdná."
        }
        guard let snapshot else {
            state = State(title: "Stav zatím není dostupný", detail: "Čekám na hlášení sběru. Chybějící hlášení neznamená, že je vše v pořádku.", tone: "warning")
            return
        }
        if !fresh(snapshot.at, within: 120) {
            state = State(title: "Mac se nehlásí", detail: serverFresh ? "Server je dostupný, ale práci na Macu teď nelze ověřit." : "Práci na Macu ani stav serveru teď nelze ověřit.", tone: "warning")
        } else if snapshot.paused {
            state = State(title: "Sběr na Macu je pozastavený", detail: snapshot.childPid != nil ? "Probíhající kontrola se dokončí. Pauza platí pouze pro Mac." : "Pauza platí pouze pro Mac. Serverové kontroly tím nejsou pozastavené.", tone: "muted")
        } else if snapshot.status == "quiet" {
            state = State(title: "Sběr se dlouho neozval", detail: "Probíhající kontrola dlouho neposlala nový výsledek. Poslední dostupný průběh je v podrobnostech.", tone: "warning")
        } else if !serverFresh {
            state = State(title: "Stav serveru nelze ověřit", detail: "Mac se hlásí. Dostupnost serverové části teď není potvrzená.", tone: "warning")
        } else if snapshot.pipelineMode == "local-new-races" {
            if snapshot.status == "attention" {
                state = State(title: "Poslední průchod potřebuje opravu", detail: snapshot.lastError ?? "Uložené výsledky zůstávají zachované. Další pokus naváže na práci.", tone: "warning")
            } else if snapshot.childPid != nil {
                state = State(title: "Právě kontroluji závody", detail: snapshot.stage ?? "Nové nálezy porovnávám s katalogem; nemusíš nic spouštět.", tone: "busy")
            } else if snapshot.cycleResult?.state == "publication_pending" {
                state = State(title: "Závody jsou uložené, zobrazení čeká", detail: "Kontrola veřejných stránek ještě nepotvrdila všechny výsledky.", tone: "warning")
            } else if (snapshot.cycleResult?.sourceFailures ?? 0) > 0 || (snapshot.cycleResult?.unreadableSources ?? 0) > 0 {
                state = State(title: "Průchod doběhl s omezením", detail: "Některé zdroje se nepodařilo přečíst. Nové závody a čekající nálezy jsou uvedené zvlášť.", tone: "warning")
            } else {
                state = State(title: "Další kontrola je naplánovaná", detail: "Na Macu pracuji průběžně: je-li co dělat, navazuji hned, jinak čekám na další splatnou práci. Mac musí být zapnutý a přihlášený; po návratu navážu.", tone: "good")
            }
        } else if server?.brokenSources == nil || server?.unreadableSources == nil || server?.reviewCandidates == nil {
            state = State(title: "Přehled sběru není úplný", detail: "Server odpovídá, ale část stavu není potvrzená. Chybějící počty se nepovažují za nulu.", tone: "warning")
        } else if job == nil {
            state = State(title: "První serverová kontrola není potvrzená", detail: "Server odpovídá, ale dokončený běh zatím není zaznamenaný.", tone: "warning")
        } else if snapshot.status == "attention" && snapshot.lastExitCode == 1 {
            state = State(title: "Poslední sběr na Macu nedoběhl", detail: "Část kontroly skončila chybou. Už uložené výsledky zůstávají zachované; příčina je v podrobnostech.", tone: "warning")
        } else if job?.status == "running" && !fresh(job?.started_at, within: 900) {
            state = State(title: "Serverová kontrola se nedokončila", detail: "Poslední běh zůstává bez výsledku. Podrobnosti obsahují poslední dostupný stav.", tone: "warning")
        } else {
            let busy = snapshot.childPid != nil || snapshot.serverRequestRunning == true || job?.status == "running"
            if (server?.brokenSources ?? 0) > 0 || (lastRun?.failed ?? 0) > 0 {
                state = State(title: busy ? "Probíhá sběr s omezením" : "Sběr funguje s omezením", detail: "Některé zdroje se nepodařilo zpracovat. Zbytek sběru pokračuje podle plánu. Příčiny najdeš v podrobnostech.", tone: "warning")
            } else if busy {
                state = State(title: "Právě probíhá sběr", detail: "Zpracovávají se dostupné zdroje. Další kontrolu nemusíš spouštět.", tone: "busy")
            } else if (server?.unreadableSources ?? 0) > 0 || (server?.reviewCandidates ?? 0) > 0 {
                state = State(title: "Sběr funguje, ověřování čeká", detail: "Část stránek potřebuje jiný způsob přečtení nebo další podklad. Uložené údaje tím nejsou automaticky ověřené.", tone: "warning")
            } else {
                state = State(title: "Další sběr je naplánovaný", detail: "Běžné kontroly se spouštějí samy. Není potřeba vybírat jednotlivé sběrače.", tone: "good")
            }
        }
    }
}

@MainActor
/// The summary scripts/pipeline-status.ts writes to status.json; only what the desktop window shows.
struct PipelineSummary: Decodable {
    struct Mac: Decodable { let reportAgeMinutes: Int?; let lastCycleAt: String?; let cycles24h: Int }
    struct Delivered: Decodable { let newRaces24h: Int; let newRaces7d: Int; let updatedRaces24h: Int; let updatedRaces7d: Int }
    struct Stuck: Decodable { let step: String; let outcome: String; let reason: String?; let stopped: Bool? }
    let at: String; let tone: String; let headline: String; let mac: Mac; let delivered: Delivered; let heldRaces: Int?; let stuck: [Stuck]
}

/// A small window that lies on the desktop, under every other window, and says how the pipeline is doing.
/// It takes no clicks and no focus. Switch it off with: defaults write cz.letsrace.monitor desktopSummary -bool false
final class DesktopSummary {
    private let window: NSWindow
    private let label = NSTextField(wrappingLabelWithString: "")
    private let dot = NSView(frame: NSRect(x: 14, y: 0, width: 10, height: 10))
    static let size = NSSize(width: 300, height: 156)

    init() {
        window = NSWindow(contentRect: NSRect(origin: .zero, size: DesktopSummary.size), styleMask: .borderless, backing: .buffered, defer: false)
        window.isOpaque = false; window.backgroundColor = .clear; window.hasShadow = false; window.ignoresMouseEvents = true
        window.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopIconWindow)) - 1)
        window.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        let box = NSVisualEffectView(frame: NSRect(origin: .zero, size: DesktopSummary.size))
        box.material = .hudWindow; box.blendingMode = .behindWindow; box.state = .active
        box.wantsLayer = true; box.layer?.cornerRadius = 14; box.layer?.masksToBounds = true
        dot.wantsLayer = true; dot.layer?.cornerRadius = 5; dot.frame.origin.y = DesktopSummary.size.height - 27
        label.frame = NSRect(x: 32, y: 10, width: DesktopSummary.size.width - 44, height: DesktopSummary.size.height - 20)
        label.maximumNumberOfLines = 9; label.isSelectable = false
        box.addSubview(dot); box.addSubview(label); window.contentView = box
    }

    static func color(_ tone: String) -> NSColor {
        switch tone { case "green": return .systemGreen; case "yellow": return .systemYellow; case "orange": return .systemOrange; default: return .systemRed }
    }

    /// What the window says for a summary, or for none. Separate from drawing so it can be checked without a screen.
    static func text(_ summary: PipelineSummary?, now: Date = Date()) -> (tone: String, title: String, lines: [String]) {
        guard let summary else { return ("red", "Stav sběru není k dispozici", ["Soubor se souhrnem chybí nebo nejde přečíst."]) }
        let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let written = formatter.date(from: summary.at) ?? ISO8601DateFormatter().date(from: summary.at)
        let age = written.map { Int(now.timeIntervalSince($0) / 60) } ?? 0
        // The summary is written at the end of each cycle; an old one is said to be old, not shown as today's truth.
        if age > 8 * 60 { return ("red", "Souhrn je \(age / 60) h starý", ["Sběr na Macu od té doby nedoběhl."]) }
        var lines = ["24 h: \(summary.delivered.newRaces24h) nových · \(summary.delivered.updatedRaces24h) doplněných", "7 dní: \(summary.delivered.newRaces7d) nových · \(summary.delivered.updatedRaces7d) doplněných"]
        if let held = summary.heldRaces { lines.append("Zadrženo: \(held) závodů") }
        for item in summary.stuck.prefix(3) { lines.append("• \(item.step): \(item.stopped == true ? "zastaveno" : item.outcome)\(item.reason.map { " (\($0))" } ?? "")") }
        if summary.stuck.count > 3 { lines.append("… a další \(summary.stuck.count - 3)") }
        return (summary.tone, summary.headline, lines)
    }

    func show(_ summary: PipelineSummary?) {
        let content = DesktopSummary.text(summary)
        dot.layer?.backgroundColor = DesktopSummary.color(content.tone).cgColor
        let text = NSMutableAttributedString(string: content.title + "\n", attributes: [.font: NSFont.systemFont(ofSize: 13, weight: .semibold), .foregroundColor: NSColor.labelColor])
        text.append(NSAttributedString(string: content.lines.joined(separator: "\n"), attributes: [.font: NSFont.systemFont(ofSize: 11.5), .foregroundColor: NSColor.secondaryLabelColor]))
        label.attributedStringValue = text
        if let screen = NSScreen.main {
            let area = screen.visibleFrame
            window.setFrameOrigin(NSPoint(x: area.maxX - DesktopSummary.size.width - 24, y: area.minY + 24))
        }
        window.orderFront(nil)
    }
    func hide() { window.orderOut(nil) }

    static func load(_ url: URL) -> PipelineSummary? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(PipelineSummary.self, from: data)
    }

    func savePreview(_ summary: PipelineSummary?, to path: String) throws {
        show(summary); window.orderOut(nil)
        guard let view = window.contentView, let image = view.bitmapImageRepForCachingDisplay(in: view.bounds) else { throw NSError(domain: "preview", code: 1) }
        view.cacheDisplay(in: view.bounds, to: image)
        guard let png = image.representation(using: .png, properties: [:]) else { throw NSError(domain: "preview", code: 2) }
        try png.write(to: URL(fileURLWithPath: path))
    }
}

final class MonitorController: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private var desktop: DesktopSummary?
    private let logger = Logger(subsystem: "cz.letsrace.monitor", category: "menu")
    private let dataURL = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/LetsRace/data")
    private var item: NSStatusItem!
    private var timer: Timer?
    private var snapshot: MonitorSnapshot?
    private var snapshotError: String?
    private var logWindow: NSWindow?
    private var logText: NSTextView?
    private var shownLogPath: String?
    private var lastLogText = ""
    private let iso: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()
    private let popover = NSPopover()
    private var contentStack: NSStackView?
    private enum Panel { case overview, workstreams, technical }
    private var panel: Panel = .overview
    private let previewSnapshotURL: URL?
    init(snapshotURL: URL? = nil) { previewSnapshotURL = snapshotURL; super.init() }
    private var overview: MonitorOverview { MonitorOverview(snapshot: snapshot) }
    private func parsedDate(_ value: String) -> Date? {
        iso.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.target = self; item.button?.action = #selector(togglePanel)
        popover.behavior = .transient; popover.appearance = NSAppearance(named: .aqua)
        popover.contentViewController = NSViewController()
        popover.contentViewController?.view = NSView(frame: NSRect(x: 0, y: 0, width: 360, height: 400))
        if UserDefaults.standard.object(forKey: "desktopSummary") as? Bool ?? true { desktop = DesktopSummary() }
        refresh()
        timer = Timer(timeInterval: 10, target: self, selector: #selector(refresh), userInfo: nil, repeats: true)
        if let timer { RunLoop.main.add(timer, forMode: .common) }
        logger.notice("LetsRace menu started")
        if !UserDefaults.standard.bool(forKey: "shownSimpleOverview") {
            UserDefaults.standard.set(true, forKey: "shownSimpleOverview")
            DispatchQueue.main.async { [weak self] in self?.togglePanel() }
        }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !popover.isShown { togglePanel() }; return true
    }

    private var stale: Bool {
        guard let snapshot, let date = parsedDate(snapshot.at) else { return true }
        return Date().timeIntervalSince(date) > 120
    }
    private var headline: String { overview.state.title }
    private var stateColor: NSColor {
        switch overview.state.tone {
        case "warning": return NSColor.systemOrange.blended(withFraction: 0.35, of: .black) ?? .systemOrange
        case "muted": return .secondaryLabelColor
        case "busy": return .systemBlue
        default: return .systemGreen
        }
    }
    @objc private func refresh() {
        do {
            snapshot = try JSONDecoder().decode(MonitorSnapshot.self, from: Data(contentsOf: previewSnapshotURL ?? dataURL.appendingPathComponent("monitor.json")))
            snapshotError = nil
        } catch { snapshot = nil; snapshotError = "Stav zatím není dostupný." }
        if previewSnapshotURL == nil { desktop?.show(DesktopSummary.load(dataURL.appendingPathComponent("status.json"))) }
        if let button = item?.button {
            let image = NSImage(systemSymbolName: "bicycle", accessibilityDescription: headline)
            image?.isTemplate = true
            button.image = image; button.imagePosition = .imageOnly
            button.title = ""; button.toolTip = "LetsRace · \(headline)"
            button.setAccessibilityLabel("LetsRace. \(headline)")
        }
        if logWindow?.isVisible == true { updateLog() }
        if popover.isShown { renderPanel() }
    }
    @objc private func togglePanel() {
        if popover.isShown { popover.performClose(nil); return }
        panel = .overview
        refresh(); renderPanel()
        if let button = item.button { popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY) }
    }
    private func label(_ text: String, size: CGFloat = 12, bold: Bool = false, color: NSColor = .labelColor) -> NSTextField {
        let l = NSTextField(wrappingLabelWithString: text)
        l.font = .systemFont(ofSize: size, weight: bold ? .semibold : .regular); l.textColor = color
        l.maximumNumberOfLines = 3
        return l
    }
    private func lane(_ title: String, _ detail: String, color: NSColor, in stack: NSStackView) {
        let dot = label("●", size: 10, color: color)
        let copy = NSStackView(views: [label(title, bold: true), label(detail, size: 11, color: .secondaryLabelColor)])
        copy.orientation = .vertical; copy.alignment = .leading; copy.spacing = 4
        let row = NSStackView(views: [dot, copy]); row.alignment = .top; row.spacing = 9
        stack.addArrangedSubview(row)
        row.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
    }
    private func serverDetail(_ key: String) -> (String, NSColor) {
        guard let server = snapshot?.server, let checked = server.checkedAt, let date = parsedDate(checked), Date().timeIntervalSince(date) < 900, server.error == nil else {
            return ("Stav se nepodařilo ověřit · podrobnosti níže", .systemOrange)
        }
        guard let job = server.jobs?.first(where: { $0.key == key }) else { return ("Naplánováno · první běh zatím nepotvrzen", .systemOrange) }
        if job.status == "budget_deferred" { return ("Měsíční limit vyčerpaný", .secondaryLabelColor) }
        if job.status == "running" {
            let age = parsedDate(job.started_at).map { Date().timeIntervalSince($0) } ?? .infinity
            return age > 900 ? ("Běh se nedokončil · další spuštění naváže", .systemOrange) : ("Právě zpracovává zdroje", .systemGreen)
        }
        let when = job.finished_at.flatMap(parsedDate).map { time($0.timeIntervalSince1970 * 1000) } ?? "—"
        let changes = "\(job.summary.created ?? 0) nových · \(job.summary.updated ?? 0) změněných"
        return ("\(when) · \(changes)" + (job.status == "ok" ? "" : " · část zdrojů selhala"), job.status == "ok" ? .systemGreen : .systemOrange)
    }
    private func smallButton(_ title: String, _ action: Selector, enabled: Bool = true) -> NSButton {
        let b = NSButton(title: title, target: self, action: action)
        b.controlSize = .small; b.font = .systemFont(ofSize: 11); b.isEnabled = enabled
        return b
    }
    private func card(_ title: String, detail: String, color: NSColor, buttons: [NSButton], in stack: NSStackView) {
        let box = NSView(); box.wantsLayer = true
        box.layer?.backgroundColor = NSColor(calibratedWhite: 0.975, alpha: 1).cgColor
        box.layer?.cornerRadius = 10
        let content = NSStackView(); content.orientation = .vertical; content.alignment = .leading; content.spacing = 7
        content.translatesAutoresizingMaskIntoConstraints = false; box.addSubview(content)
        let heading = NSStackView(views: [label("●", size: 10, color: color), label(title, size: 13, bold: true)])
        heading.spacing = 7; content.addArrangedSubview(heading)
        let copy = label(detail, size: 11, color: .secondaryLabelColor); copy.maximumNumberOfLines = 0
        content.addArrangedSubview(copy)
        copy.widthAnchor.constraint(equalTo: content.widthAnchor).isActive = true
        let actions = NSStackView(views: buttons); actions.spacing = 8; content.addArrangedSubview(actions)
        NSLayoutConstraint.activate([content.leadingAnchor.constraint(equalTo: box.leadingAnchor, constant: 12), content.trailingAnchor.constraint(equalTo: box.trailingAnchor, constant: -12), content.topAnchor.constraint(equalTo: box.topAnchor, constant: 11), content.bottomAnchor.constraint(equalTo: box.bottomAnchor, constant: -11)])
        stack.addArrangedSubview(box); box.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
    }
    private func eta(_ task: String, started: Double?) -> String {
        guard let started else { return "" }
        return "Běží \(duration(started))"
    }
    private func shortDate(_ value: String?) -> String { value.flatMap(parsedDate).map { time($0.timeIntervalSince1970 * 1000) } ?? "zatím bez záznamu" }
    private func nextServerTime() -> String {
        var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(secondsFromGMT: 0)!
        let next = c.nextDate(after: Date(), matching: DateComponents(hour: 5, minute: 0), matchingPolicy: .nextTime)
        return next.map { time($0.timeIntervalSince1970 * 1000) } ?? "denně"
    }
    private func nextAiDay(blocked: Bool) -> String {
        var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Prague")!
        let base: Date
        if blocked, let interval = c.dateInterval(of: .month, for: Date()) { base = interval.end.addingTimeInterval(-1) } else { base = Date() }
        let options = [3,6].compactMap { c.nextDate(after: base, matching: DateComponents(hour: 0, minute: 0, weekday: $0), matchingPolicy: .nextTime) }
        guard let next = options.min() else { return "úterý a pátek" }
        let f = DateFormatter(); f.locale = Locale(identifier: "cs_CZ"); f.dateFormat = "d. M."
        return "od \(f.string(from: next)), při nejbližším cyklu"
    }
    private func renderPanel() {
        let focusedAction = (popover.contentViewController?.view.window?.firstResponder as? NSButton)?.action
        switch panel {
        case .overview: renderOverviewPanel()
        case .workstreams: renderWorkstreamsPanel()
        case .technical: renderTechnicalPanel()
        }
        // Refreshes must not steal keyboard focus from a button being used.
        if let focusedAction, let view = popover.contentViewController?.view {
            func restore(in candidate: NSView) -> Bool {
                if let button = candidate as? NSButton, button.action == focusedAction, button.isEnabled {
                    view.window?.makeFirstResponder(button); return true
                }
                return candidate.subviews.contains { restore(in: $0) }
            }
            _ = restore(in: view)
        }
    }
    @objc private func openTechnicalPanel() { panel = .technical; renderPanel() }
    @objc private func openWorkstreamsPanel() { panel = .workstreams; renderPanel() }
    @objc private func openOverviewPanel() { panel = .overview; renderPanel() }
    private func renderOverviewPanel() {
        guard let view = popover.contentViewController?.view else { return }
        view.subviews.forEach { $0.removeFromSuperview() }
        view.wantsLayer = true; view.layer?.backgroundColor = NSColor.white.cgColor
        let scroll = NSScrollView(); scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.drawsBackground = false; scroll.hasVerticalScroller = true; scroll.autohidesScrollers = true
        view.addSubview(scroll)
        NSLayoutConstraint.activate([scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor), scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor), scroll.topAnchor.constraint(equalTo: view.topAnchor), scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor)])
        let document = NSView(frame: NSRect(x: 0, y: 0, width: 378, height: 500)); scroll.documentView = document
        let stack = NSStackView(); stack.orientation = .vertical; stack.alignment = .leading; stack.spacing = 22
        stack.translatesAutoresizingMaskIntoConstraints = false; document.addSubview(stack)
        NSLayoutConstraint.activate([stack.leadingAnchor.constraint(equalTo: document.leadingAnchor, constant: 22), stack.widthAnchor.constraint(equalToConstant: 334), stack.topAnchor.constraint(equalTo: document.topAnchor, constant: 22)])
        func add(_ text: String, size: CGFloat, bold: Bool = false, color: NSColor = .labelColor, to parent: NSStackView) {
            let field = label(text, size: size, bold: bold, color: color); field.maximumNumberOfLines = 0
            parent.addArrangedSubview(field); field.widthAnchor.constraint(equalTo: parent.widthAnchor).isActive = true
        }
        func section() -> NSStackView {
            let result = NSStackView(); result.orientation = .vertical; result.alignment = .leading; result.spacing = 7
            stack.addArrangedSubview(result); result.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
            return result
        }
        add("LetsRace", size: 16, bold: true, to: stack)
        let summary = overview
        let status = section()
        add(summary.state.title, size: 21, bold: true, color: stateColor, to: status)
        add(summary.state.detail, size: 12, color: .secondaryLabelColor, to: status)
        let result = section()
        add("Poslední dokončená kontrola", size: 11, color: .secondaryLabelColor, to: result)
        if let last = summary.lastRun {
            add(time(last.at), size: 12, bold: true, to: result)
            add("Nové položky v katalogu: \(last.created)\nUložené změny: \(last.updated)", size: 13, to: result)
            if let seconds = snapshot?.cycleResult?.seconds {
                add("Doba průchodu: \(seconds / 60) min \(seconds % 60) s", size: 12, color: .secondaryLabelColor, to: result)
            }
            if let coverage = snapshot?.editionCoverage, coverage.races > 0 {
                let percent = Int((100 * Double(coverage.withEdition) / Double(coverage.races)).rounded())
                add("Ročník \(coverage.season.map(String.init) ?? "příští"): \(coverage.withEdition) z \(coverage.races) loňských závodů (\(percent) %)", size: 12, color: .secondaryLabelColor, to: result)
            }
        } else {
            add("Zatím bez výsledku", size: 13, to: result)
        }
        let review = section()
        add(summary.reviewTitle, size: 13, bold: true, to: review)
        add(summary.reviewDetail, size: 12, color: .secondaryLabelColor, to: review)
        let actions = NSStackView(views: [smallButton("Otevřít LetsRace", #selector(openSite)), smallButton("Co systém dělá", #selector(openWorkstreamsPanel))]); actions.spacing = 12
        stack.addArrangedSubview(actions)
        let footer = section()
        footer.addArrangedSubview(smallButton(snapshot?.paused == true ? "Obnovit sběr na Macu" : "Pozastavit sběr na Macu", #selector(togglePause), enabled: snapshot != nil && !stale))
        if snapshot?.pipelineMode == "local-new-races", let next = snapshot?.nextRunAt { add("Další kontrola: \(time(next))", size: 11, color: .secondaryLabelColor, to: footer) }
        add("Poslední hlášení: \(shortDate(snapshot?.at))", size: 10, color: .secondaryLabelColor, to: footer)
        document.layoutSubtreeIfNeeded()
        let height = stack.fittingSize.height + 44
        document.setFrameSize(NSSize(width: 378, height: height))
        let screenHeight = item?.button?.window?.screen?.visibleFrame.height ?? 900
        let panelHeight = min(height, screenHeight - 70)
        popover.contentSize = NSSize(width: 378, height: panelHeight)
        scroll.contentView.scroll(to: NSPoint(x: 0, y: max(0, height - panelHeight)))
    }
    private func renderWorkstreamsPanel() {
        guard let view = popover.contentViewController?.view else { return }
        let previousScroll = view.subviews.first as? NSScrollView
        let fromTop = previousScroll.map { max(0, ($0.documentView?.frame.height ?? 0) - $0.documentVisibleRect.maxY) } ?? 0
        view.subviews.forEach { $0.removeFromSuperview() }
        view.wantsLayer = true; view.layer?.backgroundColor = NSColor.white.cgColor
        let scroll = NSScrollView(); scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.drawsBackground = false; scroll.hasVerticalScroller = true; scroll.autohidesScrollers = true
        view.addSubview(scroll)
        NSLayoutConstraint.activate([scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor), scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor), scroll.topAnchor.constraint(equalTo: view.topAnchor), scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor)])
        let document = NSView(frame: NSRect(x: 0, y: 0, width: 410, height: 800)); scroll.documentView = document
        let stack = NSStackView(); stack.orientation = .vertical; stack.alignment = .leading; stack.spacing = 24
        stack.translatesAutoresizingMaskIntoConstraints = false; document.addSubview(stack)
        NSLayoutConstraint.activate([stack.leadingAnchor.constraint(equalTo: document.leadingAnchor, constant: 22), stack.widthAnchor.constraint(equalToConstant: 366), stack.topAnchor.constraint(equalTo: document.topAnchor, constant: 22)])
        func text(_ value: String, size: CGFloat = 12, bold: Bool = false, color: NSColor = .labelColor, to parent: NSStackView) {
            let field = label(value, size: size, bold: bold, color: color); field.maximumNumberOfLines = 0
            parent.addArrangedSubview(field); field.widthAnchor.constraint(equalTo: parent.widthAnchor).isActive = true
        }
        func section(_ title: String, _ mode: String, _ detail: String) {
            let group = NSStackView(); group.orientation = .vertical; group.alignment = .leading; group.spacing = 6
            stack.addArrangedSubview(group); group.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
            text(title, size: 15, bold: true, to: group)
            text(mode, bold: true, to: group)
            text(detail, color: .secondaryLabelColor, to: group)
        }
        stack.addArrangedSubview(smallButton("Zpět na přehled", #selector(openOverviewPanel)))
        text("Co systém dělá", size: 22, bold: true, to: stack)
        text("Čtyři činnosti, jeden katalog. Tady je jejich nastavený režim; aktuální stav sběru je v přehledu.", color: .secondaryLabelColor, to: stack)
        if snapshot?.pipelineMode == "local-new-races" {
            section("1. Nové weby", "Zatím pozastavené", "Automatické rozšiřování seznamu zdrojů teď neběží. Nalezený web sám o sobě není nový závod.")
            section("2. Nové závody ze známých webů", "Na Macu průběžně", "Čte splatné zdroje a weby pořadatelů. Nálezy porovná s čerstvým katalogem včetně skrytých a sloučených záznamů. Prověřené nové závody odešle; nejisté nechá k posouzení.")
            section("3. Změny existujících závodů", "Prázdné údaje se doplňují, ostatní změny zůstávají na Macu", "Tento první automatický režim změny existujících závodů neodesílá. Počasí, samostatné geokódování a zveřejnění dál zajišťuje server.")
            section("4. Sporné nálezy", "Samostatné posouzení ještě zbývá", "Nálezy nezmizí po ukončení ani restartu. Zadržený nález není zamítnutý závod a automaticky neznamená otázku pro tebe. Placená AI v tomto režimu neběží.")
        } else {
        section("1. Hledání nových webů", "Hledání automaticky · přijetí zdrojů čeká", "Hledá dosud neznámé pořadatele a kalendáře. Nalezený web je návrh zdroje, ještě ne nový závod. Jeho přijetí není plně automatické.")
        section("2. Nové závody ze známých webů", "Pravidelný automatický sběr", "Prochází sledované kalendáře a weby. Nález porovná s katalogem: nový závod přidá, známý aktualizuje a nejasnou shodu odloží k ověření.")
        section("3. Doplňování existujících závodů", "Část automaticky · AI v omezeném režimu", "Dohledává například web pořadatele a přihlášky. Podrobné doplňování neběží v každém cyklu; AI se spouští jen ve vybrané dny a v rozpočtu. Staré údaje nejsou novým potvrzením.")
        let waiting: String
        if let server = snapshot?.server, server.error == nil, let checked = server.checkedAt, let at = parsedDate(checked), (-60..<900).contains(Date().timeIntervalSince(at)), let count = server.reviewCandidates {
            waiting = count == 1 ? "1 podklad čeká na ověření" : (2...4).contains(count) ? "\(count) podklady čekají na ověření" : "\(count) podkladů čeká na ověření"
        } else { waiting = "Aktuální počet čekajících podkladů není potvrzený" }
        section("4. Ověřování sporných nálezů", waiting, "Mac opakovaně kontroluje zdroje a ukládá další termín pokusu. Samostatné posouzení a zveřejnění zatím chybí. Změna stránky sama nepotvrzuje závod.")
        }
        section("Co potřebuje tebe?", "Nemusíš vybírat ani spouštět sběrače", "Čekající podklady jsou práce k ověření, ne automaticky otázky pro tebe. Běžná technická chyba se nemá měnit v tvůj úkol.")
        stack.addArrangedSubview(smallButton("Zobrazit průběh a nástroje", #selector(openTechnicalPanel)))
        document.layoutSubtreeIfNeeded()
        let height = stack.fittingSize.height + 44
        document.setFrameSize(NSSize(width: 410, height: height))
        let screenHeight = item?.button?.window?.screen?.visibleFrame.height ?? 900
        let panelHeight = min(height, screenHeight - 70)
        popover.contentSize = NSSize(width: 410, height: panelHeight)
        scroll.contentView.scroll(to: NSPoint(x: 0, y: max(0, height - panelHeight - fromTop)))
    }
    private func renderTechnicalPanel() {
        guard let view = popover.contentViewController?.view else { return }
        let oldScroll = view.subviews.first as? NSScrollView
        let fromTop = oldScroll.map { max(0, ($0.documentView?.frame.height ?? 0) - $0.documentVisibleRect.maxY) } ?? 0
        view.subviews.forEach { $0.removeFromSuperview() }
        view.wantsLayer = true; view.layer?.backgroundColor = NSColor.white.cgColor
        let scroll = NSScrollView(); scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.drawsBackground = false; scroll.hasVerticalScroller = true; scroll.autohidesScrollers = true
        view.addSubview(scroll)
        NSLayoutConstraint.activate([scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor), scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor), scroll.topAnchor.constraint(equalTo: view.topAnchor), scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor)])
        let document = NSView(frame: NSRect(x: 0, y: 0, width: 410, height: 700)); scroll.documentView = document
        let stack = NSStackView(); stack.orientation = .vertical; stack.alignment = .leading; stack.spacing = 11
        stack.translatesAutoresizingMaskIntoConstraints = false; document.addSubview(stack)
        NSLayoutConstraint.activate([stack.leadingAnchor.constraint(equalTo: document.leadingAnchor, constant: 17), stack.widthAnchor.constraint(equalToConstant: 376), stack.topAnchor.constraint(equalTo: document.topAnchor, constant: 16)])
        stack.addArrangedSubview(smallButton("Zpět na přehled", #selector(openOverviewPanel)))
        stack.addArrangedSubview(label("Podrobnosti sběru", size: 18, bold: true))
        let totals = snapshot?.totals ?? []
        let coverage = totals.map { t in
            let n = t.essentials ?? 0, percent = t.total > 0 ? Int((100 * Double(n) / Double(t.total)).rounded()) : 0
            return "\(t.season): \(n)/\(t.total) má základní údaje (\(percent) %)"
        }.joined(separator: "\n")
        let coverageLabel = label(coverage.isEmpty ? "Stav katalogu zatím není načtený" : coverage, size: 11, color: .secondaryLabelColor)
        coverageLabel.maximumNumberOfLines = 2; stack.addArrangedSubview(coverageLabel)
        let catalogueStamp = shortDate(snapshot?.catalogueAt)
        stack.addArrangedSubview(label("Podíl z uložených závodů · kontrola \(catalogueStamp)", size: 10, color: .secondaryLabelColor))
        let server = snapshot?.server
        let job = server?.jobs?.first(where: { $0.key == "server-free" })
        let freshServer = server?.checkedAt.flatMap(parsedDate).map { Date().timeIntervalSince($0) < 900 } == true && server?.error == nil
        let serverRunning = snapshot?.serverRequestRunning == true || (job?.status == "running" && (job?.started_at).flatMap(parsedDate).map { Date().timeIntervalSince($0) < 900 } == true)
        var serverLines = "Poslední: \(shortDate(job?.finished_at)) · další: \(nextServerTime())"
        if !freshServer { serverLines += "\nStav teď nelze ověřit. Použij Obnovit stav." }
        else if let job {
            serverLines += "\nVýsledek: \(job.summary.count ?? 0) zdrojů · \(job.summary.created ?? 0) nových · \(job.summary.updated ?? 0) změněných"
            if (job.summary.failed ?? 0) > 0 { serverLines += " · \(job.summary.failed ?? 0) chyb" }
            if (job.summary.unreadable ?? 0) > 0 { serverLines += "\n\(job.summary.unreadable ?? 0) čtení potřebuje jinou čtečku" }
            if (job.summary.deferred ?? 0) > 0 { serverLines += "\n\(job.summary.deferred ?? 0) kontrol odloženo; další pokus zůstává naplánovaný" }
        }
        if serverRunning { serverLines += "\nBěží na serveru" }
        if let e = snapshot?.serverRequestError { serverLines += "\n\(e)" }
        let serverColor: NSColor = !freshServer || job == nil || job?.status == "error" || job?.status == "attention" ? .systemOrange : .systemGreen
        if snapshot?.pipelineMode == "local-new-races" {
            card("Server · veřejný web a další služby", detail: "Starý sběr je vypnutý. Počasí, geokódování a zveřejnění zůstávají na serveru.", color: freshServer ? .systemGreen : .systemOrange, buttons: [smallButton("Obnovit stav", #selector(refreshServer))], in: stack)
        } else {
            card("Server zdarma", detail: serverLines, color: serverColor, buttons: [smallButton(serverRunning ? "Běží…" : "Spustit sběr", #selector(runServer), enabled: !serverRunning), smallButton("Obnovit stav", #selector(refreshServer)), smallButton("Stav a problémy", #selector(showServerProblems))], in: stack)
        }
        let localBusy = snapshot?.childPid != nil
        let localRunning = localBusy && snapshot?.activeTask != "federation"
        let r = snapshot?.lastResult
        var localLines = "Poslední: \(r?.at.map(time) ?? "zatím bez záznamu") · další: \(snapshot.map { time($0.nextRunAt) } ?? "—")"
        if let r { localLines += "\n\(r.reads ?? 0) zdrojů · \(r.created ?? 0) nových · \(r.updated ?? 0) změněných · \(r.failed ?? 0) selhalo" }
        if (r?.unreadable ?? 0) > 0 { localLines += " · \(r?.unreadable ?? 0) potřebuje jinou čtečku" }
        if (r?.deferred ?? 0) > 0 { localLines += " · \(r?.deferred ?? 0) odloženo" }
        if r?.reads == 0 { localLines += "\nŽádný zdroj nebyl splatný; tento běh nic nepřidal." }
        if let cycle = snapshot?.cycleResult { localLines += "\n\(cycle.heldRaces) nálezů zůstává jen na Macu; u existujících závodů se doplňují jen prázdné údaje." }
        if let recent = snapshot?.recent { localLines += "\nZa 24 h: \(recent.created ?? 0) nových závodů · \(recent.updated ?? 0) upravených údajů · \(recent.failed ?? 0) chyb · \(recent.unreadable ?? 0) čtení potřebuje jinou čtečku" }
        if localRunning { localLines += "\n\(translatedStage(snapshot?.stage)) · \(eta(snapshot?.activeTask ?? "refresh", started: snapshot?.startedAt))" }
        else if localBusy { localLines += "\nTeď běží federace; běžný sběr můžeš zařadit za ni." }
        if snapshot?.paused == true { localLines += localBusy ? "\nSběr na Macu je pozastavený; probíhající běh se dokončí." : "\nSběr na Macu je pozastavený." }
        if stale { localLines += "\nChybí čerstvé hlášení sběrače." }
        card("Mac zdarma · běžný sběr", detail: localLines, color: stale || (r?.failed ?? 0) > 0 ? .systemOrange : .systemGreen, buttons: [smallButton(localRunning ? "Běží…" : localBusy ? "Zařadit sběr" : "Spustit sběr", #selector(runNow), enabled: !localRunning), smallButton("Problémy a řešení", #selector(showLocalProblems))], in: stack)
        if snapshot?.pipelineMode != "local-new-races" {
        let browser = snapshot?.browser
        let federationRunning = snapshot?.activeTask == "federation"
        let federationQueued = snapshot?.pendingTasks?.contains("federation") == true
        var federationLines = "Poslední: \(shortDate(browser?.at)) · další: pondělí od 9:00"
        federationLines += "\n\(browser?.read ?? 0) přečtených · \(browser?.created.map(String.init) ?? "—") nových · \(browser?.updated.map(String.init) ?? "—") změněných"
        if browser?.status == "failed", let lastRead = browser?.lastReadAt { federationLines += "\nPoslední načtení: \(shortDate(lastRead)) · \(browser?.lastReadCount ?? 0) řádků" }
        if federationRunning { federationLines += "\n\(eta("federation", started: snapshot?.startedAt))" }
        else if federationQueued { federationLines += "\nSken čeká na dokončení běžného sběru." }
        else if browser?.status == "needs_review" { federationLines += "\nNěkteré záznamy čekají na ověření; ostatní se uložily." }
        card("Federace ČSC · Mac + Chrome", detail: federationLines, color: federationRunning || browser?.status == "ok" ? .systemGreen : .systemOrange, buttons: [smallButton(federationRunning ? "Sken běží…" : federationQueued ? "Zařazeno" : "Spustit sken", #selector(scanFederation), enabled: !federationRunning && !federationQueued), smallButton("Výsledek a problémy", #selector(showFederationProblems))], in: stack)
        let spent = snapshot?.ai.spentUsd ?? 0, blocked = spent >= 5
        var aiLines = "Poslední: \(snapshot?.ai.lastRunAt.map(time) ?? "zatím bez záznamu") · další: \(nextAiDay(blocked: blocked))"
        aiLines += "\n\(money(spent)) / 5 USD za měsíc · max. 0,50 USD za den"
        aiLines += blocked ? "\nMěsíční limit vyčerpaný. Další placené volání je blokované." : "\nDoplňuje základní údaje; běží na tomto Macu."
        card("AI kontrola · na Macu", detail: aiLines, color: .secondaryLabelColor, buttons: [smallButton(blocked ? "Limit vyčerpaný" : localBusy ? "Zařadit AI · max. 0,50 USD" : "Spustit AI · max. 0,50 USD", #selector(runAI), enabled: !blocked && snapshot?.pendingTasks?.contains("ai") != true), smallButton("Rozpočet a další běh", #selector(showAiBudget))], in: stack)
        }
        let heartbeat = "Hlášení před \(duration((snapshot?.at).flatMap(parsedDate).map { $0.timeIntervalSince1970 * 1000 }))"
        var health = heartbeat + " · server před \(duration(server?.checkedAt.flatMap(parsedDate).map { $0.timeIntervalSince1970 * 1000 }))"
        if let h = server?.health { health += "\nZa 24 h: \(h.ok24h)/\(h.reads24h) čtení OK · čeká \(h.due)/\(h.sources) zdrojů" }
        if let broken = server?.brokenSources, let unread = server?.unreadableSources {
            health += "\nK řešení: \(broken) zdrojů s chybou · čeká na pořadatele nebo rozhodnutí: \(server?.reviewCandidates ?? 0)"
            health += "\nČeká na jinou čtečku: \(unread) stránek"
        } else if let attention = server?.attentionSources { health += "\n\(attention) zdrojů má problém · \(server?.reviewCandidates ?? 0) podkladů čeká na ověření" }
        let healthLabel = label(health, size: 10, color: .secondaryLabelColor); healthLabel.maximumNumberOfLines = 4
        stack.addArrangedSubview(healthLabel)
        let footer = NSStackView(views: [smallButton("Jak to funguje", #selector(showHelp)), smallButton("Nástroje…", #selector(showDetails))]); footer.spacing = 8; stack.addArrangedSubview(footer)
        document.layoutSubtreeIfNeeded()
        let height = stack.fittingSize.height + 32
        document.setFrameSize(NSSize(width: 410, height: height))
        let screenHeight = item?.button?.window?.screen?.visibleFrame.height ?? 900
        let panelHeight = min(height, screenHeight - 70)
        popover.contentSize = NSSize(width: 410, height: panelHeight)
        scroll.contentView.scroll(to: NSPoint(x: 0, y: max(0, height - panelHeight - fromTop)))
    }
    func savePreview(to path: String, details: Bool = false, workstreams: Bool = false) throws {
        panel = workstreams ? .workstreams : details ? .technical : .overview
        // Offscreen rendering of our own view for layout validation; no desktop capture.
        popover.contentViewController = NSViewController()
        popover.contentViewController?.view = NSView(frame: NSRect(x: 0, y: 0, width: 410, height: 800))
        refresh(); renderPanel()
        guard let view = popover.contentViewController?.view else { return }
        let window = NSWindow(contentRect: NSRect(origin: .zero, size: popover.contentSize), styleMask: .borderless, backing: .buffered, defer: false)
        window.contentView = view; window.setContentSize(popover.contentSize)
        view.layoutSubtreeIfNeeded()
        guard let bitmap = view.bitmapImageRepForCachingDisplay(in: view.bounds) else { return }
        view.cacheDisplay(in: view.bounds, to: bitmap)
        try bitmap.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: path))
    }
    @objc private func runServer() { control(["serverRunNowAt": UUID().uuidString]) }
    @objc private func refreshServer() { control(["serverRefreshAt": UUID().uuidString]) }
    private func explanation(_ title: String, _ text: String) {
        let a = NSAlert(); a.messageText = title; a.informativeText = text
        a.addButton(withTitle: "Rozumím"); a.runModal()
    }
    private func problemExplanation(_ problems: [MonitorSnapshot.Problem]) -> String {
        guard !problems.isEmpty else { return "Není zaznamenaná konkrétní chyba. Čerstvý výsledek se doplní po dokončení běhu." }
        let groups = Dictionary(grouping: problems) { p -> String in
            let e = p.error ?? ""
            if ["unsupported_or_empty_source", "low confidence or empty extract", "dynamic_render_unavailable"].contains(e) { return "Stránka neobsahuje podporovaný seznam závodů. Potřebuje jinou čtečku nebo kontrolu AI; opakované ruční spuštění samo nepomůže." }
            if e.contains("source_document_too_large") { return "Dokument překračuje limit této čtečky. Vyžaduje úpravu čtečky; závody z něj se nehádají." }
            if e.contains("eventiv_api_http_401") || e.contains("eventiv_api_http_403") { return "Eventiv vyžaduje přihlášení ke kalendáři. Veřejné čtení teď není dostupné; uložené závody zůstávají zachované." }
            if e.contains("TLS certificate") { return "Web zdroje nemá ověřitelný certifikát. Připojení se neobchází; zdroj je potřeba zkontrolovat." }
            if e.contains("fetch failed") { return "Zdroj se nepodařilo stáhnout. Automatika ho zkusí znovu podle splatnosti; nemusíš nic spouštět." }
            if e.contains("HTTP 500") { return "Web zdroje vrací chybu 500. Automatika ho zkusí znovu; opravuje se na straně zdroje." }
            return "Čtení nebo ověření se nedokončilo. Podrobný důvod je v diagnostice."
        }
        return groups.sorted { $0.key < $1.key }.map { reason, rows in
            let hosts = Array(Set(rows.compactMap { $0.url.flatMap(URL.init(string:))?.host })).sorted().joined(separator: ", ")
            return "\(rows.count)× \(reason)\n\(hosts)"
        }.joined(separator: "\n\n")
    }
    @objc private func showLocalProblems() { explanation("Běžný sběr na Macu · posledních 24 hodin", problemExplanation(snapshot?.recent?.problems ?? snapshot?.lastResult?.problems ?? [])) }
    @objc private func showServerProblems() {
        let job = snapshot?.server?.jobs?.first { $0.key == "server-free" }
        let detail = snapshot?.server?.error ?? snapshot?.serverRequestError ?? problemExplanation(job?.summary.problems ?? [])
        explanation("Server zdarma", detail + "\n\nNaplánováno denně. Obnovit stav jen načte hlášení; Spustit sběr opravdu pustí práci.")
    }
    @objc private func showFederationProblems() {
        let b = snapshot?.browser
        var text = "Poslední sken: \(b?.read ?? 0) přečtených záznamů; \(b?.created ?? 0) nových závodů; \(b?.updated ?? 0) změněných závodů."
        if let issue = b?.issue {
            if issue.contains("end_before_start") || issue.contains("precedes start") { text += "\n\nZdroj má u jednoho závodu konec před začátkem. Datum se automaticky nevymýšlí." }
            if issue.contains("identity_review_required") { text += "\n\nJiný záznam má rozpornou identitu vůči již uloženému závodu. Automatické sloučení je zablokované." }
            text += "\n\nSporné záznamy jsou ve frontě ověření. Další sken je sám neopraví; ostatní výsledky zůstávají uložené."
        } else { text += "\n\nNení zaznamenaný problém tohoto skenu." }
        text += "\n\nPrůchod nemusí přinést nový závod, pokud federace nic nového nezveřejnila."
        explanation("Federace ČSC · výsledek a řešení", text)
    }
    @objc private func showAiBudget() {
        explanation("AI kontrola na Macu", "Zaznamenáno tento měsíc: \(money(snapshot?.ai.spentUsd ?? 0)) USD. Nový limit je 5 USD měsíčně a 0,50 USD denně. Dřívější útrata se nemaže.\n\nPři vyčerpaném limitu další volání neproběhne. Rozpočet se počítá znovu od prvního dne dalšího měsíce; automatické pokusy jsou v úterý a pátek při místním cyklu. Bezplatný sběr i federace pokračují.\n\nAI není procentuální sken celého internetu. Počet závodů předem neznáme; proto nelze slíbit čas do úplného katalogu.")
    }
    private func translatedStage(_ value: String?) -> String {
        switch value {
        case "Sken federace ČSC přes Chrome": return "sken federace přes Chrome"
        case "Coverage before", "Coverage after": return "kontrola výsledků"
        case "Due calendars and sources", "Everything else that is due": return "čtení zdrojů"
        case "Free discovery of new source links": return "hledání nových zdrojů"
        case "Places (slow geocoding)": return "doplnění míst"
        case "Duplicates (review only)": return "kontrola duplicit"
        default: return "zpracování podkladů"
        }
    }
    @objc private func showDetails(_ sender: NSButton) {
        let menu = NSMenu(); menu.appearance = NSAppearance(named: .aqua)
        action(menu, "Otevřít živý log", #selector(showLog))
        action(menu, "Zastavit probíhající sběr…", #selector(stopRun), enabled: snapshot?.childPid != nil)
        action(menu, "Otevřít LetsRace", #selector(openSite))
        action(menu, "Podklady a logy", #selector(openData))
        action(menu, "Zkopírovat diagnostiku", #selector(copyStatus))
        menu.addItem(.separator()); action(menu, "Zavřít panel · sběr pokračuje", #selector(quit))
        menu.popUp(positioning: nil, at: NSPoint(x: 0, y: sender.bounds.maxY), in: sender)
    }
    private func info(_ menu: NSMenu, _ text: String, bold: Bool = false) {
        let i = NSMenuItem(title: text, action: nil, keyEquivalent: ""); i.isEnabled = false
        if bold { i.attributedTitle = NSAttributedString(string: text, attributes: [.font: NSFont.systemFont(ofSize: 12, weight: .semibold)]) }
        menu.addItem(i)
    }
    private func action(_ menu: NSMenu, _ title: String, _ selector: Selector, enabled: Bool = true) {
        let i = NSMenuItem(title: title, action: selector, keyEquivalent: ""); i.target = self; i.isEnabled = enabled; menu.addItem(i)
    }
    private func duration(_ ms: Double?) -> String {
        guard let ms else { return "—" }; let seconds = max(0, Int(Date().timeIntervalSince1970 - ms / 1000))
        return seconds < 60 ? "\(seconds) s" : seconds < 3600 ? "\(seconds / 60) min" : "\(seconds / 3600) h \((seconds % 3600) / 60) min"
    }
    private func time(_ ms: Double) -> String {
        let f = DateFormatter(); f.locale = Locale(identifier: "cs_CZ"); f.dateFormat = "d. M. H:mm"; return f.string(from: Date(timeIntervalSince1970: ms / 1000))
    }
    private func money(_ n: Double) -> String { String(format: "%.2f", locale: Locale(identifier: "cs_CZ"), n) }
    private func control(_ changes: [String: Any]) {
        do {
            let url = dataURL.appendingPathComponent("control.json")
            var value = (try? JSONSerialization.jsonObject(with: Data(contentsOf: url))) as? [String: Any] ?? [:]
            value.merge(changes) { _, new in new }
            try JSONSerialization.data(withJSONObject: value).write(to: url, options: .atomic)
            refresh()
        } catch { logger.error("Control write failed: \(error.localizedDescription)") }
    }
    @objc private func togglePause() { control(["paused": !(snapshot?.paused ?? false)]) }
    @objc private func scanFederation() { control(["scanNowAt": UUID().uuidString, "paused": false]); popover.performClose(nil) }
    @objc private func runAI() { control(["aiNowAt": UUID().uuidString, "paused": false]); popover.performClose(nil) }
    @objc private func runNow() { control(["refreshNowAt": UUID().uuidString, "paused": false]) }
    @objc private func stopRun() {
        let alert = NSAlert(); alert.messageText = "Zastavit aktuální sběr?"
        alert.informativeText = "Běžící krok se přeruší. Již uložené výsledky zůstanou; další běh naváže na uložený stav."
        alert.addButton(withTitle: "Zastavit běh"); alert.addButton(withTitle: "Nechat dokončit")
        if alert.runModal() == .alertFirstButtonReturn { control(["stopRunAt": UUID().uuidString]) }
    }
    @objc private func showLog() { if let path = snapshot?.logPath { openLog(path) } }
    @objc private func showBrowserLog() {
        guard let s = snapshot, let path = s.browser?.log else { return }
        openLog(path.hasPrefix("/") ? path : URL(fileURLWithPath: s.root).appendingPathComponent(path).path)
    }
    private func openLog(_ path: String) {
        shownLogPath = path
        if logWindow == nil {
            let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 760, height: 480), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
            window.isReleasedWhenClosed = false; window.title = "LetsRace · živý log"; window.center()
            let scroll = NSScrollView(frame: window.contentView!.bounds); scroll.autoresizingMask = [.width, .height]; scroll.hasVerticalScroller = true
            let text = NSTextView(frame: scroll.bounds); text.isEditable = false; text.isSelectable = true; text.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
            text.autoresizingMask = [.width]; text.textContainerInset = NSSize(width: 15, height: 15); text.textContainer?.widthTracksTextView = true
            scroll.documentView = text; window.contentView?.addSubview(scroll); logText = text; logWindow = window
        }
        updateLog(); logWindow?.makeKeyAndOrderFront(nil); NSApp.activate()
    }
    private func updateLog() {
        guard let shownLogPath else { return }
        do {
            let handle = try FileHandle(forReadingFrom: URL(fileURLWithPath: shownLogPath)); defer { try? handle.close() }
            let size = try handle.seekToEnd(); try handle.seek(toOffset: size > 60000 ? size - 60000 : 0)
            let value = String(decoding: try handle.readToEnd() ?? Data(), as: UTF8.self)
            if value != lastLogText { logText?.string = value; logText?.scrollToEndOfDocument(nil); lastLogText = value }
        } catch { logText?.string = "Log zatím není dostupný.\n\(error.localizedDescription)" }
    }
    @objc private func openData() { NSWorkspace.shared.open(dataURL) }
    @objc private func openSite() { if let url = URL(string: "https://letsrace.cz/cs") { NSWorkspace.shared.open(url) } }
    @objc private func copyStatus() {
        guard let text = try? String(contentsOf: dataURL.appendingPathComponent("monitor.json"), encoding: .utf8) else { return }
        NSPasteboard.general.clearContents(); NSPasteboard.general.setString(text, forType: .string)
    }
    @objc private func showHelp() {
        let a = NSAlert(); a.messageText = "Sběr se o sebe stará sám"
        if snapshot?.pipelineMode == "local-new-races" {
            a.informativeText = "Po přihlášení se spustí panel a plánovač. Nový průchod na Macu pracuje průběžně: má-li co dělat, navazuje hned, jinak čeká na další splatnou práci. Práci si pamatuje a nepřečítá vše od začátku. Při vypnutém Macu se zdroje nečtou; po zapnutí a přihlášení naváže.\n\nPrvní automatický režim posílá jen prověřené nové závody. Změny existujících závodů a nejasné nálezy zůstávají uložené k posouzení. Placená AI teď neběží. Starý serverový sběr je vypnutý; počasí, geokódování a zveřejnění na serveru zůstávají.\n\nPočet přečtených stránek není počet nových závodů. Panel ukazuje skutečně uložené výsledky a dobu průchodu. Nepodporované čtení není automaticky porucha. Zavření panelu nezastaví plánovač."
            a.runModal(); return
        }
        a.informativeText = "Procenta ukazují podíl uložených závodů s vyplněným názvem, termínem, místem, zemí, disciplínou a zdrojem. Nejsou důkazem správnosti a neříkají, kolik všech existujících závodů jsme našli. Změněné závody znamenají skutečnou změnu uloženého údaje; samy o sobě neprokazují, že je celý závod správný.\n\nPanel ukazuje skutečný stav a dobu běhu, bez odpočtu do dokončení.\n\nPo přihlášení se automaticky spustí panel i sběrač. Bezplatný sběr kontroluje zdroje každé dvě hodiny, Chrome se použije podle potřeby. AI kontrola běží na Macu v úterý a pátek ve společném limitu 5 USD za měsíc.\n\nZelená: běží nebo čeká na další spuštění. Oranžová: dlouho bez výstupu nebo výsledek k ověření. Červená: chybí čerstvé hlášení.\n\nZavření panelu nezastaví sběr. Při vypnutém Macu pokračuje server zdarma; místní sběr naváže po zapnutí a přihlášení."
        a.runModal()
    }
    @objc private func quit() {
        try? Data("intentional".utf8).write(to: dataURL.appendingPathComponent("panel-quit"), options: .atomic)
        NSApp.terminate(nil)
    }
}

@main enum LetsRaceMonitor {
    static func main() {
        let args = CommandLine.arguments
        if args.count >= 3 && args[1] == "--describe-snapshot" {
            do {
                let snapshot: MonitorSnapshot? = args[2] == "-" ? nil : try JSONDecoder().decode(MonitorSnapshot.self, from: Data(contentsOf: URL(fileURLWithPath: args[2])))
                let now = args.count > 3 ? Date(timeIntervalSince1970: Double(args[3]) ?? Date().timeIntervalSince1970) : Date()
                let value = try JSONEncoder().encode(MonitorOverview(snapshot: snapshot, now: now))
                print(String(decoding: value, as: UTF8.self))
            } catch { fputs("Snapshot test failed: \(error)\n", stderr); exit(1) }
            return
        }
        if args.count >= 3 && args[1] == "--widget-text" {
            // What the desktop window would say for a saved summary, as JSON, for tests without a screen.
            let content = DesktopSummary.text(DesktopSummary.load(URL(fileURLWithPath: args[2])), now: args.count >= 4 ? (ISO8601DateFormatter().date(from: args[3]) ?? Date()) : Date())
            let value = try? JSONSerialization.data(withJSONObject: ["tone": content.tone, "title": content.title, "lines": content.lines])
            print(String(decoding: value ?? Data(), as: UTF8.self)); return
        }
        if args.count >= 3 && args[1] == "--render-widget" {
            let app = NSApplication.shared; app.setActivationPolicy(.prohibited)
            do { try DesktopSummary().savePreview(args.count >= 4 ? DesktopSummary.load(URL(fileURLWithPath: args[3])) : nil, to: args[2]) }
            catch { fputs("Widget preview failed: \(error)\n", stderr); exit(1) }
            return
        }
        if args.count >= 3 && args[1] == "--render-preview" {
            let app = NSApplication.shared; app.setActivationPolicy(.prohibited)
            let fixture = args.dropFirst(3).first { !$0.hasPrefix("--") }.map { URL(fileURLWithPath: $0) }
            do { try MonitorController(snapshotURL: fixture).savePreview(to: args[2], details: args.contains("--details"), workstreams: args.contains("--workstreams")) }
            catch { fputs("Preview failed: \(error)\n", stderr); exit(1) }
            return
        }
        let data = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/LetsRace/data")
        try? FileManager.default.createDirectory(at: data, withIntermediateDirectories: true)
        let lock = Darwin.open(data.appendingPathComponent("panel.lock").path, O_CREAT | O_RDWR, mode_t(0o600))
        guard lock >= 0, flock(lock, LOCK_EX | LOCK_NB) == 0 else { return }
        let app = NSApplication.shared
        let controller = MonitorController(); app.delegate = controller
        withExtendedLifetime(controller) { app.run() }
    }
}
