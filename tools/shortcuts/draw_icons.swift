// Draws the two Desktop icons as 1024×1024 PNGs.
//   swift draw_icons.swift <app.png> <admin.png> [<app-full.png> <admin-full.png>]
// The optional "full" versions fill the whole square (for phone home screens, which cut their own shape).
// PrismAPP:   a faceted glass prism splitting a falling white beam into the app's three neon colors.
// PrismAdmin: a faceted rainbow prism throwing a wide spectrum.
import AppKit

func hex(_ s: String, _ a: CGFloat = 1) -> CGColor {
    var v: UInt64 = 0
    Scanner(string: String(s.dropFirst())).scanHexInt64(&v)
    return CGColor(srgbRed: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255, blue: CGFloat(v & 0xFF) / 255, alpha: a)
}

func gradient(_ colors: [CGColor], _ stops: [CGFloat]? = nil) -> CGGradient {
    CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB), colors: colors as CFArray, locations: stops)!
}

func render(_ path: String, _ draw: (CGContext) -> Void) {
    let size = 1024
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
                               samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                               bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    let ns = NSGraphicsContext(bitmapImageRep: rep)!
    NSGraphicsContext.current = ns
    let ctx = ns.cgContext
    ctx.setShouldAntialias(true)
    ctx.interpolationQuality = .high
    draw(ctx)
    NSGraphicsContext.restoreGraphicsState()
    try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
}

// Shared geometry (AppKit: y goes up)
let body = CGRect(x: 100, y: 100, width: 824, height: 824)
var fullBleed = false
var bodyPath: CGPath {
    fullBleed ? CGPath(rect: CGRect(x: 0, y: 0, width: 1024, height: 1024), transform: nil)
              : CGPath(roundedRect: body, cornerWidth: 186, cornerHeight: 186, transform: nil)
}
let A = CGPoint(x: 520, y: 742)   // apex
let B = CGPoint(x: 306, y: 372)   // bottom left
let C = CGPoint(x: 734, y: 372)   // bottom right
let G = CGPoint(x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3)
func lerp(_ p: CGPoint, _ q: CGPoint, _ t: CGFloat) -> CGPoint { CGPoint(x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t) }
let entry = lerp(B, A, 0.5)       // beam enters the left face
let exit = lerp(A, C, 0.62)       // and leaves lower on the right face

func triangle(_ p: CGPoint, _ q: CGPoint, _ r: CGPoint) -> CGPath {
    let path = CGMutablePath()
    path.move(to: p); path.addLine(to: q); path.addLine(to: r); path.closeSubpath()
    return path
}
let prism = triangle(A, B, C)

func background(_ ctx: CGContext, glows: [(CGPoint, CGFloat, CGColor)]) {
    if !fullBleed {
        ctx.saveGState()
        ctx.setShadow(offset: CGSize(width: 0, height: -16), blur: 34, color: hex("#000000", 0.5))
        ctx.addPath(bodyPath); ctx.setFillColor(hex("#0A0F18")); ctx.fillPath()
        ctx.restoreGState()
    }

    ctx.saveGState()
    ctx.addPath(bodyPath); ctx.clip()
    ctx.setFillColor(hex("#0A0F18")); ctx.fill(CGRect(x: 0, y: 0, width: 1024, height: 1024))
    ctx.drawLinearGradient(gradient([hex("#1A2438"), hex("#0B111C"), hex("#05080E")], [0, 0.55, 1]),
                           start: CGPoint(x: 512, y: 924), end: CGPoint(x: 512, y: 100),
                           options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
    for (c, r, col) in glows {
        ctx.drawRadialGradient(gradient([col, col.copy(alpha: 0)!]), startCenter: c, startRadius: 0, endCenter: c, endRadius: r, options: [])
    }
    // soft top sheen
    ctx.drawLinearGradient(gradient([hex("#FFFFFF", 0.07), hex("#FFFFFF", 0)]),
                           start: CGPoint(x: 512, y: 924), end: CGPoint(x: 512, y: 640), options: [.drawsBeforeStartLocation])
    ctx.restoreGState()

    if !fullBleed {
        ctx.addPath(bodyPath); ctx.setStrokeColor(hex("#FFFFFF", 0.12)); ctx.setLineWidth(3); ctx.strokePath()
    } else {
        // keep the drawing inside the middle of the square, where phones never crop
        ctx.translateBy(x: 512, y: 512); ctx.scaleBy(x: 0.8, y: 0.8); ctx.translateBy(x: -512, y: -512)
    }
}

func beamIn(_ ctx: CGContext) {
    ctx.saveGState()
    ctx.setShadow(offset: .zero, blur: 26, color: hex("#FFFFFF", 0.9))
    ctx.setStrokeColor(hex("#FFFFFF")); ctx.setLineWidth(18); ctx.setLineCap(.round)
    ctx.move(to: CGPoint(x: 180, y: 700)); ctx.addLine(to: entry); ctx.strokePath()
    ctx.restoreGState()
}

// Continuous fan of color bands from the exit point to the right edge.
func fan(_ ctx: CGContext, colors: [String], top: CGFloat, bottom: CGFloat, alpha: CGFloat, glow: CGFloat) {
    let x: CGFloat = 868
    let band = (top - bottom) / CGFloat(colors.count)
    ctx.saveGState()
    ctx.addPath(bodyPath); ctx.clip()
    for (i, c) in colors.enumerated() {
        let y1 = top - band * CGFloat(i)
        let y2 = y1 - band
        let path = CGMutablePath()
        path.move(to: exit); path.addLine(to: CGPoint(x: x, y: y1)); path.addLine(to: CGPoint(x: x, y: y2)); path.closeSubpath()
        ctx.saveGState()
        ctx.setShadow(offset: .zero, blur: glow, color: hex(c, 0.85))
        ctx.addPath(path)
        ctx.setFillColor(hex(c, alpha)); ctx.fillPath()
        ctx.restoreGState()
    }
    // fade the far ends a little
    ctx.restoreGState()
}

func facets(_ ctx: CGContext, light: CGFloat, mid: CGFloat, dark: CGFloat, lines: CGFloat) {
    let shades: [(CGPath, CGColor)] = [
        (triangle(A, B, G), hex("#FFFFFF", light)),
        (triangle(B, C, G), hex("#000000", mid)),
        (triangle(C, A, G), hex("#000000", dark)),
    ]
    for (p, c) in shades { ctx.addPath(p); ctx.setFillColor(c); ctx.fillPath() }
    ctx.setStrokeColor(hex("#FFFFFF", lines)); ctx.setLineWidth(5); ctx.setLineCap(.round)
    for v in [A, B, C] { ctx.move(to: G); ctx.addLine(to: v) }
    ctx.strokePath()
}

func prismEdges(_ ctx: CGContext, width: CGFloat, alpha: CGFloat) {
    ctx.saveGState()
    ctx.setShadow(offset: .zero, blur: 22, color: hex("#FFFFFF", 0.45))
    ctx.addPath(prism)
    ctx.setStrokeColor(hex("#FFFFFF", alpha)); ctx.setLineWidth(width); ctx.setLineJoin(.round)
    ctx.strokePath()
    ctx.restoreGState()
}

// ---------- PrismAPP ----------
func drawApp(_ ctx: CGContext) {
    background(ctx, glows: [
        (CGPoint(x: 760, y: 520), 420, hex("#00F5A0", 0.16)),
        (CGPoint(x: 300, y: 800), 380, hex("#3D8BFF", 0.14)),
    ])
    beamIn(ctx)
    fan(ctx, colors: ["#00F5A0", "#3D8BFF", "#A855F7"], top: 560, bottom: 300, alpha: 0.95, glow: 30)

    // glass body: cool steel-blue glass with three facets
    ctx.saveGState()
    ctx.setShadow(offset: .zero, blur: 50, color: hex("#3D8BFF", 0.55))
    ctx.addPath(prism); ctx.setFillColor(hex("#0E1622")); ctx.fillPath()
    ctx.restoreGState()
    ctx.saveGState()
    ctx.addPath(prism); ctx.clip()
    ctx.drawLinearGradient(gradient([hex("#DCE8FF", 0.55), hex("#5B7BB0", 0.45), hex("#1B2A44", 0.6)], [0, 0.5, 1]),
                           start: A, end: CGPoint(x: (B.x + C.x) / 2, y: B.y), options: [])
    facets(ctx, light: 0.22, mid: 0.10, dark: 0.32, lines: 0.45)
    // inner light path
    ctx.setShadow(offset: .zero, blur: 18, color: hex("#FFFFFF", 0.8))
    ctx.setStrokeColor(hex("#FFFFFF", 0.75)); ctx.setLineWidth(12); ctx.setLineCap(.round)
    ctx.move(to: entry); ctx.addLine(to: exit); ctx.strokePath()
    ctx.restoreGState()

    prismEdges(ctx, width: 18, alpha: 0.96)
}

// ---------- PrismAdmin ----------
let rainbow = ["#FF3B5C", "#FF7A00", "#FFD23F", "#7CF03A", "#00F5A0", "#22D3EE", "#3D8BFF", "#A855F7"]
func drawAdmin(_ ctx: CGContext) {
    background(ctx, glows: [
        (CGPoint(x: 800, y: 540), 460, hex("#A855F7", 0.22)),
        (CGPoint(x: 230, y: 820), 420, hex("#FF4D8D", 0.18)),
        (CGPoint(x: 260, y: 200), 380, hex("#22D3EE", 0.14)),
        (CGPoint(x: 780, y: 180), 340, hex("#FF9F00", 0.12)),
    ])
    beamIn(ctx)
    fan(ctx, colors: rainbow, top: 640, bottom: 200, alpha: 1, glow: 36)

    // rainbow glass body
    ctx.saveGState()
    ctx.setShadow(offset: .zero, blur: 60, color: hex("#A855F7", 0.7))
    ctx.addPath(prism); ctx.setFillColor(hex("#0A0F18")); ctx.fillPath()
    ctx.restoreGState()
    ctx.saveGState()
    ctx.addPath(prism); ctx.clip()
    ctx.drawLinearGradient(gradient(rainbow.map { hex($0) }),
                           start: CGPoint(x: B.x - 20, y: B.y - 20), end: CGPoint(x: C.x + 10, y: A.y + 10), options: [])
    facets(ctx, light: 0.26, mid: 0.14, dark: 0.30, lines: 0.5)
    // inner light path
    ctx.setShadow(offset: .zero, blur: 16, color: hex("#FFFFFF", 0.9))
    ctx.setStrokeColor(hex("#FFFFFF", 0.8)); ctx.setLineWidth(10)
    ctx.move(to: entry); ctx.addLine(to: exit); ctx.strokePath()
    ctx.restoreGState()

    prismEdges(ctx, width: 18, alpha: 0.98)
}
let args = CommandLine.arguments
render(args[1], drawApp)
render(args[2], drawAdmin)
if args.count >= 5 {
    fullBleed = true
    render(args[3], drawApp)
    render(args[4], drawAdmin)
}
print("icons drawn")
