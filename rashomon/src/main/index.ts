import fs from "node:fs";
import path from "node:path";

import { app, BrowserWindow, Menu, Tray, nativeImage } from "electron";

import { createDatabaseConnection } from "./db/connection";
import { createDomainManager } from "./engine/domain-manager";
import { createIntentAnalyzer } from "./engine/intent-analyzer";
import { createPolicyEngine } from "./engine/policy-engine";
import { createAgentDetector } from "./proxy/agent-detector";
import { createRequestInterceptor } from "./proxy/interceptor";
import { createProxyServer } from "./proxy/server";
import { setupIpcHandlers } from "./ipc/handlers";
import type { SettingsState } from "../shared/types";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let teardownIpc: (() => void) | null = null;

const database = createDatabaseConnection();
const policyEngine = createPolicyEngine();
const domainManager = createDomainManager(database, policyEngine);
const intentAnalyzer = createIntentAnalyzer();
const agentDetector = createAgentDetector(policyEngine);
const requestInterceptor = createRequestInterceptor(
  database,
  policyEngine,
  domainManager,
  undefined,
  undefined,
  intentAnalyzer,
  agentDetector,
);

let settings: SettingsState = {
  proxyPort: Number(process.env.RASHOMON_PROXY_PORT ?? 8888),
  dashboardPort: Number(process.env.RASHOMON_DASHBOARD_PORT ?? 9090),
  autoStart: false,
  notificationsEnabled: true,
  tlsInterceptionEnabled: false,
  intentProvider: intentAnalyzer.getConfig().provider,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
  intentModel: process.env.INTENT_MODEL ?? "claude-sonnet-4-5-20250929",
  intentThreshold: 30,
};

const proxyServer = createProxyServer(
  {
    port: settings.proxyPort,
    tlsInterceptionEnabled: settings.tlsInterceptionEnabled,
  },
  requestInterceptor,
);

function createPreloadScript(): string {
  const preloadPath = path.join(app.getPath("userData"), "preload.cjs");
  const source = `
    const { contextBridge, ipcRenderer } = require("electron");
    contextBridge.exposeInMainWorld("rashomon", {
      invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
      on: (channel, callback) => {
        const listener = (_event, payload) => callback(payload);
        ipcRenderer.on(channel, listener);
        return () => ipcRenderer.removeListener(channel, listener);
      }
    });
  `;
  fs.writeFileSync(preloadPath, source);
  return preloadPath;
}

async function createMainWindow(): Promise<BrowserWindow> {
  const preloadPath = createPreloadScript();
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    backgroundColor: "#080810",
    title: "Rashomon",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devServerUrl = process.env.RASHOMON_DEV_SERVER_URL;
  if (devServerUrl) {
    await window.loadURL(devServerUrl);
  } else {
    await window.loadFile(path.join(process.cwd(), "dist/renderer/index.html"));
  }

  window.on("close", (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      window.hide();
    }
  });

  return window;
}

function createTrayMenu(window: BrowserWindow): void {
  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip("Rashomon");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Show Dashboard",
        click: () => {
          window.show();
          window.focus();
        },
      },
      {
        label: "Pause Monitoring",
        click: () => {
          proxyServer.pause();
        },
      },
      {
        label: "Resume Monitoring",
        click: () => {
          proxyServer.resume();
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          app.isQuiting = true;
          void app.quit();
        },
      },
    ]),
  );

  tray.on("click", () => {
    if (window.isVisible()) {
      window.hide();
    } else {
      window.show();
      window.focus();
    }
  });
}

async function bootstrap(): Promise<void> {
  await policyEngine.loadPolicies();
  await proxyServer.start();
  mainWindow = await createMainWindow();
  createTrayMenu(mainWindow);

  teardownIpc = setupIpcHandlers({
    mainWindow,
    database,
    policyEngine,
    domainManager,
    proxyServer,
    agentDetector,
    intentAnalyzer,
    getSettings: () => ({ ...settings }),
    updateSettings: (nextSettings) => {
      settings = {
        ...settings,
        ...nextSettings,
      };
      return settings;
    },
    onTraffic: requestInterceptor.onTraffic,
  });

  agentDetector.watchProcesses(() => {
    // polling side-effect keeps the runtime agent snapshot fresh for the UI and policy engine
  });
}

app.whenReady().then(() => {
  void bootstrap();
});

app.on("window-all-closed", () => {
  // Rashomon stays resident in the tray until the user quits explicitly.
});

app.on("before-quit", async () => {
  app.isQuiting = true;
  teardownIpc?.();
  await proxyServer.stop();
  database.close();
});

declare global {
  namespace Electron {
    interface App {
      isQuiting?: boolean;
    }
  }
}
