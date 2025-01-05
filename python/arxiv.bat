@echo off
@REM Download arXiv paper(s) by arXiv ID(s), Windows version
@REM Put this file under the same directory as arxiv_download.py
@REM , and add the directory to the PATH environment variable.
@REM Usage: arxiv.bat <arxiv_id>
python "%~dp0arxiv_download.py" --arxiv %*
