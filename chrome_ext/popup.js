document.addEventListener('DOMContentLoaded', function() {
    const downloadButton = document.getElementById('downloadButton');
    const arxivInput = document.getElementById('arxivInput');
    const filenamePattern = document.getElementById('filenamePattern');

    // Get the current tab URL and set it as the default value
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const currentTab = tabs[0];
        arxivInput.value = currentTab.url;
    });

    downloadButton.addEventListener('click', async () => {
        const input = arxivInput.value.trim();
        if (input) {
            await main(input, null, filenamePattern.value);
        }
    });

    arxivInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            const input = arxivInput.value.trim();
            if (input) {
                await main(input, null, filenamePattern.value);
            }
        }
    });
});