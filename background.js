// Clicking the toolbar icon opens the side panel.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

// Right-click on highlighted text (e.g. an error message) -> "Ask FA Helper about this"
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ask-fa-helper",
    title: "Ask FA Helper about this",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "ask-fa-helper") return;
  // open() must run directly inside the user gesture, so call it before anything async.
  chrome.sidePanel.open({ windowId: tab.windowId });
  chrome.storage.session.set({ pendingQuestion: info.selectionText || "" });
});
