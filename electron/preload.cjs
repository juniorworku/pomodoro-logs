const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "desk",
  Object.fromEntries(
    ["config", "chooseVault", "saveConfig", "log", "notify"].map((name) => [
      name,
      (data) => ipcRenderer.invoke(name, data),
    ]),
  ),
);
