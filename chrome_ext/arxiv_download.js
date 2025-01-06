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

async function extractArxivIds(input) {
    // If input is a direct arXiv ID
    if (/^\d+\.\d+(?:v\d+)?$/.test(input)) {
        return [input];
    }
    
    // If input is an arXiv URL
    if (input.includes("arxiv.org")) {
        const matches = input.match(/(\d+\.\d+(?:v\d+)?)/);
        return matches ? [matches[1]] : [];
    }
    
    // If input is a webpage URL
    if (input.startsWith("http")) {
        // For non-arXiv URLs, we need to use the activeTab permission
        if (!input.includes('arxiv.org')) {
            try {
                // Use the background script to get the page content
                return await fetchThroughBackground(input);
            } catch (error) {
                console.error("Error fetching URL:", error);
                return [];
            }
        }
        
        // For arXiv URLs, proceed as normal
        try {
            const response = await fetch(input);
            const arxivPattern = /(?:arxiv\.org\/(?:abs|pdf)\/|arxiv:\s*)(\d+\.\d+(?:v\d+)?)/gi;
            const arxivIds = [...new Set([...response.text().matchAll(arxivPattern)].map(match => match[1]))];
            
            if (arxivIds.length > 0) {
                console.log(`ArXiv ID(s) found in the page:`, arxivIds);
                return arxivIds;
            } else {
                console.error("No ArXiv ID found in the page.");
                return [];
            }
        } catch (error) {
            console.error("Error fetching arXiv URL:", error);
            return [];
        }
    }
    
    return [];
}

// Modify fetchThroughBackground to return array instead of string
async function fetchThroughBackground(url) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            { action: "fetchUrl", url: url },
            response => {
                if (response && response.content) {
                    const arxivPattern = /(?:arxiv\.org\/(?:abs|pdf)\/|arxiv:\s*)(\d+\.\d+(?:v\d+)?)/gi;
                    const arxivIds = [...new Set([...response.content.matchAll(arxivPattern)].map(match => match[1]))];
                    resolve(arxivIds.length > 0 ? arxivIds : []);
                } else {
                    resolve([]);
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
        await downloadPdf(`https://arxiv.org/abs/${arxivId}`, downloadFolder, proxies, filenamePattern);
    }
}