const ISDARK = window.matchMedia('(prefers-color-scheme: dark)').matches;
const ISLOCAL = window.location?.href?.startsWith('file:///') ?? true;
const SELECTED_DATA_FROM_URL = !ISLOCAL ? 'v1-tags-1024' : null; // TODO

// Display options
const PAGE_BACKGROUND = ISDARK ? '#000' : '#eee';
const CARD_STYLE = {
    fontSize: 24,
    font: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
    // font: 'Arial, Helvetica, sans-serif',
    color: ISDARK ? '#dedfe2' : '#232529',
    backgroundColor: ISDARK ? '#232529' : '#dedfe2',
    btnBackgroundColor: ISDARK ? '#3b3d45' : '#e3e3e3',
    btnBackgroundColorHover: ISDARK ? '#525660' : '#c8e1ff',
    borderColor: ISDARK ? '#464953' : '#757a8a',
    borderWidth: 1,
    padding: 6,
    borderRadius: 10,
    textLines: 2,
    lineHeight: 1.2,
    matchedColor: 'red',
};

// Optimization
const CANVAS_SMOOTHING = true; // anti-aliasing
const CANVAS_SMOOTHING_QUALITY = 'low'; // quality of anti-aliasing: low, medium, high
const CANVAS_TEXT_QUALITY = 'optimizeLegibility'; // canvas textRendering option: optimizeSpeed, optimizeLegibility, geometricPrecigion
const CANVAS_WEBGL = false; // Use webgl context instead of 2d // TODO
const CARD_PREVIEW_SCALING = [ // List of aviable preview scales (Sorted by scale, lower first)
    { id: 'micro', title: 'Micro preview', scale: .019, quality: .6 },
    { id: 'tiny', title: 'Tiny preview', scale: .054, quality: .8 },
    { id: 'small', title: 'Small preview', scale: .21, quality: .95 },
    { id: 'preview', title: 'Preview', scale: .44, quality: 1 }, // Recommended set quality to 1 at first preview (because it's more noticeable if it's of lower quality)
    // id - Internal size identifier (Must be unique)
    // title - Size name, needed to display in status
    // scale - Size at which to move to the next quality
    // quality - Preview Quality (Internal size multiplier)
];
const CARD_SCALE_PREVIEW = CARD_PREVIEW_SCALING.at(-1).scale; // At this scale elements changed to preview canvas (set to 0 for disable)
const SORT_SEARCH_BY_PROXIMITY = true; // Sort search results by distance. That is, when going to a result, go to the nearest card, instead of the standard order.
const CONVERT_PREVIEW_CANVAS_TO_IMAGE = false; // Convert preview canvas to image (not recommended, it takes a long time to convert, then it takes a long time to "decode image", but use less VRAM (if GPU acceleration is enabled) and fix OOM browser errors)

// Zooming
const SCALE_BASE = .6; // Default Zoom
const SCALE_MAX = 6; // Maximum zoom
const SCALE_MIN = .004; // Minimum zoom
const SCALE_SEARCH = 1; // Zoom when moving to search element
const SCALE_ZOOM_INTENSITY = .18; // Zoom Intensity

// Index of sources
const INDEX_URL = 'https://dangarte.github.io/epi-embedding-maps-viewer/data/index.json';
const INDEX = [];

// Define canvas
const CANVAS_WIDTH = window.innerWidth;
const CANVAS_HEIGHT = window.innerHeight;
const cardsContainer = document.getElementById('image-cards');
const canvas = document.getElementById('image-canvas');
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = CANVAS_SMOOTHING;
ctx.imageSmoothingQuality = CANVAS_SMOOTHING_QUALITY;
ctx.textRendering = CANVAS_TEXT_QUALITY;

// Define icons
const ICON_COPY = document.querySelector('.icon[data-icon="copy"]')?.cloneNode(true);
const ICON_BOOK = document.querySelector('.icon[data-icon="book"]')?.cloneNode(true);

// Define search elements
const searchInput = document.getElementById('search');
const searchGoToNextButton = document.getElementById('goto-search');
const searchClearButton = document.getElementById('search-clear');

// Insert card styles in page
CARD_STYLE.textLines = String(CARD_STYLE.textLines);
CARD_STYLE.lineHeight = String(CARD_STYLE.lineHeight);
const cardStyleConfigsElement = insertElement('style', document.head);
cardStyleConfigsElement.textContent = `:root {${Object.keys(CARD_STYLE).map(key => `--card-${key}: ${ typeof CARD_STYLE[key] !== 'number' ? CARD_STYLE[key] : `${CARD_STYLE[key]}px` };`).join(' ')} }`;
CARD_STYLE.textLines = Number(CARD_STYLE.textLines);
CARD_STYLE.lineHeight = Number(CARD_STYLE.lineHeight);

// Current viewer state
const STATE = {
    ready: false,
    source: {},
    data: [],
    previewControllers: {},
    space: 0,
    scale: SCALE_BASE,
    renderedScale: null,
    renderedScaleCache: null,
    spacing: 50,
    panX: 0,
    panY: 0,
    mouseX: 0,
    mouseY: 0,
    mousedown: false,
    mousemove: false,
    filter: null,
    matched: [],
    notMatched: [],
};


// Functions for work with data

class CardsPreviewController {
    data = [];
    grid = { layers: [], cardWidth: 0, cardHeight: 0, imageWidth: 0, imageHeight: 0 };
    key;
    scale;

    constructor(key, data, scale) {
        scale = +scale.toFixed(5);

        this.key = key;
        this.scale = scale;

        // List of maximum canvas sizes in browsers: https://jhildenbiddle.github.io/canvas-size/#/?id=test-results
        const maxCanvasScaleFactor = .25;
        const maxHeight = 16384 * maxCanvasScaleFactor;
        const maxWidth = 16384 * maxCanvasScaleFactor;
        
        this.data = data;
        const { image } = data[0];
        const imageWidthReal = image.width * scale;
        const imageHeightReal = image.height * scale;
        const imagesCount = data.length;
        const padding = (CARD_STYLE.padding + CARD_STYLE.borderWidth) * scale;
        const cardWidthReal = imageWidthReal + padding * 2;
        const cardHeightReal = imageHeightReal + padding * 2 + CARD_STYLE.fontSize * scale * CARD_STYLE.lineHeight * CARD_STYLE.textLines + CARD_STYLE.fontSize * scale;
        const isSizeOk = Math.min(cardWidthReal, cardHeightReal) >= 1;
        const reScale = isSizeOk ? 1 : 1 / Math.min(cardWidthReal, cardHeightReal);
        
        const cardWidth = Math.round(cardWidthReal * reScale);
        const cardHeight = Math.round(cardHeightReal * reScale);
        const imageWidth = Math.round(imageWidthReal * reScale);
        const imageHeight = Math.round(imageHeightReal * reScale);
        this.scale = scale * reScale;

        const gridSizeX = Math.floor(maxWidth/cardWidth);
        const gridSizeY = Math.ceil(imagesCount/gridSizeX);
        const maxGridY = Math.floor(maxHeight/cardHeight);

        const layers = [];
        const pushCanvas = (gridSizeX, gridSizeY) => {
            const width = gridSizeX * cardWidth;
            const height = gridSizeY * cardHeight;
            const canvas = new OffscreenCanvas(width, height);
            layers.push({ canvas, width, height, gridSizeX, gridSizeY });
        }
        this.grid = { cardWidth, cardHeight, imageWidth, imageHeight, layers };
        
        
        if (gridSizeY > maxGridY) {
            const wholeLayersCount = Math.floor(gridSizeY / maxGridY);
            for (let i = 0; i < wholeLayersCount; i++) {
                pushCanvas(gridSizeX, maxGridY);
            }
            pushCanvas(gridSizeX, gridSizeY - maxGridY * wholeLayersCount);
        } else pushCanvas(gridSizeX, gridSizeY);
    }

    async drawCards(referenceController) {
        const scale = this.scale;
        const count = this.data.length;
        const key = this.key;
        const padding = CARD_STYLE.padding * scale;
        const fontSize = CARD_STYLE.fontSize * scale;
        const borderWidth = CARD_STYLE.borderWidth * scale;
        const borderRadius = Math.round(CARD_STYLE.borderRadius * scale);
        const borderRadiusInside = borderRadius - padding;
        const hasReference = Boolean(referenceController);
        const { cardWidth, cardHeight, imageWidth, imageHeight, layers } = this.grid;
        const contentOffset = padding + borderWidth;
        const lineHeight = fontSize * CARD_STYLE.lineHeight;
        const textOffsetY = contentOffset + imageHeight + fontSize;
        const controlsOffsetY = imageHeight + lineHeight * CARD_STYLE.textLines;
        const controlsOffsetX = [
            imageWidth - fontSize,
            imageWidth - fontSize * 2.125
        ];
        const fontString = `normal ${fontSize}px ${CARD_STYLE.font}`;
        let ctx, gridSizeX, gridSizeY, layerMaxCards, currentLayerIndex = 0, cardOffsetY = 0;
        const referenceLayers = hasReference ? referenceController.grid.layers : null;
        const refCardWidth = hasReference ? referenceController.grid.cardWidth : null;
        const refCardHeight = hasReference ? referenceController.grid.cardHeight : null;
        let refCanvas, refGridX, refGridY, refCardsCount, refCurrentLayerIndex = 0, refCardOffsetY = 0;
        const selectLayer = async i =>  {
            if (gridSizeY) cardOffsetY += gridSizeY * cardHeight;

            if (CONVERT_PREVIEW_CANVAS_TO_IMAGE && currentLayerIndex !== i) layers[currentLayerIndex].canvas = await convertCanvasToImage(layers[currentLayerIndex].canvas);

            ctx = layers[i].canvas.getContext('2d', { alpha: true });
            ctx.imageSmoothingEnabled = CANVAS_SMOOTHING;
            ctx.imageSmoothingQuality = CANVAS_SMOOTHING_QUALITY;
            ctx.textRendering = CANVAS_TEXT_QUALITY;
            
            ctx.fillStyle = CARD_STYLE.color;
            ctx.font = fontString;

            if (borderWidth) {
                ctx.strokeStyle = CARD_STYLE.borderColor;
                ctx.lineWidth = borderWidth;
            }

            gridSizeX = layers[i].gridSizeX;
            gridSizeY = layers[i].gridSizeY;
            layerMaxCards = gridSizeX * gridSizeY;
            currentLayerIndex = i;
        };
        const selectRefLayer = i => {
            if (refGridY) refCardOffsetY += refGridY * refCardHeight;
            refCanvas = referenceLayers[i].canvas;
            refGridX = referenceLayers[i].gridSizeX;
            refGridY = referenceLayers[i].gridSizeY;
            refCardsCount = refGridX * refGridY;
            refCurrentLayerIndex = i;
        };

        await selectLayer(currentLayerIndex);
        if (hasReference) selectRefLayer(refCurrentLayerIndex);

        const imageRoundedClipPath = getRoundedRectPath(imageWidth, imageHeight, borderRadiusInside);
        const imageRoundedClipPathOutline = getRoundedRectPath(imageWidth + 2, imageHeight + 2, borderRadiusInside, -1, -1);
        const cardRoundedClipPath = getRoundedRectPath(cardWidth - borderWidth * 2, cardHeight - borderWidth * 2, borderRadius);

        const charMeasureCache = new Map();
        const splitTextIntoChunks = (text, separators = [' ', '-']) => {
            const isSeparator = char => separators.includes(char);
        
            let chunks = [];
            let currentChunk = '';
        
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
        
                if (isSeparator(char)) {
                    if (currentChunk) chunks.push(currentChunk);
                    currentChunk = '';
                    chunks.push(char);
                } else currentChunk += char;
            }
        
            if (currentChunk) chunks.push(currentChunk);
        
            return chunks.map((chunk, i) =>
                separators.includes(chunk) && i === chunks.length - 1 ? chunk.trim() : chunk
            );
        };
        const measureChar = char => {
            let charWidth = charMeasureCache.get(char);
            if (charWidth) return charWidth;
            charWidth = ctx.measureText(char).width;
            charMeasureCache.set(char, charWidth);
            return charWidth;
        };
        const measureText = text => {
            let width = 0;
            for(let i = text.length - 1; i >= 0; i--) width += measureChar(text[i]);
            return width;
        };
        const wrapText = (text, x, y, maxWidth) => {
            const words = splitTextIntoChunks(text);
            let line = '';
            let testLineWidth = 0;
            const lines = [];
        
            for (const word of words) {
                const wordWidth = measureText(word);
                
                if (testLineWidth + wordWidth > maxWidth && line) {
                    if (lines.length < CARD_STYLE.textLines) lines.push(line);
                    line = word;
                    testLineWidth = wordWidth;
                } else {
                    line += word;
                    testLineWidth += wordWidth;
                }

            }

            if (lines.length < CARD_STYLE.textLines) lines.push(line);
            else if (lines.length > CARD_STYLE.textLines) y -= (lines.length - CARD_STYLE.textLines) * lineHeight;
        
            for (const line of lines) {
                ctx.fillText(line, x, y);
                y += lineHeight;
            }
        };

        // Generate card template (background, outline, buttons)
        let cardTemplate = null;
        if (!hasReference) {
            cardTemplate = new OffscreenCanvas(cardWidth, cardHeight);
            const templateCtx = cardTemplate.getContext('2d', { alpha: true });
            templateCtx.imageSmoothingEnabled = CANVAS_SMOOTHING;
            templateCtx.imageSmoothingQuality = CANVAS_SMOOTHING_QUALITY;
            
            templateCtx.strokeStyle = CARD_STYLE.borderColor;
            templateCtx.lineWidth = borderWidth;
            templateCtx.fillStyle = CARD_STYLE.backgroundColor;

            templateCtx.translate(borderWidth, borderWidth);
            
            templateCtx.fill(cardRoundedClipPath);
            if (borderWidth) templateCtx.stroke(cardRoundedClipPath);
            
            templateCtx.translate(padding, padding);
            
            templateCtx.fillStyle = CARD_STYLE.btnBackgroundColor;
            controlsOffsetX.forEach(x => {
                templateCtx.roundRect(x, controlsOffsetY, fontSize, fontSize, borderRadiusInside);
                templateCtx.fill();
            });
            
            if (borderWidth) templateCtx.stroke(imageRoundedClipPathOutline);
            templateCtx.clip(imageRoundedClipPath);
            templateCtx.clearRect(0, 0, cardWidth, cardHeight);
        }
        
        let lastX = 0, lastY = 0;
        for(let index = 0; index < count; index++) {
            const info = this.data[index];
            const { image, title } = info;

            if (layerMaxCards <= 0) {
                await selectLayer(currentLayerIndex + 1);
                lastX = 0;
                lastY = 0;
            }

            const x = (index % gridSizeX) * cardWidth;
            const y = Math.floor(index / gridSizeX) * cardHeight - cardOffsetY;
            info[key] = { x, y, layer: currentLayerIndex };

            if (hasReference) {
                if (refCardsCount <= 0) selectRefLayer(refCurrentLayerIndex + 1);
                
                const refX = (index % refGridX) * refCardWidth;
                const refY = Math.floor(index / refGridX) * refCardHeight - refCardOffsetY;
                ctx.drawImage(refCanvas, refX, refY, refCardWidth, refCardHeight, x, y, cardWidth, cardHeight);
                
                refCardsCount--;
            } else {
                ctx.translate(x - lastX, y - lastY);
                ctx.drawImage(image, contentOffset, contentOffset, imageWidth, imageHeight);
                ctx.drawImage(cardTemplate, 0, 0, cardWidth, cardHeight);
                
                wrapText(title, contentOffset, textOffsetY, imageWidth);
                
                lastX = x;
                lastY = y;
            }
            layerMaxCards--;
        }

        // Convert last layer if need
        if (CONVERT_PREVIEW_CANVAS_TO_IMAGE) layers[currentLayerIndex].canvas = await convertCanvasToImage(layers[currentLayerIndex].canvas);

        // Clear template
        if (!hasReference) {
            cardTemplate.width = 0;
            cardTemplate.height = 0;
            cardTemplate = null;
        }
    }
}

class CardsPhysicController {
    data;
    points;
    grid;
    gridSizeX;
    gridSizeY;
    pointWidth;
    pointHeight;
    
    isActive = false;
    
    constructor (data, pointWidth, pointHeight) {
        this.data = data;
        this.pointWidth = pointWidth;
        this.pointHeight = pointHeight;
    }
    
    updatePoints() {
        this.points = this.data.map((p, i) => ({ x: p.x, y: p.y, i }));
        this.grid = {};

        const cellSizeX = this.pointWidth;
        const cellSizeY = this.pointHeight;
        const grid = this.grid;

        this.points.forEach((p, i) => {
            const gridX = Math.floor(p.x / cellSizeX);
            const gridY = Math.floor(p.y / cellSizeY);

            const cell = grid[gridX]?.[gridY] ?? this.#createCell(gridX, gridY);
            cell.list.add(i);
            p.gridX = gridX;
            p.gridY = gridY;
            p.gridCell = cell;
        });
    }

    async overlapFix() {
        if (!STATE.ready || this.isActive) return;
        this.isActive = true;
        this.updatePoints();
        const spacing = STATE.spacing;

        const gap = 8; // Distance between cards
        const maxIterations = 80; // Maximum simulation steps
        const minForce = 0.03; // Minimum force

        // This will decrease the repulsive force with each iteration 
        let forceScale = .5; // Default force multiplier
        const forceScaleMin = .3; // Minimum force multiplier
        const forceScaleStep = .01; // Step size at which to decrease force each iteration
        const forceScaleResetAt = 8; // If for this amount of iteration, then set the value to 1
        const forceScaleResetTo = .8; // Reset force multiplier to this value

        const weightUp = 1.4; // If the direction is the same, then increase the shift
        const weightDown = .6; // If the direction is opposite, then weaken the shift

        const pointWidth = this.pointWidth;
        const pointHeight = this.pointHeight;
        const minDistance2 = pointWidth * pointWidth + pointHeight * pointHeight;
        const minDistance = Math.sqrt(minDistance2);

        const data = this.data;
        const points = this.points;

        const cellSizeX = this.pointWidth;
        const cellSizeY = this.pointHeight;
        const grid = this.grid;

        const updateGrid = () => {
            this.points.forEach((p, i) => {
                if (!p.changed) return;
                delete p.changed;
    
                const gridX = Math.floor(p.x / cellSizeX);
                const gridY = Math.floor(p.y / cellSizeY);
    
                if (p.gridX !== gridX || p.gridY !== gridY) {
                    grid[p.gridX][p.gridY].list.delete(i);
                    const cell = grid[gridX]?.[gridY] ?? this.#createCell(gridX, gridY);
                    cell.list.add(i);
                    p.gridX = gridX;
                    p.gridY = gridY;
                    p.gridCell = cell;
                }
            });
        }

        const simulateRepulsionForces = () => {
            let converged = true;
        
            points.forEach((p1, i) => {
                const { gridCell, x: x1, y: y1, dxLast: dx1Last = 0, dyLast: dy1Last = 0 } = p1;
        
                gridCell.neighbors.forEach(cell => {
                    cell.list.forEach(j => {
                        if (j <= i) return;
        
                        const p2 = points[j];
                        const { x: x2, y: y2, dxLast: dx2Last = 0, dyLast: dy2Last = 0 } = p2;
        
                        const dx = x1 - x2;
                        const dy = y1 - y2;
        
                        const distance2 = dx * dx + dy * dy;
                        if (distance2 < minDistance2) {
                            const distance = Math.sqrt(distance2);
                            const overlap = gap + minDistance - distance;
                            const force = overlap / distance;

                            if (force > minForce) {
                                converged = false;

                                // Taking into account the direction of the last change
                                const dot1 = dx * dx1Last + dy * dy1Last;
                                const dot2 = -dx * dx2Last - dy * dy2Last;
                                
                                // We decrease the force if we move against the last direction
                                const weight1 = dot1 > 0 ? weightUp : weightDown;
                                const weight2 = dot2 > 0 ? weightUp : weightDown;
        
                                const fx = force * dx * forceScale;
                                const fy = force * dy * forceScale;
        
                                // Updating positions
                                p1.x += fx * weight1;
                                p1.y += fy * weight1;
                                p2.x -= fx * weight2;
                                p2.y -= fy * weight2;
        
                                // Keep the last direction
                                p1.dxLast = fx;
                                p1.dyLast = fy;
                                p2.dxLast = -fx;
                                p2.dyLast = -fy;
        
                                p1.changed = true;
                                p2.changed = true;
                            }
                        }
                    });
                });
            });
        
            return converged;
        };

        const syncPointsWithData = () => {
            const scale = STATE.scale;
            data.forEach((d, i) => {
                const { x, y } = points[i];
                d.x = x;
                d.y = y;
                d.scaledX = x * scale;
                d.scaledY = y * scale;
            });
        };

        let converged = false;
        for(let iteration = 0; iteration < maxIterations; iteration++) {
            if (STATE.spacing !== spacing) break;
            
            updateGrid();
            converged = simulateRepulsionForces();
            syncPointsWithData();
            await draw();
    
            if (iteration === forceScaleResetAt) forceScale = forceScaleResetTo;
            if (forceScale > forceScaleMin) forceScale -= forceScaleStep;
    
            if (converged) {
                if (iteration || !converged) addNotify(converged ? 'The overlap has been fixed' : 'Failed to fix overlap, please try again');
                break;
            }
        }

        this.isActive = false;
    }

    #createCell(gridX, gridY) {
        if (!this.grid[gridX]) this.grid[gridX] = {};
        const cell = { list: new Set(), neighbors: [] };
        this.grid[gridX][gridY] = cell;
        this.#fillGridNeighbors(gridX, gridY, cell);
        return cell;
    }

    #fillGridNeighbors(gridX, gridY, cell) {
        for (let ox = -1; ox <= 1; ox++) {
            if (!this.grid[gridX + ox]) continue;
            for (let oy = -1; oy <= 1; oy++) {
                const neighborCell = this.grid[gridX + ox][gridY + oy];
                if (neighborCell) {
                    neighborCell.neighbors.push(cell);
                    cell.neighbors.push(neighborCell);
                }
            }
        }
    }
}


function selectSpace(data, space) {
    const spacing = STATE.spacing;
    const dataCountSpacingFactor = 1024;
    const maxDataSpacingFactor = 3;

    // Select data
    data.forEach(d => {
        d.x = d.spaces[space].x;
        d.y = d.spaces[space].y;
    });

    // Normalize data
    const allX = data.map(d => d.x);
    const allY = data.map(d => d.y);
    const minX = Math.min(...allX);
    const minY = Math.min(...allY);
    const rangeX = Math.max(...allX) - minX;
    const rangeY = Math.max(...allY) - minY;

    const scaleFactor = Math.min(CANVAS_WIDTH / rangeX, CANVAS_HEIGHT / rangeY) * spacing * (data.length > dataCountSpacingFactor ? Math.min(data.length / dataCountSpacingFactor, maxDataSpacingFactor) : 1);

    const offsetX = (CANVAS_WIDTH - rangeX * scaleFactor) / 2;
    const offsetY = (CANVAS_HEIGHT - rangeY * scaleFactor) / 2;

    data.forEach(d => {
        d.x = (d.x - minX) * scaleFactor + offsetX;
        d.y = (d.y - minY) * scaleFactor + offsetY;
    });

    STATE.renderedScale = null;
    STATE.physics.updatePoints();
}

async function selectData(id) {
    id = Number(id);
    const key = INDEX[id]?.id ?? 'unknown';
    const loaderPrefix = '[Loader]';
    const cCode = 'background-color: #264f73; color: #c5d9eb; padding: .125em .5em; border-radius: .25em;';
    const loading = document.getElementById('loading') ?? createElement('div', { id: 'loading' });
    document.body.classList.add('loading');
    let loadingStatus = '';
    const setLoadingStatus = text => {
        if (loadingStatus) console.timeEnd(loadingStatus);
        loading.textContent = text;
        loadingStatus = `${loaderPrefix} ${text}`;
        console.time(loadingStatus);
    };
    document.body.appendChild(loading);

    STATE.ready = false;
    console.log(`${loaderPrefix} Start loading %c${key}`, cCode);

    // Reset cache state in prev data
    setLoadingStatus('Unloading data');
    searchInput.value = '';
    STATE.filter = '';
    STATE.renderedScale = null;
    STATE.previewControllers = {};
    const keysToClear = [...CARD_PREVIEW_SCALING.map(i => i.id), 'cardElement', 'titleLowerCase', 'index', ];
    STATE.data.forEach(d => {
        keysToClear.forEach(key => {
            if (d[key]) delete d[key];
        });
    });
    delete STATE.cardWidth;
    delete STATE.cardHeight;
    cardsContainer.textContent = '';

    // Load data from file
    setLoadingStatus('Loading data');
    const data = INDEX[id].data ?? await fetchData(id);
    STATE.source = data;
    STATE.data = [...data.proj];
    console.log(`${loaderPrefix} %c${key}%c: `, cCode, '', STATE.source);

    // Process each item in list
    STATE.data.forEach((d, index) => {
        d.index = index;
        d.id = d.id ?? `card-${index}`;
        d.titleLowerCase = d.title.toLowerCase();

        // TODO: Will need to be replaced with real related tags later (when the creator adds them)
        d.relatedTags = [
            // { title: d.id, searchText: d.id },
        ];
    });

    // Add list of spaces and reset selected
    updateSpacesList();

    setLoadingStatus('Loading images');
    await processImages(STATE.data);
    
    setLoadingStatus('Generating preview');
    if (CARD_SCALE_PREVIEW >= SCALE_MIN) {
        // Full preview
        const { id, scale, quality = 1 } = CARD_PREVIEW_SCALING.at(-1);
        const firstPreviewController = STATE.previewControllers[id] = new CardsPreviewController(id, STATE.data, scale * quality);
        await firstPreviewController.drawCards();

        // Downscaled previews
        for (let i = CARD_PREVIEW_SCALING.length - 2; i >= 0; i--) {
            const { id, scale, quality = 1 } = CARD_PREVIEW_SCALING[i];
            STATE.previewControllers[id] = new CardsPreviewController(id, STATE.data, scale * quality);
            await STATE.previewControllers[id].drawCards(STATE.previewControllers[CARD_PREVIEW_SCALING[i + 1].id]);
            // await STATE.previewControllers[id].drawCards(firstPreviewController);
        }
    }

    // Cards size info
    const image = STATE.data[0].image;
    const padding = CARD_STYLE.padding + CARD_STYLE.borderWidth;
    STATE.cardWidth = image.width + padding * 2; // img + padding
    STATE.cardHeight = image.height + padding * 2 + CARD_STYLE.fontSize * CARD_STYLE.lineHeight * CARD_STYLE.textLines + CARD_STYLE.fontSize; // img + padding + text + controls
    
    // Create physics controller
    STATE.physics = new CardsPhysicController(STATE.data, STATE.cardWidth, STATE.cardHeight);

    setLoadingStatus('Calculating the position of the cards');
    selectSpace(STATE.data, STATE.space);
    if (STATE.source.spaces.length > 1) document.getElementById('switch-spaces')?.parentElement?.removeAttribute('disabled');
    else document.getElementById('switch-spaces')?.parentElement?.setAttribute('disabled', '');

    console.timeEnd(loadingStatus);
    loading.remove();
    document.body.classList.remove('loading');

    STATE.ready = true;
    console.log(`${loaderPrefix} Loading %c${key}%c ready`, cCode, '');
    recenterView(false);

    document.getElementById('data-list')?.parentElement?.removeAttribute('disabled');
}

async function fetchData(id) {
    const json = await fetch(INDEX[id].url).then(response => response.json());
    let newData = json;

    // Convert from first (simple array) format to current
    if (Array.isArray(json)) newData = convertOldDataToNewFormat(json, INDEX[id].id);

    // TODO Checking the format (are all the required fields present)

    INDEX[id].data = newData;
    return newData;
}

async function importJsonFile(file) {
    addNotify(`📄 ${file.name}`, 4000);

    const key = file.name;
    let dataIndex = -1;
    INDEX.forEach((item, i) => item.id === key ? dataIndex = i : null);

    if (dataIndex === -1) {
        try {
            const loading = document.getElementById('loading') ?? createElement('div', { id: 'loading' });
            loading.textContent = 'Importing';
            document.body.appendChild(loading);
            document.body.classList.add('loading');

            const text = await fileToText(file);
            const json = JSON.parse(text);
            let newData = json;

            if (Array.isArray(json)) newData = convertOldDataToNewFormat(json, key);
            else {
                if (json.name && Array.isArray(json.spaces) && json.kv && Array.isArray(json.proj)) {
                    const spacesCount = json.spaces.length;
                    if (json.proj.some(d => !d.title || !d.image || d.spaces.length < spacesCount)) {
                        console.warn('Error, wrong file structure (wrong proj list)');
                        return;
                    }
                } else {
                    console.warn('Error, wrong file structure');
                    return;
                }
            }
    
            dataIndex = INDEX.length;
            INDEX.push({ id: key, title: key, data: newData });
    
            const dataListSelector = document.getElementById('data-list');
            insertElement('option', dataListSelector, { value: dataIndex, 'data-title': key }, key);
            dataListSelector.value = dataIndex;
        } catch (err) {
            console.error(err);
            loading.remove();
            addNotify('❌ Import error', 4000);
        }
    }

    if (dataIndex !== -1) selectData(dataIndex);
}

function updateSpacesList() {
    STATE.space = 0;
    const switchEmbList = document.getElementById('switch-spaces');
    switchEmbList.textContent = '';
    STATE.source.spaces.forEach((title, index) => insertElement('option', switchEmbList, { value: index }, title));
    switchEmbList.value = STATE.space;
}

async function processImages(data) {
    const promises = [];
    const { width, height } = STATE.source.kv ?? {};
    const aspectRatio = width / height;
    data.forEach(info => typeof info.image === 'string' ? promises.push(base64ToImage(info.image)) : null);
    const images = await Promise.all(promises);
    images.forEach((image, index) => {
        image.width = image.naturalWidth;
        if (aspectRatio) image.height = Math.floor(image.width / aspectRatio);
        else image.naturalHeight;
        data[index].image = image;
        data[index].imageWidth = image.width;
        data[index].imageHeight = image.height;
    });
}

function base64ToImage(base64) {
    return new Promise(resolve => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image), { once: true });
        image.src = base64;
    });
}

function sortByProximity(points) {
    if (!points || points.length <= 1) return points;

    const maxRadius = 30;
    const sorted = [];
    const relativePoints = [];
    points.forEach(p => relativePoints[p.index] = p);
    const pointsIndexes = new Set(points.map(d => d.index));;
    const visited = new Set();
    const { grid: referenceGrid, pointWidth: cellSizeX, pointHeight: cellSizeY } = STATE.physics;

    const grid = {};
    const gridSizes = {};
    Object.keys(referenceGrid).forEach(gridX => {
        const referenceRow = referenceGrid[gridX];
        const row = {};
        const rowCellCount = {};
        let rowCount = 0;
        Object.keys(referenceRow).forEach(gridY => {
            const inList = new Set();
            let cellCount = 0;
            referenceRow[gridY].list.forEach(i => {
                if (pointsIndexes.has(i)) {
                    pointsIndexes.delete(i);
                    inList.add(i);
                    cellCount++;
                }
            });
            if (cellCount) {
                row[gridY] = inList;
                rowCount++;
                rowCellCount[gridY] = cellCount;
            }
        });
        if (rowCount) {
            grid[gridX] = row;
            gridSizes[gridX] = [rowCount, rowCellCount];
        }
    });

    let minDistance, nearestIndex, target;
    const distanceSquared = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
    const checkCell = (x, y) => {
        grid[x]?.[y]?.forEach(i => {
            const dist = distanceSquared(target, relativePoints[i]);
            if (dist < minDistance) {
                minDistance = dist;
                nearestIndex = i;
            }
        });
    };
    const addPointToSortedList = point => {
        const { x, y, index } = point;
        sorted.push(point);
        visited.add(index);

        // Remove point from grid
        const gridX = Math.floor(x / cellSizeX);
        const gridY = Math.floor(y / cellSizeY);

        if (gridSizes[gridX][1][gridY] === 1) {
            delete grid[gridX][gridY];
            if (gridSizes[gridX][0] === 1) delete grid[gridX];
            else gridSizes[gridX][0]--;
        } else {
            grid[gridX][gridY].delete(index);
            gridSizes[gridX][1][gridY]--;
        }
    };

    // Start from first point
    let current = points[0];
    addPointToSortedList(current);


    // Search closest points
    while (sorted.length < points.length) {
        target = sorted[sorted.length - 1];
        minDistance = Infinity;
        nearestIndex = null;

        const startX = Math.floor(target.x / cellSizeX);
        const startY = Math.floor(target.y / cellSizeY);

        checkCell(startX, startY);

        let radius = 1;
        while (nearestIndex === null) {
            if (radius > maxRadius) break;

            const cellY = startY - radius;
            const cellY2 = startY + radius;
            for (let dx = -radius; dx <= radius; dx++) {
                const cellX = startX + dx;
                if (!grid[cellX]) continue;
                checkCell(cellX, cellY);
                checkCell(cellX, cellY2);
            }

            const cellX = startX - radius;
            const cellX2 = startX + radius;
            for (let dy = -radius + 1; dy < radius; dy++) {
                const cellY = startY - dy;
                checkCell(cellX, cellY);
                checkCell(cellX2, cellY);
            }

            radius++;
        }

        if (nearestIndex === null) {
            for (const i in points) {
                if (!visited.has(points[i].index)) {
                    nearestIndex = points[i].index;
                    break;
                }
            }
        }
        
        addPointToSortedList(relativePoints[nearestIndex]);
    }

    return sorted;
}


// Functions for render data

function emptyAll() {
    searchInput.value = '';
    cardsContainer.textContent = '';
    const dataListSelector = document.getElementById('data-list');
    dataListSelector.textContent = '';
    dataListSelector.value = '';
    const switchEmbSelector = document.getElementById('switch-spaces');
    switchEmbSelector.textContent = '';
    switchEmbSelector.value = '';
}

function emptyCanvas() {
    ctx.fillStyle = PAGE_BACKGROUND;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function recalcRenderScale() {
    // Calc current render info
    const { scale, data } = STATE;
    const useElements = scale > CARD_SCALE_PREVIEW;
    const previewScaleCurrent = !useElements ? CARD_PREVIEW_SCALING.find(i => scale <= i.scale) : null;

    const previewController = previewScaleCurrent ? STATE.previewControllers[previewScaleCurrent.id] : {};
    const { cardWidth: previewWidth, cardHeight: previewHeight } = previewController.grid ?? STATE;
    const { cardWidth: w, cardHeight: h } = STATE;

    const scaledW = w * scale;
    const scaledH = h * scale;
    const scaledW2 = scaledW / 2;
    const scaledH2 = scaledH / 2;
    
    const wHalf = w / 2;
    const hHalf = h / 2;
    
    let mathcedOutlineImage = STATE.renderedScaleCache?.mathcedOutlineImage;
    const outlineWidth = 2;
    const borderRadius = CARD_STYLE.borderRadius * scale;

    // Update scaled position
    data.forEach(d => {
        d.scaledX = d.x * scale;
        d.scaledY = d.y * scale;
    });

    // Update previews

    const renderedScale = STATE.renderedScale;
    const renderedElements = renderedScale > CARD_SCALE_PREVIEW;
    const renderedPreviewScaleCurrent = !renderedElements ? CARD_PREVIEW_SCALING.find(i => renderedScale <= i.scale) : null;

    if (useElements) {
        cardsContainer.setAttribute('style', `--scale: ${scale};`);
        if (!renderedElements) emptyCanvas();
        mathcedOutlineImage = null;
    } else {
        // Remove all elements if they not nedeed
        if (renderedElements) {
            cardsContainer.textContent = '';
            cardsContainer.removeAttribute('style');
            data.forEach(d => d.cardElement ? d.cardElement.inDOM = false : null);
        }

        // Change preview
        if (!renderedPreviewScaleCurrent || renderedPreviewScaleCurrent.id !== previewScaleCurrent.id) {
            const id = previewScaleCurrent.id;
            const layers = STATE.previewControllers[id].grid.layers;
            data.forEach(d => {
                d.previewInfo = { x: d[id].x, y: d[id].y, canvas: layers[d[id].layer].canvas };
            });
        }

        // Draw outline for matched cards
        
        if (mathcedOutlineImage) {
            mathcedOutlineImage.width = 0;
            mathcedOutlineImage.height = 0;
        }
        mathcedOutlineImage = new OffscreenCanvas(scaledW + outlineWidth * 2, scaledH + outlineWidth * 2);
        const mathcedOutlineCtx = mathcedOutlineImage.getContext('2d', { alpha: true });
        mathcedOutlineCtx.imageSmoothingEnabled = CANVAS_SMOOTHING;
        mathcedOutlineCtx.imageSmoothingQuality = CANVAS_SMOOTHING_QUALITY;
        mathcedOutlineCtx.strokeStyle = CARD_STYLE.matchedColor;
        mathcedOutlineCtx.lineWidth = outlineWidth;
        mathcedOutlineCtx.translate(outlineWidth, outlineWidth);
        mathcedOutlineCtx.stroke(getRoundedRectPath(scaledW, scaledH, borderRadius));

    }

    STATE.renderedScale = scale;
    STATE.renderedScaleCache = { w, h, wHalf, hHalf, scaledW, scaledH, scaledW2, scaledH2, previewWidth, previewHeight, mathcedOutlineImage, outlineWidth };
    STATE.cardScale = useElements ? 'Element' : previewScaleCurrent.title;
}

function renderUpdateCardMatchedHint(cardElement, filter) {
    const { searchInfo } = cardElement;
    cardElement.filter = filter;

    const processString = (element, string, lowerString) => {
        const indexStart = lowerString.indexOf(filter);
        const indexEnd = indexStart + filter.length;
        const selectionPrefix = string.substring(0, indexStart);
        const selectionContent = string.substring(indexStart, indexEnd);
        const selectionEnd = string.substring(indexEnd);
        
        const fragment = new DocumentFragment();
        if (selectionPrefix) fragment.appendChild(document.createTextNode(selectionPrefix));
        fragment.appendChild(createElement('mark', undefined, selectionContent));
        if (selectionEnd) fragment.appendChild(document.createTextNode(selectionEnd));
        element.textContent = '';
        element.appendChild(fragment);
    };

    searchInfo.forEach(item => {
        const { title, searchText, element } = item;
        const isMatched = filter && searchText.includes(filter);
        if (isMatched) processString(element, title, searchText);
        else element.textContent = title;
        element.classList.toggle('related-tag-matched', isMatched);
    });
}

function renderCreateCardElement(d) {
    const { element, titleElement, searchList } = createCardElement(d);
    const style = element.style;
    style.width = `${Math.round(STATE.renderedScaleCache.w)}px`;
    const searchInfo = d.relatedTags.map(({ title, searchText }, i) => ({ title, searchText, element: searchList[i] }));
    searchInfo.push({ title: d.title, searchText: d.title.toLowerCase(), element: titleElement });
    d.cardElement = { inDOM: false, element, style, title: d.title, searchInfo, matched: false };
    return d.cardElement;
}

function renderRemoveCardElementFromDOM(cardElement) {
    cardElement.element.remove();
    cardElement.inDOM = false;
}

function renderAppendCardElementToDOM(cardElement) {
    cardsContainer.appendChild(cardElement.element);
    cardElement.inDOM = true;
}

function renderToogleCardElementMatch(cardElement, matched) {
    cardElement.element.classList.toggle('card-matched', matched);
    cardElement.matched = matched;
}

function render() {
    if (!STATE.ready) return;
    ctx.save();
    const { panX, panY, scale, data, filter } = STATE;
    const isScaleChanged = STATE.renderedScale !== scale;

    if (isScaleChanged) recalcRenderScale();
    const { wHalf, hHalf, scaledW2, scaledH2, scaledW, scaledH, previewWidth, previewHeight, mathcedOutlineImage, outlineWidth } = STATE.renderedScaleCache;
    
    let visibleCardsCount = 0;
    
    const useElements = scale > CARD_SCALE_PREVIEW;

    const viewportXStart = -panX - scaledW2;
    const viewportXEnd = -panX + CANVAS_WIDTH + scaledW2;
    const viewportYStart = -panY - scaledH2;
    const viewportYEnd = -panY + CANVAS_HEIGHT + scaledH2;

    const elementOffsetX = panX - wHalf;
    const elementOffsetY = panY - hHalf;
    
    
    // Apply scale and offset to canvas
    if (!useElements) {
        emptyCanvas();
        ctx.translate(panX - scaledW2, panY - scaledH2);
    }
    
    const drawItem = (d, isMatched) => {
        const { scaledX, scaledY } = d;
        if (scaledX < viewportXStart || scaledX > viewportXEnd || scaledY < viewportYStart || scaledY > viewportYEnd) return;
        visibleCardsCount++;

        const { x: pointX, y: pointY, canvas } = d.previewInfo;
        ctx.drawImage(canvas, pointX, pointY, previewWidth, previewHeight, scaledX, scaledY, scaledW, scaledH);
        if (isMatched) ctx.drawImage(mathcedOutlineImage, scaledX - outlineWidth, scaledY - outlineWidth);
    };
    const moveElement = (d, isMatched) => {
        const { scaledX, scaledY } = d;
        if (scaledX < viewportXStart || scaledX > viewportXEnd || scaledY < viewportYStart || scaledY > viewportYEnd) {
            if (d.cardElement?.inDOM) renderRemoveCardElementFromDOM(d.cardElement);
            return;
        }
        visibleCardsCount++;

        const { style, matched, inDOM, filter: f } = d.cardElement ?? renderCreateCardElement(d);
        style.left = `${scaledX + elementOffsetX}px`;
        style.top = `${scaledY + elementOffsetY}px`;

        if (f !== filter) renderUpdateCardMatchedHint(d.cardElement, filter);
        if (matched !== isMatched) renderToogleCardElementMatch(d.cardElement, isMatched);
        if (!inDOM) renderAppendCardElementToDOM(d.cardElement);
    };

    const renderItem = useElements ? moveElement : drawItem;

    if (filter) {
        // Move matching elements to end (so that they are not covered by other elements)
        const { matched, notMatched } = STATE;
        for (const d of notMatched) renderItem(d, false);
        for (const d of matched) renderItem(d, true);
    } else {
        for (const d of data) renderItem(d, false);
    }

    ctx.restore();

    STATE.visibleCardsCount = visibleCardsCount;
    updateStatsOnPage();
}

let drawRequestAnimationFrame = null;
const drawRequestAnimationFrameCallbacks = [];
function draw() {
    return new Promise(resolve => {
        drawRequestAnimationFrameCallbacks.push(resolve);
        if (!drawRequestAnimationFrame) drawRequestAnimationFrame = requestAnimationFrame(() => {
            drawRequestAnimationFrame = null;
            render();
            drawRequestAnimationFrameCallbacks.forEach(r => r());
            drawRequestAnimationFrameCallbacks.length = 0;
        });
    });
}

const statusElements = {
    visibleCardsCount: document.getElementById('cards-in-viewport'),
};
function updateStatsOnPage() {
    statusElements.visibleCardsCount.textContent = `${STATE.cardScale} (x${STATE.visibleCardsCount})`;
    // This is for displaying the scale while calibrating the preview size
    // statusElements.visibleCardsCount.textContent = `${+STATE.scale.toFixed(3)}: ${STATE.cardScale} (x${STATE.visibleCardsCount})`;
}

function createCardElement(d) {
    const card = createElement('div', { class: 'card', 'data-id': d.id });
    card.appendChild(d.image);
    const p = insertElement('p', card, { class: 'card-title' }, d.title);
    const controls = insertElement('div', card, { class: 'buttons' });
    
    if (d.kv?.danbooru_wiki_url) insertElement('div', controls, { class: 'button', 'data-id': 'wiki' }).appendChild(ICON_BOOK.cloneNode(true));
    else insertElement('div', controls, { class: 'button', 'disabled': '' }).appendChild(ICON_BOOK.cloneNode(true));
    
    insertElement('div', controls, { class: 'button', 'data-id': 'copy' }).appendChild(ICON_COPY.cloneNode(true));

    const searchPopup = insertElement('div', card, { class: 'card-related-tags' });
    const searchList = d.relatedTags.map(item => insertElement('span', searchPopup, { class: 'related-tag' }, item.title));

    return { element: card, titleElement: p, searchList };
}

// Path for image rounded corners
const pathCache = new Map();
function getRoundedRectPath(w, h, borderRadius, offsetX = 0, offsetY = 0) {
    const cacheKey = `${w}-${h}-${borderRadius}-${offsetX}-${offsetY}`;
    if (pathCache.has(cacheKey)) return pathCache.get(cacheKey);

    const path = new Path2D();
    if (borderRadius) {
        path.moveTo(offsetX + borderRadius, offsetY);
        path.lineTo(offsetX + w - borderRadius, offsetY);
        path.quadraticCurveTo(offsetX + w, offsetY, offsetX + w, offsetY + borderRadius);
        path.lineTo(offsetX + w, offsetY + h - borderRadius);
        path.quadraticCurveTo(offsetX + w, offsetY + h, offsetX + w - borderRadius, offsetY + h);
        path.lineTo(offsetX + borderRadius, offsetY + h);
        path.quadraticCurveTo(offsetX, offsetY + h, offsetX, offsetY + h - borderRadius);
        path.lineTo(offsetX, offsetY + borderRadius);
        path.quadraticCurveTo(offsetX, offsetY, offsetX + borderRadius, offsetY);
        path.closePath();
    } else {
        path.rect(offsetX, offsetY, w, h);
    }

    pathCache.set(cacheKey, path);
    return path;
}


// Function to search
let searchTimer = null;
function search() {
    const gotoSearch = searchGoToNextButton;
    gotoSearch.setAttribute('data-next', 0);
    
    const filter = searchInput.value.trim().toLowerCase();

    const matched = [];
    const notMatched = [];
    if (filter) STATE.data.forEach(d => (d.titleLowerCase.includes(filter) || d.relatedTags.some(item => item.searchText.includes(filter)) ? matched : notMatched).push(d));
    searchClearButton.style.visibility = filter ? 'visible' : 'hidden';
    gotoSearch.setAttribute('data-count', matched.length);

    STATE.matched = matched;
    STATE.notMatched = notMatched;
    STATE.filter = filter;
    draw();

    // Sort cards by proximity, for  more predictive navigation
    if (SORT_SEARCH_BY_PROXIMITY) {
        // The timer is needed to avoid too frequent recalculations (on 8k+ cards, if you need to count all 8k matches, it takes too much time)
        if (searchTimer !== null) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            searchTimer = null;
            STATE.matched = sortByProximity(STATE.matched);
        }, 200);
    }
}
function gotoNextSearchResult(back = false, animate = true) {
    const dataNext = Number(searchGoToNextButton.getAttribute('data-next')) ?? 0;
    const { filter, matched } = STATE;
    if (!filter || !matched.length) return;
    const next = back ? (dataNext - 2 < 0 ? matched.length - (2 - dataNext) : dataNext - 2) : dataNext;
    const { x, y } = matched[next % matched.length];
    searchGoToNextButton.setAttribute('data-next', (next + 1) % matched.length);
    const targetScale = SCALE_SEARCH;
    const targetPanX = -x * targetScale + CANVAS_WIDTH/2;
    const targetPanY = -y * targetScale + CANVAS_HEIGHT/2;
    if (animate) animatedPanTo(targetPanX, targetPanY, targetScale);
    else {
        STATE.panX = targetPanX;
        STATE.panY = targetPanY;
        STATE.scale = targetScale;
        draw();
    }
}


function recenterView(animate = true) {
    if (!STATE.ready) return;
    const newScale = SCALE_BASE;
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    let closestPoint = STATE.data[0];
    let minDistance = Infinity;

    STATE.data.forEach(d => {
        const dx = d.x - centerX;
        const dy = d.y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
            minDistance = distance;
            closestPoint = d;
        }
    });

    const newPanX = CANVAS_WIDTH / 2 - closestPoint.x * newScale;
    const newPanY = CANVAS_HEIGHT / 2 - closestPoint.y * newScale;

    if (animate) animatedPanTo(newPanX, newPanY, newScale);
    else {
        STATE.panX = newPanX;
        STATE.panY = newPanY;
        STATE.scale = newScale;
        draw();
    }
}

async function switchEmb(embIndex, animate = true) {
    const duration = 1500;
    const data = STATE.data;
    STATE.space = embIndex;

    const targets = data.map(d => ({ prevX: d.x, prevY: d.y, }));
    selectSpace(data, STATE.space);
    targets.forEach((d, index) => {
        d.newX = data[index].x;
        d.newY = data[index].y;
    });

    if (animate) {
        const timeStart = Date.now();
        const timeEnd = timeStart + duration;
        let timeNow = Date.now();

        const step = async t => {
            const scale = STATE.scale;
    
            data.forEach((d, i) => {
                const { newX, newY, prevX, prevY } = targets[i];
                d.x = smoothStep(prevX, newX, t);
                d.y = smoothStep(prevY, newY, t);
                d.scaledX = d.x * scale;
                d.scaledY = d.y * scale;
            });
    
            await draw();
        };
        
        while (timeNow <= timeEnd) {
            if (STATE.space !== embIndex) break;
            
            const t = (timeNow - timeStart) / duration;
            await step(t);

            timeNow = Date.now();
            if (timeNow > timeEnd) step(1);
        }

        STATE.physics.updatePoints();
    } else {
        const scale = STATE.scale;
        data.forEach((d, i) => {
            const { newX, newY } = targets[i];
            d.x = newX;
            d.y = newY;
            d.scaledX = d.x * scale;
            d.scaledY = d.y * scale;
        });
        STATE.physics.updatePoints();
        await draw();
    }
}

// Function to animate panX, panY and scale
async function animatedPanTo(newPanX, newPanY, newScale = STATE.scale, duration = 800) {
    const prevScale = STATE.scale;
    const prevPanX = STATE.panX;
    const prevPanY = STATE.panY;
    const isScaleChanged = prevScale !== newScale;
    const timeStart = Date.now();
    const timeEnd = timeStart + duration;
    let timeNow = Date.now();

    const step = async t => {
        STATE.panX = smoothStep(prevPanX, newPanX, t);
        STATE.panY = smoothStep(prevPanY, newPanY, t);
        if (isScaleChanged) STATE.scale = smoothStep(prevScale, newScale, t);
        
        await draw();
    };
    
    while (timeNow <= timeEnd) {
        if (STATE.mousedown) break;

        const t = (timeNow - timeStart) / duration;
        await step(t);
        
        timeNow = Date.now();
        if (timeNow > timeEnd) step(1);
    }
}

// Function to transform mouse coordinates to canvas coordinates
function getTransformedMouseCoordinates(event) {
    const mouseX = (event.clientX - STATE.panX) / STATE.scale;
    const mouseY = (event.clientY - STATE.panY) / STATE.scale;
    return { x: mouseX, y: mouseY };
}


// Activate imputs
let spacingAnimationFrame = null;
const inputsInit = [
    { id: 'scale-factor-coef', eventName: 'input',
        value: STATE.spacing,
        callback: e => {
            STATE.spacing = e.target.valueAsNumber;
            if (!spacingAnimationFrame) spacingAnimationFrame = requestAnimationFrame(() => {
                spacingAnimationFrame = null;
                if (STATE.ready) {
                    selectSpace(STATE.data, STATE.space);
                    render();
                }
            });
        }
    },
    { id: 'recenter-view', eventName: 'click',
        callback: e => recenterView(!e.ctrlKey)
    },
    { id: 'switch-spaces', eventName: 'change',
        callback: e => switchEmb(Number(e.target.value))
    },
    { id: 'search', eventName: 'input',
        callback: search
    },
    { id: 'search', eventName: 'keyup',
        callback: e => e.code ==='Enter' ? gotoNextSearchResult(e.shiftKey, !e.ctrlKey) : null
    },
    { id: 'search-clear', eventName: 'click',
        callback: () => {
            searchInput.value = '';
            search();
        }
    },
    { id: 'data-list', eventName: 'change',
        callback: e => selectData(Number(e.target.value))
    },
    { id: 'random',eventName: 'click',
        callback: e => {
            if (!STATE.ready) return;
            const animate = !e.ctrlKey;
            const { x, y, title } = STATE.data[Math.floor(Math.random()*STATE.data.length)];
            searchInput.value = title;
            search();
            const targetPanX = -x * STATE.scale + CANVAS_WIDTH / 2;
            const targetPanY = -y * STATE.scale + CANVAS_HEIGHT / 2;
            if (animate) animatedPanTo(targetPanX, targetPanY);
            else {
                STATE.panX = targetPanX;
                STATE.panY = targetPanY;
                draw();
            }
        },
    },
    { id: 'goto-search', eventName: 'click',
        callback: e => gotoNextSearchResult(e.shiftKey, !e.ctrlKey),
    },
    { id: 'overlap-fix', eventName: 'click',
        callback: e => {
            if (!STATE.ready) return;
            STATE.physics.overlapFix();
        }
    },
    { id: 'toggle-advanced-settings', eventName: 'click',
        callback: () => {
            const group = document.getElementById('advanced-settings-group');
            const toggleButon = document.getElementById('toggle-advanced-settings');
            const newState = !group.classList.contains('hidden');
            const buttonTextList = toggleButon.getAttribute('data-toggle-text')?.split('|') ?? ['⚙️ Show advanced settings', '⚙️ Hide advanced settings'];
            toggleButon.textContent = buttonTextList[Number(!newState)];
            group.classList.toggle('hidden', newState);
        }
    },
    { id: 'upload-json', eventName: 'click',
        callback: () => {
            const fileInput = document.getElementById('upload-json-input');
            fileInput.files.length = 0;
            fileInput.click();
        }
    },
    { id: 'upload-json-input', eventName: 'change',
        callback: () => {
            const fileInput = document.getElementById('upload-json-input');
            const file = fileInput.files[0];
            if (file && file.type === 'application/json') importJsonFile(file);
        }
    }
];
inputsInit.forEach(info => {
    const { id, eventName, value, callback } = info;
    const element = document.getElementById(id);
    if (value) element.value = value;
    element.addEventListener(eventName, callback);
});

function addNotify(text, duration = 2000) {
    const li = insertElement('li', document.getElementById('notify-list'), undefined, text);
    setTimeout(() => li.remove(), duration);
}

function onCardClick(e, card) {
    const id = card.getAttribute('data-id');
    if (!id) return;

    const d = STATE.data.find(d => d.id === id);
    if (!d) return;

    const buttonId = e.target.closest('.button[data-id]')?.getAttribute('data-id');
    if (buttonId === 'wiki') {
        const wikiUrl = d.kv?.danbooru_wiki_url;
        if (wikiUrl) toClipboard(wikiUrl);

        return;
    }

    toClipboard(d.title);
}

function toClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        console.log(`Copied "${text}" to clipboard`);
        addNotify(`Copied "${text}" to clipboard`);
    }).catch(err => {
        console.error("Failed to copy text: ", err);
        addNotify('Failed to copy text');
    });
}


//


function convertCanvasToImage(canvas) {
    return new Promise(r => {
        // const options = { type: 'image/png', quality: 1 };
        const options = { type: 'image/webp', quality: .72 };
        canvas.convertToBlob(options).then(blob => {
            const image = new Image(canvas.width, canvas.height);
            const url = URL.createObjectURL(blob);
            image.addEventListener('load', () => {
                URL.revokeObjectURL(url);
                r(image);
            }, { once: true });
            image.src = url;
        });
    });
};

// Simple animation
function simpleAnimate(callback, steps) {
    return new Promise(resolve => {
        const step = s => ()=> {
            const t = s / steps;
            callback(t);
            if (s < steps) requestAnimationFrame(step(s + 1));
            else resolve();
        };
        
        requestAnimationFrame(step(0));
    });
}

// Smooth interpolation with ease-in-out curve
function smoothStep(start, end, t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t // Clamp t to the range [0, 1]
    t = t * t * (3 - 2 * t); // Ease-in-out function
    return start + t * (end - start);
};

// Linear interpolation
function linearStep(start, end, t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t; // Clamp t to the range [0, 1]
    return start + t * (end - start);
}

function fileToText(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onload = e => resolve(e.target.result);
        fileReader.onerror = err => reject(err);
        fileReader.readAsText(file);
    });
}

function setAttributes(element, attributes) {
    if (attributes === undefined) return;
    for (const attr in attributes) element.setAttribute(attr, attributes[attr]);
}

function createElement(type, attributes, text) {
    const element = document.createElement(type);
    setAttributes(element, attributes);
    if (text !== undefined) element.textContent = text;
    return element;
}

function insertElement(type, parent, attributes, text) {
    const element = createElement(type, attributes, text);
    parent.appendChild(element);
    return element;
}


// Events


function onMousedown(e) {
    e.preventDefault();
    document.activeElement?.blur();
    
    STATE.mousedown = true;
    STATE.mousemove = false;
    STATE.mouseX = e.clientX;
    STATE.mouseY = e.clientY;
}

function onMousemove(e) {
    const { clientX, clientY } = e;
    
    if (STATE.mousedown) {
        if (STATE.mouseX !== clientX || STATE.mouseY !== clientY) {
            STATE.mousemove = true;
            STATE.panX += clientX - STATE.mouseX;
            STATE.panY += clientY - STATE.mouseY;
            draw();
        }
    }
    STATE.mouseX = clientX;
    STATE.mouseY = clientY;
}

function onMouseup(e) {
    if (!STATE.mousemove && e.button === 0) {
        const card = e.target.closest('.card');
        if (card) onCardClick(e, card);
    }
    
    STATE.mousedown = false;
    STATE.mousemove = false;
}

function onWheel(e) {
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const prevScale = STATE.scale;
    const prevPanX = STATE.panX;
    const prevPanY = STATE.panY;

    const wheel = e.deltaY < 0 ? 1 : -1;
    const zoom = Math.exp(wheel * SCALE_ZOOM_INTENSITY);
    const newScale = Math.max(Math.min(prevScale * zoom, SCALE_MAX), SCALE_MIN);

    if (prevScale === newScale) return;
    
    const newPanX = mouseX - (mouseX - prevPanX) * (newScale / prevScale);
    const newPanY = mouseY - (mouseY - prevPanY) * (newScale / prevScale);

    STATE.scale = newScale;
    STATE.panX = newPanX;
    STATE.panY = newPanY;
    draw();
    return;
}

function onKeydown(e) {
    // Set focus to search input instead of default page search
    if (e.ctrlKey && e.code === 'KeyF') {
        e.preventDefault();
        searchInput.focus();
    }
}

function onDragenter(e) {
    const dt = e.dataTransfer;
    if (!dt || !dt.types.includes('Files')) return;
    e.preventDefault();

    const allowedTypes = ['application/json'];
    const items = e.dataTransfer.items;
    const allowDrop = Array.from(items).some(item => allowedTypes.includes(item.type));

    document.body.classList.add('hovering-drop', allowDrop ? 'correct-drop' : 'incorrect-drop');
}

function onDrop(e) {
    document.body.classList.remove('hovering-drop', 'correct-drop', 'incorrect-drop');
    const dt = e.dataTransfer;
    e.preventDefault();

    const allowedTypes = ['application/json'];
    const file = Array.from(dt.files).find(file => allowedTypes.includes(file.type));
    if (!file) return;

    importJsonFile(file);
}

function onDragleave(e) {
    if (e.relatedTarget && document.body.contains(e.target)) return;
    document.body.classList.remove('hovering-drop', 'correct-drop', 'incorrect-drop');
}

cardsContainer.addEventListener('mousedown', onMousedown);
document.addEventListener('mousemove', onMousemove, { passive: true });
document.addEventListener('mouseup', onMouseup);
document.addEventListener('wheel', onWheel, { passive: true });
document.addEventListener('keydown', onKeydown);
document.body.addEventListener('dragover', e => e.preventDefault());
document.body.addEventListener('drop', onDrop);
document.body.addEventListener('dragenter', onDragenter);
document.body.addEventListener('dragleave', onDragleave);

// Start do things

emptyAll();
if (ISLOCAL) {
    addNotify('🏠 Local mode', 8000);
    console.log('🏠 Local mode\nℹ️ Index loading was skipped because the page was opened from a file');
    document.getElementById('toggle-advanced-settings')?.click();
} else {
    const dataListSelector = document.getElementById('data-list');
    fetch(INDEX_URL).then(response => response.json()).then(index => {
        index.forEach(item => INDEX.push(item));
        let selectItemIndex = 0;
        INDEX.forEach((item, i) => {
            if (item.id === SELECTED_DATA_FROM_URL) selectItemIndex = i;
            insertElement('option', dataListSelector, { value: i, 'data-title': item.title }, `${item.title} *`);
        });
        dataListSelector.value = selectItemIndex;
        selectData(selectItemIndex);
    });
}


// Convert old data to new format

function convertOldDataToNewFormat(data, name) {
    const newData = {
        name: name ?? `unknown (${data.length})`,
        spaces: [
            'Nomic Vision'
        ],
        kv: {
            // resolution from old viewer
            width: 256,
            height: 256 * 1.46
        },
        proj: []
    };
    data.forEach(d => {
        const { x, y, x2, y2, title, image } = d;
        const point = {
            image,
            title,
            spaces: [
                { x, y }
            ]
        };
        if (x2 && y2) point.spaces.push({ x: x2, y: y2 });
        newData.proj.push(point);
    });
    if (newData.proj[0].spaces.length === 2) newData.spaces.push('SDLX Pooled Text Encoders');
    return newData;
}
