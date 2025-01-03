# Changelog

## Update `29.12.24`

- Added map caching to IndexedDB
- New maps have been uploaded

## Update `28.12.24`

- The pop-up window with the choice of the map is moved to a real dialog element
- New maps have been uploaded

## Update `25.12.24`

- Improved text wrapping in card previews to better match text wrapping in HTML elements
- Added offset of cards by half their size
- The shape of the lines in the graph has been changed
- Added circular graph layout (doesn't work well with a large number of nodes with a small number of child nodes)
- The names of settings in the localStorage have been prefixed with the name of this repository
- Now when the "reduce motion" mode is enabled, animations are disabled
- New maps have been uploaded

## Update `19.12.24`

- Display of related tags has been added to the information card
- Search now uses RegEx (With g and i flags)

## Update `18.12.24`

- Button icons are now displayed in the preview
- Minor optimization of card calculation in the viewport
- Fixed loading of outdated scripts and styles from the browser cache by the browser
- Improved version control of data for display
- Slightly increased the size of buttons on cards
- The information button now opens additional information instead of copying the link to Danbooru
- Added file to test all features

## Update `12.12.24`

- Added emoji to main tags (file size, modification time, number of nodes, map type), also improved the mark that data is not downloaded
- Added the ability to render cards using Canvas WebGL2, lightning fast, especially compared to Canvas 2d or HTML Elements render. But it uses VRAM even with hardware acceleration turned off 😥
- ⚠ WebGL2 does not yet highlight search matches

## Update `10.12.24`

- More detailed status of loading
- The list of maps available for display has been changed: tags, type, file size, number of nodes have been added
- Slight reduction in memory consumption during rendering
- Fixing several bugs

## Update `9.12.24`

- Render functions have been partially rewritten (preparation for webgl2 render option)
- More accurate and faster detection of cards in the viewport
- Significant optimization of working with elements

## Update `7.12.24`

- Now when you click on a graph card, not only the connections of the current card are displayed, but also the entire path up the tree
- Some bugs have been fixed
- `Ctrl + O` now opens the file selector for import
- Cards may now not have an image, they will be displayed with a 256x256 placeholder
- Added a limitation on file import: maximum size 512 MB, perhaps later, if necessary, this technical limitation will be corrected with improved handling of import of large files

## Update `6.12.24`

- Ability to select text on a card while holding `Alt`
- Now when you click on a card (not the copy button) the text is copied only when `Ctrl` is pressed
- If you click on a graph card and it has connections, they will be displayed
- Tree view of graph

## Update `5.12.24`

- Preview cards now have different sizes depending on their content (previously all cards had a limit of 2 lines of text)
- Because of the first point, the generation of preview images takes a little longer 😓
- Fixed display of data processing status
- Now you can drag and drop the graph json and it will be displayed (The dots will be in random places, without paths)

## Update `4.12.24`

- Touchscreen support
- Minor fixes and optimizations
