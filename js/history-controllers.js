/* JSHint: */
/* global moment */

/**
 * Controller for the header controls
 * @author ansel
 */
function Controls($scope, broadcast) {
    $scope.zoom = function(timeDelta) {
        broadcast.send({
            'action': 'zoom',
            'timeDelta': timeDelta
        });
    };
    $scope.page = function(pageAmount) {
        broadcast.send({
            'action': 'page',
            'pageAmount': pageAmount
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
function Range($scope) {
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
    $scope.$on('handleBroadcast', function(event, data) {
        switch (data.action) {
            case 'showInfoBox':
            $timeout.cancel($scope.popupTimer);
            if ($scope.visible && $scope.infoBox && data.infoBox.id === $scope.infoBox.id) { break; }
            $scope.infoBox = data.infoBox;
            $scope.visible = true;
            $scope.$apply();

            // Uses scrape service to get the new image.
            var scrapePromise = scrape.get(data.infoBox.url);
            scrapePromise.then(function(url) {
                if(url) {
                    $scope.infoBox.picUrl = url;
                    window.console.log($scope.infoBox);
                }
            });
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
            'openRange': $scope.rightTime - $scope.range * 1000 * 60,
            'closeRange': $scope.rightTime
        });
    };

    // scope constants
    $scope.rightTime = $scope.now();
    $scope.range = localStorage.range || 30;            // range in minutes
    $scope.offset = localStorage.offset || 0;         // right offset in px
    $scope.lineHeight = localStorage.lineHeight || 20;  // history line height in px

    // keep track of scroll position
    $scope.scrollTop = 0;
    $('.container-fluid').on('scroll', function() {
        $scope.scrollTop = this.scrollTop;
    });

    $scope.updateRange();

    // listen for parameter changes
    $scope.$on('handleBroadcast', function(event, data) {
        switch (data.action) {
        case 'zoom':
            $scope.range = $scope.range + data.timeDelta;
            if ($scope.range <= 0) {
                $scope.range = 1;
            }
            $scope.updateRange();
            break;

        case 'page':
            $scope.rightTime = $scope.rightTime + ($scope.range * 1000 * 60) * data.pageAmount;
            if ($scope.rightTime > $scope.now()) {
                $scope.rightTime = $scope.now();
            }
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
            console.log('Indexing page views...');
            for (var i = 0, l = pageViews.length; i < l; i++) {
                var pageView = pageViews[i];
                if (!pageView ||
                    !pageView.deviceGuid ||                 // pageView is not legal
                    $scope.tree.vertexIds[pageView.id]) {   // pageView is a duplicate
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
            console.log(pageViews.slice(0));

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
        // do search
        rexster.search($scope.rightTime - $scope.range * 1000 * 60, $scope.rightTime, function(results) {
            $scope.tree.build(results);
        });
        // check for persistent tabs
        rexster.search(function(persistentPages) {
            $scope.tree.build(persistentPages);
        });
    };

    $scope.updateData();
}