function sanitizeFilename(filename) {
    return filename.replace(/[\/:*?"<>|\n]/g, "-").replace(/\s+/g, " ").trim();
}

async function getPaperTitleFromArxiv(arxivId, proxies = null) {
    console.log(`Retrieving paper title from arXiv by ID ${arxivId}...`);
    const url = `http://export.arxiv.org/api/query?id_list=${arxivId}`;
    const response = await fetch(url, { method: 'GET', ...proxies });
    if (!response.ok) {
        console.error(`The arXiv ID ${arxivId} is not valid, please confirm...`);
        return null;
    }
    const text = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");
    const titleElement = xmlDoc.querySelector("entry > title");
    if (!titleElement) {
        console.error(`The arXiv ID ${arxivId} is not valid, please confirm...`);
        return null;
    }
    const title = titleElement.textContent.trim();
    console.log(`Paper title retrieved:\n\t<${title}>`);
    return title;
}

async function downloadPdf(arxivLink, downloadFolder, proxies = null, filenamePattern = "{arxiv_id} - {title}") {
    const arxivId = arxivLink.split('/').pop();
    console.log('arxivId:', arxivId);
    
    const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
    console.log('pdfUrl:', pdfUrl);
    
    const title = await getPaperTitleFromArxiv(arxivId, proxies);
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

async function extractArxivIdsFromUrl(weburl) {
    try {
        const response = await fetch(weburl, {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }
        });
        
        if (!response.ok) {
            console.error(`Failed to fetch page: ${response.status}`);
            return "";
        }
        
        const text = await response.text();
        // Updated pattern to handle more URL formats
        const arxivPattern = /(?:arxiv\.org\/(?:abs|pdf)\/|arxiv:\s*)(\d+\.\d+(?:v\d+)?)/gi;
        const arxivIds = new Set([...text.matchAll(arxivPattern)].map(match => match[1]));
        
        if (arxivIds.size > 0) {
            const arxivIdsStr = Array.from(arxivIds).join(', ');
            console.log(`ArXiv ID(s) found in the page: ${arxivIdsStr}`);
            return arxivIdsStr;
        } else {
            console.error("No ArXiv ID found in the page.");
            return "";
        }
    } catch (error) {
        console.error("Error fetching URL:", error);
        // If CORS fails, we might need to use the background script
        console.log("Attempting to fetch through background script...");
        return await fetchThroughBackground(weburl);
    }
}

// Add this new function to handle fetching through the background script
async function fetchThroughBackground(url) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            { action: "fetchUrl", url: url },
            response => {
                if (response && response.content) {
                    const arxivPattern = /(?:arxiv\.org\/(?:abs|pdf)\/|arxiv:\s*)(\d+\.\d+(?:v\d+)?)/gi;
                    const arxivIds = new Set([...response.content.matchAll(arxivPattern)].map(match => match[1]));
                    if (arxivIds.size > 0) {
                        resolve(Array.from(arxivIds).join(', '));
                    } else {
                        resolve("");
                    }
                } else {
                    resolve("");
                }
            }
        );
    });
}

async function main(arxiv, folder = null, customFilenamePattern = null) {
    console.log('Input arxiv:', arxiv);

    const config = {
        proxies: {
            http: null,
            https: null
        },
        settings: {
            defaultDownloadFolder: "Downloads",
            filenamePattern: customFilenamePattern || "{arxiv_id} - {title}"
        }
    };

    console.log('Config:', config);

    const proxies = config.proxies;
    const downloadFolder = folder || config.settings.defaultDownloadFolder;
    const filenamePattern = customFilenamePattern || "{arxiv_id} - {title}";

    let arxivIds;
    if (arxiv.includes("arxiv.org")) {
        const matches = arxiv.match(/(\d+\.\d+(?:v\d+)?)/);
        console.log('URL matches:', matches);
        arxivIds = matches ? [matches[1]] : [];
    } else if (arxiv.startsWith("http")) {
        const extractedIds = await extractArxivIdsFromUrl(arxiv);
        console.log('Extracted IDs string:', extractedIds);
        arxivIds = extractedIds.split(', ').filter(id => id);
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
        await downloadPdf(`https://arxiv.org/abs/${arxivId}`, downloadFolder, proxies, filenamePattern);
    }
}