// Read public organizer documents with macOS Vision. No network or model cost.
// Images give one list of rows; a PDF gives one list per page. "file.pdf#2,5" reads only those pages.
import Foundation
import Vision
import ImageIO
import CoreGraphics

struct Line: Codable { let text: String; let confidence: Float }
let maxSide: CGFloat = 3800
let languages = ["cs-CZ", "pl-PL", "de-DE", "it-IT", "fr-FR", "en-US"]

func recognise(_ handler: VNImageRequestHandler) -> [Line] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    request.automaticallyDetectsLanguage = false
    request.usesCPUOnly = true
    let supported = (try? request.supportedRecognitionLanguages()) ?? []
    request.recognitionLanguages = languages.filter { supported.contains($0) }
    guard (try? handler.perform([request])) != nil else { return [] }
    // A table's cells come back one by one. Rows are what make "10:00 žáci" mean anything.
    let cells: [(text: String, confidence: Float, box: CGRect)] = (request.results ?? []).compactMap { observation in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        return (candidate.string, candidate.confidence, observation.boundingBox)
    }.sorted { $0.box.midY > $1.box.midY }
    var rows: [[(text: String, confidence: Float, box: CGRect)]] = []
    for cell in cells {
        if let last = rows.last, let first = last.first, abs(first.box.midY - cell.box.midY) < min(first.box.height, cell.box.height) * 0.6 {
            rows[rows.count - 1].append(cell)
        } else { rows.append([cell]) }
    }
    return rows.map { row in
        let ordered = row.sorted { $0.box.minX < $1.box.minX }
        return Line(text: ordered.map { $0.text }.joined(separator: "  "), confidence: ordered.map { $0.confidence }.min() ?? 0)
    }
}

func pdfPage(_ page: CGPDFPage) -> CGImage? {
    let box = page.getBoxRect(.mediaBox)
    guard box.width > 0, box.height > 0 else { return nil }
    let scale = min(maxSide / max(box.width, box.height), 4.5)
    let rotated = abs(page.rotationAngle) % 180 == 90
    let width = Int((rotated ? box.height : box.width) * scale)
    let height = Int((rotated ? box.width : box.height) * scale)
    guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
    context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    // getDrawingTransform only ever shrinks a page, so it must get the page's own size, and the zoom comes from here.
    // Given the whole canvas, it draws a small 72 dpi page in the middle and Vision reads a blur.
    context.scaleBy(x: scale, y: scale)
    let pageSize = CGRect(x: 0, y: 0, width: rotated ? box.height : box.width, height: rotated ? box.width : box.height)
    context.concatenate(page.getDrawingTransform(.mediaBox, rect: pageSize, rotate: 0, preserveAspectRatio: true))
    context.drawPDFPage(page)
    return context.makeImage()
}

var output: [[Line]] = []
for argument in CommandLine.arguments.dropFirst() {
    let parts = argument.components(separatedBy: "#")
    let path = parts[0]
    if path.lowercased().hasSuffix(".pdf") {
        guard let document = CGPDFDocument(URL(fileURLWithPath: path) as CFURL) else { output.append([]); continue }
        let wanted = parts.count > 1 ? parts[1].split(separator: ",").compactMap { Int($0) } : Array(1...max(1, document.numberOfPages))
        for number in wanted {
            guard let page = document.page(at: number), let image = pdfPage(page) else { output.append([]); continue }
            output.append(recognise(VNImageRequestHandler(cgImage: image)))
        }
    } else {
        output.append(recognise(VNImageRequestHandler(url: URL(fileURLWithPath: path))))
    }
}
let encoded = try JSONEncoder().encode(output)
FileHandle.standardOutput.write(encoded)
