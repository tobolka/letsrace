// Read public organizer documents with macOS Vision. No network or model cost.
import Foundation
import Vision
import ImageIO

struct Line: Codable { let text: String; let confidence: Float }
var output: [[Line]] = []
for path in CommandLine.arguments.dropFirst() {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    request.automaticallyDetectsLanguage = false
    request.usesCPUOnly = true
    let supported = (try? request.supportedRecognitionLanguages()) ?? []
    request.recognitionLanguages = ["en-US"].filter { supported.contains($0) }
    do {
        try VNImageRequestHandler(url: URL(fileURLWithPath: path)).perform([request])
        output.append((request.results ?? []).compactMap { observation in
            guard let candidate = observation.topCandidates(1).first else { return nil }
            return Line(text: candidate.string, confidence: candidate.confidence)
        })
    } catch { output.append([]) }
}
let encoded = try JSONEncoder().encode(output)
FileHandle.standardOutput.write(encoded)
