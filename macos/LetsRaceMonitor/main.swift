import Darwin
import AppKit
import Foundation
import os

struct MonitorSnapshot: Decodable {
    struct AI: Decodable { let lastRunAt: Double?; let month: String; let spentUsd: Double; let monthCapUsd: Double; let dayCapUsd: Double; let schedule: String }
    struct Counters: Decodable { let reads: Int?; let created: Int?; let updated: Int?; let failed: Int?; let leads: Int?; let queued: Int? }
    struct Problem: Decodable { let url: String?; let error: String? }
    struct Total: Decodable { let season: String; let total: Int; let essentials: Int? }
    struct Result: Decodable { let problems: [Problem]?; let reads: Int?; let created: Int?; let updated: Int?; let failed: Int?; let deferred: Int?; let leads: Int?; let queued: Int?; let at: Double? }
    struct Server: Decodable {
        struct Job: Decodable {
            struct Summary: Decodable { let problems: [Problem]?; let count: Int?; let created: Int?; let updated: Int?; let failed: Int?; let queued: Int? }
            let key: String; let started_at: String; let finished_at: String?; let status: String; let summary: Summary
        }
        struct Budget: Decodable { let spentUsd: Double; let monthCapUsd: Double }
        struct Health: Decodable { let sources: Int; let due: Int; let reads24h: Int; let ok24h: Int; let failed24h: Int }
        let health: Health?; let attentionSources: Int?; let reviewCandidates: Int?
        let at: String?; let checkedAt: String?; let error: String?; let jobs: [Job]?; let budget: Budget?; let due: Int?
    }
    struct Browser: Decodable { let status: String?; let issue: String?; let log: String?; let read: Int?; let written: Int?; let created: Int?; let updated: Int?; let at: String?; let lastReadAt: String?; let lastReadCount: Int? }
    struct System: Decodable {
        struct RunningProcess: Decodable { let pid: Int; let cpu: Double; let name: String }
        let cpuPercent: Int?; let memoryFreePercent: Int?; let processes: [RunningProcess]
    }
    let at: String; let pid: Int; let root: String; let data: String
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

@MainActor
final class MonitorController: NSObject, NSApplicationDelegate, NSMenuDelegate {
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
        refresh()
        timer = Timer(timeInterval: 10, target: self, selector: #selector(refresh), userInfo: nil, repeats: true)
        if let timer { RunLoop.main.add(timer, forMode: .common) }
        logger.notice("LetsRace menu started")
        if !UserDefaults.standard.bool(forKey: "shownFourCategoryOverview") {
            UserDefaults.standard.set(true, forKey: "shownFourCategoryOverview")
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
    private var headline: String {
        guard let snapshot else { return "Čekám na stav sběrače" }
        if stale { return "Sběrač se nehlásí" }
        switch snapshot.status {
        case "running": return snapshot.paused ? "Běží · pak se pozastaví" : "Sběr právě běží"
        case "quiet": return "Dlouho bez nového výstupu"
        case "paused": return "Sběr je pozastavený"
        case "attention": return snapshot.lastExitCode == 2 ? "Čeká · část údajů je k ověření" : "Poslední běh potřebuje pozornost"
        default: return "V pořádku · čeká na další běh"
        }
    }
    private var stateColor: NSColor {
        if snapshot == nil || stale { return .systemRed }
        switch snapshot?.status {
        case "quiet", "attention": return .systemOrange
        case "paused": return .secondaryLabelColor
        default: return .systemGreen
        }
    }
    @objc private func refresh() {
        do {
            snapshot = try JSONDecoder().decode(MonitorSnapshot.self, from: Data(contentsOf: dataURL.appendingPathComponent("monitor.json")))
            snapshotError = nil
        } catch { snapshotError = "Stav zatím není dostupný." }
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
        let elapsed = max(0, (Date().timeIntervalSince1970 * 1000 - started) / 1000)
        guard let samples = snapshot?.estimates?[task], !samples.isEmpty else { return "Běží \(duration(started)) · zbývající čas zatím nelze odhadnout" }
        let mean = samples.reduce(0, +) / Double(samples.count) / 1000
        if elapsed >= mean { return "Běží \(duration(started)) · trvá déle než obvykle, konec nelze určit" }
        return "Běží \(duration(started)) · odhad zbývá ~\(max(1, Int(ceil((mean - elapsed) / 60)))) min"
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
        stack.addArrangedSubview(label("LetsRace", size: 18, bold: true))
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
        else if let job { serverLines += "\nVýsledek: \(job.summary.count ?? 0) zdrojů · \(job.summary.created ?? 0) nových · \(job.summary.updated ?? 0) změněných" }
        if serverRunning { serverLines += "\nBěží na serveru · nejvýše přibližně 5 minut" }
        if let e = snapshot?.serverRequestError { serverLines += "\n\(e)" }
        let serverColor: NSColor = !freshServer || job == nil || job?.status == "error" || job?.status == "attention" ? .systemOrange : .systemGreen
        card("Server zdarma", detail: serverLines, color: serverColor, buttons: [smallButton(serverRunning ? "Běží…" : "Spustit sběr", #selector(runServer), enabled: !serverRunning), smallButton("Obnovit stav", #selector(refreshServer)), smallButton("Stav a problémy", #selector(showServerProblems))], in: stack)
        let localBusy = snapshot?.childPid != nil
        let localRunning = localBusy && snapshot?.activeTask != "federation"
        let r = snapshot?.lastResult
        var localLines = "Poslední: \(r?.at.map(time) ?? "zatím bez záznamu") · další: \(snapshot.map { time($0.nextRunAt) } ?? "—")"
        if let r { localLines += "\n\(r.reads ?? 0) zdrojů · \(r.created ?? 0) nových · \(r.updated ?? 0) změněných · \(r.failed ?? 0) selhalo" }
        if (r?.deferred ?? 0) > 0 { localLines += " · \(r?.deferred ?? 0) odloženo" }
        if r?.reads == 0 { localLines += "\nŽádný zdroj nebyl splatný; tento běh nic nepřidal." }
        if let recent = snapshot?.recent { localLines += "\nMac za 24 h: \(recent.created ?? 0) nových · \(recent.updated ?? 0) změn · \(recent.failed ?? 0) neúspěšných kontrol" }
        if localRunning { localLines += "\n\(translatedStage(snapshot?.stage)) · \(eta(snapshot?.activeTask ?? "refresh", started: snapshot?.startedAt))" }
        else if localBusy { localLines += "\nTeď běží federace; běžný sběr můžeš zařadit za ni." }
        if snapshot?.paused == true { localLines += localBusy ? "\nAutomatika je pozastavená; probíhající běh se dokončí." : "\nAutomatika je pozastavená." }
        if stale { localLines += "\nChybí čerstvé hlášení sběrače." }
        card("Mac zdarma · běžný sběr", detail: localLines, color: stale || (r?.failed ?? 0) > 0 || (snapshot?.recent?.failed ?? 0) > 0 ? .systemOrange : .systemGreen, buttons: [smallButton(localRunning ? "Běží…" : localBusy ? "Zařadit sběr" : "Spustit sběr", #selector(runNow), enabled: !localRunning), smallButton("Problémy a řešení", #selector(showLocalProblems))], in: stack)
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
        let heartbeat = "Hlášení před \(duration((snapshot?.at).flatMap(parsedDate).map { $0.timeIntervalSince1970 * 1000 }))"
        var health = heartbeat + " · server před \(duration(server?.checkedAt.flatMap(parsedDate).map { $0.timeIntervalSince1970 * 1000 }))"
        if let h = server?.health { health += "\nZa 24 h: \(h.ok24h)/\(h.reads24h) čtení OK · čeká \(h.due)/\(h.sources) zdrojů" }
        if let attention = server?.attentionSources { health += "\n\(attention) zdrojů má problém · \(server?.reviewCandidates ?? 0) podkladů čeká na ověření" }
        let healthLabel = label(health, size: 10, color: .secondaryLabelColor); healthLabel.maximumNumberOfLines = 3
        stack.addArrangedSubview(healthLabel)
        let footer = NSStackView(views: [smallButton(snapshot?.paused == true ? "Obnovit automatiku" : "Pozastavit automatiku", #selector(togglePause)), smallButton("Jak to funguje", #selector(showHelp)), smallButton("Další…", #selector(showDetails))]); footer.spacing = 8; stack.addArrangedSubview(footer)
        document.layoutSubtreeIfNeeded()
        let height = stack.fittingSize.height + 32
        document.setFrameSize(NSSize(width: 410, height: height))
        let screenHeight = item?.button?.window?.screen?.visibleFrame.height ?? 900
        let panelHeight = min(height, screenHeight - 70)
        popover.contentSize = NSSize(width: 410, height: panelHeight)
        scroll.contentView.scroll(to: NSPoint(x: 0, y: max(0, height - panelHeight - fromTop)))
    }
    func savePreview(to path: String) throws {
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
            if e.contains("unsupported_or_empty_source") { return "Stránka neobsahuje podporovaný seznam závodů. Potřebuje jinou čtečku nebo kontrolu AI; opakované ruční spuštění samo nepomůže." }
            if e.contains("source_document_too_large") { return "Dokument překračuje limit této čtečky. Vyžaduje úpravu čtečky; závody z něj se nehádají." }
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
        a.informativeText = "Procenta ukazují podíl uložených závodů s vyplněným názvem, termínem, místem, zemí, disciplínou a zdrojem. Nejsou důkazem správnosti a neříkají, kolik všech existujících závodů jsme našli. Změněné závody znamenají skutečnou změnu uloženého údaje; samy o sobě neprokazují, že je celý závod správný.\n\nČasy dokončení jsou odhady z posledních běhů; u nového typu běhu ani celého katalogu dobu neslibujeme.\n\nPo přihlášení se automaticky spustí panel i sběrač. Bezplatný sběr kontroluje zdroje každé dvě hodiny, Chrome se použije podle potřeby. AI kontrola běží na Macu v úterý a pátek ve společném limitu 5 USD za měsíc.\n\nZelená: běží nebo čeká na další spuštění. Oranžová: dlouho bez výstupu nebo výsledek k ověření. Červená: chybí čerstvé hlášení.\n\nZavření panelu nezastaví sběr. Při vypnutém Macu pokračuje server zdarma; místní sběr naváže po zapnutí a přihlášení."
        a.runModal()
    }
    @objc private func quit() {
        try? Data("intentional".utf8).write(to: dataURL.appendingPathComponent("panel-quit"), options: .atomic)
        NSApp.terminate(nil)
    }
}

@main enum LetsRaceMonitor {
    static func main() {
        if CommandLine.arguments.count == 3 && CommandLine.arguments[1] == "--render-preview" {
            let app = NSApplication.shared; app.setActivationPolicy(.prohibited)
            do { try MonitorController().savePreview(to: CommandLine.arguments[2]) }
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
