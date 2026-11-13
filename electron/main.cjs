const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Notification,
} = require("electron");
const path = require("node:path");
const { Store } = require("./store.cjs");
let win, store;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    win?.show();
    win?.focus();
  });
  app
    .whenReady()
    .then(async () => {
      store = new Store(app.getPath("userData"));
      await store.init();
      const handlers = {
        config: () => store.config,
        chooseVault: async () => {
          const result = await dialog.showOpenDialog(win, {
            properties: ["openDirectory"],
          });
          return result.canceled
            ? null
            : { ...store.config, vault: result.filePaths[0] };
        },
        saveConfig: (input) => store.save(input),
        log: (input) => store.log(input),
        notify: () => {
          if (Notification.isSupported())
            new Notification({
              title: "Pomodoro Logs",
              body: "Your interval is complete. Take a breath.",
            }).show();
        },
      };
      for (const [name, fn] of Object.entries(handlers))
        ipcMain.handle(name, (event, input) => {
          if (
            event.sender !== win?.webContents ||
            event.senderFrame !== win.webContents.mainFrame
          )
            throw Error("Untrusted request");
          return fn(input);
        });
      function create() {
        win = new BrowserWindow({
          width: 760,
          height: 700,
          minWidth: 360,
          minHeight: 420,
          backgroundColor: "#f5f2eb",
          icon: path.join(__dirname, "../build/icon.png"),
          webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            backgroundThrottling: false,
          },
        });
        win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
        win.webContents.on("will-navigate", (e) => e.preventDefault());
        if (!app.isPackaged && process.env.PIXEL_DESK_DEV === "1")
          win.loadURL("http://127.0.0.1:5173");
        else win.loadFile(path.join(__dirname, "../dist/index.html"));
      }
      create();
      app.on("activate", () => {
        if (!BrowserWindow.getAllWindows().length) create();
      });
    })
    .catch((error) => {
      dialog.showErrorBox("Pomodoro Logs could not start", error.message);
      app.quit();
    });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
