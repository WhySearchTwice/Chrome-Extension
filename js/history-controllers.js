function Tree($scope, rexster) {
    // scope constants
    $scope.range = localStorage.range || 30;            // range in minutes
    $scope.offset = localStorage.offset || 100;         // right offset in px
    $scope.lineHeight = localStorage.lineHeight || 20;  // history line height in px

    // Object contains runtime datastore and associated functions
    $scope.tree = {
        data: { devices: {} },
        rendered: {},

        /**
         * Retrieve the device layer of organization from the window object
         * @author tony
         *
         * @param  {String} deviceGuid The id of the device that is being searched for
         * @return {Object}            device object or null if it does not exist
         */
        getDevice: function(deviceGuid) {
            return this.devices[deviceGuid] || null;
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
            return this.devices[deviceGuid].windows[windowId] || null;
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
            return this.devices[deviceGuid].windows[windowId].tabs[tabId] || null;
        },

        /**
         * Add given pageViews into runtime datastore
         * @author ansel, tony
         *
         * @param {Array} pageViews Array of pageViews
         */
        index: function(pageViews) {
            console.log('Adding pageViews to index:');
            console.log(pageViews);

            for (var i = 0, l = pageViews.length; i < l; i++) {
                var pageView = pageViews[i];

                var device = $scope.tree.getDevice(pageView.deviceGuid);
                if (!device) {
                    // device not in tree. Create and fetch it
                    $scope.tree.data.devices[pageView.deviceGuid] = { windows: {} };
                    device = $scope.tree.getDevice(pageView.deviceGuid);
                }

                var window = $scope.tree.getWindow(pageView.deviceGuid, pageView.windowId);
                if (!window) {
                    // window not in tree. Create and fetch it
                    device.windows[pageView.windowId] = { tabs: {} };
                    window = $scope.tree.getWindow(pageView.deviceGuid, pageView.windowId);
                }

                var tab = $scope.tree.getTab(pageView.deviceGuid, pageView.windowId, pageView.tabId);
                if (!tab) {
                    // tab not in tree. Create and fetch it
                    window.tabs[pageView.tabId] = { pages: {} };
                    tab = $scope.tree.getTab(pageView.deviceGuid, pageView.windowId, pageView.tabId);
                }

                // Create the page in the tab
                console.log('Saving page...');
                tab.pages[pageView.pageOpenTime] = pageView;

                pageView.key = $scope.tree.getKey(pageView);
            }
        },

        /**
         * Build tree relationships based on pointers to index
         * @author ansel
         *
         * @param {Array} pageViews Optional array of pageViews to build. Builds entire index if not set
         */
        build: function(pageViews) {
            for (var i = 0, l = pageViews.length; i < l; i++) {
                var pageView = pageViews[i];

                if (!pageView.parentId && !pageView.predecessorId) {

                }
            }
        },

        /**
         * Creates the generated ID that is used to identify each node in the runtime datastore
         * @author tony
         * @param  {Object} pageView Object stored in the runtime datastore
         * @Return {String}          unique ID
         */
        getKey: function(pageView) {
            return pageView.key || [pageView.deviceGuid, pageView.windowId, pageView.tabId, pageView.pageOpenTime].join('-');
        }
    };

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
     * Fetches data and updates tree
     * @author ansel
     */
    $scope.tick = function() {
        rexster.search($scope.now(), {
            timeRange: $scope.range,
            timeRangeUnits: 'minutes'
        },function(response) {
            $scope.tree.index(response);
            $scope.tree.build(response);

            angular.extend($scope.pageViews, response);
        });
    };

    $scope.tick();
}