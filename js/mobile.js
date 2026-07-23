document.documentElement.dataset.offlineReady = "checking";

function waitForActivation(worker) {
  if (!worker || worker.state === "activated") return Promise.resolve();
  return new Promise((resolve, reject) => {
    worker.addEventListener("statechange", () => {
      if (worker.state === "activated") resolve();
      if (worker.state === "redundant") reject(new Error("Offline worker was replaced"));
    });
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js?v=19", { scope: "./" });
      await waitForActivation(registration.installing || registration.waiting);
      const readyRegistration = await navigator.serviceWorker.ready;
      const activeWorker = registration.active || readyRegistration.active;
      document.documentElement.dataset.offlineReady = activeWorker ? "true" : "false";
      document.documentElement.dataset.offlineVersion = activeWorker
        ? new URL(activeWorker.scriptURL).searchParams.get("v") || "legacy"
        : "none";
    } catch (error) {
      document.documentElement.dataset.offlineReady = "false";
      console.error("Unable to enable offline play", error);
    }
  });
} else {
  document.documentElement.dataset.offlineReady = "unsupported";
}
