//
//  AppDelegate.swift
//  iOS (App)
//
//  Created by Zhi An on 3/7/26.
//

import UIKit
import SafariServices
import WebKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }
    
    // MARK: - URL Scheme Handling (OAuth Callback)
    
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Handle OAuth callback from Google
        if url.scheme == "tothread" && url.host == "oauth-callback" {
            if let fragment = url.fragment {
                // Parse the fragment to extract id_token
                let params = parseURLFragment(fragment)
                if let idToken = params["id_token"] {
                    // Pass the token to the view controller
                    if let window = self.window,
                       let sceneDelegate = UIApplication.shared.connectedScenes.first?.delegate as? SceneDelegate,
                       let navController = sceneDelegate.window?.rootViewController as? UINavigationController,
                       let viewController = navController.viewControllers.first as? ViewController {
                        // Store token and update UI
                        viewController.saveTokenToKeychain(idToken)
                        viewController.webView.evaluateJavaScript("setStoredToken('\(idToken)')")
                    } else if let navController = self.window?.rootViewController as? UINavigationController,
                              let viewController = navController.viewControllers.first as? ViewController {
                        viewController.saveTokenToKeychain(idToken)
                        viewController.webView.evaluateJavaScript("setStoredToken('\(idToken)')")
                    } else if let viewController = self.window?.rootViewController as? ViewController {
                        viewController.saveTokenToKeychain(idToken)
                        viewController.webView.evaluateJavaScript("setStoredToken('\(idToken)')")
                    }
                    
                    // Close the Safari view controller
                    if let rootVC = self.window?.rootViewController,
                       let presentedVC = rootVC.presentedViewController as? SFSafariViewController {
                        presentedVC.dismiss(animated: true)
                    }
                    return true
                }
            }
        }
        return false
    }
    
    private func parseURLFragment(_ fragment: String) -> [String: String] {
        var params: [String: String] = [:]
        for param in fragment.split(separator: "&") {
            let parts = param.split(separator: "=")
            if parts.count == 2 {
                let key = String(parts[0])
                let value = String(parts[1]).removingPercentEncoding ?? String(parts[1])
                params[key] = value
            }
        }
        return params
    }

}
