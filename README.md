# epi-embedding-maps-viewer

## This is just a small page to view [Epi's Embedding Maps](https://civitai.com/articles/8977)

This is a simplified version of viewing **Epi's Embedding Maps**.  
The main reason for creating this page was the removal of old maps from threads and the desire to have a less laggy interface for viewing these maps.

Creator of the original maps — [epiTune](https://civitai.com/user/epiTune).

Last update: **`6.12.24`**

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

### Spaces

![spaces.png](https://dangarte.github.io/epi-embedding-maps-viewer/demo/spaces.png)
In spaces you can:

- Search and go to result
- Select a random card
- Switch between UMAP
- Fix overlapping cards in 1 click

[spaces.webm](https://github.com/user-attachments/assets/a7b5a023-e682-4bbd-912d-3f177cc5c812)

## Keyboard shortcuts

1. `Ctrl + F` — Focus on the search field
2. `Ctrl + Click` (controls) — Activate a button without animation, if possible
3. `Ctrl + Click` (cards) — Copy title
4. Holding `Alt` (cards) — Possibility to select text in the title
5. `Shift + Click` — Activate a button in reverse, if possible (e.g., a button to navigate to the previous search result)

## Changelog

<details>
    <summary>List of changes</summary>
    <ul>
        <li>
            <h4>Update <code>6.12.24</code></h4>
            <ul>
                <li>Ability to select text on a card while holding <code>Alt</code></li>
                <li>Now when you click on a card (not the copy button) the text is copied only when <code>Ctrl</code> is pressed</li>
                <li>If you click on a graph card and it has connections, they will be displayed</li>
                <li>Tree view of graph</li>
            </ul>
        </li>
        <li>
            <h4>Update <code>5.12.24</code></h4>
            <ul>
                <li>Preview cards now have different sizes depending on their content (previously all cards had a limit of 2 lines of text)</li>
                <li>Because of the first point, the generation of preview images takes a little longer 😓</li>
                <li>Fixed display of data processing status</li>
                <li>Now you can drag and drop the graph json and it will be displayed (The dots will be in random places, without paths)</li>
            </ul>
        </li>
        <li>
            <h4>Update <code>4.12.24</code></h4>
            <ul>
                <li>Touchscreen support</li>
                <li>Minor fixes and optimizations</li>
            </ul>
        </li>
    </ul>
</details>
