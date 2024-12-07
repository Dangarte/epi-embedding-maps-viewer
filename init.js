// Version info
const VERSION = '7.12.24'; // Last modified date

// Online info
const HOST = 'https://dangarte.github.io/epi-embedding-maps-viewer';
const INDEX_URL = `${HOST}/data/index.json`;
const ISLOCAL = !window.location?.href?.startsWith(HOST);
const SELECTED_DATA_FROM_URL = !ISLOCAL ? new URLSearchParams(window.location.search).get('json-id') || null : null;

// Preferences
const ISDARK = window.matchMedia('(prefers-color-scheme: dark)').matches;

// Display options
const PAGE_BACKGROUND = ISDARK ? '#000' : '#eee';
const CARD_STYLE = {
    fontSize: 24,
    font: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
    // font: 'Arial, Helvetica, sans-serif',
    color: ISDARK ? '#dedfe2' : '#232529',
    colorDim: ISDARK ? '#6d6f76' : '#9da3b2',
    backgroundColor: ISDARK ? '#232529' : '#dedfe2',
    btnBackgroundColor: ISDARK ? '#3b3d45' : '#e3e3e3',
    btnBackgroundColorHover: ISDARK ? '#525660' : '#c8e1ff',
    borderColor: ISDARK ? '#464953' : '#757a8a',
    borderWidth: 1,
    padding: 6,
    borderRadius: 10,
    lineHeight: 1.3,
    matchedColor: '#ff272f',
};

// Optimization
const CANVAS_SMOOTHING = true; // anti-aliasing
const CANVAS_SMOOTHING_QUALITY = 'low'; // quality of anti-aliasing: low, medium, high
const CANVAS_TEXT_QUALITY = 'optimizeLegibility'; // canvas textRendering option: optimizeSpeed, optimizeLegibility, geometricPrecigion
const CANVAS_WEBGL = false; // Use webgl context instead of 2d // TODO
// Perhaps it makes sense to redesign the preview system from "at a certain size" to "at a certain number on the screen"
const CARD_PREVIEW_SCALING = [ // List of aviable preview scales (Sorted by scale, lower first)
    { id: 'micro', title: 'Micro preview', scale: .018, quality: .65 },
    { id: 'tiny', title: 'Tiny preview', scale: .06, quality: .8 },
    { id: 'small', title: 'Small preview', scale: .18, quality: .95 },
    { id: 'preview', title: 'Preview', scale: .4, quality: 1 }, // Recommended set quality to 1 at first preview (because it's more noticeable if it's of lower quality)
    // id - Internal size identifier (Must be unique)
    // title - Size name, needed to display in status
    // scale - Size at which to move to the next quality
    // quality - Preview Quality (Internal size multiplier)
];
const CARD_SCALE_PREVIEW = CARD_PREVIEW_SCALING.at(-1).scale; // At this scale elements changed to preview canvas (set to 0 for disable)
const CARD_MATCHED_RECT_INSTEAD_IMAGE_AT = 3; // Draw rectangle instead of matched image if it is smaller than this (in px)
const SORT_SEARCH_BY_PROXIMITY = true; // Sort search results by distance. That is, when going to a result, go to the nearest card, instead of the standard order.
const CONVERT_PREVIEW_CANVAS_TO_IMAGE = false; // Convert preview canvas to image (not recommended, it takes a long time to convert, then it takes a long time to "decode image", but use less VRAM (if GPU acceleration is enabled) and fix OOM browser errors)

// Zooming
const SCALE_BASE = .6; // Default Zoom
const SCALE_MAX = 4; // Maximum zoom
const SCALE_MIN = .004; // Minimum zoom
const SCALE_SEARCH = .6; // Zoom when moving to search element
const SCALE_ZOOM_INTENSITY = .18; // Zoom Intensity

// Panning
const PANNING_INERTIA_FRICTION = .95; // Friction force when applying inertia after panning (Less - faster stop)
const PANNING_INERTIA_TOUCH = true; // Apply inertia on touches
const PANNING_INERTIA_MOUSE = false; // Apply inertia on mouse

// Index of sources
const INDEX = [];

// Define canvas
const CANVAS_WIDTH = window.innerWidth;
const CANVAS_HEIGHT = window.innerHeight;
const cardsContainer = document.getElementById('image-cards');
const cardsCanvas = document.getElementById('image-canvas');
const cardsCanvasCtx = getCanvasContext(cardsCanvas, CANVAS_WIDTH, CANVAS_HEIGHT);

// Define icons
const ICON_COPY = document.querySelector('.icon[data-icon="copy"]')?.cloneNode(true);
const ICON_BOOK = document.querySelector('.icon[data-icon="book"]')?.cloneNode(true);

// Define page elements
const searchInput = document.getElementById('search');
const searchGoToNextButton = document.getElementById('goto-search');
const searchClearButton = document.getElementById('search-clear');
const statusElement = document.getElementById('cards-in-viewport');
const graphSVG = document.getElementById('graph-svg');
graphSVG.setAttribute('viewBox', `0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`);

// Insert card styles in page
CARD_STYLE.lineHeight = String(CARD_STYLE.lineHeight);
const cardStyleConfigsElement = insertElement('style', document.head);
cardStyleConfigsElement.textContent = `:root {${Object.keys(CARD_STYLE).map(key => `--card-${key}: ${ typeof CARD_STYLE[key] !== 'number' ? CARD_STYLE[key] : `${CARD_STYLE[key]}px` };`).join(' ')} }`;
CARD_STYLE.lineHeight = Number(CARD_STYLE.lineHeight);

// Current viewer state
const STATE = {
    ready: false,
    source: {},
    data: [],
    edges: null,
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
    velocityX: 0,
    velocityY: 0,
    mousedown: false,
    mousemove: false,
    altKey: false,
    isZooming: false,
    pinchDistance: null,
    filter: null,
    matched: [],
    notMatched: [],
    selectedGraph: -1,
};


// Controller classes


class CardsPreviewController {
    data = [];
    grid = { layers: [], cellWidth: 0, cellHeight: 0 };
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
        const cardsCount = data.length;
        const cardWidthReal = Math.max(...data.map(item => item.width)) * scale;
        const cardHeightReal = Math.max(...data.map(item => item.height)) * scale;
        const isSizeOk = Math.min(cardWidthReal, cardHeightReal) >= 1;
        const reScale = isSizeOk ? 1 : 1 / Math.min(cardWidthReal, cardHeightReal);

        const cellWidth = Math.round(cardWidthReal * reScale);
        const cellHeight = Math.round(cardHeightReal * reScale);
        this.scale = scale * reScale;

        const gridSizeX = Math.floor(maxWidth/cellWidth);
        const gridSizeY = Math.ceil(cardsCount/gridSizeX);
        const maxGridY = Math.floor(maxHeight/cellHeight);

        const layers = [];
        const pushCanvas = (gridSizeX, gridSizeY) => {
            const width = gridSizeX * cellWidth;
            const height = gridSizeY * cellHeight;
            const canvas = new OffscreenCanvas(width, height);
            layers.push({ canvas, width, height, gridSizeX, gridSizeY });
        }
        this.grid = { cellWidth, cellHeight, layers };

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
        const borderWidthX2 = borderWidth * 2;
        const borderRadius = Math.round(CARD_STYLE.borderRadius * scale);
        const borderRadiusInside = borderRadius - padding;
        const hasReference = Boolean(referenceController);
        const { cellWidth, cellHeight, layers } = this.grid;
        const contentOffset = padding + borderWidth;
        const lineHeight = fontSize * CARD_STYLE.lineHeight;
        const controls = [ 'wiki', 'copy' ];
        const controlsWidth = controls.length * fontSize + (controls.length - 1) * fontSize * .125;
        const fontString = `normal ${fontSize}px ${CARD_STYLE.font}`;
        let ctx, gridSizeX, gridSizeY, layerMaxCards, currentLayerIndex = 0, cardOffsetY = 0;
        const referenceLayers = hasReference ? referenceController.grid.layers : null;
        const refCardWidth = hasReference ? referenceController.grid.cellWidth : null;
        const refCardHeight = hasReference ? referenceController.grid.cellHeight : null;
        let refCanvas, refGridX, refGridY, refCardsCount, refCurrentLayerIndex = 0, refCardOffsetY = 0;
        const selectLayer = async i =>  {
            if (gridSizeY) cardOffsetY += gridSizeY * cellHeight;

            if (CONVERT_PREVIEW_CANVAS_TO_IMAGE && currentLayerIndex !== i) layers[currentLayerIndex].canvas = await convertCanvasToImage(layers[currentLayerIndex].canvas);

            ctx = getCanvasContext(layers[i].canvas);

            ctx.font = fontString;
            ctx.fillStyle = CARD_STYLE.backgroundColor;

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

        // Generate controls and common background template
        let controlsTemplate = null;
        const cardTemplates = {};
        if (!hasReference) {
            controlsTemplate = new OffscreenCanvas(controlsWidth, fontSize);
            const templateCtx = controlsTemplate.getContext('2d', { alpha: true });
            templateCtx.imageSmoothingEnabled = CANVAS_SMOOTHING;
            templateCtx.imageSmoothingQuality = CANVAS_SMOOTHING_QUALITY;

            templateCtx.fillStyle = CARD_STYLE.btnBackgroundColor;

            controls.forEach((type, i) => {
                templateCtx.roundRect(i * 1.125 * fontSize, 0, fontSize, fontSize, borderRadiusInside);
                templateCtx.fill();
            });

            const TEMPLATE_MIN_COUNT = 200;
            STATE.sizes.forEach(item => {
                const { key, width, height, count } = item;
                if (count < TEMPLATE_MIN_COUNT) return;
                const scaledWidth = Math.round(width * scale);
                const scaledHeight = Math.round(height * scale);
                const image = this.data.find(item => item.sizeKey === key).image;
                const imageWidth = Math.round(image.width * scale);
                const imageHeight = Math.round(image.height * scale);
                const cardTemplate = new OffscreenCanvas(scaledWidth, scaledHeight);
                const templateCtx = cardTemplate.getContext('2d', { alpha: true });
                templateCtx.imageSmoothingEnabled = CANVAS_SMOOTHING;
                templateCtx.imageSmoothingQuality = CANVAS_SMOOTHING_QUALITY;

                templateCtx.fillStyle = CARD_STYLE.backgroundColor;
                templateCtx.strokeStyle = CARD_STYLE.borderColor;
                templateCtx.lineWidth = borderWidth;

                const cardRoundedClipPath = getRoundedRectPath(scaledWidth - borderWidthX2, scaledHeight - borderWidthX2, borderRadius);

                if (borderWidth) templateCtx.translate(borderWidth, borderWidth);

                templateCtx.fill(cardRoundedClipPath);
                if (borderWidth) templateCtx.stroke(cardRoundedClipPath);

                templateCtx.translate(padding, padding);

                if (borderWidth) templateCtx.stroke(getRoundedRectPath(imageWidth + borderWidthX2, imageHeight + borderWidthX2, borderRadiusInside, -borderWidth, -borderWidth));

                templateCtx.drawImage(controlsTemplate, scaledWidth - contentOffset - controlsWidth, scaledHeight - contentOffset - fontSize);

                templateCtx.clip(getRoundedRectPath(imageWidth, imageHeight, borderRadiusInside));
                templateCtx.clearRect(0, 0, imageWidth, imageHeight);

                cardTemplates[key] = cardTemplate;
            });
        }

        await selectLayer(currentLayerIndex);
        if (hasReference) selectRefLayer(refCurrentLayerIndex);

        for(let index = 0; index < count; index++) {
            const info = this.data[index];
            const { image, lines, width, height, sizeKey } = info;

            if (layerMaxCards <= 0) await selectLayer(currentLayerIndex + 1);

            const scaledWidth = Math.round(width * scale);
            const scaledHeight = Math.round(height * scale);

            const x = (index % gridSizeX) * cellWidth;
            const y = Math.floor(index / gridSizeX) * cellHeight - cardOffsetY;
            info[key] = { x, y, width: scaledWidth, height: scaledHeight, layer: currentLayerIndex };

            if (hasReference) {
                if (refCardsCount <= 0) selectRefLayer(refCurrentLayerIndex + 1);

                const refX = (index % refGridX) * refCardWidth;
                const refY = Math.floor(index / refGridX) * refCardHeight - refCardOffsetY;

                ctx.drawImage(refCanvas, refX, refY, refCardWidth, refCardHeight, x, y, cellWidth, cellHeight);

                refCardsCount--;
            } else {
                ctx.translate(x, y);
                const imageWidth = Math.round(image.width * scale);
                const imageHeight = Math.round(image.height * scale);
                const textOffsetY = imageHeight + fontSize + padding;

                if (cardTemplates[sizeKey]) {
                    ctx.drawImage(image, contentOffset, contentOffset, imageWidth, imageHeight);
                    ctx.drawImage(cardTemplates[sizeKey], 0, 0);
                } else {
                    ctx.save();
                    if (borderWidth) ctx.translate(borderWidth, borderWidth);

                    const cardRoundedClipPath = getRoundedRectPath(scaledWidth - borderWidthX2, scaledHeight - borderWidthX2, borderRadius);
                    ctx.fillStyle = CARD_STYLE.backgroundColor;
                    ctx.fill(cardRoundedClipPath);
                    if (borderWidth) ctx.stroke(cardRoundedClipPath);

                    ctx.translate(padding, padding);

                    ctx.drawImage(controlsTemplate, scaledWidth - contentOffset - controlsWidth, scaledHeight - contentOffset - fontSize);

                    if (borderWidth) ctx.stroke(getRoundedRectPath(imageWidth + borderWidthX2, imageHeight + borderWidthX2, borderRadiusInside, -borderWidth, -borderWidth));

                    ctx.clip(getRoundedRectPath(imageWidth, imageHeight, borderRadiusInside));
                    ctx.drawImage(image, 0, 0, imageWidth, imageHeight);
                    ctx.restore();
                }

                ctx.fillStyle = CARD_STYLE.color;
                ctx.translate(contentOffset, contentOffset);
                lines.forEach((line, i) => ctx.fillText(line, 0, textOffsetY + i * lineHeight));

                ctx.translate(-x - contentOffset, -y - contentOffset);
            }
            layerMaxCards--;
        }

        // Convert last layer if need
        if (CONVERT_PREVIEW_CANVAS_TO_IMAGE) layers[currentLayerIndex].canvas = await convertCanvasToImage(layers[currentLayerIndex].canvas);

        // Clear template
        if (!hasReference) {
            controlsTemplate.width = 0;
            controlsTemplate.height = 0;
            controlsTemplate = null;
            Object.keys(cardTemplates).forEach(key => {
                const cardTemplate = cardTemplates[key];
                cardTemplate.width = 0;
                cardTemplate.height = 0;
            });
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

        this.gridSizeX = cellSizeX;
        this.gridSizeY = cellSizeY;
    }

    async overlapFix() {
        if (!STATE.ready || this.isActive) return;
        this.isActive = true;
        this.updatePoints();
        const spacing = STATE.spacing;
        const isGraph = Boolean(STATE.edges);

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

        let converged = false, iteration = 0;
        for(iteration = 0; iteration < maxIterations; iteration++) {
            if (STATE.spacing !== spacing) break;
            
            updateGrid();
            converged = simulateRepulsionForces();
            syncPointsWithData();
            if (!converged) {
                await draw();
                if (isGraph) updateGraph();
            }
    
            if (iteration === forceScaleResetAt) forceScale = forceScaleResetTo;
            if (forceScale > forceScaleMin) forceScale -= forceScaleStep;
    
            if (converged) break;
        }

        if (converged && iteration) {
            await draw();
            if (isGraph) updateGraph();
        }
        
        if (iteration) addNotify(converged ? 'The overlap has been fixed' : 'Failed to fix overlap, please try again');
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


// Functions for work with data


async function selectData(id) {
    id = Number(id);
    const key = INDEX[id]?.id ?? 'unknown';
    const loaderPrefix = '[Loader]';
    const cCode = 'background-color: #264f73; color: #c5d9eb; padding: .125em .5em; border-radius: .25em;';
    const loading = document.getElementById('loading') ?? createElement('div', { id: 'loading' });
    document.body.classList.add('loading');
    let loadingStatus = '';
    const setLoadingStatus = async text => {
        if (loadingStatus) console.timeEnd(loadingStatus);
        loading.textContent = text;
        await new Promise(r => setTimeout(r, 0)); // A hack to make the browser render the text
        loadingStatus = `${loaderPrefix} ${text}`;
        console.time(loadingStatus);
    };
    document.body.appendChild(loading);

    STATE.ready = false;
    console.log(`${loaderPrefix} Start loading %c${key}`, cCode);

    // Reset cache state in prev data
    await setLoadingStatus('Unloading data');
    searchInput.value = '';
    STATE.filter = '';
    STATE.edges = null;
    STATE.renderedScale = null;
    STATE.previewControllers = {};
    const keysToClear = [...CARD_PREVIEW_SCALING.map(i => i.id), 'cardElement', 'titleLowerCase', 'index', ];
    STATE.data.forEach(d => {
        keysToClear.forEach(key => {
            if (d[key]) delete d[key];
        });
    });
    delete STATE.maxCardWidth;
    delete STATE.maxCardHeight;
    cardsContainer.textContent = '';

    // Load data from file
    await setLoadingStatus('Loading data');
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
    STATE.space = 0;
    const switchEmbList = document.getElementById('switch-spaces');
    switchEmbList.textContent = '';
    STATE.source.spaces.forEach((title, index) => insertElement('option', switchEmbList, { value: index }, title));
    switchEmbList.value = STATE.space;

    await setLoadingStatus('Decoding images');
    await processImages(STATE.data);

    await setLoadingStatus('Calculating card sizes');
    recalcCardSizes(STATE.data);
    const sizes = {};
    STATE.data.forEach(item => {
        const key = `${item.width},${item.height}`;
        if (sizes[key]) sizes[key]++;
        else sizes[key] = 1;
        item.sizeKey = key;
    });
    STATE.sizes = Object.keys(sizes).map(key => {
        const [ width, height ] = key.split(',').map(a => Number(a));
        return { width, height, key, count: sizes[key] };
    }).sort((a, b) => b.count - a.count);
    STATE.maxCardWidth = Math.max(...STATE.data.map(item => item.width));
    STATE.maxCardHeight = Math.max(...STATE.data.map(item => item.height));
    
    await setLoadingStatus('Generating preview');
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

    // Create physics controller
    STATE.physics = new CardsPhysicController(STATE.data, STATE.maxCardWidth, STATE.maxCardHeight);

    await setLoadingStatus('Calculating the position of the cards');
    selectSpace(STATE.data, STATE.space);
    if (STATE.source.spaces.length > 1) document.getElementById('switch-spaces')?.parentElement?.removeAttribute('disabled');
    else document.getElementById('switch-spaces')?.parentElement?.setAttribute('disabled', '');

    // Set data info to edges
    if (data.edges) {
        STATE.edges = data.edges;
        const nodes = STATE.data;
        const nodesMap = new Map();
        nodes.forEach(node => nodesMap.set(node.id, node));
        STATE.edges.forEach(edge => {
            edge.nodeFrom = nodesMap.get(edge.from);
            edge.nodeTo = nodesMap.get(edge.to);
        });
    }

    console.timeEnd(loadingStatus);
    loading.remove();
    document.body.classList.remove('loading');

    STATE.ready = true;
    console.log(`${loaderPrefix} Loading %c${key}%c ready`, cCode, '');
    recenterView(false);
    
    STATE.selectedGraph = -1;
    updateGraph();

    document.getElementById('data-list')?.parentElement?.removeAttribute('disabled');

    // Remove the asterisk from the title to indicate that the data has been loaded
    const option = document.querySelector(`#data-list option[value="${id}"]`);
    if (option) option.textContent = INDEX[id].title;
}

function selectSpace(data, space) {
    const spacing = STATE.spacing;
    const dataCountSpacingFactor = 1024;
    const maxDataSpacingFactor = 3;

    const skipThisCards = new Set();

    // Select data
    data.forEach((d, i) => {
        const sp = d.spaces[space];
        d.x = sp.x;
        d.y = sp.y;
        if (sp.positionAbsolute) skipThisCards.add(i);
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

    data.forEach((d, i) => {
        if (skipThisCards.has(i)) return;
        d.x = (d.x - minX) * scaleFactor + offsetX;
        d.y = (d.y - minY) * scaleFactor + offsetY;
    });

    STATE.renderedScale = null;
    STATE.physics.updatePoints();
}

function recalcCardSizes(data) {
    const image = data[0].image;
    const padding = CARD_STYLE.padding + CARD_STYLE.borderWidth;
    const additionalWidth = padding * 2;
    const additionalHeight = padding * 4 + CARD_STYLE.fontSize; // padding * 2 + controls margin-top + text margin-top
    const lineHeight = CARD_STYLE.fontSize * CARD_STYLE.lineHeight;

    const measuringCanvas = new OffscreenCanvas(image.width, image.height);
    const measuringCtx = measuringCanvas.getContext('2d');
    measuringCtx.font = `normal ${CARD_STYLE.fontSize}px ${CARD_STYLE.font}`;

    const charMeasureCache = new Map();
    const splitTextIntoChunks = text => {
        let chunks = [];
        let currentChunk = '';

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            if (char !== ' ' && char !== '-') currentChunk += char;
            else if (currentChunk) {
                chunks.push(currentChunk + char);
                currentChunk = '';
            }
        }

        if (currentChunk) chunks.push(currentChunk);

        return chunks;
    };
    const measureChar = char => {
        const charWidth = measuringCtx.measureText(char).width;
        charMeasureCache.set(char, charWidth);
        return charWidth;
    };
    const measureText = text => {
        let width = 0;
        for(let i = text.length - 1; i >= 0; i--) width += charMeasureCache.get(text[i]) ?? measureChar(text[i]);
        return width;
    };
    const prepareLines = (text, maxWidth) => {
        const words = splitTextIntoChunks(text);
        let line = '';
        let testLineWidth = 0;
        const lines = [];

        for (const word of words) {
            const wordWidth = measureText(word);
            
            if (testLineWidth + wordWidth > maxWidth && line) {
                lines.push(line);
                line = word;
                testLineWidth = wordWidth;
            } else {
                line += word;
                testLineWidth += wordWidth;
            }

        }

        lines.push(line);
        return lines;
    };

    data.forEach(item => {
        const { image, title } = item;
        const { width: w, height: h } = image;
        const lines = prepareLines(title, w);
        item.lines = lines;
        item.width = Math.round(w + additionalWidth);
        item.height = Math.round(h + lineHeight * lines.length + additionalHeight);
    });

    measuringCanvas.width = 0;
    measuringCanvas.height = 0;
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

async function switchEmb(embIndex, animate = true) {
    const duration = 1500;
    const data = STATE.data;
    STATE.space = embIndex;

    const targets = data.map(d => ({ prevX: d.x, prevY: d.y, }));
    selectSpace(data, STATE.space);
    targets.forEach((d, index) => {
        d.newX = data[index].x;
        d.newY = data[index].y;
        d.deltaX = d.newX - d.prevX;
        d.deltaY = d.newY - d.prevY;
    });

    if (animate) {
        const timeStart = Date.now();
        const timeEnd = timeStart + duration;
        let timeNow = Date.now();

        const step = async t => {
            const scale = STATE.scale;
            const factor = smoothStepFactor(t);
    
            data.forEach((d, i) => {
                const { prevX, prevY, deltaX, deltaY } = targets[i];
                d.x = prevX + factor * deltaX;
                d.y = prevY + factor * deltaY;
                d.scaledX = d.x * scale;
                d.scaledY = d.y * scale;
            });
    
            await draw();
            if (STATE.edges) updateGraph();
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
        if (STATE.edges) updateGraph();
    }
}

async function fetchData(id) {
    if (!INDEX[id].url) throw new Error('No download link');
    const json = await fetch(INDEX[id].url).then(response => response.json());
    let newData = json;

    // Convert to current format
    if (Array.isArray(json)) newData = convertOldDataToNewFormat(json, INDEX[id].id);
    else if (Array.isArray(json.edges) && Array.isArray(json.nodes)) newData = convertGraphToNormal(json);

    // TODO Checking the format (are all the required fields present)

    INDEX[id].data = newData;
    return newData;
}

async function importJsonFile(file) {
    addNotify(`📄 ${file.name}`, 4000);

    const key = file.name;
    let dataIndex = -1;
    let dataType = null;
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

            if (Array.isArray(json)) {
                // spaces old
                dataType = 'spaces';
                newData = convertOldDataToNewFormat(json, key);
            }
            else if (json.name && Array.isArray(json.spaces) && json.kv && Array.isArray(json.proj)) {
                // spaces
                dataType = 'spaces';
                const spacesCount = json.spaces.length;
                if (json.proj.some(d => !d.title || !d.image || d.spaces.length < spacesCount)) {
                    throw new Error('Wrong file structure (wrong proj list)');
                }
            } else if (json.name && Array.isArray(json.edges) && Array.isArray(json.nodes)) {
                // graphs
                dataType = 'graphs';
                newData = convertGraphToNormal(json);
            }
            else {
                throw new Error('Wrong file structure');
            }


            dataIndex = INDEX.length;
            INDEX.push({ id: key, title: key, type: dataType, data: newData, description: `Imported from file "${file.name}"` });

            const dataListSelector = document.getElementById('data-list');
            insertElement('option', dataListSelector, { value: dataIndex }, key);
            dataListSelector.value = dataIndex;
        } catch (err) {
            console.error(err);
            loading.remove();
            document.body.classList.remove('loading');
            addNotify('❌ Import error', 6000);
        }
    }

    if (dataIndex !== -1) selectData(dataIndex);
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

function convertGraphToNormal(data) {
    data.proj = data.nodes.map((node, i) => ({ id: node.id, title: node.prompt, index: i, image: node.image, edges: [], spaces: [] }));
    delete data.nodes;

    // Find node indices for a graph
    const nodesMap = new Map();
    const nodesTree = {};
    data.proj.forEach(node => nodesMap.set(node.id, node));
    data.edges.forEach((edge, i) => {
        const nodeFrom = nodesMap.get(edge.from);
        const nodeTo = nodesMap.get(edge.to);
        if (!nodeFrom.edges.includes(i)) nodeFrom.edges.push(i);
        if (!nodeTo.edges.includes(i)) nodeTo.edges.push(i);
        edge.indexFrom = nodeFrom.index;
        edge.indexTo = nodeTo.index;
        if (nodesTree[edge.from]) nodesTree[edge.from].push({ id: edge.to });
        else nodesTree[edge.from] = [{ id: edge.to }];
    });

    const hasParent = new Set();
    Object.keys(nodesTree).forEach(branchId => {
        const branches = nodesTree[branchId];
        branches.forEach((branch, i) => {
            if (!branch.branches && nodesTree[branch.id]) {
                branch.branches = nodesTree[branch.id];
                hasParent.add(branch.id);
            }
        });
    });
    Object.keys(nodesTree).forEach(branchId => {
        if (hasParent.has(branchId)) delete nodesTree[branchId];
    });

    const treeLayout = layoutTree(nodesTree, data.edges.length);

    // Create spaces
    data.spaces = ['Tree', 'FCose Layout (placeholder)', 'Random'];
    data.proj.forEach(node => {
        // Tree
        const treeSpace = treeLayout.get(node.id) ?? { x: 0, y: 0 };
        node.spaces.push({ x: treeSpace.x, y: treeSpace.y, positionAbsolute: true });

        // FCose Layout
        // TODO
        node.spaces.push({ x: Math.random() * CANVAS_WIDTH, y: Math.random() * CANVAS_HEIGHT });

        // Random
        node.spaces.push({ x: Math.random() * CANVAS_WIDTH, y: Math.random() * CANVAS_HEIGHT });
    });

    return data;

    function layoutTree(nodesTree, nodesCount) {
        const xGap = 500;
        const yGap = 1000;
        const lastRowHeight = Math.max(2, Math.ceil(nodesCount/200));

        const nodePositions = new Map();
        let currentX = 0;
        let i = 0;

        function placeNode(branch, depth) {
            const y = depth * yGap;

            if (branch.branches && branch.branches.length > 0) {
                const childXPositions = branch.branches.map(child => placeNode(child, depth + 2));
                let xMin = Infinity, xMax = -Infinity;
                for (const xPos of childXPositions) {
                    if (xPos < xMin) xMin = xPos;
                    if (xPos > xMax) xMax = xPos;
                }
                const x = (xMin + xMax) / 2;
                nodePositions.set(branch.id, { x, y });
                return x;
            } else {
                i++;
                const x = currentX;
                nodePositions.set(branch.id, { x, y: y + (i%lastRowHeight) * yGap });
                currentX += xGap;
                return x;
            }
        }

        for (const rootId in nodesTree) {
            const rootBranches = nodesTree[rootId];
            placeNode({ id: rootId, branches: rootBranches }, 0);
        }

        return nodePositions;
    }
}


// Functions for render data


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

function render() {
    if (!STATE.ready) return;
    const { panX, panY, scale, data, filter } = STATE;
    const isScaleChanged = STATE.renderedScale !== scale;

    render_updateCSSProperty();

    if (isScaleChanged) render_recalcRenderScale();
    const { maxCardWidth, maxCardHeight, mathcedOutlineImages, outlineWidth, borderRadius, drawOnlyMatchedOutline } = STATE.renderedScaleCache;
    const outlineWidthHalf = outlineWidth / 2;

    let visibleCardsCount = 0;

    const useElements = scale > CARD_SCALE_PREVIEW;

    const viewportXStart = -panX - maxCardWidth;
    const viewportXEnd = -panX + CANVAS_WIDTH;
    const viewportYStart = -panY - maxCardHeight;
    const viewportYEnd = -panY + CANVAS_HEIGHT;

    // Apply scale and offset to canvas
    if (!useElements) {
        cardsCanvasCtx.save();
        cardsCanvasCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        cardsCanvasCtx.translate(panX, panY);

        cardsCanvasCtx.fillStyle = CARD_STYLE.matchedColor;
        cardsCanvasCtx.strokeStyle = CARD_STYLE.matchedColor;
        cardsCanvasCtx.lineWidth = outlineWidth;
    }

    const drawItem = (d, isMatched) => {
        const { scaledX, scaledY, scaledWidth, scaledHeight } = d;
        if (scaledX < viewportXStart || scaledX > viewportXEnd || scaledY < viewportYStart || scaledY > viewportYEnd) return;
        visibleCardsCount++;

        const { x: pointX, y: pointY, width: previewWidth, height: previewHeight, canvas } = d.previewInfo;
        if (isMatched) {
            if (!drawOnlyMatchedOutline) cardsCanvasCtx.drawImage(canvas, pointX, pointY, previewWidth, previewHeight, scaledX, scaledY, scaledWidth, scaledHeight);
            const outlineImage = mathcedOutlineImages.get(d.sizeKey);
            if (outlineImage) cardsCanvasCtx.drawImage(outlineImage, scaledX - outlineWidth, scaledY - outlineWidth);
            else {
                if (drawOnlyMatchedOutline) cardsCanvasCtx.fill(getRoundedRectPath(scaledWidth + outlineWidth, scaledHeight + outlineWidth, borderRadius, scaledX - outlineWidthHalf, scaledY - outlineWidthHalf));
                else cardsCanvasCtx.stroke(getRoundedRectPath(scaledWidth, scaledHeight, borderRadius, scaledX, scaledY));
            }
        } else cardsCanvasCtx.drawImage(canvas, pointX, pointY, previewWidth, previewHeight, scaledX, scaledY, scaledWidth, scaledHeight);
    };
    const moveElement = (d, isMatched) => {
        const { scaledX, scaledY } = d;
        if (scaledX < viewportXStart || scaledX > viewportXEnd || scaledY < viewportYStart || scaledY > viewportYEnd) {
            if (d.cardElement?.inDOM) render_removeCardElementFromDOM(d.cardElement);
            return;
        }
        visibleCardsCount++;

        const { style, matched, inDOM, filter: f } = d.cardElement ?? render_createCardElement(d);
        style.left = `${scaledX + panX}px`;
        style.top = `${scaledY + panY}px`;

        if (f !== filter) render_updateCardMatchedHint(d.cardElement, filter);
        if (matched !== isMatched) render_toogleCardElementMatch(d.cardElement, isMatched);
        if (!inDOM) render_appendCardElementToDOM(d.cardElement);
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

    if (!useElements) cardsCanvasCtx.restore();

    STATE.visibleCardsCount = visibleCardsCount;
    updateStatsOnPage();
}

function render_recalcRenderScale() {
    // Calc current render info
    const { scale, data, maxCardWidth, maxCardHeight } = STATE;
    const useElements = scale > CARD_SCALE_PREVIEW;
    const previewScaleCurrent = !useElements ? CARD_PREVIEW_SCALING.find(i => scale <= i.scale) : null;

    const { maxCardWidth: w, maxCardHeight: h } = STATE;

    const scaledW = w * scale;
    const scaledH = h * scale;

    let mathcedOutlineImages = STATE.renderedScaleCache?.mathcedOutlineImages ?? null;
    let drawOnlyMatchedOutline = false;
    const outlineWidth = 2;
    const borderRadius = CARD_STYLE.borderRadius * scale;

    // Update scaled position
    data.forEach(d => {
        d.scaledX = d.x * scale;
        d.scaledY = d.y * scale;
        d.scaledWidth = d.width * scale;
        d.scaledHeight = d.height * scale;
    });

    // Update previews

    const renderedScale = STATE.renderedScale;
    const renderedElements = renderedScale > CARD_SCALE_PREVIEW;
    const renderedPreviewScaleCurrent = !renderedElements ? CARD_PREVIEW_SCALING.find(i => renderedScale <= i.scale) : null;

    const emptyMatchedOutline = () => {
        if (mathcedOutlineImages === null) return;
        mathcedOutlineImages.forEach(offscreenCanvas => {
            offscreenCanvas.width = 0;
            offscreenCanvas.height = 0;
        })
        mathcedOutlineImages = null;
    };

    render_updateCSSProperty();

    if (useElements) {
        if (!renderedElements) cardsCanvasCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        emptyMatchedOutline();
    } else {
        // Remove all elements if they not nedeed
        if (renderedElements) {
            cardsContainer.textContent = '';
            data.forEach(d => d.cardElement ? d.cardElement.inDOM = false : null);
        }

        // Change preview
        if (!renderedPreviewScaleCurrent || renderedPreviewScaleCurrent.id !== previewScaleCurrent.id) {
            const id = previewScaleCurrent.id;
            const layers = STATE.previewControllers[id].grid.layers;
            data.forEach(d => {
                const { x, y, width, height, layer } = d[id];
                d.previewInfo = { x, y, width, height, canvas: layers[layer].canvas };
            });
        }

        // Draw outline for matched cards
        const OUTLINE_PREVIEW_MIN_COUNT = 150;
        drawOnlyMatchedOutline = scaledW < CARD_MATCHED_RECT_INSTEAD_IMAGE_AT;

        emptyMatchedOutline();
        mathcedOutlineImages = new Map();
        STATE.sizes.forEach(item => {
            if (item.count < OUTLINE_PREVIEW_MIN_COUNT) return;
            const { width, height, key } = item;
            const scaledW = Math.round(width * scale);
            const scaledH = Math.round(height * scale);
            const offscreenCanvas = new OffscreenCanvas(scaledW + outlineWidth * 2, scaledH + outlineWidth * 2);

            mathcedOutlineImages.set(key, offscreenCanvas);
            const offscreenCtx = offscreenCanvas.getContext('2d', { alpha: true });
            offscreenCtx.imageSmoothingEnabled = CANVAS_SMOOTHING;
            offscreenCtx.imageSmoothingQuality = CANVAS_SMOOTHING_QUALITY;
            offscreenCtx.translate(outlineWidth, outlineWidth);
            offscreenCtx.strokeStyle = CARD_STYLE.matchedColor;
            offscreenCtx.lineWidth = outlineWidth;
            offscreenCtx.stroke(getRoundedRectPath(scaledW, scaledH, borderRadius));
            if (drawOnlyMatchedOutline) {
                offscreenCtx.fillStyle = CARD_STYLE.matchedColor;
                offscreenCtx.fill(getRoundedRectPath(scaledW, scaledH, borderRadius));
            }
        });
    }

    STATE.renderedScale = scale;
    STATE.renderedScaleCache = { w, h, scaledW, scaledH, maxCardWidth: maxCardWidth * scale, maxCardHeight: maxCardHeight * scale, mathcedOutlineImages, outlineWidth, borderRadius, drawOnlyMatchedOutline };
    STATE.cardScale = useElements ? 'Element' : previewScaleCurrent.title;
}

function render_updateCardMatchedHint(cardElement, filter) {
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

function render_createCardElement(d) {
    const { element, titleElement, searchList } = createCardElement(d);
    const style = element.style;
    style.width = `${Math.round(STATE.renderedScaleCache.w)}px`;
    const searchInfo = d.relatedTags.map(({ title, searchText }, i) => ({ title, searchText, element: searchList[i] }));
    searchInfo.push({ title: d.title, searchText: d.title.toLowerCase(), element: titleElement });
    d.cardElement = { inDOM: false, element, style, title: d.title, searchInfo, matched: false };
    return d.cardElement;
}

function render_removeCardElementFromDOM(cardElement) {
    cardElement.element.remove();
    cardElement.inDOM = false;
}

function render_appendCardElementToDOM(cardElement) {
    cardsContainer.appendChild(cardElement.element);
    cardElement.inDOM = true;
}

function render_toogleCardElementMatch(cardElement, matched) {
    cardElement.element.classList.toggle('card-matched', matched);
    cardElement.matched = matched;
}

function updateStatsOnPage() {
    statusElement.textContent = `${STATE.cardScale} (x${STATE.visibleCardsCount})`;
    // This is for displaying the scale while calibrating the preview size
    // statusElement.textContent = `${+STATE.scale.toFixed(3)}: ${STATE.cardScale} (x${STATE.visibleCardsCount})`;
}

function emptyAllInputs() {
    searchInput.value = '';
    cardsContainer.textContent = '';
    const dataListSelector = document.getElementById('data-list');
    dataListSelector.textContent = '';
    dataListSelector.value = '';
    const switchEmbSelector = document.getElementById('switch-spaces');
    switchEmbSelector.textContent = '';
    switchEmbSelector.value = '';
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

function updateGraph(node = null) {
    graphSVG.textContent = '';

    const GRAPH_PADDING = 12;
    const GRAPH_CONTROL_Y = 100;
    const GRAPH_PARENT_DISPLAY = 8;
    const rectBorderRadius = CARD_STYLE.borderRadius ? CARD_STYLE.borderRadius + GRAPH_PADDING : 4;

    STATE.selectedGraph = node ? node !== -1 ? node.index : -1 : STATE.selectedGraph;

    if (STATE.selectedGraph !== -1) {
        const edges = STATE.edges;
        const nodes = STATE.data;
        const selectedIndex = STATE.selectedGraph;
        const selectedNode = nodes[selectedIndex];
        const graphGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const connectedNodes = new Set();

        const drawParentEdges = (parentNodeIndex, depth = 1) => {
            if (depth > GRAPH_PARENT_DISPLAY) return;
            const parentNode = nodes[parentNodeIndex];
            parentNode.edges.forEach(edgeIndex => {
                const { indexFrom, indexTo } = edges[edgeIndex];
                if (indexTo === parentNodeIndex) {
                    drawEdge(edgeIndex);
                    drawParentEdges(indexFrom, depth + 1);
                }
            });
        };
        const drawEdge = (edgeIndex, nodeClass) => {
            const { indexFrom, indexTo } = edges[edgeIndex];
            const { x: x1, y: y1, width: w1, height: h1 } = nodes[indexFrom];
            const { x: x2, y: y2, width: w2, height: h2 } = nodes[indexTo];

            connectedNodes.add(indexFrom);
            connectedNodes.add(indexTo);

            const startX = x1 + w1 / 2;
            const startY = y1 + h1 + GRAPH_PADDING;
            const endX = x2 + w2 / 2;
            const endY = y2 - GRAPH_PADDING;

            const controlX = (startX + endX) / 2;
            const controlY = Math.min(startY, endY) + GRAPH_CONTROL_Y;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const d = `M ${startX},${startY} Q ${controlX},${controlY} ${endX},${endY}`; // Quadratic curve
            path.setAttribute('d', d);
            if (nodeClass) path.setAttribute('class', nodeClass);

            graphGroup.appendChild(path);
        };
        const drawRect = (nodeIndex, nodeClass) => {
            const { x, y, width, height } = nodes[nodeIndex];

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x - GRAPH_PADDING);
            rect.setAttribute('y', y - GRAPH_PADDING);
            rect.setAttribute('rx', rectBorderRadius);
            rect.setAttribute('ry', rectBorderRadius);
            rect.setAttribute('width', width + GRAPH_PADDING * 2);
            rect.setAttribute('height', height + GRAPH_PADDING * 2);
            if (nodeClass) rect.setAttribute('class', nodeClass);
            graphGroup.appendChild(rect);
        };

        selectedNode.edges.forEach(edgeIndex => {
            const { indexFrom } = edges[edgeIndex];
            drawEdge(edgeIndex, selectedIndex === indexFrom ? 'graph-selected' : null);
            if (indexFrom !== selectedIndex) drawParentEdges(indexFrom);
        });
        
        connectedNodes.forEach(nodeIndex => {
            drawRect(nodeIndex, nodeIndex === selectedIndex ? 'graph-selected' : null);
        });

        graphSVG.appendChild(graphGroup);
    }
}

// CSS Property with scale, panX and panY
const renderPropertyCache = {
    scale: null,
    panX: null,
    panY: null
}
function render_updateCSSProperty() {
    const { scale, panX, panY } = STATE;
    if (renderPropertyCache.scale !== scale) {
        document.body.style.setProperty('--scale', scale);
        renderPropertyCache.scale = scale;
    }
    if (renderPropertyCache.panX !== panX) {
        document.body.style.setProperty('--panX', `${panX}px`);
        renderPropertyCache.panX = panX;
    }
    if (renderPropertyCache.panY !== panY) {
        document.body.style.setProperty('--panY', `${panY}px`);
        renderPropertyCache.panY = panY;
    }
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


// Functions for panning and scaling view


function recenterView(animate = true) {
    if (!STATE.ready) return;
    const newScale = SCALE_BASE;
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    let closestPoint = STATE.data[0];
    let minDistance2 = Infinity;

    STATE.data.forEach(d => {
        const dx = d.x - centerX;
        const dy = d.y - centerY;
        const distance2 = dx * dx + dy * dy;

        if (distance2 < minDistance2) {
            minDistance2 = distance2;
            closestPoint = d;
        }
    });

    const newPanX = CANVAS_WIDTH / 2 - closestPoint.x * newScale - (closestPoint.width * newScale) / 2;
    const newPanY = CANVAS_HEIGHT / 2 - closestPoint.y * newScale - (closestPoint.height * newScale) / 2;

    if (animate) animatedPanTo(newPanX, newPanY, newScale);
    else {
        STATE.panX = newPanX;
        STATE.panY = newPanY;
        STATE.scale = newScale;
        draw();
    }
}

async function applyInertia() {
    const MIN_VELOCITY = 0.2; // Minimum acceleration to apply

    while (Math.abs(STATE.velocityX) > MIN_VELOCITY || Math.abs(STATE.velocityY) > MIN_VELOCITY) {
        if (STATE.mousedown) break;
        STATE.velocityX *= PANNING_INERTIA_FRICTION;
        STATE.velocityY *= PANNING_INERTIA_FRICTION;

        STATE.panX += STATE.velocityX;
        STATE.panY += STATE.velocityY;
        await draw();
    }
}

// Function to animate panX, panY and scale
async function animatedPanTo(newPanX, newPanY, newScale = STATE.scale, duration = 800) {
    const prevScale = STATE.scale;
    const prevPanX = STATE.panX;
    const prevPanY = STATE.panY;
    const deltaPanX = newPanX - prevPanX;
    const deltaPanY = newPanY - prevPanY;
    const deltaScale = newScale - prevScale;
    const timeStart = Date.now();
    const timeEnd = timeStart + duration;
    let timeNow = Date.now();

    const step = async t => {
        const factor = smoothStepFactor(t);
        STATE.panX = prevPanX + factor * deltaPanX;
        STATE.panY = prevPanY + factor * deltaPanY;
        STATE.scale = prevScale + factor * deltaScale;
        
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


// Activate imputs


// All inputs
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
                    if (STATE.edges) updateGraph();
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
            const { x, y, title, width, height } = STATE.data[Math.floor(Math.random()*STATE.data.length)];
            searchInput.value = title;
            search();
            const targetPanX = CANVAS_WIDTH / 2 - x * STATE.scale - (width * STATE.scale) / 2;
            const targetPanY = CANVAS_HEIGHT / 2 - y * STATE.scale - (height * STATE.scale) / 2;
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
    const { x, y, width, height } = matched[next % matched.length];
    searchGoToNextButton.setAttribute('data-next', (next + 1) % matched.length);
    const targetScale = SCALE_SEARCH;
    const targetPanX = CANVAS_WIDTH / 2 - x * targetScale - (width * targetScale) / 2;
    const targetPanY = CANVAS_HEIGHT / 2 - y * targetScale - (height * targetScale) / 2;
    if (animate) animatedPanTo(targetPanX, targetPanY, targetScale);
    else {
        STATE.panX = targetPanX;
        STATE.panY = targetPanY;
        STATE.scale = targetScale;
        draw();
    }
}


//  Some functions


function addNotify(text, duration = 2000) {
    const li = insertElement('li', document.getElementById('notify-list'), undefined, text);
    setTimeout(() => li.remove(), duration);
}


// Basic functions


function getCanvasContext(canvas, width = null, height = null) {
    if (width !== null) canvas.width = width;
    if (height !== null) canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.imageSmoothingEnabled = CANVAS_SMOOTHING;
    ctx.imageSmoothingQuality = CANVAS_SMOOTHING_QUALITY;
    ctx.textRendering = CANVAS_TEXT_QUALITY;
    return ctx;
}

function getPinchDistance(touch1, touch2) {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function getPinchCenter(touch1, touch2) {
    return {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
    };
}

function convertCanvasToImage(canvas) {
    return new Promise(r => {
        // const options = { type: 'image/png', quality: 1 };
        const options = { type: 'image/jpeg', quality: .83 };
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

function smoothStepFactor(t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t // Clamp t to the range [0, 1]
    t = t * t * (3 - 2 * t); // Ease-in-out function
    return t;
}

function fileToText(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onload = e => resolve(e.target.result);
        fileReader.onerror = err => reject(err);
        fileReader.readAsText(file);
    });
}

function base64ToImage(base64) {
    return new Promise(resolve => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image), { once: true });
        image.src = base64;
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

function toClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        console.log(`Copied "${text}" to clipboard`);
        addNotify(`Copied "${text}" to clipboard`);
    }).catch(err => {
        console.error("Failed to copy text: ", err);
        addNotify('Failed to copy text');
    });
}

function clearSelection() {
    const selection = window.getSelection?.() ?? {};
    if (selection.empty) selection.empty();
    else if (selection.removeAllRanges) selection.removeAllRanges();
}


// Events


function onCardClick(e, id) {
    const d = STATE.data.find(d => d.id === id);
    if (!d) return;

    const buttonId = e.target?.closest('.button[data-id]')?.getAttribute('data-id') ?? null;
    if (buttonId === 'wiki') {
        const wikiUrl = d.kv?.danbooru_wiki_url;
        if (wikiUrl) toClipboard(wikiUrl);

        return;
    }
    if (buttonId === 'copy') {
        const title = d.title;
        if (title) toClipboard(title);

        return;
    }

    if (e.ctrlKey) return toClipboard(d.title);

    if (STATE.edges && !e.altKey && d.index !== STATE.selectedGraph) updateGraph(d);
}

function onMousedown(e) {
    document.activeElement?.blur();

    if (e.button === 0 || e.touches) {
        // Ignore movement when clicking on text
        if (!e.altKey || !e.target.closest('.card-title')) {
            e.preventDefault();
            const { clientX, clientY } = e.touches?.[0] ?? e;
            STATE.mousedown = true;
            STATE.mousemove = false;
            STATE.velocityX = 0;
            STATE.velocityY = 0;
            STATE.mouseX = clientX;
            STATE.mouseY = clientY;
        }

        // Remove text selection
        clearSelection();
    }
}

function onMousemove(e) {
    const { clientX, clientY } = e.touches?.[0] ?? e;

    if (STATE.mousedown) {
        if (STATE.mouseX !== clientX || STATE.mouseY !== clientY) {
            const deltaX = clientX - STATE.mouseX;
            const deltaY = clientY - STATE.mouseY;
            STATE.mousemove = true;
            STATE.panX += deltaX;
            STATE.panY += deltaY;

            STATE.velocityX = deltaX;
            STATE.velocityY = deltaY;

            draw();
        }

        if (STATE.altKey) {
            STATE.altKey = false;
            document.body.classList.remove('alt-active');
        }
    } else {
        if (STATE.altKey !== e.altKey) {
            STATE.altKey = e.altKey;
            document.body.classList.toggle('alt-active', e.altKey);
        }
    }
    STATE.mouseX = clientX;
    STATE.mouseY = clientY;
}

function onMouseup(e) {
    const isTouch = Boolean(e.touches);
    if (!isTouch || !e.touches.length) {
        if (STATE.ready && !STATE.mousemove && !STATE.isZooming && (e.button === 0 || isTouch) && e.target.closest('#image-cards')) {
            const elementId = e.target.closest('.card')?.getAttribute('data-id') ?? null;
            if (elementId !== null) onCardClick(e, elementId);
            else {
                let canvasCardIndex = null;
                const { panX, panY, scale } = STATE;
                const { clientX, clientY } = e.touches?.[0] ?? e;
                const globalX = (clientX - panX) / scale;
                const globalY = (clientY - panY) / scale;
                const { data, grid, gridSizeX, gridSizeY } = STATE.physics;

                const cells = [];
                const cellX = Math.floor(globalX / gridSizeX);
                const cellY = Math.floor(globalY / gridSizeY);
                for(let dx = -1; dx <= 1; dx++) {
                    for(let dy = -1; dy <= 1; dy++) {
                        const cell = grid[cellX + dx]?.[cellY + dy];
                        if (cell) cells.push(cell);
                    }
                }

                cells.forEach(cell => {
                    cell.list.forEach(i => {
                        const { x, y, width, height } = data[i];
                        if (x < globalX && y < globalY &&  x + width > globalX && y + height > globalY) canvasCardIndex = i;
                    });
                });
                if (canvasCardIndex !== null) onCardClick(e, data[canvasCardIndex].id);
                else {
                    updateGraph(-1);
                }
            }
        }

        STATE.mousedown = false;

        if (STATE.mousemove && ((isTouch && PANNING_INERTIA_TOUCH) || (!isTouch && PANNING_INERTIA_MOUSE))) applyInertia();
        else {
            STATE.velocityX = 0;
            STATE.velocityY = 0;
        }

        STATE.mousemove = false;
        STATE.isZooming = false;
    }

    // Reset mousedown position to next active finger (Avoid jerking when moving after zooming)
    if (isTouch && e.touches.length) {
        const { clientX, clientY } = e.touches[0];
        STATE.mouseX = clientX;
        STATE.mouseY = clientY;
    }

    STATE.pinchDistance = null;
}

function onTouchstart(e) {
    if (e.touches.length === 2) {
        STATE.isZooming = true;
        STATE.pinchDistance = getPinchDistance(e.touches[0], e.touches[1]);
    }
    onMousedown(e);
}

function onTouchmove(e) {
    if (e.touches.length === 1) onMousemove(e);
    else if (e.touches.length === 2) {
        // Pinch to zoom
        const newPinchDistance = getPinchDistance(e.touches[0], e.touches[1]);

        if (STATE.pinchDistance !== newPinchDistance) {
            if (!STATE.pinchDistance) STATE.pinchDistance = newPinchDistance;

            const prevScale = STATE.scale;
            const prevPanX = STATE.panX;
            const prevPanY = STATE.panY;

            const zoom = newPinchDistance / STATE.pinchDistance;
            const newScale = Math.max(Math.min(prevScale * zoom, SCALE_MAX), SCALE_MIN);

            if (prevScale === newScale) return;

            const { x: centerX, y: centerY } = getPinchCenter(e.touches[0], e.touches[1]);

            const newPanX = centerX - (centerX - prevPanX) * (newScale / prevScale);
            const newPanY = centerY - (centerY - prevPanY) * (newScale / prevScale);

            STATE.pinchDistance = newPinchDistance;
            STATE.scale = newScale;
            STATE.panX = newPanX;
            STATE.panY = newPanY;
            draw();
        }
    }
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
}

function onKeydown(e) {
    // Set focus to search input instead of default page search
    if (e.ctrlKey && e.code === 'KeyF') {
        e.preventDefault();
        searchInput.focus();
    }

    // Open json file via shortcut
    if (e.ctrlKey && e.code === 'KeyO') {
        e.preventDefault();
        document.getElementById('upload-json-input').click();
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

// touch
cardsContainer.addEventListener('touchstart', onTouchstart);
document.addEventListener('touchmove', onTouchmove, { passive: true });
document.addEventListener('touchend', onMouseup);

// mouse
cardsContainer.addEventListener('mousedown', onMousedown);
document.addEventListener('mousemove', onMousemove, { passive: true });
document.addEventListener('mouseup', onMouseup);

// other
document.addEventListener('wheel', onWheel, { passive: true });
document.addEventListener('keydown', onKeydown);

// drag and drop
document.body.addEventListener('dragover', e => e.preventDefault());
document.body.addEventListener('drop', onDrop);
document.body.addEventListener('dragenter', onDragenter);
document.body.addEventListener('dragleave', onDragleave);


// Start do things


// Clear all input fields (with Ctrl + S the browser saves their current contents)
emptyAllInputs();
statusElement.textContent = `Version from ${VERSION}`;

// Start things 
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
            insertElement('option', dataListSelector, { value: i }, `${item.title} *`);
        });
        dataListSelector.value = selectItemIndex;
        selectData(selectItemIndex);
    });
}
