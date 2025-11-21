function sanitizeFilename(filename) {
    return filename.replace(/[\/:*?"<>|\n]/g, "-").replace(/\s+/g, " ").trim();
}

async function getPaperTitleFromArxiv(arxivId) {
    console.log(`Retrieving paper title from arXiv by ID ${arxivId}...`);
    const url = `https://export.arxiv.org/api/query?id_list=${arxivId}`;
    
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.onload = function() {
            if (xhr.status === 200) {
                try {
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(xhr.responseText, "text/xml");
                    const titleElement = xmlDoc.querySelector("entry > title");
                    if (!titleElement) {
                        console.error(`The arXiv ID ${arxivId} is not valid, please confirm...`);
                        resolve(null);
                        return;
                    }
                    const title = titleElement.textContent.trim();
                    console.log(`Paper title retrieved:\n\t<${title}>`);
                    resolve(title);
                } catch (error) {
                    console.error(`Error parsing response for arXiv ID ${arxivId}:`, error);
                    resolve(null);
                }
            } else {
                console.error(`The arXiv ID ${arxivId} is not valid, HTTP status: ${xhr.status}`);
                resolve(null);
            }
        };
        xhr.onerror = function() {
            console.error(`Network error while fetching arXiv ID ${arxivId}`);
            resolve(null);
        };
        xhr.send();
    });
}

async function downloadPdf(arxivLink, downloadFolder, filenamePattern = "{arxiv_id} - {title}") {
    const arxivId = arxivLink.split('/').pop();
    console.log('arxivId:', arxivId);
    
    const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
    console.log('pdfUrl:', pdfUrl);
    
    const title = await getPaperTitleFromArxiv(arxivId);
    console.log('title:', title);
    
    if (!title) return;
    const cleanTitle = sanitizeFilename(title);
    const fileName = filenamePattern
        .replace("{arxiv_id}", arxivId)
        .replace("{title}", cleanTitle);

    try {
        console.log("Initiating PDF download...");
        if (!chrome.downloads) {
            throw new Error("Chrome downloads API not available. Check extension permissions.");
        }
        
        console.log(`Using filename pattern: ${filenamePattern}`);
        console.log(`Final filename: ${fileName}.pdf`);
        
        chrome.downloads.download({
            url: pdfUrl,
            filename: `${fileName}.pdf`,
            saveAs: false
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.error("Download failed:", chrome.runtime.lastError);
                alert(`Download failed: ${chrome.runtime.lastError.message}`);
                return;
            }
            console.log(`PDF download started with ID: ${downloadId}`);
        });
    } catch (error) {
        console.error("Error during download:", error);
        alert(`Error during download: ${error.message}`);
    }
}

async function extractArxivIds(input) {
    // If input is a arxiv.org link
    if (input.includes("arxiv.org") && /\d+\.\d+(?:v\d+)?/.test(input)) {
        const arxivId = input.match(/\d+\.\d+(?:v\d+)?/)[0];
        return [arxivId];
    }

    // If input is a direct arXiv ID
    const matches = input.match(/\d+\.\d+(?:v\d+)?/);
    if (matches) {
        return [matches[0]];
    }
    
    // If input is a URL (including local files)
    if (input.startsWith("http") || input.startsWith("file:///")) {
        // For non-arXiv URLs, fetch and parse content
        try {
            return await fetchFromActiveTab();
        } catch (error) {
            console.error("Error fetching URL:", error);
            return [];
        }
    }
    
    return [];
}


async function fetchFromActiveTab() {
    return new Promise(async (resolve) => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            console.log('Current tab:', tab);
            // Check if current page is a PDF
            const isPdf = tab.url.toLowerCase().endsWith('.pdf') || 
                         tab.url.toLowerCase().includes('arxiv.org/pdf/') ||
                         (tab.contentType && tab.contentType.toLowerCase() === 'application/pdf');
            console.log('Processing tab:', {
                url: tab.url,
                isPdf: isPdf,
                contentType: tab.contentType || 'unknown'
            });
            
            if (isPdf) {
                console.log('Trying to extract from PDF');
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: async () => {
                        console.log('Attempting to extract text content from PDF viewer...');
                        
                        // Define the getPdfContent function within the execution context
                        async function getPdfContent() {
                            const pdfViewer = document.querySelector('.textLayer');
                            if (pdfViewer) {
                                return pdfViewer.textContent;
                            }
                            
                            const alternativeSelectors = [
                                '#viewer', 
                                '.pdfViewer', 
                                '#viewerContainer' 
                            ];
                            
                            for (const selector of alternativeSelectors) {
                                const element = document.querySelector(selector);
                                if (element) {
                                    return element.textContent;
                                }
                            }
                            return null;
                        }

                        // Call the function and return the content
                        const content = await getPdfContent();
                        console.log('PDF content retrieved:', {
                            found: !!content,
                            length: content?.length,
                            preview: content?.substring(0, 200)
                        });
                        // inline arxiv pattern processing function
                        const arxivPattern = /(?:arxiv\.org\/(?:\w+)\/|arxiv:[\s]*)(\d+\.\d+(?:v\d+)?)/gi;
                        const matches = [...content.matchAll(arxivPattern)];
                        return [...new Set(matches.map(match => match[1]))];
                    }
                });
                resolve(results[0].result || []);
                return;
            }
            
            // For regular web pages
            // Log tab info before processing
            console.log('Processing regular webpage:', {
                url: tab.url,
                title: tab.title
            });
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    console.log('Executing script to parse arXiv IDs from content...');
                    const content = document.documentElement.innerHTML;
                    // inline arxiv pattern processing function
                    const arxivPattern = /(?:arxiv\.org\/(?:\w+)\/|arxiv:[\s]*)(\d+\.\d+(?:v\d+)?)/gi;
                    const matches = [...content.matchAll(arxivPattern)];
                    return [...new Set(matches.map(match => match[1]))];
                }
            });
            resolve(results[0].result || []);
        } catch (error) {
            console.error('Error executing script:', error);
            resolve([]);
        }
    });
}

async function main(arxiv, folder = null, customFilenamePattern = null) {
    console.log('Input arxiv:', arxiv);

    const config = {
        settings: {
            defaultDownloadFolder: "Downloads",
            filenamePattern: customFilenamePattern || "{arxiv_id} - {title}"
        }
    };

    console.log('Config:', config);

    const downloadFolder = folder || config.settings.defaultDownloadFolder;
    const filenamePattern = customFilenamePattern || "{arxiv_id} - {title}";

    let arxivIds;
    if (arxiv.includes("arxiv.org")) {
        const matches = arxiv.match(/(\d+\.\d+(?:v\d+)?)/);
        console.log('URL matches:', matches);
        arxivIds = matches ? [matches[1]] : [];
    } else if (arxiv.startsWith("http")) {
        const extractedIds = await extractArxivIds(arxiv);
        console.log('Extracted IDs:', extractedIds);
        arxivIds = extractedIds;
    } else {
        arxivIds = arxiv.split(/[, ]+/).filter(id => /^\d+\.\d+(?:v\d+)?$/.test(id));
    }

    console.log('Final arxivIds:', arxivIds);

    if (arxivIds.length === 0) {
        console.error("No valid arXiv IDs found");
        return;
    }

    for (const arxivId of arxivIds) {
        console.log(`Downloading PDF for arXiv ID: ${arxivId}`);
        console.log(`Using filename pattern: ${filenamePattern}`);
        await downloadPdf(`https://arxiv.org/abs/${arxivId}`, downloadFolder, filenamePattern);
    }
}