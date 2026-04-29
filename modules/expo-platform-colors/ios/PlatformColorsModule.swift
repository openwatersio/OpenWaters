import ExpoModulesCore
import UIKit

public final class PlatformColorsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoPlatformColors")

    Function("resolveSync") { (name: String, style: String) -> String in
      guard let color = Self.semanticColor(named: name) else {
        return "#000000"
      }
      let trait = UITraitCollection(userInterfaceStyle: style == "dark" ? .dark : .light)
      let resolved = color.resolvedColor(with: trait)
      return Self.hexString(from: resolved)
    }

    Function("setOverrideUserInterfaceStyle") { (style: String) in
      let uiStyle: UIUserInterfaceStyle
      switch style {
      case "dark": uiStyle = .dark
      case "light": uiStyle = .light
      default: uiStyle = .unspecified
      }
      DispatchQueue.main.async {
        UIApplication.shared.connectedScenes
          .compactMap { $0 as? UIWindowScene }
          .flatMap { $0.windows }
          .forEach { $0.overrideUserInterfaceStyle = uiStyle }
      }
    }
  }

  private static func hexString(from color: UIColor) -> String {
    var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
    color.getRed(&r, green: &g, blue: &b, alpha: &a)
    let ri = Int(round(max(0, min(1, r)) * 255))
    let gi = Int(round(max(0, min(1, g)) * 255))
    let bi = Int(round(max(0, min(1, b)) * 255))
    let ai = Int(round(max(0, min(1, a)) * 255))
    if ai < 255 {
      return String(format: "#%02X%02X%02X%02X", ri, gi, bi, ai)
    }
    return String(format: "#%02X%02X%02X", ri, gi, bi)
  }

  private static func semanticColor(named name: String) -> UIColor? {
    switch name {
    // System colors
    case "systemRed": return .systemRed
    case "systemGreen": return .systemGreen
    case "systemBlue": return .systemBlue
    case "systemOrange": return .systemOrange
    case "systemYellow": return .systemYellow
    case "systemPink": return .systemPink
    case "systemPurple": return .systemPurple
    case "systemTeal": return .systemTeal
    case "systemIndigo": return .systemIndigo
    case "systemBrown": return .systemBrown
    case "systemMint": return .systemMint
    case "systemCyan": return .systemCyan
    // Grays
    case "systemGray": return .systemGray
    case "systemGray2": return .systemGray2
    case "systemGray3": return .systemGray3
    case "systemGray4": return .systemGray4
    case "systemGray5": return .systemGray5
    case "systemGray6": return .systemGray6
    // Labels
    case "label": return .label
    case "secondaryLabel": return .secondaryLabel
    case "tertiaryLabel": return .tertiaryLabel
    case "quaternaryLabel": return .quaternaryLabel
    case "placeholderText": return .placeholderText
    // Backgrounds
    case "systemBackground": return .systemBackground
    case "secondarySystemBackground": return .secondarySystemBackground
    case "tertiarySystemBackground": return .tertiarySystemBackground
    case "systemGroupedBackground": return .systemGroupedBackground
    case "secondarySystemGroupedBackground": return .secondarySystemGroupedBackground
    case "tertiarySystemGroupedBackground": return .tertiarySystemGroupedBackground
    // Fills
    case "systemFill": return .systemFill
    case "secondarySystemFill": return .secondarySystemFill
    case "tertiarySystemFill": return .tertiarySystemFill
    case "quaternarySystemFill": return .quaternarySystemFill
    // Separators & links
    case "separator": return .separator
    case "opaqueSeparator": return .opaqueSeparator
    case "link": return .link
    default: return nil
    }
  }
}
