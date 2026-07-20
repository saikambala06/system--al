// Background service worker for JobFill AI extension

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("JobFill AI extension installed");
});

// Keep service worker alive
chrome.runtime.onConnect.addListener((port) => {
  console.log("Connection established:", port.name);
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Future: handle cross-origin API calls here if needed
  sendResponse({ received: true });
  return true;
});
