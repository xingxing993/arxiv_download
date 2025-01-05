chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchUrl") {
        fetch(request.url)
            .then(response => response.text())
            .then(content => {
                sendResponse({ content: content });
            })
            .catch(error => {
                console.error('Error:', error);
                sendResponse({ error: error.message });
            });
        return true; // Will respond asynchronously
    }
});