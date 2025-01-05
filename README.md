

## arXiv downloader

### (./chrome_ext) Chrome(-like) browser extension
Enable developer mode and load the folder to enable the extension.
The extension by default collect all arXiv IDs from current page, download papers and rename according to use specified pattern.
You can also manually specify the paper ID or link when necessary.




### (./python) Handy to download arXiv pdf files by ID(s) on command line

Download one paper
```
arxiv 1234.12345
```
Download multiple papers in one go
```
arxiv 1234.12345,4321.54321
```
Download with arXiv link
```
arxiv https://arxiv.org/abs/1234.12345
```
Collect arXiv links in the URL page, and download
```
arxiv https://mp.weixin.qq.com/s/1g__RdbcYAnO_eXiFHMl1g
```

Modify the arxiv.cfg file to change modifications, self-explanatory