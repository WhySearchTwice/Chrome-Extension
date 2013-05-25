/* JSHint: */
/* global moment */

/**
 * Controller for the header controls
 * @author ansel
 */
function Controls($scope, broadcast) {
    $scope.$on('handleBroadcast', function(event, data) {
        if (data.action === 'updateRange') {
            $scope.range = data.rangeDuration;
            $('.navbar-controls .disable-now').prop('disabled', data.closeRange + 2 * 1000 * 60 > data.now)
        }
    });
    $scope.zoom = function(timeDelta) {
        broadcast.send({
            'action': 'zoom',
            'timeDelta': timeDelta
        });
    };
    $scope.move = function(pageX, scrollY) {
        broadcast.send({
            'action': 'move',
            'pageX': pageX,
            'scrollY': scrollY
        });
    };
    $scope.debug = function() {
        broadcast.send({ 'action': 'debug' });
    };
}

/**
 * Controller for the keyboard shortcuts
 * @author ansel
 */
function Hotkeys($scope, broadcast) {
    $scope.onKeyup = function(event) {
        switch (event.keyCode) {
        case 37:
            broadcast.send({
                'action': 'move',
                'pageX': -0.5,
                'scrollY': 0
            });
            break;
        case 38:
            broadcast.send({
                'action': 'move',
                'pageX': 0,
                'scrollY': -0.5
            });
            break;
        case 39:
            broadcast.send({
                'action': 'move',
                'pageX': 0.5,
                'scrollY': 0
            });
            break;
        case 40:
            broadcast.send({
                'action': 'move',
                'pageX': 0,
                'scrollY': 0.5
            });
            break;
        }
    };
    $scope.zoom = function(timeDelta) {
        broadcast.send({
            'action': 'zoom',
            'timeDelta': timeDelta
        });
    };
    $scope.move = function(pageX, scrollY) {
        broadcast.send({
            'action': 'move',
            'pageX': pageX,
            'scrollY': scrollY
        });
    };
    $scope.debug = function() {
        broadcast.send({ 'action': 'debug' });
    };
}

/**
 * Controller for range scale
 * @author ansel
 */
function Range($scope, broadcast) {
    $scope.selection = [];
    $scope.left = true;
    $scope.right = true;
    $scope.$on('handleBroadcast', function(event, data) {
        switch (data.action) {
        case 'updateRange':
            $scope.openRange = {
                'timestamp': data.openRange,
                'date': moment(data.openRange).format('MMM D'),
                'time': moment(data.openRange).format('h:mma')
            };
            $scope.closeRange = {
                'timestamp': data.closeRange,
                'date': moment(data.closeRange).format('MMM D'),
                'time': moment(data.closeRange).format('h:mma')
            };
            break;

        case 'moveSelection':
            $scope.moveSelection(data.selections);
            $scope.$apply();
            break;

        case 'removeSelection':
            $scope.removeSelection();
            break;
        }
    });

    $('#tree-container').on('mousewheel', function(event) {
        var deltaMagnitude = $scope.range > 15 ? 15 : $scope.range > 5 ? 5 : 1;
        broadcast.send({
            'action': 'zoom',
            'pageX': event.originalEvent.pageX,
            'pageY': event.originalEvent.pageY,
            'timeDelta': (event.originalEvent.wheelDelta > 0 ? -1 : 1) * 10
        });
    });

    $scope.moveSelection = function(data) {
        $scope.selection = [];
        if (data.type === 'mousemove') { data = [data]; }
        // selection by range hover
        for (var i = 0, l = data.length; i < l; i++) {
            var selection = data[i].selection || $scope.openRange.timestamp + (($scope.closeRange.timestamp - $scope.openRange.timestamp) * (data[i].pageX / window.innerWidth));
            $scope.selection.push({
                'styleRight' : { 'right': window.innerWidth - data[i].pageX },
                'styleLeft' : { 'left': data[i].pageX },
                'date': moment(selection).format('MMM D'),
                'time': moment(selection).format('h:mma')
            });
            $scope.selection[i].style = window.innerWidth - data[i].pageX < 400 ? $scope.selection[i].styleRight : $scope.selection[i].styleLeft;
            $scope.left = data[i].pageX > 200;
            $scope.right = window.innerWidth - data[i].pageX > 200;
        }
        if ($scope.selection.length === 2) {
            // make sure that there is enough space for labels
            var open = $scope.selection[0],
                close = $scope.selection[1],
                clearanceTier = close.style.right ? 300 : 125,
                clearance = close.styleLeft.left - open.styleLeft.left;

            if (clearance < clearanceTier) {
                // there is not enough room for the labels between open and close
                if (clearanceTier === 300) {
                    // there are two labels between
                    if (close.styleRight.right > 125) {
                        // room to the right, move it
                        close.style = close.styleLeft;
                        $scope.right = window.innerWidth - (close.style.left + 125) > 200;
                    } else {
                        // no room, hide it
                        delete close.time;
                    }
                }

                if (clearanceTier === 125 && clearance < 125) {
                    // there is one label between
                    if (open.styleLeft.left > 125) {
                        // room to the left, move it
                        open.style = open.styleRight;
                        $scope.left = window.innerWidth - (open.style.right + 125) > 200;
                    } else {
                        // no room, hide it
                        delete open.time;
                    }
                }
            }
        }
    };

    $scope.removeSelection = function($event) {
        $scope.selection = [];
        $scope.left = true;
        $scope.right = true;
    };
}

/**
 * Controller for the Info Box
 * @author ansel
 */
function InfoBox($scope, $timeout, broadcast, scrape) {
    $scope.visible = false;
    $scope.keepInfoBox = function() {
        $timeout.cancel($scope.popupTimer);
    };
    $scope.hideInfoBox = function() {
        $scope.popupTimer = $timeout(function() {
            $scope.visible = false;
            broadcast.send({ 'action': 'removeSelection' });
        }, 200);
    };
    $scope.openPage = function() {
        window.open($scope.infoBox.pageUrl);
    };
    $scope.checkPosition = function() {
        var $infoBox = $('#infoBox'),
            style = $scope.infoBox.style;
        if ($infoBox.height() + style.top > window.innerHeight - 20) {
            style.bottom = window.innerHeight - style.top + 15;
            delete style.top;
            $scope.$apply();
        }
    };
    $scope.$on('handleBroadcast', function(event, data) {
        switch (data.action) {
        case 'showInfoBox':
            $scope.keepInfoBox();
            if ($scope.visible && $scope.infoBox && data.infoBox.id === $scope.infoBox.id) { break; }
            $scope.visible = true;
            $scope.infoBox = data.infoBox;
            $scope.checkPosition();

            // Uses scrape service to get the new image.
            scrape.get(data.infoBox.url, function(data) {
                $scope.infoBox.checkingImages = [];
                if (!data) {
                    $scope.infoBox.title = 'Could not get title...';
                } else {
                    console.log(data);
                    for (var field in data) {
                        $scope.infoBox[field] = data[field];
                    }
                    if ($scope.infoBox.images) {
                        var image,
                            largestArea = 0;
                        for (var i = 0, l = $scope.infoBox.images.length; i < l; i++) {
                            $scope.infoBox.checkingImages.push(true);
                            var image = new Image();
                            image.onload = function() {
                                if (this.width * this.height > largestArea) {
                                    $scope.infoBox.featuredImage = this.src;
                                    largestArea = this.width * this.height;
                                    $(this).remove();
                                }
                                $scope.infoBox.checkingImages.splice(0, 1);
                                $scope.$apply();
                            };
                            image.src = $scope.infoBox.images[i];
                        }
                    }
                }
            });
            $scope.$apply();
            break;

        case 'keepInfoBox':
            $scope.keepInfoBox();
            break;

        case 'hideInfoBox':
            $scope.hideInfoBox();
            break;
        }
    });
}

/**
 * Controller for canvas and everything in it
 * @author ansel
 */
function Tree($scope, rexster, broadcast) {

    /**
     * Returns current time or debug time
     * @author ansel
     *
     * @return {String} Unix epoch timestamp
     */
    $scope.now = function() {
        return localStorage.targetTime || (new Date()).getTime();
    };

    /**
     * Broadcasts range update to other controllers
     * @author ansel
     */
    $scope.updateRange = function() {
        broadcast.send({
            'action': 'updateRange',
            'rangeDuration': $scope.range,
            'openRange': $scope.rightTime - $scope.range * 1000 * 60,
            'closeRange': $scope.rightTime,
            'now': $scope.now()
        });
    };

    // scope constants
    $scope.rightTime = parseInt(localStorage.rightTime, 10) || $scope.now();
    $scope.range = parseInt(localStorage.range, 10) || 30;  // range in minutes
    $scope.offset = getScrollBarWidth();
    $scope.lineHeight = parseInt(localStorage.lineHeight, 10) || 25;  // history line height in px

    // keep track of scroll position
    $scope.scrollTop = 0;
    $('.container-fluid').on('scroll', function() {
        $scope.scrollTop = this.scrollTop;
    });

    $scope.updateRange();

    chrome.extension.onMessage.addListener(
        function(request, sender, sendResponse) {
            switch (request.action) {

            case 'callback':
                console.log(request.func);
                console.log(request.args);
                console.log($scope[request.func]);
                $scope[request.func].apply(undefined, request.args);
                break;

            default:
                break;
            }
        }
    );

    // listen for parameter changes
    $scope.$on('handleBroadcast', function(event, data) {
        switch (data.action) {
        case 'zoom':
            if (data.pageX && data.pageY) {
                var targetTime = Math.round(data.pageX / $scope.pixelRatio + $scope.leftTime);
            }

            $scope.range = $scope.range + data.timeDelta;
            if ($scope.range <= 0) {
                $scope.range = 1;
            }
            $scope.$apply();

            if (data.pageX && data.pageY) {
                var timeAtTarget = Math.round(data.pageX / $scope.pixelRatio + $scope.leftTime);
                $scope.rightTime += (targetTime - timeAtTarget);
            }
            $scope.$apply();

            $scope.updateRange();
            break;

        case 'move':
            $scope.rightTime = data.pageX ? Math.round($scope.rightTime + ($scope.range * 1000 * 60) * data.pageX) : $scope.now();
            if ($scope.rightTime > $scope.now()) {
                $scope.rightTime = $scope.now();
            }
            $scope.stage.setY($scope.stage.getY() - $scope.viewportHeight * data.scrollY);
            $scope.stage.fire('dragmove');
            $scope.updateRange();
            break;

        case 'debug':
            console.log('DEBUG Tree:');
            console.log($.extend({}, $scope));
            break;
        }
    });

    // Object contains runtime datastore and associated functions
    $scope.tree = {
        // history built based on object heirarchy
        indexed: { devices: {} },

        // tree structure built based on relationships
        built: { root: {} },

        // a dictionary of all nodes in the tree: { [vertexId]: [indexed key], ... }
        vertexIds: {},

        /**
         * Retrieve the device layer of organization from the window object
         * @author tony
         *
         * @param  {String} deviceGuid The id of the device that is being searched for
         * @return {Object}            device object or null if it does not exist
         */
        getDevice: function(deviceGuid) {
            return this.indexed.devices[deviceGuid] || null;
        },

        /**
         * Retrieve the window layer of organization from the window object
         * @author tony
         *
         * @param  {String} deviceGuid The id of the device that is being searched for
         * @param  {String} windowId   The id of the window that is being searched for
         * @return {Object} window     object or null if it does not exist
         */
        getWindow: function(deviceGuid, windowId) {
            if (!this.getDevice(deviceGuid)) {
                console.error('Device GUID does not exist');
                return null;
            }
            return this.indexed.devices[deviceGuid].windows[windowId] || null;
        },

        /**
         * Retrieve the tab layer of organization from the window object
         * @author tony
         *
         * @param  {String} deviceGuid The id of the device that is being searched for
         * @param  {String} windowId   The id of the window that is being searched for
         * @param  {String} tabId      The id of the tab that is being searched for
         * @return {Object}            tab object or null if it does not exist
         */
        getTab: function(deviceGuid, windowId, tabId) {
            if (!this.getDevice(deviceGuid)) {
                console.error('Device GUID does not exist');
                return null;
            }
            if (!this.getWindow(deviceGuid, windowId)) {
                console.error('Window does not exist');
                return null;
            }
            return this.indexed.devices[deviceGuid].windows[windowId].tabs[tabId] || null;
        },

        /**
         * Returns an indexed pageview based on its key
         * @author ansel
         *
         * @param  {String} key Unique ID of page in index
         * @return {Object}     pageView
         */
        getPageView: function(key) {
            if (!key) { return undefined; }
            var key = key.split('-');
            return $scope.tree.indexed.devices[key[0]].windows[key[1]].tabs[key[2]].pages[key[3]];
        },

        /**
         * Creates the generated ID that is used to identify each node in the runtime datastore
         * @author ansel
         *
         * @param  {Object} pageView Object stored in the runtime datastore
         * @Return {String}          unique ID
         */
        createIndexedKey: function(pageView) {
            return pageView.indexedKey || [pageView.deviceGuid, pageView.windowId, pageView.tabId, pageView.pageOpenTime].join('-');
        },

        /**
         * Add given pageViews into runtime datastore
         * @author ansel, tony
         *
         * @param  {Array} pageViews Array of pageViews
         * @return {Array}           Array of pageViews with keys
         */
        index: function(pageViews) {
            pageViews = pageViews || [];
            console.log('Indexing page views...');
            for (var i = 0, l = pageViews.length; i < l; i++) {
                var pageView = pageViews[i];
                if (!pageView ||
                    pageView.pageUrl === 'chrome://newtab/' ||
                    pageView.pageUrl.substr(0, 16) === 'chrome-search://' ||
                    !pageView.deviceGuid ||                 // pageView is not legal
                    $scope.tree.vertexIds[pageView.id] ||
                    pageView.pageCloseTime === -1) {   // pageView is a duplicate
                    pageViews.splice(i, 1);
                    i--;
                    l--;
                }

                // get or create device
                var device = $scope.tree.getDevice(pageView.deviceGuid);
                if (!device) {
                    // device not in tree. Create and fetch it
                    $scope.tree.indexed.devices[pageView.deviceGuid] = { windows: {} };
                    device = $scope.tree.getDevice(pageView.deviceGuid);
                }

                // get or create window
                var window = $scope.tree.getWindow(pageView.deviceGuid, pageView.windowId);
                if (!window) {
                    // window not in tree. Create and fetch it
                    device.windows[pageView.windowId] = { tabs: {} };
                    window = $scope.tree.getWindow(pageView.deviceGuid, pageView.windowId);
                }

                // get or create tab
                var tab = $scope.tree.getTab(pageView.deviceGuid, pageView.windowId, pageView.tabId);
                if (!tab) {
                    // tab not in tree. Create and fetch it
                    window.tabs[pageView.tabId] = { pages: {} };
                    tab = $scope.tree.getTab(pageView.deviceGuid, pageView.windowId, pageView.tabId);
                }

                // add page to history
                tab.pages[pageView.pageOpenTime] = pageView;

                // create and set indexedKey
                pageView.indexedKey = $scope.tree.createIndexedKey(pageView);
                $scope.tree.vertexIds[pageView.id] = pageView.indexedKey;
            }
            return pageViews;
        },

        /**
         * Adds node of a subtree to the built tree
         * @author ansel
         *
         * @param {Object} pageView     The pageView to add
         * @param {Object} ancestor     Optional parent node (root node otherwise)
         * @param {String} relationship Type of relationship to ancestor
         */
        addNode: function(pageView, ancestor, relationship) {
            pageView = $scope.tree.getPageView(pageView.indexedKey);
            if (!ancestor || !ancestor.builtKey) {
                $scope.tree.built.root[pageView.pageOpenTime] = { node: pageView };
                pageView.builtKey = ['root', pageView.pageOpenTime];
            } else {
                var ancestorGroup = $scope.tree.getNode(ancestor);
                if (!ancestorGroup[relationship]) {
                    ancestorGroup[relationship] = {};
                }
                ancestorGroup[relationship][pageView.pageOpenTime] = { node: pageView };
                if (pageView.builtKey) { $scope.tree.removeNode(pageView); }
                pageView.builtKey = ancestor.builtKey.concat([relationship, pageView.pageOpenTime]);
            }
        },

        /**
         * Removes and nodeGroup from the built tree
         * @author ansel
         *
         * @param  {Object} pageView pageView to be removed
         */
        removeNode: function(pageView) {
            if (pageView.parentId) {
                delete $scope.tree.getNode(pageView).children[pageView.pageOpenTime];
            } else {
                delete $scope.tree.getNode(pageView).successor;
            }
        },

        /**
         * Gets the nodeGroup for the given pageView
         * @author ansel
         *
         * @param  {Object} pageView nodeGroup to get
         *
         * @return {Object}          nodeGroup
         */
        getNode: function(pageView) {
            var nodeGroup = $scope.tree.built.root[pageView.builtKey[1]];
            for (var i = 2, l = pageView.builtKey.length; i + 1 < l; i += 2) {
                nodeGroup = nodeGroup[pageView.builtKey[i]][pageView.builtKey[i + 1]];
            }
            return nodeGroup;
        },

        /**
         * Build tree relationships based on pointers to index
         * @author ansel
         *
         * @param {Array}    pageViews Optional array of pageViews to build. Builds entire index if not set
         * @param {Function} callback  Optional callback function
         */
        build: function(pageViews) {
            console.log('Building tree...');

            // make sure pageViews are indexed first
            pageViews = $scope.tree.index(pageViews);

            // create build queue: { [vertexId]: [pageView], ... }
            var pageViewIds = {};
            for (var i = 0, l = pageViews.length; i < l; i++) {
                pageViewIds[pageViews[i].id] = pageViews[i];
            }

            // process build queue
            var i = pageViews.length - 1;
            while (pageViews.length) {
                var pageView = pageViews[i];

                if (pageView.parentId || pageView.predecessorId) {
                    // has ancestors, try to find them
                    var searchId = pageView.parentId || pageView.predecessorId;
                    if ($scope.tree.vertexIds[searchId] && !pageViewIds[searchId]) {
                        // ancestor in tree. Add node as child
                        $scope.tree.addNode(pageView, $scope.tree.getPageView($scope.tree.vertexIds[searchId]), pageView.parentId ? 'children' : 'successor');
                        // remove pageView from queue
                        pageViews.splice(i, 1);
                        delete pageViewIds[pageView.id];
                    } else if (!pageViewIds[searchId]) {
                        // ancestory not in tree or queue. Add node as root
                        $scope.tree.addNode(pageView);
                        // remove pageView from queue
                        pageViews.splice(i, 1);
                        delete pageViewIds[pageView.id];
                    }
                } else {
                    // no ancestors, add as root
                    $scope.tree.addNode(pageView);
                    pageViews.splice(i, 1);
                    delete pageViewIds[pageView.id];
                }

                // increment or reset pointer
                i = i === 0 ? pageViews.length - 1 : i - 1;
            }

            // check root nodes for new parents
            for (var pageOpenTime in $scope.tree.built.root) {
                var pageView = $scope.tree.built.root[pageOpenTime];
                if (pageView.parentId && $scope.tree.vertexIds[pageView.parentId] ||
                    pageView.predecessorId && $scope.tree.vertexIds[pageView.predecessorId]) {
                    $scope.tree.addNode(pageView, $scope.tree.getPageView($scope.tree.vertexIds[pageView.parentId || pageView.predecessorId]), pageView.parentId ? 'children' : 'successor');
                }
            }
            console.log('Build complete:');
            console.log($.extend({}, $scope.tree)); // use $.extend to create snapshot
        }
    };

    /**
     * Fetches data and updates tree
     * @author ansel
     */
    $scope.updateData = function() {
        $scope.searchCallback = function(results) {
            console.log(results);
            $scope.tree.build(results);
        };
        // do search
        rexster.search($scope.rightTime - $scope.range * 1000 * 60, $scope.rightTime, $scope.searchCallback);
        // check for persistent tabs
        /*rexster.search(function(persistentPages) {
            $scope.tree.build(persistentPages);
        });*/
    };

    $scope.updateData();
}

function getScrollBarWidth () {
    var inner = document.createElement('p');
    inner.style.width = '100%';
    inner.style.height = '200px';

    var outer = document.createElement('div');
    outer.style.position = 'absolute';
    outer.style.top = '0px';
    outer.style.left = '0px';
    outer.style.visibility = 'hidden';
    outer.style.width = '200px';
    outer.style.height = '150px';
    outer.style.overflow = 'hidden';
    outer.appendChild(inner);

    document.body.appendChild (outer);
    var w1 = inner.offsetWidth;
    outer.style.overflow = 'scroll';
    var w2 = inner.offsetWidth;
    if (w1 === w2) { w2 = outer.clientWidth; }

    document.body.removeChild (outer);

    return (w1 - w2);
};