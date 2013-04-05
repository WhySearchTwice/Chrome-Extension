/* JSHint: */
/* global Tree */

angular.module('history.directives', [])
    .directive('kinetic', function($timeout, $window) {
        return {
            restrict: 'E',
            replace: true,
            template: '<div id="container"></div>',
            link:function postLink($scope, iElement, iAttrs) {
                // create stage
                $scope.stage = new Kinetic.Stage({
                    container: 'container',
                    width: window.innerWidth,
                    height: window.innerHeight - $('.navbar').outerHeight()
                });

                $scope.$watch('tree.indexed', function() {
                    $scope.drawAll(); // ToDo: Change to update an update function
                    $scope.stage.setSize({
                        width: $scope.viewportWidth,
                        height: $scope.lineHeight * $scope.tree.indexed.length
                    });
                }, true);

                $scope.viewportWidth = $window.innerWidth;
                angular.element($window).bind('resize', function() {
                    $scope.$apply(function() {
                        $scope.viewportWidth = $window.innerWidth;
                        $scope.viewportHeight = $window.innerHeight;
                    });
                });

                $scope.$watch('viewportWidth', function(newValue, oldValue) {
                    $scope.stage.setSize({
                        width: newValue
                    });
                });

                /**
                 * Draw all nodes in $scope.tree.indexed
                 * @author chris, ansel
                 */
                $scope.drawAll = function() {
                    for (var i = 0; i < $scope.tree.indexed.length; i++) {
                        // px to ms ratio
                        var ratio = (window.innerWidth - $scope.offset) / (1000 * 60 * $scope.range);   // ratio = effective canvas / range in ms
                        var leftTime = (new Date()).getTime() - (1000 * 60 * $scope.range);             // leftTime = now - range in ms
                        var start = ratio * ($scope.pageViews[i].pageOpenTime - leftTime);
                        var end = $scope.pageViews[i].pageCloseTime ? ratio * ($scope.pageViews[i].pageCloseTime - leftTime) : window.innerWidth - $scope.offset;
                        $scope.drawNode(start, end, i * $scope.lineHeight, $scope.pageViews[i]);
                    }
                };

                /**
                 * Draw a single node
                 * @author chris
                 *
                 * @param  {Int} start    pageOpenTime on x axis
                 * @param  {Int} end      pageCloseTime on x axis
                 * @param  {Int} y        top position in stack
                 * @param  {Int} pageView pageView Object
                 */
                $scope.drawNode = function(start, end, y, pageView) {
                    var layer = new Kinetic.Layer();
                    var group = new Kinetic.Group({
                        x: start,
                        y: y
                    });

                    var line = new Kinetic.Line({
                        points: [0, 15, end - start, 15],
                        stroke: end === window.innerWidth - $scope.offset ? 'blue' : 'black', // blue == still open
                        strokeWidth: 4
                    });

                    var url = pageView.pageUrl || 'Missing URL';
                    // truncate URLs loner than 50 chars
                    if (url.length > 50) {
                        url = url.substr(0, 50) + '...';
                    }

                    var text = new Kinetic.Text({
                        text: url,
                        fontSize: 13,
                        fontFamily: 'Arial',
                        fill: '#aaa',
                        width: 800,
                        x: start < 0 ? -1 * start : 0 // prevent text from falling off left side of screen
                    });

                    group.add(line);
                    group.add(text);
                    layer.add(group);
                    $scope.stage.add(layer);
                };

                // draw now line
                var layer = new Kinetic.Layer();
                var line = new Kinetic.Line({
                    points: [window.innerWidth - $scope.offset, 0, window.innerWidth - $scope.offset, 10000],
                    stroke: 'red',
                    strokeWidth: 2
                });
                layer.add(line);
                $scope.stage.add(layer);
                $scope.drawAll();
            },
            controller: Tree
        };
    })

;