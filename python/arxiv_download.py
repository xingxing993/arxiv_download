import os
import re
import requests
import xml.etree.ElementTree as ET
import argparse
from tqdm import tqdm
import configparser
from bs4 import BeautifulSoup

def sanitize_filename(filename):
    filename = re.sub(r'[\/:*?"<>|\n]', "-", filename)
    filename = re.sub(r'\s+', " ", filename)
    return filename.strip()

def get_paper_title_from_arxiv(arxiv_id, proxies=None):
    """Retrieve paper title from arXiv using the arXiv API."""
    print("Retrieving paper title from arXiv by ID \033[92m{}\033[0m...".format(arxiv_id))
    url = f"http://export.arxiv.org/api/query?id_list={arxiv_id}"
    response = requests.get(url, proxies=proxies)
    response.raise_for_status()  # Ensure we got a valid response
    
    # Parse the XML response
    root = ET.fromstring(response.content)
    # Find the title within the 'entry' element
    title_element = root.find(".//{http://www.w3.org/2005/Atom}entry/{http://www.w3.org/2005/Atom}title")
    if title_element is None:
        print("\033[91mThe arXiv ID {} is not valid, please confirm...\033[0m".format(arxiv_id))
        return None
    
    title = title_element.text.strip()
    print("Paper title retrieved:\n\t\033[92m<{}>\033[0m".format(title))
    return title

def download_pdf(arxiv_link=None, download_folder=None, proxies=None, filename_pattern="{arxiv_id} - {title}"):
    # Set default download folder to the user's Downloads directory if none is provided
    if not download_folder:
        download_folder = os.path.join(os.path.expanduser("~"), "Downloads")
    
    arxiv_id = arxiv_link.split('/')[-1]  # Extract the arXiv ID from the link
    pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"
    
    # Retrieve title for the filename from arXiv
    title = get_paper_title_from_arxiv(arxiv_id, proxies=proxies)
    if title is None:
        return
    clean_title = sanitize_filename(title)
    
    # Combine arXiv ID and title to form the filename
    file_name = filename_pattern.format(arxiv_id=arxiv_id, title=clean_title)
    
    # Full path for saving the file
    file_path = os.path.join(download_folder, f"{file_name}.pdf")

    try:
        # Download the PDF file
        print("Downloading PDF...")
        response = requests.get(pdf_url, stream=True, proxies=proxies)
        response.raise_for_status()  # Check if the request was successful

        # Get the total file size
        total_size = int(response.headers.get('content-length', 0))
        block_size = 1024  # 1 Kibibyte

        # Save the PDF to the specified file path with a progress bar
        with open(file_path, 'wb') as pdf_file, tqdm(
            total=total_size, unit='iB', unit_scale=True
        ) as progress_bar:
            for data in response.iter_content(block_size):
                progress_bar.update(len(data))
                pdf_file.write(data)

        print(f"PDF downloaded successfully: {file_path}")
    except requests.exceptions.RequestException as e:
        print(f"Failed to download PDF: {e}")


def extract_arxiv_ids_from_url(weburl):
    # Send a GET request to fetch the page content
    response = requests.get(weburl)

    # Check if the request was successful
    if response.status_code == 200:
        # Parse the HTML content of the page using BeautifulSoup
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Define a regular expression pattern for matching Arxiv IDs
        arxiv_pattern = re.compile(r'https?://arxiv\.org/\w+/(\d+\.\d+)', re.IGNORECASE)
        
        # Search for all links that match the Arxiv URL pattern
        arxiv_ids = set(re.findall(arxiv_pattern, soup.get_text()))

        if arxiv_ids:
            arxiv_ids_str = ', '.join(arxiv_ids)
            print(f"arXiv ID(s) found in the page: \033[92m{arxiv_ids_str}\033[0m")
            return arxiv_ids_str
        else:
            print("\033[91mNo arXiv ID found in the page.\033[0m")
            return ""
    else:
        print(f"\033[91mFailed to fetch page: {response.status_code}\033[0m")
        return ""



def main():
    parser = argparse.ArgumentParser(description="Download PDF from arXiv link(s) or ID(s) or web URL that contains arXiv link, use comma to separate multiple IDs")
    parser.add_argument("-a", "--arxiv", required=True, help="arXiv IDs (comma separated for multiple IDs), arxiv links, any web URL that contains arxiv links")
    parser.add_argument("-f", "--folder", default=None, help="Folder to save the downloaded PDF (default: Downloads folder)")


    args = parser.parse_args()

    # Load configurations from config file
    config = configparser.ConfigParser()
    config_path = os.path.join(os.path.dirname(__file__), 'arxiv.cfg')
    config.read(config_path)

    # Proxy settings
    proxies = {
        'http': config.get('Proxy', 'http', fallback=None),
        'https': config.get('Proxy', 'https', fallback=None)
    }
    
    # Default download folder
    if args.folder is None:
        args.folder = config.get('Settings', 'default_download_folder', fallback=os.path.join(os.path.expanduser("~"), "Downloads"))
    
    # Check if the arXiv argument is a arxiv link or a web URL
    if "arxiv.org" in args.arxiv:
        # Extract arXiv ID from the arXiv link
        arxiv_id = args.arxiv.split('/')[-1]
        args.arxiv = arxiv_id
    elif args.arxiv.startswith("http"):
        # Extract arXiv IDs from the web URL
        arxiv_ids = extract_arxiv_ids_from_url(args.arxiv)
        if not arxiv_ids:
            return
        args.arxiv = arxiv_ids
    else: # the argument must be a comma-separated list of arXiv IDs
        pass

    
    # Filename pattern
    filename_pattern = config.get('Settings', 'filename_pattern', fallback="{arxiv_id} - {title}")
    
    # Split the input arXiv IDs by comma or space
    arxiv_ids = re.split(r'[,\s]+', args.arxiv.strip())

    # Call download_pdf for each arXiv ID
    for arxiv_id in arxiv_ids:
        if len(arxiv_id) != 1:
            print(f"\033[93m[{arxiv_ids.index(arxiv_id)+1}/{len(arxiv_ids)}]\033[0m Downloading PDF for arXiv ID: \033[92m{arxiv_id}\033[0m")
        download_pdf(arxiv_link=f"https://arxiv.org/abs/{arxiv_id}", download_folder=args.folder, proxies=proxies, filename_pattern=filename_pattern)

if __name__ == "__main__":
    main()
