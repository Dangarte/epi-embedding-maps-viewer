# epi-embedding-maps-viewer

## This is just a small page to view [Epi's Embedding Maps](https://civitai.com/articles/8977)

This is a simplified version of viewing **Epi's Embedding Maps**.  
The main reason for creating this page was the desire to have a less laggy interface for viewing these maps.

Creator of the original maps — [epiTune](https://civitai.com/user/epiTune).

Last update: **`29.12.24`**

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

1. The search uses regular expression syntax (RegEx). For reference, you can check out the [guide to regular expressions](https://regex101.com/).

    | **Symbol** | **Description**             | **Example**                      |
    |------------|-----------------------------|----------------------------------|
    | `.`        | Any character except newline| `h.t` — matches "hat", "hit", "hot" |
    | `\d`       | Any digit (0-9)             | `\d+` — matches "123", "4567" |
    | `\w`       | Word character (a-z, A-Z, 0-9, _) | `\w+` — matches "hello", "world123" |
    | `^`        | Start of string             | `^Hello` — matches strings starting with "Hello" |
    | `$`        | End of string               | `world$` — matches strings ending with "world" |
    | `[abc]`    | Any character in set        | `[abc]` — matches "a", "b", or "c" |
    | `[^abc]`   | Any character not in set    | `[^abc]` — matches anything except "a", "b", or "c" |
    | `*`        | 0 or more repetitions       | `ab*c` — matches "ac", "abc", "abbc", etc. |
    | `+`        | 1 or more repetitions       | `ab+c` — matches "abc", "abbc", but not "ac" |
    | `?`        | 0 or 1 repetition           | `colou?r` — matches "color" or "colour" |
    | `{n,m}`    | Between n and m repetitions | `a{2,4}` — matches "aa", "aaa", or "aaaa" |
    | `(a\|b)`   | Logical OR                  | `(cat\|dog)` — matches "cat" or "dog" |
    | `\`        | Escape special characters   | `\.` — matches a literal dot "." |

    Notes:
   - Use `\` to escape special characters if you want to search for them literally (e.g., `\.` to search for a period).
   - Patterns can be combined for more complex searches.
2. The file `v0-artists-8192.json` is too big (132MB) for GitHub (<100MB), so it was uploaded separately to Google Drive: [v0-artists-8192.json](https://drive.usercontent.google.com/download?id=1S3P8qu8fByQ1XMa6afyDW46oxxaa6_a1)
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
            <h4>Update <code>29.12.24</code></h4>
            <ul>
                <li>Added map caching to IndexedDB</li>
                <li>New maps have been uploaded</li>
            </ul>
        </li>
        <li>
            <h4>Update <code>28.12.24</code></h4>
            <ul>
                <li>The pop-up window with the choice of the map is moved to a real dialog element</li>
                <li>New maps have been uploaded</li>
            </ul>
        </li>
        <li>
            <h4>Update <code>25.12.24</code></h4>
            <ul>
                <li>Improved text wrapping in card previews to better match text wrapping in HTML elements</li>
                <li>Added offset of cards by half their size</li>
                <li>The shape of the lines in the graph has been changed</li>
                <li>Added circular graph layout (doesn't work well with a large number of nodes with a small number of child nodes)</li>
                <li>The names of settings in the localStorage have been prefixed with the name of this repository</li>
                <li>Now when the "reduce motion" mode is enabled, animations are disabled</li>
                <li>New maps have been uploaded</li>
            </ul>
        </li>
        <li>
            <h4>Update <code>19.12.24</code></h4>
            <ul>
                <li>Display of related tags has been added to the information card</li>
                <li>Search now uses RegEx (With g and i flags)</li>
            </ul>
        </li>
        <li>
            <h4>Update <code>18.12.24</code></h4>
            <ul>
                <li>Button icons are now displayed in the preview</li>
                <li>Minor optimization of card calculation in the viewport</li>
                <li>Fixed loading of outdated scripts and styles from the browser cache by the browser</li>
                <li>Improved version control of data for display</li>
                <li>Slightly increased the size of buttons on cards</li>
                <li>The information button now opens additional information instead of copying the link to Danbooru</li>
                <li>Added file to test all features</li>
            </ul>
        </li>
        <li>
            <h4>Update <code>12.12.24</code></h4>
            <ul>
                <li>Added emoji to main tags (file size, modification time, number of nodes, map type), also improved the mark that data is not downloaded</li>
                <li>Added the ability to render cards using Canvas WebGL2, lightning fast, especially compared to Canvas 2d or HTML Elements render. But it uses VRAM even with hardware acceleration turned off 😥</li>
                <li>⚠ WebGL2 does not yet highlight search matches</li>
            </ul>
        </li>
        <li>
            <h4>Update <code>10.12.24</code></h4>
            <ul>
                <li>More detailed status of loading</li>
                <li>The list of maps available for display has been changed: tags, type, file size, number of nodes have been added</li>
                <li>Slight reduction in memory consumption during rendering</li>
                <li>Fixing several bugs</li>
            </ul>
        </li>
        <li>
            <h4>Update <code>9.12.24</code></h4>
            <ul>
                <li>Render functions have been partially rewritten (preparation for webgl2 render option)</li>
                <li>More accurate and faster detection of cards in the viewport</li>
                <li>Significant optimization of working with elements</li>
            </ul>
        </li>
        <li>
            <h4>Update <code>7.12.24</code></h4>
            <ul>
                <li>Now when you click on a graph card, not only the connections of the current card are displayed, but also the entire path up the tree</li>
                <li>Some bugs have been fixed</li>
                <li><code>Ctrl + O</code> now opens the file selector for import</li>
                <li>Cards may now not have an image, they will be displayed with a 256x256 placeholder</li>
                <li>Added a limitation on file import: maximum size 512 MB, perhaps later, if necessary, this technical limitation will be corrected with improved handling of import of large files</li>
            </ul>
        </li>
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
