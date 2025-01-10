# epi-embedding-maps-viewer

## This is just a small page to view [Epi's Embedding Maps](https://civitai.com/articles/8977)

This is a simplified version of viewing **Epi's Embedding Maps**.  
The main reason for creating this page was the desire to have a less laggy interface for viewing these maps.

Creator of the original maps — [epiTune](https://civitai.com/user/epiTune).

Last update: **`10.01.25`**

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

## Useful Information

### Render Engine

You can select the rendering method for displaying cards:

1. **HTML Element**: Very slow.
2. **Canvas 2D**: Faster than HTML Element but slower than Canvas WebGL2.
3. **Canvas WebGL2**: Extremely fast.  
   - Uses VRAM even if hardware acceleration is disabled in the browser, so if this is critical, it's better to choose Canvas 2D.

## Changelog

### Update `10.01.25`

- Improved overlap fix
- Now map data is stored separately from their meta information required for display in the list (The data list loads faster when opening the page)

[changelog.md](https://github.com/Dangarte/epi-embedding-maps-viewer/tree/main/changelog.md)
