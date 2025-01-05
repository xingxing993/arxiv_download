document.addEventListener('DOMContentLoaded', async function() {
    const downloadButton = document.getElementById('downloadButton');
    const arxivInput = document.getElementById('arxivInput');
    const filenamePattern = document.getElementById('filenamePattern');

    // Get the current tab URL and process it immediately
    chrome.tabs.query({ active: true, currentWindow: true }, async function(tabs) {
        const currentTab = tabs[0];
        arxivInput.value = currentTab.url;
        await processInput(currentTab.url);
    });

    downloadButton.addEventListener('click', async () => {
        const selectedIds = getSelectedIds();
        if (selectedIds.length > 0) {
            for (const id of selectedIds) {
                await main(id, null, filenamePattern.value);
            }
        }
    });

    arxivInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            const input = arxivInput.value.trim();
            if (input) {
                await processInput(input);
            }
        }
    });

    // Add input change handler to reprocess IDs when URL is modified
    arxivInput.addEventListener('change', async () => {
        const input = arxivInput.value.trim();
        if (input) {
            await processInput(input);
        }
    });
});

async function displayExtractedIds(ids) {
    const extractedIdsSection = document.getElementById('extractedIdsSection');
    const extractedIdsContainer = document.getElementById('extractedIds');
    
    // Always show the section, but with different content based on state
    extractedIdsSection.style.display = 'block';
    
    if (ids === null) {
        // Show loading state
        extractedIdsContainer.innerHTML = '<div class="loading-text">Extracting arXiv IDs...</div>';
        return;
    }
    
    if (ids && ids.length > 0) {
        // Show loading state while fetching titles
        extractedIdsContainer.innerHTML = '<div class="loading-text">Fetching paper titles...</div>';
        
        // Fetch titles for all IDs
        const idTitles = await Promise.all(ids.map(async (id) => {
            const title = await getPaperTitleFromArxiv(id);
            return { id, title };
        }));
        
        extractedIdsContainer.innerHTML = `
            <div style="margin-bottom: 10px;">
                <label>
                    <input type="checkbox" id="selectAll" checked>
                    Select All
                </label>
            </div>
            ${idTitles.map(({id, title}) => `
                <div>
                    <label>
                        <input type="checkbox" class="id-checkbox" value="${id}" checked>
                        ${id}${title ? `: ${title}` : ''}
                    </label>
                </div>
            `).join('')}
        `;

        // Add select all functionality
        const selectAllCheckbox = document.getElementById('selectAll');
        const idCheckboxes = document.querySelectorAll('.id-checkbox');

        selectAllCheckbox.addEventListener('change', (e) => {
            idCheckboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
            });
        });

        // Update "Select All" when individual checkboxes change
        idCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const allChecked = Array.from(idCheckboxes).every(cb => cb.checked);
                selectAllCheckbox.checked = allChecked;
            });
        });
    } else {
        // Hide the section if no IDs
        extractedIdsSection.style.display = 'none';
        extractedIdsContainer.innerHTML = '';
    }
}

function getSelectedIds() {
    const checkboxes = document.querySelectorAll('.id-checkbox:checked');
    return Array.from(checkboxes).map(checkbox => checkbox.value);
}

async function processInput(input) {
    // Show loading state
    displayExtractedIds(null);
    
    // Check if input is a comma-separated list of arXiv IDs
    if (!input.startsWith('http')) {
        const potentialIds = input.split(/[, ]+/).filter(id => /^\d+\.\d+(?:v\d+)?$/.test(id));
        if (potentialIds.length > 0) {
            await displayExtractedIds(potentialIds);
            return;
        }
    }
    
    const ids = await extractArxivIds(input);
    await displayExtractedIds(ids);
}