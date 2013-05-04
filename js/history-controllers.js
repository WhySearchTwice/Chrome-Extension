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
function Range($scope, broadcast) {
    $scope.$on('handleBroadcast', function(event, data) {
        console.log(data);
        if (data.action === 'updateRange') {
            $scope.openRangeDate = moment(data.openRange).format('MMM D');
            $scope.openRangeTime = moment(data.openRange).format('H:mma');
            $scope.closeRangeDate = moment(data.closerRange).format('MMM D');
            $scope.closeRangeTime = moment(data.closerRange).format('H:mma');
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
            'openRange': $scope.right - $scope.range * 1000 * 60,
            'closeRange': $scope.right
        });
    };

    // scope constants
    $scope.right = $scope.now();
    $scope.range = localStorage.range || 30;            // range in minutes
    $scope.offset = localStorage.offset || 0;         // right offset in px
    $scope.lineHeight = localStorage.lineHeight || 20;  // history line height in px

    $scope.updateRange();

    // listen for parameter changes
    $scope.$on('handleBroadcast', function(event, data) {
        console.log(data);
        switch (data.action) {
        case 'zoom':
            $scope.range = $scope.range + data.timeDelta;
            if ($scope.range <= 0) {
                $scope.range = 1;
            }
            $scope.updateRange();
            break;

        case 'page':
            $scope.right = $scope.right + ($scope.range * 1000 * 60) * data.pageAmount;
            if ($scope.right > $scope.now()) {
                $scope.right = $scope.now();
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
                if (pageView.pageUrl === 'chrome://newtab/') { pageViews.splice(i, 1); i--; l--; } // ToDo: remove this hack

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
            if (!ancestor) {
                $scope.tree.built.root[pageView.pageOpenTime] = { node: pageView };
                pageView.builtKey = ['root', pageView.pageOpenTime];
            } else {
                var ancestorGroup = $scope.tree.built.root[ancestor.builtKey[1]];
                for (var i = 2, l = ancestor.builtKey.length; i + 1 < l; i += 2) {
                    ancestorGroup = ancestorGroup[ancestor.builtKey[i]][ancestor.builtKey[i + 1]];
                }
                if (!ancestorGroup[relationship]) {
                    ancestorGroup[relationship] = {};
                }
                ancestorGroup[relationship][pageView.pageOpenTime] = { node: pageView };
                pageView.builtKey = ancestor.builtKey.concat([relationship, pageView.pageOpenTime]);
            }
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
        rexster.search($scope.right - $scope.range * 1000 * 60, $scope.right, function(results) {
            // check for persistent tabs
            rexster.search(function(persistentPages) {
                $scope.tree.indexed = { devices: {} };
                $scope.tree.built = { root: {} };
                $scope.tree.vertexIds = {};
                $scope.tree.build(persistentPages.concat(results));
            });
        });
    };

    $scope.updateData();
}