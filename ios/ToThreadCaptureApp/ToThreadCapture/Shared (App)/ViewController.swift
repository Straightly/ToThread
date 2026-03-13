//
//  ViewController.swift
//  Shared (App)
//
//  Created by Zhi An on 3/7/26.
//

import WebKit
import Security
import AuthenticationServices
import CryptoKit

#if os(iOS)
import UIKit
import SafariServices
typealias PlatformViewController = UIViewController
#elseif os(macOS)
import Cocoa
import SafariServices
typealias PlatformViewController = NSViewController
#endif

let extensionBundleIdentifier = "com.zhian.tothread.capture.Extension"
let googleClientId = "130905058858-07408ql1m1nonfoaftc415t0er256n5v.apps.googleusercontent.com"
let googleIosClientId = "130905058858-bnb68ubnn1v0af5hm7idva5ilr2pgtvk.apps.googleusercontent.com"
let googleReversedClientId = "com.googleusercontent.apps.130905058858-bnb68ubnn1v0af5hm7idva5ilr2pgtvk"
let keychainService = "com.zhian.tothread.ios"
let keychainAccount = "google_id_token"

class ViewController: PlatformViewController, WKNavigationDelegate, WKScriptMessageHandler, WKUIDelegate {

    @IBOutlet var webView: WKWebView!
    var safariViewController: SFSafariViewController?
#if os(iOS)
    private var authSession: ASWebAuthenticationSession?
    private var currentCodeVerifier: String?
#endif

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self
        self.webView.uiDelegate = self

#if os(iOS)
        self.webView.scrollView.isScrollEnabled = false
#endif

        self.webView.configuration.userContentController.add(self, name: "controller")
        
        // Add message handler for plan API calls
        self.webView.configuration.userContentController.add(self, name: "oauthHandler")

        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

#if os(iOS)
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            completionHandler()
        })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in
            completionHandler(false)
        })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            completionHandler(true)
        })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { textField in
            textField.text = defaultText
        }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in
            completionHandler(nil)
        })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            let value = alert.textFields?.first?.text
            completionHandler(value)
        })
        present(alert, animated: true)
    }
#endif

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
#if os(iOS)
        webView.evaluateJavaScript("show('ios')")
        
        // Pass stored token to JS if available
        if let token = loadTokenFromKeychain() {
            webView.evaluateJavaScript("setStoredToken('\(token)')")
        }
#elseif os(macOS)
        webView.evaluateJavaScript("show('mac')")

        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { (state, error) in
            guard let state = state, error == nil else {
                // Insert code to inform the user that something went wrong.
                return
            }

            DispatchQueue.main.async {
                if #available(macOS 13, *) {
                    webView.evaluateJavaScript("show('mac', \(state.isEnabled), true)")
                } else {
                    webView.evaluateJavaScript("show('mac', \(state.isEnabled), false)")
                }
            }
        }
#endif
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "oauthHandler" {
            handleOAuthMessage(message)
            return
        }

#if os(macOS)
        if (message.body as! String != "open-preferences") {
            return
        }

        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { error in
            guard error == nil else {
                // Insert code to inform the user that something went wrong.
                return
            }

            DispatchQueue.main.async {
                NSApp.terminate(self)
            }
        }
#endif
    }
    
    // MARK: - Google OAuth
    
    func handleOAuthMessage(_ message: WKScriptMessage) {
        guard let body = message.body as? String else { return }
        
        if body == "startGoogleLogin" {
            startGoogleOAuthFlow()
        } else if body == "getStoredToken" {
            if let token = loadTokenFromKeychain() {
                webView.evaluateJavaScript("onTokenRetrieved('\(token)')")
            } else {
                webView.evaluateJavaScript("onTokenRetrieved(null)")
            }
        } else if body == "clearToken" {
            clearTokenFromKeychain()
            webView.evaluateJavaScript("onTokenCleared()")
        }
    }
    
#if os(iOS)
    func startGoogleOAuthFlow() {
        let redirectUri = "\(googleReversedClientId):/oauth2redirect"
        let codeVerifier = generateCodeVerifier()
        currentCodeVerifier = codeVerifier
        let codeChallenge = codeChallengeS256(from: codeVerifier)

        let authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" +
            "client_id=\(googleIosClientId)&" +
            "redirect_uri=\(redirectUri)&" +
            "response_type=code&" +
            "scope=openid%20email&" +
            "code_challenge=\(codeChallenge)&" +
            "code_challenge_method=S256"

        guard let url = URL(string: authUrl) else { return }

        authSession = ASWebAuthenticationSession(url: url, callbackURLScheme: googleReversedClientId) { callbackUrl, error in
            if let _ = error { return }
            guard let callbackUrl else { return }
            guard let code = Self.queryValue(from: callbackUrl, name: "code") else { return }
            self.exchangeCodeForToken(code: code, redirectUri: redirectUri)
        }
        authSession?.presentationContextProvider = self
        authSession?.start()
    }
    
    func generateNonce() -> String {
        let letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        return String((0..<32).map { _ in letters.randomElement()! })
    }

    func generateCodeVerifier() -> String {
        let letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~"
        return String((0..<64).map { _ in letters.randomElement()! })
    }

    func codeChallengeS256(from verifier: String) -> String {
        let data = Data(verifier.utf8)
        let digest = SHA256.hash(data: data)
        return base64UrlEncode(Data(digest))
    }

    func base64UrlEncode(_ data: Data) -> String {
        return data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    static func queryValue(from url: URL, name: String) -> String? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return nil
        }
        return components.queryItems?.first(where: { $0.name == name })?.value
    }

    func exchangeCodeForToken(code: String, redirectUri: String) {
        guard let verifier = currentCodeVerifier else { return }

        var request = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")

        let body = [
            "client_id=\(googleIosClientId)",
            "code=\(code)",
            "code_verifier=\(verifier)",
            "redirect_uri=\(redirectUri)",
            "grant_type=authorization_code"
        ].joined(separator: "&")

        request.httpBody = body.data(using: .utf8)

        URLSession.shared.dataTask(with: request) { data, _, _ in
            guard let data else { return }
            guard
                let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                let idToken = json["id_token"] as? String
            else { return }

            DispatchQueue.main.async {
                self.saveTokenToKeychain(idToken)
                self.webView.evaluateJavaScript("setStoredToken('\(idToken)')")
            }
        }.resume()
    }
#endif
    
    // MARK: - Keychain Storage
    
    func saveTokenToKeychain(_ token: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount,
            kSecValueData as String: token.data(using: .utf8)!
        ]
        
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }
    
    func loadTokenFromKeychain() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount,
            kSecReturnData as String: true
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        if status == errSecSuccess, let data = result as? Data {
            return String(data: data, encoding: .utf8)
        }
        return nil
    }
    
    func clearTokenFromKeychain() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount
        ]
        SecItemDelete(query as CFDictionary)
    }

}

#if os(iOS)
extension ViewController: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return view.window ?? UIWindow()
    }
}
#endif
