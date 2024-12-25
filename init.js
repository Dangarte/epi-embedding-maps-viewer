// Version info
const VERSION = '25.12.24'; // Last modified date

// Online info
const HOST = 'https://dangarte.github.io/epi-embedding-maps-viewer';
const INDEX_URL = `${HOST}/data/index.json`;
const ISLOCAL = !window.location?.href?.startsWith(HOST);
const SELECTED_DATA_FROM_URL = !ISLOCAL ? new URLSearchParams(window.location.search).get('json-id') || null : null;

// Preferences
const IS_DARK = window.matchMedia('(prefers-color-scheme: dark)').matches;
const IS_REDUCED_MOTION = window.matchMedia(`(prefers-reduced-motion: reduce)`).matches;

// Settings structure in local storage
const SETTINGS_PREFIX = 'epi-embedding-maps-viewer--';
const SETTINGS = {
    'render-engine': { default: '2d', options: [ '2d', 'webgl2', 'dom' ], titles: { '2d': 'Canvas 2d', 'webgl2': 'Canvas WebGL2', 'dom': 'HTML Elements' } },
    'graph-line-type': { default: 'C', options: [ 'C', 'Q', 'L' ], titles: { 'C': 'Cubic curve', 'Q': 'Quadratic curve', 'L': 'Line' } },
};
function tryGetSetting(settingKey, otherDefault) {
    if (!SETTINGS[settingKey]) {
        console.error(`Unknown setting: ${settingKey}`);
        return otherDefault;
    }
    try {
        const value = localStorage.getItem(SETTINGS_PREFIX + settingKey);
        if (SETTINGS[settingKey].options.includes(value)) return value;
        else return otherDefault ?? SETTINGS[settingKey].default;
    } catch(_) {
        return otherDefault ?? SETTINGS[settingKey].default;
    }
}
function trySetSetting(settingKey, settingValue) {
    if (!SETTINGS[settingKey]) {
        console.error(`Unknown setting: ${settingKey}`);
        return;
    }
    try {
        const value = SETTINGS[settingKey].options.includes(settingValue) ? settingValue : SETTINGS[settingKey].default;
        localStorage.setItem(SETTINGS_PREFIX + settingKey, value);
    } catch(_) {
        console.error(_);
        return;
    }
}

// Display options
const PAGE_BACKGROUND = IS_DARK ? '#000' : '#eee';
const CARD_STYLE = {
    fontSize: 24,
    font: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
    color: IS_DARK ? '#dedfe2' : '#232529',
    colorDim: IS_DARK ? '#6d6f76' : '#9da3b2',
    backgroundColor: IS_DARK ? '#232529' : '#dedfe2',
    btnBackgroundColor: IS_DARK ? '#3b3d45' : '#e3e3e3',
    btnBackgroundColorHover: IS_DARK ? '#525660' : '#c8e1ff',
    borderColor: IS_DARK ? '#464953' : '#757a8a',
    noImageBackground: '#2e4f6b',
    borderWidth: 1,
    padding: 6,
    borderRadius: 10,
    lineHeight: 1.3,
    matchedColor: '#ff272f',
};
const GRAPH_LINE_TYPE = tryGetSetting('graph-line-type'); // Type of curves between cards: C, Q, L. Where C is a cubic curve, Q is a quadratic curve, L is a line
const MOVE_CARDS_HALF_SIZE = true; // Offset the cards by half their size (i.e. so that their center is at the specified coordinates, instead of the upper left corner)

// Optimization
// WARNING: webgl2 for some reason, even with hardware acceleration disabled and the --disable-gpu flag when starting the browser, uses VRAM, but it is VERY fast (compared to 2d or dom)
// NOTE: So if you don't need the browser to use VRAM (for example, you have a small amount of it and you generate images), then DO NOT USE webgl2
const RENDER_ENGINE = tryGetSetting('render-engine') ; // Toggle card rendering method: webgl2, 2d, dom
const CANVAS_SMOOTHING = true; // anti-aliasing
const CANVAS_SMOOTHING_QUALITY = 'low'; // quality of anti-aliasing: low, medium, high
const CANVAS_TEXT_QUALITY = 'optimizeLegibility'; // canvas textRendering option: optimizeSpeed, optimizeLegibility, geometricPrecigion
// Perhaps it makes sense to redesign the preview system from "at a certain size" to "at a certain number on the screen"
const CARD_PREVIEW_SCALING = [ // List of aviable preview scales (Sorted by scale, lower first)
    { id: 'micro', title: 'Micro preview', scale: .017, quality: .65 },
    { id: 'tiny', title: 'Tiny preview', scale: .06, quality: .8 },
    { id: 'small', title: 'Small preview', scale: .145, quality: .95 },
    { id: 'normal', title: 'Normal preview', scale: .4, quality: 1 }, // Recommended set quality to 1 at first preview (because it's more noticeable if it's of lower quality)
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
const cardsCanvas = document.getElementById('image-canvas');
cardsCanvas.width = CANVAS_WIDTH;
cardsCanvas.height = CANVAS_HEIGHT;

// Define icons
const ICON_COPY = document.querySelector('.icon[data-icon="copy"]')?.cloneNode(true);
const ICON_BOOK = document.querySelector('.icon[data-icon="book"]')?.cloneNode(true);

// Define page elements
const graphSVG = document.getElementById('graph-svg');
const graphContainer = document.getElementById('graph-container');
const cardsContainer = document.getElementById('cards-container');
graphSVG.setAttribute('viewBox', `0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`);

// Insert card styles in page
CARD_STYLE.lineHeight = String(CARD_STYLE.lineHeight);
const cardStyleConfigsElement = insertElement('style', document.head);
cardStyleConfigsElement.textContent = `:root {${Object.keys(CARD_STYLE).map(key => `--card-${key}: ${ typeof CARD_STYLE[key] !== 'number' ? CARD_STYLE[key] : `${CARD_STYLE[key]}px` };`).join(' ')} }`;
CARD_STYLE.lineHeight = Number(CARD_STYLE.lineHeight);

// Checking previews to see if they can be skipped
if (RENDER_ENGINE === 'dom') CARD_PREVIEW_SCALING.forEach(i => i.allowed = false);
else if (RENDER_ENGINE === 'webgl2') {
    CARD_PREVIEW_SCALING.forEach(i => i.allowed = false);
    CARD_PREVIEW_SCALING.at(-1).allowed = true;
} else if (RENDER_ENGINE === '2d') CARD_PREVIEW_SCALING.forEach(i => i.allowed = true);

// Current viewer state
const STATE = {
    selectData: null,
    ready: false,
    renderController: null,
    data: [],
    source: {},
    previewControllers: {},
    renderController: {},
    space: 0,
    spacing: 50,
    mouseX: 0,
    mouseY: 0,
    velocityX: 0,
    velocityY: 0,
    mousedown: false,
    mousemove: false,
    altKey: false,
    isZooming: false,
    pinchDistance: null,
};


// Controller classes

class DataController {
    static supportedDataFormats = [ 'epi-space-v0', 'epi-space-v1', 'epi-graph-v1', 'dangart-v0' ];

    static getDataFormat(data) {
        if (Array.isArray(data)) return 'epi-space-v0';
        if (data.dataFormat === 'dangart-v0') return 'dangart-v0';
        if (Array.isArray(data.spaces) && Array.isArray(data.proj)) return 'epi-space-v1';
        if (Array.isArray(data.edges) && Array.isArray(data.nodes)) return 'epi-graph-v1';
        return 'unknown';
    }

    static getDataType(data) {
        return Array.isArray(data.edges) ? 'graphs' : 'spaces';
    }

    static normalizeData(data) {
        let dataFormat = this.getDataFormat(data);
        if (dataFormat === 'unknown') throw new Error('Unknown data format');

        // Convert data from old formats

        if (dataFormat === 'epi-space-v0') {
            dataFormat = 'epi-space-v1';
            data = this.#convert__epi_space_v0_to_v1(data);
        }

        // Convert data to internal format

        if (dataFormat === 'dangart-v0') return this.#convert_dangart_v0_to_normal(data);
        if (dataFormat === 'epi-space-v1') return this.#convert__epi_space_v1_to_normal(data);
        if (dataFormat === 'epi-graph-v1') return this.#convert__epi_graph_v1_to_noraml(data);
    }

    static #graph_layoutDagre(nodesTree) {
        const xGap = 500;
        const yGap = 900;
        const lastRowHeight = 3;

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

    static #graph_layoutCircular(nodesTree) {
        const nodeWidth = 400;
        const nodeHeight = 800;
        const gap = 50;
        const nodePositions = new Map();

        const applyShift = (shiftX, shiftY, childrens) => {
            childrens.forEach(node => {
                const pos = node.position;
                pos.x += shiftX;
                pos.y += shiftY;
                if (node.childrens) applyShift(shiftX, shiftY, node.childrens);
            });
        };

        const placeInCirccle = node => {
            const childrens = [];
            const placeInfo = { id: node.id, width: 0, height: 0, childrens: childrens };

            if (node.branches && node.branches.length) {
                node.branches.forEach(n => {
                    if (n.branches && n.branches.length) childrens.push(placeInCirccle(n));
                    else childrens.push({ id: n.id, width: n.width || nodeWidth, height: n.height || nodeHeight });
                });

                const totalNodes = childrens.length;
                let maxWidth = 0, maxHeight = 0, maxDiameter = 0, circumference = 0;
                childrens.forEach(node => {
                    if (!node.hypot) node.hypot = Math.hypot(node.width, node.height);
                    if (node.width > maxWidth) maxWidth = node.width;
                    if (node.height > maxHeight) maxHeight = node.height;
                    if (node.hypot > maxDiameter) maxDiameter = node.hypot;
                    circumference += node.hypot;
                });
                const rC = (circumference + gap * totalNodes) / (2 * Math.PI);
                const rD = maxDiameter*.75 + gap * totalNodes;
                const useEqual = rD > rC;
                const radius = useEqual ? rD : rC;
                const diameter = radius * 2;
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                let angle = 0
                const angleIncrement = Math.PI / totalNodes;
                childrens.forEach(node => {
                    angle += useEqual ? angleIncrement : Math.asin((node.hypot + gap)/(2 * diameter)) * 2;
                    const x = radius * Math.cos(angle);
                    const y = radius * Math.sin(angle);
                    const position = { x, y };
                    if (x > maxX) maxX = x;
                    if (x < minX) minX = x;
                    if (y > maxY) maxY = y;
                    if (y < minY) minY = y;

                    nodePositions.set(node.id, position);
                    node.position = position;
                    if (node.childrens) applyShift(position.x, position.y, node.childrens); // Move all nodes to their new positions

                    angle += useEqual ? angleIncrement : Math.asin((node.hypot + gap)/(2 * diameter)) * 2;
                });

                placeInfo.width = Math.abs(maxX - minX) + maxWidth;
                placeInfo.height = Math.abs(maxY - minY) + maxHeight;
                placeInfo.hypot = diameter + maxDiameter;
                const position = { x: placeInfo.width / 2, y: placeInfo.height / 2 };
                nodePositions.set(node.id, position);
                placeInfo.position = position;
            } else {
                console.warn(`This shouldn't have activated...`);
                nodePositions.set(node.id, { x: 0, y: 0 });
                placeInfo.width = node.width || nodeWidth;
                placeInfo.height = node.height || nodeHeight;
            }

            return placeInfo;
        };

        let shiftX = 0;
        for (const rootId in nodesTree) {
            const rootBranches = nodesTree[rootId];
            const placeInfo = placeInCirccle({ id: rootId, branches: rootBranches });
            const position = placeInfo.position;
            position.x = shiftX;
            position.y = 0;

            if (shiftX && placeInfo.childrens) applyShift(shiftX, 0, placeInfo.childrens);
            shiftX + placeInfo.width + gap * 4;
        }

        return nodePositions;
    }

    static #convert_dangart_v0_to_normal(data) {
        data.nodes.forEach((node, i) => {
            node.edges = [];
            node.index = i;
        });

        // Find node indices for a graph
        const nodesMap = new Map();
        data.nodes.forEach(node => nodesMap.set(node.id, node));
        data.edges.forEach((edge, i) => {
            const nodeFrom = nodesMap.get(edge.from);
            const nodeTo = nodesMap.get(edge.to);
            if (!nodeFrom.edges.includes(i)) nodeFrom.edges.push(i);
            if (!nodeTo.edges.includes(i)) nodeTo.edges.push(i);
            edge.indexFrom = nodeFrom.index;
            edge.indexTo = nodeTo.index;
        });

        return data;
    }

    static #convert__epi_graph_v1_to_noraml(data) {
        const width = data.kv.width;
        const height = data.kv.height;
        const aspectRatio = width && height ? width / height : null;
        const newData = {
            dataFormat: 'normal',
            nodes: data.nodes.map((node, i) => ({ id: node.id, title: node.prompt, index: i, image: node.image, imageAspectRatio: aspectRatio, spaces: [], edges: [] })),
            spaces: [],
            edges: data.edges,
        };

        // Find node indices for a graph
        const nodesMap = new Map();
        const nodesTree = {};
        newData.nodes.forEach(node => nodesMap.set(node.id, node));
        newData.edges.forEach((edge, i) => {
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

        const dagreLayout = this.#graph_layoutDagre(nodesTree);
        const circularLayout = this.#graph_layoutCircular(nodesTree);

        // Create spaces
        newData.spaces = ['Dagre Layout', 'Circular Layout', 'FCose Layout (placeholder)', 'Random'];
        newData.nodes.forEach(node => {
            // Dagre
            const dagreSpace = dagreLayout.get(node.id) ?? { x: 0, y: 0 };
            node.spaces.push({ x: dagreSpace.x, y: dagreSpace.y, positionAbsolute: true });

            // Circular
            const circularSpace = circularLayout.get(node.id) ?? { x: 0, y: 0 };
            node.spaces.push({ x: circularSpace.x, y: circularSpace.y, positionAbsolute: true });

            // FCose Layout
            // TODO
            node.spaces.push({ x: Math.random() * CANVAS_WIDTH, y: Math.random() * CANVAS_HEIGHT });

            // Random
            node.spaces.push({ x: Math.random() * CANVAS_WIDTH, y: Math.random() * CANVAS_HEIGHT });
        });

        return newData;
    }

    static #convert__epi_space_v1_to_normal(data) {
        const width = data.kv.width;
        const height = data.kv.height;
        const aspectRatio = width && height ? width / height : null;
        const newData = {
            dataFormat: 'normal',
            nodes: data.proj.map((node, i) => ({ id: node.id, title: node.title, index: i, image: node.image, imageAspectRatio: aspectRatio, spaces: node.spaces })),
            spaces: data.spaces,
        };
        const nodes = newData.nodes;
        let hasDanbooruUrl = false;
        data.proj.forEach((node, i) => {
            if (node.kv?.danbooru_wiki_url) {
                hasDanbooruUrl = true;
                nodes[i].information = { danbooru: node.kv?.danbooru_wiki_url };
            }
        });

        if (hasDanbooruUrl) newData.information = [ { id: 'danbooru', title: 'Danbooru', type: 'url' } ];

        delete data.proj;

        return newData;
    }

    static #convert__epi_space_v0_to_v1(data) {
        const hasSecondSpace = data[0].x2 !== undefined && data[0].y2 !== undefined;
        const newData = {
            spaces: [
                'Nomic Vision'
            ],
            kv: {
                // resolution from old viewer
                width: 256,
                height: 256 * 1.46
            },
            proj: hasSecondSpace ? data.map(({ x, y, x2, y2, title, image }) => ({ image, title, spaces: [{ x, y }, { x: x2, y: y2 }] })) : data.map(({ x, y, title, image }) => ({ image, title, spaces: [{ x, y }] }))
        };
        if (hasSecondSpace) newData.spaces.push('SDLX Pooled Text Encoders');

        return newData;
    }
}

class ControlsController {
    static viewportStatusElement = document.getElementById('cards-in-viewport');
    static searchInputElement = document.getElementById('search');
    static searchGoToElement = document.getElementById('goto-search');
    static searchClearElement = document.getElementById('search-clear');
    static dataListElement = document.getElementById('data-list');
    static dataListSelectedElement = document.getElementById('data-list-selected');
    static spacesListElement = document.getElementById('switch-spaces');
    static renderEngineListElement = document.getElementById('render-engine');
    static uploadJsonInput = document.getElementById('upload-json-input');
    static dataListElements = [];

    static #visibleCardsCount = 0;
    static #visibleCardsScale = 'Empty';

    static updateEmbeddingList(newEmbeddingList) {
        STATE.space = 0;
        const switchEmbList = this.spacesListElement;
        switchEmbList.textContent = '';
        newEmbeddingList.forEach((title, index) => insertElement('option', switchEmbList, { value: index }, title));
        switchEmbList.value = STATE.space;
    }

    static selectOptionInDataSwitcher(index = 0) {
        this.dataListSelectedElement.textContent = INDEX[index].title;
        this.dataListElement.querySelector('.option-selected')?.classList.remove('option-selected');
        this.dataListElements[index].classList.remove('option-not-downloaded');
        this.dataListElements[index].classList.add('option-selected');
    }

    static updateDataSwitcher() {
        const dataTypes = {
            spaces: { text: 'Space', emoji: '🗃️' },
            graphs: { text: 'Graph', emoji: '🕸️' }
        };
        const fragment = new DocumentFragment();
        const nowTime = Date.now();
        const createOptionTag = (parent, text, emoji) => {
            const div = insertElement('div', parent, { class: 'option-tag', 'data-tag': text });
            if (emoji) insertElement('span', div, { class: 'emoji' }, emoji);
            div.appendChild(document.createTextNode(` ${text}`));
            return div;
        };

        INDEX.forEach((item, i) => {
            const option = insertElement('button', fragment, { class: 'data-option', 'data-id': i });
            insertElement('h3', option, { class: 'option-title' }, item.title);
            if (!item.data) option.classList.add('option-not-downloaded');

            const tagsElement = insertElement('div', option, { class: 'option-tags' });

            if (item.tags && Array.isArray(item.tags)) item.tags.forEach(tag => createOptionTag(tagsElement, tag));
            if (item.type) {
                const type = dataTypes[item.type] ?? { text: item.type, emoji: undefined };
                createOptionTag(tagsElement, type.text, type.emoji);
            }
            if (item.nodesCount) createOptionTag(tagsElement, item.nodesCount ?? 'Unknown', '🧩');
            if (item.fileSize) createOptionTag(tagsElement, filesizeToString(+item.fileSize), '📦');
            if (item.imported) createOptionTag(tagsElement, 'Imported', '📄');
            if (item.changed) {
                const changed = new Date(item.changed);
                const div = createOptionTag(tagsElement, timeAgo(Math.round((nowTime - +changed)/1000)), '🕒');
                div.setAttribute('title', changed.toLocaleString());
            }

            this.dataListElements[i] = option;
        });
        if (INDEX.length) {
            this.dataListElement.textContent = '';
            this.dataListElement.appendChild(fragment);
        } else {
            this.dataListElement.textContent = 'No data to display';
        }
    }

    static updateViewportStatus() {
        this.viewportStatusElement.textContent = `${this.#visibleCardsScale} (x${this.#visibleCardsCount})`;
    }

    static emptyAllInputs() {
        this.searchInputElement.value = '';
        this.spacesListElement.textContent = '';
        this.dataListElement.textContent = '';
        this.dataListElement.classList.add('hidden');
        this.dataListSelectedElement.textContent = '...';
        this.searchGoToElement.setAttribute('data-next', 0);
        this.searchGoToElement.setAttribute('data-count', 0);
        this.searchClearElement.style.visibility = 'hidden';
        this.renderEngineListElement.textContent = '';
        SETTINGS['render-engine'].options.forEach(engine => {
            insertElement('option', this.renderEngineListElement, { value: engine }, SETTINGS['render-engine'].titles[engine]);
        });
        this.renderEngineListElement.value = RENDER_ENGINE;
    }

    static set visibleCardsCount(newCount) {
        this.#visibleCardsCount = newCount;
    }
    static get visibleCardsCount() {
        return this.#visibleCardsCount;
    }

    static set visibleCardsScale(newCardsScale) {
        this.#visibleCardsScale = newCardsScale;
    }
    static get visibleCardsScale() {
        return this.#visibleCardsScale;
    }
}

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
        // Maximum texture layers in WebGL2: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/activeTexture#:~:text=It%20is%2C%20per%20specification%2C%20at%20least%208
        const canvasScaleMultiplyer = .5; // Temporary solution to the problem with VRAM consumption spike and browser crash when generating preview
        const maxHeight = 16384 * canvasScaleMultiplyer;
        const maxWidth = 16384 * canvasScaleMultiplyer;
        const maxLayers = 8;

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
            if (wholeLayersCount >= maxLayers) console.warn(`Warning: Too many texture layers!\nThe current number of texture layers is ${wholeLayersCount}, which exceeds the guaranteed minimum support of ${maxLayers} layers.`);

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
        const borderRadiusInside = borderRadius > padding ? borderRadius - padding : 0;
        const hasReference = Boolean(referenceController);
        const { cellWidth, cellHeight, layers } = this.grid;
        const contentOffset = padding + borderWidth;
        const lineHeight = fontSize * CARD_STYLE.lineHeight;
        const controls = [ ICON_BOOK.cloneNode(true), ICON_COPY.cloneNode(true) ];
        const controlsFontSize = 1.5 * fontSize;
        const controlsWidth = controls.length * controlsFontSize + (controls.length - 1) * controlsFontSize * .125;
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
            const iconCssText = `font-size: ${fontSize}; stroke: ${CARD_STYLE.color}; height: 1em; width: 1em; line-height: 1em; stroke-width: .1em; fill: none; stroke-linecap: round; stroke-linejoin: round;`;
            const svgIconToImage = icon => {
                const use = icon.querySelector('use');
                const symbol = use ? document.getElementById(use.getAttribute('href').slice(1)) : null;
                if (symbol) {
                    const fragment = new DocumentFragment();
                    Array.from(symbol.children).forEach(node => fragment.appendChild(node.cloneNode(true)));
                    icon.setAttribute('viewBox', symbol.getAttribute('viewBox'));
                    use.replaceWith(fragment);
                }
                icon.style.cssText = iconCssText;
                const serializer = new XMLSerializer();
                const svgString = serializer.serializeToString(icon);
                const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
                return base64ToImage(svgDataUrl);
            };
            controlsTemplate = new OffscreenCanvas(controlsWidth, controlsFontSize);
            const templateCtx = controlsTemplate.getContext('2d', { alpha: true });
            templateCtx.imageSmoothingEnabled = CANVAS_SMOOTHING;
            templateCtx.imageSmoothingQuality = CANVAS_SMOOTHING_QUALITY;

            templateCtx.fillStyle = CARD_STYLE.btnBackgroundColor;

            const fontSize4 = controlsFontSize/4;
            const fontSize2 = controlsFontSize/2;
            const controlIcons = await Promise.all(controls.map(svgIconToImage));

            for (let i = 0; i < controls.length; i++) {
                const x = i * 1.125 * controlsFontSize;
                templateCtx.roundRect(x, 0, controlsFontSize, controlsFontSize, borderRadiusInside);
                templateCtx.fill();
                templateCtx.beginPath();
                templateCtx.drawImage(controlIcons[i], x + fontSize4, fontSize4, fontSize2, fontSize2);
                controlIcons[i] = null;
            }

            const TEMPLATE_MIN_COUNT = 200;
            STATE.renderController.sizes.forEach(item => {
                const { key, width, height, count } = item;
                if (count < TEMPLATE_MIN_COUNT) return;
                const scaledWidth = Math.round(width * scale);
                const scaledHeight = Math.round(height * scale);
                const image = this.data.find(item => item.sizeKey === key).image ?? { width: 256, height: 256 };
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

                // if (borderWidth) templateCtx.stroke(getRoundedRectPath(imageWidth + borderWidthX2, imageHeight + borderWidthX2, borderRadiusInside, -borderWidth, -borderWidth));

                templateCtx.drawImage(controlsTemplate, scaledWidth - contentOffset * 2 - controlsWidth, scaledHeight - contentOffset * 2 - fontSize);

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
                const imageWidth = Math.round((image ? image.width : 256) * scale);
                const imageHeight = Math.round((image ? image.height : 256) * scale);
                const textOffsetY = imageHeight + fontSize + padding;

                if (cardTemplates[sizeKey]) {
                    if (image) ctx.drawImage(image, contentOffset, contentOffset, imageWidth, imageHeight);
                    else {
                        ctx.fillStyle = CARD_STYLE.noImageBackground;
                        ctx.fillRect(contentOffset, contentOffset, imageWidth, imageHeight);
                    }
                    ctx.drawImage(cardTemplates[sizeKey], 0, 0);
                } else {
                    ctx.save();
                    if (borderWidth) ctx.translate(borderWidth, borderWidth);

                    const cardRoundedClipPath = getRoundedRectPath(scaledWidth - borderWidthX2, scaledHeight - borderWidthX2, borderRadius);
                    ctx.fillStyle = CARD_STYLE.backgroundColor;
                    ctx.fill(cardRoundedClipPath);
                    if (borderWidth) ctx.stroke(cardRoundedClipPath);

                    ctx.translate(padding, padding);

                    ctx.drawImage(controlsTemplate, scaledWidth - contentOffset * 2 - controlsWidth, scaledHeight - contentOffset * 2 - controlsFontSize);

                    // if (borderWidth) ctx.stroke(getRoundedRectPath(imageWidth + borderWidthX2, imageHeight + borderWidthX2, borderRadiusInside, -borderWidth, -borderWidth));

                    ctx.clip(getRoundedRectPath(imageWidth, imageHeight, borderRadiusInside));
                    if (image) ctx.drawImage(image, 0, 0, imageWidth, imageHeight);
                    else {
                        ctx.fillStyle = CARD_STYLE.noImageBackground;
                        ctx.fillRect(0, 0, imageWidth, imageHeight);
                    }
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
    gridLarge;
    gridLargeKeys;
    gridLargeScale;
    pointWidth;
    pointHeight;
    
    isActive = false;
    
    constructor (data, pointWidth, pointHeight) {
        this.data = data;
        this.pointWidth = pointWidth;
        this.pointHeight = pointHeight;
    }
    
    updatePoints() {
        this.grid = {};

        const grid = this.grid;
        const cellSizeX = this.pointWidth;
        const cellSizeY = this.pointHeight;

        this.points = this.data.map((p, i) => {
            const gridX = Math.floor(p.x / cellSizeX);
            const gridY = Math.floor(p.y / cellSizeY);

            const gridCell = grid[gridX]?.[gridY] ?? this.#createCell(gridX, gridY);
            gridCell.list.add(i);
            return { x: p.x, y: p.y, i, width: p.width, height: p.height, gridX, gridY, gridCell };
        });

        this.gridSizeX = cellSizeX;
        this.gridSizeY = cellSizeY;

        this.fillLargeGrid();
    }

    fillLargeGrid() {
        this.gridLarge = {};
        this.gridLargeKeys = { rowKeys: [], rows: {}, columnKeys: [], columns: {} };
        this.gridLargeScale = 7;
        const gridLarge = this.gridLarge;
        const cellLargeSizeX = this.gridSizeX * this.gridLargeScale;
        const cellLargeSizeY = this.gridSizeY * this.gridLargeScale;

        const createLargeCell = (gridLargeX, gridLargeY) => {
            if (!gridLarge[gridLargeX]) gridLarge[gridLargeX] = {};
            const cell = new Set();
            gridLarge[gridLargeX][gridLargeY] = cell;
            return cell;
        };

        this.points.forEach((p, i) => {
            const gridLargeX1 = Math.floor(p.x / cellLargeSizeX);
            const gridLargeX2 = Math.floor((p.x - p.width) / cellLargeSizeX);
            const gridLargeY1 = Math.floor(p.y / cellLargeSizeY);
            const gridLargeY2 = Math.floor((p.y - p.height) / cellLargeSizeY);

            const cellLarge1 = gridLarge[gridLargeX1]?.[gridLargeY1] ?? createLargeCell(gridLargeX1, gridLargeY1);
            cellLarge1.add(i);

            if (gridLargeX1 !== gridLargeX2 || gridLargeY1 !== gridLargeY2) {
                const cellLarge2 = gridLarge[gridLargeX2]?.[gridLargeY2] ?? createLargeCell(gridLargeX2, gridLargeY2);
                cellLarge2.add(i);
            }
        });

        this.gridLargeKeys.rowKeys = Object.keys(gridLarge).map(k => +k).sort((a, b) => a - b);
        this.gridLargeKeys.rowKeys.forEach(key => this.gridLargeKeys.rows[key] = Object.keys(gridLarge[key]).map(k => +k).sort((a, b) => a - b));
        this.gridLargeKeys.columnKeys = [];
        this.gridLargeKeys.columns = {};
        this.gridLargeKeys.rowKeys.forEach(rowKey => {
            this.gridLargeKeys.rows[rowKey].forEach(colKey => {
                if (!this.gridLargeKeys.columns[colKey]) {
                    this.gridLargeKeys.columns[colKey] = [];
                    this.gridLargeKeys.columnKeys.push(colKey);
                }
                this.gridLargeKeys.columns[colKey].push(rowKey);
            });
        });
        this.gridLargeKeys.columnKeys.sort((a, b) => a - b);
    }

    async overlapFix() {
        if (!STATE.ready || this.isActive) return;
        this.isActive = true;
        this.updatePoints();
        const spacing = STATE.spacing;
        const renderController = STATE.renderController;

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
                const { x: x1, y: y1, dxLast: dx1Last = 0, dyLast: dy1Last = 0 } = p1;

                p1.gridCell.neighbors.forEach(cell => {
                    cell.list.forEach(j => {
                        if (j <= i) return;

                        const p2 = points[j];
                        const dx = x1 - p2.x;
                        const dy = y1 - p2.y;

                        const distance2 = dx * dx + dy * dy;
                        if (distance2 < minDistance2) {
                            const distance = Math.sqrt(distance2);
                            const force = (gap + minDistance - distance) / distance;

                            if (force > minForce) {
                                converged = false;

                                // Taking into account the direction of the last change
                                const weight1 = (dx * dx1Last + dy * dy1Last) > 0 ? weightUp : weightDown;
                                const weight2 = (-dx * (p2.dxLast ?? 0) - dy * (p2.dyLast ?? 0)) > 0 ? weightUp : weightDown;

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
            data.forEach((d, i) => {
                const p = points[i];
                d.x = p.x;
                d.y = p.y;
            });
            STATE.renderController.coordinatesChanged();
        };

        let converged = false, iteration = 0;
        for(iteration = 0; iteration < maxIterations; iteration++) {
            if (STATE.spacing !== spacing) break;
            
            updateGrid();
            converged = simulateRepulsionForces();
            syncPointsWithData();
            if (!converged) {
                await draw();
                renderController.renderGraph();
            }
    
            if (iteration === forceScaleResetAt) forceScale = forceScaleResetTo;
            if (forceScale > forceScaleMin) forceScale -= forceScaleStep;
    
            if (converged) break;
        }

        if (converged && iteration) {
            await draw();
            renderController.renderGraph();
        }
        
        if (iteration) {
            addNotify(converged ? 'The overlap has been fixed' : 'Failed to fix overlap, please try again');
            this.fillLargeGrid();
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
            const row = this.grid[gridX + ox];
            if (!row) continue;
            for (let oy = -1; oy <= 1; oy++) {
                const neighborCell = row[gridY + oy];
                if (neighborCell) {
                    neighborCell.neighbors.push(cell);
                    cell.neighbors.push(neighborCell);
                }
            }
        }
    }
}

class RenderController {
    cardsContainer;
    graphContainer;
    data;
    cards;
    edges;
    sizes = [];
    ctx;

    #imagesDecoded = false;
    #cardsSizesReady = false;

    #renderEngine;
    #render_preview;
    #render_init;
    #render_coordinatesChanged;
    #destroy;
    #clear_canvas;
    #selectedGraph = -1;
    #selectedSpace = 0;

    #panX = 0;
    #panY = 0;
    #scale = SCALE_BASE;
    #renderedPanX = null;
    #renderedPanY = null;
    #renderedScale = null;
    #renderedFilter = null;
    #renderedCards = [];
    #cssProperty = { panX: null, panY: null, scale: null };
    #scaleCached = {};

    #filter = '';
    #filterRegex = null;
    #filterCheckString = null;
    #cardsMatched = [];
    #cardsNotMatched = [];
    #searchTimer = null;

    #viewportWidth = 0;
    #viewportHeight = 0;
    #cardsInViewport;
    #visibleCardsCount = 0;

    #cssSetCardsTransform = false;

    #atlas = [];
    #atlasCoord = [];

    constructor(data, renderEngine = '2d') {
        this.cardsContainer = document.getElementById('cards-container');
        this.graphContainer = document.getElementById('graph-container');

        this.#viewportWidth = CANVAS_WIDTH;
        this.#viewportHeight = CANVAS_HEIGHT;

        this.#renderEngine = renderEngine;
        this.data = data;
        this.cards = data.nodes;
        if (data.edges) {
            this.edges = data.edges;
            const nodesMap = new Map();
            this.cards.forEach(node => nodesMap.set(node.id, node));
            this.edges.forEach(edge => {
                edge.nodeFrom = nodesMap.get(edge.from);
                edge.nodeTo = nodesMap.get(edge.to);
            });
        } else {
            this.edges = null;
        }

        if (renderEngine === 'dom') this.#render_init = this.#r_DOM_init;
        else if (renderEngine === 'webgl2') this.#render_init = this.#r_WebGL2_init;
        else if (renderEngine === '2d') this.#render_init = this.#r_2d_init;
        else throw new Error(`Wrong render engine: ${renderEngine}`);
    }

    async decodeImages() {
        if (this.#imagesDecoded) return;

        const promises = [];
        const data = this.cards;
        data.forEach((info, i) => info.image && typeof info.image === 'string' ? promises.push({ index: i, promise: base64ToImage(info.image) }) : null);
        const images = await Promise.all(promises.map(item => item.promise));
        images.forEach((image, i) => {
            const index = promises[i].index;
            const aspectRatio = data[index].imageAspectRatio;
            delete data[index].imageAspectRatio;
            image.width = image.naturalWidth;
            image.height = aspectRatio ? Math.round(image.width / aspectRatio) : image.naturalHeight;
            data[index].image = image;
        });

        this.#imagesDecoded = true;
    }

    calculateCardSizes() {
        if (this.#cardsSizesReady) return;

        const data = this.cards;
        const image = data[0].image || { width: 256, height: 256 };
        const padding = CARD_STYLE.padding + CARD_STYLE.borderWidth;
        const additionalWidth = padding * 2;
        const additionalHeight = padding * 4 + CARD_STYLE.fontSize * 1.5; // padding * 2 + controls margin-top + text margin-top // 1.5 - controls font-size
        const lineHeight = CARD_STYLE.fontSize * CARD_STYLE.lineHeight;

        const measuringCanvas = new OffscreenCanvas(image.width, image.height);
        const measuringCtx = measuringCanvas.getContext('2d');
        measuringCtx.font = `normal ${CARD_STYLE.fontSize}px ${CARD_STYLE.font}`;

        const charMeasureCache = new Map();
        const splitTextIntoChunks = text => {
            const chunks = [];
            const textEnd = text.length;
            let startIndex = 0;

            while (startIndex < textEnd) {
                const spaceIndex = text.indexOf(' ', startIndex);
                const dashIndex = text.indexOf('-', startIndex);

                const endIndex = spaceIndex === -1 ? dashIndex === -1 ? textEnd : dashIndex : dashIndex === -1 ? spaceIndex : Math.min(spaceIndex, dashIndex);

                chunks.push({ chunk: text.slice(startIndex, endIndex) + (text[endIndex] ?? ''), splitter: (text[endIndex] ?? '') });

                startIndex = endIndex + 1;
            }

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
        const sapceWidth = measureChar(' ');
        const prepareLines = (text, maxWidth) => {
            const chunks = splitTextIntoChunks(text);
            let line = '';
            let testLineWidth = 0;
            const lines = [];

            for (const { chunk, splitter } of chunks) {
                const chunkWidth = measureText(chunk);

                if (testLineWidth + (splitter === ' ' ? chunkWidth - sapceWidth : chunkWidth) > maxWidth && line) {
                    lines.push(line);
                    line = chunk;
                    testLineWidth = chunkWidth;
                } else {
                    line += chunk;
                    testLineWidth += chunkWidth;
                }
            }

            lines.push(line);
            return lines;
        };

        data.forEach(item => {
            const { image, title } = item;
            const { width: w = 256, height: h = 256 } = image || {};
            const lines = item.lines ?? prepareLines(title, w);
            item.lines = lines;
            item.width = Math.round(w + additionalWidth);
            item.height = Math.round(h + lineHeight * lines.length + additionalHeight);
        });

        measuringCanvas.width = 0;
        measuringCanvas.height = 0;

        this.#cardsSizesReady = true;
    }

    async init() {
        await this.decodeImages();
        this.calculateCardSizes();
        this.#render_init();

        const sizes = {};
        this.cards.forEach(item => {
            const key = `${item.width},${item.height}`;
            if (sizes[key]) sizes[key]++;
            else sizes[key] = 1;
            item.sizeKey = key;
        });
        this.sizes = Object.keys(sizes).map(key => {
            const [ width, height ] = key.split(',').map(a => Number(a));
            return { width, height, key, count: sizes[key] };
        }).sort((a, b) => b.count - a.count);
    }

    destroy() {
        Object.keys(STATE.previewControllers).forEach(id => {
            const previewCOntroller = STATE.previewControllers[id];
            previewCOntroller.grid?.layers?.forEach(layer => {
                layer.canvas.width = 0;
                layer.canvas.height = 0;
            });
        });
        this.#clear_canvas?.();
        this.#destroy?.();
        this.ctx = null;
    }

    async animatedPanTo(newPanX, newPanY, newScale = this.#scale, duration = 800) {
        const prevScale = this.#scale;
        const prevPanX = this.#panX;
        const prevPanY = this.#panY;
        const deltaPanX = newPanX - prevPanX;
        const deltaPanY = newPanY - prevPanY;
        const deltaScale = newScale - prevScale;
        const timeStart = Date.now();
        const timeEnd = timeStart + duration;
        let timeNow = timeStart;
    
        const step = async t => {
            const factor = smoothStepFactor(t);
            this.#scale = prevScale + factor * deltaScale;
            this.#panX = prevPanX + factor * deltaPanX;
            this.#panY = prevPanY + factor * deltaPanY;
            
            await draw();
        };

        if (IS_REDUCED_MOTION) return step(1);
        
        while (timeNow <= timeEnd) {
            if (STATE.mousedown) break;
    
            const t = (timeNow - timeStart) / duration;
            await step(t);
            
            timeNow = Date.now();
            if (timeNow > timeEnd) step(1);
        }
    }

    async recenterView(duration = 800) {
        if (!STATE.ready) return;
        const newScale = SCALE_BASE;
        const centerX = CANVAS_WIDTH / 2;
        const centerY = CANVAS_HEIGHT / 2;

        let closestPoint = this.cards[0];
        let minDistance2 = Infinity;

        this.cards.forEach(d => {
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

        if (duration) this.animatedPanTo(newPanX, newPanY, newScale, duration);
        else {
            this.#scale = newScale;
            this.#panX = newPanX;
            this.#panY = newPanY;
            draw();
        }
    }

    render(force = false) {
        if (!STATE.ready) return;

        this.updateProperty(force);

        if (this.#scale > CARD_SCALE_PREVIEW) this.#render_DOM();
        else this.#render_preview();

        this.#renderedPanX = this.#panX;
        this.#renderedPanY = this.#panY;
        this.#renderedScale = this.#scale;
        this.#renderedFilter = this.#filter;
        this.#renderedCards = this.#cardsInViewport;
    }

    renderGraph(node = null) {
        if (!this.edges) return;

        const GRAPH_PADDING = 12;
        const GRAPH_PARENT_DISPLAY = 8;
        const GRAPH_EDGES_OFFSET_Y = 200;
        const rectBorderRadius = CARD_STYLE.borderRadius ? CARD_STYLE.borderRadius + GRAPH_PADDING : 4;

        this.#selectedGraph = node !== null ? node !== -1 ? node.index : -1 : this.#selectedGraph;

        if (this.#selectedGraph !== -1) {
            const edges = this.edges;
            const nodes = this.cards;
            const selectedIndex = this.#selectedGraph;
            const selectedNode = nodes[selectedIndex];
            const graphGroup = new DocumentFragment();
            const connectedNodes = new Set();
            const useC = GRAPH_LINE_TYPE === 'C';
            const useQ = GRAPH_LINE_TYPE === 'Q';

            const drawParentEdges = (parentNodeIndex, depth = 1) => {
                if (depth > GRAPH_PARENT_DISPLAY) return;
                const parentNode = nodes[parentNodeIndex];
                parentNode.edges.forEach(edgeIndex => {
                    const edge = edges[edgeIndex];
                    if (edge.indexTo === parentNodeIndex) {
                        drawEdge(edgeIndex);
                        drawParentEdges(edge.indexFrom, depth + 1);
                    }
                });
            };
            const drawEdge = (edgeIndex, nodeClass) => {
                const edge = edges[edgeIndex];
                const nodeFrom = nodes[edge.indexFrom];
                const nodeTo = nodes[edge.indexTo];

                connectedNodes.add(edge.indexFrom);
                connectedNodes.add(edge.indexTo);

                const startX = nodeFrom.x + nodeFrom.width / 2;
                const startY = nodeFrom.y + nodeFrom.height + GRAPH_PADDING;
                const endX = nodeTo.x + nodeTo.width / 2;
                const endY = nodeTo.y - GRAPH_PADDING;
                const midX = (startX + endX) / 2;

                const useL = startX === endX || startY === endY;

                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const pathData =
                    useL ? `L` :
                    useC ? `C ${startX},${startY + GRAPH_EDGES_OFFSET_Y} ${endX},${endY - GRAPH_EDGES_OFFSET_Y}` :
                    useQ ? `Q ${midX},${Math.min(startY, endY)}` :
                    `L`
                path.setAttribute('d', `M ${startX},${startY} ${pathData} ${endX},${endY}`);
                path.setAttribute('data-id', `${nodeFrom.id}-${nodeTo.id}`);
                if (nodeClass) path.setAttribute('class', nodeClass);

                graphGroup.appendChild(path);
            };
            const drawRect = (nodeIndex, nodeClass) => {
                const node = nodes[nodeIndex];
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', node.x - GRAPH_PADDING);
                rect.setAttribute('y', node.y - GRAPH_PADDING);
                rect.setAttribute('rx', rectBorderRadius);
                rect.setAttribute('ry', rectBorderRadius);
                rect.setAttribute('width', node.width + GRAPH_PADDING * 2);
                rect.setAttribute('height', node.height + GRAPH_PADDING * 2);
                rect.setAttribute('data-id', node.id);
                if (nodeClass) rect.setAttribute('class', nodeClass);
                graphGroup.appendChild(rect);
            };

            selectedNode.edges.forEach(edgeIndex => {
                const edge = edges[edgeIndex];
                drawEdge(edgeIndex, selectedIndex === edge.indexFrom ? 'graph-selected' : null);
                if (edge.indexFrom !== selectedIndex) drawParentEdges(edge.indexFrom);
            });
            
            connectedNodes.forEach(nodeIndex => {
                drawRect(nodeIndex, nodeIndex === selectedIndex ? 'graph-selected' : null);
            });

            this.graphContainer.textContent = '';
            this.graphContainer.appendChild(graphGroup);
            // For some reason translate3d faster...
            const styleString = `transform: translate3d(${this.#panX}px, ${this.#panY}px, 0) scale(${this.#scale});`;
            // const styleString = `transform: translate(${this.#panX}px, ${this.#panY}px) scale(${this.#scale});`;
            this.graphContainer.setAttribute('style', styleString);
        } else {
            this.graphContainer.textContent = '';
            this.graphContainer.removeAttribute('style');
        }
    }

    updateProperty(force = false) {
        const cssProperty = this.#cssProperty;
        let somethingIsChanged = false;
        if (force || cssProperty.scale !== this.#scale) {
            document.body.style.setProperty('--scale', this.#scale);
            this.#scaleChanged();
            cssProperty.scale = this.#scale;
            somethingIsChanged = true;
            this.#cssSetCardsTransform = this.#renderEngine === 'dom' || this.#scale > CARD_SCALE_PREVIEW;
        }
        if (force || cssProperty.panX !== this.#panX) {
            cssProperty.panX = this.#panX;
            somethingIsChanged = true;
        }
        if (force || cssProperty.panY !== this.#panY) {
            cssProperty.panY = this.#panY;
            somethingIsChanged = true;
        }
        if (somethingIsChanged) {
            this.#calculateViewport();
            // For some reason translate3d faster...
            const styleString = `transform: translate3d(${this.#panX}px, ${this.#panY}px, 0) scale(${this.#scale});`;
            // const styleString = `transform: translate(${this.#panX}px, ${this.#panY}px) scale(${this.#scale});`;
            if (this.#cssSetCardsTransform) this.cardsContainer.setAttribute('style', styleString);
            if (this.#selectedGraph !== -1) this.graphContainer.setAttribute('style', styleString);
        }
        return somethingIsChanged;
    }

    coordinatesChanged() {
        this.#render_coordinatesChanged?.();

        this.cards.forEach(d => d.boundaries = null);
    }

    switchSapce(newSpaceIndex) {

    }

    set scale(newScale) {
        this.#scale = newScale;
    }

    set panX(newPanX) {
        this.#panX = newPanX;
    }

    set panY(newPanY) {
        this.#panY = newPanY;
    }

    set filter(newFilter) {
        this.#filter = newFilter;
        this.#search();
    }

    get scale () {
        return this.#scale;
    }

    get panX() {
        return this.#panX;
    }

    get panY() {
        return this.#panY;
    }

    get filter() {
        return this.#filter;
    }

    get cardsMatched() {
        return this.#cardsMatched;
    }

    //

    #createAtlas(id, scale) {

    }

    #scaleChanged() {
        // Calc current render info
        const data = this.cards;
        const scale = this.#scale;
        const maxCardWidth = STATE.maxCardWidth;
        const useElements = scale > CARD_SCALE_PREVIEW;
        const previewScale = !useElements ? CARD_PREVIEW_SCALING.find(i => scale <= i.scale && i.allowed) : null;

        const renderedScaleCache = this.#scaleCached;

        let mathcedOutlineImages = renderedScaleCache.mathcedOutlineImages ?? null;
        let drawOnlyMatchedOutline = false;
        const outlineWidth = 2;
        const borderRadius = CARD_STYLE.borderRadius * scale;

        // Update previews

        const renderedScale = renderedScaleCache.scale;
        const renderedElements = renderedScale > CARD_SCALE_PREVIEW;
        const renderedPreviewScale = !renderedElements ? CARD_PREVIEW_SCALING.find(i => renderedScale <= i.scale && i.allowed) : null;

        const emptyMatchedOutline = () => {
            if (mathcedOutlineImages === null) return;
            mathcedOutlineImages.forEach(offscreenCanvas => {
                offscreenCanvas.width = 0;
                offscreenCanvas.height = 0;
            })
            mathcedOutlineImages = null;
        };

        if (useElements) {
            if (!renderedElements) this.#clear_canvas?.();
            emptyMatchedOutline();
        } else {
            // Remove all elements if they not nedeed
            if (renderedElements) {
                this.cardsContainer.textContent = '';
                this.cardsContainer.removeAttribute('style');
                data.forEach(d => d.cardElement ? d.cardElement.inDOM = false : null);
            }

            // Change preview
            if ((!renderedPreviewScale && previewScale) || renderedPreviewScale?.id !== previewScale?.id) {
                const id = previewScale.id;
                const layers = STATE.previewControllers[id].grid.layers;
                data.forEach(d => {
                    const preview = d[id];
                    d.previewCanvas = layers[preview.layer].canvas;
                    d.previewInfo = [ preview.x, preview.y, preview.width, preview.height ];
                });
            }

            // Draw outline for matched cards
            const OUTLINE_PREVIEW_MIN_COUNT = 150;
            const CARD_MATCHED_RECT_INSTEAD_IMAGE_AT = 3; // Draw rectangle instead of matched image if it is smaller than this (in px)
            drawOnlyMatchedOutline = maxCardWidth * scale < CARD_MATCHED_RECT_INSTEAD_IMAGE_AT;

            emptyMatchedOutline();
            mathcedOutlineImages = new Map();
            this.sizes.forEach(item => {
                if (item.count < OUTLINE_PREVIEW_MIN_COUNT) return;
                const scaledW = Math.round(item.width * scale);
                const scaledH = Math.round(item.height * scale);
                const offscreenCanvas = new OffscreenCanvas(scaledW + outlineWidth * 2, scaledH + outlineWidth * 2);

                mathcedOutlineImages.set(item.key, offscreenCanvas);
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

        this.#scaleCached = { scale, mathcedOutlineImages, outlineWidth, borderRadius, drawOnlyMatchedOutline };
        ControlsController.visibleCardsScale = useElements || !previewScale ? 'Element' : previewScale.title;
    }

    #calculateViewport() {
        const scale = this.#scale;
        const panX = this.#panX;
        const panY = this.#panY;
        const data = this.cards;

        const vsY = -panY / scale;
        const veY = vsY + this.#viewportHeight / scale;
        const vsX = -panX / scale;
        const veX = vsX + this.#viewportWidth / scale;

        const cardsInViewport = this.#cardsInViewport = new Uint8Array(data.length).fill(0);

        const physics = STATE.physics;
        const vg = physics.gridLarge;
        const vgKeys = physics.gridLargeKeys;
        const vgSizeX = physics.gridSizeX * physics.gridLargeScale;
        const vgSizeY = physics.gridSizeY * physics.gridLargeScale;
        const minFullX = Math.floor(vsX / vgSizeX);
        const minFullY = Math.floor(vsY / vgSizeY);
        const maxFullX = Math.floor(veX / vgSizeX);
        const maxFullY = Math.floor(veY / vgSizeY);
        const minX = minFullX - 1;
        const minY = minFullY - 1;
        const maxX = maxFullX;
        const maxY = maxFullY;

        const checkCell = cell => {
            cell.forEach(index => {
                const b = data[index].boundaries ?? this.#calculateCardBoundaries(data[index]);
                if (veX > b[0] && veY > b[1] && vsX < b[2] && vsY < b[3]) cardsInViewport[index] = 1;
            });
        };

        for (const rowX of vgKeys.rowKeys) {
            if (rowX < minX) continue;
            if (rowX > maxX) break;
            const row = vg[rowX];
            const keys = vgKeys.rows[rowX];

            if (rowX > minFullX && rowX < maxFullX) {
                for (const cellY of keys) {
                    if (cellY < minY) continue;
                    if (cellY > maxY) break;

                    if (cellY > minFullY && cellY < maxFullY) row[cellY].forEach(index => cardsInViewport[index] = 2);
                    else checkCell(row[cellY]);
                }
            } else {
                for (const cellY of keys) {
                    if (cellY < minY) continue;
                    if (cellY > maxY) break;

                    checkCell(row[cellY]);
                }
            }
        }

        this.#visibleCardsCount = cardsInViewport.reduce((count, inViewport) => inViewport !== 0 ? count + 1 : count, 0);
        ControlsController.visibleCardsCount = this.#visibleCardsCount;
        ControlsController.updateViewportStatus();
    }

    #calculateCardBoundaries(d) {
        d.boundaries = [ d.x, d.y , d.x + d.width, d.y + d.height ];
        return d.boundaries;
    }

    #search() {
        ControlsController.searchGoToElement.setAttribute('data-next', 0);

        if (this.#filter) {
            const filter = this.#filter;
            const matched = [];
            const notMatched = [];

            const { check, matchRegex } = createRegexSearch(filter, {caseInsensitive: true });
            this.#filterCheckString = check;
            this.#filterRegex = matchRegex;

            this.cards.forEach(d => (check(d.title) || d.relatedTags.some(item => check(item.title)) ? matched : notMatched).push(d));
            ControlsController.searchClearElement.style.visibility = 'visible';
            ControlsController.searchGoToElement.setAttribute('data-count', matched.length);
            this.#cardsMatched = matched;
            this.#cardsNotMatched = notMatched;
        } else {
            this.#filterCheckString = null;
            this.#filterRegex = null;
            this.#cardsMatched = [];
            this.#cardsNotMatched = [...this.cards];
            ControlsController.searchClearElement.style.visibility = 'hidden';
            ControlsController.searchGoToElement.setAttribute('data-count', 0);
        }

        // Sort cards by proximity, for  more predictive navigation
        if (SORT_SEARCH_BY_PROXIMITY) {
            // The timer is needed to avoid too frequent recalculations (on 8k+ cards, if you need to count all 8k matches, it takes too much time)
            if (this.#searchTimer !== null) clearTimeout(this.#searchTimer);
            this.#searchTimer = setTimeout(() => {
                this.#searchTimer = null;
                if (this.#filter) this.#cardsMatched = sortByProximity(this.#cardsMatched);
            }, 200);
        }
    }

    // ———  Render DOM  ———

    #render_DOM() {
        const filter = this.#filter;
        const data = this.cards;
        const cardsInViewport = this.#cardsInViewport;

        let isMatched = false;

        const moveElement = d => {
            if (!cardsInViewport[d.index]) {
                if (d.cardElement?.inDOM) this.#r_DOM_removeCard(d.cardElement);
                return;
            }

            const cardElement = d.cardElement ?? this.#r_DOM_createCard(d);
            if (cardElement.x !== d.x) {
                cardElement.style.left = `${d.x}px`;
                cardElement.x = d.x;
            }
            if (cardElement.y !== d.y) {
                cardElement.style.top = `${d.y}px`;
                cardElement.y = d.y;
            }
            if (cardElement.filter !== filter) {
                if (cardElement.matched !== isMatched) this.#r_DOM_toggleCardMatched(cardElement, isMatched);
                this.#r_DOM_updateCardFilter(cardElement, filter);
            }
            if (!cardElement.inDOM) this.#r_DOM_appendCard(cardElement);
        };

        if (filter) {
            // Move matching elements to end (so that they are not covered by other elements)
            this.#cardsNotMatched.forEach(moveElement);
            isMatched = true;
            this.#cardsMatched.forEach(moveElement);
        } else {
            data.forEach(moveElement);
        }
    }

    #r_DOM_createCard(d) {
        const { element, titleElement, searchList } = createCardElement(d);
        const style = element.style;
        style.width = `${d.width}px`;
        const searchInfo = d.relatedTags.map(({ title, searchText }, i) => ({ title, searchText, element: searchList[i] }));
        searchInfo.push({ title: d.title, searchText: d.title.toLowerCase(), element: titleElement });
        d.cardElement = { inDOM: false, element, style, title: d.title, searchInfo, matched: false };
        return d.cardElement;
    }

    #r_DOM_updateCardFilter(cardElement, filter) {
        cardElement.filter = filter;

        if (cardElement.matched) {
            const check = this.#filterCheckString;
            const matchRegex = this.#filterRegex;

            const processString = (element, string) => {
                element.textContent = '';
                element.appendChild(highlightMatches(string, matchRegex));
            };

            cardElement.searchInfo.forEach(item => {
                const isMatched = check(item.title);
                if (isMatched) processString(item.element, item.title);
                else item.element.textContent = item.title;
                item.element.classList.toggle('related-tag-matched', isMatched);
            });
        } else {
            cardElement.searchInfo.forEach(item => {
                item.element.textContent = item.title;
                item.element.classList.toggle('related-tag-matched', false);
            });
        }
    }

    #r_DOM_toggleCardMatched(cardElement, isMatched) {
        cardElement.element.classList.toggle('card-matched', isMatched);
        cardElement.matched = isMatched;
    }

    #r_DOM_appendCard(cardElement) {
        this.cardsContainer.appendChild(cardElement.element);
        cardElement.inDOM = true;
    }

    #r_DOM_removeCard(cardElement) {
        cardElement.element.remove();
        cardElement.inDOM = false;
    }

    #r_DOM_init() {
        this.#render_preview = this.#render_DOM;
        this.ctx = null;
    }

    // ———  Render 2d  ———

    #render_2d() {
        const cards = this.cards;
        const scale = this.#scale;
        const ctx = this.ctx;
        const cardsInViewport = this.#cardsInViewport;

        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.translate(this.#panX, this.#panY);

        const scaleCached = this.#scaleCached;
        if (this.#filter) ctx.lineWidth = scaleCached.outlineWidth;
        const { mathcedOutlineImages, outlineWidth, borderRadius } = scaleCached;
        const outlineWidthHalf = outlineWidth / 2;

        const calculateCardScale = d => {
            d.scaled = [ d.x * scale, d.y * scale, d.width * scale, d.height * scale ];
            d.scaledTo = scale;
        };
        const drawMatchedCard = d => {
            if (!cardsInViewport[d.index]) return;

            if (d.scaledTo !== scale) calculateCardScale(d);

            const previewInfo = d.previewInfo;
            const scaled = d.scaled;
            ctx.drawImage(d.previewCanvas, previewInfo[0], previewInfo[1], previewInfo[2], previewInfo[3], scaled[0], scaled[1], scaled[2], scaled[3]);
            const outlineImage = mathcedOutlineImages.get(d.sizeKey);
            if (outlineImage) ctx.drawImage(outlineImage, scaled[0] - outlineWidth, scaled[1] - outlineWidth);
            else ctx.stroke(getRoundedRectPath(scaled[2], scaled[3], borderRadius, scaled[0], scaled[1]));
        };
        const drawMatchedOutline = d => {
            if (!cardsInViewport[d.index]) return;

            if (d.scaledTo !== scale) calculateCardScale(d);

            const scaled = d.scaled;
            const outlineImage = mathcedOutlineImages.get(d.sizeKey);
            if (outlineImage) ctx.drawImage(outlineImage, scaled[0] - outlineWidth, scaled[1] - outlineWidth);
            else ctx.fill(getRoundedRectPath(scaled[2] + outlineWidth, scaled[3] + outlineWidth, borderRadius, scaled[0] - outlineWidthHalf, scaled[1] - outlineWidthHalf));
        };
        const drawCard = d => {
            if (!cardsInViewport[d.index]) return;

            if (d.scaledTo !== scale) calculateCardScale(d);

            const previewInfo = d.previewInfo;
            const scaled = d.scaled;
            ctx.drawImage(d.previewCanvas, previewInfo[0], previewInfo[1], previewInfo[2], previewInfo[3], scaled[0], scaled[1], scaled[2], scaled[3]);
        };

        if (this.#filter) {
            // Move matching elements to end (so that they are not covered by other elements)
            this.#cardsNotMatched.forEach(drawCard);
            if (scaleCached.drawOnlyMatchedOutline) this.#cardsMatched.forEach(drawMatchedOutline);
            else this.#cardsMatched.forEach(drawMatchedCard);
        } else {
            cards.forEach(drawCard);
        }

        ctx.translate(-this.#panX, -this.#panY);
    }

    #r_2d_init() {
        const canvas = document.getElementById('image-canvas');
        const ctx = canvas.getContext('2d', { alpha: true });

        ctx.imageSmoothingEnabled = CANVAS_SMOOTHING;
        ctx.imageSmoothingQuality = CANVAS_SMOOTHING_QUALITY;
        ctx.textRendering = CANVAS_TEXT_QUALITY;

        ctx.fillStyle = CARD_STYLE.matchedColor;
        ctx.strokeStyle = CARD_STYLE.matchedColor;

        this.#clear_canvas = this.#r_2d_clearCanvas;
        this.#render_preview = this.#render_2d;
        this.#render_coordinatesChanged = this.#r_2d_coordinatesChanged;
        this.ctx = ctx;

        return ctx;
    }

    #r_2d_coordinatesChanged() {
        const scale = this.#scale;
        this.cards.forEach(d => {
            if (d.scaled) {
                d.scaled[0] = d.x * scale;
                d.scaled[1] = d.y * scale;
            }
        });
    }

    #r_2d_clearCanvas() {
        this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // ———  Render WebGL2  ———

    // TODO: Every frame transmitting the same texture coordinates... stupid, fix it

    #r_WebGL2_program;
    #r_WebGL2_textures;

    #render_WebG2L() {
        const cards = this.cards;
        const panX = this.#panX;
        const panY = this.#panY;
        const scale = this.#scale;
        const gl = this.ctx;
        const program = this.#r_WebGL2_program;
        const cardsInViewport = this.#cardsInViewport;

        gl.clear(gl.COLOR_BUFFER_BIT);

        const texturesToDraw = [];
        this.#r_WebGL2_textures.forEach(texture => texturesToDraw.push({ cards: [], texture }));

        cards.forEach(d => cardsInViewport[d.index] ? texturesToDraw[d.texLayer].cards.push(d) : null);

        const panLocation = gl.getUniformLocation(program, 'u_pan');
        const scaleLocation = gl.getUniformLocation(program, 'u_scale');
        const positionLocation = gl.getAttribLocation(program, 'a_position');
        const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
        const textureLocation = gl.getUniformLocation(program, 'u_texture');

        const createBuffer = (location, bufferArray) => {
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, bufferArray, gl.STATIC_DRAW);

            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);

            return buffer;
        };

        const drawFromTexture = (texture, texCoords, positions) => {
            const positionBuffer = createBuffer(positionLocation, positions);
            const texCoordBuffer = createBuffer(texCoordLocation, texCoords);

            gl.uniform2f(panLocation, panX / CANVAS_WIDTH, panY / CANVAS_HEIGHT);
            gl.uniform1f(scaleLocation, scale);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(textureLocation, 0);

            gl.drawArrays(gl.TRIANGLES, 0, Math.floor(positions.length/2));

            gl.deleteBuffer(positionBuffer);
            gl.deleteBuffer(texCoordBuffer);
        };

        texturesToDraw.forEach(layer => {
            if (layer.cards.length !== 0) {
                const positions = new Float32Array(layer.cards.length * 12);
                const texCoords = new Float32Array(layer.cards.length * 12);
                let lastIndex = 0;
                layer.cards.forEach(d => {
                    positions.set(d.position, lastIndex);
                    texCoords.set(d.texCoords, lastIndex);
                    lastIndex += 12;
                });
                drawFromTexture(layer.texture, texCoords, positions);
            }
        });
    }

    #r_WebGL2_init() {
        const canvas = document.getElementById('image-canvas');
        const gl = canvas.getContext('webgl2', { alpha: true });
        gl.clearColor(0, 0, 0, 0);

        this.#clear_canvas = this.#r_WebGL2_clearCanvas;
        this.#render_preview = this.#render_WebG2L;
        this.#render_coordinatesChanged = this.#r_WebGL2_coordinatesChanged;
        this.#destroy = this.#r_WebGL2_destroy;
        this.ctx = gl;

        // Prepare textures
        this.#r_WebGL2_textures = [];
        const previewId = CARD_PREVIEW_SCALING.at(-1).id;
        const previewController = STATE.previewControllers[previewId];
        previewController.grid.layers.forEach(layer => {
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layer.canvas);

            this.#r_WebGL2_textures.push(texture);

            // Clear the preview canvas, it is no longer needed
            layer.canvas.width = 0;
            layer.canvas.height = 0;
        });


        // Prepare texture coordinates
        const layers = previewController.grid.layers.map(layer => ([ layer.width, layer.height ]));
        this.cards.forEach(d => {
            const preview = d[previewId];
            const layer = layers[preview.layer];
            const texInfo = [ preview.x / layer[0], preview.y / layer[1], preview.width / layer[0], preview.height / layer[1] ];
            const size = [ d.x / CANVAS_WIDTH, d.y / CANVAS_HEIGHT, d.width / CANVAS_WIDTH, d.height / CANVAS_HEIGHT ];
            d.texLayer = preview.layer;
            d.texCoords = this.#r_WebGL2_getCoords(texInfo);
            d.position = this.#r_WebGL2_getCoords(size);
        });

        //

        const vertexShaderSource = `#version 300 es
        precision lowp float;

        in vec2 a_position;
        in vec2 a_texCoord;

        uniform vec2 u_pan;
        uniform float u_scale;

        out vec2 v_texCoord;

        void main() {
            gl_Position = vec4((a_position.x * u_scale + u_pan.x) * 2.0 - 1.0, 1.0 - (a_position.y * u_scale + u_pan.y) * 2.0, 0.0, 1.0);
            v_texCoord = a_texCoord;
        }
        `;

        const fragmentShaderSource = `#version 300 es
        precision lowp float;

        in vec2 v_texCoord;
        out vec4 fragColor;

        uniform sampler2D u_texture;

        void main() {
            fragColor = texture(u_texture, v_texCoord);
        }
        `;

        const vertexShader = this.#r_WebGL2_createShader(gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.#r_WebGL2_createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

        this.#r_WebGL2_program = this.#r_WebGL2_createProgram(vertexShader, fragmentShader);
        gl.useProgram(this.#r_WebGL2_program);
    }

    #r_WebGL2_destroy() {
        const gl = this.ctx;
        this.#r_WebGL2_textures.forEach(texture => gl.deleteTexture(texture));
    }

    #r_WebGL2_coordinatesChanged() {
        this.cards.forEach(d => {
            const size = [ d.x / CANVAS_WIDTH, d.y / CANVAS_HEIGHT, d.width / CANVAS_WIDTH, d.height / CANVAS_HEIGHT ];
            d.position = this.#r_WebGL2_getCoords(size);
        });
    }

    #r_WebGL2_getCoords(info) {
        return [
            info[0], info[1] + info[3],
            info[0] + info[2], info[1] + info[3],
            info[0], info[1],
    
            info[0], info[1],
            info[0] + info[2], info[1],
            info[0] + info[2], info[1] + info[3]
        ];
    }

    #r_WebGL2_clearCanvas() {
        this.ctx.clear(this.ctx.COLOR_BUFFER_BIT);
    }

    #r_WebGL2_createShader(type, source) {
        const gl = this.ctx;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    #r_WebGL2_createProgram(vertexShader, fragmentShader) {
        const gl = this.ctx;
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }
        return program;
    }
}


// Functions for work with data


async function selectData(id) {
    id = Number(id);
    const key = INDEX[id]?.id ?? 'unknown';
    if (STATE.selectData === key) return;
    const loaderPrefix = '[Loader]';
    const cCode = 'background-color: #264f73; color: #c5d9eb; padding: .125em .5em; border-radius: .25em;';
    const loading = document.getElementById('loading') ?? createElement('div', { id: 'loading' });
    const currentLoadingText = loading.textContent;
    loading.textContent = '';
    const loadingText = insertElement('span', loading, undefined, currentLoadingText);
    document.body.classList.add('loading');
    let loadingStatus = '';
    const setLoadingStatus = async text => {
        if (loadingStatus) console.timeEnd(loadingStatus);
        loadingText.textContent = text;
        await new Promise(r => setTimeout(r, 0)); // A hack to make the browser render the text
        loadingStatus = `${loaderPrefix} ${text}`;
        console.time(loadingStatus);
    };
    document.body.appendChild(loading);

    STATE.ready = false;
    console.log(`${loaderPrefix} Start loading %c${key}`, cCode);

    // Reset cache state in prev data
    await setLoadingStatus('Unloading data');
    STATE.renderController?.destroy?.();
    STATE.previewControllers = {};
    const keysToClear = [...CARD_PREVIEW_SCALING.map(i => i.id), 'cardElement', 'index' ];
    STATE.data.forEach(d => keysToClear.forEach(key => d[key] !== undefined ? delete d[key] : null));
    delete STATE.maxCardWidth;
    delete STATE.maxCardHeight;
    cardsContainer.textContent = '';
    cardsContainer.removeAttribute('style');
    graphContainer.textContent = '';
    graphContainer.removeAttribute('style');

    // Load data from file
    await setLoadingStatus(INDEX[id].fileSize ? `Loading data (${filesizeToString(INDEX[id].fileSize)})` : 'Loading data');
    const data = INDEX[id].data ?? await fetchData(id);
    STATE.source = data;
    STATE.data = data.nodes;
    console.log(`${loaderPrefix} %c${key}%c: `, cCode, '', data);

    // Process each item in list
    STATE.data.forEach((d, index) => {
        d.index = index;
        d.id = d.id ?? `card-${index}`;

        if (d.relatedTags) d.relatedTags = d.relatedTags.map(tag => {
            if (typeof tag === 'string') return { title: tag };
            return tag;
        }); else d.relatedTags = [];
    });


    STATE.renderController = new RenderController(data, RENDER_ENGINE);

    await setLoadingStatus('Image Decoding');
    await STATE.renderController.decodeImages();

    await setLoadingStatus('Calculating the size of cards');
    STATE.renderController.calculateCardSizes();

    ControlsController.updateEmbeddingList(data.spaces);

    const scaleInfoFirst = CARD_PREVIEW_SCALING.at(-1);
    if (CARD_SCALE_PREVIEW >= SCALE_MIN && scaleInfoFirst.allowed) {
        // Full preview
        await setLoadingStatus(`Generating preview (${scaleInfoFirst.title})`);

        const firstPreviewController = STATE.previewControllers[scaleInfoFirst.id] = new CardsPreviewController(scaleInfoFirst.id, STATE.data, scaleInfoFirst.scale * scaleInfoFirst.quality);
        await firstPreviewController.drawCards();

        // Downscaled previews
        for (let i = CARD_PREVIEW_SCALING.length - 2; i >= 0; i--) {
            const scaleInfo = CARD_PREVIEW_SCALING[i];
            if (scaleInfo.allowed) {
                await setLoadingStatus(`Generating preview (${scaleInfo.title})`);

                STATE.previewControllers[scaleInfo.id] = new CardsPreviewController(scaleInfo.id, STATE.data, scaleInfo.scale * scaleInfo.quality);
                await STATE.previewControllers[scaleInfo.id].drawCards(STATE.previewControllers[CARD_PREVIEW_SCALING[i + 1].id]);
            }
        }
    }

    // Create physics controller
    STATE.maxCardWidth = Math.max(...STATE.data.map(item => item.width));
    STATE.maxCardHeight = Math.max(...STATE.data.map(item => item.height));
    STATE.physics = new CardsPhysicController(STATE.data, STATE.maxCardWidth, STATE.maxCardHeight);

    await setLoadingStatus('Calculating the position of the cards');
    selectSpace(STATE.data, STATE.space);
    if (data.spaces.length > 1) document.getElementById('switch-spaces')?.parentElement?.removeAttribute('disabled');
    else document.getElementById('switch-spaces')?.parentElement?.setAttribute('disabled', '');

    await setLoadingStatus('Initializing the render controller');
    await STATE.renderController.init();

    console.timeEnd(loadingStatus);
    loading.remove();
    document.body.classList.remove('loading');

    STATE.selectData = key;
    STATE.ready = true;
    console.log(`${loaderPrefix} Loading %c${key}%c ready`, cCode, '');
    STATE.renderController.recenterView(0);
    
    STATE.renderController.renderGraph(-1);

    ControlsController.selectOptionInDataSwitcher(id);
}

function selectSpace(data, space) {
    const spacing = STATE.spacing;
    const dataCountSpacingFactor = 1024;
    const maxDataSpacingFactor = 3;

    const skipThisCards = new Set();

    // Select data
    let { x: minX, x: maxX, y: minY, y: maxY } = data[0].spaces[space];
    data.forEach((d, i) => {
        const { x, y, positionAbsolute } = d.spaces[space];
        d.x = x;
        d.y = y;

        if (positionAbsolute) skipThisCards.add(i);

        if (x < minX) minX = x;
        else if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        else if (y > maxY) maxY = y;
    });

    // Normalize data
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;

    const scaleFactor = Math.min(CANVAS_WIDTH / rangeX, CANVAS_HEIGHT / rangeY) * spacing * (data.length > dataCountSpacingFactor ? Math.min(data.length / dataCountSpacingFactor, maxDataSpacingFactor) : 1);

    const offsetX = (CANVAS_WIDTH - rangeX * scaleFactor) / 2 - minX * scaleFactor;
    const offsetY = (CANVAS_HEIGHT - rangeY * scaleFactor) / 2 - minY * scaleFactor;

    if (MOVE_CARDS_HALF_SIZE) {
        data.forEach((d, i) => {
            if (skipThisCards.has(i))  {
                d.x = d.x - d.width / 2;
                d.y = d.y - d.height / 2;
            } else {
                d.x = d.x * scaleFactor + offsetX - d.width / 2;
                d.y = d.y * scaleFactor + offsetY - d.height / 2;
            }
        });
    } else {
        data.forEach((d, i) => {
            if (skipThisCards.has(i)) return;
            d.x = d.x * scaleFactor + offsetX;
            d.y = d.y * scaleFactor + offsetY;
        });
    }

    STATE.renderController.coordinatesChanged();
    STATE.physics.updatePoints();
}

async function switchEmb(embIndex, animate = true) {
    const duration = 1500;
    const renderController = STATE.renderController;
    const data = renderController.cards;
    STATE.space = embIndex;

    const targets = data.map(d => ({ prevX: d.x, prevY: d.y, }));
    selectSpace(data, STATE.space);
    targets.forEach((d, index) => {
        d.newX = data[index].x;
        d.newY = data[index].y;
        d.deltaX = d.newX - d.prevX;
        d.deltaY = d.newY - d.prevY;
    });

    if (animate && !IS_REDUCED_MOTION) {
        const timeStart = Date.now();
        const timeEnd = timeStart + duration;
        let timeNow = Date.now();

        const step = async t => {
            const factor = smoothStepFactor(t);
    
            data.forEach((d, i) => {
                const t = targets[i];
                d.x = t.prevX + factor * t.deltaX;
                d.y = t.prevY + factor * t.deltaY;
            });
            STATE.renderController.coordinatesChanged();
    
            await draw();
            renderController.renderGraph();
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
        data.forEach((d, i) => {
            const t = targets[i];
            d.x = t.newX;
            d.y = t.newY;
        });
        STATE.physics.updatePoints();
        STATE.renderController.coordinatesChanged();
        await draw();
        renderController.renderGraph();
    }
}

async function fetchData(id) {
    if (!INDEX[id]?.url) throw new Error('No download link');
    const json = await fetch(INDEX[id].url).then(response => response.json());
    const data = DataController.normalizeData(json);
    INDEX[id].data = data;
    return data;
}

async function importJsonFile(file) {
    addNotify(`📄 ${file.name}`, 4000);

    const key = file.name;
    let dataIndex = -1;
    let dataType = null;
    INDEX.forEach((item, i) => item.id === key ? dataIndex = i : null);

    if (dataIndex === -1) {
        try {
            // JS string limit: 1GiB. Files are encoded mostly in UTF-8, but when decoded into strings they become UTF-16,
            // which is often x2 in size (1 byte per character vs. the minimum of 2 bytes per character).
            // Therefore, the maximum file size is limited to 512 MB.
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/length
            //
            // Naturally, this problem can be solved, for example, by parsing the file into parts and putting base64 images in separate lines,
            // but... is it necessary? Who would like it if the browser started to consume so much memory?
            //
            // 536870912 - 512 mb
            if (file.size > 536870912) throw new Error('File is too large (More than 512 MB)');

            const loading = document.getElementById('loading') ?? createElement('div', { id: 'loading' });
            loading.textContent = 'Start of import';
            document.body.appendChild(loading);
            document.body.classList.add('loading');

            const text = await fileToText(file);
            const json = JSON.parse(text);
            const data = DataController.normalizeData(json);
            dataType = DataController.getDataType(data);

            dataIndex = INDEX.length;
            INDEX.push({ id: key, title: key, type: dataType, data: data, description: `Imported from file "${file.name}"`, fileSize: file.size, nodesCount: data.nodes.length, changed: Date.now(), imported: true });

            ControlsController.updateDataSwitcher();
        } catch (err) {
            console.error(err);
            document.getElementById('loading')?.remove();
            document.body.classList.remove('loading');
            addNotify(`❌ Import error: ${err}`, 6000);
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


// Functions for render data


let drawRequestAnimationFrame = null;
const drawRequestAnimationFrameCallbacks = [];
function draw() {
    return new Promise(resolve => {
        drawRequestAnimationFrameCallbacks.push(resolve);
        if (!drawRequestAnimationFrame) drawRequestAnimationFrame = requestAnimationFrame(() => {
            drawRequestAnimationFrame = null;
            STATE.renderController.render();
            drawRequestAnimationFrameCallbacks.forEach(r => r());
            drawRequestAnimationFrameCallbacks.length = 0;
        });
    });
}

function createCardElement(d) {
    const card = createElement('div', { class: 'card', 'data-id': d.id });
    if (d.image) card.appendChild(d.image);
    else insertElement('div', card, { class: 'image-placeholder' }, 'no-image');
    const p = insertElement('p', card, { class: 'card-title' }, d.title);
    const controls = insertElement('div', card, { class: 'buttons' });
    
    if (d.information) insertElement('div', controls, { class: 'button', 'data-id': 'info' }).appendChild(ICON_BOOK.cloneNode(true));
    else insertElement('div', controls, { class: 'button', 'disabled': '' }).appendChild(ICON_BOOK.cloneNode(true));
    
    insertElement('div', controls, { class: 'button', 'data-id': 'copy' }).appendChild(ICON_COPY.cloneNode(true));

    const searchPopup = insertElement('div', card, { class: 'card-related-tags' });
    const searchList = d.relatedTags.map(item => insertElement('span', searchPopup, { class: 'related-tag' }, item.title));

    return { element: card, titleElement: p, searchList };
}

function createCardInfoElement(d, infoFields) {
    const cardInfoElement = createElement('div', { class: 'card-info-dialog', 'data-id': d.id });
    const card = insertElement('div', cardInfoElement, { class: 'card', style: `width: ${d.width}px;` });
    if (d.image) card.appendChild(d.image.cloneNode(true));
    else insertElement('div', card, { class: 'image-placeholder' }, 'no-image');
    const p = insertElement('p', card, { class: 'card-title' }, d.title);
    const cardInfoList = insertElement('div', cardInfoElement, { class: 'card-info' });
    const dInformation = d.information ?? {};
    infoFields.forEach(field => {
        if (!dInformation[field.id]) return;
        const fieldElement = insertElement('p', cardInfoList, { class: 'card-info-field' });
        if (field.type === 'title') {
            insertElement('h3', fieldElement, { class: 'card-info-field-title' }, dInformation[field.id]);
        } else {
            if (field.title) insertElement('span', fieldElement, { class: 'card-info-field-name' }, `${field.title}: `);
            if (field.type === 'url') insertElement('a', fieldElement, { class: 'card-info-field-value', href: dInformation[field.id] }, dInformation[field.id].replace('https://', ''));
            else insertElement('span', fieldElement, { class: 'card-info-field-value' }, dInformation[field.id]);
        }
    });
    if (d.relatedTags) {
        const relatedTagsElement = insertElement('p', cardInfoList, { class: 'card-info-related-tags' });
        d.relatedTags.forEach(tag => {
            insertElement('code', relatedTagsElement, { class: 'card-info-related-tag', 'data-tag': tag.title }, tag.title);
        });
    }

    return cardInfoElement;
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


async function applyInertia() {
    const MIN_VELOCITY = 0.2; // Minimum acceleration to apply
    const controller = STATE.renderController;

    while (Math.abs(STATE.velocityX) > MIN_VELOCITY || Math.abs(STATE.velocityY) > MIN_VELOCITY) {
        if (STATE.mousedown) break;
        STATE.velocityX *= PANNING_INERTIA_FRICTION;
        STATE.velocityY *= PANNING_INERTIA_FRICTION;

        controller.panX += STATE.velocityX;
        controller.panY += STATE.velocityY;
        await draw();
    }
}


// Activate imputs


// All inputs
let spacingAnimationFrame = null;
const inputsInit = [
    { id: 'scale-factor-coef', eventName: 'input',
        value: STATE.spacing,
        callback: e => {
            closeAllCardInfoDialog();
            STATE.spacing = e.target.valueAsNumber;
            if (!spacingAnimationFrame) spacingAnimationFrame = requestAnimationFrame(() => {
                spacingAnimationFrame = null;
                if (STATE.ready) {
                    selectSpace(STATE.data, STATE.space);
                    STATE.renderController.coordinatesChanged();
                    STATE.renderController.render(true);
                    STATE.renderController.renderGraph();
                }
            });
        }
    },
    { id: 'recenter-view', eventName: 'click',
        callback: e => STATE.renderController.recenterView(e.ctrlKey ? 0 : undefined)
    },
    { id: 'switch-spaces', eventName: 'change',
        callback: e => {
            closeAllCardInfoDialog();
            switchEmb(Number(e.target.value));
        }
    },
    { id: 'search', eventName: 'input',
        callback: () => {
            closeAllCardInfoDialog();
            STATE.renderController.filter = ControlsController.searchInputElement.value.trim().toLowerCase();
            draw();
        }
    },
    { id: 'search', eventName: 'keyup',
        callback: e => e.code ==='Enter' ? gotoNextSearchResult(e.shiftKey, !e.ctrlKey) : null
    },
    { id: 'search-clear', eventName: 'click',
        callback: () => {
            closeAllCardInfoDialog();
            ControlsController.searchInputElement.value = '';
            STATE.renderController.filter = '';
            draw();
        }
    },
    { id: 'data-list', eventName: 'click',
        callback: e => {
            closeAllCardInfoDialog();
            const id = e.target.closest('.data-option[data-id]')?.getAttribute('data-id') ?? null;
            ControlsController.dataListElement.classList.toggle('hidden');
            if (id !== null) selectData(Number(id));
        }
    },
    { id: 'data-list-selected', eventName: 'click',
        callback: e => {
            closeAllCardInfoDialog();
            ControlsController.dataListElement.classList.toggle('hidden');
        }
    },
    { id: 'random',eventName: 'click',
        callback: e => {
            if (!STATE.ready) return;
            closeAllCardInfoDialog();

            const animate = !e.ctrlKey;
            const controller = STATE.renderController;
            const scale = controller.scale;
            const card = STATE.data[Math.floor(Math.random()*STATE.data.length)];

            ControlsController.searchInputElement.value = card.title;
            controller.filter = card.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            const targetPanX = CANVAS_WIDTH / 2 - card.x * scale - (card.width * scale) / 2;
            const targetPanY = CANVAS_HEIGHT / 2 - card.y * scale - (card.height * scale) / 2;
            if (animate) STATE.renderController.animatedPanTo(targetPanX, targetPanY);
            else {
                controller.panX = targetPanX;
                controller.panY = targetPanY;
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
            closeAllCardInfoDialog();
            STATE.physics.overlapFix();
        }
    },
    { id: 'toggle-advanced-settings', eventName: 'click',
        callback: () => {
            const group = document.getElementById('advanced-settings-group');
            const toggleButon = document.getElementById('toggle-advanced-settings');
            const newState = !group.classList.contains('hidden');
            const buttonTextList = toggleButon.getAttribute('data-toggle-text')?.split('|') ?? ['Show advanced settings', 'Hide advanced settings'];
            toggleButon.querySelector('span:not(.emoji)').textContent = buttonTextList[Number(!newState)];
            group.classList.toggle('hidden', newState);
        }
    },
    { id: 'upload-json', eventName: 'click',
        callback: () => {
            closeAllCardInfoDialog();
            const fileInput = document.getElementById('upload-json-input');
            fileInput.files.length = 0;
            fileInput.click();
        }
    },
    { id: 'upload-json-input', eventName: 'change',
        callback: () => {
            closeAllCardInfoDialog();
            const fileInput = document.getElementById('upload-json-input');
            const file = fileInput.files[0];
            if (file && file.type === 'application/json') importJsonFile(file);
        }
    },
    { id: 'render-engine', eventName: 'change',
        callback: e => {
            if (SETTINGS['render-engine'].options.includes(e.target.value)) {
                trySetSetting('render-engine', e.target.value);
                addNotify('💡 Refresh page. The rendering engine will only change after refreshing the page', 10000);
            } else {
                console.log('How did this render engine make it to the list?', e.target.value);
                e.preventDefault();
            }
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
function gotoNextSearchResult(back = false, animate = true) {
    const dataNext = Number(ControlsController.searchGoToElement.getAttribute('data-next')) ?? 0;
    const matched = STATE.renderController.cardsMatched;
    const filter = STATE.renderController.filter;
    if (!filter || !matched.length) return;
    const next = back ? (dataNext - 2 < 0 ? matched.length - (2 - dataNext) : dataNext - 2) : dataNext;
    const { x, y, width, height } = matched[next % matched.length];
    ControlsController.searchGoToElement.setAttribute('data-next', (next + 1) % matched.length);
    const targetScale = SCALE_SEARCH;
    const targetPanX = CANVAS_WIDTH / 2 - x * targetScale - (width * targetScale) / 2;
    const targetPanY = CANVAS_HEIGHT / 2 - y * targetScale - (height * targetScale) / 2;
    if (animate) STATE.renderController.animatedPanTo(targetPanX, targetPanY, targetScale);
    else {
        const controller = STATE.renderController;
        controller.scale = targetScale;
        controller.panX = targetPanX;
        controller.panY = targetPanY;
        draw();
    }
}


//  Some functions


function addNotify(text, duration = 2000) {
    const li = insertElement('li', document.getElementById('notify-list'), undefined, text);
    setTimeout(() => li.remove(), duration);
}


// Basic functions


function createRegexSearch(filter, { caseInsensitive = false } = {}) {
    if (!filter) return { check: () => false, matchRegex: /(?:)/ };

    let pattern = filter;

    try {
        const flags = 'g' + (caseInsensitive ? 'i' : '');
        const matchRegex = new RegExp(pattern, flags);
        const check = text => matchRegex.test(text);
        return { check, matchRegex };
    } catch (_) {
        return { check: () => false, matchRegex: /(?:)/ };
    }
}

function highlightMatches(text, matchRegex) {
    const fragment = new DocumentFragment();
    let lastIndex = 0;
    
    text.replace(matchRegex, (match, offset) => {
        if (offset > lastIndex) fragment.appendChild(document.createTextNode(text.slice(lastIndex, offset)));
        fragment.appendChild(createElement('mark', undefined, match));
        lastIndex = offset + match.length;
    });
    
    if (lastIndex < text.length) fragment.appendChild(document.createTextNode(text.slice(lastIndex)));

    return fragment;
}

function filesizeToString(size) {
    // 1 B = 0.0009765625 KB
    // 1 KB = 0.0009765625 MB
    // ...
    if (size < 1228) return `${size} B`;
    if (size < 1258291) return `${+(size * 0.0009765625).toFixed(1)} Kb`;
    size = size * 0.0009765625;
    if (size < 1288490188) return `${+(size * 0.0009765625).toFixed(2)} Mb`;
    size *= 0.0009765625;
    return `${+(size).toFixed(3)} Gb`;
}

function copyThis(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(copyThis);
    return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, copyThis(value)]));
}

function timeAgo(seconds) {
    const units = {
        second: [ "second", "seconds", "seconds" ],
        minute: [ "minute", "minutes", "minutes" ],
        hour: [ "hour", "hours", "hours" ],
        day: [ "day", "days", "days" ],
        week: [ "week", "weeks", "weeks" ],
        month: [ "month", "months", "months" ],
        year: [ "year", "years", "years" ]
    };
    const ago = [
        [ 31536000, 'year' ],
        [ 2592000, 'month' ],
        [ 604800, 'week' ],
        [ 86400, 'day' ],
        [ 3600, 'hour' ],
        [ 60, 'minute' ],
        [ 1, 'second' ],
    ];
    const baseString = seconds < 0 ? 'in %n %unit' : '%n %unit ago';
    if (seconds < 0) seconds = Math.abs(seconds);
    const i = seconds > 31536000 ? 0 : seconds > 2592000 ? 1 : seconds > 604800 ? 2 : seconds > 86400 ? 3 : seconds > 3600 ? 4 : seconds > 60 ? 5 : 6;
    const n = Math.floor(seconds / ago[i][0]);
    if (n === 0) return 'now';
    const unit = units[ago[i][1]]?.[(n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2)] ?? ago[i][1];
    return baseString.replace('%n', n).replace('%unit', unit);
}

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


function closeAllCardInfoDialog() {
    const elements = document.querySelectorAll('.card-info-dialog');
    if (!elements.length) return;
    if (document.startViewTransition) {
        const easing = 'ease-in-out';
        const duration = 200;
        const animationInfo = Array.from(elements).map((el, i) => {
            const id = `card-info-dialog-${i}`;
            el.style.viewTransitionName = id;
            return { el, scaleStart: el.getAttribute('data-scale-start'), id };
        });
        const transition = document.startViewTransition(() => elements.forEach(el => el.style.display = 'none'));
        transition.ready.then(() => {
            for (const item of animationInfo) {
                document.documentElement.animate( { transform: [ 'scale(1,1)', item.scaleStart ] }, { pseudoElement: `::view-transition-old(${item.id})`, duration, easing } );
            }
        });
        transition.finished.then(() => elements.forEach(el => el.remove()));
    } else elements.forEach(el => el.remove());
}

function onCardClick(e, id) {
    const d = STATE.data.find(d => d.id === id);
    if (!d) return;

    const buttonId = e.target?.closest('.button[data-id]')?.getAttribute('data-id') ?? null;
    if (buttonId === 'info') {
        if (document.querySelector(`.card-info-dialog[data-id="${d.id}"]`)) return;

        const scale = STATE.renderController.scale;
        const cardElement = e.target.closest('.card');
        const cardInfoElement = createCardInfoElement(d, STATE.source.information);
        cardsContainer.appendChild(cardInfoElement);
        const dialogSize = cardInfoElement.getBoundingClientRect();
        const cardSize = cardElement.getBoundingClientRect();
        const cardInfoPosition = { left: d.x + d.width/2 - (dialogSize.width/scale)/2, top: d.y + d.height/2 - (dialogSize.height/scale)/2 };
        cardInfoElement.style.top = `${cardInfoPosition.top}px`;
        cardInfoElement.style.left = `${cardInfoPosition.left}px`;
        if (document.startViewTransition) {
            cardInfoElement.style.display = 'none';
            const easing = 'ease-in-out';
            const duration = 200;
            const scaleStart = `scale(${cardSize.width/dialogSize.width},${cardSize.height/dialogSize.height})`;
            cardInfoElement.style.viewTransitionName = 'card-info-dialog';
            cardInfoElement.setAttribute('data-scale-start', scaleStart);

            const transition = document.startViewTransition(() => cardInfoElement.style.display = '');
            transition.ready.then(() => document.documentElement.animate( { transform: [ scaleStart, 'scale(1,1)' ] }, { pseudoElement: "::view-transition-new(card-info-dialog)", duration, easing } ));
            transition.finished.then(() => cardInfoElement.style.viewTransitionName = '');
        }

        return;
    }
    if (buttonId === 'copy') {
        const title = d.title;
        if (title) toClipboard(title);

        return;
    }

    if (e.ctrlKey) return toClipboard(d.title);

    if (!e.altKey) STATE.renderController.renderGraph(d);
}

function onMousedown(e) {
    document.activeElement?.blur();

    if (e.button === 0 || e.touches) {
        // Ignore movement when clicking on text
        if ((!e.altKey || !e.target.closest('p')) && (!e.target.closest('a'))) {
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

    if (STATE.mousedown && STATE.ready) {
        if (STATE.mouseX !== clientX || STATE.mouseY !== clientY) {
            const controller = STATE.renderController;
            const deltaX = clientX - STATE.mouseX;
            const deltaY = clientY - STATE.mouseY;
            STATE.mousemove = true;
            controller.panX += deltaX;
            controller.panY += deltaY;

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
            else if (e.target.id === 'image-cards') {
                // Information close
                closeAllCardInfoDialog();

                // Graph change
                let canvasCardIndex = null;
                const { panX, panY, scale } = STATE.renderController;
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
                        const card = data[i];
                        if (card.x < globalX && card.y < globalY &&  card.x + card.width > globalX && card.y + card.height > globalY) canvasCardIndex = i;
                    });
                });
                if (canvasCardIndex !== null) onCardClick(e, data[canvasCardIndex].id);
                else {
                    STATE.renderController.renderGraph(-1);
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

            const controller = STATE.renderController;
            const prevScale = controller.scale;
            const prevPanX = controller.panX;
            const prevPanY = controller.panY;

            const zoom = newPinchDistance / STATE.pinchDistance;
            const newScale = Math.max(Math.min(prevScale * zoom, SCALE_MAX), SCALE_MIN);

            if (prevScale === newScale) return;

            const { x: centerX, y: centerY } = getPinchCenter(e.touches[0], e.touches[1]);

            const newPanX = centerX - (centerX - prevPanX) * (newScale / prevScale);
            const newPanY = centerY - (centerY - prevPanY) * (newScale / prevScale);

            STATE.pinchDistance = newPinchDistance;
            controller.scale = newScale;
            controller.panX = newPanX;
            controller.panY = newPanY;
            draw();
        }
    }
}

function onWheel(e) {
    if (!STATE.ready || !e.target.closest('#image-cards')) return;

    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const controller = STATE.renderController;

    const prevScale = controller.scale;
    const prevPanX = controller.panX;
    const prevPanY = controller.panY;

    const wheel = e.deltaY < 0 ? 1 : -1;
    const zoom = Math.exp(wheel * SCALE_ZOOM_INTENSITY);
    const newScale = Math.max(Math.min(prevScale * zoom, SCALE_MAX), SCALE_MIN);

    if (prevScale === newScale) return;

    const newPanX = mouseX - (mouseX - prevPanX) * (newScale / prevScale);
    const newPanY = mouseY - (mouseY - prevPanY) * (newScale / prevScale);

    controller.scale = newScale;
    controller.panX = newPanX;
    controller.panY = newPanY;
    draw();
}

function onKeydown(e) {
    // Set focus to search input instead of default page search
    if (e.ctrlKey && e.code === 'KeyF') {
        e.preventDefault();
        ControlsController.searchInputElement.focus();
    }

    // Open json file via shortcut
    if (e.ctrlKey && e.code === 'KeyO') {
        e.preventDefault();
        ControlsController.uploadJsonInput.click();
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
document.getElementById('image-cards').addEventListener('touchstart', onTouchstart);
document.addEventListener('touchmove', onTouchmove, { passive: true });
document.addEventListener('touchend', onMouseup);

// mouse
document.getElementById('image-cards').addEventListener('mousedown', onMousedown);
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
ControlsController.emptyAllInputs();
ControlsController.viewportStatusElement.textContent = `Version from ${VERSION}`;
graphContainer.textContent = '';
cardsContainer.textContent = '';

// Start things 
if (ISLOCAL) {
    addNotify('🏠 Local mode', 8000);
    console.log('🏠 Local mode\nℹ️ Index loading was skipped because the page was opened from a file');
    // document.getElementById('toggle-advanced-settings')?.click();
} else {
    fetch(INDEX_URL).then(response => response.json()).then(index => {
        index.forEach(item => INDEX.push(item));
        const selectItemIndex = INDEX.findIndex(item => item.id === SELECTED_DATA_FROM_URL);
        ControlsController.updateDataSwitcher();
        if (selectItemIndex !== -1) selectData(selectItemIndex);
        else addNotify('Select embedding UMAP from list');
    });
}

console.log(`Render engine: ${SETTINGS['render-engine']?.titles?.[RENDER_ENGINE] ?? RENDER_ENGINE}`);
