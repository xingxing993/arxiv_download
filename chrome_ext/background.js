chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchUrl") {
        // Use the activeTab permission to execute script in the current tab
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            try {
                const [tab] = tabs;
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => document.documentElement.innerHTML
                });
                sendResponse({ content: results[0].result });
            } catch (error) {
                console.error('Error in background script:', error);
                sendResponse({ content: null });
            }
        });
        return true;
    }
});