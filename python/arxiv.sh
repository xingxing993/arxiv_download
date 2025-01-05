#!/bin/bash

# Download arXiv paper(s) by arXiv ID(s), Linux version
# Usage: arxiv.sh <arxiv_id>
# Example: arxiv.sh 2001.00001, 2001.00002
python3 "$(dirname "$0")/arxiv_download.py" --arxiv "$@"