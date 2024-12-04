# epi-embedding-maps-viewer

## This is just a small page to view [Epi's Embedding Maps](https://civitai.com/articles/8977)

This is a simplified version of viewing **Epi's Embedding Maps**.  
The main reason for creating this page was the removal of old maps from threads and the desire to have a less laggy interface for viewing these maps.  

Creator of the original maps — [epiTune](https://civitai.com/user/epiTune).

Last update: **`4.12.24`**

## How to use?

1. Open the page at the link [epi-embedding-maps-viewer](https://dangarte.github.io/epi-embedding-maps-viewer/)
2. Select a map
3. Done

### 🏠 Offline mode

1. Open the page as usual and press `Ctrl + S` to download it. The browser will handle what needs to be saved.  
2. In offline mode, the map index loading is disabled (because of CORS), so you need to download the maps manually:  
   1. Open the [`/data`](https://github.com/Dangarte/epi-embedding-maps-viewer/tree/main/data) folder in this repository and download any maps you need.  
   2. Drag the map onto the `.html` file you downloaded in the first step to view it in the browser.  
3. Don't forget to redownload the viewing page after a new update is released.
4. Done

## ⚠ Important

1. The file `v0-artists-8192.json` is too big (132MB) for GitHub (<100MB), so it was uploaded separately to Google Drive: [v0-artists-8192.json](https://drive.usercontent.google.com/download?id=1S3P8qu8fByQ1XMa6afyDW46oxxaa6_a1)
   - This is the original version, in the index there is a version with pictures converted to webp (63 quality) to compress the file to the 100 MB limit.
   - If you want to use this file, download it and drag it to the viewing page.

## Demo

TODO Insert video here

## Keyboard shortcuts

1. `Ctrl + F` — Focus on the search field  
2. `Ctrl + Click` — Activate a button without animation, if possible  
3. `Shift + Click` — Activate a button in reverse, if possible (e.g., a button to navigate to the previous search result)  

## Changelog

<details>
    <summary>List of changes</summary>
    <ul>
        <li>
            <h4>Update <code>4.12.24</code></h4>
            <ul>
                <li>Touchscreen support</li>
                <li>Minor fixes and optimizations</li>
            </ul>
        </li>
    </ul>
</details>
