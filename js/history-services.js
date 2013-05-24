angular.module('history.services', [], function($provide) {

    /**
     * background service for interacting with background.js
     * @author ansel
     */
    $provide.factory('background', function() {
        return {
            get: function(globals, callback) {
                chrome.extension.sendMessage({
                    action: 'getGlobals',
                    message: globals
                }, callback);
            }
        };
    });

    /**
     * Sends out a get request to specified webpage and then iterates through
     * all images to find one that best represents the given page.
     * @author chris, ansel
     */
    $provide.factory('scrape', ['$http', function($http) {
        /**
         * Strips HTML tags from an HTML STring
         * @author ansel
         *
         * @param  {String} htmlString Unsafe HTML String
         *
         * @return {String}            Safe non-HTML String
         */
        function stripTags(htmlString) {
            return htmlString.replace(/<(?:.|\n)*?>/gm, '');
        }

        /**
         * Gets the HTML String contents of any tag in a given HTML String
         * @author ansel
         *
         * @param  {String} html Target HTML
         * @param  {String} tag  Target tag
         * @param  {String} attr Optional attribute to get the contents of the tag
         *
         * @return {Array}       Array of matches. One for each tag instance
         */
        function getTagContents(html, tag, attr) {
            var search,
                match,
                results = [];

            if (attr) {
                search = new RegExp('<' + tag + '[^>]*' + attr + '="([^"]*)"', 'gi');
            } else {
                search = new RegExp('<' + tag + '[^>]*>([\\S\\s]*)<\\/' + tag + '>', 'gi');
            }

            while ((match = search.exec(html))) {
                results.push(match[1]);
            }
            return results;
        }

        return {
            get: function(url, callback) {
                if (url.match(/^http/)) {
                    url = url.replace(/^https/, 'http'); // remove HTTPS so requests don't get rejected
                    $http.get(url).then(function(response) {
                        // This is the xml returned from the get request to the external website.
                        var html = response.data,
                            data = {},
                            results;

                        // get title
                        results = getTagContents(html, 'h1');
                        if (results.length) {
                            data.title = stripTags(results[0]).substr(0, 140);
                        }

                        // get images

                        results = getTagContents(html, 'meta property="og:image"', 'content');
                        if (!results.length) {
                            results = getTagContents(html, 'img', 'src');
                            if (results.length) {
                                var domainRelativeUrl = url.match(/^.*:\/\/[^\/]*/)[0] + '/',
                                    protocolRelativeUrl = url.match(/^.*:/)[0] + '//',
                                    relativeUrl = url.replace(/[^\/]*$/, '');
                                for (var i = 0, l = results.length; i < l; i++) {
                                    if (results[i].match(/^\/\//)) {
                                        results[i] = results[i].replace(/^\/\//, protocolRelativeUrl);
                                    } else if (results[i].match(/^\//)) {
                                        results[i] = results[i].replace(/^\//, domainRelativeUrl);
                                    } else if (!results[i].match(/^.*:\/\//)) {
                                        results[i] = relativeUrl + results[i];
                                    }
                                }
                                data.images = results;
                            }
                        } else {
                            data.featuredImage = results[0];
                        }


                        callback(data);
                    });
                }
            }
        };
    }]);

    /**
     * Sends broadcast messages between scopes
     * @author ansel
     */
    $provide.factory('broadcast', function($rootScope) {
        return {
            send: function(data) {
                $rootScope.$broadcast('handleBroadcast', data);
            }
        };
    });

    /**
     * rexster service for interacting with rexster endpoints
     * @author ansel
     */
    $provide.factory('rexster', ['$http', 'background', function($http, background) {
        var searched = [];

        /**
         * Sort function for searched
         * @author ansel
         *
         * @param  {Array} a compare this
         * @param  {Array} b to this
         * @return {Int}     Where a should be relative to b
         */
        function byOpenRange(a, b) {
            if (a[0] > b[0]) { return 1; }
            if (a[0] < b[0]) { return -1; }
            return 0;
        }

        return {
            /**
             * Search the graph with Rexster
             * @author ansel
             *
             * @param  {Int}    targetTime Unix time in middle of range
             * @param  {Object} params     Optional search arguments
             *             userGuid             If userGuid is different than the local user
             *             domain               All search results will be under this domain (ex. google.com)
             *             timeRange            Number of timeRangeUnits to search on either side of the openTime (default: 30)
             *             timeRangeUnits       hours, minutes, seconds (default: minutes)
             *             includeChildren      If true, return all children of search results along with the results (default: false)
             *             includeSuccessors    If true, return all successors of any search results along with the results (default: false)
             * @param {Function} callback  Optional callback function
             *
             * @return {Object}            Angular Promise
             */
            search: function(openRange, closeRange, params, callback) {
                if (typeof openRange === 'function') {
                    // request for persistent tabs
                    callback = openRange;
                    var request = '/vertices/' + localStorage.deviceGuid + '/parsley/cleanup/openTabs';
                } else {
                    if (typeof params === 'function') {
                        // handle omitted params object
                        callback = params;
                        params = {};
                    }
                    if (openRange && closeRange) {
                        if (searched.length) {
                            // there have been previous searches, adjust length
                            var isOpenInRange,
                                isCloseInRange,
                                isInsideRange;
                            for (var i = 0, l = searched.length; i < l; i++) {
                                isOpenInRange = openRange >= searched[i][0] && openRange <= searched[i][1];
                                isCloseInRange = closeRange >= searched[i][0] && closeRange <= searched[i][1];
                                isInsideRange = openRange <= searched[i][0] && closeRange >= searched[i][1];
                                if (isOpenInRange && isCloseInRange) { return []; }
                                else if (isOpenInRange) {
                                    openRange = searched[i][1];
                                    searched[i][1] = closeRange;
                                }
                                else if (isCloseInRange) {
                                    closeSearchedRange = closeRange = searched[i][0];
                                    searched[i][0] = openRange;
                                }
                                else if (isInsideRange) {
                                    searched.push([openRange, closeRange]);
                                    arguments.callee(openRange, searched[i][0], params, callback);
                                    openRange = searched[i][1];
                                    searched.splice(i, 1);
                                    i--;
                                    l--;
                                }
                            }
                        } else {
                            searched.push([openRange, closeRange]);
                        }
                        searched.sort(byOpenRange);

                        var encoded = [];
                        params = params || {};
                        params.userGuid = localStorage.userGuid || params.userGuid;
                        params.openRange = openRange;
                        params.closeRange = closeRange;
                        for (var key in params) {
                            encoded.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
                        }
                        var request = '/parsley/search?' + encoded.join('&');
                    }
                }

                return $http
                    .get(localStorage.SERVER + '/graphs/WhySearchTwice' + request)
                    .then(function(response) {
                        var results = response.data.results;
                        if (typeof params === 'function') { params(results); }
                        if (typeof callback === 'function') { callback(results); }
                    })
                ;
            }
        };
    }]);
});