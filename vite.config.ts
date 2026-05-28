import react from "@vitejs/plugin-react";
import { defineConfig, type PluginOption } from "vite";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

function manifestPlugin(): PluginOption {
  return {
    name: "emit-extension-manifest",
    buildStart() {
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: readFileSync(resolve(__dirname, "manifest.json"), "utf-8")
      });

      const assetsDir = resolve(__dirname, "assets");
      if (!existsSync(assetsDir)) {
        return;
      }

      for (const assetPath of listFiles(assetsDir)) {
        const relativeAssetPath = relative(assetsDir, assetPath).replaceAll("\\", "/");
        if (!shouldCopyExtensionAsset(relativeAssetPath)) {
          continue;
        }

        this.emitFile({
          type: "asset",
          fileName: `assets/${relativeAssetPath}`,
          source: readFileSync(assetPath)
        });
      }
    }
  };
}

function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = resolve(directory, entry);
    return statSync(fullPath).isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

function shouldCopyExtensionAsset(relativeAssetPath: string): boolean {
  if (relativeAssetPath.startsWith("store/")) {
    return false;
  }

  if (
    relativeAssetPath.endsWith(".md") ||
    relativeAssetPath === "icons/icon_source.svg" ||
    relativeAssetPath === "icons/store_icon_128.png"
  ) {
    return false;
  }

  return true;
}

export default defineConfig({
  plugins: [react(), manifestPlugin()],
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/popup.html"),
        library: resolve(__dirname, "src/library/library.html"),
        serviceWorker: resolve(__dirname, "src/background/serviceWorker.ts"),
        chessComContentScript: resolve(__dirname, "src/content/chessComContentScript.ts")
      },
      output: {
        entryFileNames(chunkInfo) {
          if (chunkInfo.name === "serviceWorker") {
            return "src/background/serviceWorker.js";
          }

          if (chunkInfo.name === "chessComContentScript") {
            return "src/content/chessComContentScript.js";
          }

          return "assets/[name].js";
        },
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  }
});
