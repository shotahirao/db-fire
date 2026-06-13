import { useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { useSettingsStore } from "../stores/settingsStore";

export function useUpdater() {
  const autoUpdateEnabled = useSettingsStore((state) => state.autoUpdateEnabled);

  useEffect(() => {
    if (!autoUpdateEnabled) {
      console.log("Automatic updates are disabled.");
      return;
    }

    const setupUpdater = async () => {
      try {
        const update = await check();

        if (update) {
          console.log(`Update available: ${update.version}`);

          await update.downloadAndInstall((progress) => {
            console.log("Download progress", progress);
          });

          console.log("Update installed. Please restart the application.");
        }
      } catch (error) {
        console.error("Failed to check for updates:", error);
      }
    };

    setupUpdater();
  }, [autoUpdateEnabled]);
}
